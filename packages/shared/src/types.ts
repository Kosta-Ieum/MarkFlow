// MarkFlow 공용 타입 — 백엔드(REST·소켓) ↔ 프론트(CollabAPI·store) 계약
// 정본: Docs/08-ERD.md, Docs/09-API-Spec.md

export type Role = "OWNER" | "EDITOR" | "VIEWER";
export type NodeType = "idea" | "doc" | "task" | "decision" | "data";

export type ActivityTarget = "NODE" | "EDGE" | "PROJECT";
export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "MOVE"
  | "DELETE"
  | "RESTORE"
  | "CONNECT"
  | "DISCONNECT"
  | "RENAME";

export interface XY {
  x: number;
  y: number;
}

// --- DTO (REST 응답 / 소켓 payload 공용 형태) ---
export interface NodeDTO {
  id: string;
  type: NodeType;
  title: string;
  markdown: string;
  collapsed: boolean;
  position: XY;
  updatedAt?: string;
}

export interface EdgeDTO {
  id: string;
  source: string;
  target: string;
}

export interface CanvasSnapshot {
  project: { id: string; name: string; role: Role };
  nodes: NodeDTO[];
  edges: EdgeDTO[];
}

export interface ChatMessageDTO {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface ActivityDTO {
  id: string;
  targetType: ActivityTarget;
  targetId: string | null;
  targetLabel?: string;
  action: ActivityAction;
  createdAt: string;
  user: { id: string; name: string };
}

// --- Socket.io 이벤트 이름 (정본: Docs/09-API-Spec.md §7) ---
export const SOCKET_EVENTS = {
  syncJoin: "sync:join",
  syncInit: "sync:init",
  syncResync: "sync:resync",
  cursorMove: "cursor:move",
  nodeAdd: "node:add",
  nodeUpdate: "node:update",
  nodeDelete: "node:delete",
  edgeAdd: "edge:add",
  edgeDelete: "edge:delete",
  lockAcquire: "lock:acquire",
  lockRelease: "lock:release",
  lockUpdate: "lock:update",
  presenceUpdate: "presence:update",
  chatMessage: "chat:message",
  chatTyping: "chat:typing",
  chatNew: "chat:new",
} as const;

export const roomOf = (projectId: string) => `project:${projectId}`;
