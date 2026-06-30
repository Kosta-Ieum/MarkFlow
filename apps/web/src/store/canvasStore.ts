// nodes·edges (applyLocal/applyRemote) — IEUM-23 [F1-1.3] 로컬 CRUD
// 단일 진실원(.claude/rules/frontend.md): React Flow·노드카드는 이 store만 구독/호출한다.
// applyLocal*  = 내 동작 (이후 IEUM-34에서 emit 지점이 됨, 지금은 emit 없음)
// applyRemote* = 원격 수신 적용 전용 (재emit 금지) — 호출자는 IEUM-34 소켓 핸들러
import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type { Edge, EdgeChange, Node, NodeChange, OnConnect, XYPosition } from "@xyflow/react";
import type { NodeDTO, NodeType } from "@markflow/shared";

import { deleteNode as deleteNodeApi, fetchCanvas, purgeNode as purgeNodeApi, restoreNode as restoreNodeApi, saveCanvasSnapshot } from "../lib/canvasApi";

// BE 노드 REST(IEUM-24)가 아직 스텁이라 호출이 실패할 수 있다 — 화면은 항상 로컬
// 낙관적 업데이트를 먼저 반영하고, REST는 "되면 되는" fire-and-forget으로 보낸다.
function fireAndForget(promise: Promise<unknown>) {
  promise.catch((err) => console.warn("[canvas] 서버 동기화 실패(BE 구현 전이면 정상):", err));
}

const AUTOSAVE_DEBOUNCE_MS = 2000; // .claude/rules/frontend.md: 저장 debounce ≈2s

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
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveTimer: ReturnType<typeof setTimeout> | null;

  // GET/PUT /projects/:id/canvas (openapi 정본) — IEUM-27
  loadCanvas: (projectId: string) => Promise<void>;
  saveCanvas: () => Promise<void>;
  scheduleSave: () => void;

  // React Flow 이벤트 바인딩 — 로컬 선택/드래그만 처리. 삭제(remove)는 무시하고
  // applyLocalDeleteNode를 통해서만 소프트 삭제한다(하드 삭제 경로 차단).
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: OnConnect;

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

function toNodeDTO(node: CanvasNode): NodeDTO {
  return {
    id: node.id,
    type: node.data.type,
    title: node.data.title,
    markdown: node.data.markdown,
    collapsed: node.data.collapsed,
    position: node.position,
  };
}

function fromNodeDTO(dto: NodeDTO): CanvasNode {
  return {
    id: dto.id,
    type: "markdown",
    position: dto.position,
    data: { title: dto.title, markdown: dto.markdown, type: dto.type, collapsed: dto.collapsed },
  };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  trashedNodes: [],
  projectId: null,
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
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
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

  onNodesChange: (changes) => {
    const nonRemove = changes.filter((c) => c.type !== "remove");
    set((state) => ({ nodes: applyNodeChanges(nonRemove, state.nodes) as CanvasNode[] }));
    get().scheduleSave();
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
    get().scheduleSave();
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;
    get().applyLocalAddEdge(connection.source, connection.target);
  },

  applyLocalAddNode: (position, type = "idea") => {
    const id = newId();
    const node: CanvasNode = {
      id,
      type: "markdown",
      position,
      data: { title: "새 노드", markdown: "", type, collapsed: true },
    };
    set((state) => ({ nodes: [...state.nodes, node] }));
    get().scheduleSave();
    return id;
  },

  applyLocalUpdateNode: (id, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }));
    get().scheduleSave();
  },

  applyLocalToggleCollapse: (id) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n,
      ),
    }));
    get().scheduleSave();
  },

  // 소프트 삭제 + 연결된 엣지 물리 삭제 (§CV-08 — 복구 시 엣지는 미복원 §CV-16)
  // DELETE /nodes/:id가 서버에서 엣지 정리까지 같이 하므로 bulk 저장(scheduleSave)은 안 탄다.
  applyLocalDeleteNode: (id) => {
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
    if (projectId) fireAndForget(deleteNodeApi(projectId, id));
  },

  applyLocalRestoreNode: (id) => {
    const { projectId } = get();
    set((state) => {
      const target = state.trashedNodes.find((n) => n.id === id);
      if (!target) return state;
      return {
        trashedNodes: state.trashedNodes.filter((n) => n.id !== id),
        nodes: [...state.nodes, target],
      };
    });
    if (projectId) fireAndForget(restoreNodeApi(projectId, id));
  },

  applyLocalPermanentDeleteNode: (id) => {
    const { projectId } = get();
    set((state) => ({ trashedNodes: state.trashedNodes.filter((n) => n.id !== id) }));
    if (projectId) fireAndForget(purgeNodeApi(projectId, id));
  },

  applyLocalAddEdge: (source, target) => {
    const edge: Edge = { id: newId(), source, target };
    set((state) => ({ edges: [...state.edges, edge] }));
    get().scheduleSave();
  },

  applyLocalDeleteEdge: (id) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
    get().scheduleSave();
  },

  // --- 원격 수신 적용 (재emit 금지) ---
  applyRemoteAddNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
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
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    }));
  },

  applyRemoteAddEdge: (edge) => {
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  applyRemoteDeleteEdge: (id) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
  },
}));
