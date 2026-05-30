#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium, firefox, webkit } from "playwright";
import pg from "pg";

const { Pool } = pg;

const browserLaunchers = { chromium, firefox, webkit };
const phaseLabel = process.env.TRADEVETO_CHART_SYMBOL_PHASE_LABEL ?? "Phase 28.1";
const phaseSlug = process.env.TRADEVETO_CHART_SYMBOL_PHASE_SLUG ?? "phase28";
const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE29_BASE_URL ?? process.env.TRADEVETO_PHASE28_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = resolve(process.cwd(), process.env.TRADEVETO_PHASE29_ARTIFACT_ROOT ?? process.env.TRADEVETO_PHASE28_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-28-1-chart-symbol-latency");
const outputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE29_OUTPUT ?? process.env.TRADEVETO_PHASE28_OUTPUT ?? join(artifactRoot, `${phaseSlug}-chart-symbol-latency.json`));
const screenshotDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE29_SCREENSHOT_DIR ?? process.env.TRADEVETO_PHASE28_SCREENSHOT_DIR ?? join(artifactRoot, "screenshots"));
const traceDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE29_TRACE_DIR ?? process.env.TRADEVETO_PHASE28_TRACE_DIR ?? join(artifactRoot, "traces"));
const headless = (process.env.TRADEVETO_PHASE29_HEADLESS ?? process.env.TRADEVETO_PHASE28_HEADLESS) !== "false";
const strict = truthy(process.env.TRADEVETO_PHASE29_STRICT ?? process.env.TRADEVETO_PHASE28_STRICT);
const waitTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE29_WAIT_TIMEOUT_MS ?? process.env.TRADEVETO_PHASE28_WAIT_TIMEOUT_MS, 12_000);
const navigationTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE29_NAVIGATION_TIMEOUT_MS ?? process.env.TRADEVETO_PHASE28_NAVIGATION_TIMEOUT_MS, 90_000);
const browserNames = parseBrowserList(process.env.TRADEVETO_PHASE29_BROWSERS ?? process.env.TRADEVETO_PHASE28_BROWSERS ?? "chromium,firefox,webkit");
const createProbeIdentity = (process.env.TRADEVETO_PHASE29_CREATE_PROBE_USER ?? process.env.TRADEVETO_PHASE28_CREATE_PROBE_USER) !== "false" && Boolean(process.env.DATABASE_URL);
const cleanupProbeIdentity = (process.env.TRADEVETO_PHASE29_CLEANUP_PROBE_USER ?? process.env.TRADEVETO_PHASE28_CLEANUP_PROBE_USER) !== "false";

const budgets = {
  chartInteractionMs: 60,
  chartRestoreMs: 250,
  fullscreenChartOpenMs: 150,
  symbolPageInteractiveMs: 2_500,
  symbolSearchOpenMs: 100,
  symbolSwitchMs: 150,
};

let cookie = process.env.TRADEVETO_PHASE28_COOKIE ?? "";
let probeIdentity = null;

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  await mkdir(traceDir, { recursive: true });
  const startedAt = new Date().toISOString();
  let setup = { authenticated: Boolean(cookie), chartWorkspaceSaved: false };
  let cleanupError = null;
  let fatalError = null;
  const browserReports = [];
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (cookie) setup = await setupAuthenticatedWorkspace().catch((error) => ({ authenticated: true, chartWorkspaceSaved: false, error: messageFor(error) }));
    for (const browserName of browserNames) {
      browserReports.push(await runBrowserProof(browserName));
    }
  } catch (error) {
    fatalError = messageFor(error);
  } finally {
    if (probeIdentity && cleanupProbeIdentity) {
      await cleanupProductionProbeIdentity(probeIdentity).catch((error) => {
        cleanupError = messageFor(error);
      });
    }
  }
  const report = buildReport({ browserReports, cleanupError, fatalError, setup, startedAt });
  await writeReport(report);
  if (report.overallStatus !== "ready" && strict) process.exitCode = 1;
}

async function runBrowserProof(browserName) {
  const launcher = browserLaunchers[browserName];
  const startedAt = new Date().toISOString();
  if (!launcher) {
    return { browserName, error: `Unsupported browser ${browserName}`, overallStatus: "not_ready", startedAt };
  }
  let browser = null;
  try {
    browser = await launcher.launch({ headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      userAgent: `TradeVeto-${phaseSlug}-ChartSymbolLatency/${browserName}`,
      viewport: { height: 960, width: 1440 },
    });
    if (cookie) await context.addCookies(cookieHeaderToBrowserCookies(cookie));
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(waitTimeoutMs);
    await installMetricBuffer(page);
    const route = await measureSymbolRoute(page);
    const interactions = await runChartSymbolInteractions(page);
    const finalRouteTimingMarks = await readRouteTimingMarks(page);
    const finalNavigationTiming = await readNavigationTiming(page);
    const timingBreakdown = buildTimingBreakdown({ finalNavigationTiming, finalRouteTimingMarks, route });
    const screenshotPath = await capture(page, browserName, "symbol-workflow.png").catch(() => null);
    const tracePath = join(traceDir, `${browserName}-${phaseSlug}-trace.zip`);
    await context.tracing.stop({ path: tracePath }).catch(() => undefined);
    await context.close();
    return {
      browserName,
      generatedAt: new Date().toISOString(),
      interactions,
      overallStatus: route.status === "pass" && interactions.every((item) => item.status === "pass") ? "ready" : "not_ready",
      route,
      screenshotPath,
      startedAt,
      timingBreakdown,
      tracePath,
    };
  } catch (error) {
    return { browserName, error: messageFor(error), generatedAt: new Date().toISOString(), overallStatus: "not_ready", startedAt };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function measureSymbolRoute(page) {
  const started = performance.now();
  const timings = {
    bodyVisibleMs: null,
    deepHydrationCompleteObservedMs: null,
    firstShellVisibleMs: null,
    gotoCommitMs: null,
    shellInteractiveObservedMs: null,
  };
  try {
    const response = await page.goto(`${baseUrl}/symbol/AMD`, { waitUntil: "commit" });
    timings.gotoCommitMs = roundMetric(performance.now() - started);
    await page.locator("body").waitFor({ state: "visible", timeout: waitTimeoutMs });
    timings.bodyVisibleMs = roundMetric(performance.now() - started);
    await dismissRiskAcknowledgement(page);
    await page.locator("[data-chart-symbol='AMD']").first().waitFor({ state: "visible", timeout: waitTimeoutMs });
    timings.firstShellVisibleMs = roundMetric(performance.now() - started);
    const shellInteractive = await waitForRouteTimingMark(page, ["symbol:shell-interactive"], 750).catch(() => null);
    timings.shellInteractiveObservedMs = shellInteractive ? roundMetric(performance.now() - started) : null;
    const interactiveMs = timings.firstShellVisibleMs;
    const deepHydration = await waitForRouteTimingMark(page, ["symbol:deep-hydration-complete"], 5_000).catch(() => null);
    timings.deepHydrationCompleteObservedMs = deepHydration ? roundMetric(performance.now() - started) : null;
    const routeTimingMarks = await readRouteTimingMarks(page);
    const navigationTiming = await readNavigationTiming(page);
    return {
      budgetMs: budgets.symbolPageInteractiveMs,
      httpStatus: response?.status() ?? null,
      interactiveMs,
      measurementNote: "interactiveMs is measured at the first visible verified symbol/chart shell; deep hydration observation is reported separately and does not count against the route interactive budget.",
      navigationTiming,
      path: "/symbol/AMD",
      routeTimingMarks,
      status: interactiveMs <= budgets.symbolPageInteractiveMs ? "pass" : "fail",
      timings,
    };
  } catch (error) {
    const routeTimingMarks = await readRouteTimingMarks(page);
    const navigationTiming = await readNavigationTiming(page);
    return {
      budgetMs: budgets.symbolPageInteractiveMs,
      error: messageFor(error),
      interactiveMs: roundMetric(performance.now() - started),
      navigationTiming,
      path: "/symbol/AMD",
      routeTimingMarks,
      status: "fail",
      timings,
    };
  }
}

async function runChartSymbolInteractions(page) {
  const interactions = [];
  interactions.push(await measureExistingBrowserMetric(page, "chart-restore", "AMD chart workspace shell restore", budgets.chartRestoreMs, ["chart:workspace-restore"]));
  interactions.push(await measureBrowserWorkflow(page, "fullscreen-chart-open", "Open AMD fullscreen chart", budgets.fullscreenChartOpenMs, ["chart:fullscreen-open"], async () => {
    await page.locator("[data-chart-expand-trigger='AMD']").first().click({ timeout: waitTimeoutMs });
    await page.locator("[data-chart-fullscreen-toolbar='true']").first().waitFor({ state: "visible", timeout: waitTimeoutMs });
  }));
  interactions.push(await measureBrowserWorkflow(page, "chart-toolbar-interaction", "Switch fullscreen chart to compare mode", budgets.chartInteractionMs, ["chart:toolbar-interaction"], async () => {
    await page.locator("[data-chart-fullscreen-toolbar='true']").getByRole("button", { name: /^compare$/i }).first().click({ timeout: waitTimeoutMs });
    await page.locator("[data-chart-fullscreen-toolbar='true'][data-chart-fullscreen-mode='compare']").first().waitFor({ state: "visible", timeout: waitTimeoutMs });
  }));
  await closeExpandedChart(page);
  interactions.push(await measureBrowserWorkflow(page, "symbol-switch", "Switch from AMD to NVDA using chart navigation", budgets.symbolSwitchMs, ["symbol:switch"], async () => {
    const nextButton = page.getByRole("button", { name: /next symbol/i }).first();
    await nextButton.waitFor({ state: "visible", timeout: waitTimeoutMs });
    await Promise.all([
      page.waitForURL(/\/symbol\/NVDA/, { timeout: waitTimeoutMs }).catch(() => undefined),
      nextButton.click({ timeout: waitTimeoutMs }),
    ]);
    await page.locator("[data-chart-symbol='NVDA']").first().waitFor({ state: "visible", timeout: waitTimeoutMs });
  }));
  interactions.push(await measureBrowserWorkflow(page, "symbol-search-open", "Open global symbol command search", budgets.symbolSearchOpenMs, ["symbol-search:open"], async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    await page.locator("[role='dialog'][aria-label='Global symbol search'] [data-symbol-search-input='true']").first().waitFor({ state: "visible", timeout: waitTimeoutMs });
  }));
  return interactions;
}

async function measureExistingBrowserMetric(page, id, label, budgetMs, metricIds) {
  const browserMetric = await waitForWorkflowMetric(page, metricIds, 0);
  const latencyMs = browserMetric?.latencyMs ?? null;
  return {
    browserMetricId: browserMetric?.id ?? null,
    budgetMs,
    id,
    label,
    latencyMs,
    status: latencyMs !== null && latencyMs <= budgetMs ? "pass" : "fail",
    timingSource: browserMetric ? "browser-performance" : "missing-browser-metric",
  };
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
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const metrics = await readWorkflowMetrics(page);
    const candidates = metrics.length >= beforeCount ? metrics.slice(beforeCount) : metrics;
    const next = candidates.find((metric) => ids.includes(metric.id));
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

async function installMetricBuffer(page) {
  await page.addInitScript(() => {
    window.__tradevetoBrowserWorkflowMetrics = window.__tradevetoBrowserWorkflowMetrics ?? [];
    window.__tradevetoSymbolRouteTimings = window.__tradevetoSymbolRouteTimings ?? [];
    window.__tradevetoSymbolRouteTimings.push({
      atMs: performance.now(),
      id: "page:init-script",
      recordedAt: new Date().toISOString(),
    });
  });
}

async function waitForRouteTimingMark(page, ids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const marks = await readRouteTimingMarks(page);
    const next = marks.find((mark) => ids.includes(mark.id));
    if (next) return next;
    await page.waitForTimeout(25);
  }
  const marks = await readRouteTimingMarks(page);
  return marks.find((mark) => ids.includes(mark.id)) ?? null;
}

async function readRouteTimingMarks(page) {
  return page.evaluate(() => {
    const marks = window.__tradevetoSymbolRouteTimings;
    return Array.isArray(marks) ? marks : [];
  }).catch(() => []);
}

async function readNavigationTiming(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (!nav) return null;
    const item = nav;
    return {
      connectEnd: round(item.connectEnd),
      connectStart: round(item.connectStart),
      domComplete: round(item.domComplete),
      domContentLoadedEventEnd: round(item.domContentLoadedEventEnd),
      domInteractive: round(item.domInteractive),
      domainLookupEnd: round(item.domainLookupEnd),
      domainLookupStart: round(item.domainLookupStart),
      fetchStart: round(item.fetchStart),
      loadEventEnd: round(item.loadEventEnd),
      name: item.name,
      redirectEnd: round(item.redirectEnd),
      redirectStart: round(item.redirectStart),
      requestStart: round(item.requestStart),
      responseEnd: round(item.responseEnd),
      responseStart: round(item.responseStart),
      secureConnectionStart: round(item.secureConnectionStart),
      startTime: round(item.startTime),
      transferSize: item.transferSize,
      type: item.type,
    };

    function round(value) {
      return Math.round(Number(value ?? 0) * 1000) / 1000;
    }
  }).catch(() => null);
}

function buildTimingBreakdown({ finalNavigationTiming, finalRouteTimingMarks, route }) {
  const mark = (id) => finalRouteTimingMarks.find((item) => item.id === id) ?? null;
  const switchStart = mark("symbol:switch-start");
  const switchComplete = mark("symbol:switch-complete");
  const chartRenderStart = mark("chart:render-start");
  const chartRenderComplete = mark("chart:render-complete");
  const firstShellVisible = mark("symbol:first-shell-visible");
  const shellInteractive = mark("symbol:shell-interactive");
  const deepHydrationStart = mark("symbol:deep-hydration-start");
  const deepHydrationComplete = mark("symbol:deep-hydration-complete");
  const nav = finalNavigationTiming ?? route.navigationTiming;
  return {
    chartRenderCompleteAtMs: numberOrNull(chartRenderComplete?.atMs),
    chartRenderDurationMs: deltaMs(chartRenderStart, chartRenderComplete),
    chartRenderStartAtMs: numberOrNull(chartRenderStart?.atMs),
    deepHydrationCompleteAtMs: numberOrNull(deepHydrationComplete?.atMs),
    deepHydrationDurationMs: deltaMs(deepHydrationStart, deepHydrationComplete),
    deepHydrationServerDurationMs: numberOrNull(deepHydrationComplete?.detail?.serverDurationMs),
    deepHydrationStartAtMs: numberOrNull(deepHydrationStart?.atMs),
    domContentLoadedMs: numberOrNull(nav?.domContentLoadedEventEnd),
    firstShellVisibleAtMs: numberOrNull(firstShellVisible?.atMs ?? route.timings?.firstShellVisibleMs),
    htmlStreamingStartMs: numberOrNull(nav?.responseStart),
    htmlStreamingEndMs: numberOrNull(nav?.responseEnd),
    pageGotoCommitMs: route.timings?.gotoCommitMs ?? null,
    requestStartMs: numberOrNull(nav?.requestStart),
    shellInteractiveAtMs: numberOrNull(shellInteractive?.atMs ?? route.timings?.shellInteractiveObservedMs),
    symbolSwitchCompleteAtMs: numberOrNull(switchComplete?.atMs),
    symbolSwitchDurationMs: deltaMs(switchStart, switchComplete),
    symbolSwitchStartAtMs: numberOrNull(switchStart?.atMs),
    ttfbMs: nav ? roundMetric(Math.max(0, nav.responseStart - (nav.requestStart || nav.startTime || 0))) : null,
  };
}

function deltaMs(startMark, completeMark) {
  const start = numberOrNull(startMark?.atMs);
  const complete = numberOrNull(completeMark?.atMs);
  return start === null || complete === null ? null : roundMetric(Math.max(0, complete - start));
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundMetric(parsed) : null;
}

async function closeExpandedChart(page) {
  await page.keyboard.press("Escape").catch(() => undefined);
  if (await page.locator("[data-chart-fullscreen-toolbar='true']").first().isVisible({ timeout: 500 }).catch(() => false)) {
    await page.getByRole("button", { name: /close expanded chart/i }).first().click({ timeout: 2_000 }).catch(() => undefined);
  }
  await page.locator("[data-chart-fullscreen-toolbar='true']").first().waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
}

async function dismissRiskAcknowledgement(page) {
  const checkbox = page.getByRole("checkbox", { name: /financial advice|understand|risk/i }).first();
  if (await checkbox.isVisible({ timeout: 150 }).catch(() => false)) {
    await checkbox.check({ force: true }).catch(() => undefined);
  }
  const button = page.getByRole("button", { name: /continue|understand|accept/i }).first();
  if (await button.isVisible({ timeout: 150 }).catch(() => false)) {
    await button.click({ force: true }).catch(() => undefined);
  }
}

async function setupAuthenticatedWorkspace() {
  const csrf = await fetchCsrfToken();
  cookie = mergeCookieHeader(cookie, csrf.cookie);
  const workspace = await request({
    body: { workspace: chartWorkspacePayload() },
    method: "PUT",
    path: "/api/user/chart-workspaces/AMD",
    token: csrf.token,
  });
  const me = await request({ method: "GET", path: "/api/auth/me" });
  const payload = jsonOrNull(me.bodyText);
  return {
    authenticated: payload?.authenticated === true,
    chartWorkspaceSaved: workspace.statusCode === 200,
    premium: payload?.premium === true,
    workspaceStatusCode: workspace.statusCode,
  };
}

async function request({ body, method, path, token }) {
  const headers = {
    Accept: "application/json",
    Cookie: cookie,
    Origin: baseUrl,
    "User-Agent": `TradeVeto-${phaseSlug}-ChartSymbolLatency/1.0`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    if (token) headers["x-csrf-token"] = token;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    headers,
    method,
  });
  return { bodyText: await response.text().catch(() => ""), statusCode: response.status };
}

async function fetchCsrfToken() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
    headers: { Accept: "application/json", Cookie: cookie, "User-Agent": `TradeVeto-${phaseSlug}-ChartSymbolLatency/1.0` },
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const token = typeof payload?.csrfToken === "string" ? payload.csrfToken : "";
  if (!response.ok || !token) throw new Error("CSRF token unavailable for Phase 28.1 browser timing probe.");
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookie = setCookie.match(/market_alpha_csrf=([^;,]+)/)?.[1] ?? token;
  return { cookie: `market_alpha_csrf=${csrfCookie}`, token };
}

function chartWorkspacePayload() {
  const now = new Date().toISOString();
  return {
    activeIndicatorTemplateId: `${phaseSlug}-latency`,
    alertHistory: [],
    chartTabs: [],
    compactMode: true,
    detailMode: "overlays",
    drawingTool: "edit",
    drawings: [],
    fullscreenOpen: false,
    indicators: ["ema20", "ema50", "rsi14"],
    indicatorTemplates: [
      {
        createdAt: now,
        id: `${phaseSlug}-latency`,
        indicators: ["ema20", "ema50", "rsi14"],
        name: `${phaseLabel} Latency`,
        overlayFamilies: ["confidence", "risk", "events", "replay"],
        source: "user",
        updatedAt: now,
      },
    ],
    layoutMode: "focus",
    magnetMode: false,
    overlayFamilies: ["confidence", "risk", "events", "replay"],
    period: "6mo",
    toolbarCollapsed: false,
    updatedAt: now,
    version: 1,
  };
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 28.1 browser probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `${phaseSlug}-chart-symbol-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, $2, true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email, `${phaseLabel} Chart Symbol Probe`],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Phase 28.1 browser probe user.");
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
      [userId, ["AMD", "NVDA", "QQQ", "SPY", "AVGO", "MSFT"]],
    );
    await client.query("COMMIT");
    return { email, sessionToken, userId };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
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

function buildReport({ browserReports, cleanupError, fatalError, setup, startedAt }) {
  const blockers = [];
  if (fatalError) blockers.push(fatalError);
  if (!setup.authenticated) blockers.push("authenticated premium probe session was not validated");
  if (!setup.chartWorkspaceSaved) blockers.push("authenticated chart workspace fixture was not saved");
  if (cleanupError) blockers.push(`probe identity cleanup failed: ${cleanupError}`);
  for (const report of browserReports) {
    if (report.error) blockers.push(`${report.browserName}: ${report.error}`);
    if (report.route?.status !== "pass") blockers.push(`${report.browserName} /symbol/AMD interactive ${report.route?.interactiveMs ?? "unknown"}ms exceeds ${budgets.symbolPageInteractiveMs}ms`);
    for (const interaction of report.interactions ?? []) {
      if (interaction.status !== "pass") blockers.push(`${report.browserName} ${interaction.id}: ${interaction.latencyMs ?? "missing"}ms exceeds ${interaction.budgetMs}ms${interaction.error ? ` (${interaction.error})` : ""}`);
    }
  }
  return {
    baseUrl,
    blockers,
    browserReports,
    budgets,
    generatedAt: new Date().toISOString(),
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeIdentity: probeIdentity ? { cleanupRequested: cleanupProbeIdentity, created: true, email: probeIdentity.email, userId: probeIdentity.userId } : { created: false },
    proofScope: `Focused production browser proof for ${phaseLabel} chart restore, fullscreen open, chart toolbar interaction, symbol switch, symbol search open, and /symbol/AMD interactive timing.`,
    setup,
    startedAt,
  };
}

async function writeReport(report) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  if (report.overallStatus === "ready") console.log(serialized);
  else console.error(serialized);
}

async function capture(page, browserName, filename) {
  const path = join(screenshotDir, browserName, filename);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ fullPage: false, path });
  return path;
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

function parseBrowserList(value) {
  return value.split(",").map((item) => item.trim().toLowerCase()).filter((item) => item in browserLaunchers);
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

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

await main();
