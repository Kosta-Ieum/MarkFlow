import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChatService } from "./chat.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ProjectRoleGuard } from "../../common/guards/project-role.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { RequireRole } from "../../common/decorators/require-role.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  ChatMessageCreateRequestSchema,
  type ChatMessageCreateRequest,
} from "./chat.dto.js";

@Controller("projects/:projectId/messages")
@UseGuards(ProjectRoleGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @RequireRole("VIEWER")
  getMessages(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.chatService.getMessages(projectId, user.sub, limitNum, before);
  }

  @Post()
  @RequireRole("EDITOR")
  sendMessage(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ChatMessageCreateRequestSchema))
    dto: ChatMessageCreateRequest,
  ) {
    return this.chatService.sendMessage(projectId, user.sub, dto.content);
  }
}
