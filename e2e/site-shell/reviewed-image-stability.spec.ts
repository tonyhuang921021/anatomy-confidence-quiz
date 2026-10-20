import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
for (const failImages of [false, true]) {
  test(`舊作答結果的圖片${failImages ? "失敗" : "延遲載入"}不改變閱讀位置與紀錄`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("https://e2e.invalid/**", r => r.abort());
    await page.route("**/api/**", r => r.fulfill({ json: { ok:true, stats:[], overrides:{}, count:0, cards:[], reactions:[] } }));
    let release!: () => void;
    const imageGate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/reviewed-explanations/assets/**", async route => {
      await imageGate;
      if (failImages) await route.abort("failed");
      else await route.continue();
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem("reader-stability-seeded")) {
        localStorage.setItem("reader-stability-seeded", "1");
        localStorage.setItem("anatomy-confidence-active-user-id", "guest");
        localStorage.setItem("anatomy-confidence-completed-sessions:guest", JSON.stringify([{
          id: "reader-stability", subject: "醫學（一）", startedAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-01T01:00:00Z",
          settings: { mode: "random", questionCount: 1, subjectFilter: "全部" },
          questionOrder: ["MOEX-112100-1301-Q003"],
          attempts: [{ questionId: "MOEX-112100-1301-Q003", selectedAnswer: "A", correctAnswer: "C", isCorrect: false, confidence: 3, answeredAt: "2026-10-01T00:05:00Z" }]
        }]));
      }
    });
    await page.goto("/results?sessionId=reader-stability");
    const recordBefore = await page.evaluate(() => localStorage.getItem("anatomy-confidence-completed-sessions:guest"));
    const card = page.getByRole("region", { name: "題目回顧", exact: true }).locator('details[id^="review-all-"]').first();
    await card.locator("summary").click();
    const reader = card.locator(".reviewed-explanation");
    await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
    await reader.getByRole("button", { name: "詳解", exact: true }).click();
    const frame = reader.locator(".reviewed-image-frame").first();
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toHaveAttribute("data-image-state", "loading");
    await page.waitForTimeout(600); // End user-input exclusion window before measuring image shifts.
    await page.evaluate(() => {
      const win = window as typeof window & { imageCLS?: number; imageObserver?: PerformanceObserver };
      win.imageCLS = 0;
      if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
        win.imageObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) win.imageCLS! += (entry as PerformanceEntry & { value: number }).value;
        });
        win.imageObserver.observe({ type: "layout-shift" });
      }
    });
    const geometry = () => frame.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height, scrollY, documentHeight: document.documentElement.scrollHeight };
    });
    const before = await geometry();
    expect(before.height).toBeGreaterThan(30);
    release();
    await expect(frame).toHaveAttribute("data-image-state", failImages ? "error" : "ready");
    await page.waitForTimeout(250);
    const after = await geometry();
    for (const key of ["top", "height", "scrollY", "documentHeight"] as const) {
      expect(Math.abs(after[key] - before[key]), key).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => (window as typeof window & { imageCLS?: number }).imageCLS)).toBeLessThanOrEqual(0.001);
    expect(await page.evaluate(() => localStorage.getItem("anatomy-confidence-completed-sessions:guest"))).toBe(recordBefore);
    await page.screenshot({ path: `evidence/explanations/stable-${info.project.name}-${failImages ? "failed" : "delayed"}.png` });
    for (let i = 0; i < 2; i++) {
      await reader.getByRole("button", { name: "簡解", exact: true }).click();
      await expect(reader.locator('[data-reader-mode="short"]')).toBeVisible();
      await reader.getByRole("button", { name: "詳解", exact: true }).click();
      await expect(reader.locator('[data-reader-mode="detailed"]')).toBeVisible();
    }
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem("anatomy-confidence-completed-sessions:guest"))).toBe(recordBefore);
  });
}
