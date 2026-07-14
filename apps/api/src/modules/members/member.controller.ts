import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { MemberService } from "./member.service.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";
import { MemberInviteRequestSchema, MemberUpdateRequestSchema } from "@markflow/shared";
import type { MemberInviteRequest, MemberUpdateRequest } from "@markflow/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { Role } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";

@UseGuards(ProjectRoleGuard)
@Controller("projects/:projectId/members")
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @RequireRole("VIEWER")
  @Get()
  async getMembers(
    @Param("projectId") projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const members = await this.memberService.getMembers(projectId, user.sub);
    return { members };
  }

  @RequireRole("OWNER")
  @Post()
  async inviteMember(
    @Param("projectId") projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(MemberInviteRequestSchema)) dto: MemberInviteRequest,
  ) {
    await this.memberService.inviteMember(projectId, user.sub, dto.email, dto.role as Role);
    return { success: true };
  }

  @RequireRole("OWNER")
  @Patch(":userId")
  async updateMemberRole(
    @Param("projectId") projectId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(MemberUpdateRequestSchema)) dto: MemberUpdateRequest,
  ) {
    await this.memberService.updateMemberRole(projectId, user.sub, userId, dto.role as Role);
    return { success: true };
  }

  @RequireRole("OWNER")
  @Delete(":userId")
  async removeMember(
    @Param("projectId") projectId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.memberService.removeMember(projectId, user.sub, userId);
    return result;
  }
}
