// nodes·edges (applyLocal/applyRemote) — IEUM-23 [F1-1.3] 로컬 CRUD + IEUM-34 [F1-3.1] 실시간 emit
// 단일 진실원(.claude/rules/frontend.md): React Flow·노드카드는 이 store만 구독/호출한다.
// applyLocal*  = 내 동작 — 로컬 반영 + activeCollab으로 emit (echo 루프 방지: 내가 보낸 것만 emit)
// applyRemote* = 원격 수신 적용 전용 (재emit 금지) — 호출자는 collab/useSocketCollab.ts
import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type { Edge, EdgeChange as FlowEdgeChange, Node, NodeChange as FlowNodeChange, OnConnect, XYPosition } from "@xyflow/react";
import type { EdgeDTO, NodeDTO, NodeType, Role, XY } from "@markflow/shared";

import {
  deleteNode as deleteNodeApi,
  fetchCanvas,
  fetchTrash,
  purgeNode as purgeNodeApi,
  restoreNode as restoreNodeApi,
  saveCanvasSnapshot,
  type TrashNode,
} from "../lib/canvasApi";
import type { CollabAPI } from "../collab/CollabAPI";
import { queryClient } from "../lib/queryClient";
import { queryKeys } from "../lib/queryKeys";
import { useAuthStore } from "./authStore";
import { useHistoryStore } from "./historyStore";
import { usePresenceStore } from "./presenceStore";

// 히스토리 전용 실시간 이벤트가 아직 없어(SOCKET_EVENTS 미정의), 구조적 변경(생성·삭제·
// 복원·연결)을 수행한 "본인" 화면에서도 REST 응답을 기다리지 않고 바로 history 쿼리를
// 무효화한다 — 원격 수신 쪽 무효화는 useSocketCollab.ts가 별도로 담당.
function invalidateHistory(projectId: string | null): void {
  if (!projectId) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.history(projectId) });
}

/** 소프트 락: 다른 사용자가 md 편집 중인 노드인지 — 이동·삭제 차단에 공용으로 쓴다. */
function isLockedByOther(nodeId: string): boolean {
  const lockedBy = usePresenceStore.getState().locks[nodeId];
  const myId = useAuthStore.getState().user?.id;
  return !!lockedBy && lockedBy !== myId;
}

// BE 노드 REST(IEUM-24)가 아직 스텁이라 호출이 실패할 수 있다 — 화면은 항상 로컬
// 낙관적 업데이트를 먼저 반영하고, REST는 "되면 되는" fire-and-forget으로 보낸다.
function fireAndForget(promise: Promise<unknown>) {
  promise.catch((err) => console.warn("[canvas] 서버 동기화 실패(BE 구현 전이면 정상):", err));
}

// 현재 연결된 CollabAPI 인스턴스 — store는 React 훅을 직접 못 쓰므로 CanvasPage가
// useCollaboration()을 호출한 뒤 이 함수로 등록/해제한다(연결 안 됐으면 emit은 그냥 no-op).
let activeCollab: CollabAPI | null = null;
export function setActiveCollab(collab: CollabAPI | null): void {
  activeCollab = collab;
}

/** 소프트 락 획득/해제 — 카드 컴포넌트(MarkdownNodeCard)가 편집 진입/이탈 시 호출. */
export function requestNodeLock(nodeId: string | null): void {
  activeCollab?.emitLock(nodeId);
}

// 노드 이동 undo/redo(R2.3, R2.7): 드래그 1회 = 1 step. onNodeDragStart에서 함께 끌리는
// 노드들의 시작 좌표를 잡아두고, onNodesChange 커밋 시점에 현재 좌표와 비교해 record 1회.
// 멀티선택 드래그도 한 맵에 담겨 1 step으로 묶인다.
let dragStartPositions: Map<string, XYPosition> | null = null;
export function beginNodeDrag(nodes: { id: string; position: XYPosition }[]): void {
  dragStartPositions = new Map(nodes.map((n) => [n.id, { ...n.position }]));
}

/** 커서 위치 emit — CanvasSurface의 pointermove에서 호출(throttle은 collab 구현체 내부). */
export function emitCursorPosition(p: XY): void {
  activeCollab?.emitCursor(p);
}

/**
 * 채팅 전송 — ChatThread(MessageComposer)가 호출. 컴포넌트가 useCollaboration()을 또
 * 호출하면 connect() 안 된 별개 인스턴스가 생겨 emit이 no-op이 된다 — 반드시 이걸 통해서만.
 */
export function sendChatMessage(content: string): void {
  activeCollab?.sendChat(content);
}

/**
 * 노드 변경 emit만 — 로컬 store(nodes)는 호출자가 이미 갱신했거나(REST가 단일 진실원인
 * 화면, 예: 노드 에디터) 별도 관리 중인 경우에 쓴다. canvasStore의 nodes도 같이 바꾸려면
 * applyLocalUpdateNode를 쓸 것 — 이건 emit 전용 우회로다.
 */
export function emitNodeUpdate(node: Partial<NodeDTO> & { id: string }): void {
  activeCollab?.emitNode({ type: "update", node });
}

const AUTOSAVE_DEBOUNCE_MS = 2000; // .claude/rules/frontend.md: 저장 debounce ≈2s

// 신규/복원 노드 배치 — 카드 실제 크기(MarkdownNodeCard: w-[186px], 접힘 상태 높이 ≈88px)를
// 기준으로 그리드 슬롯을 순서대로 훑어, 현재 캔버스에 있는 노드들과 실제로 안 겹치는 자리를
// 찾는다(단순 순번 증가가 아니라 매번 현재 nodes 배열을 검사 — 사용자가 노드를 옮겨서
// 그리드 슬롯 자리를 차지하고 있어도 정확히 피해간다).
const NODE_WIDTH = 186;
const NODE_HEIGHT_APPROX = 88;
const GRID_GAP = 24;
const GRID_STEP_X = NODE_WIDTH + GRID_GAP;
const GRID_STEP_Y = NODE_HEIGHT_APPROX + GRID_GAP;
const GRID_COLS = 4;
const MAX_GRID_SLOTS = 500; // 사실상 도달 안 하는 안전장치
// 노드 드래그 허용 범위(flow 좌표계) — 캔버스 바깥으로 완전히 나가 못 찾게 되는 것 방지.
export const CANVAS_NODE_EXTENT: [[number, number], [number, number]] = [
  [-1000, -1000],
  [6000, 6000],
];

function overlapsCard(a: XYPosition, b: XYPosition): boolean {
  return Math.abs(a.x - b.x) < GRID_STEP_X && Math.abs(a.y - b.y) < GRID_STEP_Y;
}

// 여러 개를 연달아 추가/복원할 때(예: 휴지통 항목을 하나씩 계속 복원), 매번 "지금 보이는
// 화면"에서 새로 기준점을 잡으면 그사이 사용자가 캔버스를 조금이라도 패닝·줌했을 때 그리드
// 한 줄이 통째로 빈 것처럼 보이는 이가 생긴다(이전 배치와 새 배치가 서로 다른 기준점에서
// 시작해 어긋남). 짧은 시간(ORIGIN_REUSE_WINDOW_MS) 안에 연달아 호출되면 같은 기준점을
// 그대로 재사용해 하나의 그리드로 이어붙게 한다 — 오래 쉬었다 돌아오면(정말 다른 세션) 그때는
// 새로 보이는 화면 기준으로 다시 잡는다.
const ORIGIN_REUSE_WINDOW_MS = 5000;
let lastOrigin: XYPosition | null = null;
let lastOriginAt = 0;

function resolveOrigin(candidate: XYPosition): XYPosition {
  const now = Date.now();
  const reused = lastOrigin && now - lastOriginAt < ORIGIN_REUSE_WINDOW_MS ? lastOrigin : candidate;
  lastOrigin = reused;
  lastOriginAt = now;
  return reused;
}

// 새 노드 기본 이름 번호(R3) — "현재 개수+1"은 삭제 후 번호가 중복됐다. 캔버스+휴지통의
// "새 노드 <숫자>" 제목 중 최대 번호+1을 쓰면 눈에 보이는 노드와는 절대 안 겹친다.
// (동시 생성 시 이론상 중복 가능하나 제목은 중복 허용 — spec 승인된 트레이드오프.)
const DEFAULT_NODE_TITLE = /^새 노드 (\d+)$/;
function nextDefaultNodeNumber(titled: { data: { title: string } }[]): number {
  let max = 0;
  for (const n of titled) {
    const m = DEFAULT_NODE_TITLE.exec(n.data.title);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** origin에서 시작해 그리드를 훑으며 existing과 실제로 안 겹치는 첫 자리를 반환한다. */
function findFreePosition(origin: XYPosition, existing: { position: XYPosition }[]): XYPosition {
  for (let seq = 0; seq < MAX_GRID_SLOTS; seq++) {
    const candidate = {
      x: origin.x + (seq % GRID_COLS) * GRID_STEP_X,
      y: origin.y + Math.floor(seq / GRID_COLS) * GRID_STEP_Y,
    };
    if (!existing.some((n) => overlapsCard(candidate, n.position))) return candidate;
  }
  return origin;
}

export interface MarkdownNodeData extends Record<string, unknown> {
  title: string;
  markdown: string;
  type: NodeType;
  collapsed: boolean;
  /** 휴지통 정렬(최신순)용 — 살아있는 노드에는 없고, 소프트 삭제될 때만 채워진다. */
  deletedAt?: string;
}

export type CanvasNode = Node<MarkdownNodeData>;

interface CanvasState {
  nodes: CanvasNode[];
  edges: Edge[];
  /** 소프트 삭제된 노드 — 휴지통(IEUM-28)에서 사용. 복구 시 엣지는 미복원(§CV-16). */
  trashedNodes: CanvasNode[];

  projectId: string | null;
  /** GET canvas 응답의 project.name — LeftSidebar 헤더가 projectId 대신 이걸 표시한다. */
  projectName: string | null;
  /** GET canvas 응답의 project.role — VIEWER는 뷰(팬·줌)만 허용, 편집 UI는 비활성화(UX 가드, 서버가 최종). */
  role: Role | null;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveTimer: ReturnType<typeof setTimeout> | null;

  // GET/PUT /projects/:id/canvas (openapi 정본) — IEUM-27
  loadCanvas: (projectId: string) => Promise<void>;
  saveCanvas: () => Promise<void>;
  scheduleSave: () => void;
  /** sync:init/sync:resync 수신 시 캔버스 전체를 원격 스냅샷으로 교체(재emit 금지) */
  applyRemoteSnapshot: (nodes: NodeDTO[], edges: EdgeDTO[]) => void;

  // React Flow 이벤트 바인딩 — 로컬 선택/드래그만 처리. 삭제(remove)는 무시하고
  // applyLocalDeleteNode를 통해서만 소프트 삭제한다(하드 삭제 경로 차단).
  onNodesChange: (changes: FlowNodeChange[]) => void;
  onEdgesChange: (changes: FlowEdgeChange[]) => void;
  onConnect: OnConnect;

  /** 노드 리스트(LeftSidebar) 클릭 시 캔버스에서 해당 노드만 선택 상태로 — 순수 로컬 UI, emit 없음. */
  selectNode: (id: string) => void;

  applyLocalAddNode: (position: XYPosition, type?: NodeType) => string;
  applyLocalUpdateNode: (id: string, patch: Partial<Pick<MarkdownNodeData, "title" | "markdown" | "type">>) => void;
  applyLocalToggleCollapse: (id: string) => void;
  applyLocalDeleteNode: (id: string) => void;
  /** 멀티선택 일괄 삭제 — 전체가 undo 1 step으로 기록된다. 단건 호출은 applyLocalDeleteNode와 동일.
   * restorePositions: 휴지통 드래그처럼 삭제 순간 좌표가 원래 자리가 아닐 때, 복구될 좌표를 지정. */
  applyLocalDeleteNodes: (ids: string[], restorePositions?: ReadonlyMap<string, XYPosition>) => void;
  /** origin을 주면(화면에 보이는 영역 기준) 그 근처의 안 겹치는 자리로 복원하고, 다른
   * 클라이언트에도 그 위치로 맞추도록 동기화한다. 생략하면 삭제 전 원래 좌표 그대로 복원. */
  applyLocalRestoreNode: (id: string, origin?: XYPosition) => void;
  /** 영구삭제(물리 삭제) — §CV-16 */
  applyLocalPermanentDeleteNode: (id: string) => void;
  applyLocalAddEdge: (source: string, target: string) => void;
  applyLocalDeleteEdge: (id: string) => void;
  /** BE가 엣지 생성 시 자체 ID를 새로 발급하므로, ack로 받은 진짜 ID로 로컬 임시 ID를 교체한다. */
  reconcileEdgeId: (localId: string, edge: EdgeDTO) => void;

  // --- undo/redo(historyStore) 전용 보조 액션 — 경로는 기존 applyLocal*과 동일(emit+저장) ---
  /** 주어진 id 그대로 엣지 재생성 — id가 바뀌면 undo/redo 체인이 끊긴다. 중복 id는 멱등 no-op. */
  applyLocalAddEdgeWithId: (edge: EdgeDTO) => void;
  /** 드래그 없이 위치만 재적용(이동 되돌리기) — 커밋된 드래그와 동일하게 전파. */
  applyLocalMoveNode: (id: string, position: XYPosition) => void;

  applyRemoteAddNode: (node: CanvasNode) => void;
  applyRemoteUpdateNode: (id: string, patch: Partial<MarkdownNodeData>, position?: XYPosition) => void;
  applyRemoteDeleteNode: (id: string) => void;
  applyRemoteAddEdge: (edge: Edge) => void;
  applyRemoteDeleteEdge: (id: string) => void;
}

const newId = () => crypto.randomUUID();

export function toNodeDTO(node: CanvasNode): NodeDTO {
  return {
    id: node.id,
    type: node.data.type,
    title: node.data.title,
    markdown: node.data.markdown,
    collapsed: node.data.collapsed,
    position: node.position,
  };
}

export function fromNodeDTO(dto: NodeDTO): CanvasNode {
  return {
    id: dto.id,
    type: "markdown",
    position: dto.position,
    data: { title: dto.title, markdown: dto.markdown, type: dto.type, collapsed: dto.collapsed },
  };
}

// 휴지통 REST(TrashNode)는 markdown/position이 BE 계약 변경 요청 중이라 아직 없을 수 있다 —
// 누락 시 빈 값으로 채워 휴지통 카드가 깨지지 않게만 한다(§CV-16).
export function fromTrashNodeDTO(dto: TrashNode): CanvasNode {
  return {
    id: dto.id,
    type: "markdown",
    position: dto.position ?? { x: 0, y: 0 },
    data: { title: dto.title, markdown: dto.markdown ?? "", type: dto.type, collapsed: true, deletedAt: dto.deletedAt },
  };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  trashedNodes: [],
  projectId: null,
  projectName: null,
  role: null,
  isLoading: false,
  isSaving: false,
  saveError: null,
  saveTimer: null,

  loadCanvas: async (projectId) => {
    set({ isLoading: true, saveError: null, projectId });
    try {
      const snapshot = await fetchCanvas(projectId);
      set({
        nodes: snapshot.nodes.map(fromNodeDTO),
        edges: snapshot.edges,
        projectName: snapshot.project.name,
        role: snapshot.project.role as Role,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
    // 휴지통은 새로고침 시 유실되던 문제(§CV-16) — REST에서 재조회해 복원한다.
    // 캔버스 본문과 독립된 화면 영역이라 실패해도 캔버스 로딩 자체는 막지 않는다.
    try {
      const trash = await fetchTrash(projectId);
      set({ trashedNodes: trash.nodes.map(fromTrashNodeDTO) });
    } catch (err) {
      console.warn("[canvas] 휴지통 목록 조회 실패:", err);
    }
  },

  saveCanvas: async () => {
    const { projectId, nodes, edges } = get();
    if (!projectId) return;
    set({ isSaving: true, saveError: null });
    try {
      await saveCanvasSnapshot(projectId, { nodes: nodes.map(toNodeDTO), edges });
      set({ isSaving: false });
    } catch (err) {
      set({ isSaving: false, saveError: err instanceof Error ? err.message : "저장 실패" });
    }
  },

  scheduleSave: () => {
    const { saveTimer, projectId } = get();
    if (!projectId) return;
    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(() => {
      void get().saveCanvas();
    }, AUTOSAVE_DEBOUNCE_MS);
    set({ saveTimer: timer });
  },

  applyRemoteSnapshot: (nodes, edges) => {
    set({ nodes: nodes.map(fromNodeDTO), edges });
  },

  onNodesChange: (changes) => {
    // 소프트 락: 다른 사용자가 md 편집 중인 노드는 이동도 막는다 — 멀티선택으로 함께 끌려온
    // 경우(React Flow가 선택된 노드를 draggable 여부와 무관하게 같이 옮기는 케이스)까지
    // 막으려면 position 변경 자체를 여기서 걸러야 한다(개별 노드 draggable=false만으론 부족).
    // remove(Delete/Backspace 키 기본 동작)는 React Flow가 하드 삭제로 바로 적용하게 두지
    // 않고, applyLocalDeleteNode(휴지통 소프트 삭제 + 락 체크 + 실시간 브로드캐스트)를
    // 거치도록 아래에서 따로 처리한다.
    const removedIds = changes.filter((c) => c.type === "remove").map((c) => c.id);
    const nonRemove = changes.filter(
      (c) => c.type !== "remove" && !(c.type === "position" && isLockedByOther(c.id)),
    );
    set((state) => ({ nodes: applyNodeChanges(nonRemove, state.nodes) as CanvasNode[] }));
    get().scheduleSave();
    get().applyLocalDeleteNodes(removedIds);

    // 드래그 완료(커밋) 시점의 최종 위치만 실시간 전파 — 매 프레임 emit하면
    // 네트워크가 막히고 드롭 후 잔상이 생긴다(과거 프로토타입에서 겪은 문제).
    const committed = nonRemove.filter(
      (c): c is FlowNodeChange & { type: "position"; id: string; dragging: false } =>
        c.type === "position" && c.dragging === false,
    );
    if (committed.length === 0) return;
    const nodesById = new Map(get().nodes.map((n) => [n.id, n]));
    if (activeCollab) {
      for (const c of committed) {
        const node = nodesById.get(c.id);
        if (node) activeCollab.emitNode({ type: "update", node: { id: node.id, position: node.position } });
      }
    }

    // undo/redo 기록 — 드래그 시작 좌표(beginNodeDrag) 대비 실제로 움직인 노드만 1 step으로.
    // 위치가 전부 불변이면(클릭·제자리 드롭) 기록 생략. emit 연결 여부와 무관하게 로컬 스택에 쌓는다.
    const starts = dragStartPositions;
    if (starts) {
      const moves: { id: string; from: XYPosition; to: XYPosition }[] = [];
      for (const c of committed) {
        const from = starts.get(c.id);
        const node = nodesById.get(c.id);
        if (!from || !node) continue;
        if (from.x !== node.position.x || from.y !== node.position.y) {
          moves.push({ id: c.id, from, to: { ...node.position } });
        }
      }
      dragStartPositions = null;
      if (moves.length > 0) {
        useHistoryStore.getState().record({
          label: "노드 이동",
          undo: () => moves.forEach((m) => get().applyLocalMoveNode(m.id, m.from)),
          redo: () => moves.forEach((m) => get().applyLocalMoveNode(m.id, m.to)),
          nodeIds: moves.map((m) => m.id),
        });
      }
    }
  },

  onEdgesChange: (changes) => {
    // remove는 React Flow 기본 처리(Backspace 등)로 흘려보내지 않고 applyLocalDeleteEdge를
    // 거치게 한다 — 안 그러면 emit이 빠져 삭제가 남의 화면에 실시간 반영되지 않는다.
    const removedIds = changes
      .filter((c): c is Extract<FlowEdgeChange, { type: "remove" }> => c.type === "remove")
      .map((c) => c.id);
    const nonRemove = changes.filter((c) => c.type !== "remove");
    set((state) => ({ edges: applyEdgeChanges(nonRemove, state.edges) }));
    get().scheduleSave();
    // 노드 삭제 시 연결된 엣지가 이미 로컬 state.edges에서 지워졌는데, React Flow가 그
    // 엣지에 대해 별도로 remove 변경을 또 보내는 경우가 있다 — 이미 없는 엣지면 서버(BE가
    // 노드 소프트삭제 트랜잭션에서 이미 물리삭제함)에 또 삭제 요청을 보내지 않는다(404 방지).
    removedIds.forEach((id) => {
      if (get().edges.some((e) => e.id === id)) get().applyLocalDeleteEdge(id);
    });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    get().applyLocalAddEdge(connection.source, connection.target);
  },

  selectNode: (id) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })),
    }));
  },

  applyLocalAddNode: (position, type = "idea") => {
    const id = newId();
    const { nodes, trashedNodes } = get();
    // 매번 같은 좌표·이름으로 생성하면 연속 추가 시 노드가 그대로 겹친다 — 현재 캔버스에 있는
    // 노드들과 실제로 안 겹치는 자리를 찾아 배치한다(findFreePosition).
    const node: CanvasNode = {
      id,
      type: "markdown",
      position: findFreePosition(resolveOrigin(position), nodes),
      data: {
        title: `새 노드 ${nextDefaultNodeNumber([...nodes, ...trashedNodes])}`,
        markdown: "",
        type,
        collapsed: true,
      },
    };
    set((state) => ({ nodes: [...state.nodes, node] }));
    get().scheduleSave();
    activeCollab?.emitNode({ type: "add", node: toNodeDTO(node) });
    // 노드 추가는 REST 응답 없이 소켓 emit(ack 없음)뿐이라 정확한 완료 시점을 모른다 —
    // 서버가 ActivityLog까지 쓸 시간을 대략 주고 무효화한다(완벽하진 않아도 새로고침보단 낫다).
    const { projectId } = get();
    if (projectId) setTimeout(() => invalidateHistory(projectId), 300);
    useHistoryStore.getState().record({
      label: "노드 생성",
      undo: () => get().applyLocalDeleteNode(id),
      redo: () => get().applyLocalRestoreNode(id),
      nodeIds: [id],
    });
    return id;
  },

  applyLocalUpdateNode: (id, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }));
    get().scheduleSave();
    activeCollab?.emitNode({ type: "update", node: { id, ...patch } });
  },

  applyLocalToggleCollapse: (id) => {
    let nextCollapsed: boolean | undefined;
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n;
        nextCollapsed = !n.data.collapsed;
        return { ...n, data: { ...n.data, collapsed: nextCollapsed } };
      }),
    }));
    get().scheduleSave();
    if (nextCollapsed !== undefined) {
      activeCollab?.emitNode({ type: "update", node: { id, collapsed: nextCollapsed } });
    }
  },

  // 소프트 삭제 + 연결된 엣지 물리 삭제 (§CV-08 — 복구 시 엣지는 미복원 §CV-16)
  // DELETE /nodes/:id가 서버에서 엣지 정리까지 같이 하므로 bulk 저장(scheduleSave)은 안 탄다.
  applyLocalDeleteNode: (id) => {
    get().applyLocalDeleteNodes([id]);
  },

  // 멀티선택 일괄 삭제 = undo 1 step — 노드별로 record하면 그룹 삭제를 undo할 때
  // 한 번에 하나씩만 복구되는 문제가 있어, 실제 삭제분 전체를 커맨드 하나로 묶는다.
  applyLocalDeleteNodes: (ids, restorePositions) => {
    const deleted: { id: string; connectedEdges: Edge[] }[] = [];
    for (const id of ids) {
      // 소프트 락: 다른 사용자가 md 편집 중인 노드는 삭제 차단 — 휴지통 드래그·멀티선택 등
      // 호출 경로가 늘어나도 여기 한 곳만 지키면 전부 막힌다(UX 가드, 최종 방어는 서버).
      if (isLockedByOther(id)) continue;
      // set() 전에 get()으로 대상 존재를 확인한다 — 없으면 스킵(record 대상에서도 제외).
      // 연결 엣지는 삭제 트랜잭션 전에 캡처해 undo에서 재생성한다(§CV-08은 서버 복원 시 미복원).
      const { projectId, nodes, edges } = get();
      const target = nodes.find((n) => n.id === id);
      if (!target) continue;
      const connectedEdges = edges.filter((e) => e.source === id || e.target === id);
      // 휴지통 최신순 정렬용 타임스탬프 — 서버 왕복 전 낙관적 값(서버 deletedAt과 초 단위로 어긋나도
      // 정렬 목적엔 문제없다).
      // 휴지통 드래그 삭제는 삭제 순간 좌표가 "휴지통 앞까지 끌려간 위치"다 — restorePositions가
      // 있으면 그 좌표(드래그 시작 위치)로 저장해 undo·휴지통 복구 모두 원래 자리로 돌아가게 한다.
      const restoreAt = restorePositions?.get(id);
      const trashedTarget: CanvasNode = {
        ...target,
        ...(restoreAt ? { position: { ...restoreAt } } : {}),
        data: { ...target.data, deletedAt: new Date().toISOString() },
      };
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
        trashedNodes: [...state.trashedNodes, trashedTarget],
      }));
      // BE가 소프트삭제 처리 후 알아서 다른 클라이언트에 node:delete를 브로드캐스트한다 —
      // 여기서 또 emit하면 중복 브로드캐스트 + 서버가 이미 삭제된 노드를 다시 지우려다
      // 404가 나는 레이스 컨디션이 생긴다(소켓 emit 제거).
      if (projectId) {
        fireAndForget(deleteNodeApi(projectId, id).then(() => invalidateHistory(projectId)));
      }
      deleted.push({ id, connectedEdges });
    }
    if (deleted.length === 0) return;

    const deletedIds = deleted.map((d) => d.id);
    // 삭제 노드 둘을 잇는 엣지는 양쪽 캡처에 중복으로 잡힌다 — id로 dedup.
    const edgeById = new Map<string, Edge>();
    for (const d of deleted) for (const e of d.connectedEdges) edgeById.set(e.id, e);
    const capturedEdges = [...edgeById.values()];

    useHistoryStore.getState().record({
      label: deletedIds.length > 1 ? `노드 ${deletedIds.length}개 삭제` : "노드 삭제",
      undo: () => {
        deletedIds.forEach((id) => get().applyLocalRestoreNode(id));
        // 전부 복원한 뒤 양쪽 endpoint가 살아있는 엣지만 재생성 — dangling 방지.
        // (단건이던 기존 동작과 동일: 자기 자신은 방금 복원돼 항상 alive)
        const alive = new Set(get().nodes.map((n) => n.id));
        for (const edge of capturedEdges) {
          if (alive.has(edge.source) && alive.has(edge.target)) get().applyLocalAddEdgeWithId(edge);
        }
      },
      // 재귀 record는 historyStore의 isApplying 가드가 막는다.
      redo: () => get().applyLocalDeleteNodes(deletedIds),
      nodeIds: deletedIds,
      edgeIds: capturedEdges.map((e) => e.id),
    });
  },

  applyLocalRestoreNode: (id, origin) => {
    const { projectId, trashedNodes, nodes } = get();
    const target = trashedNodes.find((n) => n.id === id);
    if (!target) return;
    // BE의 restore()는 위치를 안 건드리고 삭제 전 좌표 그대로 돌려준다 — origin이 없으면
    // (호출자가 화면 기준 위치를 못 구했을 때) 그 좌표를 그대로 쓴다. origin이 있으면
    // "화면에 보이는 자리에서 순서대로, 안 겹치게" 요구사항대로 새로 자리를 잡는다.
    const position = origin ? findFreePosition(resolveOrigin(origin), nodes) : target.position;
    const { deletedAt: _deletedAt, ...restoredData } = target.data;
    const node: CanvasNode = { ...target, position, data: restoredData };
    set((state) => ({
      trashedNodes: state.trashedNodes.filter((n) => n.id !== id),
      nodes: [...state.nodes, node],
    }));
    if (projectId) {
      // BE가 복원 처리 후 알아서 다른 클라이언트에 node:add를 브로드캐스트한다(원래 좌표로) —
      // 위치 동기화용 nodeUpdate는 반드시 그 REST 응답 이후에 보내야 한다. 먼저/동시에 보내면
      // 다른 클라이언트엔 아직 이 노드가 없는 상태라(nodeAdd가 아직 도착 전) nodeUpdate가
      // 조용히 무시되고, 뒤늦게 도착한 nodeAdd의 "원래(옛) 좌표"만 남아 위치가 서로 어긋난다.
      fireAndForget(
        restoreNodeApi(projectId, id).then(() => {
          invalidateHistory(projectId);
          if (origin) activeCollab?.emitNode({ type: "update", node: { id, position } });
        }),
      );
    }
  },

  applyLocalPermanentDeleteNode: (id) => {
    const { projectId } = get();
    set((state) => ({ trashedNodes: state.trashedNodes.filter((n) => n.id !== id) }));
    // BE가 영구삭제 처리 후 알아서 다른 클라이언트에 브로드캐스트한다 — 중복 emit 제거.
    if (projectId) fireAndForget(purgeNodeApi(projectId, id).then(() => invalidateHistory(projectId)));
  },

  applyLocalAddEdge: (source, target) => {
    const edge: Edge = { id: newId(), source, target };
    set((state) => ({ edges: [...state.edges, edge] }));
    get().scheduleSave();
    activeCollab?.emitEdge({ type: "add", edge });
    useHistoryStore.getState().record({
      label: "엣지 연결",
      undo: () => get().applyLocalDeleteEdge(edge.id),
      redo: () => get().applyLocalAddEdgeWithId(edge),
      nodeIds: [source, target],
      edgeIds: [edge.id],
    });
  },

  applyLocalDeleteEdge: (id) => {
    // 대상 엣지를 set() 전에 캡처 — undo에서 같은 id로 재연결한다. 없으면 기존 동작만.
    const edge = get().edges.find((e) => e.id === id);
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
    get().scheduleSave();
    activeCollab?.emitEdge({ type: "delete", edgeId: id });
    if (edge) {
      useHistoryStore.getState().record({
        label: "엣지 해제",
        undo: () => get().applyLocalAddEdgeWithId(edge),
        redo: () => get().applyLocalDeleteEdge(edge.id),
        nodeIds: [edge.source, edge.target],
        edgeIds: [edge.id],
      });
    }
  },

  applyLocalAddEdgeWithId: (edge) => {
    if (get().edges.some((e) => e.id === edge.id)) return;
    const next: Edge = { id: edge.id, source: edge.source, target: edge.target };
    set((state) => ({ edges: [...state.edges, next] }));
    get().scheduleSave();
    activeCollab?.emitEdge({ type: "add", edge: next });
  },

  applyLocalMoveNode: (id, position) => {
    // 소프트 락 차단은 applyLocalDeleteNode와 동일 관례 — 최종 방어는 서버·historyStore validator.
    if (isLockedByOther(id)) return;
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
    get().scheduleSave();
    activeCollab?.emitNode({ type: "update", node: { id, position } });
  },

  reconcileEdgeId: (localId, edge) => {
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === localId ? { ...e, id: edge.id, source: edge.source, target: edge.target } : e,
      ),
    }));
  },

  // --- 원격 수신 적용 (재emit 금지) ---
  applyRemoteAddNode: (node) => {
    // node:add는 신규 생성과 휴지통 복원(§CV-16) 둘 다에 쓰인다 — 복원이면 원격 탭의
    // trashedNodes에도 같은 id가 남아 있을 수 있으니 중복되지 않게 같이 제거한다.
    set((state) => {
      // 멱등성 가드 — 같은 node:add가 두 번 들어와도(과거 FE 중복 emit 잔재·네트워크 재시도 등)
      // 캔버스에 같은 id 카드가 두 장 생기지 않게 한다.
      if (state.nodes.some((n) => n.id === node.id)) return state;
      return {
        nodes: [...state.nodes, node],
        trashedNodes: state.trashedNodes.filter((n) => n.id !== node.id),
      };
    });
  },

  applyRemoteUpdateNode: (id, patch, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, position: position ?? n.position, data: { ...n.data, ...patch } }
          : n,
      ),
    }));
  },

  applyRemoteDeleteNode: (id) => {
    // node:delete는 (a) 캔버스→휴지통 소프트삭제, (b) 휴지통 영구삭제 둘 다에 쓰인다.
    // 이 id가 현재 nodes(살아있는 캔버스)에 있으면 (a) — 휴지통으로 옮겨서 다른 탭의
    // 휴지통 갯수/목록도 즉시 반영한다(§CV-16 실시간 동기화 공백 수정). nodes에 없으면
    // 이미 휴지통에 있던 항목이 영구삭제된 (b) — trashedNodes에서도 마저 지운다.
    set((state) => {
      const target = state.nodes.find((n) => n.id === id);
      if (target) {
        const trashedTarget: CanvasNode = {
          ...target,
          data: { ...target.data, deletedAt: new Date().toISOString() },
        };
        return {
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
          trashedNodes: [...state.trashedNodes, trashedTarget],
        };
      }
      return { trashedNodes: state.trashedNodes.filter((n) => n.id !== id) };
    });
  },

  applyRemoteAddEdge: (edge) => {
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  applyRemoteDeleteEdge: (id) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
  },
}));

// historyStore validator 배선(R5.1/R5.2) — undo/redo 실행 직전 대상 유효성 검사.
// nodeIds 각각: nodes ∪ trashedNodes에 없으면 "missing"(폐기), 살아있어도 타인 락이면 "locked"(유지).
// edgeIds는 존재 검사하지 않는다 — 엣지 연산은 양방향 멱등(중복 add 가드·없는 id delete no-op)이고,
// 실제 의존성은 endpoint 노드라 nodeIds 검사로 충분하다.
useHistoryStore.getState().setValidator((cmd) => {
  const { nodes, trashedNodes } = useCanvasStore.getState();
  const alive = new Set([...nodes, ...trashedNodes].map((n) => n.id));
  for (const nodeId of cmd.nodeIds ?? []) {
    if (!alive.has(nodeId)) return { ok: false, reason: "missing" };
    if (isLockedByOther(nodeId)) return { ok: false, reason: "locked" };
  }
  return { ok: true };
});
