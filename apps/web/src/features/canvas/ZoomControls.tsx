// 줌 컨트롤 — 화면설계서 §4.4.3: 하단 우측 화이트 필, ↶↷(undo/redo) / 줌% / − / + / ⊙(화면 맞춤)
// 우측 패널 폭 보정은 필요 없다 — 이 컴포넌트가 그려지는 CanvasSurface 자체가 이미
// RightPanel과 flex 형제라 패널이 열리면 폭이 저절로 줄어든다(과거엔 여기서 offsetRight로
// 또 밀어서 좁아진 영역 밖으로 나가 안 보이는 버그가 있었다).
import { useState } from "react";

import { useReactFlow, useViewport } from "@xyflow/react";

import { DEFAULT_VIEWPORT, MIN_ZOOM } from "./constants";
import { UndoRedoControls } from "./UndoRedoControls";

export function ZoomControls() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, zoomTo, setViewport, getNodes, fitView } = useReactFlow();
  // ⊙ 버튼 토글 상태 — 한 번 누르면 화면 맞춤(줌인), 한 번 더 누르면 최소 줌으로 복귀.
  const [isFitted, setIsFitted] = useState(false);

  return (
    <div
      className="absolute bottom-6 right-6 z-10 flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-sm"
    >
      <UndoRedoControls />
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <span className="w-10 text-center font-mono text-xs text-secondary" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="줌 아웃"
        onClick={() => zoomOut({ duration: 150 })}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        −
      </button>
      <button
        type="button"
        aria-label="줌 인"
        onClick={() => zoomIn({ duration: 150 })}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        +
      </button>
      <button
        type="button"
        aria-label={isFitted ? "최소 줌으로 축소" : "화면 맞춤"}
        onClick={() => {
          // 노드가 없으면(스캐폴드 단계) 토글 없이 기본 뷰포트로 복원
          if (getNodes().length === 0) {
            setViewport(DEFAULT_VIEWPORT, { duration: 200 });
            setIsFitted(false);
            return;
          }
          if (isFitted) {
            // 이미 화면 맞춤 상태 → 다시 누르면 최소 줌으로 축소(중심 좌표는 유지)
            zoomTo(MIN_ZOOM, { duration: 200 });
            setIsFitted(false);
          } else {
            fitView({ duration: 200 });
            setIsFitted(true);
          }
        }}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        ⊙
      </button>
    </div>
  );
}
