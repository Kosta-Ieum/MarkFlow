// CanvasGateway 통합 테스트 — 실제 HTTP+Socket.io 서버를 임시 포트에 띄우고
// socket.io-client로 접속해서 handshake 인증 + sync:join/sync:init + presence:update를 검증한다.
// PrismaService는 mock으로 대체 — 실제 DB 연결 없음(결정적, 독립 실행).
import "reflect-metadata";
import { AddressInfo } from "node:net";
import { INestApplication } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { SOCKET_EVENTS, type CanvasSnapshot } from "@markflow/shared";
import { io, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { RealtimeModule } from "./realtime.module.js";
import { EventsModule } from "../common/events/events.module.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_USER_ID = "22222222-2222-4222-8222-222222222222";
const NON_MEMBER_USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_MEMBER_USER_ID = "44444444-4444-4444-8444-444444444444";
const JWT_SECRET_KEY = process.env.JWT_SECRET ?? "test-jwt-secret-key-123";

function makeMockPrisma() {
  return {
    projectMember: {
      findUnique: vi.fn(
        async ({ where }: { where: { projectId_userId: { projectId: string; userId: string } } }) => {
          const { userId } = where.projectId_userId;
          if (userId === MEMBER_USER_ID || userId === OTHER_MEMBER_USER_ID) {
            return { role: "EDITOR" as const };
          }
          return null;
        },
      ),
    },
    project: {
      findUnique: vi.fn(async () => ({
        id: PROJECT_ID,
        name: "Test Project",
        members: [{ role: "EDITOR" as const }],
        nodes: [],
        edges: [],
      })),
    },
    user: {
      findUnique: vi.fn(async () => ({
        name: "Test User",
        nickname: "testnick",
      })),
    },
  };
}

describe("CanvasGateway (BE-3.1 sync:join/sync:init/presence)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwt: JwtService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    mockPrisma = makeMockPrisma();

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          global: true,
          secret: JWT_SECRET_KEY,
          signOptions: { expiresIn: "1h" },
        }),
        EventsModule,
        RealtimeModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) {
      client.close();
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  function connect(token?: string): ClientSocket {
    const client = io(baseUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: token ? { token } : {},
      reconnection: false,
    });
    clients.push(client);
    return client;
  }

  function waitForConnectError(client: ClientSocket): Promise<Error> {
    return new Promise((resolve) => {
      client.on("connect_error", (err) => { resolve(err); });
    });
  }

  function waitForConnect(client: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      client.on("connect", () => { resolve(); });
      client.on("connect_error", (err: unknown) => { reject(err instanceof Error ? err : new Error(String(err))); });
    });
  }

  it("토큰 없이 연결하면 connect_error가 발생한다", async () => {
    const client = connect(undefined);
    const errorPromise = waitForConnectError(client);
    client.connect();
    const err = await errorPromise;
    expect(err).toBeInstanceOf(Error);
  });

  it("위조/만료 토큰으로 연결하면 connect_error가 발생한다", async () => {
    const forged = new JwtService({ secret: "wrong-secret" }).sign({
      sub: MEMBER_USER_ID,
      email: "member@example.com",
    });
    const client = connect(forged);
    const errorPromise = waitForConnectError(client);
    client.connect();
    const err = await errorPromise;
    expect(err).toBeInstanceOf(Error);
  });

  it("유효 토큰 + sync:join → sync:init으로 CanvasSnapshot을 수신하고 ack도 ok:true", async () => {
    const token = jwt.sign({ sub: MEMBER_USER_ID, email: "member@example.com" });
    const client = connect(token);
    client.connect();
    await waitForConnect(client);

    const syncInitPromise = new Promise<CanvasSnapshot>((resolve) => {
      client.on(SOCKET_EVENTS.syncInit, (snapshot: CanvasSnapshot) => { resolve(snapshot); });
    });

    const ack = await new Promise<{ ok: boolean }>((resolve) => {
      client.emit(SOCKET_EVENTS.syncJoin, { projectId: PROJECT_ID }, resolve);
    });

    const snapshot = await syncInitPromise;

    expect(ack.ok).toBe(true);
    expect(snapshot.project.id).toBe(PROJECT_ID);
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.edges).toEqual([]);
  });

  it("비멤버가 sync:join하면 ack가 ok:false를 반환한다", async () => {
    const token = jwt.sign({ sub: NON_MEMBER_USER_ID, email: "outsider@example.com" });
    const client = connect(token);
    client.connect();
    await waitForConnect(client);

    const ack = await new Promise<{ ok: boolean }>((resolve) => {
      client.emit(SOCKET_EVENTS.syncJoin, { projectId: PROJECT_ID }, resolve);
    });

    expect(ack.ok).toBe(false);
  });

  it("두 번째 소켓이 같은 프로젝트에 join하면 첫 번째 소켓이 presence:update(2명)를 받는다", async () => {
    const tokenA = jwt.sign({ sub: MEMBER_USER_ID, email: "a@example.com" });
    const tokenB = jwt.sign({ sub: OTHER_MEMBER_USER_ID, email: "b@example.com" });

    const clientA = connect(tokenA);
    clientA.connect();
    await waitForConnect(clientA);

    await new Promise<{ ok: boolean }>((resolve) => {
      clientA.emit(SOCKET_EVENTS.syncJoin, { projectId: PROJECT_ID }, resolve);
    });

    const presenceUpdatePromise = new Promise<{ users: { id: string; name: string }[] }>((resolve) => {
      clientA.on(SOCKET_EVENTS.presenceUpdate, (payload) => { resolve(payload); });
    });

    const clientB = connect(tokenB);
    clientB.connect();
    await waitForConnect(clientB);
    await new Promise<{ ok: boolean }>((resolve) => {
      clientB.emit(SOCKET_EVENTS.syncJoin, { projectId: PROJECT_ID }, resolve);
    });

    const presenceUpdate = await presenceUpdatePromise;
    expect(presenceUpdate.users).toHaveLength(2);
  });

  it("잘못된 페이로드(Zod 스키마 불일치) 전송 시 ack가 VALIDATION_ERROR를 반환한다", async () => {
    const token = jwt.sign({ sub: MEMBER_USER_ID, email: "member@example.com" });
    const client = connect(token);
    client.connect();
    await waitForConnect(client);

    const ack = await new Promise<{ ok: boolean; error?: any }>((resolve) => {
      // projectId가 uuid가 아닌 잘못된 값을 보냄
      client.emit(SOCKET_EVENTS.syncJoin, { projectId: "invalid-uuid" }, resolve);
    });

    expect(ack.ok).toBe(false);
    expect(ack.error).toBeDefined();
    expect(ack.error.code).toBe("VALIDATION_ERROR");
    expect(ack.error.message).toContain("projectId");
  });
});
