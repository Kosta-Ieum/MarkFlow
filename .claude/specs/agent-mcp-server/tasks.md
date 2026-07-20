---
feature: agent-mcp-server
status: approved
created: 2026-07-20
---

# AI 에이전트용 MCP 서버 — 태스크

> 체크박스가 실행 상태의 단일 진실 공급원. 전 태스크 `apps/mcp` 신설 국한(BE·apps/web·shared·openapi 무변경). 검증 = `./scripts/check`(신규 워크스페이스 자동 포함) + mcp vitest.
> **R7.1: 전 태스크 완료 후에도 사용자 승인 전까지 PR 생성 금지 — 브랜치 커밋까지만.**

- [x] **T1. 워크스페이스 스캐폴드 + env 검증**
  - 내용: `apps/mcp` 신설 — package.json(`@markflow/mcp`, deps: `@modelcontextprotocol/sdk`·`socket.io-client`·`zod`·`@markflow/shared workspace:*`, devDeps: vitest·tsx, scripts: typecheck/build/test/dev), tsconfig(base 상속 + NodeNext, 데코레이터 불필요), vitest.config. `src/index.ts` — env 4종(`MARKFLOW_API_BASE`·`MARKFLOW_WS_URL`(기본=API_BASE)·`MARKFLOW_BOT_EMAIL`·`MARKFLOW_BOT_PASSWORD`) zod 검증, 누락 시 변수명 명시 에러(R1.3), 빈 MCP Server + stdio transport 결합(부팅 확인용).
  - 요구사항: R1.1(골격), R1.2, R1.3
  - 완료 조건: `pnpm install` 후 `./scripts/check` 통과(mcp typecheck/build 포함 확인), `node dist/index.js`가 env 누락 에러를 올바르게 냄.

- [x] **T2. AuthManager + REST 클라이언트 + 에러 매핑 + 단위 테스트**
  - 내용: `auth.ts` — login(Set-Cookie에서 refresh_token 파싱·보관), ensureToken, onUnauthorized(refresh→실패 시 login 폴백→둘 다 실패면 에러, 동시 갱신 promise 합치기), 자격증명·토큰 로그 미출력(R2.4). `api.ts` — Bearer 부착 fetch 래퍼, 401 시 갱신 후 1회 재시도(R2.2), ErrorResponse 파싱. `errors.ts` — REST/ack/network 에러 → isError 텍스트(코드·대상 id·FORBIDDEN 힌트, R6.1~R6.3). 단위 테스트(fetch mock): 쿠키 파싱, 401→refresh→재시도, refresh 409→login 폴백, 인증 실패 시 무한 재시도 없음, 에러 매핑 3종.
  - 요구사항: R2.1~R2.4, R6.1~R6.3
  - 완료 조건: mcp vitest 통과 + `./scripts/check` 통과.

- [x] **T3. 읽기 툴 4개 + 툴 등록**
  - 내용: `server.ts`(Server 생성·툴 등록 골격) + `tools/read.ts` — `list_projects`·`get_canvas`·`get_history`(limit·before)·`get_trash`. 입력 zod(shared 재사용) 검증, 결과는 JSON 텍스트. 툴 핸들러 공통 try/catch(R6.4). 단위 테스트: 입력 검증 거부 메시지, 정상 경로(REST mock).
  - 요구사항: R1.1, R3.1~R3.4, R4.5(검증 골격), R6.4
  - 완료 조건: mcp vitest 통과 + `./scripts/check` 통과.

- [ ] **T4. SocketManager + 단위 테스트**
  - 내용: `collab.ts` — socket.io-client 접속(`auth:{token}`·websocket), 프로젝트별 `sync:join` 1회(joined set, ack로 성공 확인), `emitWithAck`(5s 타임아웃, `{ok:false}`→에러 매핑), disconnect 시 joined 초기화 + 다음 호출 lazy 재접속(R5.3), AuthManager 재로그인 통지 수신 시 새 토큰 재접속(설계 제약 2 연쇄). AckResponse 로컬 타입(출처 주석). 단위 테스트(socket mock): join 멱등, ack 타임아웃, ok:false 매핑, 재접속 시 joined 리셋.
  - 요구사항: R5.1(기반), R5.2, R5.3
  - 완료 조건: mcp vitest 통과 + `./scripts/check` 통과.

- [ ] **T5. 편집 툴 6개**
  - 내용: `tools/write.ts` — `create_node`(uuid 생성, 기본값: title "새 노드"·type idea·collapsed true, position 미지정 시 캔버스 조회 후 무겹침 그리드 슬롯 — FE findFreePosition 상수 동일 경량 사본)·`update_node`(부분 patch)·`connect_edge`(ack의 **서버 재발급 edge id** 반환)·`disconnect_edge`는 소켓 emit+ack, `delete_node`·`restore_node`는 REST(BE 브로드캐스트 경로). 락·권한 거부는 ack/REST 에러 그대로 전달(R5.4, R6.1). 단위 테스트: 입력 검증, 그리드 배치 계산, edge id가 ack 기준인 것.
  - 요구사항: R4.1~R4.5, R5.1, R5.4, R6.1, R6.2
  - 완료 조건: mcp vitest 통과 + `./scripts/check` 통과.

- [ ] **T6. README + 통합 검증 + 인수 조건 전수 점검**
  - 내용: `apps/mcp/README.md` — 봇 계정 1회 셋업(Gmail `+` 별칭 가입·EDITOR 초대), Claude Code 등록 명령(env 포함), 단일 세션 제약(동시 인스턴스 1개), 로컬/Railway 대상 전환. 통합 검증: 사용자와 함께 봇 계정 준비 후 실등록 → 성공 기준 시나리오(목록→캔버스 읽기→노드 여러 개+엣지 생성) + 브라우저 실시간 확인·presence·VIEWER 거부. requirements 인수 조건 전수 표 작성. **PR 생성 금지(R7.1) — 사용자 승인 대기.**
  - 요구사항: R1~R7 전부
  - 완료 조건: 인수 조건 표에서 코드 검증 가능 항목 미충족 0 + 실계정 E2E는 사용자 확인.
