# M3 실시간(Socket.io) 구현 전략

> 상태: **설계 확정** — 8개 결정 항목 + cross-cutting 정리 완료. 구현 착수 가능.
> 담당: 임민규(BE 단독). 구현은 코드 에이전트에 위임.
> 스택: NestJS + Socket.io + Prisma + PostgreSQL / monorepo(apps/api·apps/web·packages/shared).
> 계약 정본: `packages/shared/src/socket.ts`(SOCKET_EVENTS + zod) · `.claude/rules/realtime.md` · `Docs/09-API-Spec.md §7`.

---

## 0. 소켓 입문 — 무섭지 않은 이유 (다시 봐도 감 잡히게)

**REST vs Socket 큰 그림**
- **상태**: REST는 stateless(요청끼리 남남). Socket은 stateful — 연결 하나가 살아있는 객체, 서버 메모리에 "이 소켓=누구/어느 방" 컨텍스트가 붙는다. 재접속·프레즌스·락이 여기서 파생.
- **방향**: REST는 클라만 요청(pull). Socket은 서버가 먼저 push 가능 → 실시간의 본질.
- **재사용**: Socket은 "전송 계층"만 추가. 저장·권한 로직은 이미 있는 REST/service를 그대로 씀.

**클라 경험 → 서버로 뒤집기**: 예전에 업비트 웹소켓을 "받아 쓰는 클라이언트"였다면, 이번엔 "업비트 쪽(서버)"을 만드는 것. 반대편에 서는 것뿐, 새로운 우주가 아니다.

**라이브러리가 대신 해주는 것**: heartbeat(핑퐁), 재연결, 프레임 파싱, WebSocket↔polling 전환 — Socket.io가 처리. 내가 짜는 건 `on`(받기)·`emit`(보내기)·`join`(방 넣기) 세 동사로 "무슨 일을 할지"뿐.

**소켓 하나의 일생 (서버 관점)**
1. **Handshake** — 클라가 `auth.token`(JWT) 들고 노크 → 미들웨어가 검증 → `socket.data.userId` 저장. (= "보안" 1층, REST의 JwtAuthGuard 대응)
2. **Connected** — `socket.join('project:<id>')` → 룸에 접속 알림 broadcast.
3. **이벤트 loop** — `on('node:update')` → 권한 검사 → 룸에 broadcast.
4. **Disconnect** — 탭 닫기/끊김 자동 감지 → 잡은 락 해제 · 프레즌스에서 제거.

**보안 = 새 개념 0개**: 연결 때 JWT 신원 1회(반복 안 함) + 쓰기 이벤트마다 역할(EDITOR?) 확인. 둘 다 REST 자산 재사용.
**유지 = 라이브러리 몫**: 선은 Socket.io가 살려둠. 나는 "누가 어느 방에" 상태만 메모리에 관리.

**시작점(첫 조각)**: 연결 + 인증 + 룸 조인 + "접속했다" broadcast까지만 먼저. 두 브라우저로 눈에 보이면 나머지를 얹는다.

---

## 핵심 결정: 저장 모델 (전체를 관통)

**소켓 = 순수 broadcast(알림). 저장 = 전부 REST가 담당.** (`.claude/rules/realtime.md`: "영속화는 service를 통해서만, 소켓 핸들러가 DB 직접 쓰지 않음")

| 데이터 | 저장 경로(REST) | 소켓 역할 |
|---|---|---|
| 노드 위치(드래그) | `PUT /projects/:id/canvas` 일괄(2초 debounce, position 포함) | `node:update` broadcast |
| 노드 내용(title/markdown) | `PATCH`(2초 debounce) | `node:update` broadcast |
| 노드/엣지 생성·삭제 | REST | `node:add`/`delete`, `edge:add`/`delete` broadcast |
| 채팅 | REST 저장 | `chat:message`→`chat:new` broadcast |
| **커서·락·프레즌스** | **저장 안 함** | 소켓 전용 + 서버 in-memory |

→ 소켓 게이트웨이는 **"권한 검사 + zod 검증 + 룸 중계"** 하는 얇은 층. DB 쓰기 로직 없음(스냅샷 조회 제외). "전송 ≠ 로직" 원칙과 일치.

**순서/일관성**: payload가 **절대값**(최종 position 등, 델타 아님)이라 순서 꼬임·중복·재접속에도 다음 이벤트가 덮어써 자동 수렴.

---

## 1. 소켓 서버 기본 구조 ✅ — BE-3.1(IEUM-31)

| 항목 | 결정 | 근거 |
|---|---|---|
| 배치 | REST와 **같은 앱**(single process) | service·Prisma·권한 재사용. 규모 적합. 나중에 Redis로 확장 |
| 채널 | **기본 namespace(`/`)** + 이벤트 이름 구분 | 규칙: 네임스페이스 분리 금지 |
| Room | **`project:<id>`** (`roomOf`) | 프로젝트=캔버스 1:1, 룸 단위 broadcast 격리 |

Gateway = REST Controller의 소켓판. 얇게 유지, 로직은 service.

## 2. 소켓 인증 ✅ — BE-3.1(IEUM-31)

- 토큰: JWT를 **handshake `auth.token`**으로 전달(쿼리스트링 금지).
- **2층 구조**: ① 연결 시 1회 신원 인증(handshake 미들웨어 → `socket.data.userId`), ② **변경 이벤트마다** `assertPermission(projectId, userId, 'EDITOR')` 재사용(규칙 명시).
- EDITOR·OWNER는 소켓에서 구분 안 함. OWNER 전용 관리 행위는 소켓 아님(REST Guard 담당).
- VIEWER: 연결·룸 조인·수신 전부 허용, **쓰기 이벤트만 서버 거부**. 프론트 UI 비활성화는 UX용.
- ⚠️ 열린 항목: 쓰기 거부 통지(조용히 무시 vs 에러 회신) — 프론트 협의 후 확정. 서버 변경 비용 낮음.

## 3. 초기 동기화 ✅ — BE-3.1(IEUM-31)

- 흐름: `sync:join`(클라) → 서버가 `sync:init`로 **전체 캔버스 스냅샷**(project+role+nodes+edges = `CanvasSnapshot`) push → 이후 실시간 이벤트 수신.
- "스냅샷 사이 변경 놓침" 문제 → payload 절대값이라 다음 이벤트가 덮어써 자동 해결.
- 스냅샷 범위: MVP는 **전체 한 번**(나중에 커지면 페이징).

## 4. 노드/엣지 실시간 동기화 ✅ — BE-3.2(IEUM-32)

- **새 계약 없음.** `packages/shared/src/socket.ts` 정본 그대로 서버 구현.
- emit 빈도(프론트 확인 완료): 드래그는 **놓을 때 1회**(`dragging===false` 필터), 내용은 **2초 debounce**. → 서버는 받은 `node:update`마다 그냥 중계, **저장 throttle 불필요**.
- 서버 처리: 각 `node:*`/`edge:*` 수신 → 권한 검사 + zod 검증 → 룸 broadcast. (저장은 REST가 이미 함)

## 5. 소프트 락 ✅ — BE-3.2(IEUM-32)

- 저장: DB X, **서버 in-memory** — 프로젝트별 `{nodeId→userId}` + **소켓별 `잡은 nodeId 목록`(역색인, disconnect 정리용)**.
- 계약(프론트 제공): `lock:acquire`/`lock:release`(클라→서버), `lock:update`(서버→전체, userId 없으면 해제).
- 권한: `lock:acquire` 시 `assertPermission(…, EDITOR)`.
- 동시 요청: Node 단일스레드라 **먼저 온 사람이 획득**, 별도 mutex 불필요.
- 거부 통지: **조용히 무시**(진 사람은 `lock:update` broadcast로 인지).
- 정리: disconnect 시 그 유저 락 전부 자동 해제.
- 타임아웃: **연결 단위 유휴 타임아웃(1~2h)** — 모든 이벤트로 타이머 리셋, 초과 시 disconnect → 정리 로직이 락 해제.
- 재접속: `sync:resync`로 현재 락 상태 재전송.

## 6. 커서 / 프레즌스 ✅ — BE-3.2(IEUM-32)

- **소켓 broadcast만, DB 저장 X, 서버 in-memory.** 새로고침 시 사라져도 됨(휘발성).
- 이벤트: `cursor:move`, `presence:update`.
- throttle: 커서 **~50ms 1회**(프론트 설계, 현재 스텁 — 구현 시 반영).
- 뷰어 커서도 권한 무관하게 broadcast(누가 어디 보나 표시).

## 7. 재접속 / 복구 ✅ — BE-3.3(IEUM-33)

- **놓친 이벤트 재생 안 함.** 재접속하면 `sync:resync`로 **스냅샷 통째로 다시 받기**(= 초기 동기화와 동일 코드 재사용). DB 현재 진실을 다시 깔면 100% 정합.
- 채팅 히스토리: 재접속 시 최근 N개 재로드(REST, 커서 페이지네이션).
- 규칙의 "잔버그 3종"(초기싱크·재접속·이벤트순서) 우선 안정화 대상.

## 8. 확장성 (Redis adapter) ✅ — 나중(지금 구현 X)

- 서버 1대 동안 in-memory로 충분. 서버 다중화 시 **socket.io-redis-adapter + 락·프레즌스 상태 Redis 이관** 필요(refresh token Redis 이관과 함께).
- 지금은 "이관 지점"만 표시. MVP 구현 대상 아님.

---

## Cross-cutting 고려사항

1. **고빈도 이벤트 vs 저장**: 저장은 REST(debounce)가 담당하므로 소켓 부하 문제 해소됨. 커서만 throttle 필요.
2. **payload 검증**: 소켓 수신도 `packages/shared` zod로 검증(REST와 동일).
3. **ack(응답 콜백)**: 필요 시 `emit(event, data, cb)`로 성공/실패 회신. 쓰기 거부 통지(2번 열린 항목)와 연동 — 현재는 broadcast 기반 무시로 시작.
4. **disconnect 정리**: 락 해제 + 프레즌스 제거. 유휴 타임아웃도 이 경로 재사용.
5. **JWT 만료 vs 장수 연결**: 연결 중 토큰 만료 정책 필요(재인증). refresh token Redis 이관과 연결.
6. **rate limiting**: 커서 등 고빈도 이벤트 서버측 방어(클라 throttle이 1차).

---

## 이슈 배분

- **BE-3.1 (IEUM-31)** 소켓 서버 + 인증 + 룸/초기싱크 → **1·2·3번** + 시작점(연결·인증·룸·접속 broadcast)
- **BE-3.2 (IEUM-32)** 노드/엣지 동기화 + 소프트 락 + 커서 → **4·5·6번**
- **BE-3.3 (IEUM-33)** 채팅 + 재접속 복구 → **7번**
- **Redis(8번)**: 전 범위 영향, 도입 시점 별도(나중)

## 구현 착수 순서(권장)

1. 게이트웨이 + handshake 인증 + `project:<id>` 조인 + 접속 broadcast (눈으로 확인)
2. `sync:join`→`sync:init` 스냅샷
3. `node:*`/`edge:*`/`chat:*` 중계 (권한+zod 검증)
4. 소프트 락(in-memory) + disconnect 정리 + 유휴 타임아웃
5. 커서/프레즌스
6. `sync:resync` 재접속 안정화