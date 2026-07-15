// 접속자·커서·소프트락 — presence 단일 진실원(Zustand).
// presence는 F1 실시간 도메인이지만, 우측 패널(F2) 표시용 최소 shape를 여기 정의한다.
// IEUM-34: cursor:move / presence:update / lock:update 수신으로 이 store를 채운다.
// 실제 멀티커서·락 배지 렌더링(UI)은 IEUM-35 범위.
import type { XY } from "@markflow/shared";
import { create } from "zustand";

interface PresenceUser {
  id: string;
  name: string;
  /** 공개 표시명 — 커서·접속자·락 배지는 nickname ?? name으로 표기(백필 전 null이면 name 폴백). */
  nickname?: string | null;
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
  /** presence:update로 접속자 명단이 바뀔 때, 이제 접속자 목록에 없는 유저의 커서·락을 정리한다.
   * 타인이 캔버스에서 나가도 유령 커서/락이 남던 문제(§F1-피드백)의 근본 수정. */
  pruneOffline: (onlineIds: string[]) => void;
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

  pruneOffline: (onlineIds) =>
    set((state) => {
      const online = new Set(onlineIds);
      const cursors = Object.fromEntries(
        Object.entries(state.cursors).filter(([userId]) => online.has(userId)),
      );
      const locks = Object.fromEntries(
        Object.entries(state.locks).filter(([, userId]) => online.has(userId)),
      );
      return { cursors, locks };
    }),

  clear: () => set({ onlineUsers: [], cursors: {}, locks: {} }),
}));
