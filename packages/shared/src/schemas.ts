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

// --- Auth (openapi components/schemas: User, SignupRequest, LoginRequest, AuthResponse, RefreshResponse) ---
// 주의: 기존 UserRefSchema(id,name 2필드)와 별개 — 이쪽은 email 포함 3필드
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

export const SignupRequestSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
});

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
});

// --- Email OTP (회원가입 이메일 인증 / openapi: SendCode/VerifyEmail Request·Response) ---
export const SendCodeRequestSchema = z.object({
  email: z.string().email(),
});

export const SendCodeResponseSchema = z.object({
  sent: z.boolean(),
});

export const VerifyEmailRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export const VerifyEmailResponseSchema = z.object({
  verified: z.boolean(),
});

// --- Projects (openapi components/schemas: ProjectSummary, ProjectsResponse, ProjectCreate/Update/Delete/Restore/Trash/Purge) ---
export const ProjectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: RoleSchema,
  isOwner: z.boolean(),
  nodeCount: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});

export const ProjectsResponseSchema = z.object({
  projects: z.array(ProjectSummarySchema),
});

export const ProjectCreateRequestSchema = z.object({
  name: z.string().max(120),
});

export const ProjectUpdateRequestSchema = z.object({
  name: z.string().max(120),
});

export const ProjectUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  updatedAt: z.string().datetime(),
});

export const ProjectDeleteResponseSchema = z.object({
  id: z.string().uuid(),
  deletedAt: z.string().datetime(),
});

export const ProjectRestoreResponseSchema = z.object({
  id: z.string().uuid(),
  deletedAt: z.string().datetime().nullable(),
});

export const DeletedProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  deletedAt: z.string().datetime(),
  isOwner: z.boolean(),
});

export const ProjectsTrashResponseSchema = z.object({
  projects: z.array(DeletedProjectSchema),
});

export const PurgeResponseSchema = z.object({
  id: z.string().uuid(),
  purged: z.boolean(),
});
