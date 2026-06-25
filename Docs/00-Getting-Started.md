# MarkFlow 시작 가이드 (Getting Started)

| 항목 | 내용 |
| --- | --- |
| 대상 | 팀원 3인 (BE · F1 · F2) |
| 목적 | 클론 → 실행까지 + 세팅된 것 활용법 + 역할별 첫걸음 |
| 작성일 | 2026-06-25 |

> 처음 오셨다면 **§0부터** 따라 하세요. 이미 익숙하면 아래 ⚡ 빠른 시작. 역할별 시작은 §6, 막히면 §8.

---

## ⚡ 빠른 시작

```bash
git clone https://github.com/Kosta-Ieum/MarkFlow.git && cd MarkFlow
./scripts/bootstrap       # 전부 자동: .env·설치·DB(Docker)·Prisma·git lb 별칭
pnpm dev                  # api + web 동시 실행
```
그다음 Claude Code에서:
```
/onboard F1               # 역할 컨텍스트 + 편집 스코프 가드  (BE | F1 | F2)
/branch IEUM-13            # Linear 이슈명으로 브랜치 자동 생성
```
루프: 작업 → `./scripts/check` → 커밋 → `git push` → PR *(Linear 자동 링크)*

> `git lb`(Linear 자동 브랜치)만 `.env`의 `LINEAR_API_KEY` 필요. **비밀값은 `.env`에만**(추적되는 `.env.example` 금지).

---

## 0. 사전 준비 (한 번만)

| 도구 | 버전 | 비고 |
| --- | --- | --- |
| Node.js | **20** | nvm 권장 (`nvm install 20`) |
| pnpm | **10.28** | `corepack enable` 하면 자동(별도 설치 불필요) |
| PostgreSQL | 14+ | 로컬 설치 또는 Docker(§1) |
| Git | 최신 | |
| Linear | 계정 + **Personal API key** | 일정·이슈 관리 + `git lb` 자동 브랜치 (키 → `.env`) |
| VS Code | — | 확장: **ESLint · Prettier · Prisma** (선택: Marp) |

```bash
corepack enable          # pnpm 버전을 package.json 기준으로 고정
node -v                  # v20.x 확인
```

---

## 1. 처음 셋업

```bash
git clone https://github.com/Kosta-Ieum/MarkFlow.git
cd MarkFlow
./scripts/bootstrap        # 한 번에: .env 복사 + 설치 + DB(Docker 자동) + Prisma + git lb 별칭
```
`bootstrap`이 자동으로 — `.env` 생성 · 의존성 설치 · **Postgres 없으면 Docker로 기동**(있으면 사용) · Prisma 클라이언트/마이그레이션 · `git lb` 별칭 등록.

**딱 하나 손볼 것** — `git lb`(Linear 자동 브랜치)를 쓰려면 `.env`의 `LINEAR_API_KEY`를 채우세요(Linear → Settings → API → Personal API key). 비밀값은 추적되는 `.env.example`이 아니라 **`.env`에만**.

그다음 Claude Code에서 **역할 온보딩**:
```
/onboard BE          # 또는 F1 / F2
```
→ 역할 문서·규칙·1주차 이슈 주입 + 편집 스코프 가드(BE=`apps/api` / FE=`apps/web`, `.claude/settings.local.json` gitignore). *발효는 Claude 재시작 후.*
> 가드만 수동: `./scripts/set-role.sh <BE|F1|F2>`. "차선 지키기"용 소프트 가드(진짜 강제는 PR 리뷰).

---

## 2. 실행

```bash
pnpm dev          # api(4000) + web(5173) 동시 실행
```
- 개별 실행: `pnpm dev:api` / `pnpm dev:web`. 포트/주소는 `.env`(`PORT`·`VITE_API_BASE`·`VITE_WS_URL`).

---

## 3. 매일 작업 흐름

```
Linear 이슈 → git lb → 구현 → ./scripts/check → 커밋 → push → PR → 리뷰 → 머지
```

```bash
git lb IEUM-13                            # Linear 이슈명으로 브랜치 자동 생성·체크아웃
#   (또는 Claude에서  /branch IEUM-13  — 이슈 컨텍스트까지 로드)
# … 작업 …
./scripts/check                          # OpenAPI lint + 타입체크 + 빌드 (CI와 동일)
git add -p && git commit -m "feat(api): 노드 CRUD 서비스 [IEUM-13]"
git push -u origin HEAD
# GitHub에서 PR 생성(템플릿 자동) → 리뷰 승인 → 머지
#   (Linear가 브랜치명의 이슈ID로 PR 자동 링크 + 상태 자동 이동)
```
- `git lb`는 부트스트랩이 등록(`.env`의 `LINEAR_API_KEY` 필요). 수동 형식: `<type>/IEUM-<번호>-<설명>`.
- 컨벤션 상세 → **`11-Conventions.md`** · `main` 직접 push 금지, 항상 PR + 사람 리뷰.

---

## 4. 이미 세팅된 것 활용법

### 4.1 명령 / 커맨드 (한눈에)
| 명령 | 하는 일 |
| --- | --- |
| `./scripts/bootstrap` | **전부 자동**: .env·설치·DB(Docker)·Prisma·`git lb` 별칭 |
| `pnpm dev` | api + web **동시 실행** |
| `./scripts/check` | **OpenAPI lint + 타입체크 + 빌드** (PR 전 필수, CI와 동일) |
| `git lb <IEUM-id>` | Linear 이슈명으로 브랜치 생성·체크아웃 |
| `./scripts/set-role.sh <BE\|F1\|F2>` | 편집 스코프 가드 적용 |
| `/onboard <역할>` (Claude) | 역할 컨텍스트 주입 + 스코프 가드 |
| `/branch <IEUM-id>` (Claude) | 브랜치 생성 + 이슈 컨텍스트 |

### 4.2 계약 정본 (BE↔FE 인터페이스)
- **REST** = `apps/api/openapi.yaml` (`pnpm openapi:lint`)
- **Socket/DTO** = `packages/shared/src/` (`schemas.ts`·`socket.ts` zod, `types.ts`는 `z.infer`)
- 계약 변경은 **정본 먼저** + BE·FE 동시 → `api-contract-change` 스킬. FE는 `@markflow/shared`에서 **import**(하드코딩 금지).

### 4.3 CI (자동 검증)
- PR·main push마다 `.github/workflows/ci.yml`이 **OpenAPI lint + typecheck + build** 실행.
- 로컬 `./scripts/check` 통과 = CI 통과.

### 4.4 Claude Code 워크스페이스 (`.claude/`)
- **`CLAUDE.md` / `AGENTS.md`** — 리포 계약·금지사항 (자동 로드)
- **`.claude/rules/`** — 경로별 불변식(해당 폴더 작업 시 적용): backend·frontend·realtime·data·shared
- **`.claude/agents/`** — implementer·reviewer·migration-reviewer
- **`.claude/skills/`** — pr-ready·db-migration·api-contract-change
- **`.claude/commands/`** — `/onboard`·`/branch`
- **`.claude/settings.json` 가드** — push·merge·`.env` 읽기·생성물 편집 차단 (push는 사람이)

### 4.5 문서 어디를 언제 보나
| 상황 | 문서 |
| --- | --- |
| 내가 뭘 맡나 | `10-Team-Roles.md` |
| 무슨 이슈부터 | **Linear** (IEUM 이슈) |
| 코드 스타일·Git | `11-Conventions.md` |
| 화면·기능 | `04-Screen-Design.md` · `03-Feature-Spec.md` |
| 구조 설계 | `06-Backend-Architecture.md` · `07-Frontend-Architecture.md` |
| 데이터·API | `08-ERD.md` · `09-API-Spec.md` + `apps/api/openapi.yaml` |

---

## 5. 모노레포 구조 (요약)

```
apps/api      백엔드 (Express + Socket.io + Prisma)         → BE
apps/web      프론트 (React + Vite + React Flow + Zustand)   → F1 · F2
packages/shared  공용 타입/DTO/소켓 이벤트 (계약)            → 전원
Docs/         설계·일정·컨벤션 문서
.claude/ scripts/ .github/   협업·검증 인프라
```

---

## 6. 역할별 첫걸음 (1주차 = M1)

> **중요**: BE가 단독 크리티컬 패스. **BE가 1주차에 스키마·DTO·서비스 스텁을 먼저** 내줘야 F1·F2가 통합. 그 전까지 F1·F2는 로컬 선행.

### 🗄️ BE — 백엔드 전체
1. `apps/api/prisma/schema.prisma` ↔ `Docs/08-ERD.md` 정합 → `prisma:migrate`
2. `packages/shared`·`apps/api/openapi.yaml` 계약 확정 (**FE 차단 해제 지점**)
3. 인증(JWT) + 프로젝트 CRUD + `assertPermission`
4. 폴더: `apps/api` 전체 · 이슈: Linear BE-1.1~1.4

### 🎨 F1 — 캔버스 & 실시간
1. (선행) React Flow 캔버스 + 커스텀 노드 카드
2. Zustand 캔버스 스토어 — `applyLocal*`/`applyRemote*` 분리(에코 루프 대비)
3. 로컬 노드 CRUD·엣지 연결 먼저, 이후 BE REST 연결
4. 폴더: `apps/web/src/features/canvas`·`collab`·`store` · 이슈: F1-1.1~1.3

### 🧩 F2 — 셸 & 콘텐츠
1. (선행) 앱 셸·라우팅·인증 가드 + Tailwind 디자인 토큰(화면설계서 §1)
2. API 클라이언트(`lib/api`)·TanStack Query·`authStore`
3. 로그인/회원가입(react-hook-form + shared zod) → 프로젝트 리스트
4. 폴더: `apps/web/src/features/auth,projects`·`lib` · 이슈: F2-1.1~1.4

---

## 7. 꼭 지킬 것 (가드)

- **push·merge는 사람이** 직접(Claude Code 가드 차단). `main` 직접 push 금지.
- 생성물 편집 금지: `node_modules/`·`**/dist/`·`apps/api/prisma/migrations/`·prisma client.
- 권한은 **REST + Socket 양쪽** 서버에서. 프론트 비활성화는 UX용.
- 계약(`packages/shared`·`openapi.yaml`) 변경은 BE·FE 동시 + 문서 갱신.
- 실시간: 원격 수신은 store에 **적용만**(재emit 금지) — 에코 루프 방지.

---

## 8. 트러블슈팅

| 증상 | 해결 |
| --- | --- |
| `prisma generate/migrate` 실패 | `.env`의 `DATABASE_URL` + Postgres 실행 확인(§1) |
| `git lb` 실패 | `.env`의 `LINEAR_API_KEY` 확인 · 이슈 ID·권한 확인 |
| `pnpm` 버전 경고 | `corepack enable` |
| 포트 충돌(4000/5432/5173) | `.env`의 `PORT` 또는 Docker 포트 변경 |
| `./scripts/check` 실패 | 메시지 단계(openapi lint / typecheck / build) 순서로 |
| 공용 타입 안 맞음 | `pnpm --filter @markflow/shared build` |

---

## 관련 문서

- 역할 — `10-Team-Roles.md` / 일정 — Linear / 컨벤션 — `11-Conventions.md`
- 아키텍처 — `06-Backend-Architecture.md` · `07-Frontend-Architecture.md`
- 데이터·API — `08-ERD.md` · `09-API-Spec.md`
