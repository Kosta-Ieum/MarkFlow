# MarkFlow 컨벤션 (Coding & Git Conventions)

| 항목 | 내용 |
| --- | --- |
| 문서 유형 | 팀 코딩·Git 컨벤션 |
| 적용 범위 | `apps/web`(프론트) · `apps/api`(백엔드) · `packages/shared` |
| 작성일 | 2026-06-25 |

> 이 문서는 **네이밍·포맷·Git·테스트** 등 스타일/프로세스 규칙이다.
> **아키텍처 불변식**(서비스 seam·권한 양면·정규화·에코루프 등)은 `.claude/rules/`가 정본이며 여기서 반복하지 않는다.
> 강제는 ESLint/Prettier + CI + 브랜치 보호(PR 리뷰 필수)가 담당한다.

---

## 0. 공통 원칙

- 언어: **TypeScript**(JS 신규 파일 금지). 포맷: **Prettier**, 린트: **ESLint** — 저장 시 자동 적용, CI에서 검증.
- **`any` 금지** → `unknown` + zod 파싱. 외부 입력은 `@markflow/shared` 스키마로 검증.
- 타입·DTO·이벤트명은 **`@markflow/shared`에서 import**(로컬 재정의·문자열 하드코딩 금지).
- 한 PR = 한 목적(Linear 이슈 1개 단위). 무관한 리팩터링 섞지 않기.

### 0.1 네이밍

| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 변수·함수 | camelCase | `nodeService`, `loadCanvas` |
| 불리언 | `is/has/can` 접두 | `isOwner`, `canEdit` |
| 타입·인터페이스·enum | PascalCase | `NodeDTO`, `Role` |
| zod 스키마 | `XxxSchema` | `NodeDTOSchema` |
| 진짜 상수 | UPPER_SNAKE | `SOCKET_EVENTS`, `JWT_EXPIRES_IN` |
| React 컴포넌트 | PascalCase | `NodeCard`, `ChatPanel` |
| 훅 | `useXxx` | `useCollaboration` |
| 이벤트 핸들러 | `handleXxx` / props는 `onXxx` | `handleConnect`, `onSave` |

### 0.2 import 순서 (ESLint `import/order`로 강제)

```
1) 외부 패키지         react, zod, @xyflow/react
2) 워크스페이스 alias  @markflow/shared
3) 절대/별칭 내부      @/store, @/lib
4) 상대경로            ./NodeCard
```
- 타입 전용은 `import type { NodeDTO } from "..."`.

### 0.3 주석
- "무엇"이 아니라 **"왜"**. 자명한 코드에 주석 금지.
- TODO는 `// TODO(이슈ID): ...` 형태(예: `// TODO(IEUM-42): ...`).

---

## 1. Git 컨벤션 (Linear 연동)

### 1.1 브랜치
- **Linear가 생성한 브랜치명을 그대로 사용**한다 → `git lb IEUM-13` (또는 Claude `/branch IEUM-13`).
  - 이슈 ID가 포함돼 **PR↔이슈 자동 링크 + 상태 자동 이동**(Linear↔GitHub 연동).
- 직접 만들 땐 형식: `<type>/IEUM-<번호>-<짧은-설명>` (예: `feat/IEUM-12-node-crud`).
- `main` 직접 push 금지(브랜치 보호). 항상 PR.

### 1.2 커밋 메시지 (Conventional Commits)
```
<type>(<scope>): <요약>
```
- **type**: `feat` `fix` `chore` `docs` `refactor` `test` `style` `perf` `ci`
- **scope**: `api` · `web` · `shared` · `docs` · `infra`
- 요약: 명령형, 한국어 가능, ~72자.
- 예: `feat(api): 노드 CRUD 서비스 + 활동 로그 기록`
- 본문에 Linear 이슈 참조(`IEUM-12`), AI 페어 시 `Co-Authored-By:` 트레일러.

### 1.3 PR
- 작게 유지. 템플릿(`.github/pull_request_template.md`) 채우기.
- 제목에 Linear ID 포함(예: `feat(web): 캔버스 저장 [IEUM-21]`).
- 머지 전: `./scripts/check` 통과 + **사람 리뷰어 승인**. 셀프 머지 금지.

---

## 2. 백엔드 컨벤션 (`apps/api`)

> 레이어 규칙(컨트롤러/게이트웨이=전송, 서비스=로직)은 `.claude/rules/backend.md` 참조.

### 2.1 파일 네이밍
- 모듈 파일은 역할 접미사: `*.controller.ts` · `*.service.ts` (kebab + dot).
- 1 모듈 = 1 폴더(`modules/<도메인>/`).

### 2.2 코드 스타일
- **async/await만** 사용(`.then` 체이닝 금지). 모든 await는 에러 처리 경로 보장.
- DB 접근은 service 안에서만(`prisma` 직접 import는 service/lib 한정).
- 변경 + `ActivityLog`는 **한 `prisma.$transaction`**.
- 함수는 단일 책임. 컨트롤러 핸들러는 ~15줄 이내 지향(파싱→service→응답).

### 2.3 검증 · 에러
- 입력 검증은 진입부에서 `XxxSchema.parse(...)`(REST body·소켓 payload).
- 에러는 **`AppError(code, status)` throw** → error-handler가 표준 포맷(`09-API-Spec §0.3`)으로 변환. 에러 삼키기(`catch {}`) 금지.
- HTTP 상태는 명세(`09-API-Spec §0.3`)와 정합: 400/401/403/404/409/422.

```ts
// ✅ 컨트롤러
router.post("/projects/:id/nodes", auth, async (req, res, next) => {
  try {
    const dto = NodeCreateSchema.parse(req.body);
    const node = await nodeService.create(dto, actorOf(req));
    res.status(201).json(node);
  } catch (e) { next(e); }
});
```

### 2.4 소켓 핸들러
- 이벤트명은 `SOCKET_EVENTS` 상수 사용(문자열 리터럴 금지).
- 송신 이벤트는 `ack({ ok, data }|{ ok:false, error })`로 결과 반환.
- 변경 이벤트는 진입부 `assertPermission`. broadcast는 `roomOf(projectId)`.

### 2.5 계약
- REST 계약 변경 → `apps/api/openapi.yaml` 먼저(`openapi:lint`).
- DTO/이벤트 변경 → `packages/shared` 먼저 → BE·FE 동시. 절차: `api-contract-change` 스킬.

---

## 3. 프론트엔드 컨벤션 (`apps/web`)

> 상태·전송 규칙(Zustand 단일소스·CollabAPI·에코루프)은 `.claude/rules/frontend.md` 참조.

### 3.1 파일·컴포넌트
- 컴포넌트 파일 = **PascalCase**(`NodeCard.tsx`), 훅 = `useXxx.ts`, 그 외 camelCase.
- 1 컴포넌트 1 파일, 기능 단위 폴더(`features/<도메인>/`).
- 함수형 컴포넌트 + 화살표 또는 `function` 일관 유지. **default export 지양**(named export 권장).
- props 타입은 `XxxProps` 인터페이스로 명시.

### 3.2 상태 · 데이터
- 캔버스/프레즌스/채팅 = **Zustand store** 구독. 컴포넌트에서 `fetch`/`socket` 직접 호출 금지.
- REST 서버상태 = **TanStack Query**. 쿼리 키 규칙: `["projects"]`, `["project", id, "members"]`(배열·계층).
- 실시간 수신은 `applyRemote*`(emit 금지), 내 액션만 `applyLocal*` + emit.

### 3.3 폼
- **react-hook-form + `zodResolver`**, 스키마는 `@markflow/shared` 재사용.
- 에러 메시지는 스키마/리졸버에서 일관 처리.

### 3.4 스타일 (Tailwind)
- 색·간격은 **디자인 토큰**(Tailwind config, 화면설계서 §1) 사용 — 임의 hex 하드코딩 금지.
- 조건부 클래스는 `clsx`/`cn` 유틸. 인라인 `style`은 동적 좌표 등 불가피한 경우만.
- 매직 넘버 피하고 토큰/상수화.

### 3.5 접근성 · UX
- 인터랙티브 요소는 Radix 프리미티브(모달/메뉴/탭) 사용 — 키보드·포커스 보장.
- 권한 비활성화는 `disabled` + 툴팁(UX용, 서버 가드와 별개).

---

## 4. 테스트 컨벤션

- 단위/통합: **Vitest + Testing Library**. 파일 `*.test.ts(x)`, 대상 옆 또는 `__tests__/`.
- E2E: **Playwright**(`e2e/*.spec.ts`) — 핵심은 **멀티탭 실시간** 시나리오.
- 테스트 제목은 행동 기술: `"뷰어는 노드 생성 시 403을 받는다"`.
- 외부 입력/권한/에러 경로를 우선 커버. 실시간은 2-클라이언트 시나리오로.

---

## 5. 강제 수단 (참고)

| 규칙 | 강제 |
| --- | --- |
| 포맷·린트 | Prettier/ESLint + `post-edit-check` 훅 + CI |
| 타입·빌드·OpenAPI | `./scripts/check`(typecheck·build·openapi:lint) + CI |
| 금지 경로/명령 | `.claude/settings.json`(deny) |
| 승인 | PR 리뷰 + 브랜치 보호 |

---

## 관련 문서

- 아키텍처 불변식 — `.claude/rules/` (backend·frontend·realtime·data·shared)
- 아키텍처 — `06-Backend-Architecture.md` · `07-Frontend-Architecture.md`
- API/계약 — `09-API-Spec.md` · `apps/api/openapi.yaml` · `packages/shared`
- 일정 — Linear (IEUM)
