// fetch 래퍼 + Bearer·401 인터셉터
import type { ErrorResponse } from "@markflow/shared";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  // 동적 import — authStore가 api를 정적 import하므로, 여기서 정적 import하면 순환.
  // 호출 시점 동적 로드로 사이클을 끊고 lazy getState()로만 접근한다.
  const { useAuthStore } = await import("../store/authStore");
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    useAuthStore.getState().clearAuth();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "UNAUTHORIZED", "인증이 만료되었습니다. 다시 로그인해 주세요.");
  }

  if (res.status === 204) {
    return null;
  }

  if (!res.ok) {
    let errorBody: ErrorResponse | null = null;
    try {
      errorBody = (await res.json()) as ErrorResponse;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 사용
    }
    const err = errorBody?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN_ERROR",
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }

  return (await res.json()) as T;
}
