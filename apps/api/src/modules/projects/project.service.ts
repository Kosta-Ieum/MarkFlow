import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { AppException } from "../../common/app.exception.js";
import type {
  ProjectSummary,
  ProjectsResponse,
  ProjectCreateRequest,
  ProjectUpdateResponse,
  ProjectDeleteResponse,
} from "@markflow/shared";

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ProjectsResponse> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId, project: { deletedAt: null } },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            updatedAt: true,
            ownerId: true,
            _count: { select: { nodes: { where: { deletedAt: null } } } },
          },
        },
      },
    });

    const projects: ProjectSummary[] = memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      role: m.role,
      isOwner: m.project.ownerId === userId,
      nodeCount: m.project._count.nodes,
      updatedAt: m.project.updatedAt.toISOString(),
    }));

    return { projects };
  }

  async create(userId: string, dto: ProjectCreateRequest): Promise<ProjectSummary> {
    const result = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name,
          ownerId: userId,
          members: { create: { userId, role: "OWNER" } },
        },
        select: { id: true, name: true, updatedAt: true, ownerId: true },
      });
      return project;
    });

    return {
      id: result.id,
      name: result.name,
      role: "OWNER",
      isOwner: true,
      nodeCount: 0,
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  async update(
    projectId: string,
    userId: string,
    dto: { name: string },
  ): Promise<ProjectUpdateResponse> {
    await assertPermission(this.prisma, projectId, userId, "OWNER");

    const project = await this.prisma.project.update({
      where: { id: projectId, deletedAt: null },
      data: { name: dto.name },
      select: { id: true, name: true, updatedAt: true },
    });

    return {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async softDelete(projectId: string, userId: string): Promise<ProjectDeleteResponse> {
    await assertPermission(this.prisma, projectId, userId, "OWNER");

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw AppException.notFound("프로젝트를 찾을 수 없습니다");

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });

    return {
      id: updated.id,
      deletedAt: updated.deletedAt!.toISOString(),
    };
  }
}
