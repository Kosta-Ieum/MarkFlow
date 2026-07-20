import { BrandLoader } from "./BrandLoader";

// 전체 뷰포트를 덮는 로딩 스플래시 — 부팅·캔버스 로딩 공용.
// flow 안 배치(min-h 어림)는 헤더·사이드바만큼 치우친다 — fixed로 정중앙 보장.
export function LoadingSplash() {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-app">
      <BrandLoader />
    </div>
  );
}
