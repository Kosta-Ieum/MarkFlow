# MSW dev 목 (Mock Service Worker)

BE(NestJS)가 아직 스텁이라 실제 REST API가 없을 때, 로그인 ~ F2 흐름을 브라우저에서 단독 테스트하기 위한 **개발 전용 가짜 서버**다. `VITE_MOCK_API=1` 일 때만 활성화된다.

## 실행법

```bash
VITE_MOCK_API=1 pnpm --filter @markflow/web dev
```

또는 `apps/web/.env`(또는 `.env.local`)에 추가:

```dotenv
VITE_MOCK_API=1
```

플래그가 없으면 워커는 절대 기동되지 않고, `lib/api()`는 평소처럼 실서버(`VITE_API_BASE ?? http://localhost:4000`)로 요청한다. **BE 구현이 끝나면 플래그만 끄면 그대로 실서버로 동작한다.**

> 서비스 워커 스크립트는 `apps/web/public/mockServiceWorker.js`. `msw init public --save`로 생성/갱신한다.

## 동작 원리

- `main.tsx`가 렌더 전에 `import.meta.env.VITE_MOCK_API === "1"` 일 때만 `./mocks/browser`를 **동적 import**하여 워커를 시작한다(프로덕션 번들에는 별도 청크로 분리, 플래그 없으면 로드 안 됨).
- 핸들러 URL base는 `lib/api()`와 동일한 `VITE_API_BASE ?? "http://localhost:4000"`를 사용한다.
- `onUnhandledRequest: "bypass"` — 목이 정의하지 않은 요청은 통과시킨다.
- 응답 envelope는 `apps/api/openapi.yaml` 정본과 일치한다. 모든 타입은 `@markflow/shared`에서 import한다.

## 상태(stateful in-memory)

`db.ts`가 모듈 단일 인스턴스 in-memory store다. **새로고침하면 시드로 초기화**된다. CRUD가 상태에 반영된다:

- 프로젝트 생성/이름변경/삭제(휴지통 이동)/복구/영구삭제
- 노드 부분 수정(위치만 변경 시 MOVE, 그 외 UPDATE 활동 로그)
- 메시지 추가
- 활동 로그 prepend

## 시드 데이터

- **데모 계정**: 로그인/회원가입은 **아무 email·비밀번호로나 성공**한다(데모용). 입력한 email로 현재 사용자(`db.user`)가 갱신되고 가짜 토큰이 발급된다. 기본 사용자는 `데모 사용자 <demo@markflow.app>`.
- **활성 프로젝트 3개** — 권한 UI 확인용으로 role을 섞었다:
  - `제품 로드맵` — OWNER
  - `블로그 초안` — EDITOR
  - `리서치 보드` — VIEWER
- 각 프로젝트 **캔버스**: 노드 5개(`idea` / `doc` / `task` / `decision` / `data` 각 1개) + 엣지 3개.
- 각 프로젝트 **채팅 메시지** 3개, **활동 로그** 4개(CREATE / UPDATE / CONNECT / MOVE).
- **휴지통** 프로젝트 1개(`지난 분기 회고`, OWNER).

## 파일

| 파일 | 역할 |
| --- | --- |
| `db.ts` | stateful in-memory store + 시드 + 변이 헬퍼 |
| `handlers.ts` | MSW v2 `http` 핸들러(auth/projects/canvas/nodes/messages/history) |
| `browser.ts` | `setupWorker(...handlers)` export |
| `../../public/mockServiceWorker.js` | MSW 서비스 워커 스크립트(생성물) |

## 커버하는 엔드포인트

- 인증: `POST /auth/signup`·`/auth/login`·`/auth/refresh`·`/auth/logout`, `GET /auth/me`
- 프로젝트: `GET /projects`·`/projects/trash`, `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`·`/projects/:id/permanent`, `POST /projects/:id/restore`
- 캔버스/노드: `GET`·`PUT /projects/:id/canvas`, `PATCH /projects/:id/nodes/:nodeId`
- 노드 휴지통(§CV-16): `DELETE /projects/:id/nodes/:nodeId`, `POST .../restore`, `DELETE .../permanent`, `GET /projects/:id/trash`
- 채팅: `GET`·`POST /projects/:id/messages`
- 히스토리: `GET /projects/:id/history`

> GET 핸들러는 단순화를 위해 Bearer 없이도 동작한다.
