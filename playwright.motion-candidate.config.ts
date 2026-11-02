import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/site-motion", workers: 1, retries: 0, timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [["line"], ["json", { outputFile: "evidence/site-motion/results.json" }]],
  use: { baseURL: "http://127.0.0.1:3197", channel: "chrome", serviceWorkers: "block", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
});
