// 줌 컨트롤 — 화면설계서 §4.4.3: 하단 우측 화이트 필, 줌% / − / + / ⊙(화면 맞춤)
import { useReactFlow, useViewport } from "@xyflow/react";

import { DEFAULT_VIEWPORT } from "./constants";

interface ZoomControlsProps {
  /** 우측 패널이 펼쳐져 있으면 그 너비만큼 띄워 가리지 않게 한다 (§4.4.3) */
  offsetRight?: number;
}

export function ZoomControls({ offsetRight = 0 }: ZoomControlsProps) {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, setViewport, getNodes, fitView } = useReactFlow();

  return (
    <div
      className="absolute bottom-6 z-10 flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-sm transition-[right] duration-200"
      style={{ right: 24 + offsetRight }}
    >
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
        aria-label="화면 맞춤 (초기화)"
        onClick={() => {
          // 노드가 있으면 화면 맞춤, 빈 캔버스(스캐폴드 단계)는 기본 뷰포트로 복원
          if (getNodes().length > 0) {
            fitView({ duration: 200 });
          } else {
            setViewport(DEFAULT_VIEWPORT, { duration: 200 });
          }
        }}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        ⊙
      </button>
    </div>
  );
}
