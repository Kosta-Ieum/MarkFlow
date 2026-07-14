// TanStack Query 키 팩토리 (IEUM-20 프로젝트 목록 쿼리 대비)
export const queryKeys = {
  // user 스코프 — 계정 전환 시 이전 계정의 목록 캐시가 새 계정에 노출되지 않게 한다.
  projects: (userId: string | undefined) => ["projects", userId] as const,
  project: (id: string) => ["projects", id] as const,
  canvas: (projectId: string) => ["project", projectId, "canvas"] as const,
  messages: (projectId: string) => ["project", projectId, "messages"] as const,
  history: (projectId: string) => ["project", projectId, "history"] as const,
  members: (projectId: string) => ["project", projectId, "members"] as const,
} as const;
