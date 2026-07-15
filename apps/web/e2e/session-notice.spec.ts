// 서버가 세션을 강제 종료(다른 기기 로그인 = DUPLICATE_LOGIN)했을 때, lib/api가 저장한 사유를
// 로그인 화면에 표시하는지 검증. (감지→저장은 lib/api의 code 기반 조건문, 표시는 AuthPage.)
// mock 필요: VITE_MOCK_API=1 + dev 서버(:5173).
import { test, expect } from "@playwright/test";

const MSG = "다른 기기에서 로그인하여 세션이 만료되었습니다.";
const NOTICE_KEY = "markflow-session-notice"; // lib/api SESSION_NOTICE_KEY와 동일해야 함

test("세션 종료 사유가 로그인 화면 배너로 뜨고 1회성으로 사라진다", async ({ page }) => {
  await page.goto("/login");
  // lib/api가 DUPLICATE_LOGIN 감지 시 저장하는 것과 동일한 경로를 시뮬레이션
  await page.evaluate(
    ([k, m]) => {
      sessionStorage.setItem(k, m);
    },
    [NOTICE_KEY, MSG] as const,
  );
  await page.reload();

  // 배너에 서버 사유 표시
  await expect(page.getByRole("alert").filter({ hasText: MSG })).toBeVisible();

  // 1회성 — 다시 방문하면 사라짐(takeSessionNotice가 읽고 지움)
  await page.reload();
  await expect(page.getByText(MSG)).toHaveCount(0);
});
