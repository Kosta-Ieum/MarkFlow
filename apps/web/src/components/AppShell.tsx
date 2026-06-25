import { Outlet, useLocation } from "react-router-dom";

import { GlobalHeader } from "./GlobalHeader";

export function AppShell() {
  const { pathname } = useLocation();
  // 캔버스(/p/:id)는 전용 풀스크린 — 글로벌 헤더 숨김.
  const notCanvas = !pathname.startsWith("/p/");

  return (
    <div className="flex min-h-screen flex-col bg-app">
      {notCanvas && <GlobalHeader />}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
