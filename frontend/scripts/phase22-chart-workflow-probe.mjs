#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE22_CHART_BASE_URL ?? "https://tradeveto.com");
const outputPath = process.env.TRADEVETO_PHASE22_CHART_OUTPUT ?? "";
const timeoutMs = positiveInteger(process.env.TRADEVETO_PHASE22_CHART_TIMEOUT_MS, 8_000);
const createProbeIdentity = process.env.TRADEVETO_PHASE22_CHART_CREATE_PROBE_USER !== "false";
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE22_CHART_CLEANUP_PROBE_USER !== "false";

const startedAt = new Date().toISOString();
let probeIdentity = null;
let cookie = process.env.TRADEVETO_PHASE22_CHART_COOKIE ?? "";
let csrfToken = "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for chart workflow probe.");

    const csrf = await fetchCsrfToken();
    csrfToken = csrf.token;
    cookie = mergeCookieHeader(cookie, csrf.cookie);

    const authSmoke = await authSmokeCheck();
    const workspaceWrite = await writeChartWorkspace();
    const workspaceRestore = await readChartWorkspace();
    const alertWrite = await writeChartAlerts();
    const alertRestore = await readAlertRules();
    const symbolSmoke = await request({ method: "GET", path: "/symbol/AMD", acceptedStatusCodes: [200] });

    const report = buildReport({
      alertRestore,
      alertWrite,
      authSmoke,
      startedAt,
      symbolSmoke,
      workspaceRestore,
      workspaceWrite,
    });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, "utf8");
    }
    if (report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Phase 22.5 chart workflow probe failed",
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
    };
    const serialized = `${JSON.stringify(failure, null, 2)}\n`;
    console.error(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
      await writeFile(outputPath, serialized, "utf8").catch(() => undefined);
    }
  } finally {
    if (probeIdentity && cleanupProbeIdentity) {
      await cleanupProductionProbeIdentity(probeIdentity).catch((error) => {
        console.warn("[phase22-chart] probe identity cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function authSmokeCheck() {
  const sample = await request({ method: "GET", path: "/api/auth/me", acceptedStatusCodes: [200] });
  let authenticated = false;
  let premium = false;
  try {
    const payload = JSON.parse(sample.bodyText);
    authenticated = payload?.authenticated === true;
    premium = payload?.entitlement?.isPremium === true || payload?.entitlement?.isAdmin === true;
  } catch {
    authenticated = false;
  }
  return {
    authenticated,
    latencyMs: sample.latencyMs,
    premium,
    statusCode: sample.statusCode,
  };
}

async function writeChartWorkspace() {
  const workspace = chartWorkspacePayload();
  const sample = await request({
    body: { workspace },
    method: "PUT",
    path: "/api/user/chart-workspaces/AMD",
    acceptedStatusCodes: [200],
  });
  let saved = null;
  try {
    saved = JSON.parse(sample.bodyText)?.workspace ?? null;
  } catch {
    saved = null;
  }
  return {
    activeIndicatorTemplateId: saved?.activeIndicatorTemplateId ?? null,
    drawingCount: Array.isArray(saved?.drawings) ? saved.drawings.length : 0,
    hasStyledDrawing: Array.isArray(saved?.drawings) ? saved.drawings.some((drawing) => drawing?.label === "Phase 22.5 Level" && drawing?.color === "cyan" && drawing?.style === "dashed") : false,
    hasTemplate: Array.isArray(saved?.indicatorTemplates) ? saved.indicatorTemplates.some((template) => template?.id === "phase-22-5-template" && template?.source === "user") : false,
    latencyMs: sample.latencyMs,
    statusCode: sample.statusCode,
  };
}

async function readChartWorkspace() {
  const sample = await request({ method: "GET", path: "/api/user/chart-workspaces/AMD", acceptedStatusCodes: [200] });
  let workspace = null;
  try {
    workspace = JSON.parse(sample.bodyText)?.workspace ?? null;
  } catch {
    workspace = null;
  }
  const drawings = Array.isArray(workspace?.drawings) ? workspace.drawings : [];
  const templates = Array.isArray(workspace?.indicatorTemplates) ? workspace.indicatorTemplates : [];
  return {
    activeIndicatorTemplateId: workspace?.activeIndicatorTemplateId ?? null,
    drawingLabels: drawings.map((drawing) => String(drawing?.label ?? "")).filter(Boolean),
    hasCrossDeviceTemplate: templates.some((template) => template?.id === "phase-22-5-template" && Array.isArray(template?.indicators) && template.indicators.includes("ema20") && template.indicators.includes("macd")),
    hasFullscreenRestore: workspace?.fullscreenOpen === true,
    latencyMs: sample.latencyMs,
    statusCode: sample.statusCode,
  };
}

async function writeChartAlerts() {
  const alertPayloads = [
    {
      cooldown_minutes: 240,
      enabled: true,
      id: `chart_amd_price_above_phase225_${Date.now().toString(36)}`,
      risk_reason: "Phase 22.5 chart price alert persistence probe.",
      scope: "symbol",
      source: "user",
      source_reason: "Created by Phase 22.5 chart workflow probe from /symbol/AMD.",
      symbol: "AMD",
      threshold: 250,
      type: "price_above",
      channels: ["telegram"],
    },
    {
      cooldown_minutes: 240,
      enabled: true,
      id: `chart_amd_score_above_phase225_${Date.now().toString(36)}`,
      risk_reason: "Phase 22.5 chart score condition persistence probe.",
      scope: "symbol",
      source: "user",
      source_reason: "Created by Phase 22.5 chart workflow probe from /symbol/AMD score context.",
      symbol: "AMD",
      threshold: 70,
      type: "score_above",
      channels: ["telegram"],
    },
  ];
  const samples = [];
  for (const payload of alertPayloads) {
    samples.push(await request({ body: payload, method: "POST", path: "/api/alerts/rules", acceptedStatusCodes: [200] }));
  }
  return {
    maxLatencyMs: Math.max(...samples.map((sample) => sample.latencyMs)),
    savedCount: samples.filter((sample) => sample.statusCode === 200).length,
    statusCodes: samples.map((sample) => sample.statusCode),
  };
}

async function readAlertRules() {
  const sample = await request({ method: "GET", path: "/api/alerts/rules", acceptedStatusCodes: [200] });
  let rules = [];
  try {
    const payload = JSON.parse(sample.bodyText);
    rules = Array.isArray(payload?.rules) ? payload.rules : [];
  } catch {
    rules = [];
  }
  const phaseRules = rules.filter((rule) => String(rule?.id ?? "").includes("phase225"));
  return {
    hasPriceAlert: phaseRules.some((rule) => rule?.type === "price_above" && rule?.symbol === "AMD"),
    hasScoreAlert: phaseRules.some((rule) => rule?.type === "score_above" && rule?.symbol === "AMD"),
    latencyMs: sample.latencyMs,
    phaseRuleCount: phaseRules.length,
    statusCode: sample.statusCode,
  };
}

function chartWorkspacePayload() {
  const now = new Date().toISOString();
  return {
    activeIndicatorTemplateId: "phase-22-5-template",
    detailMode: "compare",
    drawingTool: "edit",
    drawings: [
      {
        color: "cyan",
        createdAt: now,
        end: { x: 88, y: 34 },
        id: "phase-22-5-horizontal-level",
        label: "Phase 22.5 Level",
        lineWidth: 3,
        start: { x: 12, y: 34 },
        style: "dashed",
        tool: "horizontal",
      },
      {
        color: "amber",
        createdAt: now,
        end: { x: 82, y: 48 },
        id: "phase-22-5-entry-zone",
        label: "Entry Review",
        lineWidth: 2,
        start: { x: 18, y: 42 },
        style: "solid",
        tool: "entryZone",
      },
    ],
    fullscreenOpen: true,
    indicators: ["ema20", "macd", "rsi14"],
    indicatorTemplates: [
      {
        createdAt: now,
        id: "phase-22-5-template",
        indicators: ["ema20", "macd", "rsi14"],
        name: "Phase 22.5 Template",
        overlayFamilies: ["levels", "risk", "replay", "confidence"],
        source: "user",
        updatedAt: now,
      },
    ],
    layoutMode: "grid",
    overlayFamilies: ["levels", "risk", "replay", "confidence"],
    period: "1y",
    updatedAt: now,
    version: 1,
  };
}

async function request({ acceptedStatusCodes = [200], body, method, path }) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const bodyText = body ? JSON.stringify(body) : undefined;
    const response = await fetch(`${baseUrl}${path}`, {
      body: bodyText,
      cache: "no-store",
      headers: {
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        Cookie: cookie,
        Origin: baseUrl,
        "User-Agent": "TradeVeto-Phase22ChartWorkflowProbe/1.0",
        "X-TradeVeto-Probe": "phase22-chart-workflow-professional-maturity",
        ...(bodyText ? { "Content-Type": "application/json", "x-csrf-token": csrfToken } : {}),
      },
      method,
      redirect: "manual",
      signal: controller.signal,
    });
    const responseText = await response.text().catch(() => "");
    return {
      bodyText: responseText.slice(0, 12_000),
      ok: acceptedStatusCodes.includes(response.status),
      latencyMs: Math.round(performance.now() - started),
      method,
      path,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      bodyText: "",
      error: error instanceof Error ? error.message : "Unknown probe request error",
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      method,
      path,
      statusCode: 599,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCsrfToken() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
    headers: { Accept: "application/json", Cookie: cookie, "User-Agent": "TradeVeto-Phase22ChartWorkflowProbe/1.0" },
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const token = typeof payload?.csrfToken === "string" ? payload.csrfToken : "";
  if (!response.ok || !token) throw new Error("CSRF token unavailable for chart workflow probe.");
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookie = setCookie.match(/market_alpha_csrf=([^;,]+)/)?.[1] ?? token;
  return { cookie: `market_alpha_csrf=${csrfCookie}`, token };
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 22.5 chart probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase22-chart-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 22.5 Chart Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create chart probe user.");
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

function buildReport({ alertRestore, alertWrite, authSmoke, startedAt, symbolSmoke, workspaceRestore, workspaceWrite }) {
  const blockers = [];
  if (!authSmoke.authenticated || !authSmoke.premium) blockers.push("authenticated premium smoke did not pass");
  if (!workspaceWrite.hasStyledDrawing || !workspaceWrite.hasTemplate) blockers.push("chart workspace write did not persist styled drawings and indicator template");
  if (!workspaceRestore.hasFullscreenRestore || !workspaceRestore.hasCrossDeviceTemplate || !workspaceRestore.drawingLabels.includes("Phase 22.5 Level")) blockers.push("chart workspace restore did not return fullscreen, template, and drawing state");
  if (alertWrite.savedCount !== 2) blockers.push("chart alert creation did not save both price and score rules");
  if (!alertRestore.hasPriceAlert || !alertRestore.hasScoreAlert) blockers.push("chart alert restore did not return price and score alert rules");
  if (symbolSmoke.statusCode !== 200) blockers.push(`/symbol/AMD smoke returned ${symbolSmoke.statusCode}`);
  return {
    alertRestore,
    alertWrite,
    authSmoke,
    baseUrl,
    blockers,
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
    startedAt,
    symbolSmoke: {
      latencyMs: symbolSmoke.latencyMs,
      statusCode: symbolSmoke.statusCode,
    },
    timeoutMs,
    workspaceRestore,
    workspaceWrite,
  };
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
