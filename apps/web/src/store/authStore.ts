// 토큰·user — 인증 store (라우트 가드 토대 + API 연동)
import type { AuthResponse, User } from "@markflow/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
      // localStorage는 같은 브라우저의 모든 탭이 공유한다 — 실서버 환경에선 의도된 동작(한 번
      // 로그인하면 새 탭도 같은 세션)이지만, mock 모드(VITE_MOCK_API=1)에서 두 탭에 서로 다른
      // 계정을 띄워 멀티유저를 테스트할 때는 새로고침마다 세션이 서로 덮어써서 꼬인다.
      // mock 모드에서만 탭별로 격리되는 sessionStorage를 쓴다.
      storage: createJSONStorage(() =>
        import.meta.env.VITE_MOCK_API === "1" ? sessionStorage : localStorage,
      ),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!state.token;
        }
      },
    },
  ),
);
