// Playwright 하네스 — MarkFlow F2 E2E (IEUM-42)
// BE 미구현 상태 — 풀스택 통합(BE + F1 실서버) 후 webServer 블록 활성화.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },

  // webServer 는 BE + F1 실서버가 필요해 현재 비활성.
  // 풀스택 통합 후 아래 블록 주석 해제.
  // webServer: {
  //   command: "pnpm dev",
  //   url: "http://localhost:5173",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
