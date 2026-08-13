import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/site-shell",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:3004",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "./node_modules/.bin/next start --hostname 127.0.0.1 --port 3004",
    url: "http://127.0.0.1:3004/",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 }
      }
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
