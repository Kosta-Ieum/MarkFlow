---
feature: account-auth-improvements
status: approved
created: 2026-07-14
---

# 계정/인증 개선 — 기술 설계

## 1. 아키텍처 개요

본 spec은 **F2(apps/web) 프론트만 구현**하고, apps/api·계약 정본(openapi/prisma)은 BE 멤버가 별도 이슈로 진행한다. F2가 BE를 기다리지 않도록 **① 계약을 먼저 동결**하고(§3), **② F2 코드를 그 계약에 맞춰 완성**하며, **③ MSW mock 핸들러를 계약대로 확장**해 `VITE_MOCK_API=1`로 e2e 검증한다(§5). BE 랜딩 후 mock을 끄면 실서버로 그대로 붙는다.

세 흐름(요구사항 매핑):
- **세션/인증** (R1·R2·R7): `lib/api` 인터셉터 + `authStore` 부팅 복원 + 쿠키 정책.
- **프로필** (R3·R4): 신규 `features/profile` 페이지.
- **nickname** (R5·R6): 계약 확장 + 가입 폼 + 채팅·멤버 표시.

```
부팅:  AppShell useEffect → authStore.bootstrap()
         → POST /auth/refresh (쿠키) ─ 성공 → GET /auth/me → user 복원, isBootstrapping=false
                                     └ 실패(401) → 비로그인, isBootstrapping=false
평상시: api(path) → Bearer(memory access) + credentials:include
         → 401 → (단일)POST /auth/refresh → 성공: access 교체 + 원요청 재시도
                                          └ 실패: clearAuth → /login
```

## 2. 컴포넌트와 인터페이스

### `lib/api.ts` — fetch 래퍼 (인터셉터)
- **책임**: Bearer 부착, `credentials:include`, 401 시 단일 refresh 후 원요청 재시도.
- **인터페이스**:
  - 모든 요청에 `credentials: "include"` 추가. *(R1.1, R2.1)*
  - 401 수신 시: 모듈 레벨 `refreshPromise`(단일 비행)로 `POST /auth/refresh` 1회 → 성공하면 새 accessToken을 `authStore`에 반영하고 **원요청을 새 토큰으로 1회 재시도**. *(R1.2, R1.6)*
  - refresh 자체 호출과 재시도된 요청은 **재귀 refresh 금지**(내부 플래그/전용 경로) — 무한 루프 차단. *(R1.3)*
  - refresh 실패(401/네트워크) → `clearAuth()` + `/login` 이동, 기존 에러 throw. *(R1.3)*
- **근거 요구사항**: R1.1, R1.2, R1.3, R1.6, R2.1

### `store/authStore.ts` — 인증 상태
- **책임**: access(메모리)·user 보관, 부팅 복원, 로그인/가입/로그아웃/refresh 반영.
- **인터페이스 변경**:
  - `persist` 미들웨어 **제거** → token은 메모리에만. *(R1.5, ADR-0001)*
  - 상태 추가: `isBootstrapping: boolean`(초기 `true`). *(R1.4)*
  - `bootstrap()`: `POST /auth/refresh` → 성공 시 access 저장 + `GET /auth/me`로 user 복원, 실패 시 무시. 완료 시 `isBootstrapping=false`. *(R1.4)*
  - `setAccessToken(token)`: refresh 성공 시 lib/api가 호출.
  - `signup(name, email, password, nickname)`: 시그니처에 **nickname 추가**. *(R5.2)*
  - `login`/`signup` 응답의 `user`(nickname 포함)를 그대로 저장. *(R5.4)*
  - `updateProfile(nickname)`: `PATCH /users/me` 호출 후 `user` 갱신. *(R4.1)*
- **근거 요구사항**: R1.4, R1.5, R4.1, R5.2, R5.4

### `components/AppShell.tsx` — 부팅 훅
- **책임**: 앱 최초 마운트 시 `authStore.bootstrap()` 1회 호출(모든 라우트 공통 부모).
- **인터페이스**: `useEffect(() => { bootstrap() }, [])`. *(R1.4)*
- **근거 요구사항**: R1.4

### `routes/index.tsx` — `ProtectedRoute`
- **책임**: 부팅 완료 전 리다이렉트 보류.
- **인터페이스**: `isBootstrapping`이면 로딩 표시(또는 null), 완료 후 `isAuthenticated`로 판단. *(R1.4 — 새로고침 시 `/login` 깜빡임 방지)*
- **근거 요구사항**: R1.4, R3.3

### `features/profile/index.tsx` — 프로필 페이지 (신규)
- **책임**: 내 정보 조회(name·email·nickname·가입일, name/email 읽기전용) + nickname 변경 폼.
- **인터페이스**:
  - 진입 시 `GET /auth/me` 조회(또는 authStore.user 사용). *(R3.1, R3.2)*
  - nickname 변경: react-hook-form + `zodResolver(UpdateProfileRequestSchema)` → `authStore.updateProfile`. 성공 시 즉시 반영. *(R4.1, R4.2, R4.3)*
  - 라우트: `routes/index.tsx`에 `/profile` ProtectedRoute 추가. 진입점은 `GlobalHeader` 사용자 메뉴(아래).
- **근거 요구사항**: R3.1, R3.2, R3.3, R4.1, R4.2, R4.3

### `components/GlobalHeader.tsx` — 사용자 메뉴(아바타 드롭다운) + nickname 표시
- **책임**: 아바타 클릭 시 "프로필 보기"·"로그아웃" 드롭다운(아코디언식) 노출, 이름은 `nickname ?? name`.
- **인터페이스**:
  - 아바타(`GlobalHeader.tsx:44-49`) 클릭 → 로컬 `open` 상태 토글로 메뉴 펼침. *(R8.1)*
  - "프로필 보기" → `navigate("/profile")` + 닫기. *(R8.2)*
  - "로그아웃" → `authStore.logout()`(R2 흐름) + 닫기. *(R8.3)*
  - 바깥 클릭/항목 선택 시 닫기(외부 클릭 감지 훅 또는 오버레이). *(R8.4)*
  - 표시명(`:19,46`) = `user.nickname ?? user.name`. *(R8.5)*
  - 새 의존성 없이 기존 스택으로 구현(간단 토글 + 외부 클릭). 기존 logout 트리거가 헤더에 노출돼 있으면 이 메뉴로 이동.
- **근거 요구사항**: R8.1, R8.2, R8.3, R8.4, R8.5

### `features/auth/index.tsx` — 가입 폼 + OTP 흐름
- **책임**: 회원가입 폼에 nickname 입력 추가, OTP 인증 단계를 거쳐 signup 호출 시 nickname 전달.
- **인터페이스**:
  - `SignupForm`(`auth/index.tsx:126-216`): `zodResolver(SignupRequestSchema)`(nickname 포함) + name·email·password·**nickname** 필드. *(R5.1, R5.3)*
  - nickname을 `VerifyStep`(`:230-358`)까지 전달 → OTP 성공 후 `signup(name,email,password,nickname)` 호출(`:283`). *(R5.2)*
- **근거 요구사항**: R5.1, R5.2, R5.3

### `features/panel/ChatThread.tsx` · `features/members/MembersModal.tsx` — nickname 표시
- **책임**: 채팅 작성자·프레즌스·멤버 목록을 `nickname ?? name`으로 표시.
- **인터페이스**:
  - `ChatThread.tsx:66`(작성자명), `:45`·`:43-44`(프레즌스 이니셜/aria): `message.user.nickname ?? message.user.name`. *(R6.1)*
  - `MembersModal.tsx:79`(멤버명): `member.nickname ?? member.name`. *(R6.2)*
  - (내 이름/이니셜 `GlobalHeader.tsx:19,46`은 사용자 메뉴 컴포넌트에서 처리 — R8.5)
- **근거 요구사항**: R6.1, R6.2

### `mocks/handlers.ts` · `mocks/db.ts` — 계약대로 mock 확장
- **책임**: 엔드포인트 없이도 F2 검증 가능하게 mock을 계약에 맞춤. 계약 대기분은 `TODO(계약)` 주석.
- **인터페이스**:
  - `db.ts:77-81` `demoUser`에 `nickname` 추가, `loginAs`(`:617-631`)에 nickname 처리. *(R6, R3)*
  - `signup`(`:83-94`): 요청 body의 nickname 저장·응답 user에 포함. *(R5)*
  - `login`(`:96-106`)·`/auth/me`(`:108-112`): 응답 user에 nickname 포함. *(R3, R5.4)*
  - `/auth/refresh`(`:114-118`): 정상은 `{accessToken}`. **401→refresh→retry 검증용**으로 만료 토큰 시 401 반환하는 조건부 동작 추가(테스트 토글). *(R1.2)*
  - **신규** `PATCH /users/me`: body의 nickname 검증 후 `db.user` 갱신, 갱신된 user 반환. `TODO(계약)`. *(R4.1)*
  - 채팅·멤버 seed(`db.ts:236-275`)에 nickname 부여. *(R6)*
- **근거 요구사항**: R1.2, R3, R4.1, R5, R6

## 3. 데이터 모델 — 계약 동결 (F2·mock·BE 공통 기준)

> **이 절이 BE 멤버와 공유하는 계약이다.** 정본은 `packages/shared/src/schemas.ts`(zod)와 `apps/api/openapi.yaml`이며, 형태 변경은 schemas.ts를 먼저 고치고 types.ts는 `z.infer`로 파생한다(`.claude/rules/shared.md`). BE는 이 형태대로 구현한다.

### zod 스키마 (`packages/shared/src/schemas.ts`)
```
// 확장
UserSchema          = { id: uuid, email, name, nickname: string.nullable().optional() }   // :87
UserRefSchema       = { id: uuid, name, nickname: string.nullable().optional() }           // :27  (채팅·활동)
MemberSchema        = { userId, name, email, role, nickname: string.nullable().optional() }// :172 (멤버 목록 R6.2)
SignupRequestSchema = { name, email, password.min(8), nickname: string.trim().min(2).max(20) }  // :93

// 신규
UpdateProfileRequestSchema = { nickname: string.trim().min(2).max(20) }   // PATCH /users/me body

// 변경 없음
AuthResponseSchema   = { accessToken, user: UserSchema }   // user에 nickname 자동 포함
RefreshResponseSchema= { accessToken }                     // user 없음 — 부팅 복원은 /auth/me 별도 콜
LoginRequestSchema   = 그대로
```
- `nickname`을 응답 쪽(`UserSchema`·`UserRefSchema`)에서 `.nullable().optional()`로 둔 이유: 기존 백필 전 데이터·nickname을 join하지 않는 payload도 관용 처리하기 위함. UI는 `nickname ?? name` fallback(R6.1). BE 랜딩·백필 완료 후 필요하면 BE가 `UserSchema.nickname`을 non-optional로 조일 수 있다.
- `types.ts`: 위 스키마의 `z.infer` 파생 자동 반영. `UserRef` export 타입이 없으면 소비처(ChatThread·MembersModal)에서 참조할 수 있게 필요 시 추가.

### REST 엔드포인트
| 메서드·경로 | 상태 | body / 응답 |
|---|---|---|
| `GET /auth/me` | 기존 | → `User`(nickname 포함) |
| `POST /auth/refresh` | 기존 | → `{ accessToken }` |
| `POST /auth/logout` | 기존 | → 204 |
| `POST /auth/signup` | 기존(확장) | body `SignupRequest`(nickname) → `AuthResponse` |
| `POST /auth/login` | 기존(확장) | → `AuthResponse`(user.nickname) |
| `PATCH /users/me` | **신규(BE)** | body `UpdateProfileRequest` → `User` |

### Prisma (BE 이슈 — 참고용)
```
model User { ... nickname String? ... }
// 마이그레이션: nullable 컬럼 추가 → 백필 UPDATE "User" SET nickname = name WHERE nickname IS NULL
```
`Docs/08-ERD.md`(BE), `Docs/09-API-Spec.md`·`openapi.yaml`(BE) 동시 갱신.

## 4. 에러 처리 (IF/THEN 매핑)

| 상황 | 처리 | 요구사항 |
|---|---|---|
| access 만료 → 401 | 단일 `/auth/refresh` 후 원요청 재시도 | R1.2 |
| refresh도 401(쿠키 만료/폐기) | `clearAuth()` + `/login` | R1.3 |
| 동시 다발 401 | `refreshPromise` 공유(단일 refresh) | R1.6 |
| 부팅 시 쿠키 없음/만료 | 비로그인 상태로 `isBootstrapping=false` | R1.4 |
| nickname 2~20자·공백 위반 | 폼 제출 차단 + 필드 오류(zod) | R4.2, R5.3 |
| `PATCH /users/me` 서버 오류 | 기존 `ApiError` 표시, user 상태 불변 | R4.1 |
| 배포 cross-site 쿠키 미전송 | 자동 갱신 실패 → R7.1(BE) 선행 필수 | R7.1, R7.2 |

## 5. 테스트 전략

- **계약(단위)**: `packages/shared` zod 유닛 — `SignupRequestSchema`(nickname 2~20 경계), `UpdateProfileRequestSchema`, `UserSchema`/`UserRefSchema` nickname 파싱. (기존 vitest 스위트에 추가.)
- **mock 기반 e2e (핵심, BE 무관)**: `VITE_MOCK_API=1`로 —
  - R1: 만료 토큰 → 401 → 자동 refresh → 원요청 성공(재로그인 없음), 부팅 refresh로 새로고침 후 세션 유지, refresh 실패 시 `/login`.
  - R2: 로그아웃 후 상태 초기화.
  - R3·R4: 프로필 진입 조회, nickname 변경 반영.
  - R5: 가입 폼 nickname 입력→OTP→저장, 응답 nickname 상태 반영.
  - R6: 채팅·멤버에 nickname 표시, nickname 없는 seed는 name fallback.
- **컴포넌트**: 프로필 폼 검증, 가입 폼 nickname 필드.
- **검증 못 하는 것(명시)**: 실 BE의 TTL 15m·쿠키 sameSite·백필·`PATCH /users/me` 실동작 — BE 랜딩 후 통합 검증 필요(R7 포함).

## 6. 결정 기록
- [ADR-0001: 액세스 토큰 저장·갱신 전략](../adr/0001-access-token-storage-refresh.md) — 메모리 보관 + refresh 부팅 복원 채택.
