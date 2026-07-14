import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { AppException } from "../../common/app.exception.js";
import type { CanvasSnapshot, NodeDTO, CanvasSaveRequest, CanvasSaveResponse } from "@markflow/shared";

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

  async assertEditorPermission(projectId: string, userId: string): Promise<void> {
    await assertPermission(this.prisma, projectId, userId, "EDITOR");
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

  async saveCanvas(
    projectId: string,
    userId: string,
    dto: CanvasSaveRequest,
  ): Promise<CanvasSaveResponse> {
    await this.assertEditorPermission(projectId, userId);

    // DTO에 있는 노드/엣지들의 ID 목록
    const nodeIds = dto.nodes.map((n) => n.id);
    
    if (nodeIds.length > 0) {
      const otherProjectNodesCount = await this.prisma.node.count({
        where: {
          id: { in: nodeIds },
          projectId: { not: projectId },
        },
      });
      if (otherProjectNodesCount > 0) {
        throw AppException.forbidden("타 프로젝트의 자원은 수정할 수 없습니다");
      }
    }

    // 존재하는 노드만 가리키는 엣지만 필터링하여 P2003 500 에러 원천 차단
    const validNodeIds = new Set(nodeIds);
    const validEdges = dto.edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
    const edgeIds = validEdges.map((e) => e.id);

    await this.prisma.$transaction(async (tx) => {
      // 1. 기존 활성 노드 중 DTO에 없는 것 삭제 (물리 삭제)
      // *주의: 삭제된 노드(deletedAt != null)는 유지해야 하므로 deletedAt: null 조건 추가
      if (nodeIds.length > 0) {
        await tx.node.deleteMany({
          where: {
            projectId,
            deletedAt: null,
            id: { notIn: nodeIds },
          },
        });
      } else {
        await tx.node.deleteMany({
          where: {
            projectId,
            deletedAt: null,
          },
        });
      }

      // 2. 노드 삽입 또는 업데이트
      for (const node of dto.nodes) {
        await tx.node.upsert({
          where: { id: node.id },
          update: {
            title: node.title,
            markdown: node.markdown,
            type: node.type,
            collapsed: node.collapsed,
            posX: node.position.x,
            posY: node.position.y,
          },
          create: {
            id: node.id,
            projectId,
            title: node.title,
            markdown: node.markdown,
            type: node.type,
            collapsed: node.collapsed,
            posX: node.position.x,
            posY: node.position.y,
          },
        });
      }

      // 3. 기존 엣지 중 DTO에 없는 것 삭제
      if (edgeIds.length > 0) {
        await tx.edge.deleteMany({
          where: {
            projectId,
            id: { notIn: edgeIds },
          },
        });
      } else {
        await tx.edge.deleteMany({
          where: {
            projectId,
          },
        });
      }

      // 4. 엣지 삽입 또는 업데이트
      for (const edge of validEdges) {
        await tx.edge.upsert({
          where: { id: edge.id },
          update: {
            sourceId: edge.source,
            targetId: edge.target,
          },
          create: {
            id: edge.id,
            projectId,
            sourceId: edge.source,
            targetId: edge.target,
          },
        });
      }
    });

    return { savedAt: new Date().toISOString() };
  }
}
