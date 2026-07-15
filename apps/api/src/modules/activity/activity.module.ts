import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ActivityController } from "./activity.controller.js";
import { ActivityService } from "./activity.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
