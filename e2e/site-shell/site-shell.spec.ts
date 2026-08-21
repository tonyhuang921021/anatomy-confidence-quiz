import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/progress",
  "/results",
  "/saved-questions",
  "/feedback",
  "/start",
  "/review",
  "/search"
];

async function waitForShellReady(page: Page) {
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready", "true");
}

async function expectStablePage(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  await expect(page.locator("main#main-content")).toHaveCount(1);
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test("導覽預設收起，留言入口會回到首頁完整留言板", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  await expect(page.getByRole("dialog", { name: "主要導覽" })).toHaveCount(0);

  await page.getByRole("button", { name: "開啟導覽" }).click();
  const drawer = page.getByRole("dialog", { name: "主要導覽" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "留言板", exact: true })).toBeVisible();
  await drawer.getByRole("link", { name: "留言板", exact: true }).click();

  await expect(page).toHaveURL(/\/#feedback$/);
  const feedbackSection = page.locator("#feedback");
  await expect(feedbackSection.getByRole("heading", { name: "留言板", exact: true })).toBeVisible();
  await expect(feedbackSection.locator(".feedback-board")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "主要導覽" })).toHaveCount(0);
});

test("更多功能會留在左側導覽原地展開", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  await page.getByRole("button", { name: "開啟導覽" }).click();

  const drawer = page.getByRole("dialog", { name: "主要導覽" });
  const moreTrigger = drawer.getByRole("button", { name: "更多", exact: true });
  await moreTrigger.click();

  await expect(moreTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(drawer.getByRole("link", { name: "學習筆記", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "考後回顧", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "更多功能" })).toHaveCount(0);

  await page.waitForTimeout(220);
  const drawerBox = await drawer.boundingBox();
  expect(Math.abs(drawerBox?.x ?? 1)).toBeLessThanOrEqual(1);
});

test("帳號設定可關閉並把焦點交回帳號按鈕", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  const accountTrigger = page.getByRole("button", { name: "開啟帳號選單" });
  await accountTrigger.click();
  await page.getByRole("button", { name: "登入與同步" }).click();

  const accountPanel = page.getByRole("dialog", { name: "帳號與設定" });
  await expect(accountPanel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(accountPanel).toHaveCount(0);
  await expect(accountTrigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("主要頁面在桌機與 Safari 手機尺寸都不溢出", async ({ page }) => {
  for (const route of ROUTES) {
    await expectStablePage(page, route);
  }
});

test("搜尋結果展開後不會重複題幹與分類", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  const card = page.locator("details.search-result-card").first();
  await expect(card).toBeVisible();
  const summary = card.locator("summary");
  const stem = (await summary.locator("p").first().innerText()).trim();
  const primaryTag = (await summary.locator("span.max-w-full.break-words").last().innerText()).trim();

  await summary.click();
  await expect(summary.getByText("收合", { exact: true })).toBeVisible();
  await expect(card.getByText(stem, { exact: true })).toHaveCount(1);
  await expect(card.getByText(primaryTag, { exact: true })).toHaveCount(1);

  const details = card.locator(".search-result-details");
  const options = details.locator(".search-result-options");
  const toolbar = details.locator(".search-result-utility-actions");
  await expect(details).toBeVisible();
  await expect(toolbar).toBeVisible();

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const optionColumnCount = await options.evaluate((element) =>
    window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
  );
  expect(optionColumnCount).toBe(viewportWidth >= 900 ? 2 : 1);
});

test("結果頁展開後分類只顯示一次", async ({ page }) => {
  const now = new Date().toISOString();
  await page.addInitScript(({ completedAt }) => {
    const session = {
      id: "site-shell-result-session",
      subject: "醫學（二）",
      startedAt: completedAt,
      completedAt,
      settings: {
        mode: "random",
        questionCount: 1,
        subjectFilter: "病理學"
      },
      questionOrder: ["MOEX-115020-2301-Q078"],
      attempts: [
        {
          questionId: "MOEX-115020-2301-Q078",
          selectedAnswer: "C",
          correctAnswer: "A",
          isCorrect: false,
          confidence: 4,
          answeredAt: completedAt
        }
      ]
    };
    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-completed-sessions:guest",
      JSON.stringify([session])
    );
  }, { completedAt: now });

  await page.goto("/results?sessionId=site-shell-result-session", { waitUntil: "networkidle" });
  await waitForShellReady(page);
  const card = page.locator("details").first();
  const label = "病理學－免疫與感染性疾病";

  await expect(card.getByText(label, { exact: true })).toHaveCount(1);
  await card.locator("summary").click();
  await expect(card).toHaveAttribute("open", "");
  await expect(card.getByText(label, { exact: true })).toHaveCount(1);
});

test("複習頁不會進入重複更新迴圈", async ({ page }) => {
  const updateDepthWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Maximum update depth exceeded")) {
      updateDepthWarnings.push(message.text());
    }
  });

  await page.goto("/review", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  await expect(page.getByRole("heading", { name: "錯題複習與沒信心題" })).toBeVisible();
  await page.waitForTimeout(1_500);
  expect(updateDepthWarnings).toEqual([]);
});
