// Bearer 부착 REST 클라이언트 — 401은 AuthManager로 1회 갱신 후 재시도한다(R2.2).
import { ErrorResponseSchema, type ErrorResponse } from "@markflow/shared";
import type { AuthManager } from "./auth.js";
import type { Env } from "./env.js";
import { McpToolError, mapErrorResponse, mapNetworkError } from "./errors.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T | null>;
}

/** env.MARKFLOW_API_BASE 기준(경로에 /api prefix 없음 — design.md §2 제약 3). */
export function createApiClient(env: Env, auth: AuthManager): ApiClient {
  async function send<T>(
    method: HttpMethod,
    path: string,
    body: unknown,
    token: string,
    allowRetry: boolean,
  ): Promise<T | null> {
    let res: Response;
    try {
      res = await fetch(`${env.MARKFLOW_API_BASE}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw mapNetworkError(err);
    }

    if (res.status === 401) {
      if (!allowRetry) {
        throw new McpToolError("UNAUTHORIZED", "인증에 실패했습니다");
      }
      const newToken = await auth.handleUnauthorized();
      return send<T>(method, path, body, newToken, false);
    }

    if (res.status === 204) {
      return null;
    }

    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        throw new McpToolError("INTERNAL", `HTTP ${res.status}`);
      }
      const result = ErrorResponseSchema.safeParse(parsed);
      if (!result.success) {
        throw new McpToolError("INTERNAL", `HTTP ${res.status}`);
      }
      throw mapErrorResponse(result.data as ErrorResponse);
    }

    return (await res.json()) as T;
  }

  return {
    async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T | null> {
      const token = await auth.ensureToken();
      return send<T>(method, path, body, token, true);
    },
  };
}
