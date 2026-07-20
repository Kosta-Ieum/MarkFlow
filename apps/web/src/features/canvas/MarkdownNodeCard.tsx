// 커스텀 마크다운 노드 카드 — IEUM-22 [F1-1.2] + IEUM-35 [F1-3.2] 소프트 락 UI
// 화면설계서 §4.4.2: 186px 라운드 카드, 타입 도트+라벨+제목+접기/펼치기.
// 접힘: 제목 + 첫 비제목 라인 26자 truncate. 펼침: 마크다운 렌더 본문.
// §4.4 소프트 락 명세: 타인이 편집 중이면 잠금 아이콘+"OO 편집 중" 배지, 본인은 진입 차단(읽기 전용).
import { memo, useEffect, useRef, useState } from "react";

import type { MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNavigate, useParams } from "react-router-dom";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import type { NodeType } from "@markflow/shared";

import { canEdit } from "../../lib/permissions";
import { getUserColor } from "../../lib/userColor";
import { useAuthStore } from "../../store/authStore";
import { requestNodeLock, useCanvasStore, type MarkdownNodeData } from "../../store/canvasStore";
import { usePresenceStore } from "../../store/presenceStore";

export type { MarkdownNodeData };

// Tailwind JIT는 소스의 완전한 리터럴 클래스명만 스캔하므로
// `bg-node-${type}-bg` 같은 동적 조합 대신 타입별 완성 클래스를 그대로 적는다.
const TYPE_STYLES: Record<
  NodeType,
  { label: string; header: string; text: string; dot: string; ring: string }
> = {
  idea: { label: "IDEA", header: "bg-node-idea-bg", text: "text-node-idea-text", dot: "bg-node-idea-dot", ring: "ring-node-idea-dot/35" },
  doc: { label: "DOC", header: "bg-node-doc-bg", text: "text-node-doc-text", dot: "bg-node-doc-dot", ring: "ring-node-doc-dot/35" },
  task: { label: "TASK", header: "bg-node-task-bg", text: "text-node-task-text", dot: "bg-node-task-dot", ring: "ring-node-task-dot/35" },
  decision: { label: "DECISION", header: "bg-node-decision-bg", text: "text-node-decision-text", dot: "bg-node-decision-dot", ring: "ring-node-decision-dot/35" },
  data: { label: "DATA", header: "bg-node-data-bg", text: "text-node-data-text", dot: "bg-node-data-dot", ring: "ring-node-data-dot/35" },
};

// 펼친 본문 높이 상한(R2.1) — text-xs 기준 약 12~14줄. 실화면 보고 조정 가능(design §2).
const EXPANDED_MAX_HEIGHT = 240;

// 펼침 본문 렌더 — 라이트 테마 고정(R1.1) + 높이 상한 & 넘칠 때만 잘림 표시(R2.1/R2.2).
// "넘쳤는지"는 렌더 후 실제 높이로만 알 수 있어, 내부 콘텐츠를 ResizeObserver로 관찰한다
// (바깥 박스는 상한에서 크기가 멈추므로 바깥을 관찰하면 이미지 로드 등 늦은 성장을 놓친다).
function ExpandedMarkdown({ markdown }: { markdown: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => setIsClamped(outer.scrollHeight > outer.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [markdown]);

  return (
    <div
      ref={outerRef}
      // 에디터(node-editor)·휴지통(TrashPanel)과 동일 패턴 — OS 다크모드여도 카드처럼 라이트 렌더.
      data-color-mode="light"
      style={{ maxHeight: EXPANDED_MAX_HEIGHT }}
      className="relative mt-1.5 overflow-hidden text-xs text-secondary [&_.wmde-markdown]:bg-transparent [&_pre]:overflow-x-auto [&_pre]:bg-code-bg [&_pre]:text-code-fg [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_img]:max-w-full"
    >
      <div ref={innerRef}>
        <MDEditor.Markdown source={markdown || "*내용 없음*"} />
      </div>
      {isClamped && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-surface to-transparent">
          <span className="pb-0.5 text-sm leading-none text-muted">⋯</span>
        </div>
      )}
    </div>
  );
}

// 첫 번째 비-제목 라인(미리보기용), 26자 truncate — §4.4.2
function getPreviewLine(markdown: string): string {
  const line = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "내용 없음";
  return line.length > 26 ? `${line.slice(0, 26)}…` : line;
}

function MarkdownNodeCardInner({ id, data, selected }: NodeProps & { data: MarkdownNodeData }) {
  const { title, markdown, type, collapsed } = data;
  const toggleCollapse = useCanvasStore((s) => s.applyLocalToggleCollapse);
  const role = useCanvasStore((s) => s.role);
  const style = TYPE_STYLES[type];

  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const myId = useAuthStore((s) => s.user?.id);
  const lockedBy = usePresenceStore((s) => s.locks[id]);
  const lockerName = usePresenceStore((s) => {
    if (!lockedBy) return undefined;
    const u = s.onlineUsers.find((u) => u.id === lockedBy);
    return u?.nickname ?? u?.name;
  });
  const lockedByOther = !!lockedBy && lockedBy !== myId;

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    toggleCollapse(id);
  };

  const handleEnterEdit = () => {
    if (lockedByOther) return; // §4.4 소프트 락: 타인 편집 중이면 진입 차단(읽기 전용)
    // VIEWER(또는 role 미확정)는 편집 권한이 없으니 락을 잡지 않는다 — 노드 에디터는 읽기 전용으로 열림.
    if (role !== null && canEdit(role)) {
      requestNodeLock(id); // 편집 세션 시작 — 해제는 캔버스 이탈 시 소켓 연결 종료로 처리(서버 측 정책)
    }
    navigate(`/p/${projectId}/n/${id}`);
  };

  return (
    <div
      // nopan: React Flow는 draggable=false인 노드에는 이 클래스를 안 붙여서, 카드 위 클릭이
      // 캔버스 배경 팬(이동) 제스처로 흡수돼 더블클릭이 씹힌다(VIEWER=읽기전용에서 실제로 겪은 버그).
      // draggable=true일 땐 RF가 어차피 자동으로 붙이는 클래스라 중복 추가해도 무해하다.
      // select-none: Ctrl(⌘)+드래그로 여러 노드를 마퀴 선택할 때 카드 안 텍스트(제목·미리보기)가
      // 브라우저 텍스트 선택으로 같이 잡혀 파랗게 강조되던 문제 — 카드는 클릭/더블클릭으로만
      // 상호작용하지 텍스트를 직접 드래그해 복사할 일이 없어 선택 자체를 막는다.
      className={`nopan relative w-[186px] select-none rounded-xl border border-line bg-surface shadow-sm transition-shadow ${
        selected ? `ring-[3px] ${style.ring}` : ""
      } ${lockedByOther ? "opacity-80" : ""}`}
      onDoubleClick={handleEnterEdit}
    >
      {lockedByOther && (
        <div
          className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: getUserColor(lockedBy) }}
        >
          🔒 {lockerName ?? "다른 사용자"} 편집 중
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-edge" />

      <div className={`flex items-center gap-1.5 rounded-t-xl px-3 py-2 ${style.header}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className={`shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>
          {style.label}
        </span>
        <button
          type="button"
          aria-label={collapsed ? "펼치기" : "접기"}
          onClick={handleToggle}
          className="ml-auto shrink-0 rounded p-0.5 text-secondary hover:bg-black/5"
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-ink">{title || "제목 없음"}</p>
        {collapsed ? (
          <p className="mt-1 truncate font-mono text-xs text-muted">{getPreviewLine(markdown)}</p>
        ) : (
          // 높이 상한 + 잘림 표시(spec node-card-preview-and-count R2) — 과거 "높이 제한 없이
          // 전부"는 카드가 캔버스를 덮는 문제로 뒤집힘. 전체 열람은 더블클릭 → 에디터(R2.3).
          <ExpandedMarkdown markdown={markdown} />
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-edge" />
    </div>
  );
}

export const MarkdownNodeCard = memo(MarkdownNodeCardInner);
