// E2E — 프로젝트 CRUD 플로우 (IEUM-42 F2 슬라이스)
// BE 미구현 — 풀스택 통합 후 test.skip 해제.
import { test, expect } from "@playwright/test";

// 시드 로그인 헬퍼 — 풀스택 통합 후 실제 계정으로 교체
async function loginAsSeedUser(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
  // TODO(IEUM-42): 시드 계정으로 교체
  await page.goto("/login");
  await page.getByLabel("이메일").fill("demo@markflow.test");
  await page.getByLabel("비밀번호").fill("Demo1234!");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/projects");
}

test.describe("프로젝트 생성", () => {
  test.skip("프로젝트 이름을 입력하고 '+ 새 프로젝트' 버튼 클릭 시 카드가 그리드에 추가된다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const name = `E2E 테스트 ${Date.now()}`;
    await page.getByLabel("새 프로젝트 이름").fill(name);
    await page.getByRole("button", { name: "+ 새 프로젝트" }).click();
    await expect(page.getByRole("button", { name: `프로젝트: ${name}` })).toBeVisible();
  });

  test.skip("이름을 비운 상태에서는 '+ 새 프로젝트' 버튼이 비활성화 상태다", async ({ page }) => {
    await loginAsSeedUser(page);
    const btn = page.getByRole("button", { name: "+ 새 프로젝트" });
    await expect(btn).toBeDisabled();
  });
});

test.describe("프로젝트 이름 변경", () => {
  test.skip("OWNER가 연필 아이콘 클릭 후 새 이름 입력·Enter 시 카드 제목이 갱신된다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    // 첫 번째 프로젝트 카드의 이름 변경 버튼
    const card = page.getByRole("article").first();
    await card.getByRole("button", { name: "이름 변경" }).click();
    const input = card.getByRole("textbox", { name: "프로젝트 이름 편집" });
    const newName = `Renamed ${Date.now()}`;
    await input.fill(newName);
    await input.press("Enter");
    await expect(card.getByText(newName)).toBeVisible();
  });

  test.skip("Escape 키 입력 시 이름 변경이 취소되고 원래 이름으로 복원된다", async ({ page }) => {
    await loginAsSeedUser(page);
    const card = page.getByRole("article").first();
    const originalName = await card.locator("h3").innerText();
    await card.getByRole("button", { name: "이름 변경" }).click();
    await card.getByRole("textbox", { name: "프로젝트 이름 편집" }).press("Escape");
    await expect(card.getByText(originalName)).toBeVisible();
  });
});

test.describe("프로젝트 영구 삭제", () => {
  test.skip("OWNER가 삭제 아이콘 클릭 후 '영구 삭제' 확인 버튼 누르면 카드가 그리드에서 사라진다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const card = page.getByRole("article").first();
    await card.getByRole("button", { name: "프로젝트 삭제" }).click();
    await card.getByRole("button", { name: "영구 삭제 확인" }).click();
    // 하드 삭제 후 카드가 DOM에서 제거됨(복구 없음)
    await expect(card).not.toBeVisible();
  });

  test.skip("'취소' 버튼 클릭 시 카드가 그대로 남아 있다", async ({ page }) => {
    await loginAsSeedUser(page);
    const card = page.getByRole("article").first();
    const name = await card.locator("h3").innerText();
    await card.getByRole("button", { name: "프로젝트 삭제" }).click();
    await card.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText(name)).toBeVisible();
  });
});
