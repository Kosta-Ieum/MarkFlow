import { describe, expect, it, vi } from "vitest";
import { SOCKET_EVENTS } from "@markflow/shared";
import type { ApiClient } from "../api.js";
import type { SocketManager } from "../collab.js";
import { McpToolError } from "../errors.js";
import {
  GRID_COLS,
  GRID_GAP,
  NODE_HEIGHT_APPROX,
  NODE_WIDTH,
  createWriteToolHandlers,
  freePosition,
} from "./write.js";
import { runTool } from "./read.js";

const GRID_STEP_X = NODE_WIDTH + GRID_GAP;
const GRID_STEP_Y = NODE_HEIGHT_APPROX + GRID_GAP;

const projectId = "11111111-1111-1111-1111-111111111111";
const nodeId = "22222222-2222-2222-2222-222222222222";
const sourceId = "33333333-3333-3333-3333-333333333333";
const targetId = "44444444-4444-4444-4444-444444444444";

function fakeApi(response: unknown = null) {
  const request = vi.fn().mockResolvedValue(response);
  const api = { request } as unknown as ApiClient;
  return { api, request };
}

function fakeCollab(ackData: unknown = { ok: true }) {
  const ensureJoined = vi.fn().mockResolvedValue(undefined);
  const emitWithAck = vi.fn().mockResolvedValue(ackData);
  const collab = { ensureJoined, emitWithAck } as unknown as SocketManager;
  return { collab, ensureJoined, emitWithAck };
}

describe("freePosition", () => {
  it("빈 캔버스면 원점(0,0)을 반환한다", () => {
    expect(freePosition([])).toEqual({ x: 0, y: 0 });
  });

  it("원점을 다른 노드가 이미 차지하고 있으면 그리드의 다음 슬롯을 반환한다", () => {
    const occupied = [{ position: { x: 0, y: 0 } }];
    expect(freePosition(occupied)).toEqual({ x: GRID_STEP_X, y: 0 });
  });

  it("한 행(GRID_COLS칸)이 모두 차면 다음 행으로 넘어간다", () => {
    const occupied = Array.from({ length: GRID_COLS }, (_, col) => ({
      position: { x: col * GRID_STEP_X, y: 0 },
    }));
    expect(freePosition(occupied)).toEqual({ x: 0, y: GRID_STEP_Y });
  });
});

describe("createWriteToolHandlers — create_node", () => {
  it("① position 미지정 시 캔버스를 조회해 겹치지 않는 그리드 슬롯으로 emit한다", async () => {
    const existingNode = { position: { x: 0, y: 0 } };
    const { api, request } = fakeApi({ nodes: [existingNode], edges: [] });
    const { collab, ensureJoined, emitWithAck } = fakeCollab({ node: { id: "server-id" } });
    const handlers = createWriteToolHandlers(api, collab);

    await handlers.createNode({ projectId });

    expect(request).toHaveBeenCalledWith("GET", `/projects/${projectId}/canvas`);
    expect(ensureJoined).toHaveBeenCalledWith(projectId);
    const [event, payload] = emitWithAck.mock.calls[0];
    expect(event).toBe(SOCKET_EVENTS.nodeAdd);
    expect((payload as { node: { position: unknown } }).node.position).toEqual({
      x: GRID_STEP_X,
      y: 0,
    });
  });

  it("② position 지정 시 캔버스 조회 없이 그대로 emit하고 기본값을 채운다", async () => {
    const { api, request } = fakeApi();
    const { collab, emitWithAck } = fakeCollab({ node: { id: "server-id" } });
    const handlers = createWriteToolHandlers(api, collab);
    const position = { x: 500, y: 500 };

    await handlers.createNode({ projectId, title: "제목", position });

    expect(request).not.toHaveBeenCalled();
    const [, payload] = emitWithAck.mock.calls[0];
    const node = (payload as { node: Record<string, unknown> }).node;
    expect(node.position).toEqual(position);
    expect(node.title).toBe("제목");
    expect(node.type).toBe("idea");
    expect(node.markdown).toBe("");
    expect(node.collapsed).toBe(true);
    expect(typeof node.id).toBe("string");
  });

  it("ack의 node를 결과로 반환한다", async () => {
    const { api } = fakeApi();
    const { collab } = fakeCollab({ node: { id: "server-id", title: "제목" } });
    const handlers = createWriteToolHandlers(api, collab);

    const result = await handlers.createNode({ projectId, position: { x: 0, y: 0 } });

    expect(result).toEqual({ id: "server-id", title: "제목" });
  });
});

describe("createWriteToolHandlers — update_node", () => {
  it("④ patch 필드가 전부 없으면 VALIDATION_ERROR로 거부한다", async () => {
    const { api } = fakeApi();
    const { collab, emitWithAck } = fakeCollab();
    const handlers = createWriteToolHandlers(api, collab);

    await expect(handlers.updateNode({ projectId, nodeId })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(emitWithAck).not.toHaveBeenCalled();
  });

  it("patch 필드가 1개 이상이면 node:update를 emit하고 ack의 node를 반환한다", async () => {
    const { api } = fakeApi();
    const { collab, emitWithAck } = fakeCollab({ node: { id: nodeId, title: "새 제목" } });
    const handlers = createWriteToolHandlers(api, collab);

    const result = await handlers.updateNode({ projectId, nodeId, title: "새 제목" });

    expect(emitWithAck).toHaveBeenCalledWith(
      SOCKET_EVENTS.nodeUpdate,
      { projectId, node: { id: nodeId, title: "새 제목" } },
      nodeId,
    );
    expect(result).toEqual({ id: nodeId, title: "새 제목" });
  });
});

describe("createWriteToolHandlers — connect_edge / disconnect_edge", () => {
  it("③ connect_edge는 ack의 서버 확정 edge(다른 id)를 반환한다", async () => {
    const { api } = fakeApi();
    const serverEdge = { id: "server-edge-id", source: sourceId, target: targetId };
    const { collab, emitWithAck } = fakeCollab({ edge: serverEdge });
    const handlers = createWriteToolHandlers(api, collab);

    const result = await handlers.connectEdge({ projectId, source: sourceId, target: targetId });

    const [, payload] = emitWithAck.mock.calls[0];
    const clientEdgeId = (payload as { edge: { id: string } }).edge.id;
    expect(clientEdgeId).not.toBe(serverEdge.id); // 클라 id는 placeholder일 뿐
    expect(result).toEqual(serverEdge);
    expect(result.id).toBe("server-edge-id");
  });

  it("disconnect_edge는 edge:delete를 targetId와 함께 emit하고 ack 결과를 반환한다", async () => {
    const { api } = fakeApi();
    const edgeId = "55555555-5555-5555-5555-555555555555";
    const { collab, emitWithAck } = fakeCollab({ id: edgeId });
    const handlers = createWriteToolHandlers(api, collab);

    const result = await handlers.disconnectEdge({ projectId, edgeId });

    expect(emitWithAck).toHaveBeenCalledWith(
      SOCKET_EVENTS.edgeDelete,
      { projectId, edgeId },
      edgeId,
    );
    expect(result).toEqual({ id: edgeId });
  });
});

describe("createWriteToolHandlers — delete_node / restore_node", () => {
  it("⑤ delete_node는 DELETE /projects/:id/nodes/:nodeId를 호출한다", async () => {
    const { api, request } = fakeApi({ id: nodeId, deletedAt: "2026-07-20T00:00:00.000Z" });
    const { collab } = fakeCollab();
    const handlers = createWriteToolHandlers(api, collab);

    const result = await handlers.deleteNode({ projectId, nodeId });

    expect(request).toHaveBeenCalledWith("DELETE", `/projects/${projectId}/nodes/${nodeId}`);
    expect(result).toEqual({ id: nodeId, deletedAt: "2026-07-20T00:00:00.000Z" });
  });

  it("⑤ restore_node는 POST /projects/:id/nodes/:nodeId/restore를 호출한다", async () => {
    const { api, request } = fakeApi({ id: nodeId, deletedAt: null });
    const { collab } = fakeCollab();
    const handlers = createWriteToolHandlers(api, collab);

    const result = await handlers.restoreNode({ projectId, nodeId });

    expect(request).toHaveBeenCalledWith("POST", `/projects/${projectId}/nodes/${nodeId}/restore`);
    expect(result).toEqual({ id: nodeId, deletedAt: null });
  });

  it("REST 에러 발생 시 메시지에 nodeId를 덧붙인다", async () => {
    const request = vi.fn().mockRejectedValue(new McpToolError("NOT_FOUND", "노드를 찾을 수 없습니다"));
    const api = { request } as unknown as ApiClient;
    const { collab } = fakeCollab();
    const handlers = createWriteToolHandlers(api, collab);

    await expect(handlers.deleteNode({ projectId, nodeId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: `노드를 찾을 수 없습니다 (${nodeId})`,
    });
  });
});

describe("ack {ok:false} 전파", () => {
  it("⑥ emitWithAck이 McpToolError로 reject하면 runTool을 거쳐 isError 텍스트가 된다", async () => {
    const { api } = fakeApi();
    const ensureJoined = vi.fn().mockResolvedValue(undefined);
    const emitWithAck = vi
      .fn()
      .mockRejectedValue(new McpToolError("FORBIDDEN", "권한 없음", "EDITOR 확인"));
    const collab = { ensureJoined, emitWithAck } as unknown as SocketManager;
    const handlers = createWriteToolHandlers(api, collab);

    const result = await runTool(() =>
      handlers.connectEdge({ projectId, source: sourceId, target: targetId }),
    );

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "[FORBIDDEN] 권한 없음\nEDITOR 확인" },
    ]);
  });
});
