#!/usr/bin/env node

import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_PHASE22_BASE_URL ?? process.env.TRADEVETO_SCALE_BASE_URL ?? "https://tradeveto.com");
const tiers = parseTiers(process.env.TRADEVETO_PHASE22_TIERS ?? process.env.TRADEVETO_SCALE_TIERS ?? "25,50,100");
const durationSeconds = positiveInteger(process.env.TRADEVETO_PHASE22_DURATION_SECONDS ?? process.env.TRADEVETO_SCALE_DURATION_SECONDS, 900);
const timeoutMs = positiveInteger(process.env.TRADEVETO_PHASE22_TIMEOUT_MS ?? process.env.TRADEVETO_SCALE_TIMEOUT_MS, 8_000);
const thinkTimeMs = nonNegativeInteger(process.env.TRADEVETO_PHASE22_THINK_TIME_MS, 0);
const outputPath = process.env.TRADEVETO_PHASE22_OUTPUT ?? "";
const strict = truthy(process.env.TRADEVETO_PHASE22_STRICT);
const providedCookie = process.env.TRADEVETO_PHASE22_COOKIE ?? process.env.TRADEVETO_SCALE_COOKIE ?? "";
const providedAuthorization = process.env.TRADEVETO_PHASE22_AUTHORIZATION ?? process.env.TRADEVETO_SCALE_AUTHORIZATION ?? "";
const providedDeveloperApiKey = process.env.TRADEVETO_PHASE22_DEVELOPER_API_KEY ?? "";
const createProbeIdentity = truthy(process.env.TRADEVETO_PHASE22_CREATE_PROBE_USER);
const cleanupProbeIdentity = process.env.TRADEVETO_PHASE22_CLEANUP_PROBE_USER !== "false";
const streamTiers = parseTiers(process.env.TRADEVETO_PHASE22_STREAM_TIERS ?? tiers.join(","));
const streamConnectionSeconds = positiveInteger(process.env.TRADEVETO_PHASE22_STREAM_CONNECTION_SECONDS, 30);
const streamReconnectCycles = positiveInteger(process.env.TRADEVETO_PHASE22_STREAM_RECONNECT_CYCLES, 3);
const streamJitterMinMs = nonNegativeInteger(process.env.TRADEVETO_PHASE22_STREAM_JITTER_MIN_MS, 150);
const streamJitterMaxMs = Math.max(streamJitterMinMs, nonNegativeInteger(process.env.TRADEVETO_PHASE22_STREAM_JITTER_MAX_MS, 1_500));
const sampledEndpointCap = positiveInteger(process.env.TRADEVETO_PHASE22_SAMPLED_ENDPOINT_CAP, 12);
const minTargetSamples = positiveInteger(process.env.TRADEVETO_PHASE22_MIN_TARGET_SAMPLES, 100);

const startedAt = new Date().toISOString();
const memoryBefore = process.memoryUsage();
let probeIdentity = null;
let cookie = providedCookie;
let authorization = providedAuthorization;
let developerApiKey = providedDeveloperApiKey;
let exitCode = 0;

const sustainedEndpoints = [
  {
    authMode: "cookie",
    category: "scanner",
    method: "GET",
    path: "/api/discovery",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiredTarget: true,
    weight: 45,
  },
  {
    authMode: "cookie",
    category: "live-intelligence",
    method: "GET",
    path: "/api/live-intelligence?intervalMs=10000",
    p95BudgetMs: 400,
    p99BudgetMs: 800,
    requiredTarget: true,
    weight: 45,
  },
  {
    authMode: "cookie",
    category: "user-context",
    method: "GET",
    path: "/api/auth/me",
    p95BudgetMs: 500,
    p99BudgetMs: 1_000,
    requiredTarget: false,
    weight: 4,
  },
  {
    authMode: "cookie",
    category: "user-context",
    method: "GET",
    path: "/api/user/workspace-preferences",
    p95BudgetMs: 500,
    p99BudgetMs: 1_000,
    requiredTarget: false,
    weight: 2,
  },
  {
    authMode: "cookie",
    category: "chart-workspace",
    method: "GET",
    path: "/api/user/chart-workspaces/AMD",
    p95BudgetMs: 500,
    p99BudgetMs: 1_000,
    requiredTarget: false,
    weight: 2,
  },
  {
    authMode: "cookie",
    category: "watchlist",
    method: "GET",
    path: "/api/user/watchlist",
    p95BudgetMs: 500,
    p99BudgetMs: 1_000,
    requiredTarget: false,
    weight: 2,
  },
];

const sampledEndpoints = [
  {
    acceptedStatusCodes: [200, 404],
    authMode: "cookie",
    category: "replay",
    method: "GET",
    path: "/api/history/replay?symbol=AMD",
    p95BudgetMs: 1_200,
    p99BudgetMs: 2_000,
    sampleCap: 3,
  },
  {
    acceptedStatusCodes: [200, 404],
    authMode: "developer",
    category: "developer-replay",
    method: "GET",
    path: "/api/v1/replay?symbol=AMD",
    p95BudgetMs: 1_200,
    p99BudgetMs: 2_000,
  },
  {
    authMode: "developer",
    category: "developer-macro",
    method: "GET",
    path: "/api/v1/macro",
    p95BudgetMs: 1_200,
    p99BudgetMs: 2_000,
  },
  {
    authMode: "developer",
    category: "developer-opportunities",
    method: "GET",
    path: "/api/v1/opportunities?limit=10",
    p95BudgetMs: 1_200,
    p99BudgetMs: 2_000,
  },
  {
    authMode: "developer",
    body: {
      accountValue: 250000,
      positions: [
        { avgCost: 180, marketValue: 45000, quantity: 250, symbol: "AMD" },
        { avgCost: 520, marketValue: 32000, quantity: 60, symbol: "NVDA" },
      ],
    },
    category: "developer-portfolio",
    method: "POST",
    path: "/api/v1/portfolio/scenario",
    p95BudgetMs: 1_200,
    p99BudgetMs: 2_000,
  },
  {
    authMode: "cookie",
    category: "chart-symbol",
    method: "GET",
    path: "/api/symbol/AMD",
    p95BudgetMs: 1_200,
    p99BudgetMs: 2_000,
  },
  {
    authMode: "cookie",
    category: "paper-account",
    method: "GET",
    path: "/api/paper/account",
    p95BudgetMs: 800,
    p99BudgetMs: 1_500,
  },
  {
    authMode: "cookie",
    category: "paper-positions",
    method: "GET",
    path: "/api/paper/positions",
    p95BudgetMs: 800,
    p99BudgetMs: 1_500,
  },
];

async function main() {
  try {
    if (!cookie && createProbeIdentity) {
      probeIdentity = await createProductionProbeIdentity();
      cookie = `market_alpha_session=${probeIdentity.sessionToken}`;
      developerApiKey = developerApiKey || probeIdentity.developerApiKey;
    }

    const authSmoke = await runAuthSmoke();
    const tierResults = [];
    for (const tier of tiers) {
      tierResults.push(await runTier(tier));
    }
    const streamStorms = [];
    for (const tier of streamTiers) {
      streamStorms.push(await runStreamStorm(tier));
    }
    const providerOutageSimulation = await runProviderOutageSimulation();
    const memoryAfter = process.memoryUsage();
    const report = buildReport({
      authSmoke,
      memoryAfter,
      memoryBefore,
      providerOutageSimulation,
      startedAt,
      streamStorms,
      tierResults,
    });
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
      error: error instanceof Error ? error.message : "Phase 22.2 probe failed",
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
        console.warn("[phase22] probe identity cleanup failed", error instanceof Error ? error.message : error);
        exitCode = exitCode || 1;
      });
    }
    process.exitCode = exitCode;
  }
}

async function runAuthSmoke() {
  const sample = await measureEndpoint({
    authMode: "cookie",
    category: "auth",
    method: "GET",
    path: "/api/auth/me",
    p95BudgetMs: 500,
    p99BudgetMs: 1_000,
  });
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

async function runTier(targetConcurrency) {
  const deadline = performance.now() + durationSeconds * 1_000;
  const sustainedAccumulators = new Map(sustainedEndpoints.map((endpoint) => [endpoint.path, createAccumulator(endpoint)]));
  const sampledAccumulators = new Map(sampledEndpoints.map((endpoint) => [endpoint.path, createAccumulator(endpoint)]));
  const weighted = weightedEndpointList(sustainedEndpoints);

  const sustainedWorkers = Promise.all(Array.from({ length: targetConcurrency }, async (_, workerIndex) => {
    let iteration = 0;
    while (performance.now() < deadline) {
      const endpoint = weighted[(workerIndex + iteration + randomInteger(0, weighted.length - 1)) % weighted.length];
      recordSample(sustainedAccumulators.get(endpoint.path), await measureEndpoint(endpoint));
      iteration += 1;
      if (thinkTimeMs > 0) await sleep(thinkTimeMs);
    }
  }));

  const sampledWorkers = Promise.all(sampledEndpoints.map(async (endpoint, index) => {
    const cap = Math.min(endpoint.sampleCap ?? sampledEndpointCap, sampledEndpointCap);
    const accumulator = sampledAccumulators.get(endpoint.path);
    for (let sampleIndex = 0; sampleIndex < cap; sampleIndex += 1) {
      await sleep(index * 25);
      recordSample(accumulator, await measureEndpoint(endpoint));
    }
  }));

  await Promise.all([sustainedWorkers, sampledWorkers]);
  const endpointResults = [...sustainedAccumulators.values(), ...sampledAccumulators.values()].map(evaluateAccumulator);
  return {
    durationSeconds,
    endpointResults,
    p95WorstMs: max(endpointResults.map((result) => result.p95LatencyMs)),
    p99WorstMs: max(endpointResults.map((result) => result.p99LatencyMs)),
    sampleCount: endpointResults.reduce((sum, result) => sum + result.sampleCount, 0),
    sustainedEndpointCount: sustainedEndpoints.length,
    sampledEndpointCount: sampledEndpoints.length,
    targetConcurrency,
  };
}

async function runStreamStorm(connectionCount) {
  if (!cookie) {
    return {
      attemptedConnections: connectionCount,
      durationSeconds: streamConnectionSeconds,
      eventsReceived: 0,
      failedConnections: connectionCount,
      forcedReconnectCycles: streamReconnectCycles,
      maxConcurrentConnections: 0,
      ok: false,
      skippedReason: "authenticated cookie unavailable",
      statusCodes: {},
    };
  }

  let activeConnections = 0;
  let maxConcurrentConnections = 0;
  const probes = await Promise.all(Array.from({ length: connectionCount }, async (_, index) => {
    const cycles = [];
    for (let cycle = 0; cycle < streamReconnectCycles; cycle += 1) {
      await sleep(randomInteger(streamJitterMinMs, streamJitterMaxMs));
      activeConnections += 1;
      maxConcurrentConnections = Math.max(maxConcurrentConnections, activeConnections);
      try {
        cycles.push(await measureStreamConnection({ cycle, index, tier: connectionCount }));
      } finally {
        activeConnections -= 1;
      }
    }
    return cycles;
  }));

  const flat = probes.flat();
  const statusCodes = {};
  let eventsReceived = 0;
  let failedConnections = 0;
  for (const probe of flat) {
    statusCodes[String(probe.statusCode)] = (statusCodes[String(probe.statusCode)] ?? 0) + 1;
    eventsReceived += probe.events;
    if (probe.error || probe.statusCode < 200 || probe.statusCode >= 300) failedConnections += 1;
  }
  return {
    attemptedConnections: connectionCount,
    durationSeconds: streamConnectionSeconds,
    eventsReceived,
    failedConnections,
    forcedReconnectCycles: streamReconnectCycles,
    maxConcurrentConnections,
    ok: failedConnections === 0 && eventsReceived >= connectionCount * streamReconnectCycles,
    skippedReason: null,
    statusCodes,
  };
}

async function measureStreamConnection({ cycle, index, tier }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), streamConnectionSeconds * 1_000);
  let events = 0;
  let statusCode = 0;
  try {
    const response = await fetch(`${baseUrl}/api/live-intelligence/stream?intervalMs=10000&phase22=scale-storm&tier=${tier}&probe=${index}&cycle=${cycle}`, {
      cache: "no-store",
      headers: requestHeaders("text/event-stream,application/json,*/*;q=0.8", "cookie"),
      method: "GET",
      signal: controller.signal,
    });
    statusCode = response.status;
    if (!response.ok || !response.body) return { error: `stream status ${response.status}`, events, statusCode };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const packet = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (packet.includes("event: live-intelligence")) events += 1;
        boundary = buffer.indexOf("\n\n");
      }
    }
    await reader.cancel().catch(() => undefined);
    return { error: null, events, statusCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : "stream probe failed";
    if (/abort/i.test(message) && events > 0 && statusCode >= 200 && statusCode < 300) {
      return { error: null, events, statusCode };
    }
    return { error: message, events, statusCode: statusCode || 599 };
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function runProviderOutageSimulation() {
  const mode = (process.env.TRADEVETO_PHASE22_PROVIDER_OUTAGE_MODE ?? "none").trim().toLowerCase();
  if (mode !== "header-simulation") {
    return {
      fallbackObserved: false,
      mode,
      ok: false,
      recoveryObserved: false,
      recoverySeconds: null,
      skippedReason: "no production-safe provider outage simulation mode was enabled",
    };
  }

  const outageStarted = performance.now();
  const outageHeaders = {
    "X-TradeVeto-Provider-Outage-Simulation": "news,macro,scanner",
  };
  const outageSamples = await Promise.all([
    measureEndpoint({ authMode: "cookie", category: "provider-outage", extraHeaders: outageHeaders, method: "GET", path: "/api/live-intelligence?intervalMs=10000", p95BudgetMs: 400, p99BudgetMs: 800 }),
    measureEndpoint({ authMode: "cookie", category: "provider-outage", extraHeaders: outageHeaders, method: "GET", path: "/api/discovery", p95BudgetMs: 300, p99BudgetMs: 600 }),
  ]);
  const fallbackObserved = outageSamples.some((sample) => /degraded|fallback|stale/i.test(`${sample.bodyText ?? ""} ${JSON.stringify(sample.headers)}`));
  const recoverySamples = await Promise.all([
    measureEndpoint({ authMode: "cookie", category: "provider-recovery", method: "GET", path: "/api/live-intelligence?intervalMs=10000", p95BudgetMs: 400, p99BudgetMs: 800 }),
    measureEndpoint({ authMode: "cookie", category: "provider-recovery", method: "GET", path: "/api/discovery", p95BudgetMs: 300, p99BudgetMs: 600 }),
  ]);
  const recoveryObserved = recoverySamples.every((sample) => sample.statusCode >= 200 && sample.statusCode < 300);
  return {
    fallbackObserved,
    mode,
    ok: fallbackObserved && recoveryObserved,
    outageStatusCodes: outageSamples.map((sample) => sample.statusCode),
    recoveryObserved,
    recoverySeconds: Math.round((performance.now() - outageStarted) / 1_000),
    recoveryStatusCodes: recoverySamples.map((sample) => sample.statusCode),
    skippedReason: null,
  };
}

async function measureEndpoint(endpoint) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = endpoint.body ? JSON.stringify(endpoint.body) : undefined;
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      body,
      cache: "no-store",
      headers: {
        ...requestHeaders("application/json,text/html;q=0.9,*/*;q=0.8", endpoint.authMode),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(endpoint.extraHeaders ?? {}),
      },
      method: endpoint.method,
      redirect: "manual",
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    return {
      bodyText: bodyText.slice(0, 8_000),
      cacheStatus: response.headers.get("x-tradeveto-discovery-cache") ?? response.headers.get("x-tradeveto-live-cache") ?? null,
      error: null,
      headers: selectedHeaders(response.headers),
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
      headers: {},
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

function buildReport({ authSmoke, memoryAfter, memoryBefore, providerOutageSimulation, startedAt, streamStorms, tierResults }) {
  const authenticatedCoverage = Boolean(cookie || authorization);
  const developerCoverage = Boolean(developerApiKey);
  const blockers = [];

  if (!authenticatedCoverage) blockers.push("authenticated protected hot paths were not covered");
  if (!authSmoke.authenticated || !authSmoke.premium) blockers.push("authenticated premium smoke did not pass");
  if (!developerCoverage) blockers.push("developer strategy/portfolio/replay API key coverage was unavailable");
  if (durationSeconds < 15 * 60) blockers.push(`load duration ${durationSeconds}s below 15 minute sustained certification window`);
  for (const requiredTier of [25, 50, 100]) {
    if (!tierResults.some((result) => result.targetConcurrency >= requiredTier)) blockers.push(`concurrency tier ${requiredTier} was not tested`);
  }
  for (const tier of tierResults) {
    for (const endpoint of tier.endpointResults) {
      if (endpoint.status !== "pass") blockers.push(`${tier.targetConcurrency}c ${endpoint.path} ${endpoint.status}: ${endpoint.failureReasons.join("; ")}`);
    }
  }
  for (const requiredTier of [25, 50, 100]) {
    const storm = streamStorms.find((result) => result.attemptedConnections >= requiredTier);
    if (!storm) blockers.push(`SSE stream storm tier ${requiredTier} was not tested`);
  }
  for (const storm of streamStorms) {
    if (!storm.ok) blockers.push(`${storm.attemptedConnections} stream SSE storm failed: ${storm.failedConnections} failed connection cycle(s)`);
  }
  if (!providerOutageSimulation.ok) blockers.push("provider outage simulation did not prove fallback and recovery behavior");

  return {
    authSmoke,
    authenticatedCoverage,
    baseUrl,
    blockers,
    developerCoverage,
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
          apiKeyPrefix: probeIdentity.apiKeyPrefix,
          cleanupRequested: cleanupProbeIdentity,
          created: true,
          email: probeIdentity.email,
          userId: probeIdentity.userId,
        }
      : { created: false },
    providerOutageSimulation,
    startedAt,
    streamStorms,
    thinkTimeMs,
    tierResults,
    timeoutMs,
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
  if (samplePasses(accumulator.endpoint, sample)) accumulator.successCount += 1;
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
  if (endpoint.authMode === "developer" && !developerApiKey) failureReasons.push("developer API key unavailable");
  if (endpoint.authMode === "cookie" && !cookie && !authorization) failureReasons.push("authenticated cookie/header unavailable");

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

function samplePasses(endpoint, sample) {
  if (sample.error) return false;
  const accepted = endpoint.acceptedStatusCodes ?? [];
  if (accepted.includes(sample.statusCode)) return true;
  return sample.statusCode >= 200 && sample.statusCode < 300;
}

function requestHeaders(accept, authMode) {
  const headers = {
    Accept: accept,
    "User-Agent": "TradeVeto-Phase22AuthenticatedScaleProbe/1.0",
    "X-TradeVeto-Probe": "phase22-authenticated-scale-live-resilience",
  };
  if (authMode === "developer" && developerApiKey) headers.Authorization = `Bearer ${developerApiKey}`;
  if (authMode === "cookie") {
    if (authorization) headers.Authorization = authorization;
    if (cookie) headers.Cookie = cookie;
  }
  return headers;
}

async function createProductionProbeIdentity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a Phase 22.2 probe user.");
  const sessionSecret = sessionHashSecret(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const email = `phase22-scale-${Date.now()}-${randomBytes(4).toString("hex")}@tradeveto-probe.local`;
  const displayName = "Phase 22.2 Scale Probe";
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionTokenHash = createHmac("sha256", sessionSecret).update(sessionToken).digest("hex");
  const developerApiKey = `tvk_live_${randomBytes(32).toString("base64url")}`;
  const developerApiKeyHash = createHash("sha256").update(developerApiKey).digest("hex");
  const apiKeyPrefix = apiKeyPrefixFor(developerApiKey);
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
        VALUES ($1, $2, true, now(), 'active', 'user', 'America/New_York', 'advanced', true, now(), now())
        RETURNING id::text
      `,
      [email, displayName],
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
    await client.query(
      `
        INSERT INTO user_risk_profile (user_id, max_risk_per_trade_percent, max_sector_positions, allow_override, created_at, updated_at)
        VALUES ($1::uuid, 1.5, 3, true, now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET max_risk_per_trade_percent = 1.5, max_sector_positions = 3, allow_override = true, updated_at = now()
      `,
      [userId],
    );
    await client.query(
      `
        INSERT INTO user_workspace_preferences (
          user_id,
          favorite_symbols,
          favorite_modules,
          pinned_mobile_cards,
          preferred_timeframes,
          workspace_mode,
          watchlist_first_mode,
          macro_first_mode,
          favorite_actions,
          created_at,
          updated_at,
          preferences_updated_at
        )
        VALUES (
          $1::uuid,
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[],
          'focused',
          true,
          true,
          $6::text[],
          now(),
          now(),
          now()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET favorite_symbols = EXCLUDED.favorite_symbols, favorite_modules = EXCLUDED.favorite_modules, pinned_mobile_cards = EXCLUDED.pinned_mobile_cards, updated_at = now(), preferences_updated_at = now()
      `,
      [userId, ["AMD", "NVDA", "MSFT"], ["scanner", "live", "macro"], ["watchlist", "scanner", "alerts"], ["1D", "1M", "6M"], ["scan", "replay", "alert"]],
    );
    await client.query(
      `
        INSERT INTO developer_api_keys (user_id, name, key_hash, key_prefix, scopes, created_at, updated_at)
        VALUES ($1::uuid, 'Phase 22.2 scale probe', $2, $3, $4::text[], now(), now())
      `,
      [userId, developerApiKeyHash, apiKeyPrefix, ["read:opportunities", "read:macro", "read:shocks", "read:replay", "read:portfolio"]],
    );
    await client.query("COMMIT");
    return { apiKeyPrefix, developerApiKey, email, sessionToken, userId };
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

function selectedHeaders(headers) {
  const names = [
    "server-timing",
    "x-tradeveto-discovery-cache",
    "x-tradeveto-discovery-p95",
    "x-tradeveto-discovery-p99",
    "x-tradeveto-discovery-target",
    "x-tradeveto-live-cache",
    "x-tradeveto-live-p95",
    "x-tradeveto-live-p99",
    "x-tradeveto-live-target",
  ];
  return Object.fromEntries(names.map((name) => [name, headers.get(name)]).filter(([, value]) => value !== null));
}

function weightedEndpointList(endpoints) {
  const weighted = [];
  for (const endpoint of endpoints) {
    const weight = Math.max(1, Math.round(endpoint.weight ?? 1));
    for (let index = 0; index < weight; index += 1) weighted.push(endpoint);
  }
  return weighted.length ? weighted : endpoints;
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

function apiKeyPrefixFor(key) {
  const cleaned = key.trim();
  return cleaned.length <= 18 ? cleaned : `${cleaned.slice(0, 14)}...${cleaned.slice(-4)}`;
}

function parseTiers(value) {
  const parsed = String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item));
  return parsed.length ? [...new Set(parsed)].sort((left, right) => left - right) : [25, 50, 100];
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

function nonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function roundPct(value) {
  return Math.round(value * 100) / 100;
}

function randomInteger(min, maxValue) {
  return Math.floor(Math.random() * (maxValue - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

await main();
