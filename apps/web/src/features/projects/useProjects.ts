// IEUM-20: 프로젝트 목록 TanStack Query 훅
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProjectCreateRequest,
  ProjectDeleteResponse,
  ProjectSummary,
  ProjectUpdateRequest,
  ProjectUpdateResponse,
  ProjectsResponse,
} from "@markflow/shared";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useAuthStore } from "../../store/authStore";

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export function useProjects() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    // user 스코프 키 — 계정 전환 시 이전 계정 목록이 새 계정에 보이지 않도록.
    queryKey: queryKeys.projects(userId),
    queryFn: () => api<ProjectsResponse>("/projects"),
    select: (data) => data?.projects ?? [],
    enabled: !!userId,
  });
}

// ── 생성 ──────────────────────────────────────────────────────────────────────

export function useCreateProject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (body: ProjectCreateRequest) =>
      api<ProjectSummary>("/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projects(userId) });
    },
  });
}

// ── 이름 변경 (OWNER) ─────────────────────────────────────────────────────────

interface RenameVariables {
  id: string;
  body: ProjectUpdateRequest;
}

export function useRenameProject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: ({ id, body }: RenameVariables) =>
      api<ProjectUpdateResponse>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projects(userId) });
    },
  });
}

// ── 삭제 (하드 — 영구 삭제·복구 없음, OWNER) ────────────────────────────────

export function useDeleteProject() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (id: string) =>
      api<ProjectDeleteResponse>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projects(userId) });
    },
  });
}
