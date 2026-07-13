import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppException } from "../../common/app.exception.js";
import type { Role } from "@prisma/client";

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async getMembers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));
  }

  async inviteMember(projectId: string, email: string, role: Role) {
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

  async updateMemberRole(projectId: string, targetUserId: string, newRole: Role) {
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

    return { success: true };
  }

  async removeMember(projectId: string, targetUserId: string) {
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

    return { userId: targetUserId };
  }
}
