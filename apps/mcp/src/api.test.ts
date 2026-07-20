import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api.js";
import type { AuthManager } from "./auth.js";
import type { Env } from "./env.js";

const env: Env = {
  MARKFLOW_API_BASE: "https://api.test",
  MARKFLOW_WS_URL: "https://api.test",
  MARKFLOW_BOT_EMAIL: "bot@example.com",
  MARKFLOW_BOT_PASSWORD: "s3cr3t-pass",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** api.ts는 ensureToken/handleUnauthorized만 쓴다 — 나머지 AuthManager 내부는 auth.test.ts 소관. */
function fakeAuth() {
  const ensureToken = vi.fn().mockResolvedValue("token-1");
  const handleUnauthorized = vi.fn().mockResolvedValue("token-2");
  const auth = { ensureToken, handleUnauthorized } as unknown as AuthManager;
  return { auth, ensureToken, handleUnauthorized };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApiClient", () => {
  it("정상 응답을 JSON으로 반환하고 Bearer 토큰을 부착한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { auth } = fakeAuth();

    const client = createApiClient(env, auth);
    const result = await client.request<{ ok: boolean }>("GET", "/projects");

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/projects");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
  });

  it("204 응답은 null을 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { auth } = fakeAuth();

    const client = createApiClient(env, auth);
    const result = await client.request("DELETE", "/projects/x/nodes/y");

    expect(result).toBeNull();
  });

  it("② 401 응답이면 handleUnauthorized 후 원요청을 1회만 재시도한다", async () => {
    const { auth, handleUnauthorized } = fakeAuth();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "expired", details: null } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient(env, auth);
    const result = await client.request<{ data: number }>("GET", "/projects");

    expect(result).toEqual({ data: 1 });
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe("Bearer token-2");
  });

  it("재시도 응답도 401이면 더 이상 재시도하지 않고 UNAUTHORIZED로 끝난다", async () => {
    const { auth, handleUnauthorized } = fakeAuth();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "expired", details: null } }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient(env, auth);
    await expect(client.request("GET", "/projects")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("⑥-1 FORBIDDEN 에러엔 EDITOR 확인 힌트가 붙는다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(403, { error: { code: "FORBIDDEN", message: "권한이 없습니다", details: null } }));
    vi.stubGlobal("fetch", fetchMock);
    const { auth } = fakeAuth();

    const client = createApiClient(env, auth);
    await expect(client.request("GET", "/projects/x")).rejects.toMatchObject({
      code: "FORBIDDEN",
      hint: expect.stringContaining("EDITOR"),
    });
  });

  it("⑥-2 fetch 자체 실패는 NETWORK로 구분되어 UNAUTHORIZED와 혼동되지 않는다", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const { auth } = fakeAuth();

    const client = createApiClient(env, auth);
    await expect(client.request("GET", "/projects")).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("⑥-3 ErrorResponse의 코드·메시지를 그대로 보존한다(NOT_FOUND)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(404, { error: { code: "NOT_FOUND", message: "프로젝트를 찾을 수 없습니다", details: null } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { auth } = fakeAuth();

    const client = createApiClient(env, auth);
    await expect(client.request("GET", "/projects/x")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "프로젝트를 찾을 수 없습니다",
    });
  });
});
