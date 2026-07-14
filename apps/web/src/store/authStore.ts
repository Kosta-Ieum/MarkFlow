// 토큰(메모리)·user — 인증 store. access는 영속 저장하지 않고 refresh로 부팅 복원한다(ADR-0001).
import type { AuthResponse, User } from "@markflow/shared";
import { create } from "zustand";

import { api, refreshAccessToken } from "../lib/api";

// 부팅 refresh는 페이지 로드당 1회만 — StrictMode 이중 이펙트·리마운트에도 refresh 회전 중복 방지.
let bootstrapStarted = false;

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  /** 부팅 refresh 진행 중 — ProtectedRoute가 완료 전 리다이렉트를 보류(R1.4). */
  isBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (token: string, user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isLoading: false,
  error: null,

  setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
  setAccessToken: (token) => set({ token, isAuthenticated: true }),
  clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),

  // 앱 부팅 시 1회 — refresh 쿠키로 세션 복원(R1.4). access는 메모리라 새로고침마다 필요.
  bootstrap: async () => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    try {
      const token = await refreshAccessToken();
      if (!token) return; // 쿠키 없음/만료 → 비로그인
      set({ token, isAuthenticated: true });
      const me = await api<User>("/auth/me"); // RefreshResponse엔 user가 없어 별도 조회
      // user 확보 실패 시 "인증됨+user=null" 반쪽 상태를 남기지 않는다.
      if (me) set({ user: me });
      else get().clearAuth();
    } catch {
      // refresh는 됐지만 /auth/me 실패 → 세션 정리(비로그인으로).
      get().clearAuth();
    } finally {
      set({ isBootstrapping: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!data) throw new Error("응답 데이터가 없습니다.");
      get().setAuth(data.accessToken, data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (name, email, password, nickname) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password, nickname }),
      });
      if (!data) throw new Error("응답 데이터가 없습니다.");
      get().setAuth(data.accessToken, data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다.";
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    get().clearAuth();
  },
}));
