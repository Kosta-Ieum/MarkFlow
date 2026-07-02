import { Module } from "@nestjs/common";
import { EdgeController } from "./edge.controller.js";
import { EdgeService } from "./edge.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule],
  controllers: [EdgeController],
  providers: [EdgeService],
  exports: [EdgeService],
})
export class EdgeModule {}
