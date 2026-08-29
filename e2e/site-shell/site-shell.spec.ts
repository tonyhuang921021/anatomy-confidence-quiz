import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/progress",
  "/results",
  "/saved-questions",
  "/settings",
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
  await expect(feedbackSection).toBeFocused();
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
  const settingsButton = drawer.getByRole("button", { name: "設定", exact: true });
  await expect(settingsButton).toBeVisible();
  await expect(drawer.getByRole("link", { name: "考後回顧", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "更多功能" })).toHaveCount(0);

  await page.waitForTimeout(220);
  const drawerBox = await drawer.boundingBox();
  expect(Math.abs(drawerBox?.x ?? 1)).toBeLessThanOrEqual(1);

  await settingsButton.click();
  await expect(page.getByRole("dialog", { name: "帳號與設定" })).toBeVisible();
  await expect(drawer).toHaveCount(0);
});

test("手機底部的更多只放設定、留言板與次要工具", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-mobile", "只檢查手機底部導覽");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);

  const mobileMore = page.locator(".app-mobile-nav").getByRole("button", { name: "更多", exact: true });
  await mobileMore.click();
  const drawer = page.getByRole("dialog", { name: "更多功能" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("button", { name: "設定", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "留言板", exact: true })).toBeVisible();
  await expect(drawer.getByText("學習工具", { exact: true })).toBeVisible();
  await expect(drawer.getByText("整理與回顧", { exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "首頁", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "進度總覽", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "作答紀錄", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "儲存題目", exact: true })).toHaveCount(0);

  await drawer.getByRole("button", { name: "設定", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "帳號與設定" });
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
  await expect(mobileMore).toBeFocused();
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

test("320px 重排不會裁切主流程", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of ["/start", "/search", "/progress", "/results"]) {
    await expectStablePage(page, route);
  }
});

test("一般練習先選範圍，設定需要時再展開", async ({ page }) => {
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

  const selection = page.getByRole("region", { name: "已選範圍" });
  await expect(selection).toBeVisible();
  await expect(selection.getByText("尚未選擇", { exact: true })).toBeVisible();
  await expect(selection.getByRole("button", { name: "下一步" })).toBeDisabled();
  await expect(page.getByRole("region", { name: /練習設定/ })).toHaveCount(0);

  const selectAllButton = selection.getByRole("button", { name: "全選", exact: true });
  await selectAllButton.click();
  await expect(selection.getByRole("button", { name: "取消全選", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await selection.getByRole("button", { name: "取消全選", exact: true }).click();
  await expect(selection.getByRole("button", { name: "全選", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(selection.getByText("尚未選擇", { exact: true })).toBeVisible();
  await expect(selection.getByRole("button", { name: "下一步" })).toBeDisabled();

  const anatomyButton = page.locator(".quiz-setup-group button[aria-pressed]").filter({ hasText: "解剖學" }).first();
  await anatomyButton.click();
  await expect(anatomyButton).toHaveAttribute("aria-pressed", "true");
  await expect(selection.getByText("解剖學", { exact: true })).toBeVisible();
  await selection.getByRole("button", { name: "下一步" }).click();

  await expect(page.getByRole("heading", { name: "準備開始" })).toBeFocused();
  const settings = page.getByRole("region", { name: "解剖學自由做題設定" });
  await expect(settings).toBeVisible();
  const settingsToggle = settings.getByRole("button", { name: "調整設定" });
  await expect(settingsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(settings.getByRole("combobox", { name: "起始年份" })).toBeHidden();
  await expect(settings.getByRole("button", { name: "開始 10 題" })).toBeVisible();

  await settingsToggle.click();
  await expect(settings.getByRole("button", { name: "收起設定" })).toHaveAttribute("aria-expanded", "true");
  await expect(settings.getByRole("combobox", { name: "起始年份" })).toBeVisible();
  await expect(settings.getByRole("combobox", { name: "結束年份" })).toBeVisible();
  await expect(settings.getByRole("combobox", { name: "每輪題數" })).toBeVisible();
  const orderButtons = settings.getByRole("group", { name: "選擇做題順序" }).getByRole("button");
  await expect(orderButtons).toHaveCount(2);
  await expect(orderButtons.nth(0)).toHaveText("未做優先");
  await expect(orderButtons.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(orderButtons.nth(1)).toHaveText("近年穿插");
  await expect(settings.getByRole("combobox", { name: "每輪題數" }).locator('option[value="all"]')).toHaveCount(0);

  await settings.getByRole("button", { name: "不限題數" }).click();
  await expect(settings.getByRole("combobox", { name: "每輪題數" })).toBeHidden();
  await expect(settings.getByRole("button", { name: "開始自由做題" })).toBeVisible();
  await settings.getByRole("button", { name: "固定題數" }).click();

  await page.getByRole("button", { name: "返回選科" }).click();
  await expect(page.getByRole("heading", { name: "這次想練什麼？" })).toBeFocused();
  await expect(anatomyButton).toHaveAttribute("aria-pressed", "true");

  await selection.getByRole("button", { name: "下一步" }).click();
  await settings.getByRole("button", { name: "調整設定" }).click();
  await settings.getByRole("combobox", { name: "每輪題數" }).selectOption("5");
  await settings.getByRole("button", { name: "開始 5 題" }).click();
  await expect(page).toHaveURL(/\/quiz\?resume=1&sessionId=/);
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("anatomy-confidence-current-session:guest");
    return raw ? JSON.parse(raw).questionOrder?.length : null;
  })).toBe(5);
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("anatomy-confidence-current-session:guest");
    if (!raw) return null;
    const session = JSON.parse(raw);
    return {
      questionCount: session.settings?.questionCount,
      stopAfterReview: session.settings?.stopAfterReview,
      questionOrderMode: session.settings?.questionOrderMode,
      enableFastAnswerMode: session.settings?.enableFastAnswerMode,
      enableKeyboardNavigation: session.settings?.enableKeyboardNavigation
    };
  })).toEqual({
    questionCount: 5,
    stopAfterReview: false,
    questionOrderMode: "unseen",
    enableFastAnswerMode: false,
    enableKeyboardNavigation: false
  });
});

test("自由做題會記住上次選擇", async ({ page }) => {
  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);

  const anatomyButton = page.locator(".quiz-setup-group button[aria-pressed]").filter({ hasText: "解剖學" }).first();
  await anatomyButton.click();
  await page.getByRole("region", { name: "已選範圍" }).getByRole("button", { name: "下一步" }).click();

  let settings = page.getByRole("region", { name: "解剖學自由做題設定" });
  await settings.getByRole("button", { name: "調整設定" }).click();
  await settings.getByRole("combobox", { name: "每輪題數" }).selectOption("15");
  await settings.getByRole("button", { name: "近年穿插" }).click();
  await settings.getByRole("group", { name: "送出答案" }).getByRole("button", { name: "點選即送出" }).click();
  await settings.getByRole("group", { name: "方向鍵切題" }).getByRole("button", { name: "開啟" }).click();

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  await page.locator(".quiz-setup-group button[aria-pressed]").filter({ hasText: "解剖學" }).first().click();
  await page.getByRole("region", { name: "已選範圍" }).getByRole("button", { name: "下一步" }).click();

  settings = page.getByRole("region", { name: "解剖學自由做題設定" });
  await expect(settings.getByText(/15 題一輪・近年穿插/)).toBeVisible();
  await settings.getByRole("button", { name: "調整設定" }).click();
  await expect(settings.getByRole("combobox", { name: "每輪題數" })).toHaveValue("15");
  await expect(settings.getByRole("button", { name: "近年穿插" })).toHaveAttribute("aria-pressed", "true");
  await expect(settings.getByRole("group", { name: "送出答案" }).getByRole("button", { name: "點選即送出" })).toHaveAttribute("aria-pressed", "true");
  await expect(settings.getByRole("group", { name: "方向鍵切題" }).getByRole("button", { name: "開啟" })).toHaveAttribute("aria-pressed", "true");
});

test("320px 展開自由做題設定不會產生水平溢出", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);

  await page.locator(".quiz-setup-group button[aria-pressed]").filter({ hasText: "解剖學" }).first().click();
  await page.getByRole("region", { name: "已選範圍" }).getByRole("button", { name: "下一步" }).click();
  const settings = page.getByRole("region", { name: "解剖學自由做題設定" });
  await settings.getByRole("button", { name: "調整設定" }).click();

  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewport);
});

test("微生物單一分類在第二步仍會忠實顯示範圍", async ({ page }) => {
  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);

  await page.getByRole("button", { name: "微生物免疫學選分類" }).click();
  await page.getByRole("button", { name: "微生物免疫學：細菌" }).click();
  const selection = page.getByRole("region", { name: "已選範圍" });
  await expect(selection.getByText("微生物免疫學（細菌）", { exact: true })).toBeVisible();
  await selection.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("region", { name: "微生物免疫學（細菌）自由做題設定" })).toBeVisible();
});

test("進度總覽點章節後才進入獨立設定頁開始練習", async ({ page }) => {
  await page.goto("/progress", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);
  await expect(page.getByRole("heading", { name: "醫學一／醫學二進度總覽" })).toBeVisible();
  await expect(page.getByText("做題順序", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "選擇做題順序" })).toHaveCount(0);

  const med1Group = page.locator(".progress-subject-group").filter({ hasText: "醫學（一）" }).first();
  await expect(med1Group.locator(":scope > button")).toHaveAttribute("aria-expanded", "false");
  await med1Group.locator(":scope > button").click();
  await expect(med1Group.locator(":scope > button")).toHaveAttribute("aria-expanded", "true");

  const anatomyRow = page.locator(".progress-subject-row").filter({ hasText: "解剖學" }).first();
  await anatomyRow.locator(":scope > button").click();

  const practiceLink = anatomyRow.getByRole("link", { name: /前往設定解剖學的.+練習/ }).first();
  await expect(practiceLink).toBeVisible();
  await practiceLink.click();

  await expect(page).toHaveURL(/\/progress\/practice\?subject=/);
  await expect(page.getByRole("heading", { level: 1, name: /解剖學－.+/ })).toBeVisible();
  const setup = page.getByRole("region", { name: /解剖學－.+練習設定/ }).first();
  await expect(setup).toBeVisible();
  await expect(setup.getByLabel("起始年份", { exact: true })).toBeVisible();
  await expect(setup.getByLabel("結束年份", { exact: true })).toBeVisible();
  await expect(setup.getByLabel("練習題數", { exact: true })).toBeVisible();
  await expect(setup.getByRole("group", { name: "選擇做題順序" })).toBeVisible();

  await setup.getByRole("button", { name: "未做優先" }).click();
  await expect(setup.getByText("不分年份，先做完沒做過的題目，再複習做過的題目。", { exact: true })).toBeVisible();
  await setup.getByLabel("練習題數", { exact: true }).selectOption("all");
  await expect(setup.getByText(/\d+ 題符合/)).toBeVisible();
  await expect(setup.getByRole("button", { name: /開始 \d+ 題|這段年份沒有題目/ })).toBeVisible();

  await setup.getByLabel("練習題數", { exact: true }).selectOption("5");
  await setup.getByRole("button", { name: "開始 5 題" }).click();
  await expect(page).toHaveURL(/\/quiz\?resume=1&sessionId=/);
  await expect(page.getByText("第 1 / 5 題", { exact: true })).toBeVisible();
});

test("弱點資料不足時不會把沒有紀錄顯示成 0%", async ({ page }) => {
  await page.goto("/progress/weakness", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  await expect(page.getByText("資料不足", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: /診斷進度 0 \/ 10 題/ })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("做題順序", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0%", { exact: true })).toHaveCount(0);
});

test("作答紀錄空白但有未完成測驗時會顯示續作", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      id: "site-shell-unfinished",
      subject: "生理學",
      startedAt: "2026-08-29T00:00:00.000Z",
      settings: { mode: "random", questionCount: 1, subjectFilter: "生理學" },
      questionOrder: ["MOEX-100030-1101-Q001"],
      currentQuestionIndex: 0,
      attempts: []
    };
    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-current-session:guest",
      JSON.stringify(session)
    );
  });

  await page.goto("/results", { waitUntil: "networkidle" });
  await waitForShellReady(page);
  const resumeLink = page.getByRole("link", { name: "繼續作答" });
  await expect(resumeLink).toBeVisible();
  await expect(resumeLink).toHaveAttribute(
    "href",
    "/quiz?resume=1&sessionId=site-shell-unfinished"
  );
});

test("設定頁收納通知與加入主畫面教學", async ({ page, browserName }) => {
  await page.route("https://e2e.invalid/**", (route) => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default" }
    });
  });
  if (browserName === "webkit") {
    await page.addInitScript(() => {
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: class MockPushManager {}
      });
    });
  }
  await page.addInitScript(() => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const session = {
      access_token: "student-access-token",
      refresh_token: "student-refresh-token",
      expires_in: 3600,
      expires_at: nowSeconds + 3600,
      token_type: "bearer",
      user: {
        id: "student-user",
        email: "student@example.test",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: { display_name: "一般使用者" },
        created_at: "2026-08-26T00:00:00.000Z"
      }
    };
    window.localStorage.setItem("medQuizAuthSessionSnapshot", JSON.stringify(session));
    window.localStorage.setItem("medQuizAutomaticCloudSync:student-user", String(Date.now()));
    window.localStorage.setItem("quiz-visitor-presence-last-sent:student-user", String(Date.now()));
  });
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await waitForShellReady(page);

  await expect(page).toHaveURL(/\/?settings=1$/);
  const accountSettings = page.getByRole("dialog", { name: "帳號與設定" });
  await expect(accountSettings).toBeVisible();
  await expect(accountSettings.getByRole("heading", { name: "通知", exact: true })).toBeVisible();
  const pushSettings = accountSettings.getByRole("region", { name: "手機通知" });
  await expect(pushSettings).toBeVisible();

  if (browserName === "webkit") {
    await expect(pushSettings.getByText("需先加入主畫面", { exact: true })).toBeVisible();
    await expect(accountSettings.getByText("iPhone・Safari", { exact: true })).toBeVisible();
    await expect(accountSettings.getByRole("img", { name: "iPhone 加入主畫面三步驟示意圖" })).toBeVisible();
    await expect(accountSettings.getByText("用 Safari 點分享圖示。", { exact: false })).toBeVisible();
  } else {
    await expect(pushSettings.getByText("尚未開啟", { exact: true })).toBeVisible();
    await expect(pushSettings.getByRole("button", { name: "開啟手機通知" })).toBeVisible();
    await expect(accountSettings.getByText("請用 iPhone 或 Android 手機開啟這一頁", { exact: false })).toBeVisible();
  }
});

test("搜尋結果展開後不會重複題幹與分類", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);
  await page.getByRole("button", { name: "瀏覽全部題目" }).click();

  const card = page.locator("article.search-result-card").first();
  await expect(card).toBeVisible();
  const disclosure = card.locator('button[aria-controls^="search-result-details-"]');
  const stem = (await disclosure.locator("p").first().innerText()).trim();
  const primaryTag = (await disclosure.locator("span.max-w-full.break-words").last().innerText()).trim();

  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(disclosure.getByText("收合", { exact: true })).toBeVisible();
  await expect(card).toHaveCSS("overflow", "visible");
  await expect(card.getByText(stem, { exact: true })).toHaveCount(1);
  await expect(card.getByText(primaryTag, { exact: true })).toHaveCount(1);

  const details = card.locator(".search-result-details");
  const options = details.locator(".search-result-options");
  const sourceToolbar = details.locator(".search-result-source-tabs");
  await expect(details).toBeVisible();
  await details.getByRole("button", { name: "顯示答案與詳解" }).click();
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
  const saveQuestionButton = sourceToolbar.getByRole("button", { name: "儲存題目" });
  await expect(saveQuestionButton).toBeVisible();
  await saveQuestionButton.click();
  await expect(sourceToolbar.getByRole("button", { name: /取消儲存題目/ })).toBeVisible();
  await expect(sourceToolbar.getByRole("button", { name: "用 AI 補詳解" })).toBeVisible();
  await expect(sourceToolbar.getByRole("button", { name: "回報" })).toBeVisible();

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const optionColumnCount = await options.evaluate((element) =>
    window.getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
  );
  expect(optionColumnCount).toBe(viewportWidth >= 900 ? 2 : 1);
});

test("題目搜尋可以先隱藏答案或直接顯示", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);
  await page.getByRole("button", { name: "瀏覽全部題目" }).click();
  await page.getByRole("button", { name: /進階篩選/ }).click();

  const displayMode = page.getByRole("group", { name: "展開題目後的答案顯示方式" });
  const practiceMode = displayMode.getByRole("button", { name: "先隱藏" });
  const directMode = displayMode.getByRole("button", { name: "直接顯示" });
  await expect(practiceMode).toHaveAttribute("aria-pressed", "true");

  const cards = page.locator("article.search-result-card");
  const firstCard = cards.first();
  await firstCard.locator('button[aria-controls^="search-result-details-"]').click();
  await expect(firstCard.locator(".search-result-options")).toBeVisible();
  await expect(firstCard.getByText("正確答案", { exact: true })).toHaveCount(0);
  await firstCard.getByRole("button", { name: "顯示答案與詳解" }).click();
  await expect(firstCard.getByText("正確答案", { exact: true })).toBeVisible();

  await directMode.click();
  await expect(directMode).toHaveAttribute("aria-pressed", "true");
  const secondCard = cards.nth(1);
  await secondCard.locator('button[aria-controls^="search-result-details-"]').click();
  await expect(secondCard.getByText("正確答案", { exact: true })).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /進階篩選/ }).click();
  await expect(page.getByRole("group", { name: "展開題目後的答案顯示方式" })
    .getByRole("button", { name: "直接顯示" }))
    .toHaveAttribute("aria-pressed", "true");
});

test("搜尋結果展開後會顯示題幹圖片", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  await page.getByRole("textbox", { name: "想找哪一題？" }).fill("MOEX-110101_2301-Q100");
  const card = page.locator("article.search-result-card");
  await expect(card).toHaveCount(1);
  await card.locator('button[aria-controls^="search-result-details-"]').click();

  const image = card.getByRole("img", { name: "MOEX-110101_2301-Q100 題目圖片" });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute(
    "src",
    "/question-media/MOEX-110101_2301-Q100.png"
  );
});

test("題目搜尋可以多選並直接開始私人練習", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  await expect(page.getByText("先找出想練的題目", { exact: true })).toBeVisible();
  await expect(page.locator("article.search-result-card")).toHaveCount(0);
  await page.getByRole("button", { name: "瀏覽全部題目" }).click();

  const cards = page.locator("article.search-result-card");
  await expect(cards).toHaveCount(30);
  await cards.nth(0).getByRole("button", { name: "選入練習" }).click();
  await cards.nth(1).getByRole("button", { name: "選入練習" }).click();
  await expect(page.getByText("已選 2 題", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "開始私人練習" }).click();

  await expect(page).toHaveURL(/\/quiz\?resume=1&sessionId=/);
  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("anatomy-confidence-current-session:guest");
    if (!raw) return null;
    const session = JSON.parse(raw) as {
      settings?: { mode?: string; strictCustomQuestionPool?: boolean };
      questionOrder?: string[];
    };
    return {
      mode: session.settings?.mode,
      strict: session.settings?.strictCustomQuestionPool,
      questionCount: session.questionOrder?.length
    };
  })).toEqual({ mode: "search_practice", strict: true, questionCount: 2 });

  const sessionIdBeforeReload = new URL(page.url()).searchParams.get("sessionId");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(new RegExp(`sessionId=${sessionIdBeforeReload}`));
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("anatomy-confidence-current-session:guest");
    return raw ? JSON.parse(raw).id : null;
  })).toBe(sessionIdBeforeReload);
});

test("搜尋儲存題目視窗會圈限焦點、隔離背景並把焦點還回入口", async ({ page }) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);

  const trigger = page.getByRole("button", { name: "開啟儲存題目" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "儲存題目" });
  const closeButton = dialog.getByRole("button", { name: "關閉儲存題目" });
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(page.locator(".app-frame")).toHaveAttribute("inert", "");
  await expect(page.locator(".app-frame")).toHaveAttribute("aria-hidden", "true");

  const lastFocusable = dialog.locator("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])").last();
  await page.keyboard.press("Shift+Tab");
  await expect(lastFocusable).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator(".app-frame")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".app-frame")).not.toHaveAttribute("aria-hidden", "true");
});

test("搜尋開新練習前不會靜默覆蓋既有進度", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      id: "site-shell-existing-practice",
      subject: "解剖學",
      startedAt: "2026-08-29T00:00:00.000Z",
      settings: { mode: "random", questionCount: 2, subjectFilter: "解剖學" },
      questionOrder: ["MOEX-100030-1101-Q001", "MOEX-100030-1101-Q002"],
      currentQuestionIndex: 1,
      attempts: [{
        questionId: "MOEX-100030-1101-Q001",
        selectedAnswer: "A",
        correctAnswer: "A",
        isCorrect: true,
        confidence: 4,
        answeredAt: "2026-08-29T00:01:00.000Z"
      }]
    };
    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-current-session:guest",
      JSON.stringify(session)
    );
  });

  await page.goto("/search", { waitUntil: "networkidle" });
  await waitForShellReady(page);
  await page.getByRole("button", { name: "瀏覽全部題目" }).click();
  await page.locator("article.search-result-card").first().getByRole("button", { name: "選入練習" }).click();
  await page.getByRole("button", { name: "開始私人練習" }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(
    page.getByRole("alert").filter({ hasText: "為避免覆蓋進度" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "繼續原測驗" })).toBeVisible();
  expect(await page.evaluate(() => {
    const raw = window.localStorage.getItem("anatomy-confidence-current-session:guest");
    return raw ? JSON.parse(raw).id : null;
  })).toBe("site-shell-existing-practice");
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

test("模擬考倒數歸零後不再顯示可暫停按鈕", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      id: "site-shell-expired-timer",
      subject: "醫學（二）",
      startedAt: "2026-08-29T00:00:00.000Z",
      settings: {
        mode: "simulation",
        questionCount: 1,
        subjectFilter: "病理學",
        paperMode: "past_paper"
      },
      questionOrder: ["MOEX-115020-2301-Q078"],
      currentQuestionIndex: 0,
      attempts: []
    };
    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-current-session:guest",
      JSON.stringify(session)
    );
    window.localStorage.setItem(
      "simulation-exam-timer:site-shell-expired-timer",
      JSON.stringify({
        durationSeconds: 7200,
        accumulatedSeconds: 7200,
        runningSince: null,
        paused: true,
        updatedAt: Date.now()
      })
    );
  });

  await page.goto("/quiz?resume=1&sessionId=site-shell-expired-timer", {
    waitUntil: "networkidle"
  });
  await waitForShellReady(page);
  await expect(page.getByText("計時已結束", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "暫停", exact: true })).toHaveCount(0);
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

test("手機滿版回顧會圈限焦點、隔離背景並可用 Esc 返回", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-mobile", "只檢查手機滿版回顧");
  const completedAt = "2026-08-29T01:00:00.000Z";
  await page.addInitScript(({ at }) => {
    const session = {
      id: "site-shell-fullscreen-result",
      subject: "醫學（二）",
      startedAt: at,
      completedAt: at,
      settings: { mode: "random", questionCount: 1, subjectFilter: "病理學" },
      questionOrder: ["MOEX-115020-2301-Q078"],
      attempts: [{
        questionId: "MOEX-115020-2301-Q078",
        selectedAnswer: "C",
        correctAnswer: "A",
        isCorrect: false,
        confidence: 4,
        answeredAt: at
      }]
    };
    window.localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    window.localStorage.setItem(
      "anatomy-confidence-completed-sessions:guest",
      JSON.stringify([session])
    );
  }, { at: completedAt });

  await page.goto("/results?sessionId=site-shell-fullscreen-result", { waitUntil: "networkidle" });
  await waitForShellReady(page);
  const trigger = page.getByRole("button", { name: "開啟滿版題目回顧" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "題目回顧" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "返回頁面" })).toBeFocused();
  await expect(page.locator(".app-frame")).toHaveAttribute("inert", "");
  const lastFocusable = dialog.locator("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details > summary, [tabindex]:not([tabindex='-1'])").last();
  await page.keyboard.press("Shift+Tab");
  await expect(lastFocusable).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "返回頁面" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator(".app-frame")).not.toHaveAttribute("inert", "");
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
