// 라우팅 + 인증 가드
import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components";
import { AuthPage } from "../features/auth";
import { CanvasPage } from "../features/canvas";
import { ProjectCollabLayout } from "../features/canvas/ProjectCollabLayout";
import { LandingPage } from "../features/landing";
import { NodeEditorPage } from "../features/node-editor";
import { ProfilePage } from "../features/profile";
import { ProjectsPage } from "../features/projects";
import { useAuthStore } from "../store/authStore";

interface ProtectedRouteProps {
  children: ReactElement;
}

// 부팅 refresh 진행 중 공통 로딩.
function BootLoading() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center text-muted"
      role="status"
      aria-live="polite"
    >
      불러오는 중…
    </div>
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  // 부팅 refresh 완료 전에는 판단 보류 — 새로고침 시 /login 깜빡임 방지(R1.4).
  if (isBootstrapping) return <BootLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// 인증된 사용자가 /login·/signup에 접근하면 /projects로 리다이렉트(로그인 화면 노출 방지, R9).
export function PublicOnlyRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  if (isBootstrapping) return <BootLoading />;
  if (isAuthenticated) {
    return <Navigate to="/projects" replace />;
  }
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <AuthPage mode="login" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <AuthPage mode="signup" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/p/:projectId"
          element={
            <ProtectedRoute>
              <ProjectCollabLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CanvasPage />} />
          <Route path="n/:nodeId" element={<NodeEditorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
