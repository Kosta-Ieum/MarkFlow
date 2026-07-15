// fetch 래퍼 + Bearer·credentials·401 인터셉터(단일 refresh 후 원요청 재시도). ADR-0001.
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

// 서버가 세션을 강제 종료(다른 기기 로그인 등)했을 때, 로그인 화면에 사유를 전달하기 위한 저장소.
// api 계층(비컴포넌트)은 사유를 React 상태로 넘길 수 없으므로 sessionStorage로 전달한다.
const SESSION_NOTICE_KEY = "markflow-session-notice";

function stashSessionNotice(message: string): void {
  try {
    sessionStorage.setItem(SESSION_NOTICE_KEY, message);
  } catch {
    /* sessionStorage 불가 환경 — 무시 */
  }
}

/** 로그인 화면에서 세션 종료 사유를 1회 읽고 지운다. */
export function takeSessionNotice(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_NOTICE_KEY);
    if (v !== null) sessionStorage.removeItem(SESSION_NOTICE_KEY);
    return v;
  } catch {
    return null;
  }
}

// 세션 종료 시 리다이렉트는 하드 리로드(window.location) 대신 clearAuth로 처리한다 —
// clearAuth가 isAuthenticated=false로 만들면 ProtectedRoute가 클라이언트 라우팅으로 /login 전환.
// (하드 리로드는 재부팅 → bootstrap이 죽은 쿠키로 refresh 재시도 → 409 → 로그인↔로딩 깜빡임을 유발했다.)

// 서버가 세션을 강제 종료한 응답인지 판별 — 전용 코드(DUPLICATE_LOGIN) 또는 과도기의 409+메시지.
// BE가 현재 "다른 기기 로그인"에 generic CONFLICT 코드를 써서, 전용 코드 도입 전까지 메시지로 보강한다.
function isSessionEnded(
  status: number,
  err: { code?: string; message?: string } | undefined,
): boolean {
  if (err?.code === "DUPLICATE_LOGIN") return true;
  if (status === 409 && err?.message?.includes("다른 기기에서 로그인")) return true;
  return false;
}

// 응답이 세션 강제 종료 사유를 담고 있으면 로그인 화면 전달용으로 저장.
async function captureSessionEndReason(res: Response): Promise<void> {
  try {
    const body = (await res.json()) as ErrorResponse;
    if (isSessionEnded(res.status, body?.error) && body?.error?.message) {
      stashSessionNotice(body.error.message);
    }
  } catch {
    /* 바디 없음/파싱 실패 — 무시 */
  }
}

// refresh 쿠키로 새 access token을 받는 원시 fetch — 표준 api() 401 처리(clearAuth·리다이렉트)를
// 우회해 재귀·조기 리다이렉트를 방지한다. 실패(401·네트워크) 시 null.
async function rawRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      await captureSessionEndReason(res); // 다른 기기 로그인 등 사유가 있으면 저장
      return null;
    }
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * 새 access token 발급 — 401 인터셉터·부팅 복원(authStore.bootstrap) 공용.
 * 동시 호출은 1회 refresh로 합친다(R1.6) — 인터셉터와 부팅이 겹쳐도 이중 회전 방지.
 */
let refreshPromise: Promise<string | null> | null = null;
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = rawRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  return request<T>(path, init, true);
}

// allowRefresh=false는 refresh 후 재시도된 요청 — 재-refresh 금지(무한 루프 차단).
async function request<T>(
  path: string,
  init: RequestInit | undefined,
  allowRefresh: boolean,
): Promise<T | null> {
  // 동적 import — authStore가 api를 정적 import하므로, 여기서 정적 import하면 순환.
  const { useAuthStore } = await import("../store/authStore");
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // credentials:include — httpOnly refresh 쿠키를 cross-site로 전송(R1.1, R2.1).
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });

  if (res.status === 401) {
    // access 만료 추정 — 최초 1회만 refresh 후 원요청 재시도(R1.2).
    if (allowRefresh) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        useAuthStore.getState().setAccessToken(newToken);
        return request<T>(path, init, false);
      }
    }
    // refresh 불가/실패 → 세션 종료(R1.3). clearAuth → ProtectedRoute가 반응형으로 /login 전환.
    // (DUPLICATE_LOGIN 사유는 rawRefresh가 이미 sessionStorage에 저장)
    useAuthStore.getState().clearAuth();
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

    // 다른 기기 로그인 등으로 서버가 세션을 강제 종료한 경우 로그아웃 — 전용 코드 또는 409+메시지로 감지.
    if (isSessionEnded(res.status, err)) {
      if (err?.message) stashSessionNotice(err.message);
      useAuthStore.getState().clearAuth(); // ProtectedRoute가 반응형으로 /login 전환(하드 리로드 없음)
    }

    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN_ERROR",
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }

  return (await res.json()) as T;
}
