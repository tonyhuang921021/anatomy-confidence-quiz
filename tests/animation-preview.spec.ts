import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

for (const width of [320, 390, 1280]) {
  test(`cute status fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../preview/index.html")).href);
    await expect(page.getByRole("status")).toHaveCount(3);
    await expect(page.getByText("詳解生成中", { exact: true })).toHaveCount(2);
    await expect(page.getByText("詳解完成", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  });
}
test("reduced motion stops all decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(pathToFileURL(path.resolve(__dirname, "../preview/index.html")).href);
  const animationNames = await page.locator(".head,.tail,.page,.eyes,.sleep").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
  expect(animationNames.every((name) => name === "none")).toBe(true);
});
