import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { EdgeService } from "./edge.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { EdgeCreateRequestSchema, type EdgeCreateRequest } from "./edge.dto.js";

// 전역 JwtAuthGuard가 기본 보호 (app.module.ts APP_GUARD)
@Controller("projects/:projectId/edges")
@UseGuards(ProjectRoleGuard)
@RequireRole("EDITOR")
export class EdgeController {
  constructor(private readonly edgeService: EdgeService) {}

  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(EdgeCreateRequestSchema)) dto: EdgeCreateRequest,
  ) {
    return this.edgeService.createEdge(projectId, user.sub, dto);
  }

  @Delete(":edgeId")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("edgeId", ParseUUIDPipe) edgeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.edgeService.deleteEdge(projectId, user.sub, edgeId);
  }
}
