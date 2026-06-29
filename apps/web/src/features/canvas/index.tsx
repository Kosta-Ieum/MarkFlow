// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드 + IEUM-22 [F1-1.2] 노드 카드
// + IEUM-23 [F1-1.3] Zustand 캔버스 스토어(로컬 CRUD).
// 영속화(REST)는 IEUM-27, 실시간 동기화(소켓)는 IEUM-34에서 이 화면에 연결된다.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "../../store/canvasStore";
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { LeftSidebar } from "./LeftSidebar";
import { MarkdownNodeCard } from "./MarkdownNodeCard";
import { RightPanel } from "./RightPanel";
import { seedEdges, seedNodes } from "./seedNodes";
import { ZoomControls } from "./ZoomControls";

const nodeTypes = { markdown: MarkdownNodeCard };

const defaultEdgeOptions = {
  style: { stroke: "#B9B4A7", strokeWidth: 2, strokeDasharray: "6 6" },
  className: "animate-mfdash",
};

function CanvasSurface({
  rightPanelExpanded,
  rightPanelOffset,
}: {
  rightPanelExpanded: boolean;
  rightPanelOffset: number;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);

  return (
    <div className="relative h-full flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
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

  const nodes = useCanvasStore((s) => s.nodes);
  const applyLocalAddNode = useCanvasStore((s) => s.applyLocalAddNode);

  // TODO(IEUM-27): REST로 캔버스 스냅샷 로드. 지금은 스토어가 비어있으면
  // 화면설계서 §4.4.2 시드 흐름으로 초기화해 시각 확인을 가능하게 한다.
  useEffect(() => {
    if (useCanvasStore.getState().nodes.length === 0) {
      useCanvasStore.setState({ nodes: seedNodes, edges: seedEdges });
    }
  }, []);

  const handleAddNode = () => {
    applyLocalAddNode({ x: 0, y: 0 });
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full overflow-hidden bg-canvas">
        <LeftSidebar
          projectId={projectId}
          expanded={leftExpanded}
          onToggle={() => setLeftExpanded((v) => !v)}
          onAddNode={handleAddNode}
          nodeCount={nodes.length}
        />
        <CanvasSurface rightPanelExpanded={rightExpanded} rightPanelOffset={372} />
        <RightPanel expanded={rightExpanded} onToggle={() => setRightExpanded((v) => !v)} />
      </div>
    </ReactFlowProvider>
  );
}
