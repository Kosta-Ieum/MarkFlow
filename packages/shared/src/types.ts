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
  CanvasSaveRequestSchema,
  CanvasSaveResponseSchema,
  ChatMessageDTOSchema,
  ActivityDTOSchema,
  ErrorResponseSchema,
  UserSchema,
  SignupRequestSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  RefreshResponseSchema,
  SendCodeRequestSchema,
  SendCodeResponseSchema,
  VerifyEmailRequestSchema,
  VerifyEmailResponseSchema,
  ProjectSummarySchema,
  ProjectsResponseSchema,
  ProjectCreateRequestSchema,
  ProjectUpdateRequestSchema,
  ProjectUpdateResponseSchema,
  ProjectDeleteResponseSchema,
  PurgeResponseSchema,
  MemberSchema,
  MembersResponseSchema,
  MemberInviteRequestSchema,
  MemberUpdateRequestSchema,
  MemberDeleteResponseSchema,
  ChatMessageCreateRequestSchema,
  MessagesResponseSchema,
} from "./schemas.js";

export type Role = z.infer<typeof RoleSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type ActivityTarget = z.infer<typeof ActivityTargetSchema>;
export type ActivityAction = z.infer<typeof ActivityActionSchema>;

export type XY = z.infer<typeof XYSchema>;
export type NodeDTO = z.infer<typeof NodeDTOSchema>;
export type EdgeDTO = z.infer<typeof EdgeDTOSchema>;
export type CanvasSnapshot = z.infer<typeof CanvasSnapshotSchema>;
export type CanvasSaveRequest = z.infer<typeof CanvasSaveRequestSchema>;
export type CanvasSaveResponse = z.infer<typeof CanvasSaveResponseSchema>;
export type ChatMessageDTO = z.infer<typeof ChatMessageDTOSchema>;
export type ChatMessageCreateRequest = z.infer<typeof ChatMessageCreateRequestSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
export type ActivityDTO = z.infer<typeof ActivityDTOSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Auth types
export type User = z.infer<typeof UserSchema>;
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type SendCodeRequest = z.infer<typeof SendCodeRequestSchema>;
export type SendCodeResponse = z.infer<typeof SendCodeResponseSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;
export type VerifyEmailResponse = z.infer<typeof VerifyEmailResponseSchema>;

// Project types
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;
export type ProjectCreateRequest = z.infer<typeof ProjectCreateRequestSchema>;
export type ProjectUpdateRequest = z.infer<typeof ProjectUpdateRequestSchema>;
export type ProjectUpdateResponse = z.infer<typeof ProjectUpdateResponseSchema>;
export type ProjectDeleteResponse = z.infer<typeof ProjectDeleteResponseSchema>;
export type PurgeResponse = z.infer<typeof PurgeResponseSchema>;

// Member types
export type Member = z.infer<typeof MemberSchema>;
export type MembersResponse = z.infer<typeof MembersResponseSchema>;
export type MemberInviteRequest = z.infer<typeof MemberInviteRequestSchema>;
export type MemberUpdateRequest = z.infer<typeof MemberUpdateRequestSchema>;
export type MemberDeleteResponse = z.infer<typeof MemberDeleteResponseSchema>;
