import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/authStore";

const HEADER_BG = "rgba(246,245,241,.86)";

// 아바타 클릭 → 프로필 보기·로그아웃 드롭다운(R8). 표시명은 nickname ?? name(R8.5).
function UserMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = user?.nickname ?? user?.name ?? "사용자";
  const initial = displayName.trim().charAt(0).toUpperCase();

  // 바깥 클릭 시 닫기(R8.4).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const goProfile = () => {
    setOpen(false);
    navigate("/profile");
  };

  const handleLogout = () => {
    setOpen(false);
    void logout().then(() => {
      navigate("/");
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${displayName} 메뉴`}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 min-w-[168px] overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
            {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={goProfile}
            className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-canvas hover:text-ink"
          >
            프로필 보기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-canvas hover:text-ink"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export function GlobalHeader() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const goHome = () => {
    navigate(isAuthenticated ? "/projects" : "/");
  };

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
          <UserMenu />
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
