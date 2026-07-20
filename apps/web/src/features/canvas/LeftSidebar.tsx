// 좌측 노드 리스트 사이드바 — 화면설계서 §4.4.1
import { useReactFlow } from "@xyflow/react";
import { Link } from "react-router-dom";

import { canEdit, ROLE_LABEL } from "../../lib/permissions";
import { useCanvasStore } from "../../store/canvasStore";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH } from "./constants";

// 프로젝트 목록으로 나가는 명확한 아이콘(뒤로가기 화살표) — 예전엔 브랜드 사각형(장식처럼 보임)과
// 프로젝트명 자체가 링크였는데, 둘 다 "나가기"로 안 읽혀 헷갈린다는 피드백을 반영한다.
function ExitToProjectsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);
  const selectedNodeId = useCanvasStore((s) => s.nodes.find((n) => n.selected)?.id);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const { fitView } = useReactFlow();

  const handleSelect = (id: string) => {
    selectNode(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2 });
  };

  return (
    <aside
      // relative + z-30: 캔버스 위 타인 커서 오버레이(z-20, CursorOverlay)보다 쌓임 순서를
      // 높여, 캔버스를 팬해서 커서가 이 영역까지 넘어오면 사이드바 아래로 가려지게 한다.
      // select-none: 캔버스에서 Ctrl+드래그로 여러 노드를 마퀴 선택할 때, 마우스가 사이드바
      // 쪽으로 벗어나면 브라우저 텍스트 선택이 사이드바 라벨까지 잡아버리던 문제 방지.
      className="relative z-30 flex h-full select-none flex-col border-r border-line bg-surface transition-[width] duration-150"
      style={{ width }}
    >
      {expanded ? (
        <>
          <div className="border-b border-line p-3">
            {/* 뒤로가기는 사이드바 접기 버튼과 나란히 있으면 헷갈린다는 피드백 반영 —
                별도 줄에 화살표+텍스트로 분리해 "나가는 동작"임을 명확히 한다. */}
            <Link
              to="/projects"
              aria-label="뒤로가기 - 프로젝트 목록으로 나가기"
              title="프로젝트 목록으로 나가기"
              className="mb-2 flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-secondary hover:bg-canvas hover:text-ink"
            >
              <ExitToProjectsIcon />
              뒤로가기
            </Link>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 px-1 py-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {projectName ?? `프로젝트 ${projectId}`}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  {role && (
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-secondary">
                      {ROLE_LABEL.get(role)}
                    </span>
                  )}
                  <span>노드 {nodeCount}개</span>
                </span>
              </div>
              <button
                type="button"
                aria-label="노드 추가"
                onClick={onAddNode}
                disabled={readOnly}
                title={readOnly ? "뷰어는 편집할 수 없습니다" : undefined}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
            {readOnly
              ? "뷰어 권한 — 캔버스를 보기만 할 수 있어요(이동·편집·삭제 불가)."
              : "드래그로 노드를 옮기고, 더블클릭으로 편집, 휴지통으로 끌어다 놓으면 삭제됩니다."}
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col items-center gap-3 py-3">
          <Link
            to="/projects"
            aria-label="프로젝트 목록으로 나가기"
            title="프로젝트 목록으로 나가기"
            className="grid h-7 w-7 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink"
          >
            <ExitToProjectsIcon />
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
            disabled={readOnly}
            title={readOnly ? "뷰어는 편집할 수 없습니다" : undefined}
            className="grid h-7 w-7 place-items-center rounded-md text-secondary hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            +
          </button>
          <div className="mt-auto text-[11px] text-muted">{nodeCount}</div>
        </div>
      )}
    </aside>
  );
}
