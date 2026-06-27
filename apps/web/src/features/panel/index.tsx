// IEUM-36 [F2-3.1] 우측 패널: 팀 채팅 탭 + 프레즌스
// 화면설계서 §4.4.6 (우측 340px 흰색 패널, 탭바 "팀 채팅"/"히스토리").
// 전송 은닉: 컴포넌트는 store 구독 + useCollaboration(CollabAPI) + api()만. fetch/socket 직접 호출 금지.
// TODO(F1/IEUM-34): 캔버스 우측에 <ChatPanel projectId={...} /> 마운트(여기서 마운트하지 않는다).
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChatMessageDTO } from "@markflow/shared";

import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { ChatThread } from "./ChatThread";
import { HistoryTimeline } from "./HistoryTimeline";

// ── 패널 ──────────────────────────────────────────────────────────────────────

type TabId = "chat" | "history";

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
          <ChatThread projectId={projectId} currentUserId={currentUserId} />
        </div>
      ) : (
        <div
          className="flex flex-1 flex-col overflow-hidden"
          role="tabpanel"
          aria-label="히스토리"
        >
          <HistoryTimeline projectId={projectId} />
        </div>
      )}
    </aside>
  );
}
