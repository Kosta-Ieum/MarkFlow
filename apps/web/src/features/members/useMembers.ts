// 프로젝트 멤버 / 초대 TanStack Query 훅 (F2 프로젝트 도메인)
// REST는 lib/api()를 통해서만. 권한 가드는 서버(REST)가 최종 — 여기 UX 비활성화는 보조.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Member,
  MemberDeleteResponse,
  MemberInviteRequest,
  MemberUpdateRequest,
  MembersResponse,
} from "@markflow/shared";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";

// ── 멤버 목록 ─────────────────────────────────────────────────────────────────

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: queryKeys.members(projectId),
    queryFn: () => api<MembersResponse>(`/projects/${projectId}/members`),
    select: (data) => data?.members ?? [],
  });
}

// ── 초대 (OWNER) ──────────────────────────────────────────────────────────────

export function useInviteMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MemberInviteRequest) =>
      api<Member>(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.members(projectId) });
    },
  });
}

// ── 역할 변경 (OWNER) ─────────────────────────────────────────────────────────

interface UpdateRoleVariables {
  userId: string;
  body: MemberUpdateRequest;
}

export function useUpdateMemberRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: UpdateRoleVariables) =>
      api<Member>(`/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.members(projectId) });
    },
  });
}

// ── 제거 (OWNER) ──────────────────────────────────────────────────────────────

export function useRemoveMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<MemberDeleteResponse>(`/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.members(projectId) });
    },
  });
}
