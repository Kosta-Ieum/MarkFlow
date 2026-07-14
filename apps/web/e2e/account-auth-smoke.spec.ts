// account-auth-improvements 스모크 — mock 모드(VITE_MOCK_API=1) + dev 서버(:5173) 필요.
// 검증: 부팅 refresh 세션 유지(R1.4), 헤더 메뉴(R8), 프로필 nickname 변경(R3·R4), 로그아웃(R2).
import { test, expect } from "@playwright/test";

const DEMO_EMAIL = "demo@markflow.app";
const DEMO_NICK = "데모지기";

test.describe("계정/인증 개선 스모크", () => {
  test("로그인 → 새로고침해도 세션 유지 (부팅 refresh)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(DEMO_EMAIL);
    await page.getByLabel("비밀번호").fill("whatever123");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page).toHaveURL(/\/projects/);
    // 헤더 아바타 메뉴 트리거 aria-label = "<표시명> 메뉴" — nickname 표시(R8.5)
    await expect(page.getByRole("button", { name: `${DEMO_NICK} 메뉴` })).toBeVisible();

    // 새로고침 → 메모리 토큰은 날아가지만 refresh 쿠키(mock 세션)로 복원 → 여전히 /projects
    await page.reload();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole("button", { name: `${DEMO_NICK} 메뉴` })).toBeVisible();
  });

  test("헤더 메뉴 → 프로필 → nickname 변경 → 로그아웃", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(DEMO_EMAIL);
    await page.getByLabel("비밀번호").fill("whatever123");
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(/\/projects/);

    // 아바타 클릭 → 드롭다운 (R8.1)
    await page.getByRole("button", { name: `${DEMO_NICK} 메뉴` }).click();
    await expect(page.getByRole("menuitem", { name: "프로필 보기" })).toBeVisible();

    // 프로필 보기 → /profile (R8.2, R3)
    await page.getByRole("menuitem", { name: "프로필 보기" }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible(); // email 읽기전용 표시(R3.1)

    // nickname 변경 (R4)
    const nick = page.getByLabel("닉네임");
    await nick.fill("바뀐닉");
    await page.getByRole("button", { name: /닉네임 저장/ }).click();
    await expect(page.getByText("저장했어요.")).toBeVisible();

    // 헤더 표시명도 갱신됐는지 (updateProfile → user 상태 반영)
    await expect(page.getByRole("button", { name: "바뀐닉 메뉴" })).toBeVisible();

    // 로그아웃 (R8.3, R2) → 랜딩
    await page.getByRole("button", { name: "바뀐닉 메뉴" }).click();
    await page.getByRole("menuitem", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 로그아웃 후 보호 경로 접근 → refresh 401 → /login
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("회원가입 폼에 닉네임 필드가 있다 (R5.1)", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("닉네임")).toBeVisible();
    await expect(page.getByLabel("이름")).toBeVisible();
  });
});
