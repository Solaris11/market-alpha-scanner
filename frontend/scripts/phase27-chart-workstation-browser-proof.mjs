#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE272_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = resolve(process.cwd(), process.env.TRADEVETO_PHASE272_ARTIFACT_ROOT ?? "../docs/ops/artifacts/phase-27-2-chart-workstation");
const outputPath = resolve(process.cwd(), process.env.TRADEVETO_PHASE272_OUTPUT ?? join(artifactRoot, "chart-workstation-browser-proof.json"));
const screenshotDir = resolve(process.cwd(), process.env.TRADEVETO_PHASE272_SCREENSHOT_DIR ?? artifactRoot);
const navigationTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE272_NAVIGATION_TIMEOUT_MS, 90_000);
const waitTimeoutMs = positiveInteger(process.env.TRADEVETO_PHASE272_WAIT_TIMEOUT_MS, 35_000);
const strict = process.env.TRADEVETO_PHASE272_STRICT !== "false";
const headless = process.env.TRADEVETO_PHASE272_HEADLESS !== "false";
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE272_CLEANUP_PROBE_USER !== "false";

const budgets = {
  fullscreenOpenMs: 1500,
  layoutSwitchMs: 250,
  replayScrubMs: 250,
  workspaceRestoreMs: 3000,
};

const startedAt = new Date().toISOString();
let browser = null;
let probeIdentity = null;

async function main() {
  let report;
  try {
    await mkdir(screenshotDir, { recursive: true });
    const cookie = await resolveAuthCookie();
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
      userAgent: "TradeVeto-Phase27ChartWorkstationProof/1.0",
      viewport: { height: 960, width: 1440 },
    });
    await context.addCookies(cookieHeaderToBrowserCookies(cookie));
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.setDefaultTimeout(waitTimeoutMs);
    await seedClientState(page);

    const proof = await runWorkstationProof(page);
    await context.close();
    report = buildReport(proof);
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
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
  if (report.overallStatus === "ready") console.log(serialized);
  else console.error(serialized);
  if (strict && report.overallStatus !== "ready") process.exitCode = 1;
}

async function runWorkstationProof(page) {
  const timings = {};
  const screenshots = [];
  const startedRestore = performance.now();
  await page.goto(`${baseUrl}/symbol/AMD`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
  await dismissRiskAcknowledgement(page);
  const chartRoot = page.locator("[data-chart-symbol='AMD'][data-chart-workspace-loaded='true']").first();
  await chartRoot.waitFor({ state: "visible" });
  timings.workspaceRestoreMs = elapsed(startedRestore);

  const startedFullscreen = performance.now();
  await page.locator("[data-chart-expand-trigger='AMD']").first().click();
  const workstation = page.locator("[data-chart-workstation='true']");
  await workstation.waitFor({ state: "visible" });
  timings.fullscreenOpenMs = elapsed(startedFullscreen);

  screenshots.push(await capture(page, "chart-workstation-chromium.png"));

  const startedLayout = performance.now();
  await workstation.getByRole("button", { name: /^grid$/i }).click();
  await page.locator("[data-chart-workstation='true'][data-chart-workstation-layout='grid']").waitFor({ state: "visible" });
  timings.layoutSwitchMs = elapsed(startedLayout);

  const overlayStates = await page.locator("[data-chart-workstation-overlay]").evaluateAll((elements) => elements.map((element) => ({
    id: element.getAttribute("data-chart-workstation-overlay"),
    status: element.getAttribute("data-chart-workstation-overlay-status"),
    text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 240) ?? "",
  })));
  const replayStatus = await workstation.getAttribute("data-chart-workstation-replay");
  if (replayStatus === "available") {
    const startedReplay = performance.now();
    await page.locator("[data-chart-workstation-replay-scrubber='true']").evaluate((element) => {
      if (!(element instanceof HTMLInputElement)) return;
      element.value = "0";
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    timings.replayScrubMs = elapsed(startedReplay);
  }

  const geometry = await page.evaluate(() => {
    const workstation = document.querySelector("[data-chart-workstation='true']");
    const rect = workstation?.getBoundingClientRect();
    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      workstationBottom: rect?.bottom ?? null,
      workstationLeft: rect?.left ?? null,
      workstationRight: rect?.right ?? null,
      workstationTop: rect?.top ?? null,
    };
  });
  const text = await workstation.innerText();

  return {
    geometry,
    overlayStates,
    replayStatus,
    route: "/symbol/AMD",
    screenshots,
    textSafety: {
      hasFinancialAdviceDisclosure: /No financial advice|Research only/i.test(text),
      hasUnsupportedClaim: /guaranteed|must buy|must sell|risk-free/i.test(text),
    },
    timings,
  };
}

function buildReport(proof) {
  const blockers = [];
  for (const [key, budget] of Object.entries(budgets)) {
    const value = proof.timings[key];
    if (typeof value === "number" && value > budget) blockers.push(`${key} ${value}ms exceeds ${budget}ms budget`);
  }
  const overlayById = new Map(proof.overlayStates.map((overlay) => [overlay.id, overlay]));
  if (overlayById.get("aiDecisionLayer")?.status !== "available") blockers.push("decision layer overlay is not available");
  if (overlayById.get("volumeProfile")?.status !== "limited") blockers.push("volume profile should remain limited without validated OHLCV");
  if (overlayById.get("sessionVolume")?.status !== "limited") blockers.push("session volume should remain limited without intraday OHLCV");
  if (!proof.textSafety.hasFinancialAdviceDisclosure) blockers.push("research-only / no-financial-advice disclosure missing");
  if (proof.textSafety.hasUnsupportedClaim) blockers.push("unsupported predictive or direct-action claim found in workstation copy");
  if (proof.geometry.horizontalOverflow > 2) blockers.push(`horizontal overflow ${proof.geometry.horizontalOverflow}px`);
  return {
    baseUrl,
    blockers,
    budgets,
    generatedAt: new Date().toISOString(),
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeIdentity: probeIdentity ? {
      cleanupRequested: cleanupProbeIdentity,
      created: true,
      email: probeIdentity.email,
      userId: probeIdentity.userId,
    } : { created: false },
    proof,
    proofScope: "Authenticated production browser proof for the AMD fullscreen chart decision workstation. This does not claim full TradingView parity, physical-device proof, or unsupported volume/benchmark overlays.",
    startedAt,
  };
}

async function resolveAuthCookie() {
  const provided = process.env.TRADEVETO_PHASE272_COOKIE?.trim();
  if (provided) return provided;
  probeIdentity = await createProductionProbeIdentity();
  return `market_alpha_session=${probeIdentity.sessionToken}`;
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 27.2 browser proof user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `phase27-chart-${suffix}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 27.2 Chart Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Phase 27.2 chart proof user.");
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

async function seedClientState(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("ma_risk_acknowledged_v1", "true");
    window.localStorage.setItem("ma_onboarding_completed", "true");
    window.localStorage.setItem("tradeveto_first_run_starter_hidden_v1", "true");
    window.localStorage.setItem("tradeveto_first_opportunity_review_hidden_v1", "true");
  });
}

async function dismissRiskAcknowledgement(page) {
  const continueButton = page.getByRole("button", { name: /continue/i }).first();
  if (!(await continueButton.isVisible().catch(() => false))) return;
  const checkbox = page.getByRole("checkbox").first();
  if (await checkbox.isVisible().catch(() => false)) await checkbox.check().catch(() => undefined);
  await continueButton.click().catch(() => undefined);
}

async function capture(page, filename) {
  const path = join(screenshotDir, filename);
  await page.screenshot({ fullPage: true, path });
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

function elapsed(startedAt) {
  return Math.round((performance.now() - startedAt) * 1000) / 1000;
}

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
