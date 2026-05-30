#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT32_PREDICTIVE_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT32_PREDICTIVE_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-32-1-predictive-intelligence");
const outputPath = process.env.TRADEVETO_SPRINT32_PREDICTIVE_OUTPUT ?? join(artifactRoot, "predictive-intelligence-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT32_PREDICTIVE_TIMEOUT_MS, 25_000);
const startedAt = new Date().toISOString();

let probeIdentity = null;
let cookie = process.env.TRADEVETO_SPRINT32_PREDICTIVE_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && process.env.TRADEVETO_SPRINT32_PREDICTIVE_CREATE_PROBE_USER !== "false") {
      probeIdentity = await createProductionProbeUser();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for Sprint 32.1 predictive intelligence proof.");

    const [terminal, predictive] = await Promise.all([
      requestText("/terminal", "text/html"),
      requestJson("/api/intelligence/predictive"),
    ]);
    const predictiveSystem = predictive.payload?.predictive ?? null;
    const blockers = [
      ...terminalBlockers(terminal),
      ...predictiveBlockers(predictive, predictiveSystem),
    ];
    const report = {
      baseUrl,
      blockers,
      finalVerdict: blockers.length
        ? "TRADEVETO PREDICTIVE INTELLIGENCE ENGINE NOT ACCOMPLISHED"
        : "TRADEVETO PREDICTIVE INTELLIGENCE ENGINE ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      noFabricatedCertainty: true,
      overallStatus: blockers.length ? "not_ready" : "ready",
      predictive: predictiveSystem ? {
        alertCount: predictiveSystem.predictiveAlerts?.length ?? 0,
        confidenceFramework: predictiveSystem.confidenceFramework ?? null,
        marketRegimeForecast: predictiveSystem.marketRegimeForecast ?? null,
        opportunityForecastCount: predictiveSystem.opportunityForecasts?.length ?? 0,
        portfolioForecastStatus: predictiveSystem.portfolioForecast?.status ?? null,
        proofBoundary: predictiveSystem.proofBoundary ?? null,
      } : null,
      probePortfolio: probeIdentity?.paperPortfolio ?? null,
      proofBoundary: "This production probe verifies authenticated predictive regime forecasting, opportunity forecasting, alert ranking, portfolio forecasting with probe paper positions, evidence/confidence fields, and no-fabrication guardrails. It does not claim guaranteed outcomes, broker execution, or financial advice.",
      startedAt,
      terminalPage: {
        bytes: terminal.bodyText.length,
        containsPredictivePanel: /Predictive Intelligence|Next-Pressure Forecast/i.test(terminal.bodyText),
        latencyMs: terminal.latencyMs,
        statusCode: terminal.statusCode,
      },
    };

    await persistReport(report);
    if (report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    await persistReport({
      baseUrl,
      error: error instanceof Error ? error.message : "Sprint 32.1 predictive intelligence proof failed",
      finalVerdict: "TRADEVETO PREDICTIVE INTELLIGENCE ENGINE NOT ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      noFabricatedCertainty: true,
      overallStatus: "not_ready",
      startedAt,
    }).catch(() => undefined);
  } finally {
    if (probeIdentity && process.env.TRADEVETO_SPRINT32_PREDICTIVE_CLEANUP_PROBE_USER !== "false") {
      await cleanupProductionProbeUser(probeIdentity).catch((error) => {
        console.warn("[sprint32-predictive] probe cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

function predictiveBlockers(response, system) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/api/intelligence/predictive returned ${response.statusCode}`);
  if (response.payload?.ok !== true) blockers.push("Predictive endpoint missing ok=true");
  if (!system) {
    blockers.push("Predictive system payload missing");
    return blockers;
  }
  if (system.certification?.overallStatus !== "ready") blockers.push(`Predictive certification not ready: ${(system.certification?.blockers ?? []).join("; ")}`);
  if (!system.marketRegimeForecast?.forecast) blockers.push("Market regime forecast missing");
  if (!Array.isArray(system.marketRegimeForecast?.evidence) || system.marketRegimeForecast.evidence.length < 3) blockers.push("Market regime evidence too thin");
  if (!Array.isArray(system.opportunityForecasts) || system.opportunityForecasts.length === 0) blockers.push("Opportunity forecasts missing");
  if (!Array.isArray(system.predictiveAlerts) || system.predictiveAlerts.length === 0) blockers.push("Predictive alert ranking missing");
  if (system.portfolioForecast?.status !== "operational") blockers.push("Portfolio forecast did not run with authenticated probe positions");
  if (!Array.isArray(system.confidenceFramework?.trustBoundary) || system.confidenceFramework.trustBoundary.length < 3) blockers.push("Confidence framework trust boundary missing");
  const serialized = JSON.stringify(system);
  if (/\bguaranteed|sure profit|will definitely|must buy|must sell|financial advice\b/i.test(serialized.replace(/not financial advice/gi, ""))) {
    blockers.push("Predictive payload contained forbidden certainty or direct-action language");
  }
  return blockers;
}

function terminalBlockers(response) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/terminal returned ${response.statusCode}`);
  if (!/Predictive Intelligence|Next-Pressure Forecast/i.test(response.bodyText)) blockers.push("/terminal missing predictive intelligence panel");
  return blockers;
}

async function requestJson(path) {
  const response = await requestText(path, "application/json");
  return { ...response, payload: parseJson(response.bodyText) };
}

async function requestText(path, accept) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: accept,
        Cookie: cookie,
        "User-Agent": "TradeVeto-Sprint32PredictiveProbe/1.0",
        "X-TradeVeto-Probe": "sprint32-predictive-intelligence",
      },
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      bodyText: await response.text().catch(() => ""),
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createProductionProbeUser() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Sprint 32.1 predictive intelligence probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `sprint32-predictive-${suffix}@tradeveto-probe.local`;
  const accountName = `Sprint 32 Predictive Probe ${suffix}`;
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
        VALUES ($1, 'Sprint 32 Predictive Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Sprint 32.1 probe user.");
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
        INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at, created_ip, user_agent, device_label, auth_method, last_seen_at)
        VALUES ($1::uuid, $2, now() + interval '2 hours', now(), '127.0.0.1', 'TradeVeto-Sprint32PredictiveProbe/1.0', 'Probe', 'predictive_intelligence_probe', now())
      `,
      [userId, sessionTokenHash],
    );
    await client.query(
      `
        INSERT INTO user_watchlist (user_id, symbol, created_at)
        SELECT $1::uuid, symbol, now()
        FROM unnest($2::text[]) AS symbol
        ON CONFLICT (user_id, symbol) DO NOTHING
      `,
      [userId, ["AMD", "NVDA", "MU"]],
    );
    const accountResult = await client.query(
      `
        INSERT INTO paper_accounts (name, user_id, starting_balance, cash_balance, equity_value, realized_pnl, enabled, created_at, updated_at)
        VALUES ($1, $2::uuid, 100000, 35000, 65000, 0, true, now(), now())
        RETURNING id::text
      `,
      [accountName, userId],
    );
    const accountId = accountResult.rows[0]?.id;
    if (!accountId) throw new Error("Failed to create Sprint 32.1 probe paper account.");
    await client.query(
      `
        INSERT INTO paper_positions (
          account_id,
          user_id,
          symbol,
          status,
          opened_at,
          entry_price,
          quantity,
          stop_loss,
          target_price,
          unrealized_pnl,
          final_decision,
          recommendation_quality,
          entry_status,
          setup_type,
          rating,
          created_at,
          updated_at
        )
        VALUES
          ($1::uuid, $2::uuid, 'AMD', 'OPEN', now() - interval '2 days', 105, 220, 96, 126, 880, 'WATCH', 'watch', 'watch', 'MOMENTUM_CONTINUATION', 'watch', now(), now()),
          ($1::uuid, $2::uuid, 'MU', 'OPEN', now() - interval '1 day', 80, 280, 72, 95, -360, 'WATCH', 'watch', 'watch', 'HIGH_FRAGILITY_MOMENTUM', 'watch', now(), now())
      `,
      [accountId, userId],
    );
    await client.query("COMMIT");
    return {
      email,
      paperPortfolio: { accountName, positions: ["AMD", "MU"], watchlist: ["AMD", "NVDA", "MU"] },
      sessionToken,
      userId,
    };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function cleanupProductionProbeUser(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DELETE FROM paper_positions WHERE user_id = $1::uuid", [identity.userId]);
    await pool.query("DELETE FROM paper_accounts WHERE user_id = $1::uuid", [identity.userId]);
    await pool.query("DELETE FROM user_watchlist WHERE user_id = $1::uuid", [identity.userId]);
    await pool.query("DELETE FROM users WHERE id = $1::uuid AND email = $2", [identity.userId, identity.email]);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function persistReport(report) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  console.log(serialized);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
  return String(value).replace(/\/+$/g, "");
}

await main();
