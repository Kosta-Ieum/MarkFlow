// IEUM-87 (F2): 계정 전환 시 이전 계정 프로젝트가 새 계정 목록에 남는 "잔상" 회귀 방지.
// 원인은 전역 react-query 키(["projects"]) — user 스코프 키로 격리한다.
// 주의: 2번째 로그인은 반드시 SPA 네비게이션(리로드 X)이어야 한다 — page.goto는
//       QueryClient를 리셋해 버그(캐시 누수)를 못 재현한다.
// mock 필요: VITE_MOCK_API=1 + dev 서버(:5173).
import { test, expect } from "@playwright/test";

test("계정 전환 시 이전 계정 프로젝트가 새 계정 목록에 남지 않는다 (IEUM-87)", async ({ page }) => {
  // A 계정(demo) 최초 로그인 — 여기만 전체 로드
  await page.goto("/login");
  await page.getByLabel("이메일").fill("demo@markflow.app");
  await page.getByLabel("비밀번호").fill("whatever123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/projects/);

  // A가 프로젝트 생성
  await page.getByLabel("새 프로젝트 이름").fill("격리테스트프로젝트");
  await page.getByRole("button", { name: /새 프로젝트/ }).click();
  await expect(
    page.locator("article[aria-label='프로젝트: 격리테스트프로젝트']"),
  ).toBeVisible();

  // 로그아웃 (헤더 아바타 드롭다운) → 랜딩. SPA 네비게이션이라 QueryClient 캐시는 유지된다.
  await page.getByRole("button", { name: "데모지기 메뉴" }).click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/$/);

  // B 계정 로그인 — SPA 이동(리로드 금지). 전역 키였다면 여기서 A의 캐시가 그대로 노출된다.
  await page.getByRole("link", { name: "로그인" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("이메일").fill("other-tester@markflow.app");
  await page.getByLabel("비밀번호").fill("whatever123");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/projects/);

  // B는 멤버가 아니므로 빈 목록이어야 하고, A가 만든 프로젝트/시드가 남으면 안 됨
  await expect(page.getByText("아직 표시할 프로젝트가 없습니다")).toBeVisible();
  await expect(
    page.locator("article[aria-label='프로젝트: 격리테스트프로젝트']"),
  ).toHaveCount(0);
});
