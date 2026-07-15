import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/authStore";

const HEADER_BG = "rgba(246,245,241,.86)";

export function GlobalHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const goHome = () => navigate(isAuthenticated ? "/projects" : "/");

  const handleLogout = () => {
    // 로그아웃해도 TanStack Query 캐시(프로젝트 목록 등)가 그대로 남아있으면, 같은 탭에서
    // 다른 계정으로 로그인했을 때 새로고침 전까지 이전 계정 데이터가 그대로 보인다(알파
    // 테스트에서도 나온 버그) — 계정 전환의 경계인 로그아웃 시점에 전부 비운다.
    void logout().then(() => {
      queryClient.clear();
      navigate("/");
    });
  };

  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "";

  return (
    <header
      className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-line px-6 backdrop-blur"
      style={{ backgroundColor: HEADER_BG }}
    >
      <button
        type="button"
        onClick={goHome}
        className="flex items-center gap-2 font-display text-lg font-bold"
        aria-label="MarkFlow 홈"
      >
        <span className="grid h-7 w-7 place-items-center rounded-[28%] bg-ink" aria-hidden />
        <span>
          <span className="text-ink">Mark</span>
          <span className="text-brand">flow</span>
        </span>
      </button>

      {isAuthenticated ? (
        <nav className="flex items-center gap-4">
          <Link to="/projects" className="text-sm text-secondary hover:text-ink">
            프로젝트
          </Link>
          <span
            className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white"
            aria-label={user?.name ?? "사용자"}
          >
            {initial}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-secondary hover:text-ink"
          >
            로그아웃
          </button>
        </nav>
      ) : (
        <nav className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-secondary hover:text-ink">
            로그인
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-ink px-3.5 py-1.5 text-sm font-medium text-surface"
          >
            시작하기
          </Link>
        </nav>
      )}
    </header>
  );
}
