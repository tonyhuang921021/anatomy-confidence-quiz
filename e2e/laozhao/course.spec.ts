import { expect, test, type Page } from "@playwright/test";
import manifest from "../../data/laozhao/courseManifest.generated.json";
import previewManifest from "../../data/laozhao/previewContent.generated.json";
import { buildCaptionSentences } from "../../lib/laozhao/preview/captionSentences";

const [firstVideo, secondVideo] = manifest.videos;
const firstVideoPreview = previewManifest.videos.find((video) => video.videoId === firstVideo.id);
const firstVideoCaptionSentences = buildCaptionSentences(firstVideoPreview?.captions ?? []);
const firstVideoLectureNotes = (firstVideoPreview as unknown as {
  lectureNotes?: { blocks: readonly { provenance: "teacher" | "supplement" }[] };
} | undefined)?.lectureNotes;

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
  expect(firstVideoPreview).toBeTruthy();
  await mockYouTube(page);
});

test("第一支 Preview 有 24 章、同步字幕、板書與對照筆記", async ({ page }) => {
  const targetChapter = firstVideoPreview?.chapters[13];
  expect(targetChapter).toBeTruthy();
  await page.goto(
    `/courses/laozhao-anatomy/watch/${firstVideo.id}?t=${targetChapter?.startSec}&chapter=${targetChapter?.id}`
  );

  await expect(page.getByText("24 章", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: targetChapter?.title ?? "" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "板書與對照筆記" })).toBeVisible();
  const boardButton = page.getByRole("button", { name: new RegExp(`${targetChapter?.title}板書`) }).first();
  await expect(boardButton).toBeVisible();
  await boardButton.scrollIntoViewIfNeeded();
  await expect(boardButton.locator("img")).toHaveJSProperty("complete", true);
  await boardButton.click();
  const selectedTime = await page.evaluate(() => (
    window as typeof window & { __laozhaoFakePlayer?: { currentTime: number } }
  ).__laozhaoFakePlayer?.currentTime);
  expect(selectedTime).toBe(targetChapter?.boardFrames[0].timeSec);
  const referenceNote = targetChapter?.referenceNotes[0];
  const materialPair = page.locator("[data-material-pair]").first();
  await expect(materialPair.locator('[data-material-kind="board"]')).toBeVisible();
  await expect(materialPair.getByRole("link", {
    name: `放大查看${referenceNote?.sourceTitle}第 ${referenceNote?.pdfPage} 頁`
  })).toBeVisible();
  const iframe = page.locator('iframe[src*="youtube.com/embed/"]');
  await expect(iframe).toHaveAttribute("src", /cc_load_policy=0/);
  await expect(iframe).toHaveAttribute("src", /fs=0/);
  if ((page.viewportSize()?.width ?? 0) <= 400) {
    const panelBox = await page.locator('[data-side-panel-scroll="navigation"]').boundingBox();
    expect(panelBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(480);
  }
  await page.getByRole("tab", { name: "字幕", exact: true }).click();
  await expect(page.getByText(`${firstVideoCaptionSentences.length} 句`, { exact: true }).first()).toBeVisible();
  const renderedCues = page.locator('ol[aria-label$="字幕列表"] > li');
  expect(await renderedCues.count()).toBeLessThanOrEqual(50);
  await page.getByRole("tab", { name: "列點講義" }).click();
  if (firstVideoLectureNotes) {
    await expect(page.locator("[data-lecture-chapter]")).toHaveCount(firstVideoPreview?.chapters.length ?? 0);
    await expect(page.locator("[data-lecture-chapter]").first().getByRole("heading", { level: 2 })).toContainText("1.");
    await expect(page.locator("[data-lecture-chapter]").first().getByRole("heading", { level: 3 }).first()).toContainText("一、");
    await expect(page.locator('[data-lecture-provenance="teacher"]').first()).toBeVisible();
    const supplementCount = firstVideoLectureNotes.blocks.filter((block) => block.provenance === "supplement").length;
    await expect(page.locator('[data-lecture-provenance="supplement"]')).toHaveCount(supplementCount);
    if ((page.viewportSize()?.width ?? 0) <= 400) {
      const twoColumnTable = page.locator('[data-lecture-table-columns="2"]').first();
      const tableMetrics = await twoColumnTable.evaluate((figure) => {
        const viewport = figure.querySelector("div");
        const table = figure.querySelector("table");
        return {
          viewportWidth: viewport?.clientWidth ?? 0,
          tableWidth: table?.scrollWidth ?? Number.POSITIVE_INFINITY
        };
      });
      expect(tableMetrics.tableWidth).toBeLessThanOrEqual(tableMetrics.viewportWidth + 1);
    }
  } else {
    await expect(
      page.locator('[data-side-panel-scroll="lecture-notes"]').getByText("列點講義待校訂", { exact: true })
    ).toBeVisible();
  }
  const lectureWorkspace = page.locator('[data-watch-layout="lectureNotes"]');
  await lectureWorkspace.evaluate((element) => element.scrollIntoView({ block: "start" }));
  const playerBox = await page.locator('section[aria-label="影片播放器"]').boundingBox();
  const lectureBox = await page.locator('[data-side-panel-scroll="lecture-notes"]').boundingBox();
  expect(playerBox).not.toBeNull();
  expect(lectureBox).not.toBeNull();
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    expect(playerBox?.width ?? 0).toBeGreaterThan(700);
    expect(lectureBox?.width ?? 0).toBeGreaterThan(400);
    expect(lectureBox?.x ?? 0).toBeGreaterThan((playerBox?.x ?? 0) + (playerBox?.width ?? 0));
    expect(lectureBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan((playerBox?.y ?? 0) + (playerBox?.height ?? 0));
  } else {
    expect(playerBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(8);
    expect(lectureBox?.y ?? 0).toBeGreaterThan((playerBox?.y ?? 0) + (playerBox?.height ?? 0));
    expect((lectureBox?.y ?? 0) + (lectureBox?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  }
  await expectNoHorizontalOverflow(page);
});

test("影片與字幕會一起進入全螢幕，Safari 不支援時使用滿版模式", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(HTMLElement.prototype, "webkitRequestFullscreen", {
      configurable: true,
      value: undefined
    });
  });
  const caption = firstVideoCaptionSentences.find((sentence) => sentence.sourceCueIds.length > 1);
  expect(caption).toBeTruthy();
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}?t=${(caption?.startSec ?? 30) + 0.1}`);
  const enterButton = page.getByRole("button", { name: "影片與字幕全螢幕" });
  await expect(enterButton).toBeVisible();
  await enterButton.click();

  const fullscreenFrame = page.locator('[data-fullscreen-active="true"]');
  await expect(fullscreenFrame).toBeVisible();
  const captionOverlay = fullscreenFrame.locator('[data-caption-overlay="true"]');
  await expect(captionOverlay).toBeVisible();
  await expect(captionOverlay).toHaveText(caption?.text ?? "");
  const frameBox = await fullscreenFrame.boundingBox();
  const captionBox = await captionOverlay.boundingBox();
  const viewport = page.viewportSize();
  expect(frameBox?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 1);
  expect(frameBox?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 1);
  expect(
    (frameBox?.y ?? 0) + (frameBox?.height ?? 0) - ((captionBox?.y ?? 0) + (captionBox?.height ?? 0))
  ).toBeGreaterThanOrEqual(90);

  await page.getByRole("button", { name: "離開影片與字幕全螢幕" }).click();
  await expect(page.locator('[data-fullscreen-active="true"]')).toHaveCount(0);
});

test("桌機原生全螢幕仍保留網站字幕", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "原生 Fullscreen API 由桌機 Chromium 驗證");
  const caption = firstVideoPreview?.captions[0];
  expect(caption).toBeTruthy();
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}?t=${caption?.startSec ?? 30}`);
  await page.getByRole("button", { name: "影片與字幕全螢幕" }).click();

  const fullscreenFrame = page.locator('[data-fullscreen-active="true"]');
  await expect(fullscreenFrame).toBeVisible();
  const captionOverlay = fullscreenFrame.locator('[data-caption-overlay="true"]');
  await expect(captionOverlay).toBeVisible();
  const frameBox = await fullscreenFrame.boundingBox();
  const captionBox = await captionOverlay.boundingBox();
  expect(
    (frameBox?.y ?? 0) + (frameBox?.height ?? 0) - ((captionBox?.y ?? 0) + (captionBox?.height ?? 0))
  ).toBeGreaterThanOrEqual(90);
  await expect.poll(() => page.evaluate(() => (
    document.fullscreenElement?.getAttribute("data-fullscreen-active") ?? null
  ))).toBe("true");

  await page.getByRole("button", { name: "離開影片與字幕全螢幕" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test("完整圖像總覽按章節一次列出全部板書與筆記", async ({ page }) => {
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}/materials`);
  await expect(page.getByRole("heading", { name: "板書與對照筆記", level: 1 })).toBeVisible();
  await expect(page.getByText("19 個章節・22 組板書對照・7 頁筆記", { exact: true })).toBeVisible();
  await expect(page.locator("[data-material-pair]")).toHaveCount(22);
  const allPairsAreComplete = await page.locator("[data-material-pair]").evaluateAll((pairs) => pairs.every((pair) => (
    Boolean(pair.querySelector('[data-material-kind="board"] img')) &&
    Boolean(pair.querySelector('[data-material-kind="note"] img'))
  )));
  expect(allPairsAreComplete).toBe(true);
  await expect(page.getByRole("heading", { name: firstVideoPreview?.chapters[2].title ?? "" })).toBeVisible();
  await expect(page.getByRole("link", { name: /回到影片/ }).first()).toBeVisible();
  const firstBoard = firstVideoPreview?.chapters.flatMap((chapter) => chapter.boardFrames)[0];
  expect(firstBoard).toBeTruthy();
  const firstBoardImage = page.getByRole("img", { name: firstBoard?.alt ?? "" }).first();
  await firstBoardImage.scrollIntoViewIfNeeded();
  await expect(firstBoardImage).toHaveJSProperty("complete", true);
  await expectNoHorizontalOverflow(page);
});

test("章節點選會更新 deep link，重新整理後仍停在同章", async ({ page }) => {
  const targetChapter = firstVideoPreview?.chapters[19];
  expect(targetChapter).toBeTruthy();
  await page.goto(`/courses/laozhao-anatomy/watch/${firstVideo.id}`);
  await page.getByRole("button", { name: new RegExp(targetChapter?.title ?? "") }).click();
  await expect(page).toHaveURL(new RegExp(`chapter=${encodeURIComponent(targetChapter?.id ?? "")}`));
  await page.reload();
  await expect(page.getByRole("heading", { name: targetChapter?.title ?? "" })).toBeVisible();
  await expect(page.locator('iframe[src*="youtube.com/embed/"]')).toHaveAttribute(
    "src",
    new RegExp(`start=${Math.floor(targetChapter?.startSec ?? 0)}`)
  );
  await expectNoHorizontalOverflow(page);
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
  await page.request.get("/");
  await page.waitForLoadState("networkidle");
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
