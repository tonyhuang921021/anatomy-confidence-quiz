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

test("藥理資料可搜尋、篩選、展開並核對來源", async ({ page }) => {
  await blockExternalApis(page);
  await page.goto("/pharmacology-review", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "查藥理資料" }).click();
  await expect(page).toHaveURL(/\/pharmacology-review\/library$/);

  const search = page.getByRole("searchbox", { name: "搜尋藥理資料" });
  await expect(search).toBeVisible();
  await search.fill("Amantadine");
  await expect(page.getByText(/\d+ 種藥/, { exact: true })).toBeVisible();

  const drugButton = page.getByRole("button", { name: /Amantadine/ });
  await expect(drugButton).toBeVisible();
  await drugButton.click();
  await expect(page.getByRole("heading", { name: "機轉", exact: true })).toBeVisible();
  await expect(page.getByText(/阻M2 ion channel/)).toBeVisible();
  const sourceLink = page.getByRole("link", { name: /查看資料來源/ }).first();
  await expect(sourceLink).toHaveAttribute("href", /^https:\/\//);

  await page.getByText("查看完整資料", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "機轉與藥效" })).toBeVisible();

  await page.getByLabel("複習範圍").selectOption("心臟");
  await expect(page.getByText("找不到符合的藥物")).toBeVisible();
});

test("藥理資料手機版不會出現水平裁切", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "僅檢查手機尺寸");
  await blockExternalApis(page);
  await page.goto("/pharmacology-review/library", { waitUntil: "domcontentloaded" });
  await page.getByRole("searchbox", { name: "搜尋藥理資料" }).fill("Amiodarone");
  await page.getByRole("button", { name: /Amiodarone/ }).click();
  await expect(page.getByRole("heading", { name: "副作用", exact: true })).toBeVisible();

  const widths = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.innerWidth + 1);
});
