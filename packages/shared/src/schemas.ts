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

export const UserRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  // 공개 표시명. 백필 전 데이터·nickname 미join payload 관용 위해 nullable+optional (UI는 nickname ?? name).
  nickname: z.string().nullable().optional(),
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
// 주의: 기존 UserRefSchema(id,name)와 별개 — 이쪽은 email 포함. nickname = 공개 표시명(백필 전/미join 관용).
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  nickname: z.string().nullable().optional(),
});

export const SignupRequestSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  // 회원가입 시 필수 입력 — 공개 표시명(2~20자, 앞뒤 공백 trim).
  nickname: z.string().trim().min(2).max(20),
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

// --- Profile (PATCH /users/me — 표시명 변경) ---
export const UpdateProfileRequestSchema = z.object({
  nickname: z.string().trim().min(2).max(20),
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

// --- Projects (openapi: ProjectSummary, ProjectsResponse, ProjectCreate/Update/Delete) ---
// 프로젝트는 하드 삭제 — 휴지통/복구 없음(노드만 소프트 삭제). PurgeResponse는 노드 영구삭제 공용.
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
  deleted: z.boolean(),
});

export const PurgeResponseSchema = z.object({
  id: z.string().uuid(),
  purged: z.boolean(),
});

// --- Members (openapi components/schemas: Member, MembersResponse, MemberInvite/Update Request, MemberDeleteResponse) ---
// REST 계약 정본은 apps/api/openapi.yaml (/projects/{projectId}/members 외). 형태는 openapi와 1:1.
export const MemberSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  nickname: z.string().nullable().optional(),
});

export const MembersResponseSchema = z.object({
  members: z.array(MemberSchema),
});

// 초대·역할변경의 role enum은 OWNER 제외(openapi enum: EDITOR|VIEWER).
export const MemberInviteRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

export const MemberUpdateRequestSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER"]),
});

export const MemberDeleteResponseSchema = z.object({
  userId: z.string().uuid(),
});
