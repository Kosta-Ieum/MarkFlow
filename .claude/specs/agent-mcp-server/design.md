---
feature: agent-mcp-server
status: approved
created: 2026-07-20
---

# AI 에이전트용 MCP 서버 — 기술 설계

## 1. 아키텍처 개요

**한 줄 요약**: `apps/mcp`(신규 워크스페이스 `@markflow/mcp`)는 MCP 툴 호출을 MarkFlow의 기존 계약으로 번역하는 **얇은 어댑터**다 — 읽기는 REST, 편집은 FE와 동일한 경로(노드 생성·수정·엣지는 소켓 emit+ack, 노드 삭제·복원은 REST→BE 브로드캐스트). BE·shared·openapi 변경 0.

```
Claude Code(에이전트)
  │ stdio (MCP)
  ▼
apps/mcp ── AuthManager ──── POST /auth/login·refresh (봇 계정, R2)
  │            │ accessToken
  ├─ 읽기 툴 ─┴─ REST GET /projects·canvas·history·trash (R3)
  ├─ 편집 툴 ──┬─ Socket emit node:add/update, edge:add/delete + ack (R4·R5.1)
  │            └─ REST DELETE/restore (BE가 소켓 브로드캐스트, R4.3)
  └─ SocketManager ── handshake auth:{token} → sync:join → presence 등록 (R5.2)
                                   ▼
                        브라우저 참가자에게 실시간 반영
```

## 2. 기술 선택과 이유

| 선택 | 무엇인가 | 왜 (대안 대비) |
|---|---|---|
| `@modelcontextprotocol/sdk` (신규 의존성) | MCP 프로토콜 공식 TypeScript SDK — stdio 서버·툴 등록·스키마 노출을 제공 | MCP는 와이어 프로토콜(JSON-RPC 기반)이라 수제 구현은 소모적이고 표준 추종이 어렵다. 공식 SDK가 사실상 유일한 선택지 |
| `socket.io-client` (mcp에 추가) | FE가 쓰는 것과 같은 소켓 클라이언트 | 편집을 FE와 동일 경로로 보내기 위한 필수품 — apps/web이 이미 사용 중인 검증된 스택 |
| 편집 = 소켓 우선, 삭제·복원 = REST | FE의 실제 송신 경로 그대로 복제 | REST-only는 노드 생성·수정이 상대 화면에 실시간 반영 안 됨(FE가 소켓으로 emit하는 연산은 BE가 REST 쓰기에 브로드캐스트를 안 붙였음). BE 브로드캐스트 보강은 BE 변경 → 인터뷰에서 배제. FE와 같은 경로면 검증된 브로드캐스트·권한 재검사를 그대로 얻는다 (ADR-0003) |
| 봇 계정 + env 자격증명 | `MARKFLOW_BOT_EMAIL/PASSWORD`로 로그인 | 인터뷰 확정. BE 무변경. 단일 세션 정책은 봇 전용 계정으로 회피 |
| zod 스키마 재사용 (`@markflow/shared`) | 툴 입력 검증을 정본 스키마로 | 계약 이중화 방지 — NodeType·XY·uuid 규칙이 FE·BE와 자동 일치 (R4.5) |
| 전송 계층 분리 | MCP `Server` 객체와 transport(stdio)를 엔트리에서만 결합 | 인터뷰 확정 ④ — 후일 HTTP(원격) 전환 시 엔트리만 교체 |

**탐색으로 확정된 제약과 대응** (explore 보고 기준):
1. **refresh는 httpOnly 쿠키 전용** (`auth.controller.ts:35-43`) — 브라우저가 아니므로 MCP가 login 응답의 `Set-Cookie`에서 `refresh_token`을 직접 파싱·보관하고, refresh 호출 시 `Cookie:` 헤더로 재전송한다. 실패(409 등) 시 전체 재로그인 폴백.
2. **단일 세션 + 소켓 강제 종료 연동** (`auth.service.ts:80-81`, `canvas.gateway.ts:67-85`) — 같은 계정 재로그인은 기존 refresh 토큰 전부 삭제 + 그 유저의 모든 소켓 강제 disconnect. 즉 **재로그인하면 봇 자신의 소켓도 끊긴다** → AuthManager가 재로그인하면 SocketManager가 새 토큰으로 재접속·재join하는 연쇄를 설계에 포함(R5.3). 봇 계정 중복 인스턴스 미지원은 requirements 운영 전제대로 문서화.
3. **API는 /api prefix 없음** (배포 서버 루트 경로) — `MARKFLOW_API_BASE`를 그대로 사용(FE의 `/api`는 프록시 산물).
4. **edge id는 서버 재발급** (`gw:232`) — edge:add ack의 `data.edge`를 툴 결과로 반환(에이전트는 서버 id만 본다). node:add는 클라 id 채택(gw:180)이라 MCP가 uuid 생성.
5. **소켓 AckResponse는 shared에 없음** (게이트웨이 로컬 타입) — MCP에 동일 형태 `{ok:true; data?} | {ok:false; error:{code,message}}`를 로컬 정의(주석으로 출처 명시).

## 3. 컴포넌트와 인터페이스

### 파일 구조 (`apps/mcp/src/`)
```
index.ts        # 엔트리 — env 검증(R1.3), Server + StdioTransport 결합
server.ts       # MCP Server 생성, 10개 툴 등록(R1.1)
auth.ts         # AuthManager — login/refresh/재로그인, Set-Cookie 파싱 (R2)
api.ts          # REST 클라이언트 — Bearer 부착, 401→토큰 갱신 1회 재시도(R2.2), ErrorResponse 매핑
collab.ts       # SocketManager — 접속/재접속, sync:join(프로젝트별 1회), emit+ack 헬퍼(타임아웃 5s)
tools/read.ts   # list_projects, get_canvas, get_history, get_trash (R3)
tools/write.ts  # create_node, update_node, delete_node, restore_node, connect_edge, disconnect_edge (R4)
errors.ts       # ErrorResponse·ack error → MCP isError 텍스트 변환 (R6)
```

### 툴 정의 (10개 — 이름은 MCP 관례대로 영어 snake_case)
| 툴 | 입력(zod) | 경로 | 결과 |
|---|---|---|---|
| `list_projects` | — | GET /projects | 프로젝트 목록(id·이름·role·nodeCount) |
| `get_canvas` | projectId | GET canvas | 노드·엣지 전체 + 내 role |
| `get_history` | projectId, limit?, before? | GET history | 활동 로그 + nextCursor |
| `get_trash` | projectId | GET trash | 휴지통 노드 목록 |
| `create_node` | projectId, title?, markdown?, type?, position? | socket node:add | 생성된 노드(ack) |
| `update_node` | projectId, nodeId, patch(부분) | socket node:update | 수정된 노드(ack) |
| `delete_node` | projectId, nodeId | REST DELETE | {id, deletedAt} |
| `restore_node` | projectId, nodeId | REST restore | {id} |
| `connect_edge` | projectId, source, target | socket edge:add | 생성된 엣지(**서버 id**) |
| `disconnect_edge` | projectId, edgeId | socket edge:delete | {id} |

- `create_node` 기본값: title은 미지정 시 "새 노드"(FE 번호 규칙은 FE 로컬 로직이라 미복제 — 에이전트는 보통 제목을 지정한다), type `idea`, collapsed true, position 미지정 시 현재 캔버스를 읽어 **겹치지 않는 그리드 슬롯**을 계산(FE `findFreePosition`과 동일 상수의 경량 사본, ~15줄 — 카드가 (0,0)에 겹겹이 쌓이는 것 방지).
- 입력 검증: `NodeTypeSchema`·`XYSchema`·`z.string().uuid()` 등 shared 재사용(R4.5). 위반 시 필드·사유를 isError로(R6).

### AuthManager (auth.ts)
- 상태: `accessToken`, `refreshCookie`(Set-Cookie 파싱값), 동시 갱신 합치기(promise 1개).
- `ensureToken()` — 없으면 login. `onUnauthorized()` — refresh 시도 → 실패 시 login 폴백 → **둘 다 실패면 명확한 에러 반환**(R2.3, 무한 재시도 금지).
- login 성공 시 `collab.onTokenRenewed(token)` 통지 → 소켓이 끊겨 있으면 새 토큰으로 재접속(제약 2 연쇄).
- 자격증명·토큰은 어떤 로그·툴 결과에도 미출력(R2.4).

### SocketManager (collab.ts)
- 소켓 1개, `auth:{token}`·`transports:["websocket"]`(FE와 동일). 프로젝트별 `sync:join` 1회(joined set 유지) — ack(CanvasSnapshot)로 join 성공 확인, presence는 서버가 자동 브로드캐스트(R5.2).
- `emitWithAck(event, payload)` — 5초 타임아웃, `{ok:false}`면 error 매핑. disconnect 시 joined set 초기화, 다음 편집 호출에서 lazy 재접속+재join(R5.3).
- 편집 전 소켓 미접속이면 접속부터 — 읽기 툴은 소켓 불필요(REST만).

### 에러 매핑 (errors.ts, R6)
- REST `ErrorResponse.error.code`(VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|UNPROCESSABLE|INTERNAL)와 ack error를 `"[코드] 메시지 (대상 id)"` 형태의 isError 텍스트로. FORBIDDEN엔 "봇 계정이 이 프로젝트의 EDITOR인지 확인" 힌트 첨부(R6.1). fetch 실패는 NETWORK로 구분(R6.3). 툴 핸들러 전체 try/catch — 프로세스 불사(R6.4).

## 4. 데이터 모델
- DB·shared·openapi 변경 없음. 신규 타입은 mcp 로컬 `AckResponse`뿐.
- 패키지: `apps/mcp/package.json` — name `@markflow/mcp`, `"@markflow/shared":"workspace:*"`, deps `@modelcontextprotocol/sdk`·`socket.io-client`·`zod`, scripts `typecheck/build/test` → **루트 `./scripts/check`·`./scripts/test`(-r)에 자동 포함**. tsconfig는 `tsconfig.base.json` 상속 + module NodeNext(단독 실행 Node CLI — 데코레이터 불필요, api보다 단순).
- 실행: `node apps/mcp/dist/index.js` (Claude Code 등록: `claude mcp add markflow --env ... -- node <절대경로>`), 개발은 `tsx src/index.ts`. README에 봇 계정 셋업(1회 가입·EDITOR 초대)과 함께 문서화.

## 5. 에러 처리 (요구사항 IF/THEN 대응)
- **env 누락(R1.3)**: 기동 시 검증, 누락 변수명을 stderr + 툴 호출 시 isError로.
- **401(R2.2)**: refresh(쿠키) → 재시도 1회 → 실패 시 login → 그래도 실패면 인증 에러 반환(R2.3).
- **재로그인 연쇄(제약 2)**: login 후 소켓 강제 disconnect 수신 → joined 초기화 → 다음 편집에서 재접속(R5.3).
- **락 충돌(R5.4)**: 서버가 락 노드 수정을 거부하면 ack `{ok:false}` — 그대로 매핑해 에이전트에게 전달. (탐색 결과 서버 service가 변경 이벤트마다 권한·상태 재검사.)
- **ack 무응답**: 5초 타임아웃 → "서버 응답 없음(소켓)" 에러.

## 6. 테스트 전략
- **단위 (vitest, node env — shared·web 구성 준용)**: ① AuthManager — Set-Cookie 파싱, 401→refresh→재시도, refresh 실패→login 폴백, 크리덴셜 미출력 (fetch mock) ② 툴 입력 검증 — 잘못된 uuid·type·position 거부 메시지 ③ 에러 매핑 — ErrorResponse/ack/network 구분 ④ emitWithAck 타임아웃 (socket mock).
- **통합/수동(QA)**: 로컬 BE(또는 Railway) + 봇 계정으로 Claude Code에 실등록 → 성공 기준 시나리오(목록→읽기→노드+엣지 생성) + 브라우저 실시간 확인 + VIEWER 프로젝트 거부 + 봇 presence 표시.
- **회귀**: `./scripts/check`(mcp typecheck/build 자동 포함) + 기존 전체 테스트.

## 7. 결정 기록
- ADR-0003: 에이전트 접속 아키텍처 — 봇 계정 + FE 동일 경로(소켓 하이브리드) 어댑터 (`.claude/specs/adr/0003-agent-mcp-adapter.md`)
