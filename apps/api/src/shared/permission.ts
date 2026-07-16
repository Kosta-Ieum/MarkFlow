import type { Role } from "@prisma/client";
import { AppException } from "../common/app.exception.js";
import type { PrismaService } from "../prisma/prisma.service.js";

const ROLE_RANK: Record<Role, number> = {
  OWNER: 2,
  EDITOR: 1,
  VIEWER: 0,
};

export function roleAtLeast(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export async function assertPermission(
  prisma: PrismaService,
  projectId: string,
  userId: string,
  minRole: Role,
): Promise<void> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  if (!member) {
    const projectExists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!projectExists) {
      throw AppException.notFound("프로젝트를 찾을 수 없습니다");
    }
    throw AppException.forbidden("프로젝트 멤버가 아닙니다");
  }

  if (!roleAtLeast(member.role, minRole)) {
    throw AppException.forbidden(
      `${minRole} 이상의 권한이 필요합니다 (현재: ${member.role})`,
    );
  }
}
