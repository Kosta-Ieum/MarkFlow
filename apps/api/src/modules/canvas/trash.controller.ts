import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { CanvasService } from "./canvas.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";

// 전역 JwtAuthGuard가 기본 보호 (app.module.ts APP_GUARD)
@Controller("projects/:projectId/trash")
@UseGuards(ProjectRoleGuard)
@RequireRole("VIEWER")
export class TrashController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  getTrash(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.canvasService.getTrash(projectId, user.sub);
  }
}
