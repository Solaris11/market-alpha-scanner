#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = resolve(process.cwd(), process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-25-4/symbol-history-performance/browser");
const outputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_OUTPUT ?? join(artifactRoot, "symbol-history-performance-browser.json"));
const screenshotDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_SCREENSHOT_DIR ?? join(artifactRoot, "screenshots"));
const navigationTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_NAVIGATION_TIMEOUT_MS, 90_000);
const waitTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_WAIT_TIMEOUT_MS, 30_000);
const strict = truthy(process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_STRICT);
const headless = process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_HEADLESS !== "false";
const cookie = process.env.TRADEVETO_PHASE25_SYMBOL_BROWSER_COOKIE ?? "";
const startedAt = new Date().toISOString();

const budgets = {
  cachedSymbolSearchMs: 50,
  compareRestoreMs: 150,
  historyPageLoadMs: 500,
  performancePageLoadMs: 500,
  searchOpenMs: 100,
  symbolPageLoadMs: 1_000,
};

async function main() {
  let report;
  let browser = null;
  try {
    await mkdir(screenshotDir, { recursive: true });
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      userAgent: "TradeVeto-Phase25SymbolHistoryPerformanceProbe/1.0",
      viewport: { height: 1000, width: 1440 },
    });
    if (cookie) await context.addCookies(cookieHeaderToBrowserCookies(cookie));
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(waitTimeoutMs);

    const memoryBefore = await readBrowserMemory(page);
    const symbol = await runSymbolProof(page);
    const history = await runHistoryProof(page);
    const performanceProof = await runPerformanceProof(page);
    const memoryAfter = await readBrowserMemory(page);
    await context.close();

    report = buildReport({ history, memoryAfter, memoryBefore, performance: performanceProof, symbol });
  } catch (error) {
    report = {
      baseUrl,
      blockers: [messageFor(error)],
      budgets,
      error: messageFor(error),
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
      startedAt,
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (report.overallStatus === "ready") console.log(serialized);
  else console.error(serialized);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  if (strict && report.overallStatus !== "ready") process.exitCode = 1;
}

async function runSymbolProof(page) {
  const timings = [];
  const checks = [];
  const screenshots = [];

  timings.push(await measure("symbol-page-load", "Load Symbol Detail and maturity/search cockpit", budgets.symbolPageLoadMs, async () => {
    await page.goto(`${baseUrl}/symbol/AMD`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
    await dismissRiskAcknowledgement(page);
    await page.locator("[data-symbol-command-search='true']").first().waitFor({ state: "visible" });
    await page.locator("[data-symbol-workflow-maturity='true']").first().waitFor({ state: "visible" });
  }));

  const meta = await readSearchMeta(page);
  const score = await readNumericAttribute(page, "[data-symbol-workflow-maturity='true']", "data-symbol-workflow-score");
  screenshots.push(await capture(page, "symbol-amd.png"));

  timings.push(await measure("symbol-search-open", "Focus symbol search with keyboard shortcut", budgets.searchOpenMs, async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    await page.waitForFunction(() => document.querySelector("[data-symbol-search-input='true']") === document.activeElement);
  }));

  timings.push(await measure("cached-symbol-search", "Run cached fuzzy/company symbol search", budgets.cachedSymbolSearchMs, async () => {
    const input = page.locator("[data-symbol-search-input='true']").first();
    await input.fill("");
    await input.fill("advanced micro devices");
    await page.waitForFunction(() => Number(document.querySelector("[data-symbol-command-search='true']")?.getAttribute("data-symbol-search-result-count") ?? "0") > 0);
  }));

  checks.push(await probeKeyboardSearch(page));
  checks.push(await probeSavedFilters(page));

  timings.push(await measure("compare-restore", "Open symbol compare continuity route", budgets.compareRestoreMs, async () => {
    const link = page.getByRole("link", { name: /continue compare/i }).first();
    await link.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL(/\/discover/, { timeout: waitTimeoutMs }),
      link.click(),
    ]);
  }));

  return {
    checks,
    meta,
    score,
    screenshots,
    timings,
  };
}

async function runHistoryProof(page) {
  const timings = [];
  const checks = [];
  const screenshots = [];

  timings.push(await measure("history-page-load", "Load History replay and chronology cockpit", budgets.historyPageLoadMs, async () => {
    await page.goto(`${baseUrl}/history?symbol=AMD`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
    await dismissRiskAcknowledgement(page);
    await page.locator("[data-history-workflow-maturity='true']").first().waitFor({ state: "visible" });
    await page.locator("[data-symbol-command-search='true']").first().waitFor({ state: "visible" });
  }));

  const meta = await readSearchMeta(page);
  const score = await readNumericAttribute(page, "[data-history-workflow-maturity='true']", "data-history-workflow-score");
  screenshots.push(await capture(page, "history-amd.png"));

  timings.push(await measure("history-cached-search", "Run history/replay source-aware search", budgets.cachedSymbolSearchMs, async () => {
    const input = page.locator("[data-symbol-search-input='true']").first();
    await input.fill("");
    await input.fill("replay memory AMD");
    await page.waitForFunction(() => Number(document.querySelector("[data-symbol-command-search='true']")?.getAttribute("data-symbol-search-result-count") ?? "0") > 0);
  }));

  checks.push(await assertVisibleText(page, "replay clusters", "history-replay-clusters"));
  checks.push(await assertVisibleText(page, "event chronology", "history-event-chronology"));
  checks.push(await assertVisibleText(page, "macro chronology", "history-macro-chronology"));

  return {
    checks,
    meta,
    score,
    screenshots,
    timings,
  };
}

async function runPerformanceProof(page) {
  const timings = [];
  const checks = [];
  const screenshots = [];

  timings.push(await measure("performance-page-load", "Load Performance intelligence-performance cockpit", budgets.performancePageLoadMs, async () => {
    await page.goto(`${baseUrl}/performance`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
    await dismissRiskAcknowledgement(page);
    await page.locator("[data-performance-workflow-maturity='true']").first().waitFor({ state: "visible" });
    await page.locator("[data-symbol-command-search='true']").first().waitFor({ state: "visible" });
  }));

  const meta = await readSearchMeta(page);
  const score = await readNumericAttribute(page, "[data-performance-workflow-maturity='true']", "data-performance-workflow-score");
  screenshots.push(await capture(page, "performance.png"));

  timings.push(await measure("performance-cached-search", "Run performance/history/scanner symbol search", budgets.cachedSymbolSearchMs, async () => {
    const input = page.locator("[data-symbol-search-input='true']").first();
    await input.fill("");
    await input.fill("scanner hit rate AMD");
    await page.waitForFunction(() => Number(document.querySelector("[data-symbol-command-search='true']")?.getAttribute("data-symbol-search-result-count") ?? "0") > 0);
  }));

  checks.push(await assertVisibleText(page, "scanner hit-rate analysis", "performance-hit-rate"));
  checks.push(await assertVisibleText(page, "false-positive analysis", "performance-false-positive"));
  checks.push(await assertVisibleText(page, "confidence calibration", "performance-calibration"));
  checks.push(await assertVisibleText(page, "strategy evolution", "performance-strategy-evolution"));

  return {
    checks,
    meta,
    score,
    screenshots,
    timings,
  };
}

async function probeKeyboardSearch(page) {
  try {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.locator("[data-symbol-search-result='true']").first().waitFor({ state: "visible" });
    return { id: "symbol-keyboard-search", status: "pass" };
  } catch (error) {
    return { error: messageFor(error), id: "symbol-keyboard-search", status: "fail" };
  }
}

async function probeSavedFilters(page) {
  try {
    await page.getByRole("button", { name: /save filters/i }).first().click();
    const saved = await page.evaluate(() => Boolean(window.localStorage.getItem("tradeveto.symbolSearch.filters")));
    return { id: "symbol-saved-filters", status: saved ? "pass" : "fail" };
  } catch (error) {
    return { error: messageFor(error), id: "symbol-saved-filters", status: "fail" };
  }
}

async function assertVisibleText(page, pattern, id) {
  try {
    await page.getByText(new RegExp(pattern, "i")).first().waitFor({ state: "visible" });
    return { id, status: "pass" };
  } catch (error) {
    return { error: messageFor(error), id, status: "fail" };
  }
}

async function measure(id, label, budgetMs, operation) {
  const started = performance.now();
  try {
    await operation();
    const latencyMs = roundMetric(performance.now() - started);
    return {
      budgetMs,
      id,
      label,
      latencyMs,
      pass: latencyMs <= budgetMs,
      status: latencyMs <= budgetMs ? "pass" : "fail",
    };
  } catch (error) {
    return {
      budgetMs,
      error: messageFor(error),
      id,
      label,
      latencyMs: roundMetric(performance.now() - started),
      pass: false,
      status: "fail",
    };
  }
}

async function readSearchMeta(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-symbol-command-search='true']");
    const resultCount = Number(root?.getAttribute("data-symbol-search-result-count") ?? "0");
    const indexSize = Number(root?.getAttribute("data-symbol-search-index-size") ?? "0");
    return {
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      indexSize,
      resultCount,
    };
  });
}

async function readNumericAttribute(page, selector, attribute) {
  return page.locator(selector).first().evaluate((element, attr) => Number(element.getAttribute(attr) ?? "0"), attribute).catch(() => 0);
}

async function capture(page, filename) {
  const path = join(screenshotDir, filename);
  await page.screenshot({ fullPage: false, path });
  return path;
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

async function readBrowserMemory(page) {
  try {
    const session = await page.context().newCDPSession(page);
    await session.send("Performance.enable");
    const result = await session.send("Performance.getMetrics");
    const metric = result.metrics.find((item) => item.name === "JSHeapUsedSize");
    await session.detach();
    return metric ? { jsHeapUsedMb: roundMetric(metric.value / 1024 / 1024), source: "cdp" } : { source: "unavailable" };
  } catch {
    return { source: "unavailable" };
  }
}

function buildReport({ history, memoryAfter, memoryBefore, performance: performanceProof, symbol }) {
  const blockers = [];
  for (const section of [symbol, history, performanceProof]) {
    if (section.meta.indexSize < 500) blockers.push(`${sectionName(section)} search index has ${section.meta.indexSize} documents; 500+ browser search proof is not established`);
    if (section.score < 90) blockers.push(`${sectionName(section)} maturity score ${section.score} is below 90`);
    if (section.meta.horizontalOverflowPx > 2) blockers.push(`${sectionName(section)} horizontal overflow ${section.meta.horizontalOverflowPx}px`);
    for (const timing of section.timings) {
      if (!timing.pass) blockers.push(`${timing.id} ${timing.latencyMs}ms exceeds ${timing.budgetMs}ms${timing.error ? `: ${timing.error}` : ""}`);
    }
    for (const check of section.checks) {
      if (check.status !== "pass") blockers.push(`${check.id} failed${check.error ? `: ${check.error}` : ""}`);
    }
  }
  const memoryDeltaMb = memoryBefore.jsHeapUsedMb !== undefined && memoryAfter.jsHeapUsedMb !== undefined
    ? roundMetric(memoryAfter.jsHeapUsedMb - memoryBefore.jsHeapUsedMb)
    : null;
  if (memoryDeltaMb !== null && memoryDeltaMb > 120) blockers.push(`browser heap grew by ${memoryDeltaMb} MB during probe`);
  return {
    baseUrl,
    blockers,
    budgets,
    generatedAt: new Date().toISOString(),
    history,
    memory: {
      after: memoryAfter,
      before: memoryBefore,
      deltaJsHeapUsedMb: memoryDeltaMb,
    },
    overallStatus: blockers.length ? "not_ready" : "ready",
    performance: performanceProof,
    proofScope: "Production browser proof for Symbol Detail, History, and Performance page timing, symbol search timing, maturity scores, workflow continuity, and screenshots. Deterministic companion proof covers synthetic 500+ large-universe search. This is not competitor parity or retention proof.",
    startedAt,
    symbol,
    unsupportedClaims: [
      "No Bloomberg, TradingView, StockTitan, Finviz, or Webull parity claim.",
      "No fabricated provider events, returns, fills, broker state, or trading advice claim.",
      "No real-user retention certification claim.",
    ],
  };
}

function sectionName(section) {
  if (section === undefined) return "unknown";
  if (section.timings.some((timing) => timing.id.startsWith("symbol"))) return "symbol";
  if (section.timings.some((timing) => timing.id.startsWith("history"))) return "history";
  if (section.timings.some((timing) => timing.id.startsWith("performance"))) return "performance";
  return "section";
}

function cookieHeaderToBrowserCookies(header) {
  return Object.entries(requestCookieMap(header)).map(([name, value]) => ({
    httpOnly: name === "market_alpha_session",
    name,
    url: baseUrl,
    value,
  }));
}

function requestCookieMap(header) {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index >= 0 ? [part.slice(0, index), part.slice(index + 1)] : [part, ""];
      }),
  );
}

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? ""));
}

await main();
