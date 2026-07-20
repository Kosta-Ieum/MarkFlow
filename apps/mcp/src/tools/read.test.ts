import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ApiClient } from "../api.js";
import { McpToolError } from "../errors.js";
import {
  createReadToolHandlers,
  getCanvasInputShape,
  getHistoryInputShape,
  getTrashInputShape,
  runTool,
} from "./read.js";

function fakeApi(response: unknown = { ok: true }) {
  const request = vi.fn().mockResolvedValue(response);
  const api = { request } as unknown as ApiClient;
  return { api, request };
}

const projectId = "11111111-1111-1111-1111-111111111111";

describe("createReadToolHandlers", () => {
  it("list_projects는 GET /projects를 호출한다", async () => {
    const { api, request } = fakeApi({ projects: [] });
    const handlers = createReadToolHandlers(api);

    await handlers.listProjects();

    expect(request).toHaveBeenCalledWith("GET", "/projects");
  });

  it("get_canvas는 GET /projects/:id/canvas를 호출한다", async () => {
    const { api, request } = fakeApi();
    const handlers = createReadToolHandlers(api);

    await handlers.getCanvas({ projectId });

    expect(request).toHaveBeenCalledWith("GET", `/projects/${projectId}/canvas`);
  });

  it("get_trash는 GET /projects/:id/trash를 호출한다", async () => {
    const { api, request } = fakeApi();
    const handlers = createReadToolHandlers(api);

    await handlers.getTrash({ projectId });

    expect(request).toHaveBeenCalledWith("GET", `/projects/${projectId}/trash`);
  });

  it("get_history는 정의된 limit·before만 쿼리스트링에 담는다", async () => {
    const { api, request } = fakeApi();
    const handlers = createReadToolHandlers(api);

    await handlers.getHistory({ projectId, limit: 20, before: "2026-07-01T00:00:00.000Z" });

    expect(request).toHaveBeenCalledWith(
      "GET",
      `/projects/${projectId}/history?limit=20&before=${encodeURIComponent("2026-07-01T00:00:00.000Z")}`,
    );
  });

  it("get_history는 limit·before 미지정 시 쿼리스트링 없이 호출한다", async () => {
    const { api, request } = fakeApi();
    const handlers = createReadToolHandlers(api);

    await handlers.getHistory({ projectId });

    expect(request).toHaveBeenCalledWith("GET", `/projects/${projectId}/history`);
  });
});

describe("입력 스키마 검증", () => {
  it("get_canvas·get_trash는 uuid가 아닌 projectId를 거부한다", () => {
    expect(z.object(getCanvasInputShape).safeParse({ projectId: "not-a-uuid" }).success).toBe(false);
    expect(z.object(getTrashInputShape).safeParse({ projectId: "not-a-uuid" }).success).toBe(false);
    expect(z.object(getCanvasInputShape).safeParse({ projectId }).success).toBe(true);
  });

  it("get_history는 범위를 벗어난 limit을 거부한다", () => {
    const schema = z.object(getHistoryInputShape);
    expect(schema.safeParse({ projectId, limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ projectId, limit: 101 }).success).toBe(false);
    expect(schema.safeParse({ projectId, limit: 50 }).success).toBe(true);
    expect(schema.safeParse({ projectId }).success).toBe(true);
  });

  it("get_history는 uuid가 아닌 projectId를 거부한다", () => {
    const schema = z.object(getHistoryInputShape);
    expect(schema.safeParse({ projectId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("runTool", () => {
  it("정상 결과를 JSON 텍스트 콘텐츠로 반환한다", async () => {
    const result = await runTool(async () => ({ projects: [] }));

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ projects: [] }, null, 2) }]);
  });

  it("McpToolError는 코드가 포함된 isError 텍스트로 변환한다", async () => {
    const result = await runTool(async () => {
      throw new McpToolError("NOT_FOUND", "프로젝트를 찾을 수 없습니다");
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "[NOT_FOUND] 프로젝트를 찾을 수 없습니다" }]);
  });

  it("그 외 예외는 [INTERNAL] 텍스트로 변환하고 프로세스를 죽이지 않는다", async () => {
    const result = await runTool(async () => {
      throw new Error("boom");
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "[INTERNAL] boom" }]);
  });
});
