// 휴지통 (아코디언 + 드래그 드롭존) — IEUM-28 [F1-2.2], 화면설계서 §4.4.5
// 좌측 사이드바 상태에 따라 기본 위치가 이동한다(ctrlLeft). 손잡이(🗑 버튼)를 드래그하면
// 자유 배치로 전환되고(이후 사이드바 토글에 안 따라감) 위치가 localStorage에 남는다.
// 드래그 중인 노드 카드가 이 영역 위에서 손을 놓으면 소프트 삭제(§CV-08/CV-16) — 별개 기능.
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { ForwardedRef } from "react";
import MDEditor from "@uiw/react-md-editor";

import { canEdit } from "../../lib/permissions";
import { useCanvasStore } from "../../store/canvasStore";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./constants";

const POSITION_STORAGE_KEY = "markflow-trash-pos";

// 목록 패널 크기 추정치 — 화면 밖으로 잘리는지 판단하는 용도라 정확한 실측값일 필요는 없다.
const PANEL_WIDTH = 256; // w-64
const PANEL_HEIGHT = 320; // 헤더 + max-h-56 목록 + 패딩 여유
const EDGE_MARGIN = 12;

interface TrashPos {
  left: number;
  bottom: number;
}

function loadStoredPos(): TrashPos | null {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrashPos) : null;
  } catch {
    return null;
  }
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
  leftSidebarExpanded: boolean;
  /** 드래그 중인 노드가 이 영역 위에 있는지 — 드롭 힌트 강조용 */
  isDragOver: boolean;
}

export const TrashPanel = forwardRef<HTMLDivElement, TrashPanelProps>(function TrashPanel(
  { leftSidebarExpanded, isDragOver },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pos, setPos] = useState<TrashPos | null>(loadStoredPos);
  const [direction, setDirection] = useState({ openUpward: true, anchorRight: false });
  const trashedNodes = useCanvasStore((s) => s.trashedNodes);
  const applyLocalRestoreNode = useCanvasStore((s) => s.applyLocalRestoreNode);
  const applyLocalPermanentDeleteNode = useCanvasStore((s) => s.applyLocalPermanentDeleteNode);
  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const offsetLeft = leftSidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
  const left = pos?.left ?? offsetLeft + 24;
  const bottom = pos?.bottom ?? 24;

  // 화면 가장자리로 옮겨졌을 때 패널이 뷰포트 밖으로 잘리지 않도록 여는 방향을 뒤집는다.
  // (위로 갈수록 위로 열면 잘림 → 아래로, 오른쪽으로 갈수록 왼쪽 정렬이면 잘림 → 오른쪽 정렬로)
  // 실제 화면(viewport) 좌표 기준으로 판단해야 해서 style.left/bottom이 아니라
  // getBoundingClientRect(캔버스 컨테이너 폭 등 레이아웃 결과 반영)로 잰다.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDirection({
      openUpward: rect.top - PANEL_HEIGHT - EDGE_MARGIN >= 0,
      anchorRight: rect.left + PANEL_WIDTH + EDGE_MARGIN > window.innerWidth,
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
    if (!wasDraggedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) wasDraggedRef.current = true;
    if (wasDraggedRef.current) {
      setPos({ left: drag.origLeft + dx, bottom: drag.origBottom - dy });
    }
  };

  const handlePointerUp = () => {
    if (wasDraggedRef.current) {
      setPos((p) => {
        if (p) localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(p));
        return p;
      });
    }
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
    localStorage.removeItem(POSITION_STORAGE_KEY);
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
