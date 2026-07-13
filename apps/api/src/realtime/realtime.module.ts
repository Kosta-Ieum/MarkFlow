import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { CanvasModule } from "../modules/canvas/canvas.module.js";
import { ChatModule } from "../modules/chat/chat.module.js";
import { CanvasGateway } from "./canvas.gateway.js";
import { WsJwtGuard } from "./ws-jwt.guard.js";
import { PresenceService } from "./presence.js";

// BE-3.1(IEUM-31): 소켓 서버 + 인증 + 룸/초기싱크.
// chat.gateway.ts는 BE-3.3 범위 — 아직 이 모듈에 등록하지 않는다.
@Module({
  imports: [PrismaModule, CanvasModule, ChatModule],
  providers: [CanvasGateway, WsJwtGuard, PresenceService],
})
export class RealtimeModule {}
