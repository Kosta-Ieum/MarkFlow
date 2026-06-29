// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드 + IEUM-22 [F1-1.2] 노드 카드
// 노드/엣지는 아직 시드 데이터(seedNodes.ts)다 — 실제 CRUD·영속화는 Zustand 캔버스
// 스토어(IEUM-23)에서 이 화면에 연결되고, 실시간 동기화는 IEUM-34에서 연결된다.
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { LeftSidebar } from "./LeftSidebar";
import { MarkdownNodeCard, type MarkdownNodeData } from "./MarkdownNodeCard";
import { RightPanel } from "./RightPanel";
import { seedEdges, seedNodes } from "./seedNodes";
import { ZoomControls } from "./ZoomControls";

const nodeTypes = { markdown: MarkdownNodeCard };

const defaultEdgeOptions = {
  style: { stroke: "#B9B4A7", strokeWidth: 2, strokeDasharray: "6 6" },
  className: "animate-mfdash",
};

function CanvasSurface({
  nodes,
  edges,
  rightPanelExpanded,
  rightPanelOffset,
}: {
  nodes: Node<MarkdownNodeData>[];
  edges: Edge[];
  rightPanelExpanded: boolean;
  rightPanelOffset: number;
}) {
  return (
    <div className="relative h-full flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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

  // TODO(IEUM-23): Zustand 캔버스 스토어로 교체. 지금은 시드 데이터만 보여준다.
  const nodes = useMemo(() => seedNodes, []);
  const edges = useMemo(() => seedEdges, []);

  const handleAddNode = useCallback(() => {
    // 노드 생성은 Zustand 캔버스 스토어(IEUM-23)에서 구현.
  }, []);

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
        <CanvasSurface
          nodes={nodes}
          edges={edges}
          rightPanelExpanded={rightExpanded}
          rightPanelOffset={372}
        />
        <RightPanel expanded={rightExpanded} onToggle={() => setRightExpanded((v) => !v)} />
      </div>
    </ReactFlowProvider>
  );
}
