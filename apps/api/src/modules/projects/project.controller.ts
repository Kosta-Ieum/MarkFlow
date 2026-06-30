import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ProjectService } from "./project.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  ProjectCreateRequestSchema,
  ProjectUpdateRequestSchema,
  type ProjectCreateRequest,
  type ProjectUpdateRequest,
} from "@markflow/shared";

// 전역 JwtAuthGuard가 기본 보호 (app.module.ts APP_GUARD)
@Controller("projects")
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.projectService.list(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ProjectCreateRequestSchema)) dto: ProjectCreateRequest,
  ) {
    return this.projectService.create(user.sub, dto);
  }

  @Patch(":id")
  @UseGuards(ProjectRoleGuard)
  @RequireRole("OWNER")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ProjectUpdateRequestSchema)) dto: ProjectUpdateRequest,
  ) {
    return this.projectService.update(id, user.sub, dto);
  }

  @Delete(":id")
  @UseGuards(ProjectRoleGuard)
  @RequireRole("OWNER")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.projectService.delete(id, user.sub);
  }
}
