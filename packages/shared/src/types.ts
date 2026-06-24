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
