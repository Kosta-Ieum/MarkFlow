// §3.2 푸터 — 랜딩 하단 노출. Markflow 워드마크 + 저작권.
export function Footer() {
  return (
    <footer className="border-t border-line bg-surface px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between">
        {/* 워드마크 */}
        <span className="font-display text-sm font-semibold">
          <span className="text-ink">Mark</span>
          <span className="text-brand">flow</span>
        </span>

        {/* 저작권 */}
        <p className="text-xs text-muted">© 2025 Markflow · mingyu Lim</p>
      </div>
    </footer>
  );
}
