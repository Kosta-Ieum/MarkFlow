// 좌측 노드 리스트 사이드바 — 화면설계서 §4.4.1
import { useReactFlow } from "@xyflow/react";
import { Link } from "react-router-dom";

import { useCanvasStore } from "../../store/canvasStore";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./constants";

export interface LeftSidebarNode {
  id: string;
  title: string;
}

interface LeftSidebarProps {
  projectId: string;
  expanded: boolean;
  onToggle: () => void;
  onAddNode: () => void;
  nodeCount: number;
  nodes: LeftSidebarNode[];
}

export function LeftSidebar({ projectId, expanded, onToggle, onAddNode, nodeCount, nodes }: LeftSidebarProps) {
  const width = expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
  const projectName = useCanvasStore((s) => s.projectName);
  const selectedNodeId = useCanvasStore((s) => s.nodes.find((n) => n.selected)?.id);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const { fitView } = useReactFlow();

  const handleSelect = (id: string) => {
    selectNode(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2 });
  };

  return (
    <aside
      className="flex h-full flex-col border-r border-line bg-surface transition-[width] duration-150"
      style={{ width }}
    >
      {expanded ? (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-line p-3">
            <Link to="/projects" aria-label="프로젝트 리스트로" className="shrink-0">
              <span className="grid h-7 w-7 place-items-center rounded-[28%] bg-ink" aria-hidden />
            </Link>
            <Link
              to="/projects"
              className="flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm font-medium text-ink hover:bg-canvas"
            >
              <span className="block truncate">{projectName ?? `프로젝트 ${projectId}`}</span>
              <span className="text-xs text-muted">노드 {nodeCount}개</span>
            </Link>
            <button
              type="button"
              aria-label="노드 추가"
              onClick={onAddNode}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
            >
              +
            </button>
            <button
              type="button"
              aria-label="사이드바 접기"
              onClick={onToggle}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
            >
              «
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted">노드 리스트</p>
            {nodes.length === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-line p-6 text-center text-xs text-muted">
                아직 노드가 없습니다.
              </div>
            ) : (
              <div className="mt-2 space-y-0.5">
                {nodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelect(n.id)}
                    className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas hover:text-ink ${
                      n.id === selectedNodeId ? "bg-canvas font-medium text-ink" : "text-secondary"
                    }`}
                  >
                    {n.title || "제목 없음"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line p-3 text-[11px] leading-relaxed text-muted">
            드래그로 노드를 옮기고, 더블클릭으로 편집, 휴지통으로 끌어다 놓으면 삭제됩니다.
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center gap-3 py-3">
          <Link to="/projects" aria-label="프로젝트 리스트로">
            <span className="grid h-7 w-7 place-items-center rounded-[28%] bg-ink" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label="사이드바 펼치기"
            onClick={onToggle}
            className="grid h-7 w-7 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
          >
            »
          </button>
          <button
            type="button"
            aria-label="노드 추가"
            onClick={onAddNode}
            className="grid h-7 w-7 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
          >
            +
          </button>
          <div className="mt-auto text-[11px] text-muted">{nodeCount}</div>
        </div>
      )}
    </aside>
  );
}
