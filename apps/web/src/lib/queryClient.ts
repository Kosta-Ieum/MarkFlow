// 단일 QueryClient 인스턴스 — React 트리 밖(예: useSocketCollab의 소켓 핸들러)에서도
// 캐시를 무효화해야 할 때(히스토리 실시간 갱신 등) import해서 쓸 수 있게 분리해뒀다.
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
