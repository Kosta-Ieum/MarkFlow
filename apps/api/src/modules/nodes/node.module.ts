import { Module } from "@nestjs/common";
import { NodeController } from "./node.controller.js";
import { NodeService } from "./node.service.js";
import { PrismaModule } from "../../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule],
  controllers: [NodeController],
  providers: [NodeService],
  exports: [NodeService],
})
export class NodeModule {}
