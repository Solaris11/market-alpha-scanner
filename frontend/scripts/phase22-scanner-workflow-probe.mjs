#!/usr/bin/env node

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE22_SCANNER_BASE_URL ?? "https://tradeveto.com");
const tiers = parseTiers(process.env.TRADEVETO_PHASE22_SCANNER_TIERS ?? "25,50");
const durationSeconds = positiveInteger(process.env.TRADEVETO_PHASE22_SCANNER_DURATION_SECONDS, 300);
const timeoutMs = positiveInteger(process.env.TRADEVETO_PHASE22_SCANNER_TIMEOUT_MS, 8_000);
const outputPath = process.env.TRADEVETO_PHASE22_SCANNER_OUTPUT ?? "";
const strict = truthy(process.env.TRADEVETO_PHASE22_SCANNER_STRICT);
const createProbeIdentity = process.env.TRADEVETO_PHASE22_SCANNER_CREATE_PROBE_USER !== "false";
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE22_SCANNER_CLEANUP_PROBE_USER !== "false";
const largeWatchlistSize = positiveInteger(process.env.TRADEVETO_PHASE22_SCANNER_WATCHLIST_SIZE, 250);
const minTargetSamples = positiveInteger(process.env.TRADEVETO_PHASE22_SCANNER_MIN_TARGET_SAMPLES, 100);

const startedAt = new Date().toISOString();
const memoryBefore = process.memoryUsage();
let probeIdentity = null;
let cookie = process.env.TRADEVETO_PHASE22_SCANNER_COOKIE ?? "";
let csrfToken = "";
let exitCode = 0;

const endpoints = [
  {
    category: "saved-scan-reload",
    method: "GET",
    path: "/api/user/saved-scans",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiredTarget: true,
    weight: 35,
  },
  {
    category: "large-watchlist-discovery",
    method: "GET",
    path: "/api/discovery",
    p95BudgetMs: 600,
    p99BudgetMs: 1_000,
    requiredTarget: true,
    weight: 65,
  },
];

async function main() {
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
    }
    if (!cookie) throw new Error("Authenticated cookie unavailable for scanner workflow probe.");

    const csrf = await fetchCsrfToken();
    csrfToken = csrf.token;
    cookie = mergeCookieHeader(cookie, csrf.cookie);
    const setup = await setupSavedScanThroughApi();
    const authSmoke = await runAuthSmoke();
    const warmup = await runWarmup();
    const tierResults = [];
    for (const tier of tiers) {
      tierResults.push(await runTier(tier));
    }
    const memoryAfter = process.memoryUsage();
    const report = buildReport({ authSmoke, memoryAfter, memoryBefore, setup, startedAt, tierResults, warmup });
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
      error: error instanceof Error ? error.message : "Phase 22.4 scanner workflow probe failed",
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
        console.warn("[phase22-scanner] probe identity cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function runAuthSmoke() {
  const sample = await measureEndpoint({ category: "auth", method: "GET", path: "/api/auth/me", p95BudgetMs: 500, p99BudgetMs: 1_000 });
  let authenticated = false;
  let premium = false;
  if (sample.bodyText) {
    try {
      const payload = JSON.parse(sample.bodyText);
      authenticated = payload?.authenticated === true;
      premium = payload?.entitlement?.isPremium === true || payload?.entitlement?.isAdmin === true;
    } catch {
      authenticated = false;
    }
  }
  return {
    authenticated,
    latencyMs: sample.latencyMs,
    premium,
    statusCode: sample.statusCode,
  };
}

async function runWarmup() {
  const samples = [];
  for (const endpoint of endpoints) {
    for (let index = 0; index < 3; index += 1) {
      samples.push(await measureEndpoint(endpoint));
    }
  }
  return samples.map((sample) => ({
    cacheStatus: sample.cacheStatus,
    latencyMs: sample.latencyMs,
    path: sample.path,
    statusCode: sample.statusCode,
  }));
}

async function runTier(targetConcurrency) {
  const deadline = performance.now() + durationSeconds * 1_000;
  const accumulators = new Map(endpoints.map((endpoint) => [endpoint.path, createAccumulator(endpoint)]));
  const weighted = weightedEndpointList(endpoints);
  await Promise.all(Array.from({ length: targetConcurrency }, async (_, workerIndex) => {
    let iteration = 0;
    while (performance.now() < deadline) {
      const endpoint = weighted[(workerIndex + iteration + randomInteger(0, weighted.length - 1)) % weighted.length];
      recordSample(accumulators.get(endpoint.path), await measureEndpoint(endpoint));
      iteration += 1;
    }
  }));
  const endpointResults = [...accumulators.values()].map(evaluateAccumulator);
  return {
    durationSeconds,
    endpointResults,
    maxLatencyMs: max(endpointResults.map((result) => result.maxLatencyMs)),
    p95WorstMs: max(endpointResults.map((result) => result.p95LatencyMs)),
    p99WorstMs: max(endpointResults.map((result) => result.p99LatencyMs)),
    sampleCount: endpointResults.reduce((sum, result) => sum + result.sampleCount, 0),
    targetConcurrency,
  };
}

async function setupSavedScanThroughApi() {
  const body = {
    name: "Phase 22.4 large watchlist scan",
    payload: {
      assetType: "ALL",
      density: "dense",
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
  };
  const sample = await measureEndpoint({
    body,
    category: "saved-scan-create",
    method: "POST",
    path: "/api/user/saved-scans",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
  });
  let savedScanId = null;
  if (sample.bodyText) {
    try {
      const payload = JSON.parse(sample.bodyText);
      savedScanId = typeof payload?.scan?.id === "string" ? payload.scan.id : null;
    } catch {
      savedScanId = null;
    }
  }
  return {
    largeWatchlistSize: probeIdentity?.watchlistSymbols?.length ?? null,
    savedScanCreateLatencyMs: sample.latencyMs,
    savedScanCreateStatusCode: sample.statusCode,
    savedScanId,
  };
}

async function measureEndpoint(endpoint) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = endpoint.body ? JSON.stringify(endpoint.body) : undefined;
    const headers = {
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      Cookie: cookie,
      "User-Agent": "TradeVeto-Phase22ScannerWorkflowProbe/1.0",
      "X-TradeVeto-Probe": "phase22-scanner-workflow-dominance",
      ...(body ? { "Content-Type": "application/json", "x-csrf-token": csrfToken } : {}),
    };
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      body,
      cache: "no-store",
      headers,
      method: endpoint.method,
      redirect: "manual",
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    return {
      bodyText: bodyText.slice(0, 6_000),
      cacheStatus: response.headers.get("x-tradeveto-discovery-cache") ?? null,
      error: null,
      latencyMs: Math.round(performance.now() - started),
      method: endpoint.method,
      path: endpoint.path,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      bodyText: "",
      cacheStatus: null,
      error: error instanceof Error ? error.message : "Unknown probe error",
      latencyMs: Math.round(performance.now() - started),
      method: endpoint.method,
      path: endpoint.path,
      statusCode: 599,
      timestamp: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCsrfToken() {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    cache: "no-store",
    headers: { Accept: "application/json", Cookie: cookie, "User-Agent": "TradeVeto-Phase22ScannerWorkflowProbe/1.0" },
    method: "GET",
  });
  const payload = await response.json().catch(() => null);
  const token = typeof payload?.csrfToken === "string" ? payload.csrfToken : "";
  if (!response.ok || !token) throw new Error("CSRF token unavailable for scanner workflow probe.");
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookie = setCookie.match(/market_alpha_csrf=([^;,]+)/)?.[1] ?? token;
  return { cookie: `market_alpha_csrf=${csrfCookie}`, token };
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 22.4 scanner probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase22-scanner-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
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
        VALUES ($1, 'Phase 22.4 Scanner Probe', true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email],
    );
    const userId = userResult.rows[0]?.id;
    if (!userId) throw new Error("Failed to create scanner probe user.");

    const symbols = await readLargeScannerUniverse(client, largeWatchlistSize);
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
      [userId, symbols],
    );
    await client.query("COMMIT");
    return { email, sessionToken, userId, watchlistSymbols: symbols };
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function readLargeScannerUniverse(client, limit) {
  const result = await client.query(
    `
      WITH latest_run AS (
        SELECT id
        FROM scan_runs
        WHERE status = 'success'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      SELECT DISTINCT upper(symbol) AS symbol, min(rank_position) AS rank_position
      FROM scanner_signals
      WHERE scan_run_id = (SELECT id FROM latest_run)
        AND symbol IS NOT NULL
        AND symbol <> ''
      GROUP BY upper(symbol)
      ORDER BY min(rank_position) ASC NULLS LAST, upper(symbol) ASC
      LIMIT $1
    `,
    [limit],
  );
  const symbols = result.rows.map((row) => String(row.symbol ?? "").trim().toUpperCase()).filter(Boolean);
  if (symbols.length >= Math.min(25, limit)) return symbols;
  return Array.from(new Set([...symbols, "AMD", "NVDA", "MSFT", "AAPL", "SPY", "QQQ", "TSLA", "META", "GOOGL", "AMZN"])).slice(0, limit);
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

function buildReport({ authSmoke, memoryAfter, memoryBefore, setup, startedAt, tierResults, warmup }) {
  const blockers = [];
  if (!authSmoke.authenticated || !authSmoke.premium) blockers.push("authenticated premium smoke did not pass");
  if (!setup.savedScanId) blockers.push("saved scan creation through production API did not return a saved scan id");
  if ((setup.largeWatchlistSize ?? 0) < Math.min(largeWatchlistSize, 100)) blockers.push(`large watchlist only covered ${setup.largeWatchlistSize ?? 0} symbols`);
  for (const requiredTier of [25, 50]) {
    if (!tierResults.some((result) => result.targetConcurrency >= requiredTier)) blockers.push(`scanner concurrency tier ${requiredTier} was not tested`);
  }
  for (const tier of tierResults) {
    for (const endpoint of tier.endpointResults) {
      if (endpoint.status !== "pass") blockers.push(`${tier.targetConcurrency}c ${endpoint.path} ${endpoint.status}: ${endpoint.failureReasons.join("; ")}`);
    }
  }
  return {
    authSmoke,
    baseUrl,
    blockers,
    durationSeconds,
    generatedAt: new Date().toISOString(),
    memory: {
      afterHeapUsedMb: bytesToMb(memoryAfter.heapUsed),
      afterRssMb: bytesToMb(memoryAfter.rss),
      beforeRssMb: bytesToMb(memoryBefore.rss),
      deltaRssMb: bytesToMb(memoryAfter.rss - memoryBefore.rss),
    },
    overallStatus: blockers.length ? "not_ready" : "ready",
    probeIdentity: probeIdentity
      ? {
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
          watchlistSize: probeIdentity.watchlistSymbols.length,
        }
      : { created: false },
    setup,
    startedAt,
    tierResults,
    timeoutMs,
    warmup,
  };
}

function createAccumulator(endpoint) {
  return {
    cacheStatuses: {},
    endpoint,
    errors: {},
    failureCount: 0,
    latencies: [],
    statusCodes: {},
    successCount: 0,
    timeoutCount: 0,
  };
}

function recordSample(accumulator, sample) {
  if (!accumulator) return;
  accumulator.latencies.push(sanitizeLatency(sample.latencyMs));
  accumulator.statusCodes[String(sample.statusCode)] = (accumulator.statusCodes[String(sample.statusCode)] ?? 0) + 1;
  if (sample.cacheStatus) accumulator.cacheStatuses[sample.cacheStatus] = (accumulator.cacheStatuses[sample.cacheStatus] ?? 0) + 1;
  if (sample.error) accumulator.errors[sample.error] = (accumulator.errors[sample.error] ?? 0) + 1;
  if (/abort|timeout|timed out/i.test(String(sample.error ?? ""))) accumulator.timeoutCount += 1;
  if (sample.statusCode >= 200 && sample.statusCode < 300 && !sample.error) accumulator.successCount += 1;
  else accumulator.failureCount += 1;
}

function evaluateAccumulator(accumulator) {
  const endpoint = accumulator.endpoint;
  const latencies = [...accumulator.latencies].sort((left, right) => left - right);
  const sampleCount = latencies.length;
  const successRatePct = sampleCount ? roundPct((accumulator.successCount / sampleCount) * 100) : 0;
  const timeoutRatePct = sampleCount ? roundPct((accumulator.timeoutCount / sampleCount) * 100) : 0;
  const p50LatencyMs = percentile(latencies, 0.50);
  const p95LatencyMs = percentile(latencies, 0.95);
  const p99LatencyMs = percentile(latencies, 0.99);
  const maxLatencyMs = latencies.length ? latencies[latencies.length - 1] : 0;
  const failureReasons = [];
  if (sampleCount < (endpoint.requiredTarget ? minTargetSamples : 1)) failureReasons.push(`only ${sampleCount} samples`);
  if (successRatePct < 99) failureReasons.push(`success rate ${successRatePct}% below 99%`);
  if (p95LatencyMs > endpoint.p95BudgetMs) failureReasons.push(`p95 ${p95LatencyMs}ms exceeds ${endpoint.p95BudgetMs}ms`);
  if (p99LatencyMs > endpoint.p99BudgetMs) failureReasons.push(`p99 ${p99LatencyMs}ms exceeds ${endpoint.p99BudgetMs}ms`);
  return {
    cacheStatuses: accumulator.cacheStatuses,
    category: endpoint.category,
    failureCount: accumulator.failureCount,
    failureReasons,
    maxLatencyMs,
    method: endpoint.method,
    p50LatencyMs,
    p95BudgetMs: endpoint.p95BudgetMs,
    p95LatencyMs,
    p99BudgetMs: endpoint.p99BudgetMs,
    p99LatencyMs,
    path: endpoint.path,
    requiredTarget: Boolean(endpoint.requiredTarget),
    sampleCount,
    status: failureReasons.length ? "fail" : "pass",
    statusCodes: accumulator.statusCodes,
    successRatePct,
    timeoutCount: accumulator.timeoutCount,
    timeoutRatePct,
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

function weightedEndpointList(items) {
  const weighted = [];
  for (const endpoint of items) {
    const weight = Math.max(1, Math.round(endpoint.weight ?? 1));
    for (let index = 0; index < weight; index += 1) weighted.push(endpoint);
  }
  return weighted.length ? weighted : items;
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

function parseTiers(value) {
  const parsed = String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item));
  return parsed.length ? [...new Set(parsed)].sort((left, right) => left - right) : [25, 50];
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * Math.max(0, Math.min(1, percentileValue))) - 1));
  return values[index] ?? 0;
}

function sanitizeLatency(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function max(values) {
  return values.reduce((highest, value) => Math.max(highest, value), 0);
}

function bytesToMb(value) {
  return Math.round((value / 1024 / 1024) * 10) / 10;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function roundPct(value) {
  return Math.round(value * 100) / 100;
}

function randomInteger(min, maxValue) {
  return Math.floor(Math.random() * (maxValue - min + 1)) + min;
}

function truthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
