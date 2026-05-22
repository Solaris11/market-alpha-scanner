#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SCALE_BASE_URL ?? "https://tradeveto.com");
const iterations = positiveInteger(process.env.TRADEVETO_SCALE_ITERATIONS, 10);
const concurrency = positiveInteger(process.env.TRADEVETO_SCALE_CONCURRENCY, 4);
const timeoutMs = positiveInteger(process.env.TRADEVETO_SCALE_TIMEOUT_MS, 10_000);
const outputPath = process.env.TRADEVETO_SCALE_OUTPUT ?? "";
const authorization = process.env.TRADEVETO_SCALE_AUTHORIZATION ?? "";
const cookie = process.env.TRADEVETO_SCALE_COOKIE ?? "";
const authenticatedCoverage = Boolean(authorization || cookie);

const endpoints = [
  {
    body: null,
    category: "health",
    method: "GET",
    path: "/api/health",
    p95BudgetMs: 150,
    p99BudgetMs: 300,
    requiresAuth: false,
  },
  {
    body: null,
    category: "health",
    method: "GET",
    path: "/api/health/deep",
    p95BudgetMs: 750,
    p99BudgetMs: 1_500,
    requiresAuth: false,
  },
  {
    body: null,
    category: "scanner",
    method: "GET",
    path: "/api/discovery",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiresAuth: true,
  },
  {
    body: null,
    category: "ranking",
    method: "GET",
    path: "/api/ranking",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiresAuth: true,
  },
  {
    body: null,
    category: "replay",
    method: "GET",
    path: "/api/history/replay?symbol=AMD",
    p95BudgetMs: 700,
    p99BudgetMs: 1_200,
    requiresAuth: true,
  },
  {
    body: null,
    category: "replay",
    method: "GET",
    path: "/api/v1/replay?symbol=AMD",
    p95BudgetMs: 600,
    p99BudgetMs: 1_000,
    requiresAuth: false,
  },
  {
    body: null,
    category: "macro",
    method: "GET",
    path: "/api/v1/macro",
    p95BudgetMs: 500,
    p99BudgetMs: 900,
    requiresAuth: false,
  },
  {
    body: null,
    category: "chart",
    method: "GET",
    path: "/api/price-history/AMD?period=1y",
    p95BudgetMs: 700,
    p99BudgetMs: 1_200,
    requiresAuth: true,
  },
  {
    body: { events: [] },
    category: "telemetry",
    method: "POST",
    path: "/api/analytics/events",
    p95BudgetMs: 250,
    p99BudgetMs: 500,
    requiresAuth: false,
  },
  {
    body: null,
    category: "live",
    method: "GET",
    path: "/api/live-intelligence",
    p95BudgetMs: 400,
    p99BudgetMs: 800,
    requiresAuth: false,
  },
  {
    body: { accountValue: 100000, positions: [] },
    category: "strategy",
    method: "POST",
    path: "/api/v1/portfolio/scenario",
    p95BudgetMs: 900,
    p99BudgetMs: 1_600,
    requiresAuth: true,
  },
];

const samples = [];

for (const endpoint of endpoints) {
  const tasks = Array.from({ length: iterations }, () => () => measureEndpoint(endpoint));
  const endpointSamples = await runPool(tasks, concurrency);
  samples.push(...endpointSamples);
}

const report = buildReport(samples);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
console.log(serialized);

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}

if (report.summary.failedEndpoints > 0 || report.summary.insufficientEndpoints > 0) {
  process.exitCode = 1;
}

async function measureEndpoint(endpoint) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
    "User-Agent": "TradeVeto-ScaleReadinessProbe/1.0",
  };
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;
  if (endpoint.method === "POST") headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      body: endpoint.body === null ? undefined : JSON.stringify(endpoint.body),
      cache: "no-store",
      headers,
      method: endpoint.method,
      redirect: "manual",
      signal: controller.signal,
    });
    await response.arrayBuffer().catch(() => undefined);
    return {
      category: endpoint.category,
      latencyMs: Math.round(performance.now() - startedAt),
      method: endpoint.method,
      path: endpoint.path,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      category: endpoint.category,
      error: error instanceof Error ? error.message : "Unknown probe error",
      latencyMs: Math.round(performance.now() - startedAt),
      method: endpoint.method,
      path: endpoint.path,
      statusCode: 599,
      timestamp: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPool(tasks, limit) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (index < tasks.length) {
      const task = tasks[index];
      index += 1;
      if (task) results.push(await task());
    }
  });
  await Promise.all(workers);
  return results;
}

function buildReport(probeSamples) {
  const endpointResults = endpoints.map((endpoint) => evaluateEndpoint(endpoint, probeSamples));
  const failedEndpoints = endpointResults.filter((result) => result.status === "fail").length;
  const insufficientEndpoints = endpointResults.filter((result) => result.status === "insufficient_evidence").length;
  const blockers = [];
  if (!authenticatedCoverage && endpoints.some((endpoint) => endpoint.requiresAuth)) blockers.push("authenticated protected hot paths were not covered");
  if (concurrency < 25) blockers.push(`probe concurrency ${concurrency} below certification target 25`);
  blockers.push("probe is not a sustained 15-minute load test");
  blockers.push("probe does not test websocket/SSE reconnect storms");
  blockers.push("probe does not test degraded providers or outage recovery");
  blockers.push("probe does not include mobile memory/render stress");
  if (failedEndpoints) blockers.push(`${failedEndpoints} endpoint(s) exceeded budget or returned 5xx/errors`);
  if (insufficientEndpoints) blockers.push(`${insufficientEndpoints} endpoint(s) have fewer than 10 samples`);

  return {
    authenticatedCoverage,
    baseUrl,
    blockers,
    concurrency,
    endpointResults,
    generatedAt: new Date().toISOString(),
    iterations,
    overallStatus: blockers.length ? "not_ready" : "ready",
    samples: probeSamples,
    summary: {
      failedEndpoints,
      insufficientEndpoints,
      maxLatencyMs: max(endpointResults.map((result) => result.maxLatencyMs)),
      p95WorstMs: max(endpointResults.map((result) => result.p95LatencyMs)),
      p99WorstMs: max(endpointResults.map((result) => result.p99LatencyMs)),
    },
    timeoutMs,
  };
}

function evaluateEndpoint(endpoint, probeSamples) {
  const relevant = probeSamples.filter((sample) => sample.path === endpoint.path && sample.method === endpoint.method);
  const latencies = relevant.map((sample) => sanitizeLatency(sample.latencyMs)).sort((left, right) => left - right);
  const successful = relevant.filter((sample) => sample.statusCode < 500 && !sample.error);
  const sampleCount = relevant.length;
  const successRatePct = sampleCount ? Math.round((successful.length / sampleCount) * 10_000) / 100 : 0;
  const p50LatencyMs = percentile(latencies, 0.50);
  const p95LatencyMs = percentile(latencies, 0.95);
  const p99LatencyMs = percentile(latencies, 0.99);
  const maxLatencyMs = latencies.length ? latencies[latencies.length - 1] : 0;
  const failureReasons = [];
  if (sampleCount < 10) failureReasons.push(`only ${sampleCount} samples; need at least 10`);
  if (successRatePct < 99) failureReasons.push(`success rate ${successRatePct}% below 99%`);
  if (p95LatencyMs > endpoint.p95BudgetMs) failureReasons.push(`p95 ${p95LatencyMs}ms exceeds ${endpoint.p95BudgetMs}ms`);
  if (p99LatencyMs > endpoint.p99BudgetMs) failureReasons.push(`p99 ${p99LatencyMs}ms exceeds ${endpoint.p99BudgetMs}ms`);
  const status = sampleCount < 10 ? "insufficient_evidence" : failureReasons.length ? "fail" : "pass";

  return {
    category: endpoint.category,
    failureReasons,
    maxLatencyMs,
    method: endpoint.method,
    p50LatencyMs,
    p95BudgetMs: endpoint.p95BudgetMs,
    p95LatencyMs,
    p99BudgetMs: endpoint.p99BudgetMs,
    p99LatencyMs,
    path: endpoint.path,
    sampleCount,
    status,
    successRatePct,
  };
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
