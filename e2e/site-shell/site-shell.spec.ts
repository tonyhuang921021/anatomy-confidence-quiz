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
  await expect(page.getByRole("heading", { name: "今天從哪裡開始？" })).toBeVisible();
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

test("開始測驗的科別標題不換行，抽題設定只留必要資訊", async ({ page }) => {
  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);

  const groupHeadings = page.locator(".quiz-setup-group > div:first-child > h2");
  await expect(groupHeadings).toHaveCount(2);
  const headingMetrics = await groupHeadings.evaluateAll((elements) =>
    elements.map((element) => {
      const style = window.getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight),
        whiteSpace: style.whiteSpace
      };
    })
  );
  for (const metric of headingMetrics) {
    expect(metric.whiteSpace).toBe("nowrap");
    expect(metric.height).toBeLessThanOrEqual(metric.lineHeight * 1.15);
  }

  const settings = page.getByRole("region", { name: "抽題設定" });
  await expect(settings).toBeVisible();
  await expect(settings.getByText("0 個範圍・0 題可練", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "全選科目" })).toBeVisible();
  await expect(settings.getByRole("button", { name: "請先選科目" })).toBeDisabled();
  await expect(page.getByText("先出沒做過的題", { exact: false })).toHaveCount(0);
  await expect(page.getByText("每題詳解後可結束", { exact: false })).toHaveCount(0);
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
  const sourceToolbar = details.locator(".search-result-source-tabs");
  await expect(details).toBeVisible();
  await expect(sourceToolbar.getByText("陽明", { exact: true })).toBeVisible();
  await expect(sourceToolbar.getByText("補充", { exact: true })).toBeVisible();
  await expect(sourceToolbar.getByRole("button", { name: "這題我們不要了" })).toBeVisible();
  await expect(sourceToolbar.getByText("更多", { exact: true })).toBeVisible();
  await expect(details.getByText("快速記憶法", { exact: true })).toHaveCount(0);

  const sourceButtonY = await Promise.all(
    ["陽明", "補充", "這題我們不要了", "更多"].map(async (label) =>
      (await sourceToolbar.getByText(label, { exact: true }).boundingBox())?.y ?? -1
    )
  );
  expect(Math.max(...sourceButtonY) - Math.min(...sourceButtonY)).toBeLessThanOrEqual(2);

  await sourceToolbar.locator("summary").filter({ hasText: "更多" }).click();
  await expect(sourceToolbar.getByRole("button", { name: "儲存題目" })).toBeVisible();
  await expect(sourceToolbar.getByRole("button", { name: "用 AI 補詳解" })).toBeVisible();
  await expect(sourceToolbar.getByRole("button", { name: "回報" })).toBeVisible();

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const optionColumnCount = await options.evaluate((element) =>
    window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
  );
  expect(optionColumnCount).toBe(viewportWidth >= 900 ? 2 : 1);
});

test("搜尋結果展開後會顯示題幹圖片", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  await page.getByRole("textbox", { name: "關鍵字" }).fill("MOEX-110101_2301-Q100");
  const card = page.locator("details.search-result-card");
  await expect(card).toHaveCount(1);
  await card.locator("summary").click();

  const image = card.getByRole("img", { name: "MOEX-110101_2301-Q100 題目圖片" });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute(
    "src",
    "/question-media/MOEX-110101_2301-Q100.png"
  );
});

test("正式作答詳解使用同一組精簡工具列", async ({ page }) => {
  const now = new Date().toISOString();
  await page.addInitScript(({ answeredAt }) => {
    const session = {
      id: "site-shell-quiz-session",
      subject: "醫學（二）",
      startedAt: answeredAt,
      settings: {
        mode: "random",
        questionCount: 1,
        subjectFilter: "病理學",
        stopAfterReview: true,
        feedbackMode: "full"
      },
      questionOrder: ["MOEX-115020-2301-Q078"],
      currentQuestionIndex: 0,
      isReviewingAnswer: true,
      attempts: [
        {
          questionId: "MOEX-115020-2301-Q078",
          selectedAnswer: "C",
          correctAnswer: "A",
          isCorrect: false,
          confidence: 4,
          answeredAt
        }
      ]
    };
    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-current-session:guest",
      JSON.stringify(session)
    );
  }, { answeredAt: now });

  await page.goto("/quiz?resume=1&sessionId=site-shell-quiz-session", {
    waitUntil: "networkidle"
  });
  await waitForShellReady(page);

  const toolbar = page.locator("main#main-content section.border-y").filter({
    has: page.getByRole("button", { name: "這題我們不要了" })
  });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "這題我們不要了" })).toBeVisible();
  await expect(page.getByText("快速記憶法", { exact: true })).toHaveCount(0);
  await expect(page.locator(".simulation-status-sidebar")).toHaveCount(0);
  await expect(page.getByText("本輪狀態", { exact: true })).toHaveCount(0);
  await expect(page.getByText("本地題庫模式", { exact: true })).toHaveCount(0);
  await expect(page.getByText("本輪平均信心", { exact: false })).toHaveCount(0);
  await expect(page.getByText("答錯", { exact: true })).toBeVisible();

  const rowY = await Promise.all(
    ["陽明", "補充", "類似題", "這題我們不要了", "更多"].map(async (label) =>
      (await toolbar.getByText(label, { exact: true }).boundingBox())?.y ?? -1
    )
  );
  expect(Math.max(...rowY) - Math.min(...rowY)).toBeLessThanOrEqual(2);

  await toolbar.locator("summary").filter({ hasText: "更多" }).click();
  await expect(toolbar.getByRole("button", { name: "用 AI 補詳解" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "回報" })).toBeVisible();
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

test("同一份進行中測驗會保留 13 題完整作答，不被較新的 6 題暫存覆蓋", async ({ page }) => {
  const questionIds = Array.from(
    { length: 13 },
    (_, index) => `MOEX-100030-1101-Q${String(index + 1).padStart(3, "0")}`
  );
  await page.addInitScript(({ ids }) => {
    const makeAttempts = (count: number, answeredAt: string) =>
      ids.slice(0, count).map((questionId) => ({
        questionId,
        selectedAnswer: "A",
        correctAnswer: "A",
        isCorrect: true,
        confidence: 3,
        answeredAt
      }));
    const olderCompleteCopy = {
      id: "site-shell-resume-union",
      subject: "醫學（一）",
      startedAt: "2026-08-24T00:00:00.000Z",
      settings: {
        mode: "random",
        questionCount: ids.length,
        subjectFilter: "解剖學",
        stopAfterReview: true,
        feedbackMode: "full"
      },
      questionOrder: ids,
      currentQuestionIndex: ids.length - 1,
      isReviewingAnswer: true,
      attempts: makeAttempts(ids.length, "2026-08-24T00:13:00.000Z")
    };
    const newerShortCopy = {
      ...olderCompleteCopy,
      startedAt: "2026-08-24T00:20:00.000Z",
      currentQuestionIndex: 5,
      attempts: makeAttempts(6, "2026-08-24T00:26:00.000Z")
    };

    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-current-session:guest",
      JSON.stringify(olderCompleteCopy)
    );
    window.sessionStorage.setItem(
      "anatomy-confidence-current-session:guest",
      JSON.stringify(newerShortCopy)
    );
  }, { ids: questionIds });

  await page.goto("/quiz?resume=1&sessionId=site-shell-resume-union", {
    waitUntil: "networkidle"
  });
  await waitForShellReady(page);

  await expect(page.getByText(/^已答 13/)).toHaveText(/^已答 13/);
  await expect(page.getByText("第 13 / 13 題", { exact: true })).toBeVisible();
});

test("結果頁會合併同一 session 的本機 100 題與雲端短副本", async ({ page }) => {
  const questionIds = Array.from(
    { length: 100 },
    (_, index) => `MOEX-100030-1101-Q${String(index + 1).padStart(3, "0")}`
  );
  await page.addInitScript(({ ids }) => {
    const completedAt = "2026-08-24T01:40:00.000Z";
    const makeSession = (count: number, answeredAt: string) => ({
      id: "site-shell-result-union",
      subject: "醫學（一）",
      startedAt: "2026-08-24T00:00:00.000Z",
      completedAt,
      settings: {
        mode: "random",
        questionCount: ids.length,
        subjectFilter: "解剖學"
      },
      questionOrder: ids,
      currentQuestionIndex: count - 1,
      attempts: ids.slice(0, count).map((questionId) => ({
        questionId,
        selectedAnswer: "A",
        correctAnswer: "A",
        isCorrect: true,
        confidence: 3,
        answeredAt
      }))
    });

    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-completed-sessions:guest",
      JSON.stringify([makeSession(100, "2026-08-24T01:40:00.000Z")])
    );
    window.localStorage.setItem(
      "anatomy-confidence-cloud-completed-sessions:guest",
      JSON.stringify([makeSession(6, "2026-08-24T01:45:00.000Z")])
    );
  }, { ids: questionIds });

  await page.goto("/results?sessionId=site-shell-result-union", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  await expect(page.getByText("全部 100", { exact: true })).toBeVisible();
  await expect(page.getByText("第 100 題：", { exact: false }).first()).toBeAttached();
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
