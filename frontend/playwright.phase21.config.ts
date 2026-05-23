import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.TRADEVETO_MOBILE_UX_BASE_URL ?? "https://tradeveto.com").replace(/\/$/, "");
const artifactRoot = process.env.TRADEVETO_BROWSERSTACK_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-22-1";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: `${artifactRoot}/playwright-output`,
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
    ["json", { outputFile: `${artifactRoot}/browserstack-playwright-report.json` }],
  ],
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/browserstack",
  timeout: 600_000,
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "off",
    video: "retain-on-failure",
  },
  workers: 1,
});
