// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드 + IEUM-22 [F1-1.2] 노드 카드
// + IEUM-23 [F1-1.3] Zustand 캔버스 스토어 + IEUM-27 [F1-2.1] 캔버스↔DB 연동·자동저장
// + IEUM-28 [F1-2.2] 휴지통 드래그드롭 + IEUM-34 [F1-3.1] 실시간 소켓 연결(연결만 — 멀티커서
// UI 렌더링은 IEUM-35).
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import type { Node as FlowNode, OnNodeDrag } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCollaboration } from "../../collab/useCollaboration";
import type { CollabAPI } from "../../collab/CollabAPI";
import { setActiveCollab, useCanvasStore } from "../../store/canvasStore";
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { LeftSidebar } from "./LeftSidebar";
import { MarkdownNodeCard } from "./MarkdownNodeCard";
import { RightPanel } from "./RightPanel";
import { seedEdges, seedNodes } from "./seedNodes";
import { TrashPanel } from "./TrashPanel";
import { ZoomControls } from "./ZoomControls";

const nodeTypes = { markdown: MarkdownNodeCard };

const defaultEdgeOptions = {
  style: { stroke: "#B9B4A7", strokeWidth: 2, strokeDasharray: "6 6" },
  className: "animate-mfdash",
};

function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function CanvasSurface({
  collab,
  leftSidebarExpanded,
  rightPanelExpanded,
  rightPanelOffset,
}: {
  collab: CollabAPI;
  leftSidebarExpanded: boolean;
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
  const applyLocalDeleteNode = useCanvasStore((s) => s.applyLocalDeleteNode);
  const { screenToFlowPosition } = useReactFlow();

  const trashRef = useRef<HTMLDivElement>(null);
  const [isDragOverTrash, setIsDragOverTrash] = useState(false);

  // §4.4.5 드래그 삭제 로직: 포인터가 휴지통 영역 위에서 mouseup → 휴지통 이동.
  const getPointerPosition = (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if ("clientX" in event) return { x: event.clientX, y: event.clientY };
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleNodeDrag: OnNodeDrag<FlowNode> = (event) => {
    const rect = trashRef.current?.getBoundingClientRect();
    const point = getPointerPosition(event);
    setIsDragOverTrash(!!rect && !!point && isPointInRect(point.x, point.y, rect));
  };

  const handleNodeDragStop: OnNodeDrag<FlowNode> = (event, node) => {
    const rect = trashRef.current?.getBoundingClientRect();
    const point = getPointerPosition(event);
    if (rect && point && isPointInRect(point.x, point.y, rect)) {
      applyLocalDeleteNode(node.id);
    }
    setIsDragOverTrash(false);
  };

  // 멀티커서 렌더링(IEUM-35) 전이라도 emit 배선은 여기서 끝내둔다 — 커서 throttle(≈50ms)은
  // useSocketCollab 안에서 처리하므로 여기선 그냥 매 mousemove마다 호출해도 된다.
  const handlePointerMove = (e: React.MouseEvent) => {
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    collab.emitCursor(flowPos);
  };

  return (
    <div className="relative h-full flex-1" onPointerMove={handlePointerMove}>
      <div className="absolute left-4 top-4 z-10 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow-sm">
        {saveError ? <span className="text-error">저장 실패</span> : isSaving ? "저장 중…" : "저장됨"}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
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
      <TrashPanel ref={trashRef} leftSidebarExpanded={leftSidebarExpanded} isDragOver={isDragOverTrash} />
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
  const collab = useCollaboration(projectId);

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

  // 소켓 연결 생명주기 — canvasStore의 applyLocal*가 emit할 수 있도록 활성 인스턴스로 등록.
  useEffect(() => {
    if (!projectId) return;
    collab.connect(projectId);
    setActiveCollab(collab);
    return () => {
      setActiveCollab(null);
      collab.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
        <CanvasSurface
          collab={collab}
          leftSidebarExpanded={leftExpanded}
          rightPanelExpanded={rightExpanded}
          rightPanelOffset={372}
        />
        <RightPanel expanded={rightExpanded} onToggle={() => setRightExpanded((v) => !v)} />
      </div>
    </ReactFlowProvider>
  );
}
