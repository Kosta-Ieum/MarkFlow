// 로그인·회원가입 화면 — react-hook-form + shared zod schema (IEUM-19)
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { LoginRequest, SignupRequest } from "@markflow/shared";
import { LoginRequestSchema, SignupRequestSchema } from "@markflow/shared";
import { useAuthStore } from "../../store/authStore";

interface AuthPageProps {
  mode: "login" | "signup";
}

// ── LoginForm ──────────────────────────────────────────────────────────────

interface LoginFormProps {
  onSuccess: () => void;
}

function LoginForm({ onSuccess }: LoginFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { login, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
  });

  const handleLogin = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      setServerError(message);
    }
  });

  const busy = isSubmitting || isLoading;

  return (
    <form onSubmit={handleLogin} noValidate>
      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 이메일 */}
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-secondary">
            이메일
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="hello@example.com"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        {/* 비밀번호 */}
        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-sm font-medium text-secondary"
          >
            비밀번호
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-error">{errors.password.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "처리 중…" : "로그인"}
      </button>
    </form>
  );
}

// ── SignupForm ─────────────────────────────────────────────────────────────

interface SignupFormProps {
  onSuccess: () => void;
}

function SignupForm({ onSuccess }: SignupFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { signup, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupRequest>({
    resolver: zodResolver(SignupRequestSchema),
  });

  const handleSignup = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await signup(data.name, data.email, data.password);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다.";
      setServerError(message);
    }
  });

  const busy = isSubmitting || isLoading;

  return (
    <form onSubmit={handleSignup} noValidate>
      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 이름 */}
        <div>
          <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium text-secondary">
            이름
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            placeholder="홍길동"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-error">{errors.name.message}</p>
          )}
        </div>

        {/* 이메일 */}
        <div>
          <label
            htmlFor="signup-email"
            className="mb-1.5 block text-sm font-medium text-secondary"
          >
            이메일
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="hello@example.com"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email.message}</p>
          )}
        </div>

        {/* 비밀번호 */}
        <div>
          <label
            htmlFor="signup-password"
            className="mb-1.5 block text-sm font-medium text-secondary"
          >
            비밀번호
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-error">{errors.password.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "처리 중…" : "계정 만들기"}
      </button>
    </form>
  );
}

// ── AuthPage ───────────────────────────────────────────────────────────────

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";
  const navigate = useNavigate();

  const handleSuccess = () => {
    void navigate("/projects");
  };

  return (
    <section className="mx-auto flex max-w-md animate-mfup flex-col px-6 py-20">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <h2 className="font-display text-2xl font-bold text-ink">
          {isLogin ? "다시 오신 걸 환영해요" : "Markflow 시작하기"}
        </h2>
        <p className="mt-2 text-sm text-secondary">
          {isLogin ? "계속하려면 로그인하세요" : "몇 초면 계정을 만들 수 있어요"}
        </p>

        <div className="mt-8">
          {isLogin ? (
            <LoginForm onSuccess={handleSuccess} />
          ) : (
            <SignupForm onSuccess={handleSuccess} />
          )}
        </div>

        <p className="mt-6 text-sm text-muted">
          {isLogin ? (
            <>
              아직 계정이 없으신가요?{" "}
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
