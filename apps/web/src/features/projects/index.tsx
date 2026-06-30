// IEUM-20: 프로젝트 리스트 화면 (F2-1.4)
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProjectSummary, Role } from "@markflow/shared";
import { ApiError } from "../../lib/api";
import { canManage } from "../../lib/permissions";
import { MembersModal } from "../members/MembersModal";
import { useCreateProject, useDeleteProject, useProjects, useRenameProject } from "./useProjects";

// ── 유틸: 날짜 상대 포맷 ────────────────────────────────────────────────────

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// ── Role 배지 ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "내 프로젝트",
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

// ── ProjectCard ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectSummary;
  onManageMembers: (project: ProjectSummary) => void;
}

function ProjectCard({ project, onManageMembers }: ProjectCardProps) {
  const navigate = useNavigate();
  const rename = useRenameProject();
  const del = useDeleteProject();

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const handleCardClick = () => {
    if (!renaming) {
      void navigate(`/p/${project.id}`);
    }
  };

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(project.name);
    setRenaming(true);
    setTimeout(() => renameRef.current?.focus(), 0);
  };

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.name) {
      await rename.mutateAsync({ id: project.id, body: { name: trimmed } });
    }
    setRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenaming(false);
    }
  };

  const handleManageMembersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onManageMembers(project);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await del.mutateAsync(project.id);
    setConfirmDelete(false);
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === "Enter" && handleCardClick()}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label={`프로젝트: ${project.name}`}
    >
      {/* 썸네일 영역 — 점격자 미리보기 */}
      <div
        aria-hidden
        className="mb-4 h-[80px] rounded-xl border border-line-sub bg-canvas"
        style={{
          backgroundImage:
            "radial-gradient(circle, #B9B4A7 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* 프로젝트명 / 인라인 rename */}
      <div className="mb-2 flex items-start justify-between gap-2">
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            maxLength={120}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => void handleRenameSubmit()}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-md border border-brand bg-white px-2 py-0.5 text-sm font-semibold text-ink focus:outline-none"
            aria-label="프로젝트 이름 편집"
          />
        ) : (
          <h3 className="flex-1 truncate text-sm font-semibold text-ink">{project.name}</h3>
        )}

        {/* 소유자 전용 액션 버튼 */}
        {project.isOwner && (
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {!renaming && canManage(project.role) && (
              <button
                type="button"
                onClick={handleManageMembersClick}
                className="rounded p-1 text-muted hover:bg-line hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                aria-label="멤버 관리"
                title="공유 / 멤버 관리"
              >
                <ShareIcon />
              </button>
            )}

            {!renaming && (
              <button
                type="button"
                onClick={handleRenameStart}
                className="rounded p-1 text-muted hover:bg-line hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                aria-label="이름 변경"
                title="이름 변경"
              >
                <PencilIcon />
              </button>
            )}

            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => void handleDeleteConfirm(e)}
                  disabled={del.isPending}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-error hover:bg-error-bg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error disabled:opacity-50"
                  aria-label="영구 삭제 확인"
                  title="되돌릴 수 없습니다"
                >
                  영구 삭제
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="rounded px-1.5 py-0.5 text-xs text-muted hover:text-ink focus-visible:outline-none"
                  aria-label="취소"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="rounded p-1 text-muted hover:bg-error-bg hover:text-error focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error"
                aria-label="프로젝트 삭제"
                title="프로젝트 영구 삭제 (복구 불가)"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 메타: role 배지 + 노드 수 + 수정 시각 */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <RoleBadge role={project.role} />
        <span>노드 {project.nodeCount}</span>
        <span>{formatUpdatedAt(project.updatedAt)}</span>
      </div>
    </article>
  );
}

// ── 아이콘 (인라인 SVG — 외부 의존성 없음) ──────────────────────────────────

function PencilIcon() {
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
      <path d="M11.5 2.5l2 2-8 8-2.5.5.5-2.5 8-8z" />
    </svg>
  );
}

function ShareIcon() {
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
      <circle cx="12" cy="3.5" r="1.8" />
      <circle cx="4" cy="8" r="1.8" />
      <circle cx="12" cy="12.5" r="1.8" />
      <path d="M10.4 4.4L5.6 7.1M5.6 8.9l4.8 2.7" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" />
    </svg>
  );
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5" aria-hidden>
      <div className="mb-4 h-[80px] animate-pulse rounded-xl bg-line" />
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-line" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
    </div>
  );
}

// ── ProjectsPage ─────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects();
  const create = useCreateProject();

  const [newName, setNewName] = useState("");
  const [membersTarget, setMembersTarget] = useState<ProjectSummary | null>(null);

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await create.mutateAsync({ name: trimmed });
    setNewName("");
  };

  // 에러 메시지 추출
  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : error
          ? "프로젝트 목록을 불러오지 못했습니다."
          : null;

  return (
    <section className="mx-auto max-w-5xl animate-mfup px-6 py-12">
      {/* 헤더 행 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-[30px] font-bold text-ink">프로젝트</h2>
        </div>

        {/* 새 프로젝트 인라인 생성 폼 */}
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="flex items-center gap-2"
          aria-label="새 프로젝트 만들기"
        >
          <input
            type="text"
            value={newName}
            maxLength={120}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="프로젝트 이름"
            disabled={create.isPending}
            className="w-52 rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
            aria-label="새 프로젝트 이름"
          />
          <button
            type="submit"
            disabled={create.isPending || !newName.trim()}
            className="rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? "만드는 중…" : "+ 새 프로젝트"}
          </button>
        </form>
      </div>

      {/* create 에러 */}
      {create.error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
        >
          {create.error instanceof ApiError
            ? create.error.message
            : "프로젝트 생성 중 오류가 발생했습니다."}
        </div>
      )}

      {/* 목록 로드 에러 배너 */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div className="mt-8">
        {isLoading ? (
          /* 로딩 스켈레톤 */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          /* 프로젝트 그리드 */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onManageMembers={setMembersTarget} />
            ))}
          </div>
        ) : (
          /* 빈 상태 */
          <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center text-muted">
            아직 표시할 프로젝트가 없습니다.
          </div>
        )}
      </div>

      {/* 멤버 관리 모달 (OWNER) */}
      {membersTarget && (
        <MembersModal
          projectId={membersTarget.id}
          projectName={membersTarget.name}
          onClose={() => setMembersTarget(null)}
        />
      )}
    </section>
  );
}
