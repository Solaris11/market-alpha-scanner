#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SPRINT30_GROWTH_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_SPRINT30_GROWTH_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/sprint-30-4-viral-growth");
const outputPath = process.env.TRADEVETO_SPRINT30_GROWTH_OUTPUT ?? join(artifactRoot, "viral-growth-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_SPRINT30_GROWTH_TIMEOUT_MS, 20_000);
const startedAt = new Date().toISOString();

let probeIdentity = null;
let cookie = process.env.TRADEVETO_SPRINT30_GROWTH_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && process.env.TRADEVETO_SPRINT30_GROWTH_CREATE_PROBE_ADMIN !== "false") {
      probeIdentity = await createProductionProbeAdmin();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated admin cookie unavailable for Sprint 30.4 viral growth proof.");

    const analyticsResponse = await request("/api/admin/analytics?range=30d");
    const analyticsPayload = parseJson(analyticsResponse.bodyText);
    const analytics = analyticsPayload?.analytics ?? null;
    const viralGrowth = analytics?.viralGrowth ?? null;
    const blockers = [];
    if (analyticsResponse.statusCode !== 200) blockers.push(`/api/admin/analytics returned ${analyticsResponse.statusCode}`);
    if (analyticsPayload?.ok !== true) blockers.push("admin analytics response was not ok");
    if (!viralGrowth) blockers.push("viralGrowth analytics block is missing");

    const report = {
      analyticsRequest: {
        latencyMs: analyticsResponse.latencyMs,
        statusCode: analyticsResponse.statusCode,
      },
      baseUrl,
      blockers,
      finalVerdict: blockers.length ? "TRADEVETO VIRAL GROWTH ENGINE NOT ACCOMPLISHED" : "TRADEVETO VIRAL GROWTH ENGINE STRONG PARTIAL ACCOMPLISHED",
      generatedAt: new Date().toISOString(),
      growthDashboardPresent: Boolean(viralGrowth),
      noSyntheticGrowthEventsCreated: true,
      overallStatus: blockers.length ? "not_ready" : "strong_partial",
      proofBoundary: "This probe verifies production growth analytics plumbing. It does not fabricate referral traffic, organic traffic, paid conversions, or user-generated shares.",
      startedAt,
      trafficSourceQuality: viralGrowth?.trafficSourceQuality ?? [],
      viralGrowth,
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, "utf8");
    if (report.overallStatus === "not_ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Sprint 30.4 viral growth proof failed",
      generatedAt: new Date().toISOString(),
      noSyntheticGrowthEventsCreated: true,
      overallStatus: "not_ready",
      startedAt,
    };
    await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
    await writeFile(outputPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => undefined);
    console.error(JSON.stringify(failure, null, 2));
  } finally {
    if (probeIdentity && process.env.TRADEVETO_SPRINT30_GROWTH_CLEANUP_PROBE_ADMIN !== "false") {
      await cleanupProductionProbeAdmin(probeIdentity).catch((error) => {
        console.warn("[sprint30-growth] probe admin cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function request(path) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        "User-Agent": "TradeVeto-Sprint30ViralGrowthProbe/1.0",
        "X-TradeVeto-Probe": "sprint30-viral-growth",
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

async function createProductionProbeAdmin() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Sprint 30.4 growth probe admin.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `sprint30-growth-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Sprint 30.4 Growth Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Sprint 30.4 growth probe admin.");
    await client.query(
      `
        INSERT INTO user_sessions (user_id, session_token_hash, expires_at, created_at)
        VALUES ($1::uuid, $2, now() + interval '2 hours', now())
      `,
      [userId, sessionTokenHash],
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

async function cleanupProductionProbeAdmin(identity) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query("DELETE FROM users WHERE id = $1::uuid AND email = $2", [identity.userId, identity.email]);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
