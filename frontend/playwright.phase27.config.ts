import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.TRADEVETO_PHASE27_BASE_URL ?? "http://127.0.0.1:3217").replace(/\/$/, "");
const useExternalServer = Boolean(process.env.TRADEVETO_PHASE27_BASE_URL);

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "../docs/ops/artifacts/phase-27-1-symbol-card/playwright-output",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 900, width: 1280 },
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  reporter: [
    ["list"],
    ["json", { outputFile: "../docs/ops/artifacts/phase-27-1-symbol-card/playwright-report.json" }],
  ],
  retries: 0,
  testDir: "./tests/phase27",
  timeout: 120_000,
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3217",
        reuseExistingServer: true,
        timeout: 120_000,
        url: baseURL,
      },
  workers: 1,
});
