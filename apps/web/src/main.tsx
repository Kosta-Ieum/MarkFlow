// React 엔트리 (createRoot)
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("#root 엘리먼트를 찾을 수 없습니다.");
}

async function bootstrap(): Promise<void> {
  // dev 목 — VITE_MOCK_API=1 일 때만 MSW 워커 기동. 플래그 없으면 실서버로 동작.
  if (import.meta.env.VITE_MOCK_API === "1") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });

    // 다른 탭(계정)이 초대 등으로 mock DB를 바꾸면 storage 이벤트로 db.ts는
    // 갱신되지만 React Query 캐시는 모른다 — 여기서 project/member 쿼리를
    // 무효화해 이 탭 화면에도 즉시 반영되게 한다.
    const { MOCK_DB_UPDATED_EVENT } = await import("./mocks/db");
    window.addEventListener(MOCK_DB_UPDATED_EVENT, () => {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === "projects" || key === "project";
        },
      });
    });
  }

  createRoot(container as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
