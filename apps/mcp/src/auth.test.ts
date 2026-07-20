import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthManager } from "./auth.js";
import type { Env } from "./env.js";

const env: Env = {
  MARKFLOW_API_BASE: "https://api.test",
  MARKFLOW_WS_URL: "https://api.test",
  MARKFLOW_BOT_EMAIL: "bot@example.com",
  MARKFLOW_BOT_PASSWORD: "s3cr3t-pass",
};

const fakeUser = { id: "11111111-1111-1111-1111-111111111111", email: env.MARKFLOW_BOT_EMAIL, name: "Bot" };

function jsonResponse(status: number, body: unknown, setCookies: string[] = []): Response {
  const headers = new Headers();
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthManager", () => {
  it("① login 응답의 Set-Cookie에서 refresh_token을 파싱해 보관하고, refresh 요청 시 Cookie 헤더로 재전송한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "at-1", user: fakeUser }, ["refresh_token=rt-abc; HttpOnly; Path=/"]),
      )
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: "at-2" }, ["refresh_token=rt-abc; HttpOnly; Path=/"]));
    vi.stubGlobal("fetch", fetchMock);

    const auth = new AuthManager(env);
    await auth.ensureToken();
    await auth.handleUnauthorized();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshUrl).toBe(`${env.MARKFLOW_API_BASE}/auth/refresh`);
    expect((refreshInit.headers as Record<string, string>).Cookie).toBe("refresh_token=rt-abc");
  });

  it("③ refresh가 409면 login으로 폴백해 새 토큰을 발급한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "at-1", user: fakeUser }, ["refresh_token=rt-1"]),
      )
      .mockResolvedValueOnce(
        jsonResponse(409, { error: { code: "CONFLICT", message: "다른 기기에서 로그인되어 세션이 만료되었습니다.", details: null } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "at-2", user: fakeUser }, ["refresh_token=rt-2"]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const auth = new AuthManager(env);
    await auth.ensureToken();
    const token = await auth.handleUnauthorized();

    expect(token).toBe("at-2");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(`${env.MARKFLOW_API_BASE}/auth/login`);
  });

  it("④ refresh·login이 모두 실패하면 AUTH_FAILED로 끝나고 더 재시도하지 않는다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "at-1", user: fakeUser }, ["refresh_token=rt-1"]),
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "expired", details: null } }))
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "invalid credentials", details: null } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const auth = new AuthManager(env);
    await auth.ensureToken();

    await expect(auth.handleUnauthorized()).rejects.toMatchObject({ code: "AUTH_FAILED" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("⑤ 인증 실패 에러 메시지에 비밀번호·토큰 값이 노출되지 않는다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "at-1", user: fakeUser }, ["refresh_token=rt-1"]),
      )
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "expired", details: null } }))
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "invalid credentials", details: null } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const auth = new AuthManager(env);
    await auth.ensureToken();

    try {
      await auth.handleUnauthorized();
      expect.unreachable("모든 복구 경로가 실패하면 던져야 한다");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(env.MARKFLOW_BOT_PASSWORD);
      expect(message).not.toContain("at-1");
      expect(message).not.toContain("rt-1");
    }
  });

  it("⑦ 동시에 호출된 handleUnauthorized 2건은 refresh 요청을 1회만 보낸다", async () => {
    let resolveRefresh!: (res: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "at-1", user: fakeUser }, ["refresh_token=rt-1"]),
      )
      .mockImplementationOnce(() => pendingRefresh);
    vi.stubGlobal("fetch", fetchMock);

    const auth = new AuthManager(env);
    await auth.ensureToken();

    const p1 = auth.handleUnauthorized();
    const p2 = auth.handleUnauthorized();
    resolveRefresh(jsonResponse(200, { accessToken: "at-2" }, ["refresh_token=rt-1"]));

    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe("at-2");
    expect(t2).toBe("at-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
