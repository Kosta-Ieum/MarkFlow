import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { MemberService } from "./member.service.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";
import { MemberInviteRequestSchema, MemberUpdateRequestSchema } from "@markflow/shared";
import type { MemberInviteRequest, MemberUpdateRequest } from "@markflow/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { Role } from "@prisma/client";

@UseGuards(ProjectRoleGuard)
@Controller("projects/:projectId/members")
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @RequireRole("VIEWER")
  @Get()
  async getMembers(@Param("projectId") projectId: string) {
    const members = await this.memberService.getMembers(projectId);
    return { members };
  }

  @RequireRole("OWNER")
  @Post()
  async inviteMember(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(MemberInviteRequestSchema)) dto: MemberInviteRequest,
  ) {
    await this.memberService.inviteMember(projectId, dto.email, dto.role as Role);
    return { success: true };
  }

  @RequireRole("OWNER")
  @Patch(":userId")
  async updateMemberRole(
    @Param("projectId") projectId: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(MemberUpdateRequestSchema)) dto: MemberUpdateRequest,
  ) {
    await this.memberService.updateMemberRole(projectId, userId, dto.role as Role);
    return { success: true };
  }

  @RequireRole("OWNER")
  @Delete(":userId")
  async removeMember(
    @Param("projectId") projectId: string,
    @Param("userId") userId: string,
  ) {
    const result = await this.memberService.removeMember(projectId, userId);
    return result;
  }
}
