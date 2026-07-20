// SocketManager — 소켓 접속/재접속, 프로젝트별 sync:join(1회), ack 기반 emit 관리. (R5.1~R5.3)
// FE와 동일 접속 방식(apps/web/src/collab/useSocketCollab.ts): auth:{token}·transports:["websocket"].
// 편집은 이 매니저를 통해 FE와 같은 소켓 경로로 나간다(T5 write 툴이 사용).
import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@markflow/shared";
import type { Env } from "./env.js";
import { mapAckError, McpToolError } from "./errors.js";

// 소켓 ack 응답 형태 — shared에 없어 로컬 정의(출처: apps/api/src/realtime/canvas.gateway.ts:31-33).
type AckResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: { code: string; message: string } };

/** SocketManager가 필요로 하는 토큰 공급 최소 계약(AuthManager가 구조적으로 만족). */
export interface TokenProvider {
  ensureToken(): Promise<string>;
}

const CONNECT_TIMEOUT_MS = 5_000;
const ACK_TIMEOUT_MS = 5_000;

/**
 * 소켓 1개를 lazy하게 관리한다. 자동 재접속은 끈다 — socket.io의 재접속은 생성 시점의 낡은
 * 토큰을 재사용해 인증 실패 루프를 만들 수 있어, 대신 disconnect 시 참조를 비우고 다음
 * ensureJoined에서 새 토큰으로 재접속한다(R5.3, design.md §2 제약 2 연쇄).
 */
export class SocketManager {
  private socket: Socket | null = null;
  private connecting: Promise<Socket> | null = null;
  private readonly joined = new Set<string>();
  private readonly joinInFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly env: Env,
    private readonly auth: TokenProvider,
  ) {}

  /**
   * 소켓이 연결돼 있고 해당 프로젝트 룸에 join된 상태를 보장한다(멱등).
   * 접속이 없으면 새로 붙고, 아직 join 안 했으면 sync:join ack로 확인한다.
   */
  async ensureJoined(projectId: string): Promise<void> {
    const socket = await this.ensureConnected();
    if (this.joined.has(projectId)) return;

    let pending = this.joinInFlight.get(projectId);
    if (!pending) {
      pending = this.join(socket, projectId).finally(() => {
        this.joinInFlight.delete(projectId);
      });
      this.joinInFlight.set(projectId, pending);
    }
    return pending;
  }

  /**
   * 편집 이벤트를 ack와 함께 보내고 결과 data를 반환한다. ack `{ok:false}`는 mapAckError로
   * 코드를 보존해 throw, 5초 무응답은 TIMEOUT. 호출 전 ensureJoined로 접속이 보장돼야 한다.
   */
  async emitWithAck(event: string, payload: unknown, targetId?: string): Promise<unknown> {
    const socket = this.socket;
    if (!socket) {
      throw new McpToolError("SOCKET", "소켓이 연결되어 있지 않습니다");
    }
    return this.emitAck(socket, event, payload, targetId);
  }

  /** 재로그인(AuthManager onLogin)으로 토큰이 갱신되면 호출 — 기존 소켓을 끊어 다음 접속이 새 토큰을 쓰게 한다. */
  onTokenRenewed(): void {
    const socket = this.socket;
    this.socket = null;
    this.joined.clear();
    socket?.disconnect();
  }

  /** 프로세스 종료용 정리. */
  close(): void {
    const socket = this.socket;
    this.socket = null;
    this.joined.clear();
    socket?.disconnect();
  }

  private async ensureConnected(): Promise<Socket> {
    if (this.connecting) return this.connecting;
    if (this.socket) return this.socket;
    this.connecting = this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect(): Promise<Socket> {
    const token = await this.auth.ensureToken();
    const socket = io(this.env.MARKFLOW_WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    socket.on("disconnect", () => this.handleDisconnect(socket));

    try {
      await this.waitForConnect(socket);
    } catch (err) {
      socket.disconnect();
      throw err;
    }
    this.socket = socket;
    return socket;
  }

  private waitForConnect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("connect", onConnect);
        socket.off("connect_error", onError);
      };
      const onConnect = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        const message = err instanceof Error ? err.message : String(err);
        reject(new McpToolError("SOCKET_CONNECT", `소켓 연결 실패: ${message}`));
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new McpToolError("TIMEOUT", "소켓 연결 시간 초과"));
      }, CONNECT_TIMEOUT_MS);
      socket.on("connect", onConnect);
      socket.on("connect_error", onError);
    });
  }

  private async join(socket: Socket, projectId: string): Promise<void> {
    // sync:join ack는 CanvasSnapshot을 data로 돌려주지만(canvas.gateway.ts:163) join 성공 확인만 필요.
    await this.emitAck(socket, SOCKET_EVENTS.syncJoin, { projectId }, projectId);
    this.joined.add(projectId);
  }

  private emitAck(
    socket: Socket,
    event: string,
    payload: unknown,
    targetId?: string,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new McpToolError("TIMEOUT", "서버 응답 없음(소켓)"));
      }, ACK_TIMEOUT_MS);
      socket.emit(event, payload, (ack: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          resolve(this.parseAck(ack, targetId));
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private parseAck(ack: unknown, targetId?: string): unknown {
    const res = ack as AckResponse | undefined;
    if (res && res.ok === true) return res.data;
    if (res && res.ok === false && res.error) {
      throw mapAckError(res.error, targetId);
    }
    throw new McpToolError("INTERNAL", "소켓 응답 형식이 올바르지 않습니다");
  }

  private handleDisconnect(socket: Socket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.joined.clear();
  }
}
