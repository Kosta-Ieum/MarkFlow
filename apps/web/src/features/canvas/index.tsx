// React Flow 캔버스 화면 — IEUM-21 [F1-1.1] 스캐폴드 + IEUM-22 [F1-1.2] 노드 카드
// + IEUM-23 [F1-1.3] Zustand 캔버스 스토어 + IEUM-27 [F1-2.1] 캔버스↔DB 연동·자동저장
// + IEUM-28 [F1-2.2] 휴지통 드래그드롭 + IEUM-34 [F1-3.1] 실시간 소켓 연결
// + IEUM-35 [F1-3.2] 멀티커서·소프트 락 UI.
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useParams } from "react-router-dom";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import type { Node as FlowNode, OnNodeDrag, XYPosition } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { canEdit } from "../../lib/permissions";
import { beginNodeDrag, CANVAS_NODE_EXTENT, emitCursorPosition, useCanvasStore } from "../../store/canvasStore";
import { useAuthStore } from "../../store/authStore";
import { usePresenceStore } from "../../store/presenceStore";
import { LoadingSplash } from "../../components";
import { CursorOverlay } from "./CursorOverlay";
import { DeletableEdge } from "./DeletableEdge";
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { LeftSidebar } from "./LeftSidebar";
import { MarkdownNodeCard } from "./MarkdownNodeCard";
import { RightPanel } from "./RightPanel";
import { seedEdges, seedNodes } from "./seedNodes";
import { TrashPanel } from "./TrashPanel";
import type { TrashPanelHandle } from "./TrashPanel";
import { ZoomControls } from "./ZoomControls";

const nodeTypes = { markdown: MarkdownNodeCard };
const edgeTypes = { default: DeletableEdge };

const defaultEdgeOptions = {
  style: { stroke: "#B9B4A7", strokeWidth: 2, strokeDasharray: "6 6" },
  className: "animate-mfdash",
};

// 새 노드 생성 위치 기준점 — 캔버스 컨테이너(화면에 보이는 영역) 좌상단에서 이만큼
// 안쪽 지점부터 빈 자리를 찾는다(화면 밖에 생성되면 찾기 어렵다는 피드백 반영).
const ADD_NODE_ORIGIN_MARGIN = 96;

function CanvasSurface({
  addNodeOriginRef,
}: {
  addNodeOriginRef: MutableRefObject<() => XYPosition>;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const isSaving = useCanvasStore((s) => s.isSaving);
  const saveError = useCanvasStore((s) => s.saveError);
  const isLoading = useCanvasStore((s) => s.isLoading);
  const applyLocalDeleteNodes = useCanvasStore((s) => s.applyLocalDeleteNodes);
  const role = useCanvasStore((s) => s.role);
  // VIEWER는 캔버스를 팬·줌으로 "보기"만 — 노드 이동·연결·추가·삭제는 UI에서부터 막는다.
  // (프론트 비활성화는 UX 가드일 뿐, 최종 방어는 서버 — .claude/rules/frontend.md)
  const readOnly = role !== null && !canEdit(role);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // 진입 시 defaultViewport(고정 좌표)가 노드 없는 빈 자리를 잡고 있던 문제 — 로드가 끝나면
  // 실제 노드가 있는 쪽으로 화면을 맞춘다. 프로젝트당 한 번만(재드래그·재정렬마다 또
  // 화면이 튀면 방해되므로), 그리고 그 프로젝트의 로딩 사이클을 실제로 관찰한 뒤에만 실행한다
  // (마운트 시점엔 loadCanvas가 아직 시작 전이라 isLoading이 false·nodes가 빈 스냅샷일 수 있다).
  const projectId = useCanvasStore((s) => s.projectId);
  const fittedProjectRef = useRef<string | null>(null);
  const observedLoadingProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    if (isLoading) {
      observedLoadingProjectRef.current = projectId;
      return;
    }
    if (fittedProjectRef.current === projectId) return;
    if (observedLoadingProjectRef.current !== projectId) return;
    fittedProjectRef.current = projectId;
    if (nodes.length > 0) {
      fitView({ duration: 300, maxZoom: 1 });
    }
  }, [projectId, isLoading, nodes.length, fitView]);

  // "+"로 노드를 추가할 때, 화면에 보이는 캔버스 영역 좌상단 근처부터 빈 자리를 찾도록
  // 좌표 계산 함수를 ref에 매 렌더 최신화해둔다(LeftSidebar 클릭 → CanvasPage가 호출).
  const surfaceRef = useRef<HTMLDivElement>(null);
  addNodeOriginRef.current = () => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToFlowPosition({
      x: rect.left + ADD_NODE_ORIGIN_MARGIN,
      y: rect.top + ADD_NODE_ORIGIN_MARGIN,
    });
  };

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

  const trashRef = useRef<TrashPanelHandle>(null);
  const [isDragOverTrash, setIsDragOverTrash] = useState(false);
  // 휴지통 드롭 삭제의 복구 좌표 — 삭제 순간 좌표는 휴지통 앞이라, 드래그 시작 위치를 잡아둔다.
  const dragStartRef = useRef<Map<string, XYPosition>>(new Map());
  // 드래그 중인 카드가 휴지통 목록 뒤로 가려지던 문제 — React Flow가 드래그 중인 노드에 주는
  // z-index 상승(elevateNodesOnSelect)은 캔버스 자신의 팬·줌 변환(.react-flow__viewport의
  // transform)이 만드는 스태킹 컨텍스트 안에 갇혀서, 그 컨텍스트 밖에 있는 휴지통과는 애초에
  // 비교되지 않는다 — 그래서 노드 쪽 z-index를 아무리 올려도 안 먹혔다. 대신 캔버스 컨테이너
  // 자체(.react-flow)를 드래그 중에만 휴지통보다 위로 올린다. className(Tailwind 유틸리티)
  // 대신 인라인 style을 쓰는 이유: 라이브러리 자체 스타일시트(@xyflow/react/dist/style.css)의
  // 로드 순서에 따라 같은 우선순위의 클래스가 뒤늦게 덮어써 무시되는 문제가 있었다 — 인라인
  // style은 그 어떤 외부 스타일시트 규칙보다도 항상 우선한다.
  const [isNodeDragging, setIsNodeDragging] = useState(false);

  // Shift+드래그 마퀴 선택 — React Flow 기본은 매번 박스 안 노드로 선택을 "교체"한다.
  // 멀리 있는 노드를 추가로 잡으려면 일일이 화면을 옮겨서 한 박스 안에 다 넣어야 해서
  // 번거롭다는 피드백 — 새 박스를 그리기 직전의 선택 상태를 기억해뒀다가, 드래그가
  // 끝나면 그 목록도 다시 선택 상태로 되돌려 "합집합"이 되게 한다.
  //
  // React Flow의 onSelectionStart는 실제로는 "드래그 임계값을 넘은 첫 pointermove"에서
  // 호출되는데, 그 콜백이 불리기 *직전*에 내부적으로 이미 resetSelectedElements()를 먼저
  // 실행해버린다 — 그래서 onSelectionStart 시점엔 항상 선택이 이미 비어 있어서(스냅샷이
  // 늘 빈 Set), 이전 시도(onSelectionStart에서 스냅샷)가 전혀 동작하지 않았다. 그보다 더
  // 이른 시점인 pointerdown의 캡처 단계(부모 div → 자식 pane 순서로 먼저 도착)에서 미리
  // 스냅샷을 떠 둔다.
  const preservedSelectionRef = useRef<Set<string> | null>(null);
  const handlePointerDownCapture = () => {
    preservedSelectionRef.current = new Set(
      useCanvasStore.getState().nodes.filter((n) => n.selected).map((n) => n.id),
    );
  };
  const handleSelectionEnd = () => {
    const preserved = preservedSelectionRef.current;
    preservedSelectionRef.current = null;
    if (!preserved || preserved.size === 0) return;
    useCanvasStore.setState((state) => ({
      nodes: state.nodes.map((n) => (preserved.has(n.id) && !n.selected ? { ...n, selected: true } : n)),
    }));
  };

  // §4.4.5 드래그 삭제 로직: 포인터가 휴지통 영역 위에서 mouseup → 휴지통 이동.
  // 휴지통 목록이 펼쳐져 있으면 그 목록 영역에 놓는 것도 인정한다(TrashPanel이 직접 판단).
  const getPointerPosition = (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if ("clientX" in event) return { x: event.clientX, y: event.clientY };
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleNodeDrag: OnNodeDrag<FlowNode> = (event) => {
    if (readOnly) return;
    const point = getPointerPosition(event);
    setIsDragOverTrash(!!point && !!trashRef.current?.isPointOver(point.x, point.y));
  };

  const handleNodeDragStop: OnNodeDrag<FlowNode> = (event, node) => {
    if (readOnly) return;
    const point = getPointerPosition(event);
    if (point && trashRef.current?.isPointOver(point.x, point.y)) {
      // 멀티선택 중 여러 노드를 함께 드래그했을 때도 전부 휴지통행 — React Flow는
      // 드래그를 주도한 노드 하나만 콜백 인자로 넘겨주므로, 선택 목록에서 직접 찾는다.
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
      const targetIds = selectedIds.length > 1 && selectedIds.includes(node.id) ? selectedIds : [node.id];
      applyLocalDeleteNodes(targetIds, dragStartRef.current);
    }
    setIsDragOverTrash(false);
    setIsNodeDragging(false);
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
    <div ref={surfaceRef} className="relative h-full flex-1" onPointerDownCapture={handlePointerDownCapture}>
      {/* VIEWER는 편집 자체를 못 하니 저장 상태 표시가 의미 없다 — 뷰어에겐 아예 숨긴다. */}
      {!readOnly && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 select-none rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow-sm">
          {saveError ? <span className="text-error">저장 실패</span> : isSaving ? "저장 중…" : "저장됨"}
        </div>
      )}
      {/* ReactFlow 컴포넌트에 직접 style/className으로 z-index를 주는 시도는 라이브러리 내부
          prop 병합 방식에 좌우돼 신뢰할 수 없었다 — 우리가 완전히 소유한 별도 wrapper div에
          z-index를 주고 그 안에 ReactFlow를 넣어, 병합 로직과 무관하게 확실히 적용되게 한다. */}
      <div className="absolute inset-0" style={isNodeDragging ? { zIndex: 20 } : undefined}>
        <ReactFlow
          nodes={renderNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={(_, _node, dragged) => {
            dragStartRef.current = new Map(dragged.map((n) => [n.id, { ...n.position }]));
            beginNodeDrag(dragged);
            setIsNodeDragging(true);
          }}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodeExtent={CANVAS_NODE_EXTENT}
          // 노드가 갈 수 있는 한계(nodeExtent)보다 더 먼 빈 공간까지 패닝해서 보여줄 필요는
          // 없다는 피드백 — 팬 가능 범위를 노드 한계와 동일하게 맞춘다.
          translateExtent={CANVAS_NODE_EXTENT}
          defaultEdgeOptions={defaultEdgeOptions}
          defaultViewport={DEFAULT_VIEWPORT}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          // 핸들 정중앙에 정확히 놓아야만 연결선이 붙던 게 너무 빡빡하다는 피드백 —
          // 기본 20px에서 넓혀 핸들 주변 적당한 범위에 놓아도 연결되게 한다.
          connectionRadius={40}
          panOnScroll
          // 기본값은 Backspace+Delete 둘 다인데, 텍스트 편집 중 Backspace를 누르다 실수로
          // 노드가 삭제되는 걸 막기 위해 Delete 키만 허용한다.
          deleteKeyCode="Delete"
          // 노드 삭제는 배치 액션으로 직접 처리하고 React Flow 기본 삭제 흐름은 취소한다.
          // 기본 흐름은 연결 엣지를 onEdgesChange의 remove로 흘려보내 각각 "엣지 해제"
          // undo로 따로 기록해버려, Delete로 그룹을 지운 뒤 한 번 undo하면 노드만 돌아오고
          // 엣지는 별도 스텝에 남아 사라진 것처럼 보였다. onBeforeDelete에서 가로채 배치
          // 삭제(연결 엣지 캡처 + 단일 undo 스텝)로 통일한다. 엣지만 삭제할 땐 기본 흐름 유지.
          onBeforeDelete={async ({ nodes: deletingNodes }) => {
            if (deletingNodes.length === 0) return true;
            applyLocalDeleteNodes(deletingNodes.map((n) => n.id));
            return false;
          }}
          // VIEWER: 노드 이동·연결은 막고, 팬·줌·선택(보기)만 React Flow 기본 동작으로 허용.
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          // 기본값(Meta/Ctrl)이 아니라 Shift로 노드를 개별 클릭해도 기존 선택에 추가/해제되게 —
          // 마퀴 선택(Shift+드래그)과 같은 키를 써서 "Shift를 누른 채로 드래그든 클릭이든 계속
          // 선택이 누적"되는 느낌을 준다.
          multiSelectionKeyCode="Shift"
          onSelectionEnd={handleSelectionEnd}
          // 빈 곳 클릭 시 선택 해제는 React Flow 기본 동작을 그대로 사용.
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#D9D5C9" />
          {/* ZoomControls(bottom-6, 우측 하단 필)와 같은 모서리에 기본 배치돼 서로 겹치던 문제 —
              미니맵을 그만큼 위로 띄워 자리를 분리한다. */}
          <MiniMap
            pannable
            zoomable
            className="!bg-surface !border !border-line"
            style={{ marginBottom: 56 }}
          />
        </ReactFlow>
      </div>
      <CursorOverlay />
      <TrashPanel ref={trashRef} isDragOver={isDragOverTrash} />
      {/* CanvasSurface 자신이 이미 RightPanel과 flex 형제라 패널이 열리면 폭이 저절로
          줄어든다 — 여기서 또 offsetRight로 밀면 좁아진 영역 밖으로 나가 안 보이게 된다
          (이중 보정 버그). 우측 패널 폭 보정은 필요 없다. undo/redo 버튼은 pill 내부 인라인. */}
      <ZoomControls />
      {/* 로딩 중 조작 차단은 스플래시가 포인터 이벤트를 삼키는 것으로 충분 — 별도 가드 없음. */}
      {isLoading && <LoadingSplash />}
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
    useCanvasStore.getState().loadCanvas(projectId).catch(async (err) => {
      // 동적 import로 ApiError를 가져와 404 처리
      const { ApiError } = await import("../../lib/api");
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        if (err.status === 404) {
          alert("프로젝트가 삭제되어 프로젝트 목록으로 이동합니다.");
        } else {
          alert("프로젝트 접근 권한이 없어 목록으로 이동합니다.");
        }
        window.location.href = "/projects";
        return;
      }
      
      // BE 캔버스 REST(IEUM-24/25)가 아직 구현 전이면 로드가 실패한다 —
      // 화면설계서 §4.4.2 시드 흐름으로 폴백해 시각 확인을 가능하게 한다.
      if (useCanvasStore.getState().nodes.length === 0) {
        useCanvasStore.setState({ nodes: seedNodes, edges: seedEdges, isLoading: false });
      }
    });
  }, [projectId]);

  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);

  // CanvasPage는 ReactFlowProvider 밖(그 자체를 렌더하는 쪽)이라 useReactFlow를 못 쓴다 —
  // 실제 화면 좌표 계산은 Provider 안의 CanvasSurface가 담당하고, 이 ref로 그 결과 함수를
  // 최신 상태로 받아온다("+"를 누른 시점의 화면에 보이는 영역 기준으로 위치를 정하기 위함).
  const addNodeOriginRef = useRef<() => XYPosition>(() => ({ x: 0, y: 0 }));

  const handleAddNode = () => {
    if (readOnly) return;
    applyLocalAddNode(addNodeOriginRef.current());
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
        <CanvasSurface addNodeOriginRef={addNodeOriginRef} />
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
