import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppException } from "../../common/app.exception.js";
import type { Role } from "@prisma/client";

import { assertPermission } from "../../shared/permission.js";
import { ProjectEventsService } from "../../common/events/project-events.service.js";

@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProjectEventsService,
  ) {}

  async getMembers(projectId: string, requesterId: string) {
    await assertPermission(this.prisma, projectId, requesterId, "VIEWER");
    
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, nickname: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      nickname: m.user.nickname,
    }));
  }

  async inviteMember(projectId: string, requesterId: string, email: string, role: Role) {
    await assertPermission(this.prisma, projectId, requesterId, "OWNER");
    
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw AppException.notFound("해당 이메일로 가입된 유저가 없습니다.");
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (existing) {
      throw AppException.conflict("이미 참여 중인 멤버입니다.");
    }

    await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        role,
      },
    });

    return { success: true };
  }

  async updateMemberRole(projectId: string, requesterId: string, targetUserId: string, newRole: Role) {
    await assertPermission(this.prisma, projectId, requesterId, "OWNER");
    
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    if (!member) throw AppException.notFound("해당 멤버를 찾을 수 없습니다.");
    if (member.role === "OWNER") {
      throw AppException.forbidden("프로젝트 소유자의 권한은 변경할 수 없습니다.");
    }

    await this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      data: { role: newRole },
    });

    this.events.emit({
      projectId,
      triggerUserId: requesterId,
      type: "MEMBER_ROLE_CHANGED",
      payload: { userId: targetUserId, role: newRole },
    });

    return { success: true };
  }

  async removeMember(projectId: string, requesterId: string, targetUserId: string) {
    await assertPermission(this.prisma, projectId, requesterId, "OWNER");
    
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    if (!member) throw AppException.notFound("해당 멤버를 찾을 수 없습니다.");
    if (member.role === "OWNER") {
      throw AppException.forbidden("프로젝트 소유자는 추방할 수 없습니다.");
    }

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    this.events.emit({
      projectId,
      triggerUserId: requesterId,
      type: "MEMBER_REMOVED",
      payload: { userId: targetUserId },
    });

    return { userId: targetUserId };
  }
}
