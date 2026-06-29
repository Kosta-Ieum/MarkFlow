// 우측 패널 — 채팅/히스토리 탭은 RT-03/RT-04 후속 티켓 범위.
// 스캐폴드 단계에서는 펼침/접힘 자리만 잡아둔다 (§4.4: ctrlRight 372/84px).
interface RightPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

const EXPANDED_WIDTH = 372;
const COLLAPSED_WIDTH = 84;

export function RightPanel({ expanded, onToggle }: RightPanelProps) {
  return (
    <aside
      className="flex h-full flex-col border-l border-line bg-surface transition-[width] duration-150"
      style={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
    >
      <div className="flex items-center justify-between border-b border-line p-3">
        {expanded && <span className="text-xs font-medium uppercase tracking-wide text-muted">패널</span>}
        <button
          type="button"
          aria-label={expanded ? "패널 접기" : "패널 펼치기"}
          onClick={onToggle}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
        >
          {expanded ? "»" : "«"}
        </button>
      </div>
      {expanded && (
        <div className="flex-1 p-3 text-center text-xs text-muted">
          팀 채팅·히스토리 (RT-03 / RT-04 예정)
        </div>
      )}
    </aside>
  );
}

export { EXPANDED_WIDTH as RIGHT_PANEL_EXPANDED_WIDTH, COLLAPSED_WIDTH as RIGHT_PANEL_COLLAPSED_WIDTH };
