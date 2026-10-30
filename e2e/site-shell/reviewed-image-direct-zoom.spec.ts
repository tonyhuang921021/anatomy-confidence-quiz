import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

for (const markup of ["imported-figure", "bare-html", "linked-image"] as const) {
  test(`直接點圖片放大：${markup}`, async ({ page }, info) => {
    await page.route("https://e2e.invalid/**", r => r.abort());
    await page.route("**/api/**", r => r.fulfill({ json: { ok: true, stats: [], overrides: {}, count: 0, cards: [], reactions: [] } }));
    if (markup !== "imported-figure") {
      await page.route("**/reviewed-explanations/MOEX-112100-1301-Q001.json", async route => {
        const response = await route.fetch();
        const reader = await response.json();
        const image = reader.html.match(/<img\b[^>]*>/)?.[0];
        expect(image).toBeTruthy();
        reader.html = markup === "bare-html" ? `<p>${image}</p>` : `<a href="https://example.org/source">${image}</a>`;
        await route.fulfill({ json: reader });
      });
    }
    await page.addInitScript(() => {
      localStorage.setItem("anatomy-confidence-active-user-id", "guest");
      localStorage.setItem("anatomy-confidence-completed-sessions:guest", JSON.stringify([{
        id: "direct-image-zoom", subject: "醫學（一）", startedAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-01T01:00:00Z",
        settings: { mode: "random", questionCount: 1, subjectFilter: "全部" },
        questionOrder: ["MOEX-112100-1301-Q001"],
        attempts: [{ questionId: "MOEX-112100-1301-Q001", selectedAnswer: "A", correctAnswer: "C", isCorrect: false, confidence: 3, answeredAt: "2026-10-01T00:05:00Z" }]
      }]));
    });
    await page.goto("/results?sessionId=direct-image-zoom");
    const card = page.getByRole("region", { name: "題目回顧", exact: true }).locator('details[id^="review-all-"]').first();
    await card.locator("summary").click();
    const reader = card.locator(".reviewed-explanation");
    await reader.getByRole("button", { name: "詳解", exact: true }).click();
    const thumb = reader.locator(".reviewed-reader img").first();
    await expect(thumb).toHaveAttribute("role", "button");
    await thumb.scrollIntoViewIfNeeded();
    if (info.project.name.includes("mobile")) await thumb.tap(); else await thumb.click();
    const dialog = reader.locator("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("img")).toHaveJSProperty("complete", true);
    await expect.poll(() => dialog.locator("img").evaluate(image => {
      const bounds = image.getBoundingClientRect();
      return bounds.height > 0 && bounds.height <= innerHeight * .66 && bounds.width <= innerWidth;
    })).toBe(true);
    await page.screenshot({ path: `evidence/explanations/direct-${markup}-${info.project.name}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(thumb).toBeFocused();
    await thumb.press("Enter");
    await expect(dialog).toBeVisible();
    await page.mouse.click(1, 1);
    await expect(dialog).not.toBeVisible();
    await expect(thumb).toBeFocused();
    if (markup === "imported-figure") {
      await expect(reader.locator(".reviewed-image-link")).not.toBeVisible();
      const source = reader.getByRole("link", { name: "原圖及圖說", exact: true });
      await expect(source).toHaveAttribute("href", /pmc.ncbi.nlm.nih.gov/);
      // Prevent leaving the fixture, while still dispatching the real click through React.
      await source.evaluate(link => link.addEventListener("click", event => event.preventDefault(), { once: true }));
      await source.click();
      await expect(dialog).not.toBeVisible();
    }
  });
}
