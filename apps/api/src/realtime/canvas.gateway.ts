// CanvasGateway — 룸 조인 + 초기 스냅샷(sync:join → sync:init) + 프레즌스 broadcast.
// BE-3.2: 노드/엣지 동기화, 커서, 락 실시간 중계 추가.
// 얇게 유지: 권한 검사(CanvasService 재사용)+zod 검증+룸 중계/스냅샷만. DB 쓰기 없음.
import { Inject, Injectable, UseGuards, UseFilters } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { OnModuleInit } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS, roomOf } from "@markflow/shared";
import { env } from "../config/env.js";
import { CanvasService } from "../modules/canvas/canvas.service.js";
import { ChatService } from "../modules/chat/chat.service.js";
import { NodeService } from "../modules/nodes/node.service.js";
import type { NodeCreateRequest, NodeUpdateRequest } from "../modules/nodes/node.dto.js";
import { EdgeService } from "../modules/edges/edge.service.js";
import type { EdgeCreateRequest } from "../modules/edges/edge.dto.js";
import { PresenceService } from "./presence.js";
import { WsJwtGuard } from "./ws-jwt.guard.js";
import { SubscribeWithValidation } from "./decorators.js";
import { WsExceptionAckFilter } from "../common/filters/ws-exception.filter.js";
import { ProjectEventsService } from "../common/events/project-events.service.js";
import { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception.js";

type AckResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: { code: string; message: string } };

@WebSocketGateway({
  cors: {
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((o) => o.trim()) : true,
    credentials: true,
  },
})
@UseFilters(new WsExceptionAckFilter())
@Injectable()
export class CanvasGateway implements OnGatewayInit, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(WsJwtGuard) private readonly wsJwtGuard: WsJwtGuard,
    @Inject(CanvasService) private readonly canvasService: CanvasService,
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(NodeService) private readonly nodeService: NodeService,
    @Inject(EdgeService) private readonly edgeService: EdgeService,
    @Inject(PresenceService) private readonly presenceService: PresenceService,
    @Inject(ProjectEventsService) private readonly events: ProjectEventsService,
  ) {}

  afterInit(server: Server): void {
    const guard = this.wsJwtGuard;
    server.use((socket: Socket, next: (err?: Error) => void) => {
      guard
        .verifyHandshake(socket)
        .then(() => { next(); })
        .catch(() => { next(new Error("UNAUTHORIZED")); });
    });
  }

  onModuleInit() {
    this.events.events$.subscribe(async (event) => {
      if (event.type === "USER_LOGGED_OUT") {
        const targetUserId = event.payload.userId;
        const sockets = await this.server.fetchSockets();
        for (const s of sockets) {
          if (s.data.userId === targetUserId) {
            const { affectedProjects, releasedLocks } = this.presenceService.removeSocketFromAll(s.id);
            for (const pId of affectedProjects) {
              this.server.to(roomOf(pId)).emit(SOCKET_EVENTS.presenceUpdate, { users: this.presenceService.list(pId) });
            }
            for (const lock of releasedLocks) {
              this.server.to(roomOf(lock.projectId)).emit(SOCKET_EVENTS.lockUpdate, { nodeId: lock.nodeId, userId: null });
            }
            s.disconnect(true);
          }
        }
        return;
      }

      if (!event.projectId) return;
      const room = roomOf(event.projectId);

      if (event.type === "NODE_RESTORED") {
        this.broadcastExcept(room, event.triggerUserId, SOCKET_EVENTS.nodeAdd, {
          projectId: event.projectId,
          node: event.payload.node,
        });
      } else if (event.type === "NODE_DELETED") {
        this.broadcastExcept(room, event.triggerUserId, SOCKET_EVENTS.nodeDelete, {
          projectId: event.projectId,
          nodeId: event.payload.nodeId,
        });
      } else if (event.type === "NODE_PURGED") {
        this.broadcastExcept(room, event.triggerUserId, SOCKET_EVENTS.nodeDelete, {
          projectId: event.projectId,
          nodeId: event.payload.nodeId,
        });
      } else if (event.type === "MEMBER_REMOVED" || event.type === "MEMBER_ROLE_CHANGED") {
        // Find the user's socket and kick them / release their locks
        const sockets = await this.server.in(room).fetchSockets();
        const targetUserId = event.payload.userId;


        for (const s of sockets) {
          if (s.data.userId === targetUserId) {
            if (event.type === "MEMBER_REMOVED" || event.type === "MEMBER_ROLE_CHANGED") {
              // Release all locks held by this socket
              const { releasedLocks } = this.presenceService.removeSocketFromAll(s.id);
              for (const lock of releasedLocks) {
                this.server.to(roomOf(lock.projectId)).emit(SOCKET_EVENTS.lockUpdate, { nodeId: lock.nodeId, userId: null });
              }
              // If removed or downgraded to VIEWER, force kick them from the socket room
              s.leave(room);
              s.disconnect(true);
            }
          }
        }
      }
    });
  }

  private async broadcastExcept(room: string, excludeUserId: string | undefined, event: string, payload: any) {
    const sockets = await this.server.in(room).fetchSockets();
    for (const s of sockets) {
      if (s.data.userId !== excludeUserId) {
        s.emit(event, payload);
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.syncJoin)
  async handleSyncJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: any,
  ): Promise<AckResponse> {
    const { projectId } = body;
    const userId = socket.data.userId as string;

    const snapshot = await this.canvasService.getCanvas(projectId, userId);

    await socket.join(roomOf(projectId));
    socket.emit(SOCKET_EVENTS.syncInit, snapshot);

    const name = (socket.data.name as string | undefined) ?? (socket.data.email as string | undefined) ?? userId;
    const nickname = socket.data.nickname as string | null | undefined;
    
    this.presenceService.add(projectId, socket.id, { id: userId, name, nickname });
    this.server
      .to(roomOf(projectId))
      .emit(SOCKET_EVENTS.presenceUpdate, { users: this.presenceService.list(projectId) });

    const locks = this.presenceService.listLocks(projectId);
    socket.emit(SOCKET_EVENTS.lockUpdate, { projectId, locks });

    return { ok: true, data: snapshot };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.nodeAdd)
  async handleNodeAdd(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, node } = body;
    const userId = socket.data.userId as string;

    const dto: NodeCreateRequest = {
      title: node.title,
      markdown: node.markdown,
      type: node.type,
      position: node.position,
    };

    try {
      const created = await this.nodeService.create(projectId, userId, dto, node.id);
      socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.nodeAdd, { projectId, node: created });
      return { ok: true, data: { node: created } };
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw AppException.conflict("이미 존재하는 노드입니다.");
      }
      throw e;
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.nodeUpdate)
  async handleNodeUpdate(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, node } = body;
    const userId = socket.data.userId as string;

    const dto: NodeUpdateRequest = {
      ...(node.title !== undefined && { title: node.title }),
      ...(node.markdown !== undefined && { markdown: node.markdown }),
      ...(node.type !== undefined && { type: node.type }),
      ...(node.collapsed !== undefined && { collapsed: node.collapsed }),
      ...(node.position !== undefined && { position: node.position }),
    };

    const updated = await this.nodeService.update(projectId, userId, node.id, dto);
    socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.nodeUpdate, { projectId, node: updated });
    return { ok: true, data: { node: updated } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.nodeDelete)
  async handleNodeDelete(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, nodeId } = body;
    const userId = socket.data.userId as string;

    const result = await this.nodeService.softDelete(projectId, userId, nodeId);
    socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.nodeDelete, { projectId, nodeId: result.id });
    return { ok: true, data: result };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.edgeAdd)
  async handleEdgeAdd(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, edge } = body;
    const userId = socket.data.userId as string;

    const dto: EdgeCreateRequest = { source: edge.source, target: edge.target };

    const created = await this.edgeService.createEdge(projectId, userId, dto);
    socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.edgeAdd, { projectId, edge: created });
    return { ok: true, data: { edge: created } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.edgeDelete)
  async handleEdgeDelete(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, edgeId } = body;
    const userId = socket.data.userId as string;

    const result = await this.edgeService.deleteEdge(projectId, userId, edgeId);
    socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.edgeDelete, { projectId, edgeId: result.id });
    return { ok: true, data: result };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.cursorMove)
  async handleCursorMove(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    socket.to(roomOf(body.projectId)).emit(SOCKET_EVENTS.cursorMove, body);
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.lockAcquire)
  async handleLockAcquire(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, nodeId } = body;
    const userId = socket.data.userId as string;

    await this.canvasService.assertEditorPermission(projectId, userId);

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
  @SubscribeWithValidation(SOCKET_EVENTS.lockRelease)
  async handleLockRelease(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, nodeId } = body;
    const userId = socket.data.userId as string;

    await this.canvasService.assertEditorPermission(projectId, userId);

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
  @SubscribeWithValidation(SOCKET_EVENTS.chatMessage)
  async handleChatMessage(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId, content } = body;
    const userId = socket.data.userId as string;

    const message = await this.chatService.sendMessage(projectId, userId, content);
    this.server.to(roomOf(projectId)).emit(SOCKET_EVENTS.chatNew, { projectId, message });
    return { ok: true, data: message };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.chatTyping)
  async handleChatTyping(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId } = body;
    socket.to(roomOf(projectId)).emit(SOCKET_EVENTS.chatTyping, { projectId, userId: socket.data.userId });
    return { ok: true };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeWithValidation(SOCKET_EVENTS.syncResync)
  async handleSyncResync(@ConnectedSocket() socket: Socket, @MessageBody() body: any): Promise<AckResponse> {
    const { projectId } = body;
    const userId = socket.data.userId as string;

    const snapshot = await this.canvasService.getCanvas(projectId, userId);
    return { ok: true, data: snapshot };
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
