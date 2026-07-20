// 캔버스 recorder 역연산 매핑 테스트(design §6) — projectId=null·activeCollab 미등록 상태라
// REST·소켓·타이머 없이 store 로직만 돈다. 커버: 생성/삭제(엣지 복원·dangling 스킵)/이동/엣지, 원격 미기록.
import { describe, it, expect, beforeEach } from "vitest";
import type { Edge } from "@xyflow/react";

import { beginNodeDrag, useCanvasStore, type CanvasNode } from "./canvasStore";
import { useHistoryStore } from "./historyStore";
import { usePresenceStore } from "./presenceStore";

function makeNode(id: string, x = 0, y = 0): CanvasNode {
  return {
    id,
    type: "markdown",
    position: { x, y },
    data: { title: id, markdown: "", type: "idea", collapsed: true },
  };
}

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    trashedNodes: [],
    projectId: null,
    saveTimer: null,
  });
  useHistoryStore.getState().clear();
  usePresenceStore.setState({ locks: {} });
});

describe("노드 생성 record (R2.1)", () => {
  it("undo=휴지통 이동, redo=복원", () => {
    const id = useCanvasStore.getState().applyLocalAddNode({ x: 0, y: 0 });
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(useCanvasStore.getState().trashedNodes.map((n) => n.id)).toEqual([id]);

    useHistoryStore.getState().redo();
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual([id]);
    expect(useCanvasStore.getState().trashedNodes).toHaveLength(0);
  });
});

describe("노드 삭제 record (R2.2)", () => {
  it("undo가 노드를 복원하고 연결 엣지를 같은 id로 재생성한다", () => {
    useCanvasStore.setState({
      nodes: [makeNode("a"), makeNode("b", 100, 0)],
      edges: [edge("e1", "a", "b")],
    });

    useCanvasStore.getState().applyLocalDeleteNode("a");
    expect(useCanvasStore.getState().edges).toHaveLength(0);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(useCanvasStore.getState().edges.map((e) => e.id)).toEqual(["e1"]);

    useHistoryStore.getState().redo();
    expect(useCanvasStore.getState().trashedNodes.map((n) => n.id)).toEqual(["a"]);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });

  it("상대 endpoint가 사라진 엣지는 undo에서 재생성하지 않는다(dangling 방지)", () => {
    useCanvasStore.setState({
      nodes: [makeNode("a"), makeNode("b", 100, 0)],
      edges: [edge("e1", "a", "b")],
    });
    useCanvasStore.getState().applyLocalDeleteNode("a");
    // 그 사이 다른 사용자가 b를 삭제(원격 수신) — b는 live nodes에서 빠진다.
    useCanvasStore.getState().applyRemoteDeleteNode("b");

    useHistoryStore.getState().undo(); // a 복원 — validator는 a(trash)만 검사
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(["a"]);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
  });
});

describe("노드 그룹 삭제 record", () => {
  it("일괄 삭제 = 1 step, undo 한 번에 전부 복구 + 내부·외부 엣지 재생성", () => {
    useCanvasStore.setState({
      nodes: [makeNode("a"), makeNode("b", 100, 0), makeNode("c", 200, 0)],
      edges: [edge("e1", "a", "b"), edge("e2", "b", "c")],
    });

    useCanvasStore.getState().applyLocalDeleteNodes(["a", "b"]);
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(["c"]);
    expect(useCanvasStore.getState().edges).toHaveLength(0);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(useCanvasStore.getState().trashedNodes).toHaveLength(0);
    // e1(삭제 노드 간)·e2(삭제↔생존 간) 모두 같은 id로 복원
    expect(useCanvasStore.getState().edges.map((e) => e.id).sort()).toEqual(["e1", "e2"]);

    useHistoryStore.getState().redo();
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(["c"]);
    expect(useCanvasStore.getState().trashedNodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1); // redo 재기록 없음(isApplying 가드)
  });

  it("타인 락 노드는 배치에서 빠지고 나머지만 기록된다", () => {
    useCanvasStore.setState({ nodes: [makeNode("a"), makeNode("b", 100, 0)] });
    usePresenceStore.setState({ locks: { b: "other-user" } });

    useCanvasStore.getState().applyLocalDeleteNodes(["a", "b"]);
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(["b"]);
    const stack = useHistoryStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].nodeIds).toEqual(["a"]);
  });

  it("전부 락·부재면 record하지 않는다", () => {
    useCanvasStore.setState({ nodes: [makeNode("a")] });
    usePresenceStore.setState({ locks: { a: "other-user" } });

    useCanvasStore.getState().applyLocalDeleteNodes(["a", "ghost"]);
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("restorePositions를 주면(휴지통 드래그) 끌려간 위치가 아니라 그 좌표로 복구된다", () => {
    // 드래그로 휴지통 앞(900,900)까지 끌려간 상태에서 삭제되는 시나리오
    useCanvasStore.setState({ nodes: [makeNode("a", 900, 900), makeNode("b", 900, 900)] });
    const restore = new Map([
      ["a", { x: 10, y: 20 }],
      ["b", { x: 30, y: 40 }],
    ]);

    useCanvasStore.getState().applyLocalDeleteNodes(["a", "b"], restore);
    expect(useCanvasStore.getState().trashedNodes.map((n) => n.position)).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);

    useHistoryStore.getState().undo();
    const pos = Object.fromEntries(useCanvasStore.getState().nodes.map((n) => [n.id, n.position]));
    expect(pos.a).toEqual({ x: 10, y: 20 });
    expect(pos.b).toEqual({ x: 30, y: 40 });
  });
});

describe("노드 이동 record (R2.3, R2.7)", () => {
  it("멀티 드래그 1회 = 1 step, undo가 모든 노드를 시작 좌표로 되돌린다", () => {
    useCanvasStore.setState({ nodes: [makeNode("a"), makeNode("b", 100, 0)] });
    beginNodeDrag([
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 100, y: 0 } },
    ]);
    useCanvasStore.getState().onNodesChange([
      { type: "position", id: "a", position: { x: 10, y: 20 }, dragging: true },
      { type: "position", id: "b", position: { x: 110, y: 20 }, dragging: true },
    ]);
    expect(useHistoryStore.getState().undoStack).toHaveLength(0); // 드래그 중엔 미기록
    useCanvasStore.getState().onNodesChange([
      { type: "position", id: "a", dragging: false },
      { type: "position", id: "b", dragging: false },
    ]);
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    const byId = new Map(useCanvasStore.getState().nodes.map((n) => [n.id, n.position]));
    expect(byId.get("a")).toEqual({ x: 0, y: 0 });
    expect(byId.get("b")).toEqual({ x: 100, y: 0 });

    useHistoryStore.getState().redo();
    expect(useCanvasStore.getState().nodes.find((n) => n.id === "a")?.position).toEqual({ x: 10, y: 20 });
  });

  it("위치가 불변인 드래그(클릭·제자리 드롭)는 기록하지 않는다", () => {
    useCanvasStore.setState({ nodes: [makeNode("a")] });
    beginNodeDrag([{ id: "a", position: { x: 0, y: 0 } }]);
    useCanvasStore.getState().onNodesChange([{ type: "position", id: "a", dragging: false }]);
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
  });
});

describe("엣지 연결·해제 record (R2.4, R2.5)", () => {
  it("연결 undo=삭제, redo=같은 id로 재연결", () => {
    useCanvasStore.setState({ nodes: [makeNode("a"), makeNode("b", 100, 0)] });
    useCanvasStore.getState().applyLocalAddEdge("a", "b");
    const created = useCanvasStore.getState().edges[0];
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useCanvasStore.getState().edges).toHaveLength(0);
    useHistoryStore.getState().redo();
    expect(useCanvasStore.getState().edges.map((e) => e.id)).toEqual([created.id]);
  });

  it("해제 undo가 같은 id로 복원한다", () => {
    useCanvasStore.setState({
      nodes: [makeNode("a"), makeNode("b", 100, 0)],
      edges: [edge("e1", "a", "b")],
    });
    useCanvasStore.getState().applyLocalDeleteEdge("e1");
    useHistoryStore.getState().undo();
    expect(useCanvasStore.getState().edges.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("원격 수신·제외 연산은 기록하지 않는다 (R3.2, R2.8)", () => {
  it("applyRemote* 계열과 접기 토글은 스택에 쌓이지 않는다", () => {
    useCanvasStore.getState().applyRemoteAddNode(makeNode("r1"));
    useCanvasStore.getState().applyRemoteAddEdge(edge("re1", "r1", "r1"));
    useCanvasStore.getState().applyRemoteUpdateNode("r1", { title: "x" });
    useCanvasStore.getState().applyRemoteDeleteEdge("re1");
    useCanvasStore.getState().applyRemoteDeleteNode("r1");
    useCanvasStore.setState({ nodes: [makeNode("a")] });
    useCanvasStore.getState().applyLocalToggleCollapse("a");
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
  });

  it("타인 락 노드의 undo는 거부되고 스택에 유지된다 (R5.2)", () => {
    useCanvasStore.setState({ nodes: [makeNode("a")] });
    beginNodeDrag([{ id: "a", position: { x: 0, y: 0 } }]);
    useCanvasStore.getState().onNodesChange([
      { type: "position", id: "a", position: { x: 10, y: 0 }, dragging: true },
    ]);
    useCanvasStore.getState().onNodesChange([{ type: "position", id: "a", dragging: false }]);
    usePresenceStore.setState({ locks: { a: "other-user" } });

    const result = useHistoryStore.getState().undo();
    expect(result.status).toBe("locked");
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 10, y: 0 });
  });
});
