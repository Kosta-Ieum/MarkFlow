// 토큰·user — 인증 store (라우트 가드 토대 + API 연동)
import type { AuthResponse, User } from "@markflow/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { api } from "../lib/api";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),

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

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await api<AuthResponse>("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
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
    }),
    {
      name: "markflow-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!state.token;
        }
      },
    },
  ),
);
