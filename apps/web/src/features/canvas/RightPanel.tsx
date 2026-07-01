// 우측 패널 — 채팅/히스토리(IEUM-36, F2 작업물)를 여기 마운트한다.
// panel/index.tsx 주석의 TODO(F1/IEUM-34) 지시대로 ChatPanel을 여기서 마운트.
import { useEffect, useRef } from "react";

import { useChatStore } from "../../store/chatStore";
import { ChatPanel } from "../panel";

interface RightPanelProps {
  projectId: string;
  expanded: boolean;
  onToggle: () => void;
}

const EXPANDED_WIDTH = 340; // ChatPanel 자체 폭(w-[340px])과 맞춤
const COLLAPSED_WIDTH = 84;

export function RightPanel({ projectId, expanded, onToggle }: RightPanelProps) {
  // 패널이 접혀있는 동안 도착한 새 메시지 수 추적(ChatFab과 같은 패턴) — chatStore.messages는
  // 실시간 수신(useSocketCollab)이 패널 mount 여부와 무관하게 계속 채운다.
  const messagesLen = useChatStore((s) => s.messages.length);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const markRead = useChatStore((s) => s.markRead);
  const incrementUnread = useChatStore((s) => s.incrementUnread);
  const prevLenRef = useRef(messagesLen);

  useEffect(() => {
    if (expanded) {
      markRead();
      prevLenRef.current = messagesLen;
      return;
    }
    const delta = messagesLen - prevLenRef.current;
    if (delta > 0) {
      for (let i = 0; i < delta; i++) incrementUnread();
      prevLenRef.current = messagesLen;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLen, expanded]);

  if (expanded) {
    return <ChatPanel projectId={projectId} onCollapse={onToggle} />;
  }

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <aside
      className="flex h-full flex-col border-l border-line bg-surface transition-[width] duration-150"
      style={{ width: COLLAPSED_WIDTH }}
    >
      <div className="flex items-center justify-between border-b border-line p-3">
        <button
          type="button"
          aria-label="패널 펼치기"
          onClick={onToggle}
          className="relative ml-auto grid h-7 w-7 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
        >
          «
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand px-0.5 font-mono text-[10px] font-semibold text-white">
              {displayCount}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

export { EXPANDED_WIDTH as RIGHT_PANEL_EXPANDED_WIDTH, COLLAPSED_WIDTH as RIGHT_PANEL_COLLAPSED_WIDTH };
