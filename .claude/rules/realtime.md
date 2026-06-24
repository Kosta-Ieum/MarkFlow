---
paths:
  - "apps/api/src/realtime/**"
  - "apps/web/src/collab/**"
---

# Realtime invariants (Socket.io)

상세 → `Docs/09-API-Spec.md §7`

- **정본 = Socket.io 직접 구현**. Liveblocks는 CollabAPI 뒤 차선 — 직접 사용 금지.
- **연결 1개 · 룸 1개**: `room = project:<id>` (`roomOf`). 네임스페이스 분리 금지.
- **채팅·캔버스 분리 금지** — 같은 룸에서 이벤트 이름으로 구분.
- 이벤트명은 `@markflow/shared`의 `SOCKET_EVENTS` 사용.
- 핸드셰이크에서 JWT 검증 + **변경 이벤트마다** 권한 재검사(`assertPermission`).
- 영속화는 service를 통해서만(소켓 핸들러가 DB 직접 쓰지 않음). 커서·락은 in-memory(프레즌스).
- 잔버그 3종 우선: ① 초기 싱크(`sync:init`) ② 재접속(`sync:resync`) ③ 이벤트 순서.
