// 커스텀 마크다운 노드 카드 — IEUM-22 [F1-1.2]
// 화면설계서 §4.4.2: 186px 라운드 카드, 타입 도트+라벨+제목+접기/펼치기.
// 접힘: 제목 + 첫 비제목 라인 26자 truncate. 펼침: 마크다운 렌더 본문.
// 실제 데이터 영속화(Zustand 스토어 연동)는 IEUM-23, 전체화면 에디터는 별도 페이지 티켓 범위.
import { memo } from "react";
import type { MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import type { NodeType } from "@markflow/shared";

import { useCanvasStore, type MarkdownNodeData } from "../../store/canvasStore";

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
  const style = TYPE_STYLES[type];

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    toggleCollapse(id);
  };

  return (
    <div
      className={`w-[186px] rounded-xl border border-line bg-surface shadow-sm transition-shadow ${
        selected ? `ring-[3px] ${style.ring}` : ""
      }`}
    >
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
          <div className="mt-1.5 max-h-48 overflow-y-auto text-xs text-secondary [&_pre]:bg-code-bg [&_pre]:text-code-fg">
            <MDEditor.Markdown source={markdown || "*내용 없음*"} />
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-edge" />
    </div>
  );
}

export const MarkdownNodeCard = memo(MarkdownNodeCardInner);
