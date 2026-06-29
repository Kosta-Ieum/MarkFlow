// TanStack Query 키 팩토리 (IEUM-20 프로젝트 목록 쿼리 대비)
export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  canvas: (projectId: string) => ["project", projectId, "canvas"] as const,
  messages: (projectId: string) => ["project", projectId, "messages"] as const,
  projectsTrash: ["projects", "trash"] as const,
  history: (projectId: string) => ["project", projectId, "history"] as const,
  members: (projectId: string) => ["project", projectId, "members"] as const,
} as const;
