// 휴지통 (아코디언 + 드래그 드롭존) — IEUM-28 [F1-2.2], 화면설계서 §4.4.5
// 기본 위치는 캔버스 우측 상단. "사용자가 실제로 드래그했을 때만" 위치가 바뀐다 —
// 리사이즈/클릭 등 다른 이유로는 절대 위치가 바뀌지 않는다(§피드백: 미세한 클릭 떨림이
// 드래그로 오인되어 위치가 고정되던 버그 수정).
// - anchor="left": 캔버스 좌측 기준 거리 저장 → 좌측 사이드바 폭이 바뀌면(flex reflow로
//   캔버스 컨테이너 원점이 이동) 자동으로 따라간다. 화면 중앙에 놓아도 캔버스 기준 상대
//   위치라 "그 자리 유지"로 보인다.
// - anchor="right": 캔버스 우측 기준 거리 저장 → 우측 패널 폭이 바뀌면 자동으로 따라간다.
// 창이 좁아져 저장된 위치가 화면 밖으로 나가면 렌더링 값만 안쪽으로 클램프하고(저장값은
// 안 건드림) — 창이 다시 커지면 클램프가 풀리며 원래 위치로 돌아온다.
// 드래그 중에는 좌표를 캔버스 컨테이너 안쪽으로만 강제해 좌/우 패널 밑에 숨는 것을 막는다.
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { ForwardedRef } from "react";
import MDEditor from "@uiw/react-md-editor";

import { canEdit } from "../../lib/permissions";
import { useAuthStore } from "../../store/authStore";
import { useCanvasStore } from "../../store/canvasStore";

const POSITION_STORAGE_KEY_PREFIX = "markflow-trash-pos-v2";

// 계정별로 따로 기억해야 한다 — 키에 사용자 id가 안 들어가 있으면 브라우저(로컬스토리지)를
// 공유하는 모든 계정이 같은 위치를 보게 되고, 계정1이 옮기면 계정2 화면도 같이 옮겨진다.
function storageKeyFor(userId: string | undefined): string {
  return `${POSITION_STORAGE_KEY_PREFIX}:${userId ?? "anon"}`;
}

// 목록 패널 크기 추정치 — 화면 밖으로 잘리는지 판단하는 용도라 정확한 실측값일 필요는 없다.
const PANEL_WIDTH = 256; // w-64
const PANEL_HEIGHT = 320; // 헤더 + max-h-56 목록 + 패딩 여유
const EDGE_MARGIN = 12;
// 토글 버튼(🗑 휴지통 N) 크기 추정치 — 기본 위치·클램프 계산용, 정밀한 실측값일 필요는 없다.
const BUTTON_WIDTH_APPROX = 96;
const BUTTON_HEIGHT_APPROX = 36;
// 드롭 지점이 캔버스 우측 가장자리에서 이 거리 안이면 "우측 근처"로 보고 우측 기준으로 고정한다.
const RIGHT_ZONE_WIDTH = 180;
// 클릭과 드래그를 가르는 픽셀 임계값 — 너무 낮으면 클릭 중 손 떨림이 드래그로 오인된다.
const DRAG_THRESHOLD = 10;

type Anchor = "left" | "right";

interface TrashPos {
  bottom: number;
  anchor: Anchor;
  /** anchor="left"면 캔버스 좌측 기준 거리, anchor="right"면 캔버스 우측 기준 거리. */
  offset: number;
}

function isTrashPos(v: unknown): v is TrashPos {
  return (
    !!v &&
    typeof v === "object" &&
    Number.isFinite((v as TrashPos).bottom) &&
    Number.isFinite((v as TrashPos).offset) &&
    ((v as TrashPos).anchor === "left" || (v as TrashPos).anchor === "right")
  );
}

function loadStoredPos(storageKey: string): TrashPos | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTrashPos(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// style.left/bottom은 캔버스 컨테이너(offsetParent) 기준이라, 우측 채팅 패널 등으로 좁아진
// 실제 화면 우측 여백을 반영하지 못한다 — getBoundingClientRect로 실제 뷰포트 좌표를 잰다.
function applyImperativeRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

const TYPE_DOT: Record<string, string> = {
  idea: "bg-node-idea-dot",
  doc: "bg-node-doc-dot",
  task: "bg-node-task-dot",
  decision: "bg-node-decision-dot",
  data: "bg-node-data-dot",
};

interface TrashPanelProps {
  /** 드래그 중인 노드가 이 영역 위에 있는지 — 드롭 힌트 강조용 */
  isDragOver: boolean;
}

export const TrashPanel = forwardRef<HTMLDivElement, TrashPanelProps>(function TrashPanel(
  { isDragOver },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const myId = useAuthStore((s) => s.user?.id);
  const storageKey = storageKeyFor(myId);
  const [pos, setPos] = useState<TrashPos | null>(() => loadStoredPos(storageKey));
  // 로그인 계정이 바뀌면(로그아웃 후 다른 계정 로그인, 또는 마운트 시점에 아직 인증
  // 복원 전이었던 경우) 그 계정 몫의 저장값을 다시 읽는다 — 계정별로 위치가 독립적이어야 한다.
  useLayoutEffect(() => {
    setPos(loadStoredPos(storageKey));
  }, [storageKey]);
  const [direction, setDirection] = useState({ openUpward: true, anchorRight: false });
  const trashedNodes = useCanvasStore((s) => s.trashedNodes);
  const applyLocalRestoreNode = useCanvasStore((s) => s.applyLocalRestoreNode);
  const applyLocalPermanentDeleteNode = useCanvasStore((s) => s.applyLocalPermanentDeleteNode);
  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 캔버스 컨테이너(offsetParent) 크기 — 렌더링 시점의 클램프·기본 위치 계산에만 쓰고,
  // pos(사용자가 드래그로 정한 값)는 이 값 때문에 절대 갱신하지 않는다.
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // 드래그 도중 미리보기 위치 — pointerup에서 확정되기 전까지는 pos에 반영하지 않는다.
  const [dragPreview, setDragPreview] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    const parent = containerRef.current?.offsetParent as HTMLElement | null;
    if (!parent) return;
    const measure = () => setContainerSize({ width: parent.clientWidth, height: parent.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const maxLeft = Math.max(containerSize.width - BUTTON_WIDTH_APPROX - EDGE_MARGIN, EDGE_MARGIN);
  const maxBottom = Math.max(containerSize.height - BUTTON_HEIGHT_APPROX - EDGE_MARGIN, EDGE_MARGIN);

  // 렌더링용 위치 — 드래그 중이면 미리보기, 아니면 저장된 pos(없으면 우측 상단 기본값)를
  // 화면 크기에 맞춰 "표시만" 클램프한다(저장값 자체는 안 바뀌므로 창이 다시 커지면 복귀).
  let left: number;
  let bottom: number;
  if (dragPreview) {
    left = dragPreview.left;
    bottom = dragPreview.bottom;
  } else if (pos) {
    const rawLeft = pos.anchor === "right" ? containerSize.width - pos.offset : pos.offset;
    left = clamp(rawLeft, EDGE_MARGIN, maxLeft);
    bottom = clamp(pos.bottom, EDGE_MARGIN, maxBottom);
  } else {
    left = maxLeft; // 기본값: 우측
    bottom = maxBottom; // 기본값: 상단
  }

  // 화면 가장자리로 옮겨졌을 때 패널이 잘리지 않도록 여는 방향을 뒤집는다.
  // (위로 갈수록 위로 열면 잘림 → 아래로, 오른쪽으로 갈수록 왼쪽 정렬이면 잘림 → 오른쪽 정렬로)
  // window.innerWidth가 아니라 "캔버스 컨테이너(offsetParent)"의 뷰포트 경계와 비교해야 한다 —
  // 우측 패널이 그 바깥을 차지하고 있어서, window 기준으로는 여유가 있어 보여도 실제로는
  // 우측 패널에 가려지는 버그가 있었다.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const parent = containerRef.current.offsetParent as HTMLElement | null;
    const bounds = (parent ?? document.documentElement).getBoundingClientRect();
    const rect = containerRef.current.getBoundingClientRect();
    setDirection({
      openUpward: rect.top - PANEL_HEIGHT - EDGE_MARGIN >= bounds.top,
      anchorRight: rect.left + PANEL_WIDTH + EDGE_MARGIN > bounds.right,
    });
  }, [open, left, bottom]);
  const { openUpward, anchorRight } = direction;

  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origBottom: number } | null>(null);
  const wasDraggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: left, origBottom: bottom };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!wasDraggedRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      wasDraggedRef.current = true;
    }
    if (wasDraggedRef.current) {
      // 좌/우 패널 밑으로 숨어버리지 않도록, 드래그 중에도 항상 캔버스 컨테이너 안쪽으로만 제한한다.
      setDragPreview({
        left: clamp(drag.origLeft + dx, EDGE_MARGIN, maxLeft),
        bottom: clamp(drag.origBottom - dy, EDGE_MARGIN, maxBottom),
      });
    }
  };

  const handlePointerUp = () => {
    if (wasDraggedRef.current && dragPreview) {
      const nearRight = containerSize.width - dragPreview.left <= RIGHT_ZONE_WIDTH;
      const next: TrashPos = nearRight
        ? { bottom: dragPreview.bottom, anchor: "right", offset: containerSize.width - dragPreview.left }
        : { bottom: dragPreview.bottom, anchor: "left", offset: dragPreview.left };
      setPos(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
    setDragPreview(null);
    dragRef.current = null;
  };

  const handleToggleClick = () => {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false; // 드래그 직후 클릭은 토글로 안 친다.
      return;
    }
    setOpen((v) => !v);
  };

  const resetPosition = () => {
    setPos(null);
    localStorage.removeItem(storageKey);
  };

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        applyImperativeRef(ref, node);
      }}
      id="mf-trash"
      className={`absolute z-10 ${pos ? "" : "transition-[left] duration-150"}`}
      style={{ left, bottom }}
    >
      {isDragOver && (
        <div className="mb-2 animate-mfpop rounded-full bg-brand px-4 py-2 text-center text-xs font-semibold text-white shadow-lg">
          놓으면 휴지통으로 이동됩니다
        </div>
      )}

      {open && (
        <div
          className={`absolute z-10 w-64 animate-mfup rounded-2xl border border-line bg-surface p-3 shadow-lg ${
            openUpward ? "bottom-full mb-2" : "top-full mt-2"
          } ${anchorRight ? "right-0" : "left-0"}`}
        >
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
            임시 저장소 · {trashedNodes.length}
          </p>
          {trashedNodes.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted">비어 있습니다.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {trashedNodes.map((node) => {
                const isExpanded = expandedId === node.id;
                return (
                  <li key={node.id} className="rounded-lg hover:bg-canvas">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : node.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setExpandedId(isExpanded ? null : node.id);
                      }}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[node.data.type]}`} />
                      <span className="flex-1 truncate text-ink">{node.data.title || "제목 없음"}</span>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyLocalRestoreNode(node.id);
                        }}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        복원
                      </button>
                      <button
                        type="button"
                        aria-label="영구삭제"
                        disabled={readOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`"${node.data.title || "제목 없음"}" 노드를 영구삭제하시겠습니까? 되돌릴 수 없습니다.`)) {
                            applyLocalPermanentDeleteNode(node.id);
                          }
                        }}
                        className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-error-bg hover:text-error disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        ✕
                      </button>
                    </div>
                    {isExpanded && (
                      <div
                        className="mx-2 mb-2 max-h-40 overflow-y-auto rounded-lg border border-line bg-canvas p-2 text-xs text-secondary [&_pre]:bg-code-bg [&_pre]:text-code-fg"
                        data-color-mode="light"
                      >
                        <MDEditor.Markdown source={node.data.markdown || "*내용 없음*"} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={resetPosition}
        title="드래그해서 위치 이동 · 더블클릭하면 기본 위치로"
        className={`flex cursor-grab touch-none select-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium shadow-sm transition-all active:cursor-grabbing ${
          isDragOver ? "scale-105 bg-node-task-bg text-node-task-text" : "text-secondary"
        }`}
      >
        🗑 휴지통 <span className="font-mono">{trashedNodes.length}</span>
      </button>
    </div>
  );
});
