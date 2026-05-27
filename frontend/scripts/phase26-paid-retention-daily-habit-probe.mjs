#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE26_RETENTION_BASE_URL ?? "https://tradeveto.com");
const artifactRoot = process.env.TRADEVETO_PHASE26_RETENTION_ARTIFACT_ROOT
  ?? join(process.cwd(), "../docs/ops/artifacts/phase-26-2-retention");
const outputPath = process.env.TRADEVETO_PHASE26_RETENTION_OUTPUT ?? join(artifactRoot, "paid-retention-daily-habit-proof.json");
const timeoutMs = positiveInteger(process.env.TRADEVETO_PHASE26_RETENTION_TIMEOUT_MS, 20_000);
const createProbeIdentity = process.env.TRADEVETO_PHASE26_RETENTION_CREATE_PROBE_ADMIN !== "false";
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE26_RETENTION_CLEANUP_PROBE_ADMIN !== "false";
const startedAt = new Date().toISOString();

let probeIdentity = null;
let cookie = process.env.TRADEVETO_PHASE26_RETENTION_COOKIE ?? "";
let exitCode = 0;

async function main() {
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeAdmin();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated admin cookie unavailable for Phase 26.2 retention proof.");

    const analyticsResponse = await request("/api/admin/analytics?range=90d");
    const analyticsPayload = parseJson(analyticsResponse.bodyText);
    const report = buildReport({ analyticsPayload, analyticsResponse });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, "utf8");
    if (report.overallStatus === "not_ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Phase 26.2 paid retention proof failed",
      generatedAt: new Date().toISOString(),
      noSyntheticCohortDataCreated: true,
      overallStatus: "not_ready",
      startedAt,
    };
    const serialized = `${JSON.stringify(failure, null, 2)}\n`;
    console.error(serialized);
    await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
    await writeFile(outputPath, serialized, "utf8").catch(() => undefined);
  } finally {
    if (probeIdentity && cleanupProbeIdentity) {
      await cleanupProductionProbeAdmin(probeIdentity).catch((error) => {
        console.warn("[phase26-retention] probe admin cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

function buildReport({ analyticsPayload, analyticsResponse }) {
  const analytics = analyticsPayload?.analytics ?? null;
  const dailyDriver = analytics?.realUserProof?.dailyDriver ?? null;
  const paidUserCohorts = dailyDriver?.paidUserCohorts ?? null;
  const paidSegment = paidUserCohorts?.paidSegment ?? null;
  const blockers = [];
  if (analyticsResponse.statusCode !== 200) blockers.push(`/api/admin/analytics returned ${analyticsResponse.statusCode}`);
  if (analyticsPayload?.ok !== true) blockers.push("admin analytics response was not ok");
  if (!paidUserCohorts) blockers.push("paid user cohort proof is missing from admin analytics");

  const status = paidUserCohorts?.status ?? "not_ready";
  const cohortBlockers = Array.isArray(paidUserCohorts?.blockers) ? paidUserCohorts.blockers : [];
  const finalVerdict = status === "ready"
    ? "TRADEVETO PAID RETENTION COHORT RECOVERY + DAILY HABIT ACCOMPLISHED"
    : status === "strong_partial"
      ? "TRADEVETO PAID RETENTION COHORT RECOVERY + DAILY HABIT STRONG PARTIAL ACCOMPLISHED"
      : "TRADEVETO PAID RETENTION COHORT RECOVERY + DAILY HABIT NOT ACCOMPLISHED";

  return {
    activationMetrics: paidSegment
      ? {
          firstAlertUsers: paidSegment.firstUsefulActions?.alert ?? 0,
          firstChartSaveUsers: paidSegment.firstUsefulActions?.chartSave ?? 0,
          firstMorningBriefingUsers: paidSegment.firstUsefulActions?.morningBriefing ?? 0,
          firstReplayUsers: paidSegment.firstUsefulActions?.replay ?? 0,
          firstScannerUsers: paidSegment.firstUsefulActions?.scanner ?? 0,
          firstWatchlistUsers: paidSegment.firstUsefulActions?.watchlist ?? 0,
        }
      : null,
    alertReturnMetrics: paidSegment
      ? {
          alertReturnConversionPct: paidSegment.alertReturnConversionPct,
          alertReturnUsers: paidSegment.alertReturnUsers,
          alertTriggerUsers: paidSegment.alertTriggerUsers,
          targetPct: paidUserCohorts.targets?.alertReturnConversionPct ?? 12,
        }
      : null,
    analyticsRequest: {
      latencyMs: analyticsResponse.latencyMs,
      statusCode: analyticsResponse.statusCode,
    },
    baseUrl,
    blockers: [...blockers, ...cohortBlockers],
    churnRiskMetrics: {
      churnRiskSignals: dailyDriver?.habitLoops?.churnRiskSignals ?? 0,
      workflowDropoffs: dailyDriver?.habitLoops?.workflowDropoffs ?? 0,
    },
    cohortExport: paidUserCohorts?.segments ?? [],
    d1d2d7Evidence: dailyDriver?.cohortEvidence ?? null,
    elapsedCohortOnly: true,
    finalVerdict,
    generatedAt: new Date().toISOString(),
    noSyntheticCohortDataCreated: true,
    notificationUsefulnessMetrics: paidSegment
      ? {
          foundingNotificationFeedbackTotal: paidSegment.notificationFeedbackTotal,
          foundingNotificationUsefulFeedback: paidSegment.notificationUsefulFeedback,
          foundingNotificationUsefulRatioPct: paidSegment.notificationUsefulRatioPct,
          globalFatigueSignals: dailyDriver?.notificationFeedback?.fatigueSignals ?? 0,
          globalNotUsefulFeedback: dailyDriver?.notificationFeedback?.notUseful ?? 0,
          globalUsefulFeedback: dailyDriver?.notificationFeedback?.useful ?? 0,
          targetPct: paidUserCohorts.targets?.notificationUsefulRatioPct ?? 55,
        }
      : null,
    overallStatus: blockers.length ? "not_ready" : status,
    paidUserCohorts,
    probeIdentity: probeIdentity
      ? {
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
        }
      : { created: false },
    proofBoundary: "This probe reads production admin analytics only. It does not create cohort events, backfill retention, or convert same-day activity into D2/D7 success.",
    startedAt,
    targets: paidUserCohorts?.targets ?? {
      alertReturnConversionPct: 12,
      d2RetentionRatePct: 10,
      d7RetentionRatePct: 6,
      notificationUsefulRatioPct: 55,
      twoPlusActiveDayRatePct: 15,
    },
    timeoutMs,
    workflowReturnMetrics: dailyDriver?.habitLoops ?? null,
  };
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
        "User-Agent": "TradeVeto-Phase26PaidRetentionProbe/1.0",
        "X-TradeVeto-Probe": "phase26-paid-retention",
      },
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    return {
      bodyText,
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      bodyText: "",
      error: error instanceof Error ? error.message : "Unknown request error",
      latencyMs: Math.round(performance.now() - started),
      path,
      statusCode: 599,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createProductionProbeAdmin() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 26.2 retention probe admin.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase26-retention-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 26.2 Retention Probe', true, now(), 'active', 'admin', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create Phase 26.2 retention probe admin.");
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
