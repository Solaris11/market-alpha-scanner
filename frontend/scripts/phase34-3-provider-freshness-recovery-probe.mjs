#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE34_PROVIDER_BASE_URL ?? "https://tradeveto.com");
const outputPath = process.env.TRADEVETO_PHASE34_PROVIDER_OUTPUT ?? "../docs/ops/artifacts/phase-34-3-provider-freshness/provider-reliability-proof.json";
const createProbeIdentity = truthy(process.env.TRADEVETO_PHASE34_PROVIDER_CREATE_PROBE_USER);
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE34_PROVIDER_CLEANUP_PROBE_USER !== "false";
const strict = truthy(process.env.TRADEVETO_PHASE34_PROVIDER_STRICT);
const sampleCount = positiveInt(process.env.TRADEVETO_PHASE34_PROVIDER_SAMPLES, 3);
const sampleDelayMs = positiveInt(process.env.TRADEVETO_PHASE34_PROVIDER_SAMPLE_DELAY_MS, 600);
const sourceTrustTargetPct = positiveInt(process.env.TRADEVETO_PROVIDER_SOURCE_TRUST_TARGET_PCT, 99);
const providedCookie = process.env.TRADEVETO_PHASE34_PROVIDER_COOKIE ?? "";
const providedAuthorization = process.env.TRADEVETO_PHASE34_PROVIDER_AUTHORIZATION ?? "";

let probeIdentity = null;
let cookie = providedCookie;
let authorization = providedAuthorization;
let exitCode = 0;

async function main() {
  try {
    if (!cookie && !authorization && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }

    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      samples.push(await fetchProviderSourceTrust({ sampleNumber: index + 1 }));
      if (index < sampleCount - 1) await sleep(sampleDelayMs);
    }
    const outage = await fetchProviderSourceTrust({
      extraHeaders: { "X-TradeVeto-Provider-Outage-Simulation": "news,macro,scanner,rates" },
      sampleNumber: sampleCount + 1,
    });
    const report = buildReport({ outage, samples });
    await writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    if (strict && report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Phase 34.3 provider freshness probe failed",
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
    };
    await writeReport(failure).catch(() => undefined);
    console.error(JSON.stringify(failure, null, 2));
  } finally {
    if (probeIdentity && cleanupProbeIdentity) {
      await cleanupProductionProbeIdentity(probeIdentity).catch((error) => {
        console.warn("[phase34-provider] probe identity cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function fetchProviderSourceTrust({ extraHeaders = {}, sampleNumber }) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const response = await fetch(`${baseUrl}/api/intelligence/provider-source-trust`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TradeVeto-Phase34ProviderFreshnessProbe/1.0",
      "X-TradeVeto-Probe": "phase34-provider-freshness",
      ...(authorization ? { Authorization: authorization } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extraHeaders,
    },
    method: "GET",
  });
  const bodyText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = null;
  }
  return {
    latencyMs: Date.now() - started,
    ok: response.ok && payload?.ok === true,
    payload,
    sampleNumber,
    startedAt,
    statusCode: response.status,
  };
}

function buildReport({ outage, samples }) {
  const successfulSamples = samples.filter((sample) => sample.ok);
  const latest = successfulSamples.at(-1) ?? samples.at(-1) ?? null;
  const payload = latest?.payload ?? null;
  const certification = payload?.certification ?? null;
  const dashboard = payload?.freshnessDashboard ?? null;
  const sourceTrust = payload?.sourceTrust ?? null;
  const requiredDomainCoverage = Array.isArray(payload?.requiredDomainCoverage) ? payload.requiredDomainCoverage : [];
  const ratesCoverage = requiredDomainCoverage.find((item) => item?.domain === "rates") ?? null;
  const outageCertification = outage.payload?.certification ?? null;
  const outageSimulation = outage.payload?.outageSimulation ?? null;
  const latencies = samples.map((sample) => sample.latencyMs);
  const availabilityPct = samples.length ? roundPct((successfulSamples.length / samples.length) * 100) : 0;
  const failureRatePct = roundPct(100 - availabilityPct);
  const breachedSlaDomains = requiredDomainCoverage
    .filter((item) => item?.freshnessSlaStatus === "breached")
    .map((item) => item.domain);
  const blockers = [];

  if (!cookie && !authorization) blockers.push("authenticated premium provider source-trust route was not covered");
  if (!samples.length) blockers.push("provider route was not sampled");
  if (samples.some((sample) => !sample.ok)) blockers.push(`provider route failure rate ${failureRatePct}% across ${samples.length} samples`);
  if (!dashboard) blockers.push("freshness dashboard missing from provider response");
  if (!certification) {
    blockers.push("provider freshness certification missing");
  } else {
    if (certification.status !== "ready") blockers.push(`provider freshness certification ${certification.status}`);
    if (Array.isArray(certification.blockers) && certification.blockers.length) {
      blockers.push(...certification.blockers.map((item) => `certification blocker: ${item}`));
    }
  }
  if (!sourceTrust) {
    blockers.push("source-trust summary missing");
  } else {
    if (sourceTrust.status !== "pass") blockers.push(`source-trust status ${sourceTrust.status}`);
    if ((sourceTrust.completenessPct ?? 0) < sourceTrustTargetPct) blockers.push(`source completeness ${sourceTrust.completenessPct ?? 0}% below ${sourceTrustTargetPct}%`);
    if ((sourceTrust.contextCompletenessPct ?? 0) < sourceTrustTargetPct) blockers.push(`source context completeness ${sourceTrust.contextCompletenessPct ?? 0}% below ${sourceTrustTargetPct}%`);
  }
  if (!ratesCoverage) {
    blockers.push("rates provider coverage missing");
  } else if (ratesCoverage.freshnessSlaStatus !== "within-sla") {
    blockers.push(`rates freshness SLA ${ratesCoverage.freshnessSlaStatus}`);
  }
  if (breachedSlaDomains.length) blockers.push(`provider domains breached freshness SLA: ${breachedSlaDomains.join(", ")}`);
  if (!outage.ok) blockers.push(`provider outage simulation route failed with status ${outage.statusCode}`);
  if (!outageSimulation?.enabled || !outageSimulation.fallbackVisible || !outageSimulation.recoveryVisible) {
    blockers.push("provider outage simulation did not expose fallback and recovery states");
  }
  if (!outageCertification || outageCertification.outageSimulationPass !== true) {
    blockers.push("provider outage certification did not pass fallback/recovery proof");
  }

  return {
    authenticated: Boolean(cookie || authorization),
    availability: {
      failureRatePct,
      failedSamples: samples.length - successfulSamples.length,
      sampleCount: samples.length,
      successPct: availabilityPct,
      successfulSamples: successfulSamples.length,
    },
    baselineSamples: samples.map((sample) => sampleSummary(sample)),
    baseUrl,
    blockers,
    fallbackEffectiveness: {
      fallbackVisible: Boolean(outageSimulation?.fallbackVisible),
      outageRouteOk: outage.ok,
      recoveryVisible: Boolean(outageSimulation?.recoveryVisible),
      requested: outageSimulation?.requested ?? [],
    },
    freshnessDashboard: dashboard,
    generatedAt: new Date().toISOString(),
    latency: {
      maxMs: latencies.length ? Math.max(...latencies) : null,
      p50Ms: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95),
      samplesMs: latencies,
    },
    noFabricationBoundary: "The probe only certifies source-linked provider rows. Stale, delayed, outage, limited, and breached-SLA domains remain visible and must not be labeled live.",
    outageSample: sampleSummary(outage),
    overallStatus: blockers.length ? "not_ready" : "ready",
    providerReadinessCertified: blockers.length === 0,
    rates: ratesCoverage
      ? {
          ageMinutes: ratesCoverage.ageMinutes ?? dashboard?.domains?.find((item) => item.domain === "rates")?.ageMinutes ?? null,
          freshnessSlaDisclosure: ratesCoverage.freshnessSlaDisclosure,
          freshnessSlaMinutes: ratesCoverage.freshnessSlaMinutes,
          freshnessSlaStatus: ratesCoverage.freshnessSlaStatus,
          itemCount: ratesCoverage.itemCount,
          operationalState: ratesCoverage.operationalState,
          provider: ratesCoverage.provider,
          sourceTransparency: ratesCoverage.sourceTransparency,
        }
      : null,
    sourceTrust,
  };
}

function sampleSummary(sample) {
  return {
    certificationStatus: sample.payload?.certification?.status ?? null,
    latencyMs: sample.latencyMs,
    ok: sample.ok,
    providerReadiness: sample.payload?.freshnessDashboard?.readiness ?? null,
    ratesSlaStatus: sample.payload?.freshnessDashboard?.ratesSlaStatus ?? null,
    sampleNumber: sample.sampleNumber,
    startedAt: sample.startedAt,
    statusCode: sample.statusCode,
  };
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 34.3 provider probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase34-provider-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 34.3 Provider Freshness Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create probe user.");
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
      [userId, ["AMD", "NVDA", "MSFT", "AAPL", "SPY", "TLT", "QQQ"]],
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

async function writeReport(report) {
  if (!outputPath) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function positiveInt(value, fallback) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function roundPct(value) {
  return Math.round(value * 100) / 100;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function truthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

await main();
