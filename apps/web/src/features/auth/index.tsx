// 로그인·회원가입 화면 — react-hook-form + shared zod schema (IEUM-19 + 이메일 OTP)
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  LoginRequest,
  SendCodeResponse,
  SignupRequest,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from "@markflow/shared";
import {
  LoginRequestSchema,
  SignupRequestSchema,
  VerifyEmailRequestSchema,
} from "@markflow/shared";
import { api, takeSessionNotice } from "../../lib/api";
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
  defaultValues?: Partial<SignupRequest>;
  onVerifyNeeded: (name: string, email: string, password: string, nickname: string) => void;
}

function SignupForm({ defaultValues, onVerifyNeeded }: SignupFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupRequest>({
    resolver: zodResolver(SignupRequestSchema),
    defaultValues,
  });

  // 인증 코드 발송이 성공해야 OTP 단계로 넘어간다 — 이메일 중복(409) 등은
  // 여기(가입 폼)에서 잡아 보여준다(OTP 화면으로 넘어간 뒤 뜨지 않게).
  const handleSignup = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await api<SendCodeResponse>("/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email: data.email }),
      });
      onVerifyNeeded(data.name, data.email, data.password, data.nickname);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "인증 코드 전송 중 오류가 발생했습니다.";
      setServerError(message);
    }
  });

  const busy = isSubmitting;

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

        {/* 닉네임 — 협업 화면(멤버·채팅)에 표시될 공개 이름 */}
        <div>
          <label htmlFor="signup-nickname" className="mb-1.5 block text-sm font-medium text-secondary">
            닉네임
          </label>
          <input
            id="signup-nickname"
            type="text"
            autoComplete="nickname"
            placeholder="협업 화면에 표시될 이름 (2~20자, 공백 없이)"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("nickname")}
            onKeyDown={(e) => {
              if (e.key === " ") e.preventDefault();
            }}
          />
          {errors.nickname && (
            <p className="mt-1 text-xs text-error">{errors.nickname.message}</p>
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
        {busy ? "처리 중…" : "이메일로 인증 코드 받기"}
      </button>
    </form>
  );
}

// ── VerifyStep ─────────────────────────────────────────────────────────────

interface VerifyStepProps {
  name: string;
  email: string;
  password: string;
  nickname: string;
  onBack: () => void;
  onSuccess: () => void;
}

type VerifyCodeForm = Pick<VerifyEmailRequest, "code">;

function VerifyStep({ name, email, password, nickname, onBack, onSuccess }: VerifyStepProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyCodeForm>({
    resolver: zodResolver(VerifyEmailRequestSchema.pick({ code: true })),
  });

  // 인증 코드는 가입 폼 제출 시 이미 발송됨(중복 이메일이면 거기서 걸러짐). 여기선 재전송만 담당.
  const sendCode = async () => {
    setServerError(null);
    try {
      await api<SendCodeResponse>("/auth/email/send-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "인증 코드 전송 중 오류가 발생했습니다.";
      setServerError(message);
    }
  };

  const handleResend = async () => {
    setNotice(null);
    await sendCode();
    setNotice("코드를 다시 보냈어요.");
  };

  const handleVerify = handleSubmit(async ({ code }) => {
    setServerError(null);
    setNotice(null);
    try {
      const result = await api<VerifyEmailResponse>("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      if (!result?.verified) {
        setServerError("인증 코드가 올바르지 않습니다.");
        return;
      }
      await useAuthStore.getState().signup(name, email, password, nickname);
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "인증 코드가 올바르지 않습니다.";
      setServerError(message);
    }
  });

  return (
    <form onSubmit={handleVerify} noValidate>
      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
        >
          {serverError}
        </div>
      )}

      <p className="mb-6 text-sm text-secondary">
        {email} 로 6자리 인증 코드를 보냈어요. 받은 편지함을 확인해 주세요.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="verify-code"
            className="mb-1.5 block text-sm font-medium text-secondary"
          >
            인증 코드
          </label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-center text-lg tracking-[0.3em] text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("code")}
          />
          {errors.code && (
            <p className="mt-1 text-xs text-error">{errors.code.message}</p>
          )}
          {notice && <p className="mt-1 text-xs text-secondary">{notice}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "처리 중…" : "인증하고 가입 완료"}
      </button>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-muted transition-colors hover:text-secondary"
        >
          ← 뒤로
        </button>
        <button
          type="button"
          onClick={() => void handleResend()}
          className="font-medium text-brand transition-opacity hover:opacity-80"
        >
          코드 재전송
        </button>
      </div>
    </form>
  );
}

// ── AuthPage ───────────────────────────────────────────────────────────────

interface PendingSignup {
  name: string;
  email: string;
  password: string;
  nickname: string;
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login";
  const navigate = useNavigate();

  // 회원가입 2단계: input ↔ verify. 입력값(pending)은 상위에서 보관해 뒤로/재전송 시 유지.
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [step, setStep] = useState<"input" | "verify">("input");
  const isVerifyStep = !isLogin && step === "verify" && pending !== null;

  // 서버가 세션을 강제 종료(다른 기기 로그인 등)해 로그인 화면으로 튕긴 경우 사유를 1회 표시.
  // takeSessionNotice는 읽으면서 지우므로, StrictMode 이중 이펙트에 값이 소실되지 않게 ref로 가드.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeReadRef = useRef(false);
  useEffect(() => {
    if (noticeReadRef.current) return;
    noticeReadRef.current = true;
    setNotice(takeSessionNotice());
  }, []);

  const handleSuccess = () => {
    void navigate("/projects");
  };

  return (
    <section className="mx-auto flex max-w-md animate-mfup flex-col px-6 py-20">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <h2 className="font-display text-2xl font-bold text-ink">
          {isLogin
            ? "다시 오신 걸 환영해요"
            : isVerifyStep
              ? "이메일을 확인해 주세요"
              : "Markflow 시작하기"}
        </h2>
        <p className="mt-2 text-sm text-secondary">
          {isLogin
            ? "계속하려면 로그인하세요"
            : isVerifyStep
              ? "인증 코드를 입력하면 가입이 완료돼요"
              : "몇 초면 계정을 만들 수 있어요"}
        </p>

        {notice && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
          >
            {notice}
          </div>
        )}

        <div className="mt-8">
          {isLogin ? (
            <LoginForm onSuccess={handleSuccess} />
          ) : isVerifyStep && pending ? (
            <VerifyStep
              name={pending.name}
              email={pending.email}
              password={pending.password}
              nickname={pending.nickname}
              onBack={() => setStep("input")}
              onSuccess={handleSuccess}
            />
          ) : (
            <SignupForm
              defaultValues={pending ?? undefined}
              onVerifyNeeded={(name, email, password, nickname) => {
                setPending({ name, email, password, nickname });
                setStep("verify");
              }}
            />
          )}
        </div>

        {!isVerifyStep && (
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
        )}
      </div>
    </section>
  );
}
