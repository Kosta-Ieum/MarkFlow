// MCP Server 조립 — AuthManager+ApiClient 구성 후 툴을 등록한다(R1.1). transport 결합은 index.ts 소관.
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApiClient } from "./api.js";
import { AuthManager } from "./auth.js";
import { SocketManager } from "./collab.js";
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
  // 재로그인 시 서버가 봇 소켓을 강제 종료하므로(design.md §2 제약 2), login 성공 훅에서 소켓을
  // 끊어 다음 편집이 새 토큰으로 재접속하게 연쇄한다. collab은 auth를 참조하므로 순서상 나중에 만들되,
  // 훅은 지연 실행이라 아래 할당 이후 안전하게 collab을 캡처한다.
  let collab: SocketManager | undefined;
  const auth = new AuthManager(env, { onLogin: () => collab?.onTokenRenewed() });
  const api = createApiClient(env, auth);
  collab = new SocketManager(env, auth);

  registerReadTools(server, api);
  // T5: registerWriteTools(server, api, collab) — 편집 툴 6개를 여기 등록한다.

  return server;
}
