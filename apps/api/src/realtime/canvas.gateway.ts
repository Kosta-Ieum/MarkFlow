// CanvasGateway — 룸 조인 + 초기 스냅샷(sync:join → sync:init) + 프레즌스 broadcast.
// BE-3.2: 노드/엣지 동기화, 커서, 락 실시간 중계 추가.
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
import { ChatService } from "../modules/chat/chat.service.js";
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
    @Inject(ChatService) private readonly chatService: ChatService,
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

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.nodeAdd)
  async handleNodeAdd(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    return this.handleEditorEvent(socket, body, SOCKET_EVENTS.nodeAdd);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.nodeUpdate)
  async handleNodeUpdate(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    return this.handleEditorEvent(socket, body, SOCKET_EVENTS.nodeUpdate);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.nodeDelete)
  async handleNodeDelete(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    return this.handleEditorEvent(socket, body, SOCKET_EVENTS.nodeDelete);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.edgeAdd)
  async handleEdgeAdd(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    return this.handleEditorEvent(socket, body, SOCKET_EVENTS.edgeAdd);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.edgeDelete)
  async handleEdgeDelete(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    return this.handleEditorEvent(socket, body, SOCKET_EVENTS.edgeDelete);
  }

  private async handleEditorEvent(socket: Socket, body: unknown, event: string): Promise<AckResponse> {
    // @ts-expect-error 동적 스키마 참조
    const parsed = SocketPayloadSchemas[event].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }

    const payload = parsed.data as { projectId: string };
    const userId = socket.data.userId as string;

    try {
      await this.canvasService.assertEditorPermission(payload.projectId, userId);
    } catch (err) {
      const code = err instanceof AppException ? err.code : "FORBIDDEN";
      const message = err instanceof Error ? err.message : "권한이 없습니다";
      return { ok: false, error: { code, message } };
    }

    socket.to(roomOf(payload.projectId)).emit(event, payload);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.cursorMove)
  async handleCursorMove(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.cursorMove].safeParse(body);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };

    // 커서는 권한(EDITOR) 불필요, VIEWER도 발송 가능
    socket.to(roomOf(parsed.data.projectId)).emit(SOCKET_EVENTS.cursorMove, parsed.data);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.lockAcquire)
  async handleLockAcquire(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.lockAcquire].safeParse(body);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };

    const { projectId, nodeId } = parsed.data;
    const userId = socket.data.userId as string;

    try {
      await this.canvasService.assertEditorPermission(projectId, userId);
    } catch (err) {
      return { ok: false, error: { code: "FORBIDDEN", message: "권한 없음" } };
    }

    const acquired = this.presenceService.acquireLock(projectId, nodeId, socket.id, userId);
    if (acquired) {
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.lockUpdate, { nodeId, userId });
    }
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.lockRelease)
  async handleLockRelease(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.lockRelease].safeParse(body);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };

    const { projectId, nodeId } = parsed.data;
    const userId = socket.data.userId as string;

    try {
      await this.canvasService.assertEditorPermission(projectId, userId);
    } catch (err) {
      return { ok: false, error: { code: "FORBIDDEN", message: "권한 없음" } };
    }

    const released = this.presenceService.releaseLock(projectId, nodeId, socket.id);
    if (released) {
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.lockUpdate, { nodeId, userId: null });
    }
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.chatMessage)
  async handleChatMessage(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.chatMessage].safeParse(body);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };

    const { projectId, content } = parsed.data;
    const userId = socket.data.userId as string;

    try {
      const message = await this.chatService.sendMessage(projectId, userId, content);
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.chatNew, { projectId, message });
      return { ok: true, data: message };
    } catch (err) {
      return { ok: false, error: { code: "FORBIDDEN", message: "권한 없음" } };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.chatTyping)
  async handleChatTyping(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.chatTyping].safeParse(body);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };

    const { projectId } = parsed.data;
    
    // 타자 중 상태는 권한 무관하게 룸 전체에 단순 중계
    socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.chatTyping, { projectId, userId: socket.data.userId });
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.syncResync)
  async handleSyncResync(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.syncResync].safeParse(body);
    if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };

    const { projectId } = parsed.data;
    const userId = socket.data.userId as string;

    try {
      // 재접속 시 전체 스냅샷 반환 (sync:join 과 동일 로직)
      const snapshot = await this.canvasService.getCanvas(projectId, userId);
      return { ok: true, data: snapshot };
    } catch (err) {
      return { ok: false, error: { code: "FORBIDDEN", message: "권한 없음" } };
    }
  }

  handleDisconnect(socket: Socket): void {
    const { affectedProjects, releasedLocks } = this.presenceService.removeSocketFromAll(socket.id);
    
    for (const projectId of affectedProjects) {
      this.server
        .to(roomOf(projectId))
        .emit(SOCKET_EVENTS.presenceUpdate, { users: this.presenceService.list(projectId) });
    }

    for (const lock of releasedLocks) {
      this.server
        .to(roomOf(lock.projectId))
        .emit(SOCKET_EVENTS.lockUpdate, { nodeId: lock.nodeId, userId: null });
    }
  }
}
