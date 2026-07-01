// CollabAPI 구현체 선택 훅 — 정본 자리(Docs/07-Frontend-Architecture.md §4).
// 정본 = Socket.io 직접 구현(useSocketCollab). Liveblocks는 차선이며 직접 사용 금지 —
// 막힐 경우 여기 분기만 바꾸면 교체되도록 CollabAPI 인터페이스 뒤에 둔다.
import { useSocketCollab } from "./useSocketCollab";
import type { CollabAPI } from "./CollabAPI";

export function useCollaboration(projectId: string): CollabAPI {
  return useSocketCollab(projectId);
}
