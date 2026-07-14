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
import { NodeService } from "../modules/nodes/node.service.js";
import type { NodeCreateRequest, NodeUpdateRequest } from "../modules/nodes/node.dto.js";
import { EdgeService } from "../modules/edges/edge.service.js";
import type { EdgeCreateRequest } from "../modules/edges/edge.dto.js";
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
    @Inject(NodeService) private readonly nodeService: NodeService,
    @Inject(EdgeService) private readonly edgeService: EdgeService,
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

  // 노드/엣지 변경 이벤트: 권한 확인은 각 Service의 assertPermission(내부 1행)에서 수행된다.
  // 순서: 파싱 → service 호출(DB 저장 + ActivityLog, 실패 시 여기서 throw) → 성공 시에만 broadcast → ack.
  // broadcast payload는 항상 service가 반환한 저장 결과(서버 생성 id/updatedAt)를 사용한다
  // — 클라이언트가 보낸 값을 그대로 릴레이하지 않는다(.claude/rules/backend.md 서비스 seam).
  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.nodeAdd)
  async handleNodeAdd(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.nodeAdd].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }
    const { projectId, node } = parsed.data;
    const userId = socket.data.userId as string;

    const dto: NodeCreateRequest = {
      title: node.title,
      markdown: node.markdown,
      type: node.type,
      position: node.position,
    };

    try {
      const created = await this.nodeService.create(projectId, userId, dto);
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.nodeAdd, { projectId, node: created });
      return { ok: true, data: { node: created } };
    } catch (err) {
      return this.toErrorAck(err);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.nodeUpdate)
  async handleNodeUpdate(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.nodeUpdate].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }
    const { projectId, node } = parsed.data;
    const userId = socket.data.userId as string;

    const dto: NodeUpdateRequest = {
      ...(node.title !== undefined && { title: node.title }),
      ...(node.markdown !== undefined && { markdown: node.markdown }),
      ...(node.type !== undefined && { type: node.type }),
      ...(node.collapsed !== undefined && { collapsed: node.collapsed }),
      ...(node.position !== undefined && { position: node.position }),
    };

    try {
      const updated = await this.nodeService.update(projectId, userId, node.id, dto);
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.nodeUpdate, { projectId, node: updated });
      return { ok: true, data: { node: updated } };
    } catch (err) {
      return this.toErrorAck(err);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.nodeDelete)
  async handleNodeDelete(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.nodeDelete].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }
    const { projectId, nodeId } = parsed.data;
    const userId = socket.data.userId as string;

    try {
      const result = await this.nodeService.softDelete(projectId, userId, nodeId);
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.nodeDelete, { projectId, nodeId: result.id });
      return { ok: true, data: result };
    } catch (err) {
      return this.toErrorAck(err);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.edgeAdd)
  async handleEdgeAdd(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.edgeAdd].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }
    const { projectId, edge } = parsed.data;
    const userId = socket.data.userId as string;

    const dto: EdgeCreateRequest = { source: edge.source, target: edge.target };

    try {
      const created = await this.edgeService.createEdge(projectId, userId, dto);
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.edgeAdd, { projectId, edge: created });
      return { ok: true, data: { edge: created } };
    } catch (err) {
      return this.toErrorAck(err);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.edgeDelete)
  async handleEdgeDelete(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<AckResponse> {
    const parsed = SocketPayloadSchemas[SOCKET_EVENTS.edgeDelete].safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } };
    }
    const { projectId, edgeId } = parsed.data;
    const userId = socket.data.userId as string;

    try {
      const result = await this.edgeService.deleteEdge(projectId, userId, edgeId);
      this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.edgeDelete, { projectId, edgeId: result.id });
      return { ok: true, data: result };
    } catch (err) {
      return this.toErrorAck(err);
    }
  }

  private toErrorAck(err: unknown): AckResponse {
    const code = err instanceof AppException ? err.code : "FORBIDDEN";
    const message = err instanceof Error ? err.message : "권한이 없습니다";
    return { ok: false, error: { code, message } };
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
    if (!acquired) {
      const holder = this.presenceService.getLock(projectId, nodeId);
      return {
        ok: false,
        error: {
          code: "LOCK_HELD",
          message: holder ? `다른 사용자(${holder.userId})가 이미 편집 중입니다` : "이미 다른 사용자가 편집 중입니다",
        },
      };
    }

    this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.lockUpdate, { nodeId, userId });
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
    if (!released) {
      return {
        ok: false,
        error: { code: "LOCK_NOT_HELD", message: "이 소켓이 보유한 락이 아닙니다" },
      };
    }

    this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.lockUpdate, { nodeId, userId: null });
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
