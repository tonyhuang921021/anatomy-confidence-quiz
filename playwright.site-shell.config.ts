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
    command: "./node_modules/.bin/next build && ./node_modules/.bin/next start --hostname 127.0.0.1 --port 3004",
    url: "http://127.0.0.1:3004/",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://e2e.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
      ADMIN_EMAILS: "e2e-owner@example.test",
      NEXT_PUBLIC_SUPABASE_RECOVERY_MODE: "off",
      SUPABASE_SERVICE_ROLE_KEY: "",
      RESEND_API_KEY: "",
      OPENAI_API_KEY: ""
    }
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
