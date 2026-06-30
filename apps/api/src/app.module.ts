import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { env } from "./config/env.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ProjectModule } from "./modules/projects/project.module.js";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN },
    }),
    AuthModule,
    ProjectModule,
    // 도메인 모듈(nodes·edges·members·chat·activity·realtime)은
    // 구현 시 여기에 등록한다.
  ],
  providers: [
    // 전역 인증 가드 — 새 라우트는 기본적으로 보호됨. 공개 라우트만 @Public() 명시.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
