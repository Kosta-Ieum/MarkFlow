// 채팅 메시지·typing — 단일 진실원(Zustand). 패널(F2)이 구독하고, 실시간 수신(F1)이 채운다.
// 컴포넌트는 이 store만 본다(소켓/fetch 직접 호출 금지). DTO는 @markflow/shared ChatMessageDTO.
import type { ChatMessageDTO } from "@markflow/shared";
import { create } from "zustand";

interface ChatState {
  messages: ChatMessageDTO[];
  typingUserIds: string[];
  /** FAB 팝오버가 닫힌 동안 도착한 미읽은 메시지 수 */
  unreadCount: number;
  // REST 히스토리 로드 결과로 전체 교체.
  setMessages: (msgs: ChatMessageDTO[]) => void;
  // 원격/낙관 수신 1건 반영(emit 금지 — 에코 루프 차단). id 중복 시 무시.
  applyRemoteMessage: (msg: ChatMessageDTO) => void;
  setTyping: (userId: string, on: boolean) => void;
  /** FAB 팝오버를 열 때 호출 — unreadCount를 0으로 리셋 */
  markRead: () => void;
  /** FAB 팝오버가 닫힌 상태에서 새 메시지 도착 시 카운트 증가 */
  incrementUnread: () => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  typingUserIds: [],
  unreadCount: 0,

  setMessages: (msgs) => set({ messages: msgs }),

  applyRemoteMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { messages: [...state.messages, msg] };
    }),

  setTyping: (userId, on) =>
    set((state) => {
      const has = state.typingUserIds.includes(userId);
      if (on && !has) return { typingUserIds: [...state.typingUserIds, userId] };
      if (!on && has) return { typingUserIds: state.typingUserIds.filter((id) => id !== userId) };
      return state;
    }),

  markRead: () => set({ unreadCount: 0 }),

  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  clear: () => set({ messages: [], typingUserIds: [], unreadCount: 0 }),
}));
