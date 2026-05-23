#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_RESILIENCE_BASE_URL ?? process.env.TRADEVETO_SCALE_BASE_URL ?? "https://tradeveto.com");
const tiers = parseTiers(process.env.TRADEVETO_RESILIENCE_TIERS ?? "25,50,100");
const durationSeconds = positiveInteger(process.env.TRADEVETO_RESILIENCE_DURATION_SECONDS, 60);
const timeoutMs = positiveInteger(process.env.TRADEVETO_RESILIENCE_TIMEOUT_MS ?? process.env.TRADEVETO_SCALE_TIMEOUT_MS, 8_000);
const maxSamplesPerEndpoint = positiveInteger(process.env.TRADEVETO_RESILIENCE_MAX_SAMPLES_PER_ENDPOINT, 250);
const streamConnections = positiveInteger(process.env.TRADEVETO_RESILIENCE_STREAM_CONNECTIONS, 25);
const streamDurationSeconds = positiveInteger(process.env.TRADEVETO_RESILIENCE_STREAM_DURATION_SECONDS, 35);
const outputPath = process.env.TRADEVETO_RESILIENCE_OUTPUT ?? "";
const strict = truthy(process.env.TRADEVETO_RESILIENCE_STRICT);
const authorization = process.env.TRADEVETO_RESILIENCE_AUTHORIZATION ?? process.env.TRADEVETO_SCALE_AUTHORIZATION ?? "";
const cookie = process.env.TRADEVETO_RESILIENCE_COOKIE ?? process.env.TRADEVETO_SCALE_COOKIE ?? "";
const authenticatedCoverage = Boolean(authorization || cookie);

const endpoints = [
  {
    category: "health",
    method: "GET",
    path: "/api/health",
    p95BudgetMs: 150,
    p99BudgetMs: 300,
    requiresAuth: false,
  },
  {
    category: "scanner",
    method: "GET",
    path: "/api/discovery",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiresAuth: true,
  },
  {
    category: "live",
    method: "GET",
    path: "/api/live-intelligence",
    p95BudgetMs: 400,
    p99BudgetMs: 800,
    requiresAuth: true,
  },
];

const startedAt = new Date().toISOString();
const memoryBefore = process.memoryUsage();
const tierResults = [];
for (const tier of tiers) {
  tierResults.push(await runTier(tier));
}
const streamStorm = await runStreamStorm();
const memoryAfter = process.memoryUsage();
const report = buildReport({ memoryAfter, memoryBefore, startedAt, streamStorm, tierResults });
const serialized = `${JSON.stringify(report, null, 2)}\n`;
console.log(serialized);

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}

if (strict && report.overallStatus !== "ready") {
  process.exitCode = 1;
}

async function runTier(targetConcurrency) {
  const endpointResults = [];
  for (const endpoint of endpoints) {
    const samples = await runEndpointLoad(endpoint, targetConcurrency);
    endpointResults.push(evaluateEndpoint(endpoint, samples));
  }
  return {
    durationSeconds,
    endpointResults,
    p95WorstMs: max(endpointResults.map((result) => result.p95LatencyMs)),
    p99WorstMs: max(endpointResults.map((result) => result.p99LatencyMs)),
    sampleCount: endpointResults.reduce((sum, result) => sum + result.sampleCount, 0),
    targetConcurrency,
  };
}

async function runEndpointLoad(endpoint, targetConcurrency) {
  const deadline = performance.now() + durationSeconds * 1_000;
  const samples = [];
  let issued = 0;
  await Promise.all(Array.from({ length: targetConcurrency }, async () => {
    while (performance.now() < deadline && issued < maxSamplesPerEndpoint) {
      issued += 1;
      samples.push(await measureEndpoint(endpoint));
    }
  }));
  return samples;
}

async function runStreamStorm() {
  if (!authenticatedCoverage) {
    return {
      attemptedConnections: streamConnections,
      durationSeconds: streamDurationSeconds,
      eventsReceived: 0,
      failedConnections: streamConnections,
      maxConcurrentConnections: 0,
      ok: false,
      skippedReason: "authenticated credentials unavailable",
      statusCodes: {},
    };
  }

  const probes = await Promise.all(Array.from({ length: streamConnections }, (_, index) => measureStreamConnection(index)));
  const statusCodes = {};
  let eventsReceived = 0;
  let failedConnections = 0;
  for (const probe of probes) {
    statusCodes[String(probe.statusCode)] = (statusCodes[String(probe.statusCode)] ?? 0) + 1;
    eventsReceived += probe.events;
    if (probe.error || probe.statusCode < 200 || probe.statusCode >= 300) failedConnections += 1;
  }
  return {
    attemptedConnections: streamConnections,
    durationSeconds: streamDurationSeconds,
    eventsReceived,
    failedConnections,
    maxConcurrentConnections: streamConnections,
    ok: failedConnections === 0 && eventsReceived >= streamConnections,
    skippedReason: null,
    statusCodes,
  };
}

async function measureStreamConnection(index) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), streamDurationSeconds * 1_000);
  let events = 0;
  let statusCode = 0;
  try {
    const response = await fetch(`${baseUrl}/api/live-intelligence/stream?intervalMs=10000&phase21=chaos&probe=${index}`, {
      cache: "no-store",
      headers: requestHeaders("text/event-stream,application/json,*/*;q=0.8"),
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
      if (events >= 2) break;
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

async function measureEndpoint(endpoint) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      cache: "no-store",
      headers: requestHeaders("application/json,text/html;q=0.9,*/*;q=0.8"),
      method: endpoint.method,
      redirect: "manual",
      signal: controller.signal,
    });
    await response.arrayBuffer().catch(() => undefined);
    return {
      error: null,
      latencyMs: Math.round(performance.now() - started),
      method: endpoint.method,
      path: endpoint.path,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
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

function buildReport({ memoryAfter, memoryBefore, startedAt, streamStorm, tierResults }) {
  const blockers = [];
  if (!authenticatedCoverage) blockers.push("authenticated protected hot paths were not covered");
  if (durationSeconds < 15 * 60) blockers.push(`load duration ${durationSeconds}s below 15 minute sustained certification window`);
  for (const tier of [25, 50, 100]) {
    if (!tierResults.some((result) => result.targetConcurrency >= tier)) blockers.push(`concurrency tier ${tier} was not tested`);
  }
  for (const tier of tierResults) {
    for (const endpoint of tier.endpointResults) {
      if (endpoint.status !== "pass") blockers.push(`${tier.targetConcurrency}c ${endpoint.path} ${endpoint.status}: ${endpoint.failureReasons.join("; ")}`);
    }
  }
  if (!streamStorm.ok) blockers.push("websocket/SSE reconnect storm proof did not pass");
  blockers.push("provider outage simulation was not executed against production");
  blockers.push("DB EXPLAIN/ANALYZE validation must be attached separately");
  blockers.push("mobile stress and large watchlist render proof must be attached separately");
  blockers.push("production observability dashboard artifact must be attached separately");

  return {
    authenticatedCoverage,
    baseUrl,
    blockers,
    durationSeconds,
    generatedAt: new Date().toISOString(),
    memory: {
      beforeRssMb: bytesToMb(memoryBefore.rss),
      afterRssMb: bytesToMb(memoryAfter.rss),
      deltaRssMb: bytesToMb(memoryAfter.rss - memoryBefore.rss),
      heapUsedMb: bytesToMb(memoryAfter.heapUsed),
    },
    overallStatus: blockers.length ? "not_ready" : "ready",
    startedAt,
    streamStorm,
    tierResults,
    timeoutMs,
  };
}

function evaluateEndpoint(endpoint, samples) {
  const latencies = samples.map((sample) => sanitizeLatency(sample.latencyMs)).sort((left, right) => left - right);
  const successful = samples.filter((sample) => sample.statusCode >= 200 && sample.statusCode < 300 && !sample.error);
  const failureCount = samples.length - successful.length;
  const timeoutCount = samples.filter((sample) => /abort|timeout|timed out/i.test(String(sample.error ?? ""))).length;
  const successRatePct = samples.length ? Math.round((successful.length / samples.length) * 10_000) / 100 : 0;
  const timeoutRatePct = samples.length ? Math.round((timeoutCount / samples.length) * 10_000) / 100 : 0;
  const p50LatencyMs = percentile(latencies, 0.50);
  const p95LatencyMs = percentile(latencies, 0.95);
  const p99LatencyMs = percentile(latencies, 0.99);
  const maxLatencyMs = latencies.length ? latencies[latencies.length - 1] : 0;
  const failureReasons = [];
  if (samples.length < 10) failureReasons.push(`only ${samples.length} samples; need at least 10`);
  if (successRatePct < 99) failureReasons.push(`success rate ${successRatePct}% below 99%`);
  if (p95LatencyMs > endpoint.p95BudgetMs) failureReasons.push(`p95 ${p95LatencyMs}ms exceeds ${endpoint.p95BudgetMs}ms`);
  if (p99LatencyMs > endpoint.p99BudgetMs) failureReasons.push(`p99 ${p99LatencyMs}ms exceeds ${endpoint.p99BudgetMs}ms`);
  return {
    category: endpoint.category,
    failureCount,
    failureReasons,
    maxLatencyMs,
    method: endpoint.method,
    p50LatencyMs,
    p95BudgetMs: endpoint.p95BudgetMs,
    p95LatencyMs,
    p99BudgetMs: endpoint.p99BudgetMs,
    p99LatencyMs,
    path: endpoint.path,
    requiresAuth: endpoint.requiresAuth,
    sampleCount: samples.length,
    status: failureReasons.length ? "fail" : "pass",
    successRatePct,
    timeoutCount,
    timeoutRatePct,
  };
}

function requestHeaders(accept) {
  const headers = {
    Accept: accept,
    "User-Agent": "TradeVeto-Phase21ResilienceChaosProbe/1.0",
  };
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;
  return headers;
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

function truthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
