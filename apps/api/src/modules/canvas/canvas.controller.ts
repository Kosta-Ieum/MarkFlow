import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { CanvasService } from "./canvas.service.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { CanvasSaveRequestSchema } from "@markflow/shared";
import type { CanvasSaveRequest } from "@markflow/shared";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";

// 전역 JwtAuthGuard가 기본 보호 (app.module.ts APP_GUARD)
@Controller("projects/:projectId/canvas")
@UseGuards(ProjectRoleGuard)
@RequireRole("VIEWER")
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  getCanvas(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.canvasService.getCanvas(projectId, user.sub);
  }

  @Put()
  @RequireRole("EDITOR")
  async saveCanvas(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CanvasSaveRequestSchema)) dto: CanvasSaveRequest,
  ) {
    return this.canvasService.saveCanvas(projectId, user.sub, dto);
  }
}
