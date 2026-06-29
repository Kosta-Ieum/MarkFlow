// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드 + IEUM-22 [F1-1.2] 노드 카드
// + IEUM-23 [F1-1.3] Zustand 캔버스 스토어 + IEUM-27 [F1-2.1] 캔버스↔DB 연동·자동저장.
// 실시간 동기화(소켓)는 IEUM-34에서 이 화면에 연결된다.
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
  const isSaving = useCanvasStore((s) => s.isSaving);
  const saveError = useCanvasStore((s) => s.saveError);

  return (
    <div className="relative h-full flex-1">
      <div className="absolute left-4 top-4 z-10 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow-sm">
        {saveError ? <span className="text-error">저장 실패</span> : isSaving ? "저장 중…" : "저장됨"}
      </div>
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

  useEffect(() => {
    if (!projectId) return;
    useCanvasStore.getState().loadCanvas(projectId).catch(() => {
      // BE 캔버스 REST(IEUM-24/25)가 아직 구현 전이면 로드가 실패한다 —
      // 화면설계서 §4.4.2 시드 흐름으로 폴백해 시각 확인을 가능하게 한다.
      if (useCanvasStore.getState().nodes.length === 0) {
        useCanvasStore.setState({ nodes: seedNodes, edges: seedEdges, isLoading: false });
      }
    });
  }, [projectId]);

  const handleAddNode = () => {
    applyLocalAddNode({ x: 0, y: 0 });
  };

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
