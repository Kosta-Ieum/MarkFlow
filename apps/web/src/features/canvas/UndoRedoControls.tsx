// Undo/Redo 컨트롤 — ZoomControls(하단 우측 pill) 안에 인라인 배치되는 버튼 묶음.
// 키보드 단축키 리스너도 여기 있으므로 캔버스 화면 동안 항상 마운트되어야 한다.
import { useCallback, useEffect, useRef, useState } from "react";

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

  const showFeedback = useCallback((message: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback(message);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
  }, []);

  // 버튼과 키보드 단축키가 같은 핸들러를 공유한다 — 피드백 표시 경로 단일화.
  const handleUndo = useCallback(() => {
    const result = useHistoryStore.getState().undo();
    if (result.status === "missing") showFeedback("되돌릴 대상이 이미 변경되었습니다");
    else if (result.status === "locked") showFeedback("다른 사용자가 편집 중인 노드입니다");
  }, [showFeedback]);

  const handleRedo = useCallback(() => {
    const result = useHistoryStore.getState().redo();
    if (result.status === "missing") showFeedback("되돌릴 대상이 이미 변경되었습니다");
    else if (result.status === "locked") showFeedback("다른 사용자가 편집 중인 노드입니다");
  }, [showFeedback]);

  // 키보드 단축키(R1.1/R1.2) — (meta|ctrl)+Z = undo, +Shift 또는 ctrl+Y = redo.
  // 노드 에디터는 별도 라우트(이 컴포넌트 미마운트)라 리스너 자체가 없어 텍스트 undo와
  // 자연 분리되고(R1.4), 캔버스 위 인라인 입력(채팅·제목 등) 포커스 중엔 양보한다.
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      if (isUndo) handleUndo();
      else handleRedo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, handleUndo, handleRedo]);

  // 자체 pill 없이 버튼 묶음만 렌더 — ZoomControls의 하단 우측 pill 안에 인라인으로 들어간다.
  return (
    <div className="relative flex items-center gap-1">
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-9 right-0 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-xs text-secondary shadow-sm"
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
  );
}
