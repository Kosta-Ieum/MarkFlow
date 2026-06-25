// 프로젝트 리스트·휴지통 화면 (셸 토대 — 목록 로드는 후속 티켓)
// TODO(IEUM-20): TanStack Query 프로젝트 목록
export function ProjectsPage() {
  return (
    <section className="mx-auto max-w-5xl animate-mfup px-6 py-12">
      <h2 className="font-display text-[30px] font-bold text-ink">프로젝트</h2>
      <p className="mt-3 text-sm text-secondary">프로젝트 리스트 (F2-1.4 구현 예정)</p>

      <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-12 text-center text-muted">
        아직 표시할 프로젝트가 없습니다.
      </div>
    </section>
  );
}
