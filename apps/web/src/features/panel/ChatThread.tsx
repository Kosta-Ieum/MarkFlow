// IEUM-37 [F2-3.2] 채팅 스레드 공용 표현 컴포넌트.
// ChatPanel(우측 패널)·ChatFab(FAB 팝오버) 양쪽에서 재사용한다(§3.3 "같은 상태").
// 전송 은닉: canvasStore의 sendChatMessage(내부적으로 activeCollab.sendChat)만. fetch/socket 직접 호출 금지.
import { useEffect, useRef, useState } from "react";
import type { ChatMessageDTO } from "@markflow/shared";

import { sendChatMessage } from "../../store/canvasStore";
import { useChatStore } from "../../store/chatStore";
import { usePresenceStore } from "../../store/presenceStore";

// ── 유틸 ──────────────────────────────────────────────────────────────────

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ── 프레즌스(접속자) 섹션 ───────────────────────────────────────────────────

function PresenceSection() {
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);

  return (
    <section className="border-b border-line px-4 py-3" aria-label="접속자">
      <div className="mb-2 text-xs font-medium text-secondary">
        접속자 {onlineUsers.length}명
      </div>
      {onlineUsers.length === 0 ? (
        <p className="text-xs text-muted">접속자가 없습니다.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="접속자 목록">
          {onlineUsers.map((user) => (
            <li key={user.id}>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-semibold text-ink ring-1 ring-line"
                title={user.name}
                aria-label={user.name}
              >
                {initialOf(user.name)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── 메시지 1건 ───────────────────────────────────────────────────────────────

interface MessageItemProps {
  message: ChatMessageDTO;
  mine: boolean;
}

function MessageItem({ message, mine }: MessageItemProps) {
  return (
    <li className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-1.5 text-xs text-secondary">
        <span className="font-medium text-ink">{message.user.name}</span>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      </div>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-sm ${
          mine ? "bg-brand text-white" : "bg-surface text-ink"
        }`}
      >
        {message.content}
      </div>
    </li>
  );
}

// ── 메시지 리스트 ─────────────────────────────────────────────────────────────

function MessageList({ currentUserId }: { currentUserId: string | null }) {
  const messages = useChatStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted">아직 메시지가 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-label="메시지 목록">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          mine={message.user.id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </ul>
  );
}

// ── 입력창 ────────────────────────────────────────────────────────────────────

function MessageComposer() {
  const [value, setValue] = useState("");

  function submit() {
    const content = value.trim();
    if (!content) return;
    sendChatMessage(content);
    setValue("");
  }

  return (
    <div className="border-t border-line p-3">
      <div className="flex items-end gap-2">
        <label htmlFor="chat-composer-input" className="sr-only">
          메시지 입력
        </label>
        <textarea
          id="chat-composer-input"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="메시지를 입력하세요"
          className="max-h-24 flex-1 resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          전송
        </button>
      </div>
    </div>
  );
}

// ── ChatThread (공용 export) ───────────────────────────────────────────────────

export interface ChatThreadProps {
  projectId: string;
  currentUserId: string | null;
}

// projectId는 sendChatMessage가 store의 activeCollab(이미 해당 프로젝트 룸에 연결됨)을
// 통해서만 보내므로 더 필요 없다 — 호출부(ChatFab/ChatPanel) 시그니처 안정성 위해 prop은 유지.
export function ChatThread({ currentUserId }: ChatThreadProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PresenceSection />
      <MessageList currentUserId={currentUserId} />
      <MessageComposer />
    </div>
  );
}
