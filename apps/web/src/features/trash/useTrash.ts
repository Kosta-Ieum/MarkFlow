// IEUM-30: 휴지통 TanStack Query 훅 (F2-2.2)
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DeletedProject,
  ProjectRestoreResponse,
  ProjectsTrashResponse,
  PurgeResponse,
} from "@markflow/shared";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

// ── 휴지통 목록 조회 ──────────────────────────────────────────────────────────

export function useTrash() {
  return useQuery({
    queryKey: queryKeys.projectsTrash,
    queryFn: () => api<ProjectsTrashResponse>("/projects/trash"),
    select: (data): DeletedProject[] => data?.projects ?? [],
  });
}

// ── 복구 (OWNER) ──────────────────────────────────────────────────────────────

export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      api<ProjectRestoreResponse>(`/projects/${projectId}/restore`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.projectsTrash }),
        qc.invalidateQueries({ queryKey: queryKeys.projects }),
      ]);
    },
  });
}

// ── 영구 삭제 (OWNER) ─────────────────────────────────────────────────────────

export function usePurgeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      api<PurgeResponse>(`/projects/${projectId}/permanent`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projectsTrash });
    },
  });
}
