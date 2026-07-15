// 엣지 클릭 → 삭제 버튼 노출 — 더블클릭보다 발견하기 쉬운 삭제 동선.
// applyLocalDeleteEdge를 직접 호출해 로컬 반영 + 소켓 emit까지 한 번에 처리한다(§CV realtime).
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

import { canEdit } from "../../lib/permissions";
import { useCanvasStore } from "../../store/canvasStore";

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const applyLocalDeleteEdge = useCanvasStore((s) => s.applyLocalDeleteEdge);
  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {selected && !readOnly && (
        <EdgeLabelRenderer>
          <button
            type="button"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-xs text-muted shadow-sm hover:bg-error-bg hover:text-error"
            onClick={(e) => {
              e.stopPropagation();
              applyLocalDeleteEdge(id);
            }}
            aria-label="연결 삭제"
            title="연결 삭제"
          >
            ✕
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
