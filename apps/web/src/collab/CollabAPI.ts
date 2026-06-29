// 실시간 추상화 인터페이스 (CollabAPI) — 정본: Docs/07-Frontend-Architecture.md §4 미러.
// 전송(Socket.io)을 이 인터페이스 뒤에 숨긴다. 컴포넌트는 store 구독 + 이 API 호출만.
// 수신은 구현체 내부에서 구독 → store 주입(컴포넌트는 store만 본다).
import type { XY } from "@markflow/shared";

import type { EdgeChange, NodeChange } from "./types";

export interface CollabAPI {
  connect(projectId: string): void;
  disconnect(): void;
  emitCursor(p: XY): void;
  emitLock(nodeId: string | null): void;
  sendChat(content: string): void;
  emitNode(c: NodeChange): void;
  emitEdge(c: EdgeChange): void;
}
