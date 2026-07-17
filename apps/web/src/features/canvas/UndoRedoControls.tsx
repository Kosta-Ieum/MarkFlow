// Undo/Redo 컨트롤 — 하단 좌측 pill(ZoomControls의 우측 pill과 대칭 배치).
import { useEffect, useRef, useState } from "react";

import { canEdit } from "../../lib/permissions";
import { useCanvasStore } from "../../store/canvasStore";
import { useHistoryStore } from "../../store/historyStore";

const FEEDBACK_DURATION_MS = 2000;

export function UndoRedoControls() {
  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0);
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0);

  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    },
    [],
  );

  const showFeedback = (message: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback(message);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
  };

  // T6에서 키보드 단축키가 같은 핸들러를 재사용한다.
  const handleUndo = () => {
    const result = useHistoryStore.getState().undo();
    if (result.status === "missing") showFeedback("되돌릴 대상이 이미 변경되었습니다");
    else if (result.status === "locked") showFeedback("다른 사용자가 편집 중인 노드입니다");
  };

  const handleRedo = () => {
    const result = useHistoryStore.getState().redo();
    if (result.status === "missing") showFeedback("되돌릴 대상이 이미 변경되었습니다");
    else if (result.status === "locked") showFeedback("다른 사용자가 편집 중인 노드입니다");
  };

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <div className="relative flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-sm">
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="absolute -top-9 left-0 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-xs text-secondary shadow-sm"
          >
            {feedback}
          </div>
        )}
        <button
          type="button"
          aria-label="실행 취소"
          title="실행 취소 (Ctrl/Cmd+Z)"
          disabled={readOnly || !canUndo}
          onClick={handleUndo}
          className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="다시 실행"
          title="다시 실행 (Ctrl/Cmd+Shift+Z)"
          disabled={readOnly || !canRedo}
          onClick={handleRedo}
          className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          ↷
        </button>
      </div>
    </div>
  );
}
