// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드 + IEUM-22 [F1-1.2] 노드 카드
// + IEUM-23 [F1-1.3] Zustand 캔버스 스토어 + IEUM-27 [F1-2.1] 캔버스↔DB 연동·자동저장
// + IEUM-28 [F1-2.2] 휴지통 드래그드롭 + IEUM-34 [F1-3.1] 실시간 소켓 연결
// + IEUM-35 [F1-3.2] 멀티커서·소프트 락 UI.
import { useEffect, useMemo, useRef, useState } from "react";
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

import { canEdit } from "../../lib/permissions";
import { CANVAS_NODE_EXTENT, emitCursorPosition, useCanvasStore } from "../../store/canvasStore";
import { useAuthStore } from "../../store/authStore";
import { usePresenceStore } from "../../store/presenceStore";
import { CursorOverlay } from "./CursorOverlay";
import { DeletableEdge } from "./DeletableEdge";
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { LeftSidebar } from "./LeftSidebar";
import { MarkdownNodeCard } from "./MarkdownNodeCard";
import { RightPanel, RIGHT_PANEL_EXPANDED_WIDTH } from "./RightPanel";
import { seedEdges, seedNodes } from "./seedNodes";
import { TrashPanel } from "./TrashPanel";
import { ZoomControls } from "./ZoomControls";

const nodeTypes = { markdown: MarkdownNodeCard };
const edgeTypes = { default: DeletableEdge };

const defaultEdgeOptions = {
  style: { stroke: "#B9B4A7", strokeWidth: 2, strokeDasharray: "6 6" },
  className: "animate-mfdash",
};

function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

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
  const applyLocalDeleteNode = useCanvasStore((s) => s.applyLocalDeleteNode);
  const role = useCanvasStore((s) => s.role);
  // VIEWER는 캔버스를 팬·줌으로 "보기"만 — 노드 이동·연결·추가·삭제는 UI에서부터 막는다.
  // (프론트 비활성화는 UX 가드일 뿐, 최종 방어는 서버 — .claude/rules/frontend.md)
  const readOnly = role !== null && !canEdit(role);
  const { screenToFlowPosition } = useReactFlow();

  // 소프트 락: 다른 사용자가 md 편집 중인 노드는 드래그 자체를 시작 못 하게 막는다
  // (§CV realtime — 삭제는 canvasStore.applyLocalDeleteNode가 한 곳에서 막음).
  const locks = usePresenceStore((s) => s.locks);
  const myId = useAuthStore((s) => s.user?.id);
  const renderNodes = useMemo(
    () =>
      nodes.map((n) => {
        const lockedBy = locks[n.id];
        const lockedByOther = !!lockedBy && lockedBy !== myId;
        return lockedByOther ? { ...n, draggable: false } : n;
      }),
    [nodes, locks, myId],
  );

  const trashRef = useRef<HTMLDivElement>(null);
  const [isDragOverTrash, setIsDragOverTrash] = useState(false);

  // §4.4.5 드래그 삭제 로직: 포인터가 휴지통 영역 위에서 mouseup → 휴지통 이동.
  const getPointerPosition = (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if ("clientX" in event) return { x: event.clientX, y: event.clientY };
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleNodeDrag: OnNodeDrag<FlowNode> = (event) => {
    if (readOnly) return;
    const rect = trashRef.current?.getBoundingClientRect();
    const point = getPointerPosition(event);
    setIsDragOverTrash(!!rect && !!point && isPointInRect(point.x, point.y, rect));
  };

  const handleNodeDragStop: OnNodeDrag<FlowNode> = (event, node) => {
    if (readOnly) return;
    const rect = trashRef.current?.getBoundingClientRect();
    const point = getPointerPosition(event);
    if (rect && point && isPointInRect(point.x, point.y, rect)) {
      // 멀티선택 중 여러 노드를 함께 드래그했을 때도 전부 휴지통행 — React Flow는
      // 드래그를 주도한 노드 하나만 콜백 인자로 넘겨주므로, 선택 목록에서 직접 찾는다.
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
      const targetIds = selectedIds.length > 1 && selectedIds.includes(node.id) ? selectedIds : [node.id];
      targetIds.forEach((id) => applyLocalDeleteNode(id));
    }
    setIsDragOverTrash(false);
  };

  // 멀티커서 렌더링(IEUM-35) 전이라도 emit 배선은 여기서 끝내둔다 — 커서 throttle(≈50ms)은
  // useSocketCollab 안에서 처리하므로 여기선 그냥 매 mousemove마다 호출해도 된다.
  //
  // 캔버스 div의 onPointerMove가 아니라 window 리스너로 잡는다 — 실제 마우스가 사이드바
  // 위로 넘어가면(사이드바 z-index가 더 높아 그 지점의 이벤트 타깃이 됨) div 핸들러는
  // 더 이상 안 불려서 위치 전송이 사이드바 경계에서 멈춰버렸다(다른 탭에서 커서가 거기서
  // 멈춘 것처럼 보임). window 레벨에서 받으면 타깃이 무엇이든 버블링으로 항상 잡히므로,
  // 실제 마우스는 계속 추적하고 화면에 가려지는지는 오직 각자 화면의 z-index로만 결정된다.
  const screenToFlowPositionRef = useRef(screenToFlowPosition);
  screenToFlowPositionRef.current = screenToFlowPosition;

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      const flowPos = screenToFlowPositionRef.current({ x: e.clientX, y: e.clientY });
      emitCursorPosition(flowPos);
    };
    window.addEventListener("pointermove", handleWindowPointerMove);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
    };
  }, []);

  return (
    <div className="relative h-full flex-1">
      <div className="absolute left-4 top-4 z-10 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow-sm">
        {saveError ? <span className="text-error">저장 실패</span> : isSaving ? "저장 중…" : "저장됨"}
      </div>
      <ReactFlow
        nodes={renderNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeExtent={CANVAS_NODE_EXTENT}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        panOnScroll
        // VIEWER: 노드 이동·연결은 막고, 팬·줌·선택(보기)만 React Flow 기본 동작으로 허용.
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        // 빈 곳 클릭 시 선택 해제는 React Flow 기본 동작을 그대로 사용.
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#D9D5C9" />
        <MiniMap pannable zoomable className="!bg-surface !border !border-line" />
      </ReactFlow>
      <CursorOverlay />
      <TrashPanel ref={trashRef} isDragOver={isDragOverTrash} />
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
  // 소켓 연결 생명주기는 ProjectCollabLayout(부모 라우트)이 소유한다 — 캔버스↔노드
  // 에디터를 오가도 연결이 유지되어야 해서 더 위로 옮겼다.

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

  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);

  const handleAddNode = () => {
    if (readOnly) return;
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
          nodes={nodes.map((n) => ({ id: n.id, title: n.data.title }))}
        />
        <CanvasSurface rightPanelExpanded={rightExpanded} rightPanelOffset={RIGHT_PANEL_EXPANDED_WIDTH} />
        {/* VIEWER는 소켓이 필요 없다 — 채팅/히스토리도 실시간 계약 위에 있으므로 아예 숨긴다(회색 비활성이 아니라 미노출). */}
        {role !== "VIEWER" && (
          <RightPanel
            projectId={projectId}
            expanded={rightExpanded}
            onToggle={() => {
              setRightExpanded((v) => !v);
            }}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
