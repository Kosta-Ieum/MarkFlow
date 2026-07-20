// 줌 컨트롤 — 화면설계서 §4.4.3: 하단 우측 화이트 필, ↶↷(undo/redo) / 줌% / − / + / ⊙(화면 맞춤)
// 우측 패널 폭 보정은 필요 없다 — 이 컴포넌트가 그려지는 CanvasSurface 자체가 이미
// RightPanel과 flex 형제라 패널이 열리면 폭이 저절로 줄어든다(과거엔 여기서 offsetRight로
// 또 밀어서 좁아진 영역 밖으로 나가 안 보이는 버그가 있었다).
import { useState } from "react";
import { useReactFlow, useStore, useViewport } from "@xyflow/react";
import type { Node as FlowNode } from "@xyflow/react";

import { canEdit } from "../../lib/permissions";
import { useCanvasStore } from "../../store/canvasStore";
import { DEFAULT_VIEWPORT, MAX_ZOOM, MIN_ZOOM } from "./constants";
import { UndoRedoControls } from "./UndoRedoControls";

// 노드가 멀리 떨어진 여러 무리로 나뉘어 있으면, 전체를 다 담으려는 fitView는 확 줌아웃돼서
// 결과적으로 아무것도 잘 안 보이게 된다 — "무리"로 묶어서 그중 하나(노드가 더 많은 쪽, 같으면
// 지금 보던 자리에 더 가까운 쪽)에만 화면을 맞춘다.
const CLUSTER_DISTANCE = 800;

function clusterNodes(nodes: FlowNode[]): FlowNode[][] {
  const clusters: FlowNode[][] = [];
  const visited = new Set<string>();
  for (const start of nodes) {
    if (visited.has(start.id)) continue;
    const cluster: FlowNode[] = [];
    const queue = [start];
    visited.add(start.id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      cluster.push(cur);
      for (const other of nodes) {
        if (visited.has(other.id)) continue;
        const dx = other.position.x - cur.position.x;
        const dy = other.position.y - cur.position.y;
        if (Math.sqrt(dx * dx + dy * dy) <= CLUSTER_DISTANCE) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function clusterCenter(cluster: FlowNode[]): { x: number; y: number } {
  return {
    x: cluster.reduce((sum, n) => sum + n.position.x, 0) / cluster.length,
    y: cluster.reduce((sum, n) => sum + n.position.y, 0) / cluster.length,
  };
}

export function ZoomControls() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, zoomTo, setViewport, getNodes, fitView, getViewport } = useReactFlow();
  const paneSize = useStore((s) => ({ width: s.width, height: s.height }));
  const role = useCanvasStore((s) => s.role);
  const readOnly = role !== null && !canEdit(role);
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const applyLocalArrangeNodes = useCanvasStore((s) => s.applyLocalArrangeNodes);
  // ⊙ 버튼 토글 — "지금 화면 상태가 이미 맞춰진 것처럼 보이는지"를 매번 다시 추측하지 않고,
  // 그냥 눌린 순서대로 확대(맞춤) ↔ 축소(최소 줌)가 번갈아 나오게 한다. 기하학적으로 "이미
  // 맞춰졌는지"를 판정하려던 이전 버전은 react-flow의 실제 줌 계산과 근사치가 어긋나면
  // 계속 같은 방향으로만 동작하는 문제가 있었다 — 명시적 토글이 훨씬 예측 가능하다.
  const [isFitted, setIsFitted] = useState(false);

  return (
    <div
      // select-none: 캔버스에서 Shift+드래그로 마퀴 선택할 때 마우스가 이 pill 위를 지나가면
      // 줌 퍼센트·버튼 텍스트가 브라우저 텍스트 선택으로 같이 잡히던 문제 방지.
      className="absolute bottom-6 right-6 z-10 flex select-none items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-sm"
    >
      <UndoRedoControls />
      <button
        type="button"
        aria-label="노드 정렬"
        title="뒤죽박죽인 노드를 그리드로 한 번에 정리"
        disabled={readOnly || nodeCount === 0}
        onClick={() => applyLocalArrangeNodes()}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ▦
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <span className="w-10 text-center font-mono text-xs text-secondary" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="줌 아웃"
        onClick={() => zoomOut({ duration: 150 })}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        −
      </button>
      <button
        type="button"
        aria-label="줌 인"
        onClick={() => zoomIn({ duration: 150 })}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        +
      </button>
      <button
        type="button"
        aria-label={isFitted ? "최소 줌으로 축소" : "화면 맞춤"}
        onClick={() => {
          const nodes = getNodes();
          // 노드가 없으면(스캐폴드 단계) 토글 없이 기본 뷰포트로 복원
          if (nodes.length === 0) {
            setViewport(DEFAULT_VIEWPORT, { duration: 200 });
            setIsFitted(false);
            return;
          }
          if (isFitted) {
            zoomTo(MIN_ZOOM, { duration: 200 });
            setIsFitted(false);
            return;
          }
          // 노드들이 서로 멀리 떨어진 무리로 나뉘어 있으면 전체를 다 담는 대신, 노드가
          // 더 많은 무리(동률이면 지금 화면 중심에 더 가까운 무리) 하나에만 맞춘다.
          const vp = getViewport();
          const clusters = clusterNodes(nodes);
          const viewCenter = {
            x: (paneSize.width / 2 - vp.x) / vp.zoom,
            y: (paneSize.height / 2 - vp.y) / vp.zoom,
          };
          const distToViewCenter = (c: { x: number; y: number }) =>
            Math.hypot(c.x - viewCenter.x, c.y - viewCenter.y);
          const target = clusters.reduce((best, c) => {
            if (c.length !== best.length) return c.length > best.length ? c : best;
            return distToViewCenter(clusterCenter(c)) < distToViewCenter(clusterCenter(best)) ? c : best;
          }, clusters[0]);
          fitView({ nodes: target.map((n) => ({ id: n.id })), duration: 200, maxZoom: MAX_ZOOM });
          setIsFitted(true);
        }}
        className="grid h-7 w-7 place-items-center rounded-full text-secondary hover:bg-canvas hover:text-ink"
      >
        ⊙
      </button>
    </div>
  );
}
