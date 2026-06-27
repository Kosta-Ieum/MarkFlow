// MarkFlow 공용 타입 — zod schema에서 파생(z.infer). 런타임 검증은 ./schemas.ts·./socket.ts.
// 정본: ./schemas.ts(DTO) · ./socket.ts(이벤트). 형태 변경은 schema를 먼저 고친다.
import { z } from "zod";
import {
  RoleSchema,
  NodeTypeSchema,
  ActivityTargetSchema,
  ActivityActionSchema,
  XYSchema,
  NodeDTOSchema,
  EdgeDTOSchema,
  CanvasSnapshotSchema,
  ChatMessageDTOSchema,
  ActivityDTOSchema,
  ErrorResponseSchema,
  UserSchema,
  SignupRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  RefreshResponseSchema,
  ProjectSummarySchema,
  ProjectsResponseSchema,
  ProjectCreateRequestSchema,
  ProjectUpdateRequestSchema,
  ProjectUpdateResponseSchema,
  ProjectDeleteResponseSchema,
  ProjectRestoreResponseSchema,
  DeletedProjectSchema,
  ProjectsTrashResponseSchema,
  PurgeResponseSchema,
} from "./schemas.js";

export type Role = z.infer<typeof RoleSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type ActivityTarget = z.infer<typeof ActivityTargetSchema>;
export type ActivityAction = z.infer<typeof ActivityActionSchema>;

export type XY = z.infer<typeof XYSchema>;
export type NodeDTO = z.infer<typeof NodeDTOSchema>;
export type EdgeDTO = z.infer<typeof EdgeDTOSchema>;
export type CanvasSnapshot = z.infer<typeof CanvasSnapshotSchema>;
export type ChatMessageDTO = z.infer<typeof ChatMessageDTOSchema>;
export type ActivityDTO = z.infer<typeof ActivityDTOSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Auth types
export type User = z.infer<typeof UserSchema>;
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// Project types
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;
export type ProjectCreateRequest = z.infer<typeof ProjectCreateRequestSchema>;
export type ProjectUpdateRequest = z.infer<typeof ProjectUpdateRequestSchema>;
export type ProjectUpdateResponse = z.infer<typeof ProjectUpdateResponseSchema>;
export type ProjectDeleteResponse = z.infer<typeof ProjectDeleteResponseSchema>;
export type ProjectRestoreResponse = z.infer<typeof ProjectRestoreResponseSchema>;
export type DeletedProject = z.infer<typeof DeletedProjectSchema>;
export type ProjectsTrashResponse = z.infer<typeof ProjectsTrashResponseSchema>;
export type PurgeResponse = z.infer<typeof PurgeResponseSchema>;
