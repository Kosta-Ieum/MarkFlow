import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { RefreshTokenStore } from "./refresh-token.store.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { EventsModule } from "../../common/events/events.module.js";

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenStore],
})
export class AuthModule {}
