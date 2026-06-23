// MarkFlow 공용 DTO — zod schema (REST body·응답 / 소켓 payload 공용 런타임 검증)
// 정본: 이 파일 + ./socket.ts. REST 형태는 apps/api/openapi.yaml과 정합해야 한다.
// 타입만 필요하면 ./types.ts(z.infer)를 import. 문서: Docs/08-ERD.md, Docs/09-API-Spec.md
import { z } from "zod";

// --- enums ---
export const RoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);
export const NodeTypeSchema = z.enum(["idea", "doc", "task", "decision", "data"]);
export const ActivityTargetSchema = z.enum(["NODE", "EDGE", "PROJECT"]);
export const ActivityActionSchema = z.enum([
  "CREATE",
  "UPDATE",
  "MOVE",
  "DELETE",
  "RESTORE",
  "CONNECT",
  "DISCONNECT",
  "RENAME",
]);

// --- primitives ---
export const XYSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const UserRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

// --- DTO (REST 응답 / 소켓 payload 공용 형태) ---
export const NodeDTOSchema = z.object({
  id: z.string().uuid(),
  type: NodeTypeSchema,
  title: z.string(),
  markdown: z.string(),
  collapsed: z.boolean(),
  position: XYSchema,
  updatedAt: z.string().datetime().optional(),
});

export const EdgeDTOSchema = z.object({
  id: z.string().uuid(),
  source: z.string().uuid(),
  target: z.string().uuid(),
});

export const CanvasSnapshotSchema = z.object({
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: RoleSchema,
  }),
  nodes: z.array(NodeDTOSchema),
  edges: z.array(EdgeDTOSchema),
});

export const ChatMessageDTOSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
  user: UserRefSchema,
});

export const ActivityDTOSchema = z.object({
  id: z.string().uuid(),
  targetType: ActivityTargetSchema,
  targetId: z.string().uuid().nullable(),
  targetLabel: z.string().optional(),
  action: ActivityActionSchema,
  createdAt: z.string().datetime(),
  user: UserRefSchema,
});

// --- 표준 에러 포맷 (Docs/09-API-Spec.md §0.3 / openapi ErrorResponse) ---
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
});
