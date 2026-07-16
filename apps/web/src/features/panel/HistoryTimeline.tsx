// IEUM-40 [F2-4.1] 히스토리 탭 — ActivityTimeline
// 화면설계서 §4.4.6: 세로 타임라인 = 컬러 도트 + 연결선 + 이벤트 텍스트 + 모노 시각
// 전송 은닉: api() + useQuery만. fetch/socket 직접 호출 금지.
import { useQuery } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import type { ActivityDTO, ActivityAction, ActivityTarget } from "@markflow/shared";

import { api } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { useCanvasStore } from "../../store/canvasStore";

// ── 응답 envelope (openapi HistoryResponse) ──────────────────────────────────

interface HistoryResponse {
  history: ActivityDTO[];
  nextCursor?: string | null;
}

// ── 액션 한글 라벨 ────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<ActivityAction, string> = {
  CREATE: "만들었습니다",
  UPDATE: "수정했습니다",
  MOVE: "이동했습니다",
  DELETE: "삭제했습니다",
  RESTORE: "복원했습니다",
  CONNECT: "연결했습니다",
  DISCONNECT: "연결을 끊었습니다",
  RENAME: "이름을 변경했습니다",
};

// ── targetType별 도트 컬러 (디자인 토큰 매핑) ─────────────────────────────────
// NODE → 타입을 알 수 없을 때 brand 도트, EDGE → edge 색, PROJECT → brand
// ActivityDTO에 nodeType이 없으므로 targetType 단위로만 구분.

function getDotClass(targetType: ActivityTarget): string {
  switch (targetType) {
    case "NODE":
      return "bg-brand";
    case "EDGE":
      return "bg-edge";
    case "PROJECT":
      return "bg-brand/60";
    default:
      return "bg-muted";
  }
}

// targetLabel이 있을 경우 사용, 없으면 targetType 한글
function getTargetLabel(activity: ActivityDTO): string {
  if (activity.targetLabel) return activity.targetLabel;
  switch (activity.targetType) {
    case "NODE":
      return "노드";
    case "EDGE":
      return "연결";
    case "PROJECT":
      return "프로젝트";
    default:
      return "항목";
  }
}

// ── 시각 포맷 (모노: 상대 + 절대) ────────────────────────────────────────────

function formatTime(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let relative: string;
  if (diff < minute) {
    relative = "방금 전";
  } else if (diff < hour) {
    relative = `${Math.floor(diff / minute)}분 전`;
  } else if (diff < day) {
    relative = `${Math.floor(diff / hour)}시간 전`;
  } else if (diff < 7 * day) {
    relative = `${Math.floor(diff / day)}일 전`;
  } else {
    relative = new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  const absolute = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return { relative, absolute };
}

// ── ActivityItem ──────────────────────────────────────────────────────────────

interface ActivityItemProps {
  activity: ActivityDTO;
  isLast: boolean;
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const dotClass = getDotClass(activity.targetType);
  const targetLabel = getTargetLabel(activity);
  const actionLabel = ACTION_LABEL[activity.action] ?? activity.action;
  const { relative, absolute } = formatTime(activity.createdAt);

  const selectNode = useCanvasStore((s) => s.selectNode);
  const nodeExists = useCanvasStore((s) => !!activity.targetId && s.nodes.some((n) => n.id === activity.targetId));
  const { fitView } = useReactFlow();
  // 현재 캔버스에 살아있는 노드일 때만 클릭 가능 — 삭제된 노드는 잡을 대상이 없다.
  const clickable = activity.targetType === "NODE" && nodeExists;

  const handleClick = () => {
    if (!clickable || !activity.targetId) return;
    selectNode(activity.targetId);
    void fitView({ nodes: [{ id: activity.targetId }], duration: 300, maxZoom: 1.2 });
  };

  return (
    <li className="relative flex gap-3">
      {/* 세로 연결선 + 도트 */}
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
          aria-hidden="true"
        />
        {!isLast && (
          <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
        )}
      </div>

      {/* 텍스트 블록 */}
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") handleClick();
              }
            : undefined
        }
        className={`min-w-0 ${isLast ? "pb-0" : "pb-4"} ${
          clickable ? "-mx-1 cursor-pointer rounded-md px-1 hover:bg-canvas" : ""
        }`}
      >
        <p className="text-sm leading-snug text-ink">
          <span className="font-medium">{activity.user.nickname ?? activity.user.name}</span>
          {"님이 "}
          {activity.targetLabel !== "(삭제된 항목)" ? (
            <span className="font-medium">'{targetLabel}'</span>
          ) : (
            <span className="text-muted">(삭제된 항목)</span>
          )}
          {" "}
          {actionLabel}
        </p>
        <time
          dateTime={activity.createdAt}
          title={absolute}
          className="mt-0.5 block font-mono text-xs text-muted"
        >
          {relative}
        </time>
      </div>
    </li>
  );
}

// ── HistoryTimeline ───────────────────────────────────────────────────────────

export interface HistoryTimelineProps {
  projectId: string;
}

export function HistoryTimeline({ projectId }: HistoryTimelineProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.history(projectId),
    queryFn: () =>
      api<HistoryResponse>(`/projects/${projectId}/history`),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-line" />
            <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-line" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-1 items-center justify-center px-4 py-6 text-center"
      >
        <p className="text-sm text-error">히스토리를 불러오지 못했습니다.</p>
      </div>
    );
  }

  // 휴지통행 소프트 삭제(DELETE)는 그대로 노출한다 — 영구삭제(purge)는 BE가 애초에
  // ActivityLog를 안 남겨서(node.service.ts purge()) 필터링할 필요 자체가 없다.
  const activities = data?.history ?? [];

  if (activities.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-6 text-center">
        <p className="text-sm text-muted">아직 활동 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <ul className="flex flex-col" aria-label="활동 히스토리">
        {activities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isLast={index === activities.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}
