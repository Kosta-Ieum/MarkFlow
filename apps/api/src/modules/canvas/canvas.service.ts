import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { AppException } from "../../common/app.exception.js";
import type { CanvasSnapshot, NodeDTO } from "@markflow/shared";

export interface TrashNode {
  id: string;
  title: string;
  type: string;
  deletedAt: string;
}

export interface ProjectTrashResponse {
  nodes: TrashNode[];
}

function toNodeDTO(node: {
  id: string;
  type: string;
  title: string;
  markdown: string;
  collapsed: boolean;
  posX: number;
  posY: number;
  updatedAt: Date;
}): NodeDTO {
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
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrash(projectId: string, userId: string): Promise<ProjectTrashResponse> {
    await assertPermission(this.prisma, projectId, userId, "VIEWER");

    const nodes = await this.prisma.node.findMany({
      where: { projectId, deletedAt: { not: null } },
      select: { id: true, title: true, type: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    });

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type as string,
        deletedAt: n.deletedAt!.toISOString(),
      })),
    };
  }

  async getCanvas(projectId: string, userId: string): Promise<CanvasSnapshot> {
    // VIEWER 이상이면 조회 가능 — assertPermission이 비멤버 403 처리
    await assertPermission(this.prisma, projectId, userId, "VIEWER");

    // 단일 쿼리로 project + member role + nodes(활성) + edges 일괄 조회 (N+1 방지)
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        members: {
          where: { userId },
          select: { role: true },
        },
        nodes: {
          where: { deletedAt: null },
          select: {
            id: true,
            type: true,
            title: true,
            markdown: true,
            collapsed: true,
            posX: true,
            posY: true,
            updatedAt: true,
          },
        },
        edges: {
          select: {
            id: true,
            sourceId: true,
            targetId: true,
          },
        },
      },
    });

    if (!project) throw AppException.notFound("프로젝트를 찾을 수 없습니다");

    const member = project.members[0];
    if (!member) throw AppException.forbidden("프로젝트 멤버가 아닙니다");

    return {
      project: {
        id: project.id,
        name: project.name,
        role: member.role,
      },
      nodes: project.nodes.map(toNodeDTO),
      edges: project.edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
      })),
    };
  }
}
