import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Env } from "./env.js";
import { parseEnv } from "./env.js";
import { createMarkflowServer } from "./server.js";

// MCP stdio 규약: stdout은 프로토콜 전용이므로 로그는 stderr로만 출력한다.
let env: Env;
try {
  env = parseEnv();
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const server = createMarkflowServer(env);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
