// IEUM-29: 노드 상세 에디터 데이터 훅
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CanvasSnapshot, NodeDTO } from "@markflow/shared";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { emitNodeUpdate, toNodeDTO, useCanvasStore } from "../../store/canvasStore";

// --- 노드 단건 조회 (canvas 스냅샷 select) ---

export function useNode(projectId: string, nodeId: string) {
  const query = useQuery({
    queryKey: queryKeys.canvas(projectId),
    queryFn: () => api<CanvasSnapshot>(`/projects/${projectId}/canvas`),
    select: (data): NodeDTO | undefined =>
      data?.nodes.find((n) => n.id === nodeId),
  });

  const localNode = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  // 항상 캔버스 스토어(웹소켓 실시간 업데이트가 반영된) 노드를 우선 사용합니다.
  if (localNode) {
    return { ...query, data: toNodeDTO(localNode) };
  }
  return query;
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
    onSuccess: async (saved) => {
      console.log("1. REST 저장 완료! 소켓 발송 직전", saved);
      // 캔버스 화면(다른 탭 포함)에 실시간 반영 — ProjectCollabLayout이 연결을 들고 있어서
      // 에디터 라우트에서도 emit 가능(예전엔 라우트가 형제라 소켓이 끊겨 있었음).
      if (saved) {
        emitNodeUpdate({ id: saved.id, title: saved.title, markdown: saved.markdown, type: saved.type });
      }
      await qc.invalidateQueries({ queryKey: queryKeys.canvas(projectId) });
    },
  });
}
