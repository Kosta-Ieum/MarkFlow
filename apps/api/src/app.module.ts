import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { env } from "./config/env.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ProjectModule } from "./modules/projects/project.module.js";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: "7d" },
    }),
    AuthModule,
    ProjectModule,
    // 도메인 모듈(nodes·edges·members·chat·activity·realtime)은
    // 구현 시 여기에 등록한다.
  ],
})
export class AppModule {}
