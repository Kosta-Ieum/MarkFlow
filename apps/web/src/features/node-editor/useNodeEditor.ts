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

  // 캔버스에서 노드를 추가한 직후(자동저장 debounce ≈2s 전) 바로 더블클릭해서
  // 들어오면 REST 스냅샷엔 아직 없다 — canvasStore(이미 메모리에 있음)로 폴백해
  // "노드를 찾을 수 없습니다" 오탐을 막는다.
  const localNode = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  if (!query.data && localNode) {
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
      // 캔버스 화면(다른 탭 포함)에 실시간 반영 — ProjectCollabLayout이 연결을 들고 있어서
      // 에디터 라우트에서도 emit 가능(예전엔 라우트가 형제라 소켓이 끊겨 있었음).
      if (saved) {
        emitNodeUpdate({ id: saved.id, title: saved.title, markdown: saved.markdown, type: saved.type });
      }
      await qc.invalidateQueries({ queryKey: queryKeys.canvas(projectId) });
    },
  });
}
