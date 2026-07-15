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

test("다른 기기 로그인(409 CONFLICT+메시지) 시 자동 로그아웃 + 사유 배너", async ({ page }) => {
  const SERVER_MSG = "다른 기기에서 로그인되어 세션이 만료되었습니다."; // 실서버 문구

  await page.goto("/login");
  await page.getByLabel("이메일").fill("demo@markflow.app");
  await page.getByLabel("비밀번호").fill("whatever123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/projects/);

  // 다른 기기 로그인 시뮬레이션: 이후 /auth/me가 409(code=CONFLICT, 메시지)로 응답
  await page.evaluate(() => {
    sessionStorage.setItem("markflow-mock-duplicate-login", "1");
  });
  await page.reload();

  // BE가 전용 코드 없이 409+CONFLICT여도 메시지로 감지 → 로그아웃 + 사유 배너
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(SERVER_MSG)).toBeVisible();
});
