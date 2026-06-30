// 라우팅 + 인증 가드
import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components";
import { AuthPage } from "../features/auth";
import { CanvasPage } from "../features/canvas";
import { ProjectCollabLayout } from "../features/canvas/ProjectCollabLayout";
import { LandingPage } from "../features/landing";
import { NodeEditorPage } from "../features/node-editor";
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
