import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <section className="mx-auto flex max-w-3xl animate-mfup flex-col items-center px-6 py-24 text-center">
      <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
        Markdown · Node Canvas · Realtime
      </p>
      <h1 className="font-display text-[64px] font-bold leading-[1.04] tracking-[-0.03em] text-ink">
        <span>Mark</span>
        <span className="text-brand">flow</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-secondary">
        마크다운 노드를 캔버스 위에서 연결하고, 팀과 실시간으로 함께 정리하세요.
      </p>
      <div className="mt-10 flex items-center gap-3">
        <Link
          to="/signup"
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-surface"
        >
          시작하기
        </Link>
        <Link
          to="/login"
          className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-secondary hover:text-ink"
        >
          로그인
        </Link>
      </div>
    </section>
  );
}
