// IEUM-40 [F2-4.1] 랜딩 페이지 보강 — 화면설계서 §4.1
// Eyebrow → Hero H1 → 서브카피 → CTA → 제품 프리뷰 → 기능 그리드 → 푸터
import { Link } from "react-router-dom";
import { Footer } from "../../components/Footer";

// ── 제품 프리뷰 mock (CSS/SVG only — 외부 이미지·의존성 없음) ────────────────

function ProductPreview() {
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-line shadow-xl">
      {/* 브라우저 크롬 */}
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-error" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-node-idea-dot" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-node-task-dot" aria-hidden="true" />
        <span className="mx-3 flex-1 rounded-full bg-line py-1 px-3 font-mono text-xs text-muted">
          markflow.app/p/…
        </span>
      </div>

      {/* 캔버스 영역 — 점격자 + 샘플 노드 + SVG 베지어 연결선 */}
      <div
        className="relative h-72 overflow-hidden bg-canvas"
        style={{
          backgroundImage: "radial-gradient(circle, #B9B4A7 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-label="캔버스 미리보기"
        role="img"
      >
        {/* SVG 베지어 연결선 */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {/* 킥오프 → 요구사항 정리 */}
          <path
            d="M 216 84 C 270 84, 270 148, 330 148"
            stroke="#B9B4A7"
            strokeWidth="2"
            strokeDasharray="6 6"
            fill="none"
          />
          {/* 킥오프 → MVP 채팅 구현 */}
          <path
            d="M 216 84 C 270 84, 270 220, 330 220"
            stroke="#B9B4A7"
            strokeWidth="2"
            strokeDasharray="6 6"
            fill="none"
          />
          {/* 요구사항 정리 → React Flow 채택 */}
          <path
            d="M 516 148 C 560 148, 560 84, 590 84"
            stroke="#B9B4A7"
            strokeWidth="2"
            strokeDasharray="6 6"
            fill="none"
          />
        </svg>

        {/* 노드 1 — 킥오프 (idea) */}
        <div
          className="absolute flex w-44 flex-col rounded-xl border border-node-idea-border bg-node-idea-bg p-3 shadow-sm"
          style={{ left: 32, top: 60 }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-node-idea-dot" aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium uppercase text-node-idea-text">
              아이디어
            </span>
          </div>
          <p className="text-xs font-semibold text-ink">킥오프</p>
          <p className="mt-0.5 font-mono text-[10px] text-node-idea-text truncate">
            # 목표 정리…
          </p>
        </div>

        {/* 노드 2 — 요구사항 정리 (doc) */}
        <div
          className="absolute flex w-44 flex-col rounded-xl border border-node-doc-border bg-node-doc-bg p-3 shadow-sm"
          style={{ left: 330, top: 120 }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-node-doc-dot" aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium uppercase text-node-doc-text">
              문서
            </span>
          </div>
          <p className="text-xs font-semibold text-ink">요구사항 정리</p>
          <p className="mt-0.5 font-mono text-[10px] text-node-doc-text truncate">
            - 실시간 협업…
          </p>
        </div>

        {/* 노드 3 — MVP 채팅 구현 (task) */}
        <div
          className="absolute flex w-44 flex-col rounded-xl border border-node-task-border bg-node-task-bg p-3 shadow-sm"
          style={{ left: 330, top: 195 }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-node-task-dot" aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium uppercase text-node-task-text">
              할 일
            </span>
          </div>
          <p className="text-xs font-semibold text-ink">MVP 채팅 구현</p>
          <p className="mt-0.5 font-mono text-[10px] text-node-task-text truncate">
            [ ] Socket.io…
          </p>
        </div>

        {/* 노드 4 — React Flow 채택 (decision) */}
        <div
          className="absolute flex w-44 flex-col rounded-xl border border-node-decision-border bg-node-decision-bg p-3 shadow-sm"
          style={{ left: 590, top: 60 }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-node-decision-dot" aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium uppercase text-node-decision-text">
              결정
            </span>
          </div>
          <p className="text-xs font-semibold text-ink">React Flow 채택?</p>
          <p className="mt-0.5 font-mono text-[10px] text-node-decision-text truncate">
            v11 기준…
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 기능 그리드 카드 ──────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-secondary">{description}</p>
    </div>
  );
}

// ── LandingPage ───────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <>
      <div className="flex flex-col items-center">
        {/* ── Hero 섹션 ────────────────────────────────────────────────────── */}
        <section className="mx-auto flex w-full max-w-3xl animate-mfup flex-col items-center px-6 py-24 text-center">
          {/* Eyebrow 필 */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            <span className="font-mono text-xs text-secondary">
              마크다운 · 노드 캔버스 · AI 채팅
            </span>
          </div>

          {/* Hero H1 — 64px / 700 / line-height 1.04 / letter-spacing -.03em */}
          <h1 className="font-display text-[64px] font-bold leading-[1.04] tracking-[-0.03em] text-ink">
            마크다운으로 그리는
            <br />
            <span className="text-brand">생각의 흐름</span>
          </h1>

          {/* 서브카피 */}
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-secondary">
            노드를 잇고, 마크다운으로 적고, AI와 대화하며 정리하세요. 팀과 실시간으로 함께하는
            새로운 사고 도구.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/signup"
              className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              무료로 시작하기
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-line px-6 py-3 text-sm font-semibold text-secondary transition-colors hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label="캔버스 둘러보기 (로그인 필요)"
            >
              캔버스 둘러보기
            </Link>
          </div>
        </section>

        {/* ── 제품 프리뷰 ─────────────────────────────────────────────────── */}
        <section
          className="w-full max-w-5xl px-6 pb-20"
          aria-label="제품 미리보기"
        >
          <ProductPreview />
        </section>

        {/* ── 기능 그리드 ─────────────────────────────────────────────────── */}
        <section
          className="mx-auto w-full max-w-5xl px-6 pb-24"
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            className="mb-10 text-center font-display text-[30px] font-bold text-ink"
          >
            왜 Markflow인가요?
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FeatureCard
              icon="⌘"
              title="무한 노드 캔버스"
              description="팬·줌이 가능한 무한 캔버스 위에서 생각을 노드로 펼치고 베지어 엣지로 연결하세요."
            />
            <FeatureCard
              icon="✎"
              title="마크다운 노드"
              description="각 노드는 독립적인 마크다운 문서입니다. 코드 펜스, 체크박스, 인용 등 완전한 MD를 지원합니다."
            />
            <FeatureCard
              icon="✦"
              title="AI 채팅 & 히스토리"
              description="팀과 실시간으로 채팅하고, 모든 변경 이력을 타임라인으로 한눈에 확인하세요."
            />
          </div>
        </section>
      </div>

      {/* ── 푸터 §3.2 ───────────────────────────────────────────────────────── */}
      <Footer />
    </>
  );
}
