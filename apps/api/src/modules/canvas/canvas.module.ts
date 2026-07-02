import { Module } from "@nestjs/common";
import { CanvasController } from "./canvas.controller.js";
import { CanvasService } from "./canvas.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}
