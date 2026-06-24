# MarkFlow API 명세서 (API Specification)

| 항목 | 내용 |
| --- | --- |
| 문서 유형 | API 명세서 — REST + Realtime(Socket.io) |
| 프로젝트 | MarkFlow — 마크다운 노드 기반 실시간 협업 캔버스 |
| 버전 / 상태 | v1.1 / Draft (화면 이미지 재검증 반영) |
| Base URL | `/api` (예: `https://api.markflow.app/api`) |
| 작성일 | 2026-06-24 |

> 본 명세는 ERD(`08-ERD.md`)와 PRD v1.2 / 화면설계서 v1.0을 정본으로 한다. 인증은 JWT 자체 구현, 권한 가드는 **REST + 실시간 인증 양쪽 서버에서** 수행한다(PRD §6).

---

## 0. 공통 규약

### 0.1 형식
- 요청·응답 본문: `application/json` (UTF-8).
- 시각: ISO 8601 UTC 문자열 (`2026-06-23T08:30:00.000Z`).
- ID: UUID v4 문자열.
- 인증: `Authorization: Bearer <accessToken>` 헤더.

### 0.2 인증 토큰
- 로그인/회원가입 성공 시 `accessToken`(JWT) 발급. payload: `{ sub: userId, email, iat, exp }`.
- 만료(기본 1h) 또는 무효 시 `401` → 프론트는 로그인 화면으로 리다이렉트(PRD §4.2).
- (선택) `refreshToken` 회전은 `POST /auth/refresh`로 구현 가능.

### 0.3 표준 에러 응답

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "이 작업을 수행할 권한이 없습니다.",
    "details": null
  }
}
```

| HTTP | code | 의미 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 입력 검증 실패(필수 누락, 이메일 형식 등) |
| 401 | `UNAUTHORIZED` | 토큰 없음/만료/무효 |
| 403 | `FORBIDDEN` | 권한 부족(뷰어가 변경 시도 등) |
| 404 | `NOT_FOUND` | 리소스 없음 또는 접근 불가 |
| 409 | `CONFLICT` | 중복(이메일 가입, 중복 엣지 등) |
| 422 | `UNPROCESSABLE` | 비즈니스 규칙 위반(자기 연결 등) |
| 500 | `INTERNAL` | 서버 오류 |

### 0.4 권한 가드 매트릭스 (PRD §6)

| 동작 | VIEWER | EDITOR | OWNER |
| --- | --- | --- | --- |
| 프로젝트·노드·채팅 조회 | O | O | O |
| 노드 생성·수정·이동·삭제·복원·영구삭제 | ✗ | O | O |
| 채팅 메시지 작성 | ✗ | O | O |
| 프로젝트 이름 변경·삭제·복구·영구삭제 | ✗ | ✗ | O |
| 멤버 초대·권한 변경·제거 | ✗ | ✗ | O |

> 모든 변경 엔드포인트는 `ProjectMember.role`을 서버에서 확인한다. 프론트 비활성화는 UX용일 뿐 진짜 가드가 아니다.

### 0.5 페이지네이션
- 커서 기반: `?limit=50&before=<ISO8601 or id>`.
- 응답에 `nextCursor`(없으면 `null`) 포함.

---

## 1. 인증 (Auth) — P0

### 1.1 회원가입
`POST /auth/signup`

요청
```json
{ "name": "임민규", "email": "user@markflow.app", "password": "secret123" }
```
- 검증: 모든 필드 필수, 이메일 정규식 `.+@.+\..+`, password 최소 8자.

응답 `201`
```json
{
  "accessToken": "eyJhbGci...",
  "user": { "id": "uuid", "email": "user@markflow.app", "name": "임민규" }
}
```
- 에러: `409 CONFLICT`(이메일 중복), `400 VALIDATION_ERROR`.
- 비밀번호는 해시(bcrypt/argon2) 저장. 응답에 `passwordHash` 미포함.

### 1.2 로그인
`POST /auth/login`

요청 `{ "email": "...", "password": "..." }`

응답 `200` — 회원가입과 동일 구조. 성공 시 프론트는 프로젝트 리스트로 이동.
- 에러: `401 UNAUTHORIZED`(이메일/비밀번호 불일치).

### 1.3 내 정보
`GET /auth/me` — 헤더 토큰 기준 현재 사용자.

응답 `200` `{ "id": "uuid", "email": "...", "name": "..." }`

### 1.4 (선택) 토큰 갱신 / 로그아웃
- `POST /auth/refresh` → 새 `accessToken`.
- `POST /auth/logout` → refreshToken 폐기(미사용 시 클라이언트 토큰 폐기로 대체).

---

## 2. 프로젝트 (Projects) — P0

### 2.1 내 프로젝트 목록
`GET /projects`

응답 `200`
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "제품 로드맵",
      "role": "OWNER",
      "isOwner": true,
      "nodeCount": 5,
      "updatedAt": "2026-06-23T08:00:00.000Z"
    }
  ]
}
```
- 내가 소유(owner)하거나 멤버로 참여한, `deletedAt IS NULL`인 프로젝트만.
- `role`은 호출자의 `ProjectMember.role`. 비소유자는 화면에서 "공유됨" 메타로 표기(화면설계서 §4.3).
- `nodeCount`는 활성 노드 수.

### 2.2 프로젝트 생성
`POST /projects`

요청 `{ "name": "새 프로젝트" }`

응답 `201`
```json
{ "id": "uuid", "name": "새 프로젝트", "role": "OWNER", "nodeCount": 0, "updatedAt": "..." }
```
- 트랜잭션: Project + ProjectMember(role=OWNER, userId=호출자) 동시 생성. 프로젝트=캔버스 1:1이므로 별도 캔버스 생성 호출 없음(PRD §4.3).

### 2.3 프로젝트 이름 변경 — OWNER only
`PATCH /projects/:projectId`

요청 `{ "name": "변경된 이름" }`

응답 `200` `{ "id": "uuid", "name": "변경된 이름", "updatedAt": "..." }`
- 권한: OWNER 외 `403`. (에디터·뷰어의 rename 입력은 서버에서 무시·거부)
- 활동 로그 `ActivityLog(targetType=PROJECT, action=RENAME)` 기록 → 히스토리 탭 "프로젝트 제목 변경됨"(화면 `06-canvas-expanded`).

### 2.4 프로젝트 삭제(휴지통) — OWNER only
`DELETE /projects/:projectId`

응답 `200` `{ "id": "uuid", "deletedAt": "..." }`
- 소프트 삭제(`deletedAt` 설정). 물리 삭제 아님(PRD 결정 #7). 활동 로그 `(targetType=PROJECT, action=DELETE)` 기록.

### 2.5 프로젝트 복구 — OWNER only
`POST /projects/:projectId/restore`

응답 `200` `{ "id": "uuid", "deletedAt": null }`
- 활동 로그 `(targetType=PROJECT, action=RESTORE)` 기록.

### 2.6 삭제된 프로젝트 목록 (휴지통 페이지) — 인증
`GET /projects/trash`

응답 `200`
```json
{ "projects": [ { "id": "uuid", "name": "블로그 초안", "deletedAt": "...", "isOwner": true } ] }
```
- 내가 소유한, `deletedAt IS NOT NULL`인 프로젝트 목록. 화면 `04-project-list`의 "삭제된 프로젝트는 휴지통 페이지에서 복구" 안내 반영.
- 복구/영구삭제는 소유자만 가능하므로 본인 소유 항목만 반환.
- ⚠️ 라우팅: 이 경로는 `:projectId` 파라미터 라우트(`/projects/:id/...`)보다 **먼저 등록**해야 `trash`가 id로 오인되지 않는다.

### 2.7 프로젝트 영구 삭제(휴지통 비우기) — OWNER only
`DELETE /projects/:projectId/permanent`

- 소프트 삭제된(`deletedAt IS NOT NULL`) 프로젝트를 물리 삭제. 하위 **Node·Edge·ChatMessage·ActivityLog가 CASCADE로 함께 제거**된다.
- 응답 `200` `{ "id": "uuid", "purged": true }`.
- 활성 프로젝트(미삭제)에는 `422`(먼저 휴지통으로 이동해야 함). 비복구 동작이므로 클라이언트는 확인 모달 권장.

---

## 3. 캔버스 / 노드 / 엣지 (Canvas) — P0

> 프로젝트 = 캔버스이므로 모든 경로는 `/projects/:projectId` 하위. 조회는 모든 멤버, 변경은 EDITOR·OWNER만.

### 3.1 캔버스 스냅샷 조회 (초기 로드)
`GET /projects/:projectId/canvas`

응답 `200`
```json
{
  "project": { "id": "uuid", "name": "제품 로드맵", "role": "EDITOR" },
  "nodes": [
    {
      "id": "uuid",
      "type": "idea",
      "title": "킥오프",
      "markdown": "# 킥오프\n- 목표 정리",
      "collapsed": true,
      "position": { "x": 120, "y": 80 },
      "updatedAt": "..."
    }
  ],
  "edges": [
    { "id": "uuid", "source": "nodeA", "target": "nodeB" }
  ]
}
```
- `deletedAt IS NULL`인 노드/엣지만 반환. React Flow `{ nodes, edges }`로 바로 매핑(ERD §6).

### 3.2 노드 생성 — EDITOR·OWNER
`POST /projects/:projectId/nodes`

요청
```json
{ "title": "새 노드", "markdown": "", "type": "idea", "position": { "x": 200, "y": 160 } }
```
응답 `201` — 생성된 노드 객체. 서버는 `ActivityLog(targetType=NODE, action=CREATE)` 기록.

### 3.3 노드 수정 — EDITOR·OWNER
`PATCH /projects/:projectId/nodes/:nodeId`

요청(부분 갱신 허용)
```json
{ "title": "수정", "markdown": "...", "type": "doc", "collapsed": false, "position": { "x": 240, "y": 180 } }
```
- 응답 `200` — 갱신된 노드.
- 활동 로그: 위치만 변경 시 `MOVE`, 그 외 내용 변경 시 `UPDATE` 기록(서버 판단, `targetType=NODE`).
- 동시성: 노드 단위 last-write-wins(PRD §7). 소프트 락은 실시간(§7) 프레즌스로 처리.

### 3.4 노드 삭제(휴지통) — EDITOR·OWNER
`DELETE /projects/:projectId/nodes/:nodeId`

응답 `200` `{ "id": "uuid", "deletedAt": "..." }`
- 소프트 삭제. **연결된 엣지는 물리 삭제**(화면설계서 §4.4.5). 활동 로그 `DELETE` 기록.

### 3.5 노드 복구 — EDITOR·OWNER
`POST /projects/:projectId/nodes/:nodeId/restore`

응답 `200` `{ "id": "uuid", "deletedAt": null }`
- 활동 로그 `RESTORE` 기록. 엣지는 복원하지 않음(범위 밖).

### 3.5b 노드 영구 삭제(휴지통 비우기) — EDITOR·OWNER
`DELETE /projects/:projectId/nodes/:nodeId/permanent`

- 소프트 삭제된(`deletedAt IS NOT NULL`) 노드를 물리 삭제. 화면 `05-canvas-collapsed` 캔버스 휴지통에서 영구 제거.
- 응답 `200` `{ "id": "uuid", "purged": true }`. 활동 로그는 불변이므로 보존(`targetId`는 댕글링으로 유지, 조회 시 폴백 라벨 — ERD §2.7).
- 활성 노드(미삭제)에는 `422`(먼저 휴지통으로 이동해야 함).

### 3.6 엣지 생성 — EDITOR·OWNER
`POST /projects/:projectId/edges`

요청 `{ "source": "nodeA", "target": "nodeB" }`

응답 `201` `{ "id": "uuid", "source": "nodeA", "target": "nodeB" }`
- 검증: `source != target`(`422`), 중복 `(source,target)` 금지(`409`), 두 노드 모두 같은 프로젝트의 활성 노드.
- 활동 로그 `ActivityLog(targetType=EDGE, action=CONNECT)` 기록 → 히스토리 탭 "…노드 연결됨"(화면 `06-canvas-expanded`).

### 3.7 엣지 삭제 — EDITOR·OWNER
`DELETE /projects/:projectId/edges/:edgeId`

응답 `200` `{ "id": "uuid" }` (물리 삭제)
- 활동 로그 `ActivityLog(targetType=EDGE, action=DISCONNECT)` 기록.

### 3.8 (선택) 캔버스 일괄 저장 — EDITOR·OWNER
`PUT /projects/:projectId/canvas`

> debounce 자동 저장(약 2초) + 수동 저장 버튼용(PRD §4.4.1). 클라이언트가 모은 변경을 한 번에 영속화.

요청
```json
{
  "nodes": [{ "id": "uuid", "title": "...", "markdown": "...", "type": "idea", "collapsed": true, "position": { "x": 0, "y": 0 } }],
  "edges": [{ "id": "uuid", "source": "a", "target": "b" }]
}
```
- 서버는 diff하여 upsert/삭제 후 활동 로그 기록. 응답 `200` `{ "savedAt": "..." }`.

### 3.9 휴지통 목록
`GET /projects/:projectId/trash`

응답 `200`
```json
{ "nodes": [ { "id": "uuid", "title": "노드 스키마", "type": "data", "deletedAt": "..." } ] }
```
- `deletedAt IS NOT NULL`인 노드 목록(아코디언 표시, 화면설계서 §4.4.5).

---

## 4. 채팅 (Chat) — P1

> 프로젝트(=캔버스) 단위. 모든 멤버 조회, 작성은 EDITOR·OWNER. 실시간 broadcast는 §7 참조(저장은 REST/서버에서).

### 4.1 메시지 목록
`GET /projects/:projectId/messages?limit=50&before=<cursor>`

응답 `200`
```json
{
  "messages": [
    {
      "id": "uuid",
      "content": "안녕하세요",
      "createdAt": "...",
      "user": { "id": "uuid", "name": "임민규" }
    }
  ],
  "nextCursor": null
}
```
- 시간순(최신순 페이지네이션). 재접속 시에도 보임(PRD §4.4.3).

### 4.2 메시지 작성 — EDITOR·OWNER
`POST /projects/:projectId/messages`

요청 `{ "content": "메시지 내용" }`

응답 `201` — 생성된 메시지 객체(§4.1 단건).
- 뷰어는 `403`. 작성 후 같은 룸에 실시간 broadcast(§7).

---

## 5. 활동 로그 / 히스토리 (변경 로그) — P1

> 화면 `06-canvas-expanded` 히스토리 탭은 노드 이벤트뿐 아니라 **엣지 연결·프로젝트 제목 변경**을 한 타임라인으로 보여준다. 따라서 `ActivityLog`(폴리모픽: NODE/EDGE/PROJECT) 기준으로 응답한다. PRD의 "노드 히스토리"는 `targetType=NODE` 필터 뷰(§5.1).

### 5.1 노드별 히스토리
`GET /projects/:projectId/nodes/:nodeId/history`

응답 `200` — `ActivityLog`에서 `targetType=NODE AND targetId=:nodeId` 필터.
```json
{
  "history": [
    {
      "id": "uuid",
      "targetType": "NODE",
      "targetId": "node-uuid",
      "action": "UPDATE",
      "createdAt": "...",
      "user": { "id": "uuid", "name": "임민규" }
    }
  ]
}
```

### 5.2 프로젝트 전체 타임라인 (우측 패널 히스토리 탭)
`GET /projects/:projectId/history?limit=50&before=<cursor>`

응답 `200` — 프로젝트의 모든 활동 로그, 시간 역순.
```json
{
  "history": [
    { "id": "uuid", "targetType": "PROJECT", "targetId": "proj-uuid", "targetLabel": "제품 로드맵", "action": "RENAME", "createdAt": "...", "user": { "id": "uuid", "name": "임민규" } },
    { "id": "uuid", "targetType": "EDGE", "targetId": "edge-uuid", "targetLabel": "킥오프 → React Flow 채택", "action": "CONNECT", "createdAt": "...", "user": { "id": "uuid", "name": "임민규" } },
    { "id": "uuid", "targetType": "NODE", "targetId": "node-uuid", "targetLabel": "노드 스키마", "action": "CREATE", "createdAt": "...", "user": { "id": "uuid", "name": "임민규" } }
  ],
  "nextCursor": null
}
```
- `targetLabel`은 표시용 텍스트(노드 제목, 엣지 양끝 제목, 프로젝트명)를 서버가 read 시점 조인으로 조립한다. 대상이 영구 삭제돼 조인이 비면 폴백 라벨("(삭제된 항목)")을 내려준다(ERD §2.7).
- 내용 복원·diff 없음(PRD 결정 #3). action: `CREATE|UPDATE|MOVE|DELETE|RESTORE|CONNECT|DISCONNECT|RENAME`.

---

## 6. 멤버 / 권한 (Members) — OWNER only

### 6.1 멤버 목록
`GET /projects/:projectId/members`

응답 `200`
```json
{
  "members": [
    { "userId": "uuid", "name": "임민규", "email": "...", "role": "OWNER" }
  ]
}
```
- 조회는 모든 멤버 가능.

### 6.2 멤버 초대 — OWNER only
`POST /projects/:projectId/members`

요청 `{ "email": "invitee@markflow.app", "role": "EDITOR" }`
- 응답 `201` — 추가된 멤버. role ∈ `EDITOR|VIEWER`(OWNER 지정 불가).
- 에러: `404`(미가입 이메일 — MVP는 기가입 유저만 초대), `409`(이미 멤버).

### 6.3 멤버 권한 변경 — OWNER only
`PATCH /projects/:projectId/members/:userId`

요청 `{ "role": "VIEWER" }`
- OWNER 역할로의 변경/양도는 별도 정책(범위 밖, `422`). OWNER 본인 강등 불가.

### 6.4 멤버 제거 — OWNER only
`DELETE /projects/:projectId/members/:userId`

응답 `200` `{ "userId": "uuid" }`. OWNER 자신은 제거 불가(`422`).

---

## 7. 실시간 협업 (Realtime) — Socket.io 직접 구현 (정본)

> 멀티커서·노드 동기화·소프트 락·프레즌스·채팅은 **Socket.io 직접 구현**한다(PRD §5 정본). Room = 캔버스 1개 = 프로젝트 1개. 채팅·캔버스는 분리하지 않고 같은 룸에서 이벤트 이름으로 구분(화면설계서 §3.3). 프론트는 `useCollaboration`(CollabAPI) 뒤에 두어 막힐 시 Liveblocks(차선)로 교체.

### 7.1 연결 & 인증 (핸드셰이크)

```ts
// 클라이언트
const socket = io(WS_URL, { auth: { token: accessToken } });
```
- 연결 시 `auth.token`(JWT)을 서버 미들웨어(`io.use`)에서 검증. 실패 → `connect_error`(`UNAUTHORIZED`)로 연결 거부.
- 검증 성공 시 `socket.data.user = { id, email }`.

### 7.2 룸 입장 (`sync:join`)
요청(C→S) `{ projectId }`
- 서버: `ProjectMember.role` 조회. 멤버 아니면 `ack({ ok:false, error:{ code:'FORBIDDEN' } })`.
- 성공 시 `socket.join('project:<projectId>')` + 현재 상태를 `sync:init`으로 응답.
- `socket.data.role` 캐시(이벤트별 가드에 사용).

응답(S→C) `sync:init`
```json
{
  "nodes": [ { "id": "uuid", "type": "idea", "title": "킥오프", "markdown": "...", "collapsed": true, "position": { "x": 120, "y": 80 } } ],
  "edges": [ { "id": "uuid", "source": "a", "target": "b" } ],
  "presence": [ { "userId": "uuid", "name": "임민규", "color": "#10A36B" } ]
}
```

### 7.3 이벤트 카탈로그

**클라이언트 → 서버 (송신)** — 변경 이벤트는 EDITOR+ 만 허용

| 이벤트 | payload | 처리 |
| --- | --- | --- |
| `cursor:move` | `{ x, y }` | 룸 broadcast(저장 ✗, ≈50ms throttle) |
| `node:add` | `{ ...node }` | `nodeService.create` → `node:added` broadcast |
| `node:update` | `{ id, ...patch }` | `nodeService.update`(MOVE/UPDATE 판별) → `node:updated` |
| `node:delete` | `{ id }` | `nodeService.softDelete`(엣지 동반 제거) → `node:deleted` |
| `edge:add` | `{ source, target }` | `edgeService.connect` → `edge:added` |
| `edge:delete` | `{ id }` | `edgeService.disconnect` → `edge:deleted` |
| `lock:acquire` | `{ nodeId }` | 점유 등록 → `lock:update` broadcast |
| `lock:release` | `{ nodeId }` | 점유 해제 → `lock:update` |
| `chat:message` | `{ content }` | `chatService.send`(저장) → `chat:new` broadcast |
| `chat:typing` | `{}` | `chat:typing` broadcast(저장 ✗) |

- 모든 송신 이벤트는 `ack(res)` 콜백으로 결과 반환: `{ ok:true, data }` 또는 `{ ok:false, error:{ code, message } }`.

**서버 → 클라이언트 (수신/broadcast)**

| 이벤트 | 의미 |
| --- | --- |
| `sync:init` / `sync:resync` | 초기 상태 / 재접속 재동기화 |
| `node:added/updated/deleted` | 타인의 노드 변경 |
| `edge:added/deleted` | 타인의 엣지 변경 |
| `cursor:move` | 타인 커서 좌표 |
| `lock:update` | 노드 점유 상태(`{ nodeId, userId, name }` 또는 해제) |
| `presence:update` | 접속자 목록 변경("N명 접속 중") |
| `chat:new` / `chat:typing` | 새 메시지 / 입력 중 표시 |

### 7.4 권한 가드
- 변경 이벤트(`node:* / edge:* / chat:message`)는 핸들러 진입부에서 `assertPermission(projectId, userId, 'EDITOR')`. 뷰어는 `ack({ ok:false, error:{ code:'FORBIDDEN' } })`로 거부 — **실시간 레이어에서도 서버가 최종 가드**(PRD §6).
- 권한 검사는 REST와 동일한 `shared/permission` 함수 사용(서비스 진입부 공통).

### 7.5 영속화 & 재접속
1. 클라이언트 변경 → 로컬 즉시 반영(낙관적) + `node:*` 송신.
2. 서버는 서비스로 **DB 반영 + ActivityLog 기록**(한 트랜잭션) 후 룸 broadcast.
3. 커서·락은 in-memory(프레즌스), DB 저장 안 함.
4. 끊김 시 Socket.io 자동 재연결 → 재입장 시 `sync:resync`로 상태 복구.

> DB는 영속 스냅샷·활동 로그·휴지통의 단일 소스. 잔버그 3종(① 초기싱크 ② 재접속 ③ 이벤트 순서)을 우선 안정화.
> **차선(Liveblocks)**: 막히면 동일 CollabAPI 뒤에 Liveblocks를 꽂는다(룸=`project:<id>` 동일, 권한 가드는 `liveblocks-auth` 엔드포인트로 이전). UI 코드는 불변.

---

## 8. 엔드포인트 요약

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| POST | `/auth/signup` | 공개 | 회원가입 |
| POST | `/auth/login` | 공개 | 로그인 |
| GET | `/auth/me` | 인증 | 내 정보 |
| GET | `/projects` | 인증 | 내 프로젝트 목록 |
| POST | `/projects` | 인증 | 프로젝트 생성 |
| PATCH | `/projects/:id` | OWNER | 이름 변경 |
| DELETE | `/projects/:id` | OWNER | 삭제(휴지통) |
| POST | `/projects/:id/restore` | OWNER | 프로젝트 복구 |
| GET | `/projects/trash` | 인증 | 삭제된 프로젝트 목록(휴지통 페이지) |
| DELETE | `/projects/:id/permanent` | OWNER | 프로젝트 영구 삭제 |
| GET | `/projects/:id/canvas` | 멤버 | 캔버스 스냅샷 |
| PUT | `/projects/:id/canvas` | EDITOR+ | 일괄 저장 |
| POST | `/projects/:id/nodes` | EDITOR+ | 노드 생성 |
| PATCH | `/projects/:id/nodes/:nid` | EDITOR+ | 노드 수정/이동 |
| DELETE | `/projects/:id/nodes/:nid` | EDITOR+ | 노드 삭제(휴지통) |
| POST | `/projects/:id/nodes/:nid/restore` | EDITOR+ | 노드 복구 |
| DELETE | `/projects/:id/nodes/:nid/permanent` | EDITOR+ | 노드 영구 삭제 |
| POST | `/projects/:id/edges` | EDITOR+ | 엣지 생성 |
| DELETE | `/projects/:id/edges/:eid` | EDITOR+ | 엣지 삭제 |
| GET | `/projects/:id/trash` | 멤버 | 휴지통 목록 |
| GET | `/projects/:id/messages` | 멤버 | 채팅 목록 |
| POST | `/projects/:id/messages` | EDITOR+ | 채팅 작성 |
| GET | `/projects/:id/nodes/:nid/history` | 멤버 | 노드 히스토리(activity, NODE 필터) |
| GET | `/projects/:id/history` | 멤버 | 프로젝트 활동 타임라인(NODE/EDGE/PROJECT) |
| GET | `/projects/:id/members` | 멤버 | 멤버 목록 |
| POST | `/projects/:id/members` | OWNER | 멤버 초대 |
| PATCH | `/projects/:id/members/:uid` | OWNER | 권한 변경 |
| DELETE | `/projects/:id/members/:uid` | OWNER | 멤버 제거 |
| WS | `connect` + `sync:join` | 인증 | Socket.io 연결(핸드셰이크 JWT) + 룸 입장 (§7) |

> `EDITOR+` = EDITOR 또는 OWNER. `멤버` = 해당 프로젝트의 OWNER/EDITOR/VIEWER 누구나.
> 실시간은 REST가 아닌 **Socket.io 이벤트**다(§7). 위 `WS` 행은 진입점만 표기.

---

## 관련 문서

- PRD — `02-PRD.md`
- 기획서 — `01-Proposal.md`
- 화면 설계서 — `04-Screen-Design.md`
- 데이터 모델(ERD) — `08-ERD.md`
