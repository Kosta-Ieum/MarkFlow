import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { assertPermission } from "../../shared/permission.js";
import { AppException } from "../../common/app.exception.js";
import type { ActivityTarget } from "@prisma/client";
import type { ActivityLogDTO, HistoryResponse } from "./activity.dto.js";

const DELETED_LABEL = "(삭제된 항목)";
const UNTITLED_LABEL = "(제목 없음)";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Cursor {
  createdAt: Date;
  id: string | null; // ISO8601 cursor는 id 없이 createdAt만으로 자른다
}

interface HistoryFilter {
  projectId: string;
  targetType?: ActivityTarget;
  targetId?: string;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectHistory(
    projectId: string,
    userId: string,
    limit: number,
    before?: string,
  ): Promise<HistoryResponse> {
    await assertPermission(this.prisma, projectId, userId, "VIEWER");
    return this.queryHistory({ projectId }, limit, before);
  }

  async getNodeHistory(
    projectId: string,
    userId: string,
    nodeId: string,
    limit: number,
    before?: string,
  ): Promise<HistoryResponse> {
    await assertPermission(this.prisma, projectId, userId, "VIEWER");
    return this.queryHistory(
      { projectId, targetType: "NODE", targetId: nodeId },
      limit,
      before,
    );
  }

  private async resolveCursor(before?: string): Promise<Cursor | null> {
    if (!before) return null;

    if (UUID_RE.test(before)) {
      const log = await this.prisma.activityLog.findUnique({
        where: { id: before },
        select: { createdAt: true, id: true },
      });
      if (!log) throw AppException.badRequest("유효하지 않은 cursor입니다");
      return log;
    }

    const parsed = new Date(before);
    if (Number.isNaN(parsed.getTime())) {
      throw AppException.badRequest("유효하지 않은 cursor입니다");
    }
    return { createdAt: parsed, id: null };
  }

  private async queryHistory(
    filter: HistoryFilter,
    limit: number,
    before?: string,
  ): Promise<HistoryResponse> {
    const cursor = await this.resolveCursor(before);

    const rows = await this.prisma.activityLog.findMany({
      where: {
        projectId: filter.projectId,
        ...(filter.targetType && { targetType: filter.targetType }),
        ...(filter.targetId && { targetId: filter.targetId }),
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            ...(cursor.id
              ? [{ createdAt: cursor.createdAt, id: { lt: cursor.id } }]
              : []),
          ],
        }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { user: { select: { id: true, name: true } } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]!.id : null;

    const labels = await this.resolveLabels(page);

    const history: ActivityLogDTO[] = page.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      ...(row.targetId && {
        targetLabel: labels.get(row.targetId) ?? DELETED_LABEL,
      }),
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      user: row.user,
    }));

    return { history, nextCursor };
  }

  // N+1 방지: targetType별로 targetId를 모아 일괄 조회(findMany + in) 후 매핑
  private async resolveLabels(
    rows: { targetType: ActivityTarget; targetId: string | null }[],
  ): Promise<Map<string, string>> {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const projectIds = new Set<string>();

    for (const row of rows) {
      if (!row.targetId) continue;
      if (row.targetType === "NODE") nodeIds.add(row.targetId);
      else if (row.targetType === "EDGE") edgeIds.add(row.targetId);
      else projectIds.add(row.targetId);
    }

    const labels = new Map<string, string>();

    if (nodeIds.size > 0) {
      const nodes = await this.prisma.node.findMany({
        where: { id: { in: [...nodeIds] } },
        select: { id: true, title: true },
      });
      for (const n of nodes) labels.set(n.id, n.title || UNTITLED_LABEL);
    }

    if (edgeIds.size > 0) {
      const edges = await this.prisma.edge.findMany({
        where: { id: { in: [...edgeIds] } },
        select: {
          id: true,
          source: { select: { title: true } },
          target: { select: { title: true } },
        },
      });
      for (const e of edges) {
        labels.set(
          e.id,
          `${e.source.title || UNTITLED_LABEL} → ${e.target.title || UNTITLED_LABEL}`,
        );
      }
    }

    if (projectIds.size > 0) {
      const projects = await this.prisma.project.findMany({
        where: { id: { in: [...projectIds] } },
        select: { id: true, name: true },
      });
      for (const p of projects) labels.set(p.id, p.name);
    }

    return labels;
  }
}
