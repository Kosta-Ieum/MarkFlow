import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface ProjectEvent {
  projectId: string;
  triggerUserId?: string;
  type: 
    | "NODE_RESTORED" 
    | "NODE_PURGED" 
    | "NODE_DELETED"
    | "ACTIVITY_ADDED"
    | "MEMBER_REMOVED"
    | "MEMBER_ROLE_CHANGED";
  payload?: any;
}

@Injectable()
export class ProjectEventsService {
  private subject = new Subject<ProjectEvent>();

  get events$() {
    return this.subject.asObservable();
  }

  emit(event: ProjectEvent) {
    this.subject.next(event);
  }
}
