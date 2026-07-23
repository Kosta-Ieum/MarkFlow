// 읽기 툴 4개 — REST GET을 MCP 툴로 노출한다(R3). 결과는 JSON 텍스트 콘텐츠, 실패는 isError 텍스트(R6.4).
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ActivityDTO, CanvasSnapshot, ProjectsResponse } from "@markflow/shared";
import type { ApiClient } from "../api.js";
import { formatMcpError, McpToolError } from "../errors.js";

// openapi ProjectTrashResponse/TrashNode — 이 형태로만 쓰이므로 shared에 두지 않고 로컬 정의.
export interface TrashNode {
  id: string;
  title: string;
  type: string;
  deletedAt: string;
}

export interface TrashResponse {
  nodes: TrashNode[];
}

// openapi HistoryResponse.
export interface HistoryResponse {
  history: ActivityDTO[];
  nextCursor: string | null;
}

export const getCanvasInputShape = {
  projectId: z.string().uuid(),
};

export const getHistoryInputShape = {
  projectId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
};

export const getTrashInputShape = {
  projectId: z.string().uuid(),
};

/** limit/before처럼 정의된 값만 쿼리스트링에 담는다(undefined는 생략). */
function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * 툴 핸들러 공통 래퍼 — McpToolError는 formatMcpError로, 그 외 예외는 [INTERNAL]로 isError 텍스트
 * 반환한다(R6.4, 프로세스 불사). write 툴(T5)도 이 헬퍼를 재사용한다.
 */
export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    if (err instanceof McpToolError) {
      return { content: [{ type: "text", text: formatMcpError(err) }], isError: true };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `[INTERNAL] ${message}` }], isError: true };
  }
}

/** 단위 테스트가 REST 경로/쿼리를 직접 검증할 수 있도록 핸들러 로직을 등록과 분리해 export한다. */
export function createReadToolHandlers(api: ApiClient) {
  return {
    listProjects(): Promise<ProjectsResponse | null> {
      return api.request<ProjectsResponse>("GET", "/projects");
    },
    getCanvas({ projectId }: { projectId: string }): Promise<CanvasSnapshot | null> {
      return api.request<CanvasSnapshot>("GET", `/projects/${projectId}/canvas`);
    },
    getHistory({
      projectId,
      limit,
      before,
    }: {
      projectId: string;
      limit?: number;
      before?: string;
    }): Promise<HistoryResponse | null> {
      const query = toQueryString({ limit, before });
      return api.request<HistoryResponse>("GET", `/projects/${projectId}/history${query}`);
    },
    getTrash({ projectId }: { projectId: string }): Promise<TrashResponse | null> {
      return api.request<TrashResponse>("GET", `/projects/${projectId}/trash`);
    },
  };
}

export function registerReadTools(server: McpServer, api: ApiClient): void {
  const handlers = createReadToolHandlers(api);

  server.registerTool(
    "list_projects",
    {
      description:
        "List all projects the bot account can access, including role, ownership, and node count. Call first to discover project IDs.",
    },
    () => runTool(() => handlers.listProjects()),
  );

  server.registerTool(
    "get_canvas",
    {
      description:
        "Read all nodes and edges of a project canvas, plus your role in the project. Call before editing to see current state.",
      inputSchema: getCanvasInputShape,
    },
    (args) => runTool(() => handlers.getCanvas(args)),
  );

  server.registerTool(
    "get_history",
    {
      description:
        "Read the project's activity timeline (creates, updates, moves, deletes, connects, disconnects) in reverse chronological order. Use limit and the before cursor to paginate.",
      inputSchema: getHistoryInputShape,
    },
    (args) => runTool(() => handlers.getHistory(args)),
  );

  server.registerTool(
    "get_trash",
    {
      description: "List soft-deleted nodes in a project's trash that are available for restore.",
      inputSchema: getTrashInputShape,
    },
    (args) => runTool(() => handlers.getTrash(args)),
  );
}
