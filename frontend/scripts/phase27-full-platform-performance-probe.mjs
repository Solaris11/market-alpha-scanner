#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium, firefox, webkit } from "playwright";

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE275_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = resolve(process.cwd(), process.env.TRADEVETO_PHASE275_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-27-5-performance");
const outputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE275_OUTPUT ?? join(artifactRoot, "full-platform-browser-performance.json"));
const screenshotDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE275_SCREENSHOT_DIR ?? join(artifactRoot, "screenshots"));
const traceDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE275_TRACE_DIR ?? join(artifactRoot, "traces"));
const headless = process.env.TRADEVETO_PHASE275_HEADLESS !== "false";
const strict = truthy(process.env.TRADEVETO_PHASE275_STRICT);
const navigationTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE275_NAVIGATION_TIMEOUT_MS, 90_000);
const waitTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE275_WAIT_TIMEOUT_MS, 20_000);
const interactionWaitMs = positiveInteger(process.env.TRADEVETO_PHASE275_INTERACTION_WAIT_MS, 4_000);
const cookie = process.env.TRADEVETO_PHASE275_COOKIE ?? "";
const screenshotMode = process.env.TRADEVETO_PHASE275_SCREENSHOTS ?? "chromium";

const routes = [
  { id: "terminal", path: "/terminal", targetLoadMs: 2_000 },
  { id: "discover", path: "/discover", targetLoadMs: 2_500 },
  { id: "scanner", path: "/scanner", targetLoadMs: 2_500 },
  { id: "symbol-amd", path: "/symbol/AMD", targetLoadMs: 2_500 },
  { id: "history", path: "/history", targetLoadMs: 1_000 },
  { id: "performance", path: "/performance", targetLoadMs: 1_000 },
  { id: "macro", path: "/macro", targetLoadMs: 2_500 },
  { id: "feed", path: "/feed", targetLoadMs: 2_500 },
  { id: "paper", path: "/paper", targetLoadMs: 2_500 },
  { id: "strategy-labs", path: "/strategy-labs", targetLoadMs: 2_500 },
  { id: "alerts", path: "/alerts", targetLoadMs: 2_500 },
  { id: "market-memory", path: "/market-memory", targetLoadMs: 2_500 },
  { id: "status", path: "/status", targetLoadMs: 2_000 },
  { id: "account", path: "/account", targetLoadMs: 2_500 },
  { id: "settings", path: "/settings", targetLoadMs: 2_500 },
  { id: "support", path: "/support", targetLoadMs: 2_500 },
];

const interactionBudgets = {
  chartInteractionMs: 60,
  chartRestoreMs: 250,
  compareOpenMs: 150,
  fullscreenChartOpenMs: 150,
  routeTransitionMs: 200,
  scannerInteractionMs: 100,
  symbolSearchOpenMs: 100,
  symbolSwitchMs: 150,
};

const browserLaunchers = {
  chromium,
  firefox,
  webkit,
};
const browsers = parseBrowserList(process.env.TRADEVETO_PHASE275_BROWSERS ?? "chromium,firefox,webkit");

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  await mkdir(traceDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const browserReports = [];
  for (const browserName of browsers) {
    browserReports.push(await runBrowserProbe(browserName));
  }
  const report = buildReport({ browserReports, startedAt });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  if (report.overallStatus === "ready") console.log(serialized);
  else console.error(serialized);
  if (strict && report.overallStatus !== "ready") process.exitCode = 1;
}

async function runBrowserProbe(browserName) {
  const launcher = browserLaunchers[browserName];
  if (!launcher) {
    return {
      browserName,
      error: `Unsupported browser ${browserName}`,
      overallStatus: "not_ready",
      routes: [],
    };
  }

  let browser = null;
  const startedAt = new Date().toISOString();
  try {
    browser = await launcher.launch({ headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      userAgent: `TradeVeto-Phase275PerformanceProbe/${browserName}`,
      viewport: { height: 960, width: 1440 },
    });
    if (cookie) await context.addCookies(cookieHeaderToBrowserCookies(cookie));
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(waitTimeoutMs);
    const apiTimings = collectApiTimings(page);
    const consoleIssues = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleIssues.push({
          location: message.location(),
          text: message.text().slice(0, 500),
          type: message.type(),
        });
      }
    });
    await installPerfObservers(page);

    const memoryBefore = await readBrowserMemory(page, browserName);
    const routeReports = [];
    for (const route of routes) {
      routeReports.push(await measureRoute(page, browserName, route));
    }
    const interactions = browserName === "chromium" ? await runInteractionProbes(page) : [];
    const memoryAfter = await readBrowserMemory(page, browserName);
    const tracePath = join(traceDir, `${browserName}-trace.zip`);
    await context.tracing.stop({ path: tracePath }).catch(() => undefined);
    await context.close();

    return {
      apiTimings: summarizeApiTimings(apiTimings),
      browserName,
      consoleIssueCount: consoleIssues.length,
      consoleIssues: consoleIssues.slice(0, 20),
      generatedAt: new Date().toISOString(),
      interactions,
      memory: { after: memoryAfter, before: memoryBefore },
      overallStatus: routeReports.some((route) => route.status === "fail") || interactions.some((interaction) => interaction.status === "fail") ? "not_ready" : "ready",
      routes: routeReports,
      startedAt,
      tracePath,
    };
  } catch (error) {
    return {
      browserName,
      error: messageFor(error),
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
      routes: [],
      startedAt,
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function measureRoute(page, browserName, route) {
  const started = performance.now();
  const apiCountBefore = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/")).length).catch(() => 0);
  try {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
    await page.locator("body").waitFor({ state: "visible" });
    await dismissRiskAcknowledgement(page);
    const interactiveMs = roundMetric(performance.now() - started);
    await page.waitForLoadState("networkidle", { timeout: Math.min(waitTimeoutMs, 3_000) }).catch(() => undefined);
    await page.waitForTimeout(250);
    const settledMs = roundMetric(performance.now() - started);
    const metrics = await readPageMetrics(page, apiCountBefore);
    const geometry = await readGeometry(page);
    const memory = await readBrowserMemory(page, browserName);
    const screenshotPath = shouldCapture(browserName) ? await capture(page, browserName, `${route.id}.png`) : null;
    const blockers = [];
    if (interactiveMs > route.targetLoadMs) blockers.push(`interactive ${interactiveMs}ms exceeds ${route.targetLoadMs}ms target`);
    if (metrics.cls > 0.25) blockers.push(`CLS ${metrics.cls} exceeds 0.25`);
    if (geometry.horizontalOverflowPx > 2) blockers.push(`horizontal overflow ${geometry.horizontalOverflowPx}px`);
    if (metrics.lcpMs !== null && metrics.lcpMs > 4_000) blockers.push(`LCP ${metrics.lcpMs}ms exceeds 4000ms audit ceiling`);
    return {
      blockers,
      geometry,
      interactiveMs,
      memory,
      metrics,
      path: route.path,
      routeId: route.id,
      screenshotPath,
      settledMs,
      status: blockers.length ? "fail" : "pass",
      targetLoadMs: route.targetLoadMs,
    };
  } catch (error) {
    return {
      blockers: [messageFor(error)],
      error: messageFor(error),
      loadMs: roundMetric(performance.now() - started),
      path: route.path,
      routeId: route.id,
      status: "fail",
      targetLoadMs: route.targetLoadMs,
    };
  }
}

async function runInteractionProbes(page) {
  const interactions = [];
  await page.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await dismissRiskAcknowledgement(page);
  await page.waitForLoadState("networkidle", { timeout: Math.min(waitTimeoutMs, 3_000) }).catch(() => undefined);
  interactions.push(await measureBrowserWorkflow(page, "scanner-filter", "Filter scanner/discovery results", interactionBudgets.scannerInteractionMs, ["scanner:filter"], async () => {
    const input = page.locator("[data-discovery-search-input='true']").first();
    await input.waitFor({ state: "visible", timeout: interactionWaitMs });
    await input.fill("", { timeout: interactionWaitMs });
    await input.fill("AMD", { timeout: interactionWaitMs });
    await page.locator("[data-discovery-scanner-table='true']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));
  interactions.push(await measureBrowserWorkflow(page, "compare-open", "Open compare panel from discovery", interactionBudgets.compareOpenMs, ["scanner:compare-open"], async () => {
    await page.getByRole("button", { name: /compare top/i }).first().click({ timeout: interactionWaitMs });
    await page.locator("[data-discovery-compare-panel='true']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));

  interactions.push(await measure("symbol-route-transition", "Client transition from discovery to AMD symbol", interactionBudgets.routeTransitionMs, async () => {
    await page.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded" });
    await dismissRiskAcknowledgement(page);
    const symbolLink = page.locator("a[href='/symbol/AMD'], a[href*='/symbol/AMD']").first();
    await symbolLink.scrollIntoViewIfNeeded({ timeout: interactionWaitMs });
    await Promise.all([
      page.waitForURL(/\/symbol\/AMD/, { timeout: interactionWaitMs }),
      symbolLink.click({ timeout: interactionWaitMs }),
    ]);
  }));

  interactions.push(await measureBrowserWorkflow(page, "chart-restore", "Load AMD chart workspace", interactionBudgets.chartRestoreMs, ["chart:workspace-restore"], async () => {
    await page.goto(`${baseUrl}/symbol/AMD`, { waitUntil: "domcontentloaded" });
    await dismissRiskAcknowledgement(page);
    await page.locator("[data-chart-symbol='AMD'][data-chart-workspace-loaded='true']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));
  interactions.push(await measureBrowserWorkflow(page, "fullscreen-chart-open", "Open fullscreen AMD chart", interactionBudgets.fullscreenChartOpenMs, ["chart:fullscreen-open"], async () => {
    await page.locator("[data-chart-expand-trigger='AMD']").first().click({ timeout: interactionWaitMs });
    await page.locator("[data-chart-fullscreen-toolbar='true']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));
  interactions.push(await measureBrowserWorkflow(page, "chart-interaction", "Switch fullscreen chart mode", interactionBudgets.chartInteractionMs, ["chart:toolbar-interaction"], async () => {
    await page.locator("[data-chart-fullscreen-toolbar='true']").getByRole("button", { name: /^compare$/i }).first().click({ timeout: interactionWaitMs });
    await page.locator("[data-chart-fullscreen-toolbar='true'][data-chart-fullscreen-mode='compare']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.locator("[data-chart-fullscreen-toolbar='true']").first().waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
  interactions.push(await measureBrowserWorkflow(page, "symbol-switch", "Switch from AMD to NVDA through client chart navigation", interactionBudgets.symbolSwitchMs, ["symbol:switch"], async () => {
    const nextButton = page.getByRole("button", { name: /next symbol/i }).first();
    if (await nextButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await Promise.all([
        page.waitForURL(/\/symbol\/NVDA/, { timeout: interactionWaitMs }).catch(() => undefined),
        nextButton.click({ timeout: interactionWaitMs }),
      ]);
    } else {
      await page.goto(`${baseUrl}/symbol/AMD`, { waitUntil: "domcontentloaded" });
      await dismissRiskAcknowledgement(page);
      await page.getByRole("button", { name: /next symbol/i }).first().click({ timeout: interactionWaitMs });
    }
    await page.locator("[data-chart-symbol='NVDA']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));

  interactions.push(await measureBrowserWorkflow(page, "symbol-search-open", "Open global symbol search", interactionBudgets.symbolSearchOpenMs, ["symbol-search:open"], async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    await page.locator("[data-symbol-search-input='true']").first().waitFor({ state: "visible", timeout: interactionWaitMs });
  }));
  return interactions;
}

async function installPerfObservers(page) {
  await page.addInitScript(() => {
    window.__tradevetoPhase275Perf = { cls: 0, lcp: 0 };
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__tradevetoPhase275Perf.cls += entry.value;
        }
      });
      clsObserver.observe({ buffered: true, type: "layout-shift" });
    } catch {
      // Browser does not support layout-shift performance entries.
    }
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) window.__tradevetoPhase275Perf.lcp = latest.startTime;
      });
      lcpObserver.observe({ buffered: true, type: "largest-contentful-paint" });
    } catch {
      // Browser does not support largest-contentful-paint performance entries.
    }
  });
}

async function readPageMetrics(page, apiCountBefore) {
  return page.evaluate((countBefore) => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null;
    const resources = performance.getEntriesByType("resource");
    const scriptResources = resources.filter((entry) => {
      const initiatorType = entry.initiatorType;
      return initiatorType === "script" || entry.name.endsWith(".js");
    });
    const apiResources = resources.filter((entry) => entry.name.includes("/api/")).slice(countBefore);
    const perf = window.__tradevetoPhase275Perf ?? { cls: 0, lcp: 0 };
    return {
      apiResourceCount: apiResources.length,
      apiTransferBytes: Math.round(apiResources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
      cls: Math.round((perf.cls || 0) * 10000) / 10000,
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      fcpMs: fcp === null ? null : Math.round(fcp),
      hydrationMarkerCount: document.querySelectorAll("[data-hydrated='true'], [data-chart-workspace-loaded='true'], [data-symbol-card-mounted='true']").length,
      jsExecutionEstimateMs: navigation ? Math.max(0, Math.round(navigation.domInteractive - navigation.responseEnd)) : null,
      lcpMs: perf.lcp ? Math.round(perf.lcp) : null,
      loadEventMs: navigation ? Math.round(navigation.loadEventEnd) : null,
      resourceCount: resources.length,
      scriptEncodedBytes: Math.round(scriptResources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0)),
      ttfbMs: navigation ? Math.round(navigation.responseStart) : null,
      transferBytes: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
    };
  }, apiCountBefore);
}

async function readGeometry(page) {
  return page.evaluate(() => ({
    horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  }));
}

async function readBrowserMemory(page, browserName) {
  if (browserName === "chromium") {
    try {
      const session = await page.context().newCDPSession(page);
      await session.send("Performance.enable");
      const result = await session.send("Performance.getMetrics");
      const metric = result.metrics.find((item) => item.name === "JSHeapUsedSize");
      await session.detach();
      if (metric) return { jsHeapUsedMb: roundMetric(metric.value / 1024 / 1024), source: "cdp" };
    } catch {
      // Fall through to performance.memory.
    }
  }
  return page.evaluate(() => {
    const memory = performance.memory;
    if (!memory) return { source: "unavailable" };
    return {
      jsHeapLimitMb: Math.round((memory.jsHeapSizeLimit / 1024 / 1024) * 1000) / 1000,
      jsHeapUsedMb: Math.round((memory.usedJSHeapSize / 1024 / 1024) * 1000) / 1000,
      source: "performance.memory",
      totalHeapMb: Math.round((memory.totalJSHeapSize / 1024 / 1024) * 1000) / 1000,
    };
  }).catch(() => ({ source: "unavailable" }));
}

function collectApiTimings(page) {
  const starts = new Map();
  const timings = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) starts.set(request, performance.now());
  });
  page.on("requestfinished", async (request) => {
    if (!starts.has(request)) return;
    const started = starts.get(request);
    starts.delete(request);
    const response = await request.response().catch(() => null);
    timings.push({
      latencyMs: roundMetric(performance.now() - started),
      method: request.method(),
      statusCode: response?.status() ?? null,
      url: redactUrl(request.url()),
    });
  });
  page.on("requestfailed", (request) => {
    if (!starts.has(request)) return;
    const started = starts.get(request);
    starts.delete(request);
    timings.push({
      error: request.failure()?.errorText ?? "request failed",
      latencyMs: roundMetric(performance.now() - started),
      method: request.method(),
      statusCode: null,
      url: redactUrl(request.url()),
    });
  });
  return timings;
}

async function measure(id, label, budgetMs, operation) {
  const started = performance.now();
  try {
    const result = await operation();
    const latencyMs = typeof result === "number" ? result : roundMetric(performance.now() - started);
    return {
      budgetMs,
      id,
      label,
      latencyMs,
      status: latencyMs <= budgetMs ? "pass" : "fail",
    };
  } catch (error) {
    return {
      budgetMs,
      error: messageFor(error),
      id,
      label,
      latencyMs: roundMetric(performance.now() - started),
      status: "fail",
    };
  }
}

async function measureBrowserWorkflow(page, id, label, budgetMs, metricIds, operation) {
  const beforeMetrics = await readWorkflowMetrics(page);
  const beforeCount = beforeMetrics.length;
  const started = performance.now();
  try {
    await operation();
    const automationLatencyMs = roundMetric(performance.now() - started);
    const browserMetric = await waitForWorkflowMetric(page, metricIds, beforeCount);
    const latencyMs = roundMetric(browserMetric?.latencyMs ?? automationLatencyMs);
    return {
      automationLatencyMs,
      browserMetricId: browserMetric?.id ?? null,
      budgetMs,
      id,
      label,
      latencyMs,
      status: latencyMs <= budgetMs ? "pass" : "fail",
      timingSource: browserMetric ? "browser-performance" : "playwright-automation",
    };
  } catch (error) {
    return {
      automationLatencyMs: roundMetric(performance.now() - started),
      budgetMs,
      error: messageFor(error),
      id,
      label,
      latencyMs: roundMetric(performance.now() - started),
      status: "fail",
      timingSource: "playwright-automation",
    };
  }
}

async function waitForWorkflowMetric(page, ids, beforeCount) {
  const deadline = Date.now() + 2_500;
  while (Date.now() < deadline) {
    const metrics = await readWorkflowMetrics(page);
    const next = metrics.slice(beforeCount).find((metric) => ids.includes(metric.id));
    if (next) return next;
    await page.waitForTimeout(50);
  }
  const metrics = await readWorkflowMetrics(page);
  return [...metrics].reverse().find((metric) => ids.includes(metric.id)) ?? null;
}

async function readWorkflowMetrics(page) {
  return page.evaluate(() => {
    const metrics = window.__tradevetoBrowserWorkflowMetrics;
    return Array.isArray(metrics) ? metrics : [];
  }).catch(() => []);
}

async function dismissRiskAcknowledgement(page) {
  const checkbox = page.getByRole("checkbox", { name: /financial advice|understand|risk/i }).first();
  if (await checkbox.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await checkbox.check({ force: true }).catch(() => undefined);
  }
  const button = page.getByRole("button", { name: /continue|understand|accept/i }).first();
  if (await button.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await button.click({ force: true }).catch(() => undefined);
  }
}

async function capture(page, browserName, filename) {
  const path = join(screenshotDir, browserName, filename);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ fullPage: false, path });
  return path;
}

function buildReport({ browserReports, startedAt }) {
  const blockers = [];
  const browserNames = new Set(browserReports.map((report) => report.browserName));
  for (const requiredBrowser of ["chromium", "firefox", "webkit"]) {
    if (browsers.includes(requiredBrowser) && !browserNames.has(requiredBrowser)) blockers.push(`${requiredBrowser} was not probed`);
  }
  for (const browserReport of browserReports) {
    if (browserReport.overallStatus !== "ready") {
      if (browserReport.error) blockers.push(`${browserReport.browserName}: ${browserReport.error}`);
      for (const route of browserReport.routes ?? []) {
        for (const blocker of route.blockers ?? []) blockers.push(`${browserReport.browserName} ${route.path}: ${blocker}`);
      }
      for (const interaction of browserReport.interactions ?? []) {
        if (interaction.status !== "pass") blockers.push(`${browserReport.browserName} ${interaction.id}: ${interaction.error ?? `${interaction.latencyMs}ms exceeds ${interaction.budgetMs}ms`}`);
      }
    }
  }
  return {
    baseUrl,
    browserReports,
    budgets: {
      interactionBudgets,
      routeLoadTargets: Object.fromEntries(routes.map((route) => [route.path, route.targetLoadMs])),
    },
    generatedAt: new Date().toISOString(),
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeScope: "Production browser performance audit across major TradeVeto routes. Uses real browsers via Playwright against the configured base URL. Authentication is optional via TRADEVETO_PHASE275_COOKIE.",
    startedAt,
    blockers: blockers.slice(0, 120),
  };
}

function summarizeApiTimings(timings) {
  const byPath = new Map();
  for (const timing of timings) {
    const path = timing.url;
    const current = byPath.get(path) ?? [];
    current.push(timing);
    byPath.set(path, current);
  }
  return [...byPath.entries()].map(([path, items]) => {
    const latencies = items.map((item) => item.latencyMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    return {
      count: items.length,
      errors: items.filter((item) => item.error || (item.statusCode ?? 500) >= 400).length,
      path,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      p99Ms: percentile(latencies, 99),
    };
  }).sort((left, right) => right.count - left.count).slice(0, 40);
}

function shouldCapture(browserName) {
  if (screenshotMode === "all") return true;
  if (screenshotMode === "none") return false;
  return screenshotMode.split(",").map((item) => item.trim()).includes(browserName);
}

function cookieHeaderToBrowserCookies(header) {
  return header.split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      const name = separator >= 0 ? part.slice(0, separator) : part;
      const value = separator >= 0 ? part.slice(separator + 1) : "";
      return {
        domain: new URL(baseUrl).hostname,
        httpOnly: name === "market_alpha_session",
        name,
        path: "/",
        sameSite: "Lax",
        secure: baseUrl.startsWith("https://"),
        value,
      };
    });
}

function parseBrowserList(value) {
  return value.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item in browserLaunchers);
}

function percentile(values, pct) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.ceil((pct / 100) * values.length) - 1);
  return roundMetric(values[index]);
}

function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.pathname}${url.search ? "?…" : ""}`;
  } catch {
    return rawUrl.split("?")[0];
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function positiveInteger(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

await main();
