// MCP Server 조립 — AuthManager+ApiClient 구성 후 툴을 등록한다(R1.1). transport 결합은 index.ts 소관.
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApiClient } from "./api.js";
import { AuthManager } from "./auth.js";
import type { Env } from "./env.js";
import { registerReadTools } from "./tools/read.js";

function readVersion(): string {
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const { version } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };
  return version;
}

/** 후속 T5가 registerWriteTools(server, api, collab) 호출을 이 자리에 추가한다. */
export function createMarkflowServer(env: Env): McpServer {
  const server = new McpServer({ name: "markflow", version: readVersion() });
  const auth = new AuthManager(env);
  const api = createApiClient(env, auth);

  registerReadTools(server, api);

  return server;
}
