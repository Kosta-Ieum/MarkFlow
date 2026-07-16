// 줌 컨트롤 — 화면설계서 §4.4.3: 하단 우측 화이트 필, 줌% / − / + / ⊙(화면 맞춤)
// 우측 패널 폭 보정은 필요 없다 — 이 컴포넌트가 그려지는 CanvasSurface 자체가 이미
// RightPanel과 flex 형제라 패널이 열리면 폭이 저절로 줄어든다(과거엔 여기서 offsetRight로
// 또 밀어서 좁아진 영역 밖으로 나가 안 보이는 버그가 있었다).
import { useReactFlow, useViewport } from "@xyflow/react";

import { DEFAULT_VIEWPORT } from "./constants";

export function ZoomControls() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, setViewport, getNodes, fitView } = useReactFlow();

  return (
    <div
      className="absolute bottom-6 right-6 z-10 flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-sm"
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
