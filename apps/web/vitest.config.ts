import { defineConfig } from "vitest/config";

// e2e/ 는 Playwright(별도 러너, playwright.config.ts) 전용 — vitest 기본 include 패턴이
// e2e/*.spec.ts까지 주워서 충돌하므로 src만 대상으로 한정한다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
