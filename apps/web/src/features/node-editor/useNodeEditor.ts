// IEUM-29: 노드 상세 에디터 데이터 훅
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CanvasSnapshot, NodeDTO } from "@markflow/shared";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

// --- 노드 단건 조회 (canvas 스냅샷 select) ---

export function useNode(projectId: string, nodeId: string) {
  return useQuery({
    queryKey: queryKeys.canvas(projectId),
    queryFn: () => api<CanvasSnapshot>(`/projects/${projectId}/canvas`),
    select: (data): NodeDTO | undefined =>
      data?.nodes.find((n) => n.id === nodeId),
  });
}

// --- 캔버스 스냅샷 (project.role 조회용) ---

export function useCanvasSnapshot(projectId: string) {
  return useQuery({
    queryKey: queryKeys.canvas(projectId),
    queryFn: () => api<CanvasSnapshot>(`/projects/${projectId}/canvas`),
  });
}

// --- PATCH 부분본문 타입 ---

export type NodePatchBody = Pick<NodeDTO, "title" | "markdown" | "type">;

// --- 노드 저장 (PATCH /projects/:projectId/nodes/:nodeId) ---

export function useSaveNode(projectId: string, nodeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<NodePatchBody>) =>
      api<NodeDTO>(`/projects/${projectId}/nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.canvas(projectId) });
    },
  });
}
