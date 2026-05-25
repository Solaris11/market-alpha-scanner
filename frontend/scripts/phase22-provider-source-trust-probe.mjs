#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE22_PROVIDER_BASE_URL ?? process.env.TRADEVETO_PHASE22_BASE_URL ?? "https://tradeveto.com");
const outputPath = process.env.TRADEVETO_PHASE22_PROVIDER_OUTPUT ?? "";
const strict = truthy(process.env.TRADEVETO_PHASE22_PROVIDER_STRICT);
const parsedSourceTrustTargetPct = Number.parseInt(process.env.TRADEVETO_PROVIDER_SOURCE_TRUST_TARGET_PCT ?? "99", 10);
const sourceTrustTargetPct = Number.isFinite(parsedSourceTrustTargetPct) && parsedSourceTrustTargetPct > 0 ? parsedSourceTrustTargetPct : 99;
const createProbeIdentity = truthy(process.env.TRADEVETO_PHASE22_CREATE_PROBE_USER);
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE22_CLEANUP_PROBE_USER !== "false";
const providedCookie = process.env.TRADEVETO_PHASE22_COOKIE ?? "";
const providedAuthorization = process.env.TRADEVETO_PHASE22_AUTHORIZATION ?? "";

let probeIdentity = null;
let cookie = providedCookie;
let authorization = providedAuthorization;
let exitCode = 0;

async function main() {
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }

    const baseline = await fetchProviderSourceTrust({});
    const outage = await fetchProviderSourceTrust({
      "X-TradeVeto-Provider-Outage-Simulation": "news,macro,scanner",
    });
    const report = buildReport({ baseline, outage });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, "utf8");
    }
    if (strict && report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      baseUrl,
      error: error instanceof Error ? error.message : "Phase 22.6 provider source trust probe failed",
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
        console.warn("[phase22-provider] probe identity cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function fetchProviderSourceTrust(extraHeaders) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}/api/intelligence/provider-source-trust`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "TradeVeto-Phase22ProviderSourceTrustProbe/1.0",
      "X-TradeVeto-Probe": "phase22-provider-source-trust",
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
    statusCode: response.status,
  };
}

function buildReport({ baseline, outage }) {
  const blockers = [];
  const sourceTrust = baseline.payload?.sourceTrust ?? null;
  const certification = baseline.payload?.certification ?? null;
  const outageCertification = outage.payload?.certification ?? null;
  const eventCards = Array.isArray(baseline.payload?.eventCards) ? baseline.payload.eventCards : [];
  const requiredDomainCoverage = Array.isArray(baseline.payload?.requiredDomainCoverage) ? baseline.payload.requiredDomainCoverage : [];
  const outageSimulation = outage.payload?.outageSimulation ?? null;

  if (!cookie && !authorization) blockers.push("authenticated premium provider source-trust route was not covered");
  if (!baseline.ok) blockers.push(`baseline provider source-trust route failed with status ${baseline.statusCode}`);
  if (!outage.ok) blockers.push(`provider outage simulation route failed with status ${outage.statusCode}`);
  if (!sourceTrust) {
    blockers.push("source-trust summary missing");
  } else {
    if (sourceTrust.status !== "pass") blockers.push(`source-trust status ${sourceTrust.status}`);
    if ((sourceTrust.completenessPct ?? 0) < sourceTrustTargetPct) blockers.push(`source card completeness ${sourceTrust.completenessPct ?? 0}% below ${sourceTrustTargetPct}%`);
    if ((sourceTrust.contextCompletenessPct ?? 0) < sourceTrustTargetPct) blockers.push(`source card context completeness ${sourceTrust.contextCompletenessPct ?? 0}% below ${sourceTrustTargetPct}%`);
    if ((sourceTrust.displayedCardCount ?? 0) <= 0) blockers.push("no displayed source-linked event cards were available for provider-depth proof");
  }
  if (!certification) {
    blockers.push("provider freshness certification summary missing");
  } else {
    if (certification.status !== "ready") blockers.push(`provider freshness certification ${certification.status}`);
    if (Array.isArray(certification.blockers) && certification.blockers.length) blockers.push(...certification.blockers.map((item) => `certification blocker: ${item}`));
  }
  for (const card of eventCards) {
    const missing = missingCardFields(card);
    if (missing.length) blockers.push(`event card ${String(card?.headline ?? "unknown").slice(0, 80)} missing ${missing.join(", ")}`);
  }
  const missingDomains = requiredDomainCoverage.filter((item) => item?.present !== true).map((item) => item?.domain ?? "unknown");
  if (missingDomains.length) blockers.push(`provider matrix missing required domains: ${missingDomains.join(", ")}`);
  const limitedDomains = requiredDomainCoverage.filter((item) => item?.operationalState === "limited").map((item) => item.domain);
  if (limitedDomains.length) blockers.push(`provider domains still limited: ${limitedDomains.join(", ")}`);
  const missingSlaDomains = requiredDomainCoverage.filter((item) => !String(item?.freshnessSlaStatus ?? "").trim()).map((item) => item?.domain ?? "unknown");
  if (missingSlaDomains.length) blockers.push(`provider domains missing freshness SLA status: ${missingSlaDomains.join(", ")}`);
  const breachedSlaDomains = requiredDomainCoverage.filter((item) => item?.freshnessSlaStatus === "breached").map((item) => item.domain);
  if (breachedSlaDomains.length) blockers.push(`provider domains breached freshness SLA: ${breachedSlaDomains.join(", ")}`);
  if (!outageSimulation?.enabled || !outageSimulation.fallbackVisible || !outageSimulation.recoveryVisible) {
    blockers.push("provider outage simulation did not expose fallback and recovery states");
  }
  if (!outageCertification || outageCertification.outageSimulationPass !== true) {
    blockers.push("provider outage certification did not pass fallback/recovery proof");
  }

  return {
    authenticated: Boolean(cookie || authorization),
    baseline: {
      eventCardCount: eventCards.length,
      latencyMs: baseline.latencyMs,
      providerStateCounts: baseline.payload?.providerStateCounts ?? null,
      requiredDomainCoverage,
      certification,
      slaStatusCounts: countSlaStatuses(requiredDomainCoverage),
      sourceTrust,
      statusCode: baseline.statusCode,
    },
    baseUrl,
    blockers,
    generatedAt: new Date().toISOString(),
    outageSimulation: outageSimulation ?? null,
    outageCertification: outageCertification ?? null,
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeIdentity: probeIdentity
      ? {
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
        }
      : { created: false },
  };
}

function countSlaStatuses(items) {
  return items.reduce((counts, item) => {
    const status = String(item?.freshnessSlaStatus ?? "missing");
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function missingCardFields(card) {
  const missing = [];
  if (!String(card?.sourceUrl ?? "").startsWith("http")) missing.push("sourceUrl");
  if (!String(card?.provider ?? "").trim()) missing.push("provider");
  if (!String(card?.providerState ?? "").trim()) missing.push("providerState");
  if (!String(card?.freshnessSla ?? "").trim()) missing.push("freshnessSla");
  if (!String(card?.sourceCompleteness ?? "").trim()) missing.push("sourceCompleteness");
  if (!Number.isFinite(Date.parse(String(card?.timestamp ?? "")))) missing.push("timestamp");
  if (!String(card?.freshness ?? "").trim()) missing.push("freshness");
  if (!String(card?.confidence ?? "").trim()) missing.push("confidence");
  if (!String(card?.macroImpact ?? "").trim()) missing.push("macroImpact");
  if (!String(card?.replayLinkage ?? "").trim()) missing.push("replayLinkage");
  if (!String(card?.strategyLinkage ?? "").trim()) missing.push("strategyLinkage");
  if (!Array.isArray(card?.affectedSymbols) || card.affectedSymbols.length === 0) missing.push("affectedSymbols");
  if (!String(card?.watchlistImpactReason ?? "").trim()) missing.push("watchlistImpact");
  if (!String(card?.uncertainty ?? "").trim()) missing.push("uncertainty");
  return missing;
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 22.6 probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase22-provider-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 22.6 Provider Trust Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
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
      [userId, ["AMD", "NVDA", "MSFT", "AAPL", "SPY"]],
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

function truthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
