// 접속자·커서 — presence 단일 진실원(Zustand).
// presence는 F1 실시간 도메인이지만, 우측 패널(F2) 표시용 최소 shape를 여기 정의한다.
// TODO(IEUM-34/35): F1이 cursor:move / presence:update 수신으로 이 store를 채운다.
import type { XY } from "@markflow/shared";
import { create } from "zustand";

interface PresenceUser {
  id: string;
  name: string;
}

interface PresenceState {
  onlineUsers: PresenceUser[];
  cursors: Record<string, XY>;
  setOnlineUsers: (users: PresenceUser[]) => void;
  upsertCursor: (userId: string, xy: XY) => void;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  cursors: {},

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  upsertCursor: (userId, xy) =>
    set((state) => ({ cursors: { ...state.cursors, [userId]: xy } })),

  clear: () => set({ onlineUsers: [], cursors: {} }),
}));
