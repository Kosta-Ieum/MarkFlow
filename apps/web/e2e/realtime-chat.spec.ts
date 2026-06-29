// E2E — 실시간 채팅 + 프레즌스 (IEUM-42 F2 슬라이스)
// Socket.io 미구현 — IEUM-34 소켓 통합 후 test.fixme 해제.
//
// 이 파일은 컨벤션(Docs/11 §4)의 "2-클라이언트 시나리오" 정본 자리다.
// 멀티탭은 browser.newContext()로 두 독립 세션을 만든다.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

// 시드 계정 — 풀스택 통합 후 실제 계정으로 교체
const SEED_USER_A = { email: "user-a@markflow.test", password: "UserA1234!", name: "유저 A" };
const SEED_USER_B = { email: "user-b@markflow.test", password: "UserB1234!", name: "유저 B" };

// TODO(IEUM-42): 실제 시드 프로젝트 ID로 교체
const SEED_PROJECT_ID = "seed-project-id";

async function loginAs(
  context: BrowserContext,
  user: { email: string; password: string },
): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/projects");
  return page;
}

// ── 멀티탭 실시간 채팅 ────────────────────────────────────────────────────────

test.describe("멀티탭 실시간 채팅 (2-클라이언트 시나리오)", () => {
  // TODO(IEUM-34): Socket.io 통합 후 fixme 해제
  test.fixme(
    "유저 A가 보낸 메시지가 같은 방에 있는 유저 B 화면에 실시간으로 표시된다",
    async ({ browser }) => {
      const ctxA = await browser.newContext();
      const ctxB = await browser.newContext();

      const pageA = await loginAs(ctxA, SEED_USER_A);
      const pageB = await loginAs(ctxB, SEED_USER_B);

      // 두 유저 모두 같은 프로젝트 채팅 FAB 열기
      await pageA.goto(`/p/${SEED_PROJECT_ID}`);
      await pageB.goto(`/p/${SEED_PROJECT_ID}`);

      await pageA.getByRole("button", { name: "채팅 열기" }).click();
      await pageB.getByRole("button", { name: "채팅 열기" }).click();

      // 유저 A가 메시지 전송
      const msg = `안녕하세요 ${Date.now()}`;
      await pageA
        .getByRole("dialog", { name: "팀 채팅" })
        .getByLabel("메시지 입력")
        .fill(msg);
      await pageA
        .getByRole("dialog", { name: "팀 채팅" })
        .getByRole("button", { name: "전송" })
        .click();

      // 유저 A 자신의 채팅창에 메시지 표시
      await expect(
        pageA.getByRole("dialog", { name: "팀 채팅" }).getByText(msg),
      ).toBeVisible();

      // 유저 B 채팅창에 실시간 수신 — Socket.io 브로드캐스트 후 표시
      await expect(
        pageB.getByRole("dialog", { name: "팀 채팅" }).getByText(msg),
      ).toBeVisible({ timeout: 5_000 });

      await ctxA.close();
      await ctxB.close();
    },
  );

  // TODO(IEUM-34): Socket.io 통합 후 fixme 해제
  test.fixme(
    "유저 B가 보낸 메시지가 유저 A 화면에도 실시간으로 표시된다 (양방향)",
    async ({ browser }) => {
      const ctxA = await browser.newContext();
      const ctxB = await browser.newContext();

      const pageA = await loginAs(ctxA, SEED_USER_A);
      const pageB = await loginAs(ctxB, SEED_USER_B);

      await pageA.goto(`/p/${SEED_PROJECT_ID}`);
      await pageB.goto(`/p/${SEED_PROJECT_ID}`);

      await pageA.getByRole("button", { name: "채팅 열기" }).click();
      await pageB.getByRole("button", { name: "채팅 열기" }).click();

      const msg = `B가 보낸 메시지 ${Date.now()}`;
      await pageB
        .getByRole("dialog", { name: "팀 채팅" })
        .getByLabel("메시지 입력")
        .fill(msg);
      await pageB
        .getByRole("dialog", { name: "팀 채팅" })
        .getByRole("button", { name: "전송" })
        .click();

      await expect(
        pageA.getByRole("dialog", { name: "팀 채팅" }).getByText(msg),
      ).toBeVisible({ timeout: 5_000 });

      await ctxA.close();
      await ctxB.close();
    },
  );

  // TODO(IEUM-34): Socket.io 통합 후 fixme 해제
  test.fixme(
    "FAB이 닫힌 상태에서 메시지가 도착하면 unread 배지 숫자가 증가한다",
    async ({ browser }) => {
      const ctxA = await browser.newContext();
      const ctxB = await browser.newContext();

      const pageA = await loginAs(ctxA, SEED_USER_A);
      const pageB = await loginAs(ctxB, SEED_USER_B);

      await pageA.goto(`/p/${SEED_PROJECT_ID}`);
      await pageB.goto(`/p/${SEED_PROJECT_ID}`);

      // 유저 A는 FAB 닫힌 상태 유지 (열지 않음)
      // 유저 B가 메시지 전송
      await pageB.getByRole("button", { name: "채팅 열기" }).click();
      await pageB
        .getByRole("dialog", { name: "팀 채팅" })
        .getByLabel("메시지 입력")
        .fill("unread 배지 테스트");
      await pageB
        .getByRole("dialog", { name: "팀 채팅" })
        .getByRole("button", { name: "전송" })
        .click();

      // 유저 A FAB에 unread 배지가 생겨야 함
      await expect(pageA.getByRole("button", { name: "채팅 열기" }).locator(".bg-brand")).toBeVisible(
        { timeout: 5_000 },
      );

      await ctxA.close();
      await ctxB.close();
    },
  );
});

// ── 프레즌스 (접속자 표시) ────────────────────────────────────────────────────

test.describe("프레즌스 — 같은 프로젝트 접속자 표시", () => {
  // TODO(IEUM-34): Socket.io 통합 후 fixme 해제
  test.fixme(
    "유저 B가 같은 프로젝트에 입장하면 유저 A의 채팅 접속자 목록에 B의 아바타가 나타난다",
    async ({ browser }) => {
      const ctxA = await browser.newContext();
      const ctxB = await browser.newContext();

      const pageA = await loginAs(ctxA, SEED_USER_A);
      const pageB = await loginAs(ctxB, SEED_USER_B);

      await pageA.goto(`/p/${SEED_PROJECT_ID}`);
      await pageA.getByRole("button", { name: "채팅 열기" }).click();

      // A 입장 직후에는 B 아바타 없음
      const presenceSection = pageA.getByRole("region", { name: "접속자" });
      await expect(presenceSection.getByRole("listitem", { name: SEED_USER_B.name })).not.toBeVisible();

      // B 입장
      await pageB.goto(`/p/${SEED_PROJECT_ID}`);

      // A 화면에 B 아바타 표시
      await expect(
        presenceSection.getByRole("listitem", { name: SEED_USER_B.name }),
      ).toBeVisible({ timeout: 5_000 });

      await ctxA.close();
      await ctxB.close();
    },
  );

  // TODO(IEUM-34): Socket.io 통합 후 fixme 해제
  test.fixme(
    "유저 B가 프로젝트를 떠나면 유저 A의 접속자 목록에서 B 아바타가 사라진다",
    async ({ browser }) => {
      const ctxA = await browser.newContext();
      const ctxB = await browser.newContext();

      const pageA = await loginAs(ctxA, SEED_USER_A);
      const pageB = await loginAs(ctxB, SEED_USER_B);

      await pageA.goto(`/p/${SEED_PROJECT_ID}`);
      await pageB.goto(`/p/${SEED_PROJECT_ID}`);
      await pageA.getByRole("button", { name: "채팅 열기" }).click();

      const presenceSection = pageA.getByRole("region", { name: "접속자" });
      await expect(
        presenceSection.getByRole("listitem", { name: SEED_USER_B.name }),
      ).toBeVisible({ timeout: 5_000 });

      // B가 떠남 (다른 페이지로 이동)
      await pageB.goto("/projects");

      await expect(
        presenceSection.getByRole("listitem", { name: SEED_USER_B.name }),
      ).not.toBeVisible({ timeout: 5_000 });

      await ctxA.close();
      await ctxB.close();
    },
  );
});

// ── Enter 키 전송 ─────────────────────────────────────────────────────────────

test.describe("채팅 입력창 — UX", () => {
  test.skip(
    "Enter 키로 메시지가 전송되고 입력창이 비워진다",
    async ({ page }) => {
      // TODO(IEUM-42): 시드 계정 + 서버 필요
      await page.goto("/login");
      await page.getByLabel("이메일").fill(SEED_USER_A.email);
      await page.getByLabel("비밀번호").fill(SEED_USER_A.password);
      await page.getByRole("button", { name: "로그인" }).click();
      await page.waitForURL("/projects");
      await page.goto(`/p/${SEED_PROJECT_ID}`);
      await page.getByRole("button", { name: "채팅 열기" }).click();

      const composer = page.getByRole("dialog", { name: "팀 채팅" }).getByLabel("메시지 입력");
      await composer.fill("Enter 전송 테스트");
      await composer.press("Enter");
      await expect(composer).toHaveValue("");
    },
  );

  test.skip(
    "Shift+Enter 는 줄바꿈이고 전송하지 않는다",
    async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("이메일").fill(SEED_USER_A.email);
      await page.getByLabel("비밀번호").fill(SEED_USER_A.password);
      await page.getByRole("button", { name: "로그인" }).click();
      await page.waitForURL("/projects");
      await page.goto(`/p/${SEED_PROJECT_ID}`);
      await page.getByRole("button", { name: "채팅 열기" }).click();

      const composer = page.getByRole("dialog", { name: "팀 채팅" }).getByLabel("메시지 입력");
      await composer.fill("첫 줄");
      await composer.press("Shift+Enter");
      // 입력창에 내용이 남아있어야 함 (전송 안 됨)
      await expect(composer).not.toHaveValue("");
    },
  );
});
