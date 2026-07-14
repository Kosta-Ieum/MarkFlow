import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { env } from "./config/env.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ProjectModule } from "./modules/projects/project.module.js";
import { NodeModule } from "./modules/nodes/node.module.js";
import { EdgeModule } from "./modules/edges/edge.module.js";
import { CanvasModule } from "./modules/canvas/canvas.module.js";
import { MemberModule } from "./modules/members/member.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";
import { ActivityModule } from "./modules/activity/activity.module.js";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { EventsModule } from "./common/events/events.module.js";

@Module({
  imports: [
    EventsModule,
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN },
    }),
    HealthModule,
    AuthModule,
    ProjectModule,
    NodeModule,
    EdgeModule,
    CanvasModule,
    MemberModule,
    ChatModule,
    ActivityModule,
    // 도메인 모듈(realtime)은
    // 구현 시 여기에 등록한다.
    RealtimeModule,
  ],
  providers: [
    Reflector,
    // useFactory로 DI 토큰을 명시 — tsx/esm 환경에서 emitDecoratorMetadata 없이도 안전.
    {
      provide: APP_GUARD,
      useFactory: (jwt: JwtService, reflector: Reflector) => new JwtAuthGuard(jwt, reflector),
      inject: [JwtService, Reflector],
    },
  ],
})
export class AppModule {}
