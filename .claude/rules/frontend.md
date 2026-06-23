---
paths:
  - "apps/web/**"
---

# Frontend invariants (apps/web)

상세 → `Docs/07-Frontend-Architecture.md`

- **단일 진실원**: nodes/edges/presence/messages는 Zustand store. 컴포넌트는 store 구독 + 액션 호출만. `fetch`/socket 직접 호출 금지.
- **전송 은닉**: 실시간은 `useCollaboration`(CollabAPI), REST는 `lib/api()`를 통해서만.
- **에코 루프 방지**: 원격 수신은 `applyRemote*`(emit 금지), 내 액션만 `applyLocal*` + emit. React Flow `onNodesChange`는 로컬 액션만 emit으로 연결.
- **낙관적 업데이트** + throttle(커서 ≈50ms) / debounce(저장 ≈2s).
- **권한 UI**는 비활성화(UX)만, 가드 아님 — 서버가 최종.
- 타입·이벤트명은 `@markflow/shared`에서 import(하드코딩 금지).
