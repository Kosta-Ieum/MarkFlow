// MarkFlow Socket.io 계약 정본 — 이벤트명 + payload zod schema
// 정본 = Socket.io 직접 구현 (Liveblocks는 CollabAPI 뒤 차선, 직접 사용 금지).
// 연결 1개 · 룸 1개: room = project:<id> (roomOf). 문서: Docs/09-API-Spec.md §7
import { z } from "zod";
import {
  NodeDTOSchema,
  EdgeDTOSchema,
  CanvasSnapshotSchema,
  ChatMessageDTOSchema,
  UserRefSchema,
  XYSchema,
} from "./schemas.js";

// --- 이벤트 이름 (정본: Docs/09-API-Spec.md §7) ---
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

// --- payload schema (런타임 검증; BE 수신 검증 + FE 송신 형태 보증) ---
export const SocketPayloadSchemas = {
  [SOCKET_EVENTS.syncJoin]: z.object({
    projectId: z.string().uuid(),
  }),

  [SOCKET_EVENTS.syncInit]: CanvasSnapshotSchema,

  [SOCKET_EVENTS.cursorMove]: z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    position: XYSchema,
  }),

  [SOCKET_EVENTS.nodeAdd]: z.object({
    projectId: z.string().uuid(),
    node: NodeDTOSchema,
  }),

  [SOCKET_EVENTS.nodeUpdate]: z.object({
    projectId: z.string().uuid(),
    node: NodeDTOSchema.partial().extend({
      id: z.string().uuid(),
    }),
  }),

  [SOCKET_EVENTS.nodeDelete]: z.object({
    projectId: z.string().uuid(),
    nodeId: z.string().uuid(),
  }),

  [SOCKET_EVENTS.edgeAdd]: z.object({
    projectId: z.string().uuid(),
    edge: EdgeDTOSchema,
  }),

  [SOCKET_EVENTS.edgeDelete]: z.object({
    projectId: z.string().uuid(),
    edgeId: z.string().uuid(),
  }),

  [SOCKET_EVENTS.lockAcquire]: z.object({
    projectId: z.string().uuid(),
    nodeId: z.string().uuid(),
  }),

  [SOCKET_EVENTS.lockRelease]: z.object({
    projectId: z.string().uuid(),
    nodeId: z.string().uuid(),
  }),

  [SOCKET_EVENTS.presenceUpdate]: z.object({
    users: z.array(UserRefSchema),
  }),

  [SOCKET_EVENTS.chatMessage]: z.object({
    projectId: z.string().uuid(),
    content: z.string().min(1),
  }),

  [SOCKET_EVENTS.chatNew]: z.object({
    projectId: z.string().uuid(),
    message: ChatMessageDTOSchema,
  }),

  [SOCKET_EVENTS.chatTyping]: z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
  }),

  [SOCKET_EVENTS.syncResync]: z.object({
    projectId: z.string().uuid(),
  }),
} as const;
