// 회원가입 UX: ① 이미 가입된 이메일이면 OTP 단계 전에 가입 폼에서 막힘, ② 닉네임 공백 입력 차단.
// mock 필요: VITE_MOCK_API=1 + dev 서버(:5173). demo@markflow.app은 시드 등록 이메일.
import { test, expect } from "@playwright/test";

test.describe("회원가입 UX", () => {
  test("이미 가입된 이메일로 가입 시 OTP 단계 전에 가입 폼에서 막힌다", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("이름").fill("홍길동");
    await page.getByLabel("닉네임").fill("길동이");
    await page.getByLabel("이메일").fill("demo@markflow.app"); // 시드 등록 이메일
    await page.getByLabel("비밀번호").fill("password123");
    await page.getByRole("button", { name: "이메일로 인증 코드 받기" }).click();

    // 가입 폼에 에러 표시 (OTP 화면으로 넘어가지 않음)
    await expect(page.getByText("이미 가입된 이메일입니다.")).toBeVisible();
    await expect(page.getByLabel("인증 코드")).toHaveCount(0); // OTP 입력 없음
    await expect(page.getByLabel("이메일")).toBeVisible(); // 가입 폼 그대로
  });

  test("닉네임에 공백을 타이핑하면 입력되지 않는다", async ({ page }) => {
    await page.goto("/signup");
    const nick = page.getByLabel("닉네임");
    await nick.pressSequentially("홍 길동"); // 키 이벤트 시뮬레이션 → 공백 keydown 차단
    await expect(nick).toHaveValue("홍길동");
  });
});
