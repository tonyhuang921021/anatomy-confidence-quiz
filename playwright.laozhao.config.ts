import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/laozhao",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:3003",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "./node_modules/.bin/next dev --hostname 127.0.0.1 --port 3003",
    url: "http://127.0.0.1:3003/courses/laozhao-anatomy",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["iPhone 13"]
      }
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"]
      }
    }
  ]
});
