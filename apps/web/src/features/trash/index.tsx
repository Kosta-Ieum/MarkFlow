// IEUM-30: 프로젝트 휴지통 페이지 (F2-2.2)
import { useState } from "react";
import { Link } from "react-router-dom";
import type { DeletedProject } from "@markflow/shared";
import { ApiError } from "../../lib/api";
import { usePurgeProject, useRestoreProject, useTrash } from "./useTrash";

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────

function formatDeletedAt(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ── 영구 삭제 확인 오버레이 ───────────────────────────────────────────────────

interface PurgeConfirmDialogProps {
  projectName: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function PurgeConfirmDialog({
  projectName,
  isPending,
  onConfirm,
  onCancel,
}: PurgeConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purge-dialog-title"
        aria-describedby="purge-dialog-desc"
        className="mx-4 w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="purge-dialog-title"
          className="mb-2 font-display text-lg font-semibold text-ink"
        >
          프로젝트를 영구 삭제할까요?
        </h3>
        <p id="purge-dialog-desc" className="mb-6 text-sm text-secondary">
          <span className="font-medium text-ink">"{projectName}"</span>을(를) 영구 삭제하면
          되돌릴 수 없습니다. 모든 노드, 엣지, 히스토리가 함께 삭제됩니다.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-[10px] px-4 py-2 text-sm text-secondary hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-[10px] bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "삭제 중…" : "영구 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TrashCard ─────────────────────────────────────────────────────────────────

interface TrashCardProps {
  project: DeletedProject;
}

function TrashCard({ project }: TrashCardProps) {
  const restore = useRestoreProject();
  const purge = usePurgeProject();
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const handleRestoreClick = () => {
    void restore.mutate(project.id);
  };

  const handlePurgeClick = () => {
    setShowPurgeConfirm(true);
  };

  const handlePurgeConfirm = () => {
    purge.mutate(project.id, {
      onSuccess: () => setShowPurgeConfirm(false),
    });
  };

  const handlePurgeCancel = () => {
    setShowPurgeConfirm(false);
  };

  const isOwner = project.isOwner;
  const actionsPending = restore.isPending || purge.isPending;

  return (
    <>
      <article className="flex flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-md">
        {/* 프로젝트명 + 소유자 배지 */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold text-ink">{project.name}</h3>
          {!isOwner && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-line text-secondary">
              공유됨
            </span>
          )}
        </div>

        {/* 삭제 시각 */}
        <p className="mb-4 text-xs text-muted">
          삭제일: {formatDeletedAt(project.deletedAt)}
        </p>

        {/* 액션 버튼 — isOwner만 활성 */}
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={handleRestoreClick}
            disabled={!isOwner || actionsPending}
            className="flex-1 rounded-[10px] border border-brand px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`${project.name} 복구`}
            title={isOwner ? "프로젝트 복구" : "소유자만 복구할 수 있습니다"}
          >
            {restore.isPending ? "복구 중…" : "복구"}
          </button>
          <button
            type="button"
            onClick={handlePurgeClick}
            disabled={!isOwner || actionsPending}
            className="flex-1 rounded-[10px] border border-error px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`${project.name} 영구 삭제`}
            title={isOwner ? "영구 삭제 (되돌릴 수 없음)" : "소유자만 영구 삭제할 수 있습니다"}
          >
            영구 삭제
          </button>
        </div>
      </article>

      {showPurgeConfirm && (
        <PurgeConfirmDialog
          projectName={project.name}
          isPending={purge.isPending}
          onConfirm={handlePurgeConfirm}
          onCancel={handlePurgeCancel}
        />
      )}
    </>
  );
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5" aria-hidden>
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-line" />
      <div className="mb-4 h-3 w-1/2 animate-pulse rounded bg-line" />
      <div className="flex gap-2">
        <div className="h-7 flex-1 animate-pulse rounded-[10px] bg-line" />
        <div className="h-7 flex-1 animate-pulse rounded-[10px] bg-line" />
      </div>
    </div>
  );
}

// ── TrashPage ─────────────────────────────────────────────────────────────────

export function TrashPage() {
  const { data: projects, isLoading, error } = useTrash();

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : error
          ? "휴지통 목록을 불러오지 못했습니다."
          : null;

  return (
    <section className="mx-auto max-w-5xl animate-mfup px-6 py-12">
      {/* 헤더 행 */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/projects"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <ChevronLeftIcon />
            프로젝트로
          </Link>
          <h2 className="font-display text-[30px] font-bold text-ink">휴지통</h2>
        </div>
      </div>

      {/* 에러 배너 */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {/* 콘텐츠 영역 */}
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {projects.map((p) => (
            <TrashCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center text-muted">
          휴지통이 비어 있습니다.
        </div>
      )}
    </section>
  );
}

// ── 아이콘 ───────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}
