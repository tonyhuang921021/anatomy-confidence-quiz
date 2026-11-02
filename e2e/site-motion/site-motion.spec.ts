import { test, expect, type Page } from "@playwright/test";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const evidence = "evidence/site-motion";
mkdirSync(evidence, { recursive: true });
const routes = function scan(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? scan(file) : entry.name === "page.tsx" ? ["/" + path.relative("app", directory).replaceAll(path.sep, "/")] : [];
  });
}("app");
const publicRoutes = routes.filter(route => !route.includes("["));
writeFileSync(`${evidence}/route-inventory.json`, JSON.stringify({ routes, publicRoutes }, null, 2));

async function isolate(page: Page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:3197") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {
      ok: true, stats: [], overrides: {}, count: 0, cards: [], reactions: [],
      items: [], messages: [], hasMore: false, candidates: [], jobs: [], unplanned: []
    } });
    return route.continue();
  });
}

test("every concrete route shares motion without layout overflow", async ({page}, info) => {
  test.setTimeout(240_000); await isolate(page);
  const errors: string[] = [];
  const dynamicSamples = ["/notes/motion-local-fixture", "/notes/subject/解剖學", "/resources/motion-local-fixture"];
  const visited: {route:string;resolved:string}[] = [];
  for (const route of [...publicRoutes, ...dynamicSamples]) {
    // A redirect from one screen must not abort the next screen's navigation.
    const screen = await page.context().newPage(); await isolate(screen);
    screen.on("pageerror", error => errors.push(`${route}: ${error.message}`));
    try {
      await screen.goto(route, { waitUntil: "domcontentloaded" });
      await expect(screen.locator(".app-frame.site-motion")).toBeVisible();
      await expect(screen.locator(".app-topbar")).toHaveAttribute("data-shell-ready", "true");
      await expect(screen.locator("body")).not.toContainText("Application error");
      expect(await screen.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
      visited.push({route, resolved: new URL(screen.url()).pathname});
      if (["/", "/settings", "/feedback", "/search", "/owner/figure-review"].includes(route)) {
        await screen.screenshot({ path: `${evidence}/${info.project.name}${route.replaceAll("/", "_") || "home"}.png` });
      }
    } finally { await screen.close(); }
  }
  writeFileSync(`${evidence}/routes-${info.project.name}.json`, JSON.stringify(visited,null,2));
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`presence retarget, immediate inert and focus${reduced ? " reduced" : ""}`, async ({page}, info) => {
  await isolate(page); await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto("/");
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready", "true");
  const resume = page.locator(".home-continue-button");
  await resume.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "可繼續的測驗" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "關閉可繼續測驗" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(resume).toBeFocused();
  await expect(dialog).toHaveCount(0); // aria-hidden immediately, even while its pixels leave
  await expect(page.locator("[data-motion-state=closed]")).toHaveJSProperty("inert", true);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  expect(await page.locator(".home-resume-overlay").count()).toBe(1);
  await page.screenshot({ path: `${evidence}/${info.project.name}-dialog${reduced ? "-reduced" : ""}.png` });
  if (reduced) {
    const movement = await dialog.evaluate(el => [...el.getAnimations({subtree:true})].flatMap(a =>
      (a.effect as KeyframeEffect).getKeyframes()).filter(frame =>
        (frame.transform && frame.transform !== "none") || (frame.translate && frame.translate !== "none")));
    expect(movement).toEqual([]);
  }
  await page.keyboard.press("Escape");
  const nav = page.getByRole("button", { name: "開啟導覽", exact: true });
  await nav.click();
  const drawer = page.getByRole("dialog", { name: "主要導覽" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape"); await expect(nav).toBeFocused();
  await nav.click(); await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "更多", exact: true }).click();
  await drawer.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "帳號與設定" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nav).toBeFocused();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("keyboard press composes with positioning, navigation and back", async ({page}) => {
  await isolate(page); await page.goto("/");
  const start = page.getByRole("link", { name: "散題練習", exact: true });
  await start.focus();
  const before = await start.boundingBox();
  await page.keyboard.down("Enter"); await page.keyboard.up("Enter");
  await expect(page).toHaveURL(/\/start$/);
  await page.goBack(); await expect(start).toBeVisible();
  expect((await start.boundingBox())?.width).toBeCloseTo(before!.width, 0);
});

test("loading loops pause offscreen and resume", async ({page}) => {
  await isolate(page); await page.goto("/");
  // Neutral fixture to exercise the shared runtime independently of API timing.
  await page.evaluate(() => {
    const node=document.createElement("div"); node.dataset.motionLoop="";
    node.setAttribute("aria-busy", "true"); node.textContent="本機讀取測試";
    node.id="motion-loading-fixture"; node.style.cssText="position:absolute;top:20000px;animation:home-loading-pulse 1s infinite";
    document.body.append(node);
  });
  const loop=page.locator("#motion-loading-fixture");
  await expect(loop).toHaveAttribute("data-motion-paused", "true");
  await expect.poll(()=>loop.evaluate(el=>getComputedStyle(el).animationPlayState)).toBe("paused");
  await loop.evaluate(el=>{(el as HTMLElement).style.top="20px";});
  await expect(loop).toHaveAttribute("data-motion-paused", "false");
  await loop.evaluate(el=>el.remove());
});

test("press middle frame preserves layout and visible focus", async ({page}, info) => {
  await isolate(page); await page.goto("/");
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready", "true");
  const button=page.locator(".home-continue-button"); await button.focus();
  const width=await button.evaluate(el=>(el as HTMLElement).offsetWidth);
  await page.keyboard.down("Space");
  await expect.poll(()=>button.evaluate(el=>Number(getComputedStyle(el).scale))).toBeLessThan(1);
  expect(await button.evaluate(el=>(el as HTMLElement).offsetWidth)).toBe(width);
  expect(await button.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.screenshot({path:`${evidence}/${info.project.name}-press-mid.png`});
  await page.keyboard.up("Space");
  await expect(page.getByRole("dialog",{name:"可繼續的測驗"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

test("reviewed image expands and closes without clipping or focus loss", async ({page}, info) => {
  await isolate(page);
  await page.goto("/search?query=MOEX-112100-1301-Q001",{waitUntil:"networkidle"});
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready","true");
  const card=page.locator("article.search-result-card").first(); await expect(card).toBeVisible();
  const disclosure=card.locator('button[aria-controls^="search-result-details-"]');
  await disclosure.click(); await expect(disclosure).toHaveAttribute("aria-expanded","true");
  const reveal=card.getByRole("button",{name:"顯示答案與詳解",exact:true});
  if (await reveal.count()) await reveal.click();
  const reader=card.getByRole("region",{name:"已核對圖文詳解"});
  await expect(reader).toBeVisible();
  await reader.getByRole("button",{name:"詳解",exact:true}).click();
  const image=reader.locator('img[data-reviewed-zoom="true"]').first();
  await expect(image).toHaveAttribute("role","button");
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await image.focus(); await page.keyboard.press("Enter");
  await expect(image).toHaveAttribute("aria-expanded","true"); await expect(image).toBeFocused();
  const geometry=await image.evaluate(el=>{const image=el as HTMLImageElement;const frame=el.closest(".reviewed-image-frame")!;return {image:image.getBoundingClientRect().height,frame:frame.getBoundingClientRect().height};});
  expect(geometry.image).toBeLessThanOrEqual(geometry.frame+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`${evidence}/${info.project.name}-reviewed-image.png`});
  await page.keyboard.press("Enter");
  await expect(image).toHaveAttribute("aria-expanded","false"); await expect(image).toBeFocused();
});

test("search pagination updates immediately and preserves result heading focus", async ({page},info) => {
  await isolate(page); await page.goto("/search",{waitUntil:"networkidle"});
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready","true");
  await page.getByRole("button",{name:"瀏覽全部題目",exact:true}).click();
  const heading=page.locator("#question-search-results-heading");
  await expect(heading).toContainText("第 1 /");
  const next=page.getByRole("button",{name:"下一頁",exact:true}).first();
  const background=await next.evaluate(el=>getComputedStyle(el).backgroundColor); await next.click();
  await expect(heading).toContainText("第 2 /"); await expect(heading).toBeFocused();
  const opacity=await page.locator(".search-results-list").evaluate(el=>Number(getComputedStyle(el).opacity));
  expect(opacity).toBeGreaterThanOrEqual(.75);
  if(info.project.name==="mobile") expect(await next.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(background);
});

test("dark reading appearance remains intact", async ({page},info) => {
  await isolate(page);
  await page.addInitScript(()=>localStorage.setItem("anatomy-confidence-theme-mode:guest","dark"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(page.locator(".app-topbar")).toHaveAttribute("data-shell-ready","true");
  await page.locator(".home-continue-button").click();
  await expect(page.getByRole("dialog",{name:"可繼續的測驗"})).toBeVisible();
  await page.screenshot({path:`${evidence}/${info.project.name}-dark.png`});
});
