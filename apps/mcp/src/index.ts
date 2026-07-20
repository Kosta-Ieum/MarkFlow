import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseEnv } from "./env.js";

// MCP stdio 규약: stdout은 프로토콜 전용이므로 로그는 stderr로만 출력한다.
try {
  parseEnv();
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const packageJsonPath = new URL("../package.json", import.meta.url);
const { version } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

async function main(): Promise<void> {
  const server = new McpServer({ name: "markflow", version });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
