import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { AppException } from "../../common/app.exception.js";
import type { NodeDTO, PurgeResponse } from "@markflow/shared";
import type {
  NodeCreateRequest,
  NodeUpdateRequest,
  NodeDeleteResponse,
  NodeRestoreResponse,
} from "./node.dto.js";
import { ProjectEventsService } from "../../common/events/project-events.service.js";

interface NodeRow {
  id: string;
  type: string;
  title: string;
  markdown: string;
  collapsed: boolean;
  posX: number;
  posY: number;
  updatedAt: Date;
}

function toNodeDTO(node: NodeRow): NodeDTO {
  return {
    id: node.id,
    type: node.type as NodeDTO["type"],
    title: node.title,
    markdown: node.markdown,
    collapsed: node.collapsed,
    position: { x: node.posX, y: node.posY },
    updatedAt: node.updatedAt.toISOString(),
  };
}

@Injectable()
export class NodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProjectEventsService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    dto: NodeCreateRequest,
    forcedId?: string,
  ): Promise<NodeDTO> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const node = await this.prisma.$transaction(async (tx) => {
      const created = await tx.node.create({
        data: {
          id: forcedId,
          projectId,
          title: dto.title,
          markdown: dto.markdown,
          type: dto.type,
          posX: dto.position.x,
          posY: dto.position.y,
        },
      });

      await tx.activityLog.create({
        data: {
          projectId,
          userId,
          targetType: "NODE",
          targetId: created.id,
          action: "CREATE",
        },
      });

      return created;
    });

    return toNodeDTO(node);
  }

  async update(
    projectId: string,
    userId: string,
    nodeId: string,
    dto: NodeUpdateRequest,
  ): Promise<NodeDTO> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const existing = await this.prisma.node.findFirst({
      where: { id: nodeId, projectId, deletedAt: null },
    });
    if (!existing) throw AppException.notFound("노드를 찾을 수 없습니다");

    const changedKeys = Object.keys(dto) as (keyof NodeUpdateRequest)[];
    if (changedKeys.length === 0) {
      return toNodeDTO(existing);
    }



    const node = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.node.update({
        where: { id: nodeId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.markdown !== undefined && { markdown: dto.markdown }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.collapsed !== undefined && { collapsed: dto.collapsed }),
          ...(dto.position !== undefined && {
            posX: dto.position.x,
            posY: dto.position.y,
          }),
        },
      });

      if (dto.markdown !== undefined) {
        // 1분 이내에 동일 유저가 동일 노드를 수정한 기록이 있다면 생략 (디바운싱)
        const recentLog = await tx.activityLog.findFirst({
          where: {
            projectId,
            userId,
            targetType: "NODE",
            targetId: nodeId,
            action: "UPDATE",
            createdAt: { gte: new Date(Date.now() - 60000) },
          },
        });

        if (!recentLog) {
          await tx.activityLog.create({
            data: {
              projectId,
              userId,
              targetType: "NODE",
              targetId: nodeId,
              action: "UPDATE",
            },
          });
        }
      }

      return updated;
    });

    return toNodeDTO(node);
  }

  async softDelete(
    projectId: string,
    userId: string,
    nodeId: string,
  ): Promise<NodeDeleteResponse> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const existing = await this.prisma.node.findFirst({
      where: { id: nodeId, projectId, deletedAt: null },
    });
    if (!existing) throw AppException.notFound("노드를 찾을 수 없습니다");

    const node = await this.prisma.$transaction(async (tx) => {
      await tx.edge.deleteMany({
        where: { OR: [{ sourceId: nodeId }, { targetId: nodeId }] },
      });

      const updated = await tx.node.update({
        where: { id: nodeId },
        data: { deletedAt: new Date() },
      });

      await tx.activityLog.create({
        data: {
          projectId,
          userId,
          targetType: "NODE",
          targetId: nodeId,
          action: "DELETE",
        },
      });

      return updated;
    });

    this.events.emit({
      projectId,
      type: "NODE_DELETED",
      payload: { nodeId: node.id },
    });

    return { id: node.id, deletedAt: node.deletedAt!.toISOString() };
  }

  async restore(
    projectId: string,
    userId: string,
    nodeId: string,
  ): Promise<NodeRestoreResponse> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const existing = await this.prisma.node.findFirst({
      where: { id: nodeId, projectId, deletedAt: { not: null } },
    });
    if (!existing) throw AppException.notFound("삭제된 노드를 찾을 수 없습니다");

    const node = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.node.update({
        where: { id: nodeId },
        data: { deletedAt: null },
      });

      await tx.activityLog.create({
        data: {
          projectId,
          userId,
          targetType: "NODE",
          targetId: nodeId,
          action: "RESTORE",
        },
      });

      return updated;
    });

    this.events.emit({
      projectId,
      type: "NODE_RESTORED",
      payload: { node: toNodeDTO(node) },
    });

    return { id: node.id, deletedAt: node.deletedAt?.toISOString() ?? null };
  }

  async purge(
    projectId: string,
    userId: string,
    nodeId: string,
  ): Promise<PurgeResponse> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const existing = await this.prisma.node.findFirst({
      where: { id: nodeId, projectId },
    });
    if (!existing) throw AppException.notFound("노드를 찾을 수 없습니다");
    if (!existing.deletedAt) {
      throw AppException.unprocessable("소프트 삭제된 노드만 영구 삭제할 수 있습니다");
    }

    // ActivityLog는 불변 보존 — targetId 댕글링 허용, 과거 로그는 지우지 않는다.
    await this.prisma.node.delete({ where: { id: nodeId } });

    this.events.emit({
      projectId,
      type: "NODE_PURGED",
      payload: { nodeId },
    });

    return { id: nodeId, purged: true };
  }
}
