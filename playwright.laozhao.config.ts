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
    env: {
      ...process.env,
      LAOZHAO_PREVIEW_CONTENT: "1",
      VERCEL_ENV: "preview"
    },
    reuseExistingServer: false,
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
        ...devices["iPhone 13"],
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: "chromium-mobile-360",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 360, height: 800 }
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
