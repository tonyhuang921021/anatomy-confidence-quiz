import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const SCOPE_STORAGE_KEY = "pharmacology-review-scope-v1";
const STATS_STORAGE_KEY = "pharmacology-review-stats-v1";

async function blockExternalApis(page: Page) {
  await page.route("https://e2e.invalid/**", (route) => route.abort());
}

test("藥理複習可直接切換範圍並記住上次選擇", async ({ page }) => {
  await blockExternalApis(page);
  await page.goto("/pharmacology-review", { waitUntil: "domcontentloaded" });

  const scopeSelect = page.getByLabel("複習範圍");
  await expect(scopeSelect).toBeVisible();
  await expect(scopeSelect.locator("option")).toHaveCount(13);
  await expect(scopeSelect).toHaveValue("全部藥物");
  await expect(page.locator(".drug-flip-front")).toHaveCSS("opacity", "1");
  await expect(page.locator(".drug-flip-back")).toHaveCSS("opacity", "0");

  await scopeSelect.selectOption("腸胃道");
  await expect(scopeSelect).toHaveValue("腸胃道");
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), SCOPE_STORAGE_KEY)).toBe("腸胃道");

  await page.getByRole("button", { name: "翻轉藥理複習卡" }).click();
  await expect(page.locator(".drug-flip-card")).toHaveClass(/is-flipped/);
  await expect(page.locator(".drug-flip-front")).toHaveCSS("opacity", "0");
  await expect(page.locator(".drug-flip-back")).toHaveCSS("opacity", "1");
  const cardBackText = await page.locator(".drug-flip-back").innerText();
  expect(cardBackText).toMatch(/腸胃科|自泌素\/腸胃/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("複習範圍")).toHaveValue("腸胃道");
});

test("最不會的藥只顯示目前複習範圍", async ({ page }) => {
  await blockExternalApis(page);
  await page.addInitScript(
    ({ scopeKey, statsKey }) => {
      window.localStorage.setItem(scopeKey, "腸胃道");
      window.localStorage.setItem(statsKey, JSON.stringify({
        "Metronidazole__腸胃科 > H. pylori用藥": {
          known: 0,
          unknown: 4,
          seen: 4,
          lastSeenAt: 1,
          updatedAt: 1
        },
        "Amiodarone__心臟科 > 抗心律不整 > Class III": {
          known: 0,
          unknown: 8,
          seen: 8,
          lastSeenAt: 1,
          updatedAt: 1
        }
      }));
    },
    { scopeKey: SCOPE_STORAGE_KEY, statsKey: STATS_STORAGE_KEY }
  );

  await page.goto("/pharmacology-review", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "最不會的藥", exact: true }).click();

  const heading = page.getByRole("heading", { name: "腸胃道裡最不會的藥" });
  await expect(heading).toBeVisible();
  await expect(page.getByRole("button", { name: /^Metronidazole A / })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Amiodarone / })).toHaveCount(0);
});
