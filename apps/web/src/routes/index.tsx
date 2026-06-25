// 라우팅 + 인증 가드
import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components";
import { AuthPage } from "../features/auth";
import { LandingPage } from "../features/landing";
import { ProjectsPage } from "../features/projects";
import { useAuthStore } from "../store/authStore";

interface ProtectedRouteProps {
  children: ReactElement;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// 캔버스 라우트는 F1(features/canvas) 소유 — 여기서는 인라인 플레이스홀더만 둔다.
function CanvasPlaceholder() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <p className="font-display text-lg text-secondary">캔버스(F1 구현 예정)</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/p/:projectId"
          element={
            <ProtectedRoute>
              <CanvasPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
