// IEUM-36 [F2-3.1] 우측 패널: 팀 채팅 탭 + 프레즌스
// 화면설계서 §4.4.6 (우측 340px 흰색 패널, 탭바 "팀 채팅"/"히스토리").
// 전송 은닉: 컴포넌트는 store 구독 + useCollaboration(CollabAPI) + api()만. fetch/socket 직접 호출 금지.
// TODO(F1/IEUM-34): 캔버스 우측에 <ChatPanel projectId={...} /> 마운트(여기서 마운트하지 않는다).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatMessageDTO } from "@markflow/shared";

import { useCollaboration } from "../../collab/useCollaboration";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useAuthStore } from "../../store/authStore";
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

type TabId = "chat" | "history";

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

function MessageComposer({ projectId }: { projectId: string }) {
  const [value, setValue] = useState("");
  const collab = useCollaboration(projectId);

  function submit() {
    const content = value.trim();
    if (!content) return;
    collab.sendChat(content);
    setValue("");
  }

  return (
    <div className="border-t border-line p-3">
      <div className="flex items-end gap-2">
        <label htmlFor="chat-composer" className="sr-only">
          메시지 입력
        </label>
        <textarea
          id="chat-composer"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
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

// ── 패널 ──────────────────────────────────────────────────────────────────────

interface MessagesResponse {
  messages: ChatMessageDTO[];
}

export interface ChatPanelProps {
  projectId: string;
  onCollapse?: () => void;
}

export function ChatPanel({ projectId, onCollapse }: ChatPanelProps) {
  const [tab, setTab] = useState<TabId>("chat");
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const setMessages = useChatStore((s) => s.setMessages);

  // 채팅 히스토리 로드(REST). 응답 envelope = { messages: ChatMessageDTO[] }.
  const { data } = useQuery({
    queryKey: queryKeys.messages(projectId),
    queryFn: () => api<MessagesResponse>(`/projects/${projectId}/messages`),
  });

  const loadedMessages = useMemo(() => data?.messages, [data]);

  useEffect(() => {
    if (loadedMessages) setMessages(loadedMessages);
  }, [loadedMessages, setMessages]);

  return (
    <aside
      className="flex h-full w-[340px] flex-col border-l border-line bg-white animate-mfpop"
      aria-label="팀 채팅 및 히스토리 패널"
    >
      <div className="flex items-center justify-between border-b border-line px-2" role="tablist">
        <div className="flex">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chat"}
            onClick={() => setTab("chat")}
            className={`px-3 py-3 text-sm font-medium transition ${
              tab === "chat"
                ? "border-b-2 border-brand text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            팀 채팅
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={`px-3 py-3 text-sm font-medium transition ${
              tab === "history"
                ? "border-b-2 border-brand text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            히스토리
          </button>
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="패널 접기"
            className="px-2 py-1 text-muted hover:text-ink"
          >
            ✕
          </button>
        ) : null}
      </div>

      {tab === "chat" ? (
        <div className="flex flex-1 flex-col overflow-hidden" role="tabpanel" aria-label="팀 채팅">
          <PresenceSection />
          <MessageList currentUserId={currentUserId} />
          <MessageComposer projectId={projectId} />
        </div>
      ) : (
        <div
          className="flex flex-1 items-center justify-center px-4"
          role="tabpanel"
          aria-label="히스토리"
        >
          {/* TODO(IEUM-40): 활동 히스토리(ActivityLog) 패널 */}
          <p className="text-sm text-muted">준비 중입니다.</p>
        </div>
      )}
    </aside>
  );
}
