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

test.describe("프로젝트 소프트 삭제(휴지통)", () => {
  test.skip("OWNER가 휴지통 아이콘 클릭 후 '삭제' 확인 버튼 누르면 카드가 그리드에서 사라진다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    const card = page.getByRole("article").first();
    await card.getByRole("button", { name: "프로젝트 삭제" }).click();
    await card.getByRole("button", { name: "삭제 확인" }).click();
    // 삭제 후 카드가 DOM에서 제거됨
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

test.describe("휴지통 — 복구 및 영구 삭제", () => {
  test.skip("휴지통 링크 클릭 시 /projects/trash 로 이동한다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.getByRole("link", { name: "휴지통" }).click();
    await expect(page).toHaveURL("/projects/trash");
  });

  test.skip("OWNER가 '복구' 버튼 클릭 시 카드가 휴지통에서 사라지고 /projects 에 재표시된다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    await page.goto("/projects/trash");
    const card = page.getByRole("article").first();
    const name = await card.locator("h3").innerText();
    await card.getByRole("button", { name: `${name} 복구` }).click();
    await expect(card).not.toBeVisible();
    await page.goto("/projects");
    await expect(page.getByText(name)).toBeVisible();
  });

  test.skip("OWNER가 '영구 삭제' 버튼 → 확인 다이얼로그 → '영구 삭제' 클릭 시 카드가 사라지고 복구 불가 상태가 된다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    await page.goto("/projects/trash");
    const card = page.getByRole("article").first();
    const name = await card.locator("h3").innerText();
    await card.getByRole("button", { name: `${name} 영구 삭제` }).click();
    // 확인 다이얼로그
    const dialog = page.getByRole("dialog", { name: "프로젝트를 영구 삭제할까요?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "영구 삭제" }).click();
    await expect(card).not.toBeVisible();
  });

  test.skip("확인 다이얼로그에서 '취소' 클릭 시 카드가 그대로 남아 있다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.goto("/projects/trash");
    const card = page.getByRole("article").first();
    const name = await card.locator("h3").innerText();
    await card.getByRole("button", { name: `${name} 영구 삭제` }).click();
    const dialog = page.getByRole("dialog", { name: "프로젝트를 영구 삭제할까요?" });
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
  });

  test.skip("OWNER가 아닌 멤버는 복구·영구 삭제 버튼이 비활성화되어 있다", async ({ page }) => {
    // TODO(IEUM-42): VIEWER/EDITOR 시드 계정으로 교체 후 활성화
    await loginAsSeedUser(page);
    await page.goto("/projects/trash");
    // 공유됨 배지가 있는 카드 탐색
    const sharedCard = page.getByRole("article").filter({ hasText: "공유됨" }).first();
    await expect(sharedCard.getByRole("button", { name: /복구/ })).toBeDisabled();
    await expect(sharedCard.getByRole("button", { name: /영구 삭제/ })).toBeDisabled();
  });
});
