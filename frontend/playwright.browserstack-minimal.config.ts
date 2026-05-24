import { defineConfig } from "@playwright/test";

const artifactRoot =
  process.env.TRADEVETO_BROWSERSTACK_MINIMAL_ARTIFACT_ROOT ??
  "../docs/ops/artifacts/browserstack-config-sanity-fix";

export default defineConfig({
  expect: {
    timeout: 30_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: `${artifactRoot}/playwright-output`,
  reporter: [
    ["list"],
    ["json", { outputFile: `${artifactRoot}/browserstack-minimal-playwright-report.json` }],
  ],
  retries: 1,
  testDir: "./tests/browserstack-minimal",
  timeout: 300_000,
  use: {
    actionTimeout: 60_000,
    ignoreHTTPSErrors: true,
    navigationTimeout: 240_000,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  workers: 1,
});
