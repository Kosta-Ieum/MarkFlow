// IEUM-29: 노드 상세 에디터 — 전체화면
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import type { NodeType } from "@markflow/shared";
import { canEdit } from "../../lib/permissions";
import { requestNodeLock, useCanvasStore } from "../../store/canvasStore";
import { useAuthStore } from "../../store/authStore";
import { usePresenceStore } from "../../store/presenceStore";
import { ChatFab } from "../panel/ChatFab";
import { useCanvasSnapshot, useNode, useSaveNode } from "./useNodeEditor";

// --- 노드 타입 메타 ---

interface NodeTypeMeta {
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  idea: {
    label: "아이디어",
    dotClass: "bg-node-idea-dot",
    textClass: "text-node-idea-text",
    bgClass: "bg-node-idea-bg",
    borderClass: "border-node-idea-border",
  },
  doc: {
    label: "문서",
    dotClass: "bg-node-doc-dot",
    textClass: "text-node-doc-text",
    bgClass: "bg-node-doc-bg",
    borderClass: "border-node-doc-border",
  },
  task: {
    label: "할 일",
    dotClass: "bg-node-task-dot",
    textClass: "text-node-task-text",
    bgClass: "bg-node-task-bg",
    borderClass: "border-node-task-border",
  },
  decision: {
    label: "결정",
    dotClass: "bg-node-decision-dot",
    textClass: "text-node-decision-text",
    bgClass: "bg-node-decision-bg",
    borderClass: "border-node-decision-border",
  },
  data: {
    label: "데이터",
    dotClass: "bg-node-data-dot",
    textClass: "text-node-data-text",
    bgClass: "bg-node-data-bg",
    borderClass: "border-node-data-border",
  },
};

const NODE_TYPE_OPTIONS: NodeType[] = ["idea", "doc", "task", "decision", "data"];

// --- 디바운스 효과 훅 (외부 의존성 없이) ---

function useDebouncedEffect(fn: () => void, deps: unknown[], delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  // 최초 마운트는 실행하지 않는다 — 변경분이 있을 때만.
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fnRef.current();
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// --- 저장 상태 표시 ---

type SaveStatus = "idle" | "saving" | "saved" | "error";

// --- NodeEditorPage ---

export function NodeEditorPage() {
  const { projectId = "", nodeId = "" } = useParams<{
    projectId: string;
    nodeId: string;
  }>();
  const navigate = useNavigate();

  const { data: node, isLoading, isError } = useNode(projectId, nodeId);
  const { data: snapshot } = useCanvasSnapshot(projectId);
  const { mutateAsync: saveNode } = useSaveNode(projectId, nodeId);

  const role = snapshot?.project.role;
  const myId = useAuthStore((s) => s.user?.id);
  const lockedBy = usePresenceStore((s) => s.locks[nodeId]);
  const lockerName = usePresenceStore((s) => {
    if (!lockedBy) return undefined;
    const u = s.onlineUsers.find((u) => u.id === lockedBy);
    return u?.nickname ?? u?.name;
  });
  const lockedByOther = !!lockedBy && lockedBy !== myId;
  // role 미확정(로딩 중)이거나 다른 사람이 이 노드를 락 중이면 읽기 전용으로 방어.
  // canEdit는 OWNER|EDITOR. — 캔버스 카드 더블클릭 가드(handleEnterEdit)는 진입 전
  // 소프트 체크일 뿐이라, 직접 URL 진입·동시 더블클릭 같은 race를 못 막는다. 여기가
  // 실제 진입점이니 이 안에서 다시 체크하고, 진입 가능하면 락을 직접 acquire한다.
  const isReadOnly = role === undefined || !canEdit(role) || lockedByOther;

  useEffect(() => {
    // 캔버스 인덱스를 거치지 않고 이 페이지로 바로 진입(딥링크)하면 canvasStore.role이
    // 비어 있어 ChatFab 등 하위 컴포넌트의 권한 판단이 틀릴 수 있다 — 여기서도 채워준다.
    if (role !== undefined) useCanvasStore.setState({ role });
  }, [role]);

  useEffect(() => {
    // 다른 사람이 이미 들고 있거나, 애초에 편집 권한이 없으면(VIEWER) 락을 잡지 않는다.
    if (lockedByOther || role === undefined || !canEdit(role)) return;
    requestNodeLock(nodeId);
    return () => requestNodeLock(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, lockedByOther, role]);

  // 로컬 편집 상태
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [type, setType] = useState<NodeType>("idea");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Enter로 줄바꿈해도 마크다운은 개행 하나만으로는 같은 문단으로 합쳐 렌더된다 —
  // 커서 위치에 <br>을 직접 삽입해 항상 눈에 보이는 줄바꿈이 되게 한다. Shift+Enter는
  // (에디터 관용대로) 그냥 개행만 — 문단을 나누고 싶을 때 쓸 수 있게 남겨둔다.
  const handleMarkdownEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd, value } = el;
    const next = `${value.slice(0, selectionStart)}<br>\n${value.slice(selectionEnd)}`;
    setMarkdown(next);
    // 삽입 문자열 "<br>\n"의 길이(5) — 정적분석기가 문자열 리터럴에서 파생된 값이면 숫자여도
    // "raw HTML을 담는 변수"로 계속 taint 추적하길래, 하드코딩 상수로 체인을 끊는다.
    const INSERTED_LENGTH = 5;
    const caret = selectionStart + INSERTED_LENGTH;
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret;
    });
  };

  // 서버 데이터 로드 시 초기화 (한 번만)
  const initialized = useRef(false);
  useEffect(() => {
    if (node && !initialized.current) {
      setTitle(node.title);
      setMarkdown(node.markdown);
      setType(node.type);
      initialized.current = true;
    }
  }, [node]);

  // 저장 실행 함수
  const handleSave = async () => {
    if (isReadOnly) return;
    setSaveStatus("saving");
    try {
      await saveNode({ title, markdown, type });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  // 디바운스 자동저장 (title/markdown/type 변경 시 2초 후)
  useDebouncedEffect(
    () => {
      if (!isReadOnly && initialized.current) {
        void handleSave();
      }
    },
    [title, markdown, type],
    2000,
  );

  // 뒤로가기
  const handleBack = () => {
    navigate(`/p/${projectId}`);
  };

  // --- 로딩/에러/not-found 분기 ---

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-app">
        <p className="font-mono text-sm text-muted">불러오는 중…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-app">
        <p className="text-sm text-error">노드를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-line px-4 py-2 text-sm text-secondary hover:bg-surface"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-app">
        <p className="text-sm text-secondary">노드를 찾을 수 없습니다.</p>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-line px-4 py-2 text-sm text-secondary hover:bg-surface"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const displayType = isReadOnly ? (node?.type ?? type) : type;
  const displayTitle = isReadOnly ? (node?.title ?? title) : title;
  const displayMarkdown = isReadOnly ? (node?.markdown ?? markdown) : markdown;

  const meta = NODE_TYPE_META[displayType];

  const saveStatusLabel =
    saveStatus === "saving"
      ? "저장 중…"
      : saveStatus === "saved"
        ? "저장됨"
        : saveStatus === "error"
          ? "저장 실패"
          : "";

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-app">
      {/* 상단 바 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="캔버스로 돌아가기"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-line"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* 타입 배지 + 타입 선택 */}
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClass}`}
            aria-hidden="true"
          />
          <label htmlFor="node-type-select" className="sr-only">
            노드 타입
          </label>
          <select
            id="node-type-select"
            value={displayType}
            onChange={(e) => setType(e.target.value as NodeType)}
            disabled={isReadOnly}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${meta.bgClass} ${meta.borderClass} ${meta.textClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {NODE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {NODE_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>

        {/* 제목 입력 */}
        <label htmlFor="node-title-input" className="sr-only">
          노드 제목
        </label>
        <input
          id="node-title-input"
          type="text"
          value={displayTitle}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isReadOnly}
          placeholder="제목 없음"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-base font-semibold text-ink placeholder-muted outline-none hover:border-line focus:border-brand focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
        />

        {/* 저장 상태 + 저장 버튼 */}
        <div className="flex shrink-0 items-center gap-2">
          {saveStatusLabel && (
            <span
              className={`font-mono text-xs ${saveStatus === "error" ? "text-error" : "text-muted"}`}
              aria-live="polite"
            >
              {saveStatusLabel}
            </span>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveStatus === "saving"}
              className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              저장
            </button>
          )}
          {isReadOnly && (
            <span className="rounded-full bg-line px-2 py-0.5 font-mono text-xs text-muted">
              {lockedByOther ? `🔒 ${lockerName ?? "다른 사용자"} 편집 중 — 읽기 전용` : "읽기 전용"}
            </span>
          )}
        </div>
      </header>

      {/* 본문 — MDEditor 전체화면 */}
      <div className="flex min-h-0 flex-1 flex-col" data-color-mode="light">
        <MDEditor
          value={displayMarkdown}
          onChange={(val) => setMarkdown(val ?? "")}
          height="100%"
          preview={isReadOnly ? "preview" : "live"}
          visibleDragbar={false}
          style={{ flex: 1, borderRadius: 0, border: "none" }}
          textareaProps={{
            disabled: isReadOnly,
            "aria-label": "마크다운 편집",
            onKeyDown: handleMarkdownEnter,
          }}
        />
      </div>

      {/* 우하단 채팅 FAB — §3.3·§4.4.4: 전체화면 에디터에서도 같은 캔버스 채팅방 접근.
          VIEWER는 소켓이 필요 없어 채팅/히스토리를 아예 숨긴다(비활성이 아니라 미노출). */}
      {role !== undefined && role !== "VIEWER" && <ChatFab projectId={projectId} />}
    </div>
  );
}
