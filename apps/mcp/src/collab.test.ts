import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOCKET_EVENTS } from "@markflow/shared";
import { SocketManager } from "./collab.js";
import type { Env } from "./env.js";

// socket.io-client의 io를 fake로 대체 — 실제 네트워크 없이 접속/ack/disconnect를 제어한다.
// vi.mock은 vitest가 import 위로 hoist하므로 정적 import(위)도 이 mock을 받는다.
const { ioMock } = vi.hoisted(() => ({ ioMock: vi.fn() }));
vi.mock("socket.io-client", () => ({ io: ioMock }));

const ACK_TIMEOUT_MS = 5_000; // collab.ts와 동일 값 — ② 타임아웃 테스트용.

type Listener = (...args: unknown[]) => void;

/** EventEmitter류 최소 fake 소켓 — on/off/emit(ack)/disconnect + 테스트용 fire. */
class FakeSocket {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly sent: Array<{ event: string; payload: unknown; ack?: Listener }> = [];
  disconnectCount = 0;

  constructor(
    readonly url: string,
    readonly opts: { auth?: { token?: string } },
  ) {}

  on(event: string, cb: Listener): this {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(cb);
    return this;
  }

  off(event: string, cb: Listener): this {
    this.listeners.get(event)?.delete(cb);
    return this;
  }

  // 앱 레벨 송신(sync:join, node:add ...) — 마지막 인자가 함수면 ack 콜백으로 보관.
  emit(event: string, ...args: unknown[]): this {
    const last = args[args.length - 1];
    const ack = typeof last === "function" ? (last as Listener) : undefined;
    this.sent.push({ event, payload: args[0], ack });
    return this;
  }

  disconnect(): this {
    this.disconnectCount += 1;
    this.fire("disconnect", "io client disconnect");
    return this;
  }

  fire(event: string, ...args: unknown[]): void {
    for (const cb of [...(this.listeners.get(event) ?? [])]) cb(...args);
  }
}

const env: Env = {
  MARKFLOW_API_BASE: "https://api.test",
  MARKFLOW_WS_URL: "https://ws.test",
  MARKFLOW_BOT_EMAIL: "bot@example.com",
  MARKFLOW_BOT_PASSWORD: "s3cr3t",
};

const PID = "11111111-1111-1111-1111-111111111111";

// 마이크로태스크 큐를 비운다(fake timer 하에서도 Promise 마이크로태스크는 그대로 흐른다).
async function flushMicro(times = 12): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

let sockets: FakeSocket[];
let auth: { ensureToken: ReturnType<typeof vi.fn> };

beforeEach(() => {
  sockets = [];
  ioMock.mockReset();
  ioMock.mockImplementation((url: string, opts: { auth?: { token?: string } }) => {
    const socket = new FakeSocket(url, opts);
    sockets.push(socket);
    return socket;
  });
  auth = { ensureToken: vi.fn().mockResolvedValue("token-1") };
});

afterEach(() => {
  vi.useRealTimers();
});

/** ensureJoined를 접속·ack 성공까지 몰아준다(테스트 헬퍼). 사용된 소켓을 반환. */
async function joinOk(manager: InstanceType<typeof SocketManager>): Promise<FakeSocket> {
  const promise = manager.ensureJoined(PID);
  await flushMicro();
  const socket = sockets[sockets.length - 1];
  socket.fire("connect");
  await flushMicro();
  socket.sent[socket.sent.length - 1].ack?.({ ok: true, data: { nodes: [], edges: [] } });
  await promise;
  return socket;
}

describe("SocketManager", () => {
  it("① 같은 projectId로 ensureJoined를 2번 호출해도 sync:join emit은 1번만 나간다", async () => {
    const manager = new SocketManager(env, auth);
    const socket = await joinOk(manager);

    const joinEmits = socket.sent.filter((s) => s.event === SOCKET_EVENTS.syncJoin);
    expect(joinEmits).toHaveLength(1);

    await manager.ensureJoined(PID); // 이미 joined → no-op
    expect(socket.sent.filter((s) => s.event === SOCKET_EVENTS.syncJoin)).toHaveLength(1);
    expect(sockets).toHaveLength(1); // 소켓 재생성 없음
  });

  it("② ack가 5초 내 없으면 TIMEOUT McpToolError로 실패한다", async () => {
    vi.useFakeTimers();
    const manager = new SocketManager(env, auth);
    const promise = manager.ensureJoined(PID);
    void promise.catch(() => {}); // unhandled rejection 방지
    await flushMicro();
    const socket = sockets[0];
    socket.fire("connect");
    await flushMicro();
    expect(socket.sent[0].event).toBe(SOCKET_EVENTS.syncJoin);

    await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("③ ack가 {ok:false}면 서버 error.code를 보존한 McpToolError로 매핑한다", async () => {
    const manager = new SocketManager(env, auth);
    const promise = manager.ensureJoined(PID);
    void promise.catch(() => {});
    await flushMicro();
    const socket = sockets[0];
    socket.fire("connect");
    await flushMicro();
    socket.sent[0].ack?.({ ok: false, error: { code: "FORBIDDEN", message: "권한 없음" } });

    await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
    // join 실패 → joined 미등록 → 다음 호출이 다시 emit
    const retry = manager.ensureJoined(PID);
    void retry.catch(() => {});
    await flushMicro();
    expect(socket.sent.filter((s) => s.event === SOCKET_EVENTS.syncJoin).length).toBeGreaterThan(1);
  });

  it("④ disconnect 이벤트 후 joined가 리셋되고 다음 ensureJoined가 새 소켓으로 재접속·재join한다", async () => {
    const manager = new SocketManager(env, auth);
    const s1 = await joinOk(manager);

    s1.fire("disconnect", "io server disconnect"); // 서버 강제 종료

    const s2 = await joinOk(manager);
    expect(sockets).toHaveLength(2);
    expect(s2).not.toBe(s1);
    expect(s2.sent.filter((s) => s.event === SOCKET_EVENTS.syncJoin)).toHaveLength(1);
  });

  it("⑤ onTokenRenewed는 기존 소켓을 끊고, 다음 ensureJoined는 새 토큰으로 io()를 재호출한다", async () => {
    auth.ensureToken.mockReset();
    auth.ensureToken.mockResolvedValueOnce("token-1").mockResolvedValueOnce("token-2");
    const manager = new SocketManager(env, auth);
    const s1 = await joinOk(manager);
    expect((ioMock.mock.calls[0][1] as { auth: { token: string } }).auth.token).toBe("token-1");

    manager.onTokenRenewed();
    expect(s1.disconnectCount).toBe(1);

    const s2 = await joinOk(manager);
    expect(sockets).toHaveLength(2);
    expect((ioMock.mock.calls[1][1] as { auth: { token: string } }).auth.token).toBe("token-2");
    expect(s2.sent.filter((s) => s.event === SOCKET_EVENTS.syncJoin)).toHaveLength(1);
  });

  it("⑥ connect_error 발생 시 SOCKET_CONNECT 에러로 명확히 실패한다", async () => {
    const manager = new SocketManager(env, auth);
    const promise = manager.ensureJoined(PID);
    void promise.catch(() => {});
    await flushMicro();
    sockets[0].fire("connect_error", new Error("handshake 거부"));

    await expect(promise).rejects.toMatchObject({ code: "SOCKET_CONNECT" });
  });

  it("emitWithAck는 ok면 data를 반환하고, targetId와 함께 ok:false는 코드 보존해 throw한다", async () => {
    const manager = new SocketManager(env, auth);
    await joinOk(manager);
    const socket = sockets[0];

    const p = manager.emitWithAck(SOCKET_EVENTS.nodeAdd, { projectId: PID, node: {} }, "node-1");
    const addEmit = socket.sent[socket.sent.length - 1];
    expect(addEmit.event).toBe(SOCKET_EVENTS.nodeAdd);
    addEmit.ack?.({ ok: true, data: { node: { id: "node-1" } } });
    await expect(p).resolves.toEqual({ node: { id: "node-1" } });

    const p2 = manager.emitWithAck(SOCKET_EVENTS.nodeUpdate, { projectId: PID }, "node-9");
    void p2.catch(() => {});
    socket.sent[socket.sent.length - 1].ack?.({ ok: false, error: { code: "NOT_FOUND", message: "없음" } });
    await expect(p2).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
