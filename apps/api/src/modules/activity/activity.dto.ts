// Activity(히스토리) 요청/응답 타입 — apps/api 내부 전용(packages/shared에 넣지 않음).
// 정본: apps/api/openapi.yaml (HistoryResponse/ActivityLog)
import { z } from "zod";
import type { ActivityTarget, ActivityAction } from "@prisma/client";

export const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().optional(),
});
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

export interface ActivityLogDTO {
  id: string;
  targetType: ActivityTarget;
  targetId: string | null;
  targetLabel?: string;
  action: ActivityAction;
  createdAt: string;
  user: { id: string; name: string };
}

export interface HistoryResponse {
  history: ActivityLogDTO[];
  nextCursor: string | null;
}
