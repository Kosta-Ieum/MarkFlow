import { Module } from "@nestjs/common";
import { ProjectController } from "./project.controller.js";
import { ProjectService } from "./project.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
