# @markflow/mcp — AI 에이전트용 MarkFlow MCP 서버

AI 에이전트(Claude Code 등)가 MarkFlow 프로젝트를 읽고 캔버스를 편집하게 하는 로컬 stdio MCP 서버.
편집은 웹 클라이언트와 **동일한 협업 경로**(소켓 emit / 브로드캐스트되는 REST)를 타므로 다른 참가자
화면에 실시간 반영되고, 봇이 접속자 목록에도 표시된다. (spec: `.claude/specs/agent-mcp-server/`, ADR-0003)

## 1회 셋업 — 봇 계정

1. **가입**: MarkFlow 웹에서 봇 전용 계정을 가입한다. Gmail은 `+` 별칭을 지원하므로
   `myname+markflowbot@gmail.com`처럼 가입하면 인증 코드가 본인 받은편지함으로 온다.
   (이메일 인증은 가입 시 1회뿐 — 이후 서버는 로그인만 반복한다.)
2. **초대**: 편집할 프로젝트에 봇 계정을 **EDITOR** 멤버로 초대한다. (VIEWER면 읽기만 가능 —
   편집 툴은 서버가 FORBIDDEN으로 거부한다.)

## 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `MARKFLOW_API_BASE` | ✅ | API 서버 주소 — 경로에 `/api` prefix **없음** (예: `http://localhost:4000`, `https://api-production-xxxx.up.railway.app`) |
| `MARKFLOW_WS_URL` | — | 소켓 주소. 생략 시 `MARKFLOW_API_BASE`와 동일 |
| `MARKFLOW_BOT_EMAIL` | ✅ | 봇 계정 이메일 |
| `MARKFLOW_BOT_PASSWORD` | ✅ | 봇 계정 비밀번호 |

## Claude Code 등록

```bash
pnpm --filter @markflow/mcp build   # dist 생성 (모노레포 루트에서)

claude mcp add markflow \
  --env MARKFLOW_API_BASE=https://api-production-xxxx.up.railway.app \
  --env MARKFLOW_BOT_EMAIL=myname+markflowbot@gmail.com \
  --env MARKFLOW_BOT_PASSWORD=**** \
  -- node /절대경로/MarkFlow/apps/mcp/dist/index.js
```

개발 중에는 빌드 없이: `-- pnpm --filter @markflow/mcp dev` 대신 `-- npx tsx /절대경로/apps/mcp/src/index.ts`.

## 제공 툴 (10)

| 툴 | 용도 |
|---|---|
| `list_projects` | 봇이 멤버인 프로젝트 목록 (id·이름·role·nodeCount) |
| `get_canvas` | 캔버스 스냅샷 — 노드·엣지 전체 + 봇 role. 편집 전 현재 상태 파악용 |
| `get_history` | 활동 히스토리 (limit·before 페이지네이션) |
| `get_trash` | 휴지통 목록 (복원 대상 탐색) |
| `create_node` | 노드 생성 — position 생략 시 겹치지 않는 자리 자동 배치 |
| `update_node` | 노드 부분 수정 (title·markdown·type·position·collapsed) |
| `delete_node` / `restore_node` | 휴지통 이동 / 복원 |
| `connect_edge` | 엣지 연결 — **서버 확정 id를 반환**(입력 id 아님) |
| `disconnect_edge` | 엣지 해제 |

## 제약 (알아둘 것)

- **동시 인스턴스 1개**: BE 단일 세션 정책상 같은 봇 계정으로 서버를 두 개 띄우면 서로 로그인을
  뺏는다(재로그인 경합). MCP 클라이언트 하나에만 등록할 것. 인스턴스가 더 필요하면 봇 계정을 추가.
- 사람 계정을 넣지 말 것 — 브라우저 사용 중 서버가 로그인하면 브라우저 세션이 강제 로그아웃된다.
- 토큰 만료·강제 재동기화는 서버가 스스로 복구한다(refresh → 재로그인 → 소켓 재접속 연쇄).
- 채팅·멤버 관리·프로젝트 생성은 범위 밖(spec Non-goals).
