// 멀티커서 오버레이 — IEUM-35 [F1-3.2], 화면설계서 §4.4 멀티커서 UI 명세.
// "타인 커서를 컬러 포인터 + 이름표로 캔버스 좌표계에 오버레이. 사용자별 고정 색상."
import { useReactFlow } from "@xyflow/react";

import { getUserColor } from "../../lib/userColor";
import { useAuthStore } from "../../store/authStore";
import { usePresenceStore } from "../../store/presenceStore";

export function CursorOverlay() {
  const cursors = usePresenceStore((s) => s.cursors);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const myId = useAuthStore((s) => s.user?.id);
  const { flowToScreenPosition } = useReactFlow();

  const nameOf = (userId: string) => onlineUsers.find((u) => u.id === userId)?.name ?? "참여자";

  // flowToScreenPosition은 뷰포트(페이지) 기준 절대좌표를 반환한다(클릭 이벤트의
  // clientX/Y와 같은 좌표계) — 부모(캔버스 div)는 사이드바만큼 페이지 원점에서
  // 밀려 있으므로, absolute(부모 기준)가 아니라 fixed(뷰포트 기준)로 앵커링해야
  // 좌표계가 일치한다. 사이드바 접힘/펼침에 따라 어긋나던 버그의 원인.
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {Object.entries(cursors)
        .filter(([userId]) => userId !== myId)
        .map(([userId, flowPos]) => {
          const { x, y } = flowToScreenPosition(flowPos);
          const color = getUserColor(userId);
          return (
            <div
              key={userId}
              className="absolute transition-transform duration-75 ease-out"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-md">
                <path d="M2 2L18 9L10 11L8 18L2 2Z" fill={color} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span
                className="ml-3 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: color }}
              >
                {nameOf(userId)}
              </span>
            </div>
          );
        })}
    </div>
  );
}
