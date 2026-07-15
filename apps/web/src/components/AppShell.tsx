import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../store/authStore";
import { GlobalHeader } from "./GlobalHeader";

export function AppShell() {
  const { pathname } = useLocation();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  // 앱 부팅 시 1회 refresh 쿠키로 세션 복원(R1.4). bootstrap은 자체 가드로 중복 실행 방지.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
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
