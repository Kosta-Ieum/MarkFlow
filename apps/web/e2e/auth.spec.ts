// E2E — 인증 플로우 (IEUM-42 F2 슬라이스)
// BE 미구현 — 풀스택 통합 후 test.skip 해제.
import { test, expect } from "@playwright/test";

// ── 로그인 ────────────────────────────────────────────────────────────────────

test.describe("로그인", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test.skip("유효하지 않은 이메일 형식 입력 시 인라인 에러가 표시된다", async ({ page }) => {
    await page.getByLabel("이메일").fill("not-an-email");
    await page.getByLabel("비밀번호").fill("somepassword");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText(/유효한 이메일/)).toBeVisible();
  });

  test.skip("비밀번호 미입력 시 인라인 에러가 표시된다", async ({ page }) => {
    await page.getByLabel("이메일").fill("user@example.com");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText(/비밀번호/)).toBeVisible();
  });

  test.skip("잘못된 자격증명 제출 시 서버 에러 메시지(role=alert)가 표시된다 — 401 처리", async ({
    page,
  }) => {
    await page.getByLabel("이메일").fill("wrong@example.com");
    await page.getByLabel("비밀번호").fill("wrongpassword");
    await page.getByRole("button", { name: "로그인" }).click();
    // BE 실서버: 401 → 서버 에러 배너
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test.skip("올바른 자격증명 제출 시 /projects 로 이동한다", async ({ page }) => {
    // TODO(IEUM-42): 시드 계정 이메일/비밀번호로 교체
    await page.getByLabel("이메일").fill("demo@markflow.test");
    await page.getByLabel("비밀번호").fill("Demo1234!");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL("/projects");
  });

  test.skip("로그인하지 않은 상태로 /projects 접근 시 /login 으로 리다이렉트된다", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL("/login");
  });
});

// ── 회원가입 ──────────────────────────────────────────────────────────────────

test.describe("회원가입", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test.skip("이름·이메일·비밀번호 중 하나라도 누락되면 인라인 에러가 표시된다", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "계정 만들기" }).click();
    // 필드별 에러 최소 1개 이상
    const errors = page.locator(".text-error");
    await expect(errors.first()).toBeVisible();
  });

  test.skip("이미 사용 중인 이메일로 가입 시 서버 에러 메시지가 표시된다 — 409 처리", async ({
    page,
  }) => {
    await page.getByLabel("이름").fill("홍길동");
    await page.getByLabel("이메일").fill("demo@markflow.test");
    await page.getByLabel("비밀번호").fill("Demo1234!");
    await page.getByRole("button", { name: "계정 만들기" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test.skip("유효한 정보 입력 후 가입 성공 시 /projects 로 이동한다", async ({ page }) => {
    const unique = `e2e-${Date.now()}@markflow.test`;
    await page.getByLabel("이름").fill("E2E 유저");
    await page.getByLabel("이메일").fill(unique);
    await page.getByLabel("비밀번호").fill("Test1234!");
    await page.getByRole("button", { name: "계정 만들기" }).click();
    await expect(page).toHaveURL("/projects");
  });
});
