import { expect, test } from "@playwright/test";

test("手機 Web Push 的 Service Worker 可以安裝並持續控制網站", async ({ page }) => {
  await page.route("https://e2e.invalid/**", (route) => route.abort());
  await page.goto("/start", { waitUntil: "domcontentloaded" });

  await expect.poll(async () =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      return registration?.active?.scriptURL ?? registration?.installing?.scriptURL ?? "";
    })
  ).toContain("/sw.js");

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const payload = await manifest.json() as {
    display?: string;
    icons?: Array<{ src?: string; sizes?: string }>;
  };
  expect(payload.display).toBe("standalone");
  expect(payload.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "/icon-512.png", sizes: "512x512" })
  ]));
});
