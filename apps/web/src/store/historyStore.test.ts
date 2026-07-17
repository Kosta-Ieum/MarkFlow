// historyStore 단위 테스트 — canvasStore 의존 없이 순수 로직만 검증.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useHistoryStore,
  type HistoryCommand,
  type HistoryValidator,
} from "./historyStore";

function makeCmd(label: string): HistoryCommand & {
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
} {
  return { label, undo: vi.fn(), redo: vi.fn() };
}

const alwaysValid: HistoryValidator = () => ({ ok: true });

beforeEach(() => {
  useHistoryStore.setState({
    undoStack: [],
    redoStack: [],
    isApplying: false,
    validator: alwaysValid,
  });
});

describe("record → undo → redo 왕복", () => {
  it("record 후 undo는 cmd.undo()를 호출하고 redoStack으로 옮긴다", () => {
    const cmd = makeCmd("노드 이동");
    useHistoryStore.getState().record(cmd);

    const result = useHistoryStore.getState().undo();

    expect(cmd.undo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "done", label: "노드 이동" });
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
    expect(useHistoryStore.getState().redoStack).toEqual([cmd]);
  });

  it("undo 후 redo는 cmd.redo()를 호출하고 undoStack으로 되돌린다", () => {
    const cmd = makeCmd("노드 이동");
    useHistoryStore.getState().record(cmd);
    useHistoryStore.getState().undo();

    const result = useHistoryStore.getState().redo();

    expect(cmd.redo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "done", label: "노드 이동" });
    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
    expect(useHistoryStore.getState().undoStack).toEqual([cmd]);
  });
});

describe("record 시 redoStack 무효화(R6.3)", () => {
  it("redoStack에 값이 있어도 새 record()가 오면 비운다", () => {
    const cmd1 = makeCmd("a");
    const cmd2 = makeCmd("b");
    useHistoryStore.getState().record(cmd1);
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().redoStack).toHaveLength(1);

    useHistoryStore.getState().record(cmd2);

    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
    expect(useHistoryStore.getState().undoStack).toEqual([cmd2]);
  });
});

describe("MAX_HISTORY=50 상한(R6.4)", () => {
  it("50개를 넘기면 오래된 것부터 폐기한다", () => {
    for (let i = 0; i < 55; i++) {
      useHistoryStore.getState().record(makeCmd(`cmd-${i}`));
    }

    const undoStack = useHistoryStore.getState().undoStack;
    expect(undoStack).toHaveLength(50);
    expect(undoStack[0].label).toBe("cmd-5");
    expect(undoStack[49].label).toBe("cmd-54");
  });
});

describe("clear()", () => {
  it("undoStack·redoStack을 모두 비운다", () => {
    useHistoryStore.getState().record(makeCmd("a"));
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().redoStack).toHaveLength(1);

    useHistoryStore.getState().clear();

    expect(useHistoryStore.getState().undoStack).toEqual([]);
    expect(useHistoryStore.getState().redoStack).toEqual([]);
  });
});

describe("빈 스택 no-op", () => {
  it("undoStack이 비어있으면 undo()는 empty를 반환하고 아무것도 실행하지 않는다", () => {
    const result = useHistoryStore.getState().undo();
    expect(result).toEqual({ status: "empty" });
  });

  it("redoStack이 비어있으면 redo()는 empty를 반환한다", () => {
    const result = useHistoryStore.getState().redo();
    expect(result).toEqual({ status: "empty" });
  });
});

describe("validator: missing → 커맨드 폐기", () => {
  it("undo 대상이 missing이면 undoStack에서 폐기하고 redoStack엔 넣지 않는다", () => {
    const cmd = makeCmd("삭제된 노드 이동");
    useHistoryStore.setState({ undoStack: [cmd], validator: () => ({ ok: false, reason: "missing" }) });

    const result = useHistoryStore.getState().undo();

    expect(cmd.undo).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "missing", label: "삭제된 노드 이동" });
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("redo 대상이 missing이면 redoStack에서 폐기하고 undoStack엔 넣지 않는다", () => {
    const cmd = makeCmd("삭제된 노드 이동");
    useHistoryStore.setState({ redoStack: [cmd], validator: () => ({ ok: false, reason: "missing" }) });

    const result = useHistoryStore.getState().redo();

    expect(cmd.redo).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "missing", label: "삭제된 노드 이동" });
    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
  });
});

describe("validator: locked → 스택 유지", () => {
  it("undo 대상이 locked면 undoStack에 그대로 남는다", () => {
    const cmd = makeCmd("잠긴 노드");
    useHistoryStore.setState({ undoStack: [cmd], validator: () => ({ ok: false, reason: "locked" }) });

    const result = useHistoryStore.getState().undo();

    expect(cmd.undo).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "locked", label: "잠긴 노드" });
    expect(useHistoryStore.getState().undoStack).toEqual([cmd]);
  });

  it("redo 대상이 locked면 redoStack에 그대로 남는다", () => {
    const cmd = makeCmd("잠긴 노드");
    useHistoryStore.setState({ redoStack: [cmd], validator: () => ({ ok: false, reason: "locked" }) });

    const result = useHistoryStore.getState().redo();

    expect(cmd.redo).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "locked", label: "잠긴 노드" });
    expect(useHistoryStore.getState().redoStack).toEqual([cmd]);
  });
});

describe("isApplying 중 record no-op", () => {
  it("isApplying=true인 동안 record()는 undoStack을 바꾸지 않는다", () => {
    useHistoryStore.setState({ isApplying: true });

    useHistoryStore.getState().record(makeCmd("에코"));

    expect(useHistoryStore.getState().undoStack).toHaveLength(0);
  });

  it("undo() 실행 중 cmd.undo()가 record()를 호출해도 무시된다(에코 방지)", () => {
    const echo = makeCmd("에코 시도");
    const cmd: HistoryCommand = {
      label: "이동",
      undo: () => {
        useHistoryStore.getState().record(echo);
      },
      redo: vi.fn(),
    };
    useHistoryStore.setState({ undoStack: [cmd] });

    useHistoryStore.getState().undo();

    expect(useHistoryStore.getState().redoStack).toEqual([cmd]);
    expect(useHistoryStore.getState().redoStack).not.toContain(echo);
  });
});
