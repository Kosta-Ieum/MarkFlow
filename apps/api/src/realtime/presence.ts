// 커서·소프트락 in-memory 상태 — 현재는 프레즌스(접속 유저 목록)만 관리한다(BE-3.1).
// BE-3.2(락)·(커서) 관련 코드는 여기 넣지 않는다.
import { Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { UserRefSchema } from "@markflow/shared";

type UserRef = z.infer<typeof UserRefSchema>;

@Injectable()
export class PresenceService {
  // projectId -> (socketId -> user)
  private readonly rooms = new Map<string, Map<string, UserRef>>();

  add(projectId: string, socketId: string, user: UserRef): void {
    let sockets = this.rooms.get(projectId);
    if (!sockets) {
      sockets = new Map<string, UserRef>();
      this.rooms.set(projectId, sockets);
    }
    sockets.set(socketId, user);
  }

  remove(projectId: string, socketId: string): void {
    const sockets = this.rooms.get(projectId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) this.rooms.delete(projectId);
  }

  /** 이 소켓이 속해있던 모든 projectId에서 제거하고, 영향받은 projectId 목록을 리턴한다. */
  removeSocketFromAll(socketId: string): string[] {
    const affected: string[] = [];
    for (const [projectId, sockets] of this.rooms.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) this.rooms.delete(projectId);
        affected.push(projectId);
      }
    }
    return affected;
  }

  list(projectId: string): UserRef[] {
    const sockets = this.rooms.get(projectId);
    if (!sockets) return [];
    return Array.from(sockets.values());
  }
}
