import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { NodeService } from "./node.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  NodeCreateRequestSchema,
  NodeUpdateRequestSchema,
  type NodeCreateRequest,
  type NodeUpdateRequest,
} from "./node.dto.js";

// 전역 JwtAuthGuard가 기본 보호 (app.module.ts APP_GUARD)
@Controller("projects/:projectId/nodes")
@UseGuards(ProjectRoleGuard)
@RequireRole("EDITOR")
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  @Post()
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(NodeCreateRequestSchema)) dto: NodeCreateRequest,
  ) {
    return this.nodeService.create(projectId, user.sub, dto);
  }

  @Patch(":nodeId")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("nodeId", ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(NodeUpdateRequestSchema)) dto: NodeUpdateRequest,
  ) {
    return this.nodeService.update(projectId, user.sub, nodeId, dto);
  }

  @Delete(":nodeId")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("nodeId", ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.nodeService.softDelete(projectId, user.sub, nodeId);
  }

  @Post(":nodeId/restore")
  @HttpCode(200)
  restore(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("nodeId", ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.nodeService.restore(projectId, user.sub, nodeId);
  }

  @Delete(":nodeId/permanent")
  purge(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("nodeId", ParseUUIDPipe) nodeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.nodeService.purge(projectId, user.sub, nodeId);
  }
}
