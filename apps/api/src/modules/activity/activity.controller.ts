import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ActivityService } from "./activity.service.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { HistoryQuerySchema, type HistoryQuery } from "./activity.dto.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";

// 전역 JwtAuthGuard가 기본 보호 (app.module.ts APP_GUARD)
@Controller("projects/:projectId")
@UseGuards(ProjectRoleGuard)
@RequireRole("VIEWER")
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get("history")
  getProjectHistory(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(HistoryQuerySchema)) query: HistoryQuery,
  ) {
    return this.activityService.getProjectHistory(
      projectId,
      user.sub,
      query.limit,
      query.before,
    );
  }

  @Get("nodes/:nodeId/history")
  getNodeHistory(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("nodeId", ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(HistoryQuerySchema)) query: HistoryQuery,
  ) {
    return this.activityService.getNodeHistory(
      projectId,
      user.sub,
      nodeId,
      query.limit,
      query.before,
    );
  }
}
