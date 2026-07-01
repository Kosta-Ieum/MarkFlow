// 사용자별 고정 색상 — 멀티커서·소프트락 배지·접속자 아바타 공용(IEUM-35, §4.4 멀티커서 UI 명세).
// 전체 문자열 해시(32bit 고정, 부동소수점 오버플로 방지) + 색상환에서 서로 먼 12색만 골라
// "다른 색이긴 한데 비슷해서 헷갈림"을 방지한다.
const USER_COLORS = [
  "#e11d48", // rose
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#9333ea", // purple
  "#0d9488", // teal
  "#dc2626", // red
  "#4338ca", // indigo
] as const;

function hashString(value: string): number {
  let acc = 0;
  for (const ch of value) {
    acc = (acc * 31 + ch.charCodeAt(0)) | 0; // 32bit로 고정 — 안 하면 긴 문자열에서 정밀도 손실로 다른 값끼리 충돌한다
  }
  return Math.abs(acc);
}

/** userId(또는 email) 기준 고정 색상. 같은 입력 → 항상 같은 색, 서로 다른 입력은 명확히 구분되는 색. */
export function getUserColor(userId: string): string {
  return USER_COLORS[hashString(userId) % USER_COLORS.length];
}
