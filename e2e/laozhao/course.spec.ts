import { expect, test, type Page } from "@playwright/test";
import manifest from "../../data/laozhao/courseManifest.generated.json";

const [firstVideo, secondVideo] = manifest.videos;

const fakeYouTubeApi = `
(() => {
  class FakePlayer {
    constructor(element, options) {
      this.events = options.events;
      this.currentTime = Number(options.playerVars.start || 0);
      this.duration = 7200;
      this.state = 2;
      this.iframe = document.createElement("iframe");
      const params = new URLSearchParams();
      Object.entries(options.playerVars).forEach(([key, value]) => params.set(key, String(value)));
      this.iframe.src = "https://www.youtube.com/embed/" + options.videoId + "?" + params.toString();
      this.iframe.title = options.videoId;
      element.appendChild(this.iframe);
      window.__laozhaoFakePlayer = this;
      window.setTimeout(() => options.events.onReady({ target: this }), 0);
    }
    destroy() { this.iframe.remove(); }
    getCurrentTime() { return this.currentTime; }
    getDuration() { return this.duration; }
    getIframe() { return this.iframe; }
    getPlayerState() { return this.state; }
    seekTo(seconds) { this.currentTime = Number(seconds) || 0; }
    setCurrentTime(seconds) { this.currentTime = Number(seconds) || 0; }
    play() {
      this.state = 1;
      this.events.onStateChange({ target: this, data: 1 });
    }
  }
  window.YT = { Player: FakePlayer };
  window.onYouTubeIframeAPIReady?.();
})();
`;

async function mockYouTube(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
    contentType: "application/javascript",
    body: fakeYouTubeApi
  }));
  await page.route("https://www.youtube.com/embed/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Mock YouTube player</title>"
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

test.beforeEach(async ({ page }) => {
  expect(firstVideo).toBeTruthy();
  expect(secondVideo).toBeTruthy();
  await mockYouTube(page);
});

test("完整清單可搜尋，課程頁不會呼叫網站 API", async ({ page }) => {
  expect(manifest.videos).toHaveLength(30);
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });

  await page.goto("/courses/laozhao-anatomy");
  await expect(page.getByRole("heading", { name: "老趙解剖學" })).toBeVisible();
  await expect(page.getByText("30 部影片", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜尋影片或已審核章節" }).fill(secondVideo.title);
  await expect(page.getByRole("link", { name: new RegExp(secondVideo.title) })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(apiRequests).toEqual([]);
});

test("跨影片不沿用前一支時間，且始終只有一個播放器", async ({ page }) => {
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}?t=45`);
  const firstIframe = page.locator('iframe[src*="youtube.com/embed/"]');
  await expect(firstIframe).toHaveCount(1);
  await expect(firstIframe).toHaveAttribute("src", new RegExp(`${firstVideo.id}.*start=45`));
  await expect(firstIframe).toHaveAttribute("src", /autoplay=0/);

  await page.getByRole("link", { name: "下一支" }).click();
  await expect(page).toHaveURL(new RegExp(`/watch/${secondVideo.id}$`));
  const secondIframe = page.locator('iframe[src*="youtube.com/embed/"]');
  await expect(secondIframe).toHaveCount(1);
  await expect(secondIframe).toHaveAttribute("src", new RegExp(secondVideo.id));
  await expect(secondIframe).not.toHaveAttribute("src", /start=45/);

  await page.reload();
  await expect(page.locator('iframe[src*="youtube.com/embed/"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test("本機書籤重新整理後仍保留，回首頁會恢復原網站外殼", async ({ page }) => {
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}?t=45`);
  await expect(page.locator('iframe[src*="youtube.com/embed/"]')).toHaveCount(1);
  await page.getByRole("button", { name: "記下目前時間" }).click();
  await expect(page.getByRole("button", { name: /影片標記$/ }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /影片標記$/ }).first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /老趙解剖學影片/ }).first()).toBeVisible();
  await expect(page.locator('iframe[src*="youtube.com/embed/"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("Safari pagehide 會保存播放中位置，回到頁面只保留一個播放器", async ({ page }) => {
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}`);
  await expect(page.locator('iframe[src*="youtube.com/embed/"]')).toHaveCount(1);

  await page.evaluate(() => {
    const player = (window as typeof window & {
      __laozhaoFakePlayer?: { setCurrentTime: (seconds: number) => void; play: () => void };
    }).__laozhaoFakePlayer;
    player?.setCurrentTime(137);
    player?.play();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await page.waitForTimeout(150);
  await page.reload();

  const iframe = page.locator('iframe[src*="youtube.com/embed/"]');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", /start=137/);
});
