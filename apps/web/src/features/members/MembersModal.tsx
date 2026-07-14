// 멤버 관리 / 초대 모달 (F2 프로젝트 도메인)
// 무의존 커스텀 다이얼로그(role="dialog" aria-modal) — trash PurgeConfirmDialog 패턴.
// 권한 가드는 서버(REST)가 최종. 여기 OWNER 비활성화는 UX 보조.
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Member, MemberInviteRequest, Role } from "@markflow/shared";
import { MemberInviteRequestSchema } from "@markflow/shared";
import { ApiError } from "../../lib/api";
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "./useMembers";

// ── Role 배지 ─────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "소유자",
  EDITOR: "편집자",
  VIEWER: "뷰어",
};

interface RoleBadgeProps {
  role: Role;
}

function RoleBadge({ role }: RoleBadgeProps) {
  const base = "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium";
  if (role === "OWNER") {
    return <span className={`${base} bg-brand/10 text-brand`}>{ROLE_LABEL[role]}</span>;
  }
  return <span className={`${base} bg-line text-secondary`}>{ROLE_LABEL[role]}</span>;
}

// ── 에러 메시지 추출 ─────────────────────────────────────────────────────────

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

// ── 멤버 행 (OWNER 액션) ──────────────────────────────────────────────────────

interface MemberRowProps {
  projectId: string;
  member: Member;
}

function MemberRow({ projectId, member }: MemberRowProps) {
  const updateRole = useUpdateMemberRole(projectId);
  const remove = useRemoveMember(projectId);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isOwnerRow = member.role === "OWNER";
  const busy = updateRole.isPending || remove.isPending;

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === "EDITOR" || next === "VIEWER") {
      updateRole.mutate({ userId: member.userId, body: { role: next } });
    }
  };

  const handleRemoveConfirm = () => {
    remove.mutate(member.userId, {
      onSuccess: () => setConfirmRemove(false),
    });
  };

  const actionError = updateRole.error ?? remove.error;

  return (
    <li className="flex flex-col gap-1 border-b border-line-sub py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{member.nickname ?? member.name}</p>
          <p className="truncate text-xs text-muted">{member.email}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isOwnerRow ? (
            <RoleBadge role={member.role} />
          ) : (
            <>
              <label className="sr-only" htmlFor={`role-${member.userId}`}>
                {member.nickname ?? member.name} 역할
              </label>
              <select
                id={`role-${member.userId}`}
                value={member.role}
                onChange={handleRoleChange}
                disabled={busy}
                className="rounded-[10px] border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              >
                <option value="EDITOR">편집자</option>
                <option value="VIEWER">뷰어</option>
              </select>

              {confirmRemove ? (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleRemoveConfirm}
                    disabled={busy}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-error hover:bg-error-bg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error disabled:opacity-50"
                    aria-label={`${member.name} 제거 확인`}
                  >
                    제거
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    disabled={busy}
                    className="rounded px-1.5 py-0.5 text-xs text-muted hover:text-ink focus-visible:outline-none disabled:opacity-50"
                    aria-label="제거 취소"
                  >
                    취소
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  disabled={busy}
                  className="rounded p-1 text-muted hover:bg-error-bg hover:text-error focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error disabled:opacity-50"
                  aria-label={`${member.name} 제거`}
                  title="멤버 제거"
                >
                  <RemoveIcon />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-xs text-error">
          {toMessage(actionError, "멤버 변경 중 오류가 발생했습니다.")}
        </p>
      )}
    </li>
  );
}

// ── 초대 폼 ───────────────────────────────────────────────────────────────────

interface InviteFormProps {
  projectId: string;
}

function InviteForm({ projectId }: InviteFormProps) {
  const invite = useInviteMember(projectId);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MemberInviteRequest>({
    resolver: zodResolver(MemberInviteRequestSchema),
    defaultValues: { email: "", role: "EDITOR" },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await invite.mutateAsync(data);
      reset({ email: "", role: "EDITOR" });
    } catch (err) {
      setServerError(toMessage(err, "초대 중 오류가 발생했습니다."));
    }
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-2" noValidate>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label htmlFor="invite-email" className="sr-only">
            초대할 이메일
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="초대할 이메일"
            autoComplete="off"
            disabled={invite.isPending}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            {...register("email")}
          />
        </div>

        <label htmlFor="invite-role" className="sr-only">
          역할
        </label>
        <select
          id="invite-role"
          disabled={invite.isPending}
          className="rounded-[10px] border border-line bg-surface px-2 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
          {...register("role")}
        >
          <option value="EDITOR">편집자</option>
          <option value="VIEWER">뷰어</option>
        </select>

        <button
          type="submit"
          disabled={invite.isPending}
          className="shrink-0 rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {invite.isPending ? "초대 중…" : "초대"}
        </button>
      </div>

      {errors.email && <p className="text-xs text-error">{errors.email.message}</p>}

      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error"
        >
          {serverError}
        </div>
      )}
    </form>
  );
}

// ── MembersModal ──────────────────────────────────────────────────────────────

interface MembersModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function MembersModal({ projectId, projectName, onClose }: MembersModalProps) {
  const { data: members, isLoading, error } = useMembers(projectId);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc 닫기 + 최초 포커스
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const errorMessage = error
    ? toMessage(error, "멤버 목록을 불러오지 못했습니다.")
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-dialog-title"
        tabIndex={-1}
        className="mx-4 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-line bg-surface p-6 shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              id="members-dialog-title"
              className="font-display text-lg font-semibold text-ink"
            >
              멤버 관리
            </h3>
            <p className="truncate text-xs text-muted">{projectName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-line hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 초대 폼 */}
        <InviteForm projectId={projectId} />

        {/* 멤버 목록 */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <ul aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex-1">
                    <div className="mb-1 h-4 w-1/2 animate-pulse rounded bg-line" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded bg-line" />
                </li>
              ))}
            </ul>
          ) : errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error"
            >
              {errorMessage}
            </div>
          ) : members && members.length > 0 ? (
            <ul>
              {members.map((m) => (
                <MemberRow key={m.userId} projectId={projectId} member={m} />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted">아직 멤버가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 아이콘 (인라인 SVG — 외부 의존성 없음) ──────────────────────────────────

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10" />
    </svg>
  );
}
