import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

type MockFeedbackMessage = {
  id: string;
  content: string;
  parentId?: string;
  isAnonymous: boolean;
  createdAt: string;
  likeCount: number;
  dislikeCount: number;
  replies?: MockFeedbackMessage[];
};

function mockFeedbackRoot(id: number, replyCount = 0): MockFeedbackMessage {
  return {
    id: String(id),
    content: `root-${id}`,
    isAnonymous: true,
    createdAt: `2026-08-25T00:00:${String(id).padStart(2, "0")}.000Z`,
    likeCount: 0,
    dislikeCount: 0,
    replies: Array.from({ length: replyCount }, (_, index) => ({
      id: String(id * 100 + index + 1),
      content: `reply-${id}-${index + 1}`,
      parentId: String(id),
      isAnonymous: true,
      createdAt: `2026-08-25T01:${String(index).padStart(2, "0")}:00.000Z`,
      likeCount: 0,
      dislikeCount: 0
    }))
  };
}

async function installManualPaginationObserver(page: Page) {
  await page.addInitScript(() => {
    class ManualPaginationObserver {
      private readonly callback: IntersectionObserverCallback;
      private readonly options?: IntersectionObserverInit;

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = callback;
        this.options = options;
      }

      observe(target: Element) {
        if (this.options?.root) return;
        window.setTimeout(() => {
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        }, 0);
      }

      disconnect() {}
      unobserve() {}
      takeRecords() { return [] as IntersectionObserverEntry[]; }
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      value: ManualPaginationObserver
    });
  });
}

async function mockQuietShellApis(page: Page) {
  await page.route("https://e2e.invalid/**", (route) => route.abort());
  await page.route((url) => url.pathname === "/api/openai-budget", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, budget: { enabled: false } })
    })
  );
  await page.route((url) => url.pathname === "/api/visitor-stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        stats: {
          totalVisitors: 0,
          onlineVisitors: 0,
          updatedAt: "2026-08-25T00:00:00.000Z"
        }
      })
    })
  );
}

async function openFeedbackBoard(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const feedbackSection = page.locator("#feedback");
  await feedbackSection.scrollIntoViewIfNeeded();
  await expect(feedbackSection.locator(".feedback-board")).toBeVisible();
  return feedbackSection;
}

test("留言以十個主串分頁，完整回覆不占額度且 Safari 仍可手動載入", async ({ page }) => {
  await mockQuietShellApis(page);
  await installManualPaginationObserver(page);
  const firstPage = Array.from({ length: 10 }, (_, index) =>
    mockFeedbackRoot(30 - index, index === 0 ? 12 : 0)
  );
  const secondPage = Array.from({ length: 10 }, (_, index) => mockFeedbackRoot(20 - index));
  const requestedCursors: Array<string | null> = [];
  const requestedLimits: Array<string | null> = [];

  await page.route((url) => url.pathname === "/api/feedback", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const searchParams = new URL(route.request().url()).searchParams;
    const cursor = searchParams.get("cursor");
    requestedCursors.push(cursor);
    requestedLimits.push(searchParams.get("limit"));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        messages: cursor ? secondPage : firstPage,
        nextCursor: cursor ? null : "21",
        hasMore: !cursor,
        updatedAt: "2026-08-25T02:00:00.000Z"
      })
    });
  });

  const feedbackSection = await openFeedbackBoard(page);
  const roots = feedbackSection.locator(".feedback-thread > article.feedback-entry");
  await expect(roots).toHaveCount(10);
  await expect(roots.first().locator(".feedback-reply")).toHaveCount(12);
  await expect(feedbackSection.getByText("10 串", { exact: true })).toBeVisible();
  expect(requestedLimits).toContain("10");

  const loadOlder = feedbackSection.getByRole("button", { name: "載入較早留言" });
  await expect(loadOlder).toBeVisible();
  await loadOlder.click();

  await expect.poll(() => requestedCursors).toContain("21");
  await expect(roots).toHaveCount(20);
  await expect(feedbackSection.getByText("已載入 10 則較早留言。", { exact: true })).toBeAttached();
  await expect(feedbackSection.getByText("root-30", { exact: true })).toHaveCount(1);
  await expect(feedbackSection.getByText("root-20", { exact: true })).toHaveCount(1);
  await expect(feedbackSection.getByText("root-11", { exact: true })).toHaveCount(1);
  await expect(loadOlder).toHaveCount(0);
});

test("較慢的首頁讀取不會蓋掉剛送出的留言", async ({ page }) => {
  await mockQuietShellApis(page);
  await installManualPaginationObserver(page);
  let postCount = 0;
  let releaseInitialRead: (() => void) | undefined;
  const initialReadGate = new Promise<void>((resolve) => {
    releaseInitialRead = resolve;
  });

  await page.route((url) => url.pathname === "/api/feedback", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          message: { ...mockFeedbackRoot(51), content: "剛送出的留言" }
        })
      });
      return;
    }

    await initialReadGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        messages: [mockFeedbackRoot(50)],
        nextCursor: null,
        hasMore: false
      })
    });
  });

  const feedbackSection = await openFeedbackBoard(page);
  await feedbackSection.locator("textarea").first().fill("剛送出的留言");
  const postResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/feedback") && response.request().method() === "POST"
  );
  await feedbackSection.getByRole("button", { name: "送出留言" }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await postResponse;
  expect(postCount).toBe(1);
  await expect(feedbackSection.getByText("剛送出的留言", { exact: true })).toBeVisible();

  releaseInitialRead?.();
  await page.waitForTimeout(300);
  await expect(feedbackSection.getByText("剛送出的留言", { exact: true })).toBeVisible();
});

test("站長通知鈴鐺收進設定且只計外部新動態", async ({ page, browserName }) => {
  await mockQuietShellApis(page);
  if (browserName === "webkit") {
    await page.addInitScript(() => {
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: class MockPushManager {}
      });
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: { permission: "default" }
      });
    });
  }
  await page.addInitScript(() => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const session = {
      access_token: "owner-access-token",
      refresh_token: "owner-refresh-token",
      expires_in: 3600,
      expires_at: nowSeconds + 3600,
      token_type: "bearer",
      user: {
        id: "owner-user",
        email: "e2e-owner@example.test",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: { display_name: "站長" },
        created_at: "2026-08-25T00:00:00.000Z"
      }
    };
    window.localStorage.setItem("medQuizAuthSessionSnapshot", JSON.stringify(session));
    window.localStorage.setItem("medQuizAutomaticCloudSync:owner-user", String(Date.now()));
    window.localStorage.setItem("quiz-visitor-presence-last-sent:owner-user", String(Date.now()));
    window.localStorage.setItem(
      "feedbackActivity:v1:owner-user",
      JSON.stringify({ cursor: "100", readCursor: "100", activities: [] })
    );
  });

  const requestedAfter: Array<string | null> = [];
  const requestedLimits: Array<string | null> = [];
  const authorizationHeaders: Array<string | undefined> = [];
  await page.route((url) => url.pathname === "/api/feedback/activity", async (route) => {
    const searchParams = new URL(route.request().url()).searchParams;
    const after = searchParams.get("after");
    requestedAfter.push(after);
    requestedLimits.push(searchParams.get("limit"));
    authorizationHeaders.push(route.request().headers().authorization);
    const activities = [
      {
        id: "101",
        type: "root",
        content: "第一則外部留言",
        displayName: "讀者甲",
        isAnonymous: false,
        isOwn: false,
        createdAt: "2026-08-25T03:01:00.000Z"
      },
      {
        id: "102",
        type: "reply",
        content: "第二則外部回覆",
        parentId: "90",
        isAnonymous: true,
        isOwn: false,
        createdAt: "2026-08-25T03:02:00.000Z"
      },
      {
        id: "103",
        type: "root",
        content: "站長自己的留言",
        isAnonymous: true,
        isOwn: true,
        createdAt: "2026-08-25T03:03:00.000Z"
      }
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        authorized: true,
        activities,
        nextCursor: "103",
        hasMore: false
      })
    });
  });

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-topbar .app-feedback-notification-trigger")).toHaveCount(0);
  const unreadBell = page.getByRole("button", { name: "留言通知，2 則未讀" });
  await expect(unreadBell).toBeVisible();
  await expect.poll(() => requestedAfter).toContain("100");
  expect(requestedLimits).toContain("20");
  expect(authorizationHeaders).toContain("Bearer owner-access-token");

  await unreadBell.click();
  const panel = page.locator("#app-feedback-notification-popover");
  await expect(panel.getByText("第一則外部留言", { exact: true })).toBeVisible();
  await expect(panel.getByText("第二則外部回覆", { exact: true })).toBeVisible();
  await expect(panel.getByText("第一則外部留言", { exact: true })).toHaveCount(1);
  await expect(panel.getByText("第二則外部回覆", { exact: true })).toHaveCount(1);
  await expect(panel.getByText("站長自己的留言", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "手機通知" })).toBeVisible();
  await expect(page.getByRole("button", { name: "留言通知，0 則未讀" })).toBeVisible();

  await page.getByRole("button", { name: "留言通知，0 則未讀" }).click();
  const callsBeforeReplay = requestedAfter.length;
  await page.evaluate(() => window.dispatchEvent(new Event("feedback-activity-refresh")));
  await expect.poll(() => requestedAfter.length).toBeGreaterThan(callsBeforeReplay);
  await expect(page.getByRole("button", { name: "留言通知，0 則未讀" })).toBeVisible();
  await expect(requestedAfter).toContain("103");
});
