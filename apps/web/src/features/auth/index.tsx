// 로그인·회원가입 화면 (셸 토대 — 폼/검증/네트워크는 후속 티켓)
// TODO(IEUM-19): react-hook-form + shared zod 폼
import { Link } from "react-router-dom";

interface AuthPageProps {
  mode: "login" | "signup";
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";

  return (
    <section className="mx-auto flex max-w-md animate-mfup flex-col px-6 py-20">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <h2 className="font-display text-2xl font-bold text-ink">
          {isLogin ? "로그인" : "회원가입"}
        </h2>
        <p className="mt-3 text-sm text-secondary">
          {isLogin ? "로그인" : "회원가입"} (F2-1.3 구현 예정)
        </p>

        <p className="mt-8 text-sm text-muted">
          {isLogin ? (
            <>
              계정이 없으신가요?{" "}
              <Link to="/signup" className="font-medium text-brand">
                회원가입
              </Link>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{" "}
              <Link to="/login" className="font-medium text-brand">
                로그인
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
