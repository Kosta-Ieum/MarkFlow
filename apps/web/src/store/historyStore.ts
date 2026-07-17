// 캔버스 undo/redo 세션 스택 — 단일 진실원(.claude/rules/frontend.md).
// canvasStore 등 다른 store를 import하지 않는다 — node 환경 단위 테스트 전용, 의존성 없음.
// 실제 락/존재 검사는 setValidator로 후속 배선(T3)한다. 여기서는 항상 통과가 기본값.
import { create } from "zustand";

export interface HistoryCommand {
  /** 접근성/디버깅용 라벨 — "노드 이동" 등 */
  label: string;
  /** 역연산 — applyLocal* 호출(emit 포함) */
  undo: () => void;
  /** 재연산 — 원 동작 재적용(applyLocal* 호출) */
  redo: () => void;
  nodeIds?: string[];
  edgeIds?: string[];
}

export type HistoryBlockReason = "missing" | "locked";

export type HistoryValidator = (
  cmd: HistoryCommand,
) => { ok: true } | { ok: false; reason: HistoryBlockReason };

export type HistoryResult = {
  status: "done" | "empty" | "missing" | "locked";
  label?: string;
};

const MAX_HISTORY = 50;

const alwaysValid: HistoryValidator = () => ({ ok: true });

interface HistoryState {
  undoStack: HistoryCommand[];
  redoStack: HistoryCommand[];
  /** undo/redo가 cmd.undo()/cmd.redo()를 실행 중인 동안 true — record()의 에코 재기록 가드 */
  isApplying: boolean;
  validator: HistoryValidator;
  setValidator: (validator: HistoryValidator) => void;
  record: (cmd: HistoryCommand) => void;
  undo: () => HistoryResult;
  redo: () => HistoryResult;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  isApplying: false,
  validator: alwaysValid,

  setValidator: (validator) => set({ validator }),

  record: (cmd) => {
    if (get().isApplying) return;
    set((state) => {
      const undoStack = [...state.undoStack, cmd];
      if (undoStack.length > MAX_HISTORY) {
        undoStack.splice(0, undoStack.length - MAX_HISTORY);
      }
      return { undoStack, redoStack: [] };
    });
  },

  undo: () => {
    const { undoStack, validator } = get();
    if (undoStack.length === 0) return { status: "empty" };

    const cmd = undoStack[undoStack.length - 1];
    const result = validator(cmd);
    if (!result.ok) {
      if (result.reason === "missing") {
        set({ undoStack: undoStack.slice(0, -1) });
        return { status: "missing", label: cmd.label };
      }
      return { status: "locked", label: cmd.label };
    }

    set({ isApplying: true });
    try {
      cmd.undo();
    } finally {
      set({ isApplying: false });
    }
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, cmd],
    }));
    return { status: "done", label: cmd.label };
  },

  redo: () => {
    const { redoStack, validator } = get();
    if (redoStack.length === 0) return { status: "empty" };

    const cmd = redoStack[redoStack.length - 1];
    const result = validator(cmd);
    if (!result.ok) {
      if (result.reason === "missing") {
        set({ redoStack: redoStack.slice(0, -1) });
        return { status: "missing", label: cmd.label };
      }
      return { status: "locked", label: cmd.label };
    }

    set({ isApplying: true });
    try {
      cmd.redo();
    } finally {
      set({ isApplying: false });
    }
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, cmd],
    }));
    return { status: "done", label: cmd.label };
  },

  clear: () => set({ undoStack: [], redoStack: [] }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}));
