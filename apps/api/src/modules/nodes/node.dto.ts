// 노드 요청/응답 타입 — apps/api 내부 전용(packages/shared에 넣지 않음).
// 정본: apps/api/openapi.yaml (NodeCreateRequest/NodeUpdateRequest/NodeDeleteResponse/NodeRestoreResponse)
// 응답 본문(Node)은 @markflow/shared의 NodeDTOSchema(z.infer) 재사용.
import { z } from "zod";
import { XYSchema, NodeTypeSchema } from "@markflow/shared";

export const NodeCreateRequestSchema = z.object({
  title: z.string(),
  markdown: z.string(),
  type: NodeTypeSchema,
  position: XYSchema,
});
export type NodeCreateRequest = z.infer<typeof NodeCreateRequestSchema>;

export const NodeUpdateRequestSchema = z.object({
  title: z.string().optional(),
  markdown: z.string().optional(),
  type: NodeTypeSchema.optional(),
  collapsed: z.boolean().optional(),
  position: XYSchema.optional(),
});
export type NodeUpdateRequest = z.infer<typeof NodeUpdateRequestSchema>;

export interface NodeDeleteResponse {
  id: string;
  deletedAt: string;
}

export interface NodeRestoreResponse {
  id: string;
  deletedAt: string | null;
}
