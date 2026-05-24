import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const TARGET_URL = "https://tradeveto.com";
const CONNECT_TIMEOUT_MS = 240_000;
const NAVIGATION_TIMEOUT_MS = 240_000;
const ARTIFACT_ROOT = resolve(
  process.env.TRADEVETO_BROWSERSTACK_MINIMAL_ARTIFACT_ROOT ??
    "../docs/ops/artifacts/browserstack-config-sanity-fix",
);
const ATTEMPT_DIR = join(ARTIFACT_ROOT, "session-attempts");
const BUILD_NAME = process.env.BROWSERSTACK_MINIMAL_BUILD_NAME ?? "tradeveto-browserstack-config-sanity-fix";

type BrowserStackCapabilityValue = string | number | boolean;
type BrowserStackCapabilities = Record<string, BrowserStackCapabilityValue>;
type MinimalTarget = "desktop" | "android" | "iphone";

type MinimalScenario = {
  readonly id: string;
  readonly target: MinimalTarget;
  readonly name: string;
  readonly capabilities: BrowserStackCapabilities;
};

type BrowserStackPlaywright = {
  readonly chromium: {
    connect: (wsEndpoint: string, options: { timeout: number }) => Promise<Browser>;
  };
};

type AttemptResult = {
  readonly scenarioId: string;
  readonly target: MinimalTarget;
  readonly scenarioName: string;
  readonly buildName: string;
  readonly targetUrl: string;
  readonly retry: number;
  readonly startedAt: string;
  capabilities: BrowserStackCapabilities;
  browserStackBuildCreated: boolean;
  sessionCreated: boolean;
  connectSucceeded: boolean;
  bodyVisible: boolean;
  startupMs: number | null;
  navigationMs: number | null;
  statusCode: number | null;
  error: string | null;
};

const scenarios: MinimalScenario[] = [
  {
    id: "01-desktop-chrome",
    target: "desktop",
    name: "01 desktop Chrome homepage loads",
    capabilities: {
      browser: "chrome",
      browser_version: "latest",
      os: "Windows",
      os_version: "11",
    },
  },
  {
    id: "02-android-chrome",
    target: "android",
    name: "02 Android Chrome homepage loads",
    capabilities: {
      browser: "chrome",
      deviceName: "Samsung Galaxy S23",
      os_version: "13.0",
    },
  },
  {
    id: "03-iphone-safari",
    target: "iphone",
    name: "03 iPhone Safari homepage loads",
    capabilities: {
      browser: "safari",
      deviceName: "iPhone 15",
      os_version: "17",
    },
  },
];

const requestedTargets = parseRequestedTargets();
const selectedScenarios = scenarios.filter((scenario) => requestedTargets.has(scenario.target));

if (selectedScenarios.length === 0) {
  throw new Error(`No BrowserStack minimal smoke scenarios selected for target filter: ${[...requestedTargets].join(", ")}`);
}

for (const scenario of selectedScenarios) {
  test(scenario.name, async ({ playwright }, testInfo) => {
    await runBrowserStackSmoke(playwright, scenario, testInfo);
  });
}

async function runBrowserStackSmoke(
  playwright: BrowserStackPlaywright,
  scenario: MinimalScenario,
  testInfo: TestInfo,
): Promise<void> {
  mkdirSync(ATTEMPT_DIR, { recursive: true });

  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
  const startedAtMs = Date.now();
  const result: AttemptResult = {
    scenarioId: scenario.id,
    target: scenario.target,
    scenarioName: scenario.name,
    buildName: BUILD_NAME,
    targetUrl: TARGET_URL,
    retry: testInfo.retry,
    startedAt: new Date(startedAtMs).toISOString(),
    capabilities: {
      ...scenario.capabilities,
      project: "TradeVeto",
      build: BUILD_NAME,
      name: scenario.name,
      "browserstack.local": false,
      "browserstack.debug": false,
      "browserstack.console": "disable",
      "browserstack.networkLogs": false,
      "browserstack.video": false,
      "browserstack.seleniumLogs": false,
    },
    browserStackBuildCreated: false,
    sessionCreated: false,
    connectSucceeded: false,
    bodyVisible: false,
    startupMs: null,
    navigationMs: null,
    statusCode: null,
    error: null,
  };

  if (!username || !accessKey) {
    const missingCredentials: string[] = [];
    if (!username) {
      missingCredentials.push("BROWSERSTACK_USERNAME");
    }
    if (!accessKey) {
      missingCredentials.push("BROWSERSTACK_ACCESS_KEY");
    }
    result.startupMs = Date.now() - startedAtMs;
    result.error = `BrowserStack credentials missing from environment: ${missingCredentials.join(", ")}`;
    writeAttemptResult(result);
    throw new Error(result.error);
  }

  const capabilities: BrowserStackCapabilities = {
    ...result.capabilities,
    "browserstack.username": username,
    "browserstack.accessKey": accessKey,
  };
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    const connectUrl = `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(
      JSON.stringify(capabilities),
    )}`;

    const connectedBrowser = await playwright.chromium.connect(connectUrl, { timeout: CONNECT_TIMEOUT_MS });
    browser = connectedBrowser;
    result.startupMs = Date.now() - startedAtMs;
    result.connectSucceeded = true;
    result.sessionCreated = true;
    result.browserStackBuildCreated = true;

    const context = await connectedBrowser.newContext();
    const activePage = await context.newPage();
    page = activePage;
    activePage.setDefaultTimeout(30_000);
    activePage.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);

    const navigationStartedAtMs = Date.now();
    const response = await activePage.goto(TARGET_URL, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    result.navigationMs = Date.now() - navigationStartedAtMs;
    result.statusCode = response?.status() ?? null;

    await expect(activePage.locator("body")).toBeVisible({ timeout: 30_000 });
    result.bodyVisible = true;
    await setBrowserStackSessionStatus(activePage, "passed", "tradeveto.com body is visible");
    writeAttemptResult(result);
  } catch (error: unknown) {
    result.error = error instanceof Error ? error.message : String(error);
    result.startupMs = result.startupMs ?? Date.now() - startedAtMs;
    if (page !== null) {
      await setBrowserStackSessionStatus(page, "failed", result.error);
    }
    writeAttemptResult(result);
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function parseRequestedTargets(): ReadonlySet<MinimalTarget> {
  const rawTargets = process.env.TRADEVETO_BROWSERSTACK_MINIMAL_TARGET ?? "desktop,android,iphone";
  const requested = rawTargets
    .split(",")
    .map((target) => target.trim().toLowerCase())
    .filter((target) => target.length > 0);
  const validTargets: MinimalTarget[] = ["desktop", "android", "iphone"];
  const selectedTargets: MinimalTarget[] = [];

  for (const requestedTarget of requested) {
    if (requestedTarget === "all") {
      return new Set(validTargets);
    }
    if (requestedTarget === "desktop" || requestedTarget === "android" || requestedTarget === "iphone") {
      selectedTargets.push(requestedTarget);
    }
  }

  return new Set(selectedTargets);
}

async function setBrowserStackSessionStatus(
  page: Page,
  status: "passed" | "failed",
  reason: string,
): Promise<void> {
  const executorPayload = {
    action: "setSessionStatus",
    arguments: {
      status,
      reason: reason.slice(0, 255),
    },
  };

  await page
    .evaluate((_executor) => undefined, `browserstack_executor: ${JSON.stringify(executorPayload)}`)
    .catch(() => undefined);
}

function writeAttemptResult(result: AttemptResult): void {
  const outputPath = join(ATTEMPT_DIR, `${result.scenarioId}-retry-${result.retry}.json`);
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
