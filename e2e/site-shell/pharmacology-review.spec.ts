import { expect, test, type Page } from "@playwright/test";
import type { PharmacologyLibraryIndex } from "@/lib/pharmacologyLibrary";

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
  await expect(page.getByRole("list", { name: "同分類藥物列表" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "同分類藥物" }).locator("xpath=..//table")).toHaveCount(0);
  const cardBackText = await page.locator(".drug-flip-back").innerText();
  expect(cardBackText).toMatch(/腸胃科|自泌素\/腸胃/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("複習範圍")).toHaveValue("腸胃道");
});

test("藥理資料先顯示考期，點開題目後仍先隱藏答案", async ({ page }) => {
  await blockExternalApis(page);
  await page.goto("/pharmacology-review/library", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("1007 種藥", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜尋藥理資料" }).fill("Phenobarbital");

  const drugButton = page.getByRole("button", { name: /Phenobarbital/ });
  await expect(drugButton).toContainText("107-1");
  await drugButton.click();

  const examButton = page.getByRole("button", { name: /107-1.*第 72 題.*曾出現/ });
  await expect(examButton).toBeVisible();
  await examButton.click();
  await expect(page.getByText("MOEX-107020-6301-Q072", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "顯示答案與詳解" })).toBeVisible();
  await expect(page.getByText(/正確答案：/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /官方答案/ })).toHaveCount(0);

  await page.getByRole("button", { name: "顯示答案與詳解" }).click();
  await expect(page.getByText(/正確答案：/)).toBeVisible();
  await expect(page.getByRole("link", { name: /官方答案/ })).toBeVisible();
});

test("藥理資料的舊格式考題 ID 也能開啟站內題目", async ({ page }) => {
  await blockExternalApis(page);
  await page.goto("/pharmacology-review/library", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("1007 種藥", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜尋藥理資料" }).fill("Ganciclovir");

  const drugButton = page.getByRole("button", { name: /Ganciclovir/ });
  await expect(drugButton).toContainText("110-2");
  await drugButton.click();
  await page.getByRole("button", { name: /110-2.*第 53 題.*考點/ }).click();

  await expect(page.getByText("MOEX-110101-2301-Q053", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "顯示答案與詳解" })).toBeVisible();
  await expect(page.getByText("站內暫時找不到這題，請稍後再試。")).toHaveCount(0);
});

test("藥理資料列出的每一題都能對應站內題庫", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "資料完整性只需執行一次");

  const indexResponse = await request.get("/data/pharmacology-library/index.json");
  expect(indexResponse.ok()).toBeTruthy();
  const index = (await indexResponse.json()) as PharmacologyLibraryIndex;
  const ids = [...new Set(index.drugs.flatMap((drug) => drug.exams.map((exam) => exam.id)))];

  for (let offset = 0; offset < ids.length; offset += 24) {
    const requestedIds = ids.slice(offset, offset + 24);
    const response = await request.get(
      `/api/pharmacology-review/questions?ids=${encodeURIComponent(requestedIds.join(","))}`
    );
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as { questions?: Array<{ id: string }> };
    const returnedIds = new Set(
      (payload.questions ?? []).map((question) =>
        question.id.replace(/^(MOEX-\d{6})_(\d{4}-Q\d{3})$/, "$1-$2")
      )
    );

    for (const id of requestedIds) expect(returnedIds.has(id), `站內找不到 ${id}`).toBeTruthy();
  }
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

  const mnemonicSection = page.getByRole("region", { name: "口訣", exact: true });
  if ((await mnemonicSection.count()) > 0) {
    await expect(mnemonicSection).not.toContainText(/取自|改自|來自/);
    await expect(mnemonicSection.getByRole("link")).toHaveCount(0);
  }

  await page.getByText("查看完整資料", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "機轉與藥效" })).toBeVisible();

  await page.getByLabel("複習範圍").selectOption("心臟");
  await expect(page.getByText("找不到符合的藥物")).toBeVisible();
});

test("藥理資料手機版不會出現水平裁切", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "僅檢查手機尺寸");
  await blockExternalApis(page);
  await page.goto("/pharmacology-review/library", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("1007 種藥", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜尋藥理資料" }).fill("Amiodarone");
  await page.getByRole("button", { name: /Amiodarone/ }).click();
  await expect(page.getByRole("heading", { name: "副作用", exact: true })).toBeVisible();
  const mnemonicSection = page.getByRole("region", { name: "口訣", exact: true });
  await expect(mnemonicSection).toBeVisible();
  await expect(mnemonicSection).not.toContainText(/取自|改自|來自/);
  await expect(mnemonicSection.getByRole("link")).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.innerWidth + 1);
});
