import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.TRADEVETO_PHASE272_BASE_URL ?? "http://127.0.0.1:3227").replace(/\/$/, "");
const useExternalServer = Boolean(process.env.TRADEVETO_PHASE272_BASE_URL);

export default defineConfig({
  expect: {
    timeout: 15_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "../docs/ops/artifacts/phase-27-2-chart-workstation/playwright-output",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 960, width: 1440 },
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
    ["json", { outputFile: "../docs/ops/artifacts/phase-27-2-chart-workstation/playwright-report.json" }],
  ],
  retries: 0,
  testDir: "./tests/phase27-2",
  timeout: 150_000,
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3227",
        reuseExistingServer: true,
        timeout: 150_000,
        url: baseURL,
      },
  workers: 1,
});
