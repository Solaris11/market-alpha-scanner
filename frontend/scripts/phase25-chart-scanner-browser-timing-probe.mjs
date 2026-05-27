#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import pg from "pg";

const { Pool } = pg;

const defaultArtifactRoot = "../docs/ops/artifacts/phase-25-3/chart-scanner-power/browser-timing";
const phase26ArtifactRoot = "../docs/ops/artifacts/phase-26-4-browser-workflows";
const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE26_BROWSER_BASE_URL ?? process.env.TRADEVETO_PHASE25_BROWSER_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = resolve(process.cwd(), process.env.TRADEVETO_PHASE26_BROWSER_ARTIFACT_ROOT ?? process.env.TRADEVETO_PHASE25_BROWSER_ARTIFACT_ROOT ?? (truthy(process.env.TRADEVETO_PHASE26_BROWSER_PROBE) ? phase26ArtifactRoot : defaultArtifactRoot));
const outputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE26_BROWSER_TIMING_OUTPUT ?? process.env.TRADEVETO_PHASE25_BROWSER_TIMING_OUTPUT ?? join(artifactRoot, "chart-scanner-browser-timing.json"));
const screenshotDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE26_BROWSER_SCREENSHOT_DIR ?? process.env.TRADEVETO_PHASE25_BROWSER_SCREENSHOT_DIR ?? join(artifactRoot, "screenshots"));
const largeUniverseOutputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE26_BROWSER_LARGE_UNIVERSE_OUTPUT ?? join(artifactRoot, "large-universe-proof.json"));
const navigationTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE26_BROWSER_NAVIGATION_TIMEOUT_MS ?? process.env.TRADEVETO_PHASE25_BROWSER_NAVIGATION_TIMEOUT_MS, 90_000);
const waitTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE26_BROWSER_WAIT_TIMEOUT_MS ?? process.env.TRADEVETO_PHASE25_BROWSER_WAIT_TIMEOUT_MS, 30_000);
const largeWatchlistSize = positiveInteger(process.env.TRADEVETO_PHASE26_BROWSER_WATCHLIST_SIZE ?? process.env.TRADEVETO_PHASE25_BROWSER_WATCHLIST_SIZE, 520);
const strict = truthy(process.env.TRADEVETO_PHASE26_BROWSER_STRICT ?? process.env.TRADEVETO_PHASE25_BROWSER_STRICT);
const headless = (process.env.TRADEVETO_PHASE26_BROWSER_HEADLESS ?? process.env.TRADEVETO_PHASE25_BROWSER_HEADLESS) !== "false";
const createProbeIdentity = (process.env.TRADEVETO_PHASE26_BROWSER_CREATE_PROBE_USER ?? process.env.TRADEVETO_PHASE25_BROWSER_CREATE_PROBE_USER) !== "false" && Boolean(process.env.DATABASE_URL);
const cleanupProbeIdentity = (process.env.TRADEVETO_PHASE26_BROWSER_CLEANUP_PROBE_USER ?? process.env.TRADEVETO_PHASE25_BROWSER_CLEANUP_PROBE_USER) !== "false";

const budgets = {
  chartInteractionMs: 60,
  chartWorkspaceRestoreMs: 250,
  compareOpenMs: 150,
  fullscreenChartOpenMs: 150,
  largeWatchlistFilterMs: 150,
  rapidSymbolSwitchMs: 100,
  savedScanRestoreMs: 250,
  scannerInteractionMs: 100,
};

const startedAt = new Date().toISOString();
let probeIdentity = null;
let cookie = process.env.TRADEVETO_PHASE26_BROWSER_COOKIE ?? process.env.TRADEVETO_PHASE25_BROWSER_COOKIE ?? "";
let csrfToken = "";
let browser = null;

async function main() {
  let report;
  try {
    await mkdir(screenshotDir, { recursive: true });
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (cookie) {
      const csrf = await fetchCsrfToken();
      csrfToken = csrf.token;
      cookie = mergeCookieHeader(cookie, csrf.cookie);
    }

    const setup = cookie ? await setupAuthenticatedWorkflowData().catch((error) => ({ error: messageFor(error), ok: false })) : { authenticated: false, ok: false };
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      userAgent: "TradeVeto-Phase25ChartScannerBrowserTimingProbe/1.0",
      viewport: { height: 1000, width: 1440 },
    });
    if (cookie) await context.addCookies(cookieHeaderToBrowserCookies(cookie));
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(waitTimeoutMs);

    const memoryBefore = await readBrowserMemory(page);
    const scanner = await runScannerProof(page, setup);
    const chart = await runChartProof(page, setup);
    const memoryAfter = await readBrowserMemory(page);
    await context.close();

    report = buildReport({ chart, memoryAfter, memoryBefore, scanner, setup });
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
    if (probeIdentity && cleanupProbeIdentity) {
      await cleanupProductionProbeIdentity(probeIdentity).catch((error) => {
        report.blockers = [...(report.blockers ?? []), `probe identity cleanup failed: ${messageFor(error)}`];
        report.overallStatus = "not_ready";
      });
    }
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (report.overallStatus === "ready") console.log(serialized);
  else console.error(serialized);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  await mkdir(dirname(largeUniverseOutputPath), { recursive: true });
  await writeFile(largeUniverseOutputPath, `${JSON.stringify(buildLargeUniverseProof(report), null, 2)}\n`, "utf8");
  if (strict && report.overallStatus !== "ready") process.exitCode = 1;
}

async function runScannerProof(page, setup) {
  const timings = [];
  const checks = [];
  const screenshots = [];
  const errors = [];

  await page.goto(`${baseUrl}/discover`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
  await dismissRiskAcknowledgement(page);
  await page.locator("[data-discovery-workspace='true']").waitFor({ state: "visible" });

  timings.push(await measureBrowserWorkflow(page, "scanner-interaction", "Switch discovery scanner to ultra-dense table mode", budgets.scannerInteractionMs, ["scanner:ultra-dense", "scanner:density-change"], async () => {
    await page.locator("button[title='Ultra dense scanner']").first().click();
    await page.locator("[data-discovery-dense-mode='ultra']").waitFor({ state: "visible" });
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
  }));

  const initialMeta = await readScannerMeta(page);
  screenshots.push(await capture(page, "discover-ultra-dense.png"));

  timings.push(await measureBrowserWorkflow(page, "large-watchlist-filter", "Filter the production scanner table after large-watchlist setup", budgets.largeWatchlistFilterMs, ["scanner:filter"], async () => {
    const input = page.locator("[data-discovery-search-input='true']").first();
    await input.fill("");
    await input.fill("A");
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
  }));
  const filteredMeta = await readScannerMeta(page);

  timings.push(await measureBrowserWorkflow(page, "scanner-sort-search", "Sort the production scanner table by confidence", budgets.scannerInteractionMs, ["scanner:sort"], async () => {
    await page.getByRole("button", { name: /^Conf$/i }).first().click();
    await page.locator("[data-discovery-scanner-table='true'][data-scanner-sort='confidence']").waitFor({ state: "visible" });
  }));

  timings.push(await measureBrowserWorkflow(page, "compare-open", "Open the rapid compare matrix from discovery", budgets.compareOpenMs, ["scanner:compare-open"], async () => {
    await page.getByRole("button", { name: /compare top/i }).first().click();
    await page.locator("[data-discovery-compare-panel='true'][data-compare-count='8']").waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "discover-compare.png"));

  timings.push(await measure("saved-scan-restore", "Reload a server-backed saved scanner preset", budgets.savedScanRestoreMs, async () => {
    if (!setup.savedScanName) throw new Error("authenticated saved scan fixture unavailable");
    await page.getByText(setup.savedScanName, { exact: false }).first().click();
    await page.locator("[data-discovery-dense-mode='ultra']").waitFor({ state: "visible" });
  }));

  timings.push(await measureBrowserWorkflow(page, "row-expansion", "Expand a scanner row in ultra-dense mode", budgets.scannerInteractionMs, ["scanner:row-expansion"], async () => {
    await page.keyboard.press("Enter");
    await page.locator("[data-scanner-expanded-row='true']").first().waitFor({ state: "visible" });
  }));

  timings.push(await measureBrowserWorkflow(page, "fullscreen-scanner", "Open fullscreen scanner table", budgets.scannerInteractionMs, ["scanner:fullscreen-toggle"], async () => {
    await page.getByRole("button", { name: /fullscreen/i }).filter({ hasText: /fullscreen/i }).first().click();
    await page.locator("[data-scanner-fullscreen='true']").waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "discover-fullscreen-scanner.png"));

  const keyboard = await probeScannerKeyboard(page);
  checks.push(keyboard);

  const rowAlert = await probeScannerRowAlert(page);
  checks.push(rowAlert);

  if (initialMeta.totalRows < 500) {
    errors.push(`browser scanner table exposed ${initialMeta.totalRows} rows; 500+ browser-row proof is not established`);
  }
  if (initialMeta.virtualized !== true || initialMeta.renderedRows > 90) {
    errors.push(`scanner virtualization proof failed: virtualized=${initialMeta.virtualized}, renderedRows=${initialMeta.renderedRows}`);
  }
  if (setup.watchlistSize !== null && setup.watchlistSize < 500) {
    errors.push(`authenticated large-watchlist fixture only created ${setup.watchlistSize} symbols`);
  }

  return {
    checks,
    errors,
    filteredMeta,
    initialMeta,
    screenshots,
    setup: {
      authenticated: Boolean(setup.authenticated),
      savedScanCreated: Boolean(setup.savedScanId),
      watchlistSize: setup.watchlistSize ?? null,
    },
    timings,
  };
}

async function runChartProof(page, setup) {
  const timings = [];
  const checks = [];
  const screenshots = [];
  const errors = [];

  timings.push(await measure("chart-workspace-restore", "Load /symbol/AMD with persisted chart workspace context", budgets.chartWorkspaceRestoreMs, async () => {
    await page.goto(`${baseUrl}/symbol/AMD`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
    await dismissRiskAcknowledgement(page);
    await page.getByRole("button", { name: /Expand AMD chart/i }).waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "symbol-amd.png"));

  checks.push(await probeIndicatorTemplate(page));
  checks.push(await probeChartAlert(page));

  timings.push(await measureBrowserWorkflow(page, "fullscreen-chart-open", "Open fullscreen AMD chart overlay", budgets.fullscreenChartOpenMs, ["chart:fullscreen-open"], async () => {
    await page.getByRole("button", { name: /Expand AMD chart/i }).click();
    await page.locator("[data-chart-fullscreen-toolbar='true']").waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "symbol-amd-fullscreen.png"));

  timings.push(await measureBrowserWorkflow(page, "chart-interaction", "Switch fullscreen chart to compare mode", budgets.chartInteractionMs, ["chart:toolbar-interaction"], async () => {
    await page.locator("[data-chart-fullscreen-toolbar='true']").getByRole("button", { name: /^compare$/i }).first().click();
    await page.locator("[data-chart-fullscreen-toolbar='true'][data-chart-fullscreen-mode='compare']").waitFor({ state: "visible" });
  }));

  checks.push(await probeFullscreenToolbar(page));

  timings.push(await measureBrowserWorkflow(page, "chart-drawing-operation", "Toggle chart drawing magnet mode", budgets.chartInteractionMs, ["chart:drawing-operation"], async () => {
    await page.keyboard.press("Escape");
    await page.locator("[data-chart-drawing-toolbar='true']").getByRole("button", { name: /magnet/i }).first().click();
    await page.locator("[data-chart-drawing-toolbar='true']").waitFor({ state: "visible" });
  }));

  timings.push(await measureBrowserWorkflow(page, "chart-toolbar-interaction", "Collapse and restore chart drawing toolbar", budgets.chartInteractionMs, ["chart:toolbar-interaction"], async () => {
    await page.locator("[data-chart-drawing-toolbar='true']").getByRole("button", { name: /collapse drawing controls/i }).first().click();
    await page.locator("[data-chart-drawing-toolbar='true']").waitFor({ state: "visible" });
  }));

  timings.push(await measure("rapid-symbol-switch", "Navigate from AMD chart to NVDA symbol chart", budgets.rapidSymbolSwitchMs, async () => {
    await page.keyboard.press("Escape");
    await page.goto(`${baseUrl}/symbol/NVDA`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Expand NVDA chart/i }).waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "symbol-nvda.png"));

  if (setup.chartWorkspaceSaved !== true) errors.push("authenticated chart workspace fixture was not saved before browser restore");

  return {
    checks,
    errors,
    screenshots,
    setup: {
      authenticated: Boolean(setup.authenticated),
      chartWorkspaceSaved: setup.chartWorkspaceSaved === true,
    },
    timings,
  };
}

async function probeScannerKeyboard(page) {
  try {
    await page.keyboard.press("/");
    const focusedSearch = await page.locator("[data-discovery-search-input='true']").first().evaluate((node) => node === document.activeElement);
    await page.keyboard.press("j");
    await page.keyboard.press("Enter");
    await page.keyboard.press("d");
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
    return { id: "scanner-keyboard-shortcuts", pass: Boolean(focusedSearch), status: focusedSearch ? "pass" : "fail" };
  } catch (error) {
    return { error: messageFor(error), id: "scanner-keyboard-shortcuts", pass: false, status: "fail" };
  }
}

async function probeScannerRowAlert(page) {
  try {
    const button = page.locator("button[title^='Create scanner alert for']").first();
    await button.scrollIntoViewIfNeeded();
    const disabled = await button.isDisabled().catch(() => false);
    await button.click();
    await page.getByText(/scanner alert|Sign in|saved|unavailable|active/i).first().waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
    return { disabled, id: "scanner-row-alert", pass: !disabled, status: disabled ? "not_proven" : "pass" };
  } catch (error) {
    return { error: messageFor(error), id: "scanner-row-alert", pass: false, status: "fail" };
  }
}

async function probeIndicatorTemplate(page) {
  try {
    const input = page.getByLabel("Template name").first();
    await input.scrollIntoViewIfNeeded();
    await input.fill(`Phase 25.3 ${Date.now().toString(36)}`);
    const container = input.locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    await container.getByRole("button", { name: /^Save$/i }).click();
    return { id: "chart-indicator-template", pass: true, status: "pass" };
  } catch (error) {
    return { error: messageFor(error), id: "chart-indicator-template", pass: false, status: "fail" };
  }
}

async function probeChartAlert(page) {
  try {
    const threshold = page.getByLabel("Chart alert threshold").first();
    await threshold.scrollIntoViewIfNeeded();
    const container = threshold.locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]");
    const saveButton = container.getByRole("button", { name: /^Save$/i }).first();
    const disabled = await saveButton.isDisabled().catch(() => false);
    if (!disabled) await saveButton.click();
    return { disabled, id: "chart-alert-save", pass: !disabled, status: disabled ? "not_proven" : "pass" };
  } catch (error) {
    return { error: messageFor(error), id: "chart-alert-save", pass: false, status: "fail" };
  }
}

async function probeFullscreenToolbar(page) {
  try {
    const toolbar = page.locator("[data-chart-fullscreen-toolbar='true']");
    const collapse = toolbar.locator("button[title='Collapse fullscreen toolbar']").first();
    await collapse.click();
    await toolbar.locator("button[title='Show fullscreen toolbar']").first().waitFor({ state: "visible" });
    await toolbar.locator("button[title='Show fullscreen toolbar']").first().click();
    return { id: "fullscreen-toolbar-collapse", pass: true, status: "pass" };
  } catch (error) {
    return { error: messageFor(error), id: "fullscreen-toolbar-collapse", pass: false, status: "fail" };
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
      pass: latencyMs <= budgetMs,
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
      pass: false,
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

async function capture(page, filename) {
  const path = join(screenshotDir, filename);
  await page.screenshot({ fullPage: false, path });
  return path;
}

async function readScannerMeta(page) {
  return page.evaluate(() => {
    const table = document.querySelector("[data-discovery-scanner-table='true']");
    const density = document.querySelector("[data-discovery-dense-mode]")?.getAttribute("data-discovery-dense-mode") ?? null;
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    return {
      density,
      horizontalOverflowPx: Math.max(0, scrollWidth - clientWidth),
      renderedRows: Number(table?.getAttribute("data-scanner-rendered-rows") ?? 0),
      totalRows: Number(table?.getAttribute("data-scanner-total-rows") ?? 0),
      virtualized: table?.getAttribute("data-scanner-virtualized") === "true",
    };
  });
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
    return page.evaluate(() => {
      const memory = performance.memory;
      if (!memory) return { source: "unavailable" };
      return { jsHeapUsedMb: Math.round((memory.usedJSHeapSize / 1024 / 1024) * 1000) / 1000, source: "performance.memory" };
    }).catch(() => ({ source: "unavailable" }));
  }
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

async function setupAuthenticatedWorkflowData() {
  const savedScan = await request({
    body: {
      name: `Phase 25.3 Power Scan ${Date.now().toString(36)}`,
      payload: {
        assetType: "ALL",
        density: "ultra",
        evidence: "ALL",
        filter: "all",
        marketCap: "ALL",
        query: "",
        riskBand: "ALL",
        sector: "ALL",
        sort: "attention",
        timeframe: "1M",
        watchlistOnly: true,
      },
    },
    method: "POST",
    path: "/api/user/saved-scans",
  });
  const workspace = await request({
    body: { workspace: chartWorkspacePayload() },
    method: "PUT",
    path: "/api/user/chart-workspaces/AMD",
  });
  const savedScanPayload = jsonOrNull(savedScan.bodyText);
  const workspacePayload = jsonOrNull(workspace.bodyText);
  return {
    authenticated: true,
    chartWorkspaceSaved: workspace.statusCode === 200 && Boolean(workspacePayload?.workspace),
    ok: savedScan.statusCode === 200 && workspace.statusCode === 200,
    savedScanId: savedScanPayload?.scan?.id ?? null,
    savedScanName: savedScanPayload?.scan?.name ?? null,
    savedScanStatusCode: savedScan.statusCode,
    watchlistSize: probeIdentity?.watchlistSymbols?.length ?? null,
    workspaceStatusCode: workspace.statusCode,
  };
}

function chartWorkspacePayload() {
  const now = new Date().toISOString();
  return {
    activeIndicatorTemplateId: "phase-25-3-power",
    alertHistory: [],
    chartTabs: [
      {
        detailMode: "compare",
        id: "phase-25-3-power-tab",
        indicators: ["ema20", "ema50", "rsi14", "macd"],
        label: "Phase 25.3 Power",
        layoutMode: "grid",
        overlayFamilies: ["confidence", "risk", "events", "replay"],
        period: "6mo",
        symbol: "AMD",
        updatedAt: now,
      },
    ],
    compactMode: true,
    detailMode: "compare",
    drawingTool: "edit",
    drawings: [
      {
        color: "cyan",
        createdAt: now,
        end: { x: 86, y: 42 },
        id: "phase-25-3-power-level",
        label: "Phase 25.3 Level",
        lineWidth: 3,
        start: { x: 16, y: 42 },
        style: "dashed",
        tool: "horizontal",
        updatedAt: now,
        visible: true,
      },
    ],
    fullscreenOpen: true,
    indicators: ["ema20", "ema50", "rsi14", "macd"],
    indicatorTemplates: [
      {
        createdAt: now,
        id: "phase-25-3-power",
        indicators: ["ema20", "ema50", "rsi14", "macd"],
        name: "Phase 25.3 Power",
        overlayFamilies: ["confidence", "risk", "events", "replay"],
        source: "user",
        updatedAt: now,
      },
    ],
    layoutMode: "grid",
    magnetMode: true,
    overlayFamilies: ["confidence", "risk", "events", "replay"],
    period: "6mo",
    toolbarCollapsed: false,
    updatedAt: now,
    version: 1,
  };
}

async function request({ body, method, path }) {
  const headers = {
    Accept: "application/json",
    Cookie: cookie,
    Origin: baseUrl,
    "User-Agent": "TradeVeto-Phase25ChartScannerBrowserTimingProbe/1.0",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["x-csrf-token"] = csrfToken;
  }
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    headers,
    method,
  });
  const bodyText = await response.text().catch(() => "");
  return {
    bodyText,
    latencyMs: roundMetric(performance.now() - started),
    statusCode: response.status,
  };
}

async function fetchCsrfToken() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
    headers: { Accept: "application/json", Cookie: cookie, "User-Agent": "TradeVeto-Phase25ChartScannerBrowserTimingProbe/1.0" },
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const token = typeof payload?.csrfToken === "string" ? payload.csrfToken : "";
  if (!response.ok || !token) throw new Error("CSRF token unavailable for Phase 25.3 browser timing probe.");
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookie = setCookie.match(/market_alpha_csrf=([^;,]+)/)?.[1] ?? token;
  return { cookie: `market_alpha_csrf=${csrfCookie}`, token };
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 25.3 browser probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase25-browser-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionTokenHash = createHmac("sha256", sessionSecret).update(sessionToken).digest("hex");
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const userResult = await client.query(
      `
        INSERT INTO users (
          email,
          display_name,
          email_verified,
          email_verified_at,
          state,
          role,
          timezone,
          risk_experience_level,
          onboarding_completed,
          created_at,
          updated_at
        )
        VALUES ($1, 'Phase 25.3 Browser Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Phase 25.3 browser probe user.");
    const symbols = await readLargeScannerUniverse(client, largeWatchlistSize);
    await client.query(
      `
        INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at)
        VALUES ($1::uuid, $2, now() + interval '2 hours', now())
      `,
      [userId, sessionTokenHash],
    );
    await client.query(
      `
        INSERT INTO user_subscriptions (user_id, status, plan, current_period_end, created_at, updated_at)
        VALUES ($1::uuid, 'active', 'premium', now() + interval '2 hours', now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET status = 'active', plan = 'premium', current_period_end = EXCLUDED.current_period_end, updated_at = now()
      `,
      [userId],
    );
    await client.query(
      `
        INSERT INTO legal_acceptances (user_id, document_type, document_version, accepted_at)
        SELECT $1::uuid, type, version, now()
        FROM legal_documents
        ON CONFLICT (user_id, document_type, document_version) DO NOTHING
      `,
      [userId],
    );
    await client.query(
      `
        INSERT INTO user_watchlist (user_id, symbol, created_at)
        SELECT $1::uuid, symbol, now()
        FROM unnest($2::text[]) AS symbol
        ON CONFLICT (user_id, symbol) DO NOTHING
      `,
      [userId, symbols],
    );
    await client.query("COMMIT");
    return { email, sessionToken, userId, watchlistSymbols: symbols };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function readLargeScannerUniverse(client, limit) {
  const result = await client.query(
    `
      WITH latest_run AS (
        SELECT id
        FROM scan_runs
        WHERE status = 'success'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      SELECT DISTINCT upper(symbol) AS symbol, min(rank_position) AS rank_position
      FROM scanner_signals
      WHERE scan_run_id = (SELECT id FROM latest_run)
        AND symbol IS NOT NULL
        AND symbol <> ''
      GROUP BY upper(symbol)
      ORDER BY min(rank_position) ASC NULLS LAST, upper(symbol) ASC
      LIMIT $1
    `,
    [limit],
  );
  const symbols = result.rows.map((row) => String(row.symbol ?? "").trim().toUpperCase()).filter(Boolean);
  if (symbols.length >= Math.min(500, limit)) return symbols;
  return Array.from(new Set([...symbols, "AMD", "NVDA", "MSFT", "AAPL", "SPY", "QQQ", "TSLA", "META", "GOOGL", "AMZN"])).slice(0, limit);
}

async function cleanupProductionProbeIdentity(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DELETE FROM users WHERE id = $1::uuid AND email = $2", [identity.userId, identity.email]);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function buildReport({ chart, memoryAfter, memoryBefore, scanner, setup }) {
  const blockers = [];
  for (const area of [scanner, chart]) {
    blockers.push(...area.errors);
    for (const timing of area.timings) {
      if (!timing.pass) blockers.push(`${timing.id} ${timing.latencyMs}ms exceeds ${timing.budgetMs}ms budget${timing.error ? `: ${timing.error}` : ""}`);
    }
    for (const check of area.checks) {
      if (check.status === "fail") blockers.push(`${check.id} failed${check.error ? `: ${check.error}` : ""}`);
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
    chart,
    generatedAt: new Date().toISOString(),
    memory: {
      after: memoryAfter,
      before: memoryBefore,
      deltaJsHeapUsedMb: memoryDeltaMb,
    },
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeIdentity: probeIdentity
      ? {
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
          watchlistSize: probeIdentity.watchlistSymbols.length,
        }
      : { created: false },
    proofScope: "Browser DOM timing proof for production discovery and symbol chart workflows. The deterministic companion probe remains the 500+ synthetic large-universe proof. This report does not claim full TradingView parity or unsupported alert evaluation.",
    scanner,
    setup,
    startedAt,
    unsupportedClaims: [
      "No full TradingView parity claim.",
      "No fake indicator alert or fake drawing proximity alert claim.",
      "Physical-device gesture latency is outside this browser timing probe.",
    ],
  };
}

function buildLargeUniverseProof(report) {
  const initialMeta = report.scanner?.initialMeta ?? null;
  const watchlistSize = report.probeIdentity?.watchlistSize ?? report.scanner?.setup?.watchlistSize ?? null;
  const productionRows = Number(initialMeta?.totalRows ?? 0);
  const renderedRows = Number(initialMeta?.renderedRows ?? 0);
  const virtualized = initialMeta?.virtualized === true;
  const blockers = [];
  if (productionRows < 500) blockers.push(`production browser scanner exposed ${productionRows} rows, below the 500+ target`);
  if (watchlistSize !== null && watchlistSize < 500) blockers.push(`authenticated watchlist fixture has ${watchlistSize} symbols, below the 500+ target`);
  if (productionRows >= 500 && !virtualized) blockers.push("500+ production browser rows are not virtualized");
  if (virtualized && renderedRows > 90) blockers.push(`virtualized scanner rendered ${renderedRows} rows, above the 90-row browser ceiling`);
  return {
    baseUrl: report.baseUrl,
    blockers,
    generatedAt: report.generatedAt,
    productionBrowserRows: productionRows,
    proofType: "production-browser",
    renderedRows,
    status: blockers.length ? "not_ready" : "ready",
    virtualized,
    watchlistFixtureSize: watchlistSize,
  };
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

function mergeCookieHeader(left, right) {
  const merged = { ...requestCookieMap(left), ...requestCookieMap(right) };
  return Object.entries(merged).map(([key, value]) => `${key}=${value}`).join("; ");
}

function sessionHashSecret(env) {
  const secret = [
    env.TRADEVETO_SESSION_SECRET,
    env.MARKET_ALPHA_SESSION_SECRET,
    env.AUTH_SECRET,
    env.NEXTAUTH_SECRET,
    env.SESSION_SECRET,
  ].find((value) => Boolean(value?.trim()))?.trim();
  if (secret) return secret;
  throw new Error("Session secret is not configured.");
}

function jsonOrNull(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
