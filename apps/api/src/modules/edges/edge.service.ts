import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { AppException } from "../../common/app.exception.js";
import type { EdgeDTO } from "@markflow/shared";
import type { EdgeCreateRequest, EdgeDeleteResponse } from "./edge.dto.js";

@Injectable()
export class EdgeService {
  constructor(private readonly prisma: PrismaService) {}

  async createEdge(
    projectId: string,
    userId: string,
    dto: EdgeCreateRequest,
    forceId?: string,
  ): Promise<EdgeDTO> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    if (dto.source === dto.target) {
      throw AppException.unprocessable("self-loop 엣지는 허용되지 않습니다");
    }

    const existing = await this.prisma.edge.findUnique({
      where: { sourceId_targetId: { sourceId: dto.source, targetId: dto.target } },
    });
    if (existing) throw AppException.conflict("이미 존재하는 엣지입니다");

    const [sourceNode, targetNode] = await Promise.all([
      this.prisma.node.findFirst({ where: { id: dto.source, projectId, deletedAt: null } }),
      this.prisma.node.findFirst({ where: { id: dto.target, projectId, deletedAt: null } }),
    ]);
    if (!sourceNode || !targetNode) {
      throw AppException.unprocessable("같은 프로젝트의 활성 노드만 연결할 수 있습니다");
    }

    const edge = await this.prisma.$transaction(async (tx) => {
      const created = await tx.edge.create({
        data: { id: forceId || undefined, projectId, sourceId: dto.source, targetId: dto.target },
      });
      await tx.activityLog.create({
        data: {
          projectId,
          userId,
          targetType: "EDGE",
          targetId: created.id,
          action: "CONNECT",
        },
      });
      return created;
    });

    return { id: edge.id, source: edge.sourceId, target: edge.targetId };
  }

  async deleteEdge(
    projectId: string,
    userId: string,
    edgeId: string,
  ): Promise<EdgeDeleteResponse> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");

    const existing = await this.prisma.edge.findFirst({
      where: { id: edgeId, projectId },
    });
    if (!existing) throw AppException.notFound("엣지를 찾을 수 없습니다");

    await this.prisma.$transaction(async (tx) => {
      await tx.edge.delete({ where: { id: edgeId } });
      await tx.activityLog.create({
        data: {
          projectId,
          userId,
          targetType: "EDGE",
          targetId: edgeId,
          action: "DISCONNECT",
        },
      });
    });

    return { id: edgeId };
  }
}
