// 휴지통 (아코디언 + 드래그 드롭존) — IEUM-28 [F1-2.2], 화면설계서 §4.4.5
// 좌측 사이드바 상태에 따라 위치가 이동한다(ctrlLeft). 드래그 중 이 영역 위에서
// 손을 놓으면 노드가 소프트 삭제되어 휴지통으로 들어간다(§CV-08/CV-16).
import { forwardRef, useState } from "react";

import { useCanvasStore } from "../../store/canvasStore";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./constants";

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
  const trashedNodes = useCanvasStore((s) => s.trashedNodes);
  const applyLocalRestoreNode = useCanvasStore((s) => s.applyLocalRestoreNode);
  const applyLocalPermanentDeleteNode = useCanvasStore((s) => s.applyLocalPermanentDeleteNode);

  const offsetLeft = leftSidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <div
      ref={ref}
      id="mf-trash"
      className="absolute bottom-6 z-10 transition-[left] duration-150"
      style={{ left: offsetLeft + 24 }}
    >
      {isDragOver && (
        <div className="mb-2 animate-mfpop rounded-full bg-brand px-4 py-2 text-center text-xs font-semibold text-white shadow-lg">
          놓으면 휴지통으로 이동됩니다
        </div>
      )}

      {open && (
        <div className="mb-2 w-64 animate-mfup rounded-2xl border border-line bg-surface p-3 shadow-lg">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
            임시 저장소 · {trashedNodes.length}
          </p>
          {trashedNodes.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted">비어 있습니다.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {trashedNodes.map((node) => (
                <li
                  key={node.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[node.data.type]}`} />
                  <span className="flex-1 truncate text-ink">{node.data.title || "제목 없음"}</span>
                  <button
                    type="button"
                    onClick={() => applyLocalRestoreNode(node.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10"
                  >
                    복원
                  </button>
                  <button
                    type="button"
                    aria-label="영구삭제"
                    onClick={() => {
                      if (window.confirm(`"${node.data.title || "제목 없음"}" 노드를 영구삭제하시겠습니까? 되돌릴 수 없습니다.`)) {
                        applyLocalPermanentDeleteNode(node.id);
                      }
                    }}
                    className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-error-bg hover:text-error"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium shadow-sm transition-all ${
          isDragOver ? "scale-105 bg-node-task-bg text-node-task-text" : "text-secondary"
        }`}
      >
        🗑 휴지통 <span className="font-mono">{trashedNodes.length}</span>
      </button>
    </div>
  );
});
