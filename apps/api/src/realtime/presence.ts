// 커서·소프트락 in-memory 상태 및 프레즌스(접속 유저 목록) 관리
// 락은 { projectId -> { nodeId -> { userId, socketId } } } 로 관리한다.
import { Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { UserRefSchema } from "@markflow/shared";

type UserRef = z.infer<typeof UserRefSchema>;

@Injectable()
export class PresenceService {
  // projectId -> (socketId -> user)
  private readonly rooms = new Map<string, Map<string, UserRef>>();
  // projectId -> (nodeId -> { userId, socketId })
  private readonly locks = new Map<string, Map<string, { userId: string; socketId: string }>>();
  // socketId -> Set<{ projectId, nodeId }> (빠른 해제용)
  private readonly socketLocks = new Map<string, Set<{ projectId: string; nodeId: string }>>();

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

  /** 이 소켓이 속해있던 모든 projectId에서 제거하고, 영향받은 projectId 목록과 해제된 락 목록을 리턴한다. */
  removeSocketFromAll(socketId: string): {
    affectedProjects: string[];
    releasedLocks: { projectId: string; nodeId: string }[];
  } {
    const affectedProjects: string[] = [];
    const releasedLocks: { projectId: string; nodeId: string }[] = [];
    for (const [projectId, sockets] of this.rooms.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) this.rooms.delete(projectId);
        affectedProjects.push(projectId);
      }
    }

    const sLocks = this.socketLocks.get(socketId);
    if (sLocks) {
      for (const lock of sLocks) {
        const pLocks = this.locks.get(lock.projectId);
        if (pLocks) {
          const current = pLocks.get(lock.nodeId);
          if (current?.socketId === socketId) {
            pLocks.delete(lock.nodeId);
            if (pLocks.size === 0) this.locks.delete(lock.projectId);
            releasedLocks.push(lock);
          }
        }
      }
      this.socketLocks.delete(socketId);
    }

    return { affectedProjects, releasedLocks };
  }

  // --- Lock Management ---

  acquireLock(projectId: string, nodeId: string, socketId: string, userId: string): boolean {
    let pLocks = this.locks.get(projectId);
    if (!pLocks) {
      pLocks = new Map();
      this.locks.set(projectId, pLocks);
    }

    const current = pLocks.get(nodeId);
    if (current && current.socketId !== socketId) {
      return false; // 남이 선점 중
    }

    pLocks.set(nodeId, { userId, socketId });

    let sLocks = this.socketLocks.get(socketId);
    if (!sLocks) {
      sLocks = new Set();
      this.socketLocks.set(socketId, sLocks);
    }
    sLocks.add({ projectId, nodeId });

    return true;
  }

  releaseLock(projectId: string, nodeId: string, socketId: string): boolean {
    const pLocks = this.locks.get(projectId);
    if (!pLocks) return false;

    const current = pLocks.get(nodeId);
    if (current?.socketId === socketId) {
      pLocks.delete(nodeId);
      if (pLocks.size === 0) this.locks.delete(projectId);

      const sLocks = this.socketLocks.get(socketId);
      if (sLocks) {
        for (const lock of sLocks) {
          if (lock.projectId === projectId && lock.nodeId === nodeId) {
            sLocks.delete(lock);
            break;
          }
        }
        if (sLocks.size === 0) this.socketLocks.delete(socketId);
      }
      return true;
    }
    return false;
  }

  list(projectId: string): UserRef[] {
    const sockets = this.rooms.get(projectId);
    if (!sockets) return [];
    return Array.from(sockets.values());
  }
}
