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

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => api<ProjectsResponse>("/projects"),
    select: (data) => data?.projects ?? [],
  });
}

// ── 생성 ──────────────────────────────────────────────────────────────────────

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectCreateRequest) =>
      api<ProjectSummary>("/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projects });
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
  return useMutation({
    mutationFn: ({ id, body }: RenameVariables) =>
      api<ProjectUpdateResponse>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

// ── 삭제 (소프트 — 휴지통 이동, OWNER) ──────────────────────────────────────

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ProjectDeleteResponse>(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
