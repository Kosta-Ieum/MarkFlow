// 편집 툴 6개 — FE와 동일 경로로 노드/엣지를 바꾼다(R4·R5.1). 노드 생성·수정과 엣지 연결·해제는
// 소켓 emit+ack(design.md §2 제약 1·4), 노드 삭제·복원은 REST(BE가 소켓으로 브로드캐스트).
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeTypeSchema, SOCKET_EVENTS, XYSchema, type CanvasSnapshot, type NodeDTO, type NodeType, type EdgeDTO, type XY } from "@markflow/shared";
import type { ApiClient } from "../api.js";
import type { SocketManager } from "../collab.js";
import { McpToolError } from "../errors.js";
import { runTool } from "./read.js";

// FE apps/web/src/store/canvasStore.ts:95-153의 findFreePosition 경량 사본 — 동일 상수.
// MCP는 뷰포트가 없으므로 FE의 "현재 화면 기준점" 로직은 생략하고 원점(0,0) 고정으로 훑는다.
export const NODE_WIDTH = 186;
export const NODE_HEIGHT_APPROX = 88;
export const GRID_GAP = 24;
export const GRID_COLS = 4;
const GRID_STEP_X = NODE_WIDTH + GRID_GAP;
const GRID_STEP_Y = NODE_HEIGHT_APPROX + GRID_GAP;
const MAX_GRID_SLOTS = 500;

function overlapsCard(a: XY, b: XY): boolean {
  return Math.abs(a.x - b.x) < GRID_STEP_X && Math.abs(a.y - b.y) < GRID_STEP_Y;
}

/** 원점(0,0)에서 그리드를 훑어 existing 노드들과 실제로 안 겹치는 첫 자리를 반환한다. */
export function freePosition(existing: { position: XY }[]): XY {
  const origin: XY = { x: 0, y: 0 };
  for (let seq = 0; seq < MAX_GRID_SLOTS; seq++) {
    const candidate: XY = {
      x: origin.x + (seq % GRID_COLS) * GRID_STEP_X,
      y: origin.y + Math.floor(seq / GRID_COLS) * GRID_STEP_Y,
    };
    if (!existing.some((n) => overlapsCard(candidate, n.position))) return candidate;
  }
  return origin;
}

export const createNodeInputShape = {
  projectId: z.string().uuid(),
  title: z.string().optional(),
  markdown: z.string().optional(),
  type: NodeTypeSchema.optional(),
  position: XYSchema.optional(),
};

export const updateNodeInputShape = {
  projectId: z.string().uuid(),
  nodeId: z.string().uuid(),
  title: z.string().optional(),
  markdown: z.string().optional(),
  type: NodeTypeSchema.optional(),
  position: XYSchema.optional(),
  collapsed: z.boolean().optional(),
};

export const connectEdgeInputShape = {
  projectId: z.string().uuid(),
  source: z.string().uuid(),
  target: z.string().uuid(),
};

export const disconnectEdgeInputShape = {
  projectId: z.string().uuid(),
  edgeId: z.string().uuid(),
};

export const deleteNodeInputShape = {
  projectId: z.string().uuid(),
  nodeId: z.string().uuid(),
};

export const restoreNodeInputShape = {
  projectId: z.string().uuid(),
  nodeId: z.string().uuid(),
};

interface CreateNodeInput {
  projectId: string;
  title?: string;
  markdown?: string;
  type?: NodeType;
  position?: XY;
}

interface UpdateNodeInput {
  projectId: string;
  nodeId: string;
  title?: string;
  markdown?: string;
  type?: NodeType;
  position?: XY;
  collapsed?: boolean;
}

interface ConnectEdgeInput {
  projectId: string;
  source: string;
  target: string;
}

interface DisconnectEdgeInput {
  projectId: string;
  edgeId: string;
}

interface DeleteNodeInput {
  projectId: string;
  nodeId: string;
}

interface RestoreNodeInput {
  projectId: string;
  nodeId: string;
}

interface NodeDeleteResult {
  id: string;
  deletedAt: string;
}

interface NodeRestoreResult {
  id: string;
  deletedAt: string | null;
}

/** REST 에러 메시지에 targetId를 덧붙인다(mapErrorResponse와 동일 포맷) — api.ts는 targetId를 모른다. */
async function withTarget<T>(promise: Promise<T>, targetId: string): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof McpToolError) {
      throw new McpToolError(err.code, `${err.message} (${targetId})`, err.hint);
    }
    throw err;
  }
}

/** 단위 테스트가 소켓/REST 호출을 직접 검증할 수 있도록 핸들러 로직을 등록과 분리해 export한다. */
export function createWriteToolHandlers(api: ApiClient, collab: SocketManager) {
  return {
    async createNode(input: CreateNodeInput): Promise<NodeDTO> {
      let position = input.position;
      if (!position) {
        const canvas = await api.request<CanvasSnapshot>("GET", `/projects/${input.projectId}/canvas`);
        position = freePosition(canvas?.nodes ?? []);
      }

      const node: NodeDTO = {
        id: randomUUID(),
        type: input.type ?? "idea",
        title: input.title ?? "새 노드",
        markdown: input.markdown ?? "",
        collapsed: true,
        position,
      };

      await collab.ensureJoined(input.projectId);
      const data = (await collab.emitWithAck(
        SOCKET_EVENTS.nodeAdd,
        { projectId: input.projectId, node },
        node.id,
      )) as { node: NodeDTO };
      return data.node;
    },

    async updateNode(input: UpdateNodeInput): Promise<NodeDTO> {
      const { projectId, nodeId, ...patch } = input;
      const hasPatch = Object.values(patch).some((value) => value !== undefined);
      if (!hasPatch) {
        throw new McpToolError(
          "VALIDATION_ERROR",
          "title·markdown·type·position·collapsed 중 최소 1개를 지정해야 합니다",
        );
      }

      await collab.ensureJoined(projectId);
      const data = (await collab.emitWithAck(
        SOCKET_EVENTS.nodeUpdate,
        { projectId, node: { id: nodeId, ...patch } },
        nodeId,
      )) as { node: NodeDTO };
      return data.node;
    },

    async connectEdge({ projectId, source, target }: ConnectEdgeInput): Promise<EdgeDTO> {
      // 클라 id는 EdgeDTOSchema 검증 통과용 placeholder — 반환은 반드시 ack의 서버 확정 edge다
      // (design.md §2 제약 4: edge id는 서버 재발급, node:add와 달리 클라 id를 신뢰하지 않는다).
      const edge: EdgeDTO = { id: randomUUID(), source, target };

      await collab.ensureJoined(projectId);
      const data = (await collab.emitWithAck(SOCKET_EVENTS.edgeAdd, { projectId, edge })) as {
        edge: EdgeDTO;
      };
      return data.edge;
    },

    async disconnectEdge({ projectId, edgeId }: DisconnectEdgeInput): Promise<{ id: string }> {
      await collab.ensureJoined(projectId);
      const data = (await collab.emitWithAck(
        SOCKET_EVENTS.edgeDelete,
        { projectId, edgeId },
        edgeId,
      )) as { id: string };
      return data;
    },

    deleteNode({ projectId, nodeId }: DeleteNodeInput): Promise<NodeDeleteResult | null> {
      return withTarget(
        api.request<NodeDeleteResult>("DELETE", `/projects/${projectId}/nodes/${nodeId}`),
        nodeId,
      );
    },

    restoreNode({ projectId, nodeId }: RestoreNodeInput): Promise<NodeRestoreResult | null> {
      return withTarget(
        api.request<NodeRestoreResult>("POST", `/projects/${projectId}/nodes/${nodeId}/restore`),
        nodeId,
      );
    },
  };
}

export function registerWriteTools(server: McpServer, api: ApiClient, collab: SocketManager): void {
  const handlers = createWriteToolHandlers(api, collab);

  server.registerTool(
    "create_node",
    {
      description:
        "Create a new node on the project canvas. Defaults: title \"새 노드\", type \"idea\", collapsed true. Position is auto-placed in a free grid slot if omitted.",
      inputSchema: createNodeInputShape,
    },
    (args) => runTool(() => handlers.createNode(args)),
  );

  server.registerTool(
    "update_node",
    {
      description:
        "Partially update a node's title, markdown, type, position, or collapsed state. At least one of those fields must be provided.",
      inputSchema: updateNodeInputShape,
    },
    (args) => runTool(() => handlers.updateNode(args)),
  );

  server.registerTool(
    "connect_edge",
    {
      description:
        "Create a directed edge between two nodes on the canvas. Returns the server-assigned edge id.",
      inputSchema: connectEdgeInputShape,
    },
    (args) => runTool(() => handlers.connectEdge(args)),
  );

  server.registerTool(
    "disconnect_edge",
    {
      description: "Remove an edge from the canvas by its id.",
      inputSchema: disconnectEdgeInputShape,
    },
    (args) => runTool(() => handlers.disconnectEdge(args)),
  );

  server.registerTool(
    "delete_node",
    {
      description:
        "Soft-delete a node into the project's trash; edges connected to it are removed. Use restore_node to undo.",
      inputSchema: deleteNodeInputShape,
    },
    (args) => runTool(() => handlers.deleteNode(args)),
  );

  server.registerTool(
    "restore_node",
    {
      description: "Restore a previously soft-deleted node from the trash back onto the canvas.",
      inputSchema: restoreNodeInputShape,
    },
    (args) => runTool(() => handlers.restoreNode(args)),
  );
}
