import { Global, Module } from "@nestjs/common";
import { ProjectEventsService } from "./project-events.service.js";

@Global()
@Module({
  providers: [ProjectEventsService],
  exports: [ProjectEventsService],
})
export class EventsModule {}
