// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드
// 팬/줌/미니맵/fitView까지만 담당한다. 커스텀 노드 카드(IEUM-22)·Zustand 캔버스
// 스토어(IEUM-23)·실시간 동기화(IEUM-34)는 후속 티켓에서 이 화면에 연결된다.
import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { LeftSidebar } from "./LeftSidebar";
import { RightPanel } from "./RightPanel";
import { ZoomControls } from "./ZoomControls";

function CanvasSurface({
  rightPanelExpanded,
  rightPanelOffset,
}: {
  rightPanelExpanded: boolean;
  rightPanelOffset: number;
}) {
  return (
    <div className="relative h-full flex-1">
      <ReactFlow
        // 노드/엣지는 다음 티켓(IEUM-22 노드 카드, IEUM-23 스토어)에서 연결.
        nodes={[]}
        edges={[]}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        panOnScroll
        // 빈 곳 클릭 시 선택 해제는 React Flow 기본 동작을 그대로 사용.
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#D9D5C9" />
        <MiniMap pannable zoomable className="!bg-surface !border !border-line" />
      </ReactFlow>
      <ZoomControls offsetRight={rightPanelExpanded ? rightPanelOffset : 0} />
    </div>
  );
}

export function CanvasPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(false);

  const handleAddNode = useCallback(() => {
    // 노드 생성 로직은 IEUM-22(노드 카드) + IEUM-23(스토어)에서 구현.
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full overflow-hidden bg-canvas">
        <LeftSidebar
          projectId={projectId}
          expanded={leftExpanded}
          onToggle={() => setLeftExpanded((v) => !v)}
          onAddNode={handleAddNode}
          nodeCount={0}
        />
        <CanvasSurface rightPanelExpanded={rightExpanded} rightPanelOffset={372} />
        <RightPanel expanded={rightExpanded} onToggle={() => setRightExpanded((v) => !v)} />
      </div>
    </ReactFlowProvider>
  );
}
