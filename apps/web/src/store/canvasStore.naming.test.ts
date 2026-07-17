// 새 노드 기본 이름 번호 고유화(R3) — projectId=null·activeCollab 미등록이라 REST·소켓 없이 store만 돈다.
import { describe, it, expect, beforeEach } from "vitest";

import { useCanvasStore, type CanvasNode } from "./canvasStore";
import { useHistoryStore } from "./historyStore";

function makeNode(id: string, title: string): CanvasNode {
  return {
    id,
    type: "markdown",
    position: { x: 0, y: 0 },
    data: { title, markdown: "", type: "idea", collapsed: true },
  };
}

function addedTitle(id: string): string {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
  if (!node) throw new Error("생성된 노드를 찾지 못함");
  return node.data.title;
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [], trashedNodes: [], projectId: null, saveTimer: null });
  useHistoryStore.getState().clear();
});

describe("새 노드 기본 이름 번호 (R3)", () => {
  it("빈 캔버스에서 첫 생성은 '새 노드 1' (R3.1)", () => {
    const id = useCanvasStore.getState().applyLocalAddNode({ x: 0, y: 0 });
    expect(addedTitle(id)).toBe("새 노드 1");
  });

  it("연속 생성 시 번호가 증가한다 (R3.1)", () => {
    const s = useCanvasStore.getState();
    s.applyLocalAddNode({ x: 0, y: 0 });
    s.applyLocalAddNode({ x: 0, y: 0 });
    const id3 = s.applyLocalAddNode({ x: 0, y: 0 });
    expect(addedTitle(id3)).toBe("새 노드 3");
  });

  it("중간 번호를 삭제(휴지통 이동)해도 다음 생성이 기존 번호와 중복되지 않는다 (R3.2)", () => {
    const s = useCanvasStore.getState();
    const id1 = s.applyLocalAddNode({ x: 0, y: 0 });
    s.applyLocalAddNode({ x: 0, y: 0 });
    s.applyLocalAddNode({ x: 0, y: 0 });
    s.applyLocalDeleteNode(id1); // "새 노드 1" → 휴지통
    const id4 = s.applyLocalAddNode({ x: 0, y: 0 });
    expect(addedTitle(id4)).toBe("새 노드 4"); // length+1이었다면 "새 노드 3" 중복
  });

  it("휴지통에만 있는 최대 번호도 승계한다 (R3.2)", () => {
    useCanvasStore.setState({ trashedNodes: [makeNode("t1", "새 노드 7")] });
    const id = useCanvasStore.getState().applyLocalAddNode({ x: 0, y: 0 });
    expect(addedTitle(id)).toBe("새 노드 8");
  });

  it("사용자 지정 제목은 번호 계산에서 무시된다 (R3.3)", () => {
    useCanvasStore.setState({
      nodes: [
        makeNode("a", "회의록 3안"),
        makeNode("b", "새 노드 계획"), // 패턴 불일치(숫자 없음)
        makeNode("c", "새 노드 2"),
      ],
    });
    const id = useCanvasStore.getState().applyLocalAddNode({ x: 0, y: 0 });
    expect(addedTitle(id)).toBe("새 노드 3");
  });
});
