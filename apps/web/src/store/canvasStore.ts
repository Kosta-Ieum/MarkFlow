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
import { useAuthStore } from "./authStore";
import { usePresenceStore } from "./presenceStore";

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
  applyLocalRestoreNode: (id: string) => void;
  /** 영구삭제(물리 삭제) — §CV-16 */
  applyLocalPermanentDeleteNode: (id: string) => void;
  applyLocalAddEdge: (source: string, target: string) => void;
  applyLocalDeleteEdge: (id: string) => void;

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
    data: { title: dto.title, markdown: dto.markdown ?? "", type: dto.type, collapsed: true },
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
    const nonRemove = changes.filter(
      (c) => c.type !== "remove" && !(c.type === "position" && isLockedByOther(c.id)),
    );
    set((state) => ({ nodes: applyNodeChanges(nonRemove, state.nodes) as CanvasNode[] }));
    get().scheduleSave();

    // 드래그 완료(커밋) 시점의 최종 위치만 실시간 전파 — 매 프레임 emit하면
    // 네트워크가 막히고 드롭 후 잔상이 생긴다(과거 프로토타입에서 겪은 문제).
    const committed = nonRemove.filter(
      (c): c is FlowNodeChange & { type: "position"; id: string; dragging: false } =>
        c.type === "position" && c.dragging === false,
    );
    if (committed.length === 0 || !activeCollab) return;
    const nodesById = new Map(get().nodes.map((n) => [n.id, n]));
    for (const c of committed) {
      const node = nodesById.get(c.id);
      if (node) activeCollab.emitNode({ type: "update", node: { id: node.id, position: node.position } });
    }
  },

  onEdgesChange: (changes) => {
    // remove는 React Flow 기본 처리(Backspace 등)로 흘려보내지 않고 applyLocalDeleteEdge를
    // 거치게 한다 — 안 그러면 emit이 빠져 삭제가 남의 화면에 실시간 반영되지 않는다.
    const removedIds = changes.filter((c) => c.type === "remove").map((c) => c.id);
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
    const { nodes } = get();
    // 매번 같은 좌표·이름으로 생성하면 연속 추가 시 노드가 그대로 겹친다 — 현재 캔버스에 있는
    // 노드들과 실제로 안 겹치는 자리를 찾아 배치한다(findFreePosition).
    const node: CanvasNode = {
      id,
      type: "markdown",
      position: findFreePosition(position, nodes),
      data: { title: `새 노드 ${nodes.length + 1}`, markdown: "", type, collapsed: true },
    };
    set((state) => ({ nodes: [...state.nodes, node] }));
    get().scheduleSave();
    activeCollab?.emitNode({ type: "add", node: toNodeDTO(node) });
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
    // 소프트 락: 다른 사용자가 md 편집 중인 노드는 삭제 차단 — 휴지통 드래그·멀티선택 등
    // 호출 경로가 늘어나도 여기 한 곳만 지키면 전부 막힌다(UX 가드, 최종 방어는 서버).
    if (isLockedByOther(id)) return;
    const { projectId } = get();
    set((state) => {
      const target = state.nodes.find((n) => n.id === id);
      if (!target) return state;
      return {
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
        trashedNodes: [...state.trashedNodes, target],
      };
    });
    // BE가 소프트삭제 처리 후 알아서 다른 클라이언트에 node:delete를 브로드캐스트한다 —
    // 여기서 또 emit하면 중복 브로드캐스트 + 서버가 이미 삭제된 노드를 다시 지우려다
    // 404가 나는 레이스 컨디션이 생긴다(소켓 emit 제거).
    if (projectId) fireAndForget(deleteNodeApi(projectId, id));
  },

  applyLocalRestoreNode: (id) => {
    const { projectId } = get();
    set((state) => {
      const target = state.trashedNodes.find((n) => n.id === id);
      if (!target) return state;
      // BE의 restore()는 위치를 안 건드리고 삭제 전 좌표 그대로 돌려준다 — FE도 새 위치를
      // 계산하지 않고 그대로 복원해야 서버 진실값·다른 클라이언트와 위치가 어긋나지 않는다.
      const node: CanvasNode = target;
      return {
        trashedNodes: state.trashedNodes.filter((n) => n.id !== id),
        nodes: [...state.nodes, node],
      };
    });
    // BE가 복원 처리 후 알아서 다른 클라이언트에 node:add를 브로드캐스트한다 — 중복 emit 제거.
    if (projectId) fireAndForget(restoreNodeApi(projectId, id));
  },

  applyLocalPermanentDeleteNode: (id) => {
    const { projectId } = get();
    set((state) => ({ trashedNodes: state.trashedNodes.filter((n) => n.id !== id) }));
    // BE가 영구삭제 처리 후 알아서 다른 클라이언트에 브로드캐스트한다 — 중복 emit 제거.
    if (projectId) fireAndForget(purgeNodeApi(projectId, id));
  },

  applyLocalAddEdge: (source, target) => {
    const edge: Edge = { id: newId(), source, target };
    set((state) => ({ edges: [...state.edges, edge] }));
    get().scheduleSave();
    activeCollab?.emitEdge({ type: "add", edge });
  },

  applyLocalDeleteEdge: (id) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
    get().scheduleSave();
    activeCollab?.emitEdge({ type: "delete", edgeId: id });
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
        return {
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
          trashedNodes: [...state.trashedNodes, target],
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
