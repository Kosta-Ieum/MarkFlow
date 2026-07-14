// 프로필 페이지 — 내 정보 조회(이름·이메일 읽기전용) + 닉네임 변경(R3·R4).
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UpdateProfileRequest } from "@markflow/shared";
import { UpdateProfileRequestSchema } from "@markflow/shared";

import { useAuthStore } from "../../store/authStore";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileRequest>({
    resolver: zodResolver(UpdateProfileRequestSchema),
    defaultValues: { nickname: user?.nickname ?? "" },
  });

  const onSubmit = handleSubmit(async ({ nickname }) => {
    setServerError(null);
    setSaved(false);
    try {
      await updateProfile(nickname);
      reset({ nickname }); // 저장값을 새 기준으로 — isDirty 초기화
      setSaved(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "닉네임 변경 중 오류가 발생했습니다.");
    }
  });

  return (
    <section className="mx-auto flex max-w-md animate-mfup flex-col px-6 py-20">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <h2 className="font-display text-2xl font-bold text-ink">프로필</h2>
        <p className="mt-2 text-sm text-secondary">계정 정보를 확인하고 닉네임을 변경할 수 있어요.</p>

        {/* 읽기 전용 정보 (R3.2) */}
        <div className="mt-8 flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-secondary">이름</span>
            <p className="rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink">
              {user?.name ?? "-"}
            </p>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-secondary">이메일</span>
            <p className="rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink">
              {user?.email ?? "-"}
            </p>
          </div>
        </div>

        {/* 닉네임 변경 (R4) */}
        <form onSubmit={onSubmit} noValidate className="mt-6 border-t border-line pt-6">
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
            >
              {serverError}
            </div>
          )}
          <label htmlFor="profile-nickname" className="mb-1.5 block text-sm font-medium text-secondary">
            닉네임
          </label>
          <input
            id="profile-nickname"
            type="text"
            autoComplete="nickname"
            placeholder="협업 화면에 표시될 이름 (2~20자)"
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            {...register("nickname")}
          />
          {errors.nickname && <p className="mt-1 text-xs text-error">{errors.nickname.message}</p>}
          {saved && !isDirty && <p className="mt-1 text-xs text-brand">저장했어요.</p>}

          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="mt-6 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중…" : "닉네임 저장"}
          </button>
        </form>
      </div>
    </section>
  );
}
