// 접속자·커서·소프트락 — presence 단일 진실원(Zustand).
// presence는 F1 실시간 도메인이지만, 우측 패널(F2) 표시용 최소 shape를 여기 정의한다.
// IEUM-34: cursor:move / presence:update / lock:update 수신으로 이 store를 채운다.
// 실제 멀티커서·락 배지 렌더링(UI)은 IEUM-35 범위.
import type { XY } from "@markflow/shared";
import { create } from "zustand";

interface PresenceUser {
  id: string;
  name: string;
}

interface PresenceState {
  onlineUsers: PresenceUser[];
  cursors: Record<string, XY>;
  /** nodeId → 그 노드를 편집 중인 userId (없으면 unlocked) */
  locks: Record<string, string>;
  setOnlineUsers: (users: PresenceUser[]) => void;
  upsertCursor: (userId: string, xy: XY) => void;
  removeCursor: (userId: string) => void;
  setLock: (nodeId: string, userId: string | null) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  cursors: {},
  locks: {},

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  upsertCursor: (userId, xy) =>
    set((state) => ({ cursors: { ...state.cursors, [userId]: xy } })),

  removeCursor: (userId) =>
    set((state) => {
      const next = { ...state.cursors };
      delete next[userId];
      return { cursors: next };
    }),

  setLock: (nodeId, userId) =>
    set((state) => {
      const next = { ...state.locks };
      if (userId) next[nodeId] = userId;
      else delete next[nodeId];
      return { locks: next };
    }),

  clear: () => set({ onlineUsers: [], cursors: {}, locks: {} }),
}));
