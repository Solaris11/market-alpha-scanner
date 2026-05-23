import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.TRADEVETO_MOBILE_UX_BASE_URL ?? "https://tradeveto.com").replace(/\/$/, "");

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "../docs/ops/artifacts/phase-21-1/playwright-output",
  projects: [
    {
      name: "phase21-mobile-real-device",
      use: {
        ...devices["iPhone 14"],
      },
    },
  ],
  reporter: [
    ["list"],
    ["json", { outputFile: "../docs/ops/artifacts/phase-21-1/browserstack-playwright-report.json" }],
  ],
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/browserstack",
  timeout: 90_000,
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: 1,
});
