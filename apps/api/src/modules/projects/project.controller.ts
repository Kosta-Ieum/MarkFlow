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
import { JwtAuthGuard, type JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  ProjectCreateRequestSchema,
  ProjectUpdateRequestSchema,
  type ProjectCreateRequest,
  type ProjectUpdateRequest,
} from "@markflow/shared";

@Controller("projects")
@UseGuards(JwtAuthGuard)
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
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ProjectUpdateRequestSchema)) dto: ProjectUpdateRequest,
  ) {
    return this.projectService.update(id, user.sub, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.projectService.softDelete(id, user.sub);
  }
}
