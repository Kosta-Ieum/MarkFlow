// 캔버스 공용 상수 — 화면설계서 §4.4.2 (기본 뷰포트) / §4.4.3 (줌 범위)
export const DEFAULT_VIEWPORT = { x: 24, y: 34, zoom: 0.74 };
// 노드가 많은 캔버스에서 전체가 화면에 안 담기던 피드백으로 0.4 → 0.15 완화(Docs/04 §4.4.3).
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2;
export const SIDEBAR_EXPANDED_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 52;
