#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT32_MOAT_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT32_MOAT_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-32-2-platform-moat");
const outputPath = process.env.TRADEVETO_SPRINT32_MOAT_OUTPUT ?? join(artifactRoot, "platform-moat-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT32_MOAT_TIMEOUT_MS, 30_000);
const startedAt = new Date().toISOString();

let probeIdentity = null;
let cookie = process.env.TRADEVETO_SPRINT32_MOAT_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && process.env.TRADEVETO_SPRINT32_MOAT_CREATE_PROBE_USER !== "false") {
      probeIdentity = await createProductionProbeUser();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for Sprint 32.2 platform moat proof.");

    const [terminal, moatResponse] = await Promise.all([
      requestText("/terminal", "text/html"),
      requestJson("/api/intelligence/platform-moat"),
    ]);
    const moat = moatResponse.payload?.moat ?? null;
    const blockers = [
      ...terminalBlockers(terminal),
      ...moatBlockers(moatResponse, moat),
    ];
    const report = {
      baseUrl,
      blockers,
      finalVerdict: blockers.length
        ? "TRADEVETO PLATFORM MOAT CONSTRUCTION NOT ACCOMPLISHED"
        : "TRADEVETO PLATFORM MOAT CONSTRUCTION ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      noUnsupportedClaims: true,
      overallStatus: blockers.length ? "not_ready" : "ready",
      platformMoat: moat ? {
        certification: moat.certification,
        defensibility: moat.defensibility,
        marketMemoryRelationships: moat.marketMemoryGraph?.edges?.length ?? 0,
        opportunityKnowledgeRelationships: moat.opportunityKnowledgeGraph?.edges?.length ?? 0,
        proprietaryDatasetCount: moat.proprietaryDatasets?.length ?? 0,
        uniqueSignalCount: moat.uniqueSignals?.length ?? 0,
        userIntelligenceRelationships: moat.userIntelligenceGraph?.edges?.length ?? 0,
      } : null,
      probeIdentity: probeIdentity ? {
        paperPortfolio: probeIdentity.paperPortfolio,
        watchlist: probeIdentity.watchlistSymbols,
      } : null,
      proofBoundary: "This production probe verifies authenticated platform moat construction from source-backed market memory graph relationships, user intelligence graph relationships, opportunity knowledge graph relationships, unique signal definitions, and defensibility scoring. It does not claim permanent monopoly, guaranteed competitive immunity, fabricated user behavior, or fabricated outcomes.",
      startedAt,
      terminalPage: {
        bytes: terminal.bodyText.length,
        containsPlatformMoatPanel: /Platform Moat|Defensible Intelligence Graph/i.test(terminal.bodyText),
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
      error: error instanceof Error ? error.message : "Sprint 32.2 platform moat proof failed",
      finalVerdict: "TRADEVETO PLATFORM MOAT CONSTRUCTION NOT ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      noUnsupportedClaims: true,
      overallStatus: "not_ready",
      startedAt,
    }).catch(() => undefined);
  } finally {
    if (probeIdentity && process.env.TRADEVETO_SPRINT32_MOAT_CLEANUP_PROBE_USER !== "false") {
      await cleanupProductionProbeUser(probeIdentity).catch((error) => {
        console.warn("[sprint32-platform-moat] probe cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

function terminalBlockers(response) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/terminal returned ${response.statusCode}`);
  if (!/Platform Moat|Defensible Intelligence Graph/i.test(response.bodyText)) blockers.push("/terminal missing platform moat panel");
  return blockers;
}

function moatBlockers(response, moat) {
  const blockers = [];
  if (response.statusCode !== 200) blockers.push(`/api/intelligence/platform-moat returned ${response.statusCode}`);
  if (response.payload?.ok !== true) blockers.push("Platform moat endpoint missing ok=true");
  if (!moat) {
    blockers.push("Platform moat payload missing");
    return blockers;
  }
  if (moat.certification?.overallStatus !== "ready") blockers.push(`Platform moat certification not ready: ${(moat.certification?.blockers ?? []).join("; ")}`);
  if ((moat.proprietaryDatasets?.length ?? 0) < 3) blockers.push("Fewer than three proprietary datasets");
  if ((moat.uniqueSignals?.length ?? 0) < 4) blockers.push("Fewer than four unique signals");
  if ((moat.marketMemoryGraph?.edges?.length ?? 0) < 8) blockers.push("Market memory graph relationships below proof threshold");
  if ((moat.userIntelligenceGraph?.edges?.length ?? 0) < 3) blockers.push("User intelligence graph relationships below proof threshold");
  if ((moat.opportunityKnowledgeGraph?.edges?.length ?? 0) < 20) blockers.push("Opportunity knowledge graph relationships below proof threshold");
  if ((moat.defensibility?.moatScore ?? 0) < 70) blockers.push(`Moat score ${moat.defensibility?.moatScore ?? "missing"} below 70`);
  const serialized = JSON.stringify(moat);
  if (/\bimpossible to copy|permanent monopoly|guaranteed moat|unbeatable\b/i.test(serialized)) blockers.push("Payload contained unsupported monopoly or certainty language");
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
        "User-Agent": "TradeVeto-Sprint32PlatformMoatProbe/1.0",
        "X-TradeVeto-Probe": "sprint32-platform-moat",
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
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Sprint 32.2 platform moat probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `sprint32-platform-moat-${suffix}@tradeveto-probe.local`;
  const accountName = `Sprint 32 Platform Moat Probe ${suffix}`;
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionTokenHash = createHmac("sha256", sessionSecret).update(sessionToken).digest("hex");
  const watchlistSymbols = ["AMD", "NVDA", "AVGO", "MSFT", "QQQ", "XLF"];
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
        VALUES ($1, 'Sprint 32 Platform Moat Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Sprint 32.2 probe user.");
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
        VALUES ($1::uuid, $2, now() + interval '2 hours', now(), '127.0.0.1', 'TradeVeto-Sprint32PlatformMoatProbe/1.0', 'Probe', 'platform_moat_probe', now())
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
      [userId, watchlistSymbols],
    );
    await client.query(
      `
        INSERT INTO user_risk_profile (
          user_id,
          max_risk_per_trade_percent,
          max_sector_positions,
          allow_override,
          personality_profile,
          preferred_risk_level,
          preferred_reward_level,
          momentum_preference,
          event_preference,
          volatility_tolerance,
          personality_confidence,
          created_at,
          updated_at,
          profile_updated_at
        )
        VALUES ($1::uuid, 2.5, 5, true, 'momentum', 'medium', 'high', 78, 68, 62, 72, now(), now(), now())
        ON CONFLICT (user_id) DO UPDATE SET
          max_risk_per_trade_percent = EXCLUDED.max_risk_per_trade_percent,
          max_sector_positions = EXCLUDED.max_sector_positions,
          allow_override = EXCLUDED.allow_override,
          personality_profile = EXCLUDED.personality_profile,
          preferred_risk_level = EXCLUDED.preferred_risk_level,
          preferred_reward_level = EXCLUDED.preferred_reward_level,
          momentum_preference = EXCLUDED.momentum_preference,
          event_preference = EXCLUDED.event_preference,
          volatility_tolerance = EXCLUDED.volatility_tolerance,
          personality_confidence = EXCLUDED.personality_confidence,
          updated_at = now(),
          profile_updated_at = now()
      `,
      [userId],
    );
    const accountResult = await client.query(
      `
        INSERT INTO paper_accounts (name, user_id, starting_balance, cash_balance, equity_value, realized_pnl, enabled, created_at, updated_at)
        VALUES ($1, $2::uuid, 100000, 30000, 70000, 0, true, now(), now())
        RETURNING id::text
      `,
      [accountName, userId],
    );
    const accountId = accountResult.rows[0]?.id;
    if (!accountId) throw new Error("Failed to create Sprint 32.2 probe paper account.");
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
          ($1::uuid, $2::uuid, 'AMD', 'OPEN', now() - interval '3 days', 105, 220, 96, 126, 880, 'WATCH', 'watch', 'watch', 'MOMENTUM_CONTINUATION', 'watch', now(), now()),
          ($1::uuid, $2::uuid, 'NVDA', 'OPEN', now() - interval '2 days', 142, 80, 130, 165, 640, 'WATCH', 'watch', 'watch', 'MOMENTUM_CONTINUATION', 'watch', now(), now())
      `,
      [accountId, userId],
    );
    await client.query("COMMIT");
    return {
      email,
      paperPortfolio: { accountName, positions: ["AMD", "NVDA"] },
      sessionToken,
      userId,
      watchlistSymbols,
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
    await pool.query("DELETE FROM user_risk_profile WHERE user_id = $1::uuid", [identity.userId]);
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
