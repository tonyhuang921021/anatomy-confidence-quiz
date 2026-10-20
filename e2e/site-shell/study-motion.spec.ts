import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// WebKit may bypass page.route once the push worker controls the page.
// These fixture tests own API responses; worker behavior has its own suite.
test.use({ video: "on", serviceWorkers: "block" });

const questionIds = [1, 2, 3].map((number) => `study-motion-fixture-${number}`);
const explanation = Array.from({ length: 12 }, (_, index) => `閱讀定位段落 ${index + 1}：這是本機介面驗收用的虛構詳解，保留文字與圖片，展開時不捲動閱讀位置。`).join("\n\n");

async function openFixture(page: Page) {
  await page.route("https://e2e.invalid/**", (route) => route.abort());
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const payload = pathname === "/api/yangming-explanation"
      ? { ok: true, explanation: { questionId: questionIds[0], body: `陽明閱讀定位驗收內容\n\n${explanation}`, assets: [], sections: [] } }
      : { ok: true, stats: [], overrides: {}, count: 0, cards: [], reactions: [] };
    await route.fulfill({ json: payload });
  });
  await page.addInitScript(({ ids, content }) => {
    // A dedicated browser context and invented questions; no real user history or services.
    if (localStorage.getItem("study-motion-fixture-ready")) return;
    const session = {
      id: "study-motion-fixture",
      subject: "醫學（一）",
      startedAt: new Date().toISOString(),
      settings: {
        mode: "random", questionCount: 3, subjectFilter: "解剖學",
        feedbackMode: "full", stopAfterReview: true,
        enableKeyboardNavigation: true, enableFastAnswerMode: false
      },
      generatedQuestions: ids.map((id, index) => ({
        id, subject: "解剖學", chapter: "本機介面驗收", section: "動效與操作",
        stem: `動效驗收第 ${index + 1} 題：請選擇選項甲。`,
        options: { A: "選項甲", B: "選項乙", C: "選項丙", D: "選項丁" },
        answer: "A", explanation: content, testedConcept: "本機操作驗收",
        optionAnalysis: { A: "本機正確選項", B: "本機其他選項", C: "本機其他選項", D: "本機其他選項" },
        sourceType: "AI_GENERATED", source: "ai-generated"
      })),
      questionOrder: ids, currentQuestionIndex: 0, isReviewingAnswer: false, attempts: []
    };
    localStorage.setItem("anatomy-confidence-active-user-id", "guest");
    localStorage.setItem("anatomy-confidence-current-session:guest", JSON.stringify(session));
    localStorage.setItem("study-motion-fixture-ready", "true");
  }, { ids: questionIds, content: explanation });
  await page.goto("/quiz?resume=1&sessionId=study-motion-fixture");
  await expect(page.getByText("動效驗收第 1 題：請選擇選項甲。", { exact: true })).toBeVisible();
}

async function answer(page: Page, key = "甲", keyboard = false) {
  const choice = page.getByRole("button", { name: new RegExp(`選項${key}`) });
  if (keyboard) {
    await choice.focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "送出答案", exact: true }).focus();
    await page.keyboard.press("Enter");
  } else {
    await choice.click();
    await page.getByRole("button", { name: "送出答案", exact: true }).click();
  }
  await expect(page.getByText(key === "甲" ? "答對" : "答錯", { exact: true })).toBeVisible();
}

test("動效對照截圖與初始載入", async ({ page }, testInfo) => {
  await openFixture(page);
  const label = process.env.MOTION_BASELINE === "1" ? "before" : "after";
  await page.screenshot({ path: `evidence/motion/${label}-${testInfo.project.name}-question.png`, fullPage: true });
  await answer(page);
  await page.screenshot({ path: `evidence/motion/${label}-${testInfo.project.name}-feedback.png`, fullPage: true });
  const metrics = await page.evaluate(() => ({
    navigation: performance.getEntriesByType("navigation").map((entry) => entry.toJSON()),
    paints: performance.getEntriesByType("paint").map((entry) => entry.toJSON()),
    scripts: performance.getEntriesByType("resource").filter((entry) => entry.name.endsWith(".js")).map((entry) => entry.toJSON())
  }));
  await testInfo.attach(`${label}-load-metrics`, { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  await writeFile(`evidence/motion/${label}-${testInfo.project.name}-load.json`, JSON.stringify(metrics, null, 2));
});

test("滑鼠與鍵盤作答、快速切題與 refresh 保留完整答案", async ({ page }) => {
  await openFixture(page);
  await answer(page, "甲", true);
  const next = page.getByRole("button", { name: "下一題", exact: true }).filter({ visible: true }).first();
  await next.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "作答題目", exact: true })).toBeFocused();
  await answer(page, "乙");
  const retainedChoice = page.getByRole("button", { name: /選項甲/ });
  await retainedChoice.focus();
  // Navigate back and forth without waiting for any animation to finish.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
  await expect(retainedChoice).toBeFocused();
  await page.reload();
  await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("anatomy-confidence-current-session:guest") || "{}").attempts?.length)).toBe(2);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("anatomy-confidence-current-session:guest") || "{}"));
  expect(saved.attempts.map((attempt: { selectedAnswer: string }) => attempt.selectedAnswer)).toEqual(["A", "B"]);
  expect(saved.attempts.map((attempt: { correctAnswer: string }) => attempt.correctAnswer)).toEqual(["A", "A"]);
  expect(saved.attempts.map((attempt: { isCorrect: boolean }) => attempt.isCorrect)).toEqual([true, false]);
  expect(saved.generatedQuestions[0].explanation).toBe(explanation);
});

test("解析展開保留閱讀位置與焦點，收合內容不接收焦點", async ({ page }) => {
  await openFixture(page);
  await answer(page);
  const trigger = page.getByRole("button", { name: "陽明", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const before = await trigger.boundingBox();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("region", { name: "陽明詳解", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("陽明閱讀定位驗收內容");
  await expect(trigger).toBeFocused();
  const after = await trigger.boundingBox();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(3);
  await page.keyboard.press("Enter");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
});

test("reduced motion 停止位移與平滑捲動，回饋仍可操作", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page);
  await answer(page, "甲", true);
  const next = page.getByRole("button", { name: "下一題", exact: true }).filter({ visible: true }).first();
  await next.click();
  await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
  const state = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    progressTransition: getComputedStyle(document.querySelector(".study-progress-value")!).transitionDuration,
    transforms: document.getAnimations().flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes()).filter((frame) => frame.transform && frame.transform !== "none")
  }));
  expect(state.scroll).toBe("auto");
  expect(state.progressTransition).toBe("0s");
  expect(state.transforms).toEqual([]);
});

test.describe("動效影格與錄影", () => {
test("按下與切題的中間影格保持可讀，連續操作不排隊", async ({ page }, testInfo) => {
  await openFixture(page);
  const choice = page.getByRole("button", { name: /選項甲/ });
  await choice.focus();
  await page.keyboard.down("Space");
  await expect.poll(() => choice.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await page.screenshot({ path: `evidence/motion/after-${testInfo.project.name}-keyboard-press.png` });
  await page.keyboard.up("Space");
  await page.getByRole("button", { name: "送出答案", exact: true }).click();
  await expect(page.getByText("答對", { exact: true })).toBeVisible();
  // Collect real frame intervals during navigation, after initial loading has settled.
  await page.evaluate(() => {
    const state = {
      frames: [] as number[], longTasks: [] as number[], started: performance.now(),
      longTaskSupported: PerformanceObserver.supportedEntryTypes.includes("longtask")
    };
    (window as unknown as { studyMotionPerf: typeof state }).studyMotionPerf = state;
    let previous = performance.now();
    function frame(now: number) {
      state.frames.push(now - previous);
      previous = now;
      if (now - state.started < 600) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (state.longTaskSupported) {
      const observer = new PerformanceObserver((list) => state.longTasks.push(...list.getEntries().map((entry) => entry.duration)));
      observer.observe({ type: "longtask", buffered: false });
      setTimeout(() => observer.disconnect(), 650);
    }
  });
  await page.getByRole("button", { name: "下一題", exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
  // Keep screenshot capture out of the performance sample: WebKit's screenshot
  // work itself can block a frame and should not be attributed to the interaction.
  await page.waitForFunction(() => performance.now() - (window as unknown as { studyMotionPerf: { started: number } }).studyMotionPerf.started > 650);
  const performanceSample = await page.evaluate(() => (window as unknown as { studyMotionPerf: { frames: number[]; longTasks: number[]; longTaskSupported: boolean } }).studyMotionPerf);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  const animation = await page.locator(".study-question").evaluate((element) => {
    const animations = element.getAnimations();
    for (const current of animations) { current.pause(); current.currentTime = 75; }
    return { count: animations.length, opacity: getComputedStyle(element).opacity, focused: document.activeElement?.tagName };
  });
  expect(animation.count).toBeLessThanOrEqual(1);
  expect(Number(animation.opacity)).toBeGreaterThanOrEqual(0.75);
  await page.screenshot({ path: `evidence/motion/after-${testInfo.project.name}-transition-mid.png` });
  await page.locator(".study-question").evaluate((element) => element.getAnimations().forEach((current) => current.play()));
  await expect(page.locator(".study-question")).toHaveCSS("opacity", "1");
  const metricsJson = JSON.stringify({ animation, ...performanceSample }, null, 2);
  await testInfo.attach("interaction-metrics", { body: metricsJson, contentType: "application/json" });
  await writeFile(`evidence/motion/after-${testInfo.project.name}-interaction.json`, metricsJson);
  await expect(page.locator(".study-question")).toHaveCount(1);
  const video = page.video();
  if (video) {
    await page.close();
    await video.saveAs(`evidence/motion/after-${testInfo.project.name}-interaction.webm`);
  }
});
});

// Deliverable recording: native viewport, real-time interactions, no paused animations.
// Brief holds give a viewer time to read; correctness still uses explicit assertions.
test("自然速度互動示範：作答、長解析、收合與切題", async ({ browser }, testInfo) => {
  const device = testInfo.project.use;
  const viewport = device.viewport!;
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3004", viewport,
    userAgent: device.userAgent, isMobile: device.isMobile, hasTouch: device.hasTouch,
    deviceScaleFactor: 1, serviceWorkers: "block",
    recordVideo: { dir: testInfo.outputPath("demo"), size: viewport }
  });
  const page = await context.newPage();
  try {
    await openFixture(page);
    await page.waitForTimeout(900);
    const choice = page.getByRole("button", { name: /選項甲/ });
    await choice.focus();
    await page.keyboard.down("Space");
    await page.waitForTimeout(220);
    await page.keyboard.up("Space");
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: "送出答案", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("答對", { exact: true })).toBeVisible();
    await page.waitForTimeout(900);
    const trigger = page.getByRole("button", { name: "陽明", exact: true });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    const before = await trigger.boundingBox();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("region", { name: "陽明詳解", exact: true });
    await expect(panel).toContainText("閱讀定位段落 12");
    await expect(trigger).toBeFocused();
    const after = await trigger.boundingBox();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(3);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `evidence/motion/demo-${testInfo.project.name}-explanation.png` });
    await page.keyboard.press("Enter");
    await expect(panel).toHaveCount(0);
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: "下一題", exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
    await page.waitForTimeout(850);
    await answer(page, "乙");
    await page.waitForTimeout(900);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(90);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("動效驗收第 2 題：請選擇選項甲。", { exact: true })).toBeVisible();
    await page.waitForTimeout(850);
    await page.screenshot({ path: `evidence/motion/demo-${testInfo.project.name}-feedback.png` });
  } finally {
    const video = page.video();
    await context.close();
    await video?.saveAs(`evidence/motion/demo-${testInfo.project.name}.webm`);
  }
});
