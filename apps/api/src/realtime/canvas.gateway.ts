// CanvasGateway — 룸 조인 + 초기 스냅샷(sync:join → sync:init) + 프레즌스 broadcast.
// node:/edge:/cursor:/lock: 이벤트는 BE-3.2/3.3 범위 — 여기서 다루지 않는다.
// 얇게 유지: 권한 검사(CanvasService 재사용)+zod 검증+룸 중계/스냅샷만. DB 쓰기 없음.
import { Inject, Injectable, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS, SocketPayloadSchemas, roomOf } from "@markflow/shared";
import { env } from "../config/env.js";
import { AppException } from "../common/app.exception.js";
import { CanvasService } from "../modules/canvas/canvas.service.js";
import { PresenceService } from "./presence.js";
import { WsJwtGuard } from "./ws-jwt.guard.js";

// Nest는 @SubscribeMessage 핸들러의 리턴값을 클라이언트가 emit에 넘긴 ack 콜백으로
// 자동 전달한다(ack 없으면 무시됨) — 별도 @Ack() 파라미터 불필요.
type AckResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: { code: string; message: string } };

@WebSocketGateway({
  cors: {
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((o) => o.trim()) : true,
    credentials: true,
  },
})
@Injectable()
export class CanvasGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // JWT 검증 자체는 WsJwtGuard가 담당(handshake 미들웨어 + canActivate 방어) — 여기선 재사용만.
  // esbuild/vitest 런타임에선 emitDecoratorMetadata가 신뢰할 수 없어 암시적 타입 기반 DI가
  // 조용히 실패할 수 있다(app.module.ts의 JwtAuthGuard useFactory와 동일 이유) — @Inject로 명시.
  constructor(
    @Inject(WsJwtGuard) private readonly wsJwtGuard: WsJwtGuard,
    @Inject(CanvasService) private readonly canvasService: CanvasService,
    @Inject(PresenceService) private readonly presenceService: PresenceService,
  ) {}

  afterInit(server: Server): void {
    const guard = this.wsJwtGuard;
    server.use((socket: Socket, next: (err?: Error) => void) => {
      guard
        .verifyHandshake(socket)
        .then(() => next())
        .catch(() => next(new Error("UNAUTHORIZED")));
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.syncJoin)
  async handleSyncJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.syncJoin].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }

    const { projectId } = parsed.data;
    const userId = socket.data.userId as string;

    let snapshot;
    try {
      snapshot = await this.canvasService.getCanvas(projectId, userId);
    } catch (err) {
      const code = err instanceof AppException ? err.code : "FORBIDDEN";
      const message = err instanceof Error ? err.message : "권한이 없습니다";
      return { ok: false, error: { code, message } };
    }

    await socket.join(roomOf(projectId));
    socket.emit(SOCKET_EVENTS.syncInit, snapshot);

    const name = (socket.data.email as string | undefined) ?? userId;
    this.presenceService.add(projectId, socket.id, { id: userId, name });
    this.server
      .to(roomOf(projectId))
      .emit(SOCKET_EVENTS.presenceUpdate, { users: this.presenceService.list(projectId) });

    return { ok: true, data: snapshot };
  }

  handleDisconnect(socket: Socket): void {
    const affectedProjectIds = this.presenceService.removeSocketFromAll(socket.id);
    for (const projectId of affectedProjectIds) {
      this.server
        .to(roomOf(projectId))
        .emit(SOCKET_EVENTS.presenceUpdate, { users: this.presenceService.list(projectId) });
    }
  }
}
