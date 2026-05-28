#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE285_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = resolve(process.cwd(), process.env.TRADEVETO_PHASE285_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-28-5-large-universe-scanner-proof");
const outputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE285_OUTPUT ?? join(artifactRoot, "large-universe-scanner-proof.json"));
const screenshotDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE285_SCREENSHOT_DIR ?? join(artifactRoot, "screenshots"));
const navigationTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE285_NAVIGATION_TIMEOUT_MS, 90_000);
const waitTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE285_WAIT_TIMEOUT_MS, 30_000);
const strict = truthy(process.env.TRADEVETO_PHASE285_STRICT);
const headless = process.env.TRADEVETO_PHASE285_HEADLESS !== "false";
const createProbeIdentity = process.env.TRADEVETO_PHASE285_CREATE_PROBE_USER !== "false" && Boolean(process.env.DATABASE_URL);
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE285_CLEANUP_PROBE_USER !== "false";

const budgets = {
  compareOpenMs: 150,
  fullscreenScannerMs: 100,
  rowExpansionMs: 100,
  savedScanRestoreMs: 250,
  scannerFilterMs: 100,
  scannerScrollMs: 100,
  scannerSortMs: 100,
  scannerSearchMs: 100,
};

let browser = null;
let probeIdentity = null;
let cookie = process.env.TRADEVETO_PHASE285_COOKIE ?? "";
let csrfToken = "";

async function main() {
  const startedAt = new Date().toISOString();
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

    const setup = cookie ? await setupSavedScanFixture().catch((error) => ({ error: messageFor(error), ok: false })) : { authenticated: false, ok: false };
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      userAgent: "TradeVeto-Phase28LargeUniverseScannerProof/1.0",
      viewport: { height: 1000, width: 1440 },
    });
    if (cookie) await context.addCookies(cookieHeaderToBrowserCookies(cookie));
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(waitTimeoutMs);

    const result = await runScannerProof(page, setup);
    await context.close();
    report = buildReport({ result, setup, startedAt });
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
  if (strict && report.overallStatus !== "ready") process.exitCode = 1;
}

async function runScannerProof(page, setup) {
  const timings = [];
  const checks = [];
  const screenshots = [];
  const proofUrl = `${baseUrl}/discover?proof=large-universe`;

  await page.goto(proofUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
  await dismissRiskAcknowledgement(page);
  await page.locator("[data-discovery-workspace='true'][data-discovery-proof-mode='large-universe']").waitFor({ state: "visible" });

  const memoryBefore = await readBrowserMemory(page);
  const domBefore = await readDomStats(page);

  timings.push(await measureBrowserWorkflow(page, "scanner-interaction", "Switch large-universe scanner to ultra-dense mode", budgets.scannerFilterMs, ["scanner:ultra-dense", "scanner:density-change"], async () => {
    await page.locator("button[title='Ultra dense scanner']").first().click();
    await page.locator("[data-discovery-dense-mode='ultra']").waitFor({ state: "visible" });
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
  }));

  const initialMeta = await readScannerMeta(page);
  screenshots.push(await capture(page, "large-universe-ultra-dense.png"));

  timings.push(await measureBrowserWorkflow(page, "scanner-filter", "Filter 500+ scanner rows", budgets.scannerFilterMs, ["scanner:filter"], async () => {
    const input = page.locator("[data-discovery-search-input='true']").first();
    await input.fill("");
    await input.fill("test-only");
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
  }));
  const filteredMeta = await readScannerMeta(page);

  timings.push(await measureBrowserWorkflow(page, "scanner-search", "Search large-universe proof symbols", budgets.scannerSearchMs, ["scanner:filter"], async () => {
    const input = page.locator("[data-discovery-search-input='true']").first();
    await input.fill("");
    await input.fill("TVP");
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
  }));
  const searchedMeta = await readScannerMeta(page);

  await page.locator("[data-discovery-search-input='true']").first().fill("");

  timings.push(await measureBrowserWorkflow(page, "scanner-sort", "Sort 500+ scanner rows by confidence", budgets.scannerSortMs, ["scanner:sort"], async () => {
    await page.locator("[data-discovery-scanner-table='true'] [data-scanner-sort-column='confidence']").first().click();
    await page.locator("[data-discovery-scanner-table='true'][data-scanner-sort='confidence']").waitFor({ state: "visible" });
  }));

  timings.push(await measureBrowserWorkflow(page, "compare-open", "Open compare matrix from 500+ scanner rows", budgets.compareOpenMs, ["scanner:compare-open"], async () => {
    await page.getByRole("button", { name: /compare top/i }).first().click();
    await page.locator("[data-discovery-compare-panel='true'][data-compare-count='8']").waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "large-universe-compare.png"));

  timings.push(await measureBrowserWorkflow(page, "saved-scan-restore", "Restore saved large-universe scanner preset", budgets.savedScanRestoreMs, ["scanner:ultra-dense", "scanner:density-change"], async () => {
    if (!setup.savedScanName) throw new Error("authenticated saved scan fixture unavailable");
    await page.getByText(setup.savedScanName, { exact: false }).first().click();
    await page.locator("[data-discovery-dense-mode='ultra']").waitFor({ state: "visible" });
  }));
  const savedScanMeta = await readScannerMeta(page);

  timings.push(await measureBrowserWorkflow(page, "row-expansion", "Expand a scanner row in 500+ universe", budgets.rowExpansionMs, ["scanner:row-expansion"], async () => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    await page.locator("[data-scanner-expanded-row='true']").first().waitFor({ state: "visible" });
  }));

  timings.push(await measureBrowserWorkflow(page, "fullscreen-scanner", "Open fullscreen scanner in 500+ universe", budgets.fullscreenScannerMs, ["scanner:fullscreen-toggle"], async () => {
    await page.getByRole("button", { name: /fullscreen/i }).filter({ hasText: /fullscreen/i }).first().click();
    await page.locator("[data-scanner-fullscreen='true']").waitFor({ state: "visible" });
  }));
  screenshots.push(await capture(page, "large-universe-fullscreen.png"));

  timings.push(await measure("scanner-scroll-window", "Scroll the virtualized scanner window without unbounded rendering", budgets.scannerScrollMs, async () => {
    await page.locator("[data-discovery-scanner-table='true']").first().evaluate((table) => {
      const scroller = table.querySelector("[data-scanner-scroll-container='true']") ?? table.querySelector(".overflow-y-auto");
      if (scroller instanceof HTMLElement) {
        scroller.scrollTop = 8000;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await page.waitForTimeout(50);
  }));
  const scrolledMeta = await readScannerMeta(page);

  const keyboard = await probeKeyboardNavigation(page);
  checks.push(keyboard);

  const memoryAfter = await readBrowserMemory(page);
  const domAfter = await readDomStats(page);

  return {
    checks,
    dom: {
      after: domAfter,
      before: domBefore,
      deltaNodes: domAfter.nodeCount - domBefore.nodeCount,
    },
    filteredMeta,
    initialMeta,
    memory: memorySummary(memoryBefore, memoryAfter),
    proofUrl,
    savedScanMeta,
    screenshots,
    scrolledMeta,
    searchedMeta,
    timings,
  };
}

async function probeKeyboardNavigation(page) {
  try {
    await page.keyboard.press("/");
    const focusedSearch = await page.locator("[data-discovery-search-input='true']").first().evaluate((node) => node === document.activeElement);
    await page.keyboard.press("Escape");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.keyboard.press("x");
    await page.locator("[data-discovery-scanner-table='true']").waitFor({ state: "visible" });
    return { focusedSearch, id: "scanner-keyboard-navigation", pass: Boolean(focusedSearch), status: focusedSearch ? "pass" : "fail" };
  } catch (error) {
    return { error: messageFor(error), id: "scanner-keyboard-navigation", pass: false, status: "fail" };
  }
}

async function measure(id, label, budgetMs, operation) {
  const started = performance.now();
  try {
    await operation();
    const latencyMs = roundMetric(performance.now() - started);
    return { budgetMs, id, label, latencyMs, pass: latencyMs <= budgetMs, status: latencyMs <= budgetMs ? "pass" : "fail" };
  } catch (error) {
    return { budgetMs, error: messageFor(error), id, label, latencyMs: roundMetric(performance.now() - started), pass: false, status: "fail" };
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

async function readScannerMeta(page) {
  return page.evaluate(() => {
    const table = document.querySelector("[data-discovery-scanner-table='true']");
    const density = document.querySelector("[data-discovery-dense-mode]")?.getAttribute("data-discovery-dense-mode") ?? null;
    const workspace = document.querySelector("[data-discovery-workspace='true']");
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    return {
      density,
      horizontalOverflowPx: Math.max(0, scrollWidth - clientWidth),
      proofMode: workspace?.getAttribute("data-discovery-proof-mode") ?? null,
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

async function readDomStats(page) {
  return page.evaluate(() => ({
    nodeCount: document.querySelectorAll("*").length,
    scannerRowsInDom: document.querySelectorAll("[data-scanner-expanded-row='true'], [data-discovery-scanner-table='true'] [data-stable-overlay-trigger='true']").length,
  }));
}

function memorySummary(before, after) {
  const deltaJsHeapUsedMb = before.jsHeapUsedMb !== undefined && after.jsHeapUsedMb !== undefined
    ? roundMetric(after.jsHeapUsedMb - before.jsHeapUsedMb)
    : null;
  return { after, before, deltaJsHeapUsedMb };
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

async function setupSavedScanFixture() {
  const savedScan = await request({
    body: {
      name: `Phase 28.5 Large Universe ${Date.now().toString(36)}`,
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
  const savedScanPayload = jsonOrNull(savedScan.bodyText);
  return {
    authenticated: true,
    ok: savedScan.statusCode === 200,
    savedScanId: savedScanPayload?.scan?.id ?? null,
    savedScanName: savedScanPayload?.scan?.name ?? null,
    savedScanStatusCode: savedScan.statusCode,
  };
}

async function request({ body, method, path }) {
  const headers = {
    Accept: "application/json",
    Cookie: cookie,
    Origin: baseUrl,
    "User-Agent": "TradeVeto-Phase28LargeUniverseScannerProof/1.0",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["x-csrf-token"] = csrfToken;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    headers,
    method,
  });
  return {
    bodyText: await response.text().catch(() => ""),
    statusCode: response.status,
  };
}

async function fetchCsrfToken() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
    headers: { Accept: "application/json", Cookie: cookie, "User-Agent": "TradeVeto-Phase28LargeUniverseScannerProof/1.0" },
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const token = typeof payload?.csrfToken === "string" ? payload.csrfToken : "";
  if (!response.ok || !token) throw new Error("CSRF token unavailable for Phase 28.5 large-universe scanner proof.");
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookie = setCookie.match(/market_alpha_csrf=([^;,]+)/)?.[1] ?? token;
  return { cookie: `market_alpha_csrf=${csrfCookie}`, token };
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 28.5 browser probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase28-large-universe-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 28.5 Large Universe Browser Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Phase 28.5 browser probe user.");
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

function buildReport({ result, setup, startedAt }) {
  const blockers = [];
  const metas = [result.initialMeta, result.filteredMeta, result.searchedMeta, result.savedScanMeta, result.scrolledMeta].filter(Boolean);
  if (result.initialMeta.proofMode !== "large-universe") blockers.push(`proof mode not active: ${result.initialMeta.proofMode ?? "missing"}`);
  if (result.initialMeta.totalRows < 500) blockers.push(`production browser scanner exposed ${result.initialMeta.totalRows} rows, below 500+ target`);
  if (!result.initialMeta.virtualized) blockers.push("large-universe scanner did not enable virtualization");
  if (result.initialMeta.renderedRows > 90) blockers.push(`initial virtualized scanner rendered ${result.initialMeta.renderedRows} rows, above 90-row ceiling`);
  if (metas.some((meta) => meta.horizontalOverflowPx > 0)) blockers.push(`horizontal overflow observed: ${Math.max(...metas.map((meta) => meta.horizontalOverflowPx))}px`);
  if (result.scrolledMeta.renderedRows > 90) blockers.push(`scrolled virtualized scanner rendered ${result.scrolledMeta.renderedRows} rows, above 90-row ceiling`);
  if (result.dom.deltaNodes > 900) blockers.push(`DOM node count grew by ${result.dom.deltaNodes}, above bounded proof ceiling`);
  if (result.memory.deltaJsHeapUsedMb !== null && result.memory.deltaJsHeapUsedMb > 120) blockers.push(`browser heap grew by ${result.memory.deltaJsHeapUsedMb} MB during proof`);
  if (!setup.savedScanName) blockers.push("saved scan fixture was not created");
  for (const timing of result.timings) {
    if (!timing.pass) blockers.push(`${timing.id} ${timing.latencyMs}ms exceeds ${timing.budgetMs}ms budget${timing.error ? `: ${timing.error}` : ""}`);
  }
  for (const check of result.checks) {
    if (check.status === "fail") blockers.push(`${check.id} failed${check.error ? `: ${check.error}` : ""}`);
  }
  return {
    baseUrl,
    blockers,
    budgets,
    generatedAt: new Date().toISOString(),
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeIdentity: probeIdentity
      ? {
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
        }
      : { created: false },
    proofScope: "Production browser proof for an authenticated, isolated, test-only 500+ row scanner universe. This proves virtualization and browser workflow behavior without claiming the current real scanner universe contains 500 live symbols.",
    result,
    setup,
    startedAt,
    unsupportedClaims: [
      "No fake scanner scores are presented as real market signals.",
      "No live 500-symbol production scanner universe claim.",
      "No recommendation, trade signal, or financial advice claim.",
    ],
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
