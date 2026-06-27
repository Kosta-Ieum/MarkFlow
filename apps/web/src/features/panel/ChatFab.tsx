// IEUM-37 [F2-3.2] 채팅 FAB (우하단 고정 토글 버튼 + 팝오버).
// 화면설계서 §3.3: 56px 다크 원형, right:24 bottom:24 z-80.
// 닫힘=💬+unread 배지(bg-brand), 열림=✕.
// 팝오버 344×480px, bg-white, border-line, animate-mfpop.
// 상태 공유: ChatPanel과 동일한 chatStore + presenceStore + useCollaboration(projectId).sendChat.
// TODO(F1): 캔버스 우하단에 <ChatFab projectId={...}/> 마운트.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatMessageDTO } from "@markflow/shared";

import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { ChatThread } from "./ChatThread";

interface MessagesResponse {
  messages: ChatMessageDTO[];
}

export interface ChatFabProps {
  projectId: string;
}

export function ChatFab({ projectId }: ChatFabProps) {
  const [open, setOpen] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const setMessages = useChatStore((s) => s.setMessages);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const markRead = useChatStore((s) => s.markRead);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const messagesLen = useChatStore((s) => s.messages.length);

  // 채팅 히스토리 로드(REST) — ChatPanel과 동일한 queryKey로 캐시 공유.
  const { data } = useQuery({
    queryKey: queryKeys.messages(projectId),
    queryFn: () => api<MessagesResponse>(`/projects/${projectId}/messages`),
  });

  useEffect(() => {
    if (data?.messages) setMessages(data.messages);
  }, [data?.messages, setMessages]);

  // unread 추적: 초기 로드 이후, FAB이 닫힌 상태에서 메시지가 늘어날 때만 카운트.
  // initialLoaded: REST 히스토리 로드가 완료된 뒤부터 카운트 시작.
  const initialLoaded = useRef(false);
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (!initialLoaded.current) {
      // 첫 로드 완료 시점을 기록하고 기준 길이를 저장.
      if (messagesLen > 0) {
        initialLoaded.current = true;
        prevLenRef.current = messagesLen;
      }
      return;
    }

    const delta = messagesLen - prevLenRef.current;
    if (delta > 0) {
      if (!open) {
        // FAB이 닫혀 있을 때만 unread 증가.
        for (let i = 0; i < delta; i++) {
          incrementUnread();
        }
      }
      prevLenRef.current = messagesLen;
    }
  }, [messagesLen, open, incrementUnread]);

  function handleOpen() {
    setOpen(true);
    markRead();
  }

  function handleClose() {
    setOpen(false);
  }

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      {/* FAB 버튼 */}
      <button
        type="button"
        onClick={open ? handleClose : handleOpen}
        aria-label={open ? "채팅 닫기" : "채팅 열기"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {open ? (
          <span className="text-lg leading-none" aria-hidden="true">
            ✕
          </span>
        ) : (
          <span className="relative flex items-center justify-center" aria-hidden="true">
            <span className="text-xl leading-none">💬</span>
            {unreadCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-0.5 font-mono text-[10px] font-semibold text-white">
                {displayCount}
              </span>
            )}
          </span>
        )}
      </button>

      {/* 팝오버 */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[80] flex h-[480px] w-[344px] animate-mfpop flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl"
          role="dialog"
          aria-label="팀 채팅"
          aria-modal="false"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink">팀 채팅</span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="채팅 닫기"
              className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* 채팅 스레드 (ChatPanel과 동일 상태 공유) */}
          <ChatThread projectId={projectId} currentUserId={currentUserId} />
        </div>
      )}
    </>
  );
}
