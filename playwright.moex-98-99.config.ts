import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/moex-98-99",
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "reports/moex-98-99/browser-results.json" }]],
  timeout: 180000,
  expect: { timeout: 30000 },
  use: { baseURL: "http://127.0.0.1:3098", serviceWorkers: "block", trace: "retain-on-failure", navigationTimeout: 120000 },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } }
  ]
});
