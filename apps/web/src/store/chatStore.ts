// 채팅 메시지·typing — 단일 진실원(Zustand). 패널(F2)이 구독하고, 실시간 수신(F1)이 채운다.
// 컴포넌트는 이 store만 본다(소켓/fetch 직접 호출 금지). DTO는 @markflow/shared ChatMessageDTO.
import type { ChatMessageDTO } from "@markflow/shared";
import { create } from "zustand";

interface ChatState {
  messages: ChatMessageDTO[];
  typingUserIds: string[];
  // REST 히스토리 로드 결과로 전체 교체.
  setMessages: (msgs: ChatMessageDTO[]) => void;
  // 원격/낙관 수신 1건 반영(emit 금지 — 에코 루프 차단). id 중복 시 무시.
  applyRemoteMessage: (msg: ChatMessageDTO) => void;
  setTyping: (userId: string, on: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  typingUserIds: [],

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

  clear: () => set({ messages: [], typingUserIds: [] }),
}));
