---
feature: account-auth-improvements
status: approved
created: 2026-07-14
---

# 계정/인증 개선 — 태스크

> 체크박스가 실행 상태의 단일 진실 공급원이다. 태스크 완료 = 완료 조건 + 연결된 인수 조건 충족 + 관련 테스트 통과.

## 실행 메모
- 범위 = **F2(apps/web) + packages/shared(zod)**. `apps/api`(openapi·prisma·서비스)는 role=F2 가드로 차단 → **BE 멤버 별도 이슈**.
- 계약 형태는 design §3에 동결. BE는 `openapi.yaml`·`Docs/08`·`Docs/09`를 이 형태대로 미러.
- 모든 태스크는 **`VITE_MOCK_API=1` mock으로 지금 검증** 가능. 실 BE 통합검증은 T10 참고.
- 순서: T1·T2(계약+mock 토대) → T3~T5(세션 인프라) → T6~T9(기능 UI) → T10(통합).

---

- [x] **T1. 계약 확장 (packages/shared)** — ✅ shared test 22 통과, tsc 클린
  - 내용: `SignupRequestSchema`+nickname(`trim().min(2).max(20)`), `UserSchema`·`UserRefSchema`·`MemberSchema`+nickname(`nullable().optional()`), 신규 `UpdateProfileRequestSchema`. `types.ts` `z.infer` 파생 + `UpdateProfileRequest`·`UserRef` export 타입. 스키마 유닛 테스트(nickname 경계) 추가.
  - 요구사항: R4(계약), R5.2, R6.3
  - 완료 조건: `pnpm --filter @markflow/shared test` 통과 + 타입 빌드 통과. **조율**: BE가 openapi·Docs 미러(design §3).

- [x] **T2. mock 확장 (mocks/handlers·db)** — ✅ 타입 클린. nickname 왕복·PATCH·세션인지 refresh. 런타임은 T10 e2e
  - 내용: `db.ts` `demoUser`·멤버 seed·`currentUserRef`·`loginAs`에 nickname(+`knownNicknames` 맵, 멤버 하나는 nickname=null로 fallback 확인). `signup`(body nickname→`loginAs`), `login`·`/auth/me`(응답 user nickname 자동). 신규 `PATCH /users/me`(2~20 검증→`updateOwnProfile`→user). 401→refresh 흐름은 dev mock 토글 대신 **T4에서 MSW 런타임 오버라이드**로 검증.
  - 요구사항: R3.1, R4.1, R5.2, R6
  - 완료 조건: 타입 클린(mock 파일), `VITE_MOCK_API=1`에서 nickname 왕복 + `PATCH /users/me` 200/400 동작.

- [x] **T3. authStore 개편** — ✅ persist 제거·bootstrap·setAccessToken·updateProfile, 타입 클린. 런타임은 T10 e2e
  - 내용: `persist` 제거(access 메모리화), `isBootstrapping`(초기 true), `bootstrap()`(`refreshAccessToken()`→성공 시 `/auth/me`로 user 복원→`isBootstrapping=false`), `setAccessToken()`, `updateProfile(nickname)`. login/logout 기존 유지. (signup nickname 시그니처는 호출부 정합 위해 T6에서 폼과 함께.)
  - 요구사항: R1.4, R1.5, R2.2, R4.1
  - 완료 조건: 새로고침 후 mock 세션 복원 유지, 로그아웃 시 access·user·인증상태 초기화. lib/api·authStore 타입 클린.

- [x] **T4. lib/api 인터셉터 (refresh)** — ✅ credentials·단일refresh·재시도·재귀차단, 타입 클린. 런타임은 T10 e2e
  - 내용: 모든 요청 `credentials:"include"`. 401 시 모듈 레벨 `refreshPromise`(단일 비행)로 `/auth/refresh` 1회 → 성공 시 `setAccessToken` + 원요청 1회 재시도, 실패 시 `clearAuth`+`/login`. refresh 호출·재시도 요청은 재귀 refresh 금지.
  - 요구사항: R1.1, R1.2, R1.3, R1.6, R2.1
  - 완료 조건: mock에서 만료→401→refresh→원요청 성공(재로그인 없음), 동시 401 다발에 refresh 1회, refresh 실패 시 `/login`.

- [x] **T5. 부팅 게이트 (AppShell + ProtectedRoute)** — ✅ 타입 클린. 런타임은 T10 e2e
  - 내용: `AppShell`에 `useEffect(() => bootstrap(), [])` 1회 호출. `ProtectedRoute`가 `isBootstrapping` 동안 로딩(리다이렉트 보류), 완료 후 `isAuthenticated`로 판단.
  - 요구사항: R1.4
  - 완료 조건: 로그인 상태 새로고침 시 `/login` 깜빡임 없음, 미인증 새로고침은 `/login`으로.

- [x] **T6. 회원가입 폼 nickname** — ✅ 타입 클린. signup 4-arg 관통, 폼 필드 추가
  - 내용: authStore `signup` 시그니처에 nickname 추가 + 호출부 정합. `features/auth/index.tsx` `SignupForm`에 nickname 필드(`zodResolver(SignupRequestSchema)`). nickname을 `VerifyStep`까지 전달 → OTP 성공 후 `signup(name,email,password,nickname)` 호출. 응답 user(nickname) 저장(R5.4).
  - 요구사항: R5.1, R5.2, R5.3, R5.4
  - 완료 조건: nickname 2~20 검증 동작, 가입 시 nickname 전송·저장(mock), 응답 nickname 상태 반영, 타입 클린.

- [x] **T7. 프로필 페이지 (features/profile)** — ✅ 타입 클린. 조회+nickname변경, /profile 라우트. (가입일=createdAt 계약없어 생략)
  - 내용: 신규 `features/profile/index.tsx` — 조회(name·email 읽기전용, nickname·가입일 표시), nickname 변경 폼(`zodResolver(UpdateProfileRequestSchema)`→`updateProfile`). `routes/index.tsx`에 `/profile` ProtectedRoute 추가.
  - 요구사항: R3.1, R3.2, R3.3, R4.1, R4.2, R4.3
  - 완료 조건: 진입 시 내 정보 표시, nickname 변경 즉시 반영(mock), 검증 위반 시 차단.

- [x] **T8. 헤더 사용자 메뉴 (GlobalHeader)** — ✅ 타입 클린. 아바타 드롭다운(프로필/로그아웃)+외부클릭 닫기
  - 내용: `GlobalHeader` 아바타 클릭 → 드롭다운(프로필 보기/로그아웃). "프로필 보기"→`navigate("/profile")`+닫기, "로그아웃"→`logout()`+닫기, 외부 클릭 시 닫기. 표시명 `nickname ?? name`. 새 의존성 없이 구현.
  - 요구사항: R8.1, R8.2, R8.3, R8.4, R8.5
  - 완료 조건: 클릭 시 메뉴 노출, 프로필 이동, 로그아웃 동작, 바깥 클릭 닫힘.

- [x] **T9. nickname 표시 (채팅·멤버)** — ✅ 타입 클린. 채팅 작성자·멤버 nickname??name. (프레즌스=socket 계약, 범위밖)
  - 내용: `ChatThread.tsx`(작성자명 `:66`, 프레즌스 이니셜/aria `:45`,`:43-44`) + `MembersModal.tsx`(멤버명 `:79`)를 `nickname ?? name`으로. UserRef/Member 타입에 nickname 반영(T1 연동).
  - 요구사항: R6.1, R6.2
  - 완료 조건: mock seed nickname 표시, nickname 없는 데이터는 name fallback.

- [x] **T10. 통합 검증 + BE 대기 항목 정리** — ✅ `./scripts/check` 통과 + Playwright 스모크 3/3. 인수조건 표는 spec 하단
  - 내용: `VITE_MOCK_API=1` e2e로 R1~R6·R8 인수조건 전수 점검. `./scripts/check` 실행. BE 랜딩 후 통합검증 항목(R7 쿠키 sameSite, access TTL 15m, nickname 백필, `PATCH /users/me` 실동작)을 spec에 미검증으로 명시.
  - 요구사항: 전체
  - 완료 조건: `./scripts/check` 통과, 인수조건 충족 표 보고, 미검증 항목(BE 의존) 명시.

---

## 인수조건 점검 (T10)

범례: ✅ 정적+스모크 검증 · 🟡 코드/유닛 검증(런타임 클릭 미실시) · ⏳ BE 랜딩 후 검증

| ID | 내용 | 상태 |
|---|---|---|
| R1.1 | credentials:include | ✅ (스모크 refresh 왕복) |
| R1.2 | 401→refresh→원요청 재시도 | 🟡 인터셉터 코드; refresh 경로는 부팅복원으로 입증. 중간 401 주입은 미실행 |
| R1.3 | refresh 실패→/login | ✅ (로그아웃 후 /projects→/login) |
| R1.4 | 부팅 refresh 세션 복원 | ✅ (새로고침 유지) |
| R1.5 | access 메모리 보관(persist 제거) | ✅ (localStorage 없이 refresh로만 복원) |
| R1.6 | 동시 401 단일 refresh | 🟡 코드(sharedRefresh) |
| R2.1 | 로그아웃 credentials | ✅ 코드+스모크 |
| R2.2 | 상태 초기화 | ✅ 스모크 |
| R2.3 | 서버 refresh 폐기 | ✅ mock(logout→refresh 401) / ⏳ 실 BE |
| R3.1 | 프로필 조회 | ✅ 스모크(email 표시) |
| R3.2 | email·name 읽기전용 | ✅ 코드+스모크 |
| R3.3 | 조회 401→refresh | 🟡 코드(api 경유) |
| R4.1 | nickname 변경 PATCH | ✅ 스모크 |
| R4.2 | 검증 2~20·trim | ✅ shared 유닛+zodResolver |
| R4.3 | 즉시 반영 | ✅ 스모크(헤더 갱신) |
| R5.1 | 가입폼 nickname 필드 | ✅ 스모크 |
| R5.2 | signup에 nickname 포함 | 🟡 코드 관통+mock (전체 OTP 흐름 미실행) |
| R5.3 | 검증 2~20·trim | ✅ shared 유닛 |
| R5.4 | 응답 nickname 저장 | 🟡 코드(setAuth) |
| R6.1 | 채팅 작성자 nickname??name | 🟡 코드+시드 |
| R6.2 | 멤버 nickname??name | 🟡 코드+시드(null fallback 시드) |
| R6.3 | UserRefSchema nickname | ✅ shared(T1) |
| R7.1 | 쿠키 sameSite none+secure | ⏳ BE |
| R7.2 | 배포 선행 필수 | ⏳ BE |
| R8.1 | 아바타 드롭다운 | ✅ 스모크 |
| R8.2 | 프로필 보기→/profile | ✅ 스모크 |
| R8.3 | 로그아웃 | ✅ 스모크 |
| R8.4 | 바깥 클릭 닫기 | 🟡 코드 |
| R8.5 | 표시명 nickname??name | ✅ 스모크("데모지기 메뉴") |

### BE 이슈로 넘길 항목 (F2 밖 — 별도 진행)
- access TTL `JWT_EXPIRES_IN` 7d→15m
- refresh 쿠키 `sameSite:none`+`secure` (배포 cross-site 필수)
- `openapi.yaml`에 nickname(User·SignupRequest)·`PATCH /users/me`·UpdateProfileRequest 반영 + `Docs/08-ERD`·`Docs/09-API-Spec` 갱신
- Prisma `User.nickname String?` + 마이그레이션 + 기존 row 백필(`nickname=name`)
- signup 서비스 nickname 저장 / login·me·member 응답에 nickname 포함

### 미검증(명시)
- 실 BE의 TTL·쿠키·백필·PATCH 실동작 (T7 위 항목)
- 가입일 표시 = `User.createdAt` 계약에 없어 생략(후속)
- 프레즌스(접속자) nickname = socket presence 계약(F1/realtime) — 범위 밖
