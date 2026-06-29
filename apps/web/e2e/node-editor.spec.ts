// E2E — 노드 상세 에디터 플로우 (IEUM-42 F2 슬라이스)
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

// 테스트용 노드 에디터 URL 상수 — 풀스택 통합 후 실제 시드 ID로 교체
const SEED_PROJECT_ID = "seed-project-id"; // TODO(IEUM-42): 실제 시드 ID로 교체
const SEED_NODE_ID = "seed-node-id"; // TODO(IEUM-42): 실제 시드 ID로 교체

test.describe("노드 에디터 진입", () => {
  test.skip("캔버스에서 노드 클릭 시 /p/:projectId/n/:nodeId 로 이동한다", async ({ page }) => {
    // TODO(F1): 캔버스 노드 클릭 인터랙션 — F1 구현 후 활성화
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}`);
    // F1 캔버스에서 노드 클릭 → 에디터 이동
    // await page.getByTestId("canvas-node").first().dblclick();
    // await expect(page).toHaveURL(/\/p\/.+\/n\/.+/);
  });

  test.skip("노드 에디터 URL 직접 접근 시 에디터가 렌더링된다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    await expect(page.getByLabel("노드 제목")).toBeVisible();
    await expect(page.getByLabel("마크다운 편집")).toBeVisible();
  });
});

test.describe("노드 마크다운 편집 (EDITOR/OWNER)", () => {
  test.skip("제목 입력 후 2초 후 자동 저장되고 '저장됨' 상태가 표시된다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    const titleInput = page.getByLabel("노드 제목");
    await titleInput.fill(`자동저장 테스트 ${Date.now()}`);
    // 2초 디바운스 대기
    await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5_000 });
  });

  test.skip("'저장' 버튼 클릭 시 즉시 저장되고 '저장됨' 상태가 표시된다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    await page.getByLabel("노드 제목").fill("직접 저장 테스트");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장됨")).toBeVisible();
  });

  test.skip("노드 타입 드롭다운에서 타입 변경 후 저장 시 서버에 반영된다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    await page.getByLabel("노드 타입").selectOption("task");
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText("저장됨")).toBeVisible();
  });

  test.skip("'캔버스로 돌아가기' 버튼 클릭 시 /p/:projectId 로 이동한다", async ({ page }) => {
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    await page.getByRole("button", { name: "캔버스로 돌아가기" }).click();
    await expect(page).toHaveURL(`/p/${SEED_PROJECT_ID}`);
  });
});

test.describe("노드 에디터 — VIEWER 읽기 전용", () => {
  test.skip("뷰어는 노드 에디터에서 제목·마크다운 입력란이 비활성화된 상태를 본다", async ({
    page,
  }) => {
    // TODO(IEUM-42): VIEWER 시드 계정으로 교체
    await page.goto("/login");
    await page.getByLabel("이메일").fill("viewer@markflow.test");
    await page.getByLabel("비밀번호").fill("Viewer1234!");
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL("/projects");

    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    // 읽기 전용 배지
    await expect(page.getByText("읽기 전용")).toBeVisible();
    // 제목 입력 비활성화
    await expect(page.getByLabel("노드 제목")).toBeDisabled();
    // 저장 버튼 없음
    await expect(page.getByRole("button", { name: "저장" })).not.toBeVisible();
  });

  test.skip("뷰어는 마크다운 에디터가 preview 모드(편집 불가)로 표시된다", async ({ page }) => {
    // TODO(IEUM-42): VIEWER 시드 계정으로 교체
    await page.goto("/login");
    await page.getByLabel("이메일").fill("viewer@markflow.test");
    await page.getByLabel("비밀번호").fill("Viewer1234!");
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL("/projects");

    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    // MDEditor preview 모드에서는 textarea가 disabled
    await expect(page.getByLabel("마크다운 편집")).toBeDisabled();
  });
});

test.describe("노드 에디터 — 에러 경로", () => {
  test.skip("존재하지 않는 노드 URL 접근 시 '노드를 찾을 수 없습니다' 메시지가 표시된다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/non-existent-node-id`);
    await expect(page.getByText("노드를 찾을 수 없습니다")).toBeVisible();
  });

  test.skip("네트워크 오류 시 '노드를 불러오지 못했습니다' 에러 메시지와 돌아가기 버튼이 표시된다", async ({
    page,
  }) => {
    await loginAsSeedUser(page);
    // 오프라인 시뮬레이션
    await page.context().setOffline(true);
    await page.goto(`/p/${SEED_PROJECT_ID}/n/${SEED_NODE_ID}`);
    await expect(page.getByText("노드를 불러오지 못했습니다")).toBeVisible();
    await expect(page.getByRole("button", { name: "돌아가기" })).toBeVisible();
    await page.context().setOffline(false);
  });
});
