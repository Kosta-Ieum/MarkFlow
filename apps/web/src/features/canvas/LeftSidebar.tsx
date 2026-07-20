// 좌측 노드 리스트 사이드바 — 화면설계서 §4.4.1
import { useState } from "react";
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
  const applyLocalDeleteNode = useCanvasStore((s) => s.applyLocalDeleteNode);
  const { fitView } = useReactFlow();
  // 일괄 삭제 — 휴지통과 동일 패턴(TrashPanel). 여러 노드를 하나씩 지우는 게 번거롭다는 피드백.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelect = (id: string) => {
    selectNode(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2 });
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = nodes.length > 0 && nodes.every((n) => prev.has(n.id));
      if (allSelected) return new Set();
      return new Set(nodes.map((n) => n.id));
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    // 소프트 삭제(휴지통 이동)라 되돌릴 수 있다 — 캔버스의 다른 삭제 경로(Del 키·드래그)와
    // 동일하게 확인창 없이 바로 처리해 일관성을 맞춘다.
    selectedIds.forEach((id) => applyLocalDeleteNode(id));
    setSelectedIds(new Set());
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
            <div className="flex items-center justify-between gap-2">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted">노드 리스트</p>
              {!readOnly && nodes.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                    selectMode ? "bg-brand/10 text-brand" : "text-muted hover:bg-canvas"
                  }`}
                >
                  {selectMode ? "완료" : "선택"}
                </button>
              )}
            </div>

            {selectMode && (
              <div className="mt-1.5 flex items-center justify-between px-1">
                <button type="button" onClick={toggleSelectAll} className="text-xs font-medium text-brand hover:underline">
                  {nodes.length > 0 && nodes.every((n) => selectedIds.has(n.id)) ? "전체 해제" : "전체 선택"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="rounded-md bg-error-bg px-2 py-0.5 text-xs font-medium text-error disabled:cursor-not-allowed disabled:opacity-40"
                >
                  선택 삭제 ({selectedIds.size})
                </button>
              </div>
            )}

            {nodes.length === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-line p-6 text-center text-xs text-muted">
                아직 노드가 없습니다.
              </div>
            ) : (
              <div className="mt-2 space-y-0.5">
                {nodes.map((n) => (
                  <div key={n.id} className="flex items-center gap-1.5">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(n.id)}
                        onChange={() => toggleSelected(n.id)}
                        className="ml-1 shrink-0"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => (selectMode ? toggleSelected(n.id) : handleSelect(n.id))}
                      className={`block w-full flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas hover:text-ink ${
                        n.id === selectedNodeId ? "bg-canvas font-medium text-ink" : "text-secondary"
                      }`}
                    >
                      {n.title || "제목 없음"}
                    </button>
                  </div>
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
