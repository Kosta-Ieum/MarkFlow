import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { REQUIRED_ROLE_KEY } from "../decorators/require-role.decorator.js";
import type { JwtPayload } from "./jwt-auth.guard.js";

interface RoleCheckRequest {
  params: { id?: string; projectId?: string };
  user: JwtPayload;
}

// @RequireRole(role) 붙은 라우트에서 assertPermission(BE-1.3)을 호출하는 얇은 래퍼.
// 판정 로직은 assertPermission 단일 소스 — 여기선 호출만 한다(소켓도 동일 함수 재사용).
@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<Role | undefined>(
      REQUIRED_ROLE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!requiredRole) return true;

    const req = ctx.switchToHttp().getRequest<RoleCheckRequest>();
    const projectId = req.params.projectId ?? req.params.id;
    if (!projectId) return true;

    await assertPermission(this.prisma, projectId, req.user.sub, requiredRole);
    return true;
  }
}
