#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = stripTrailingSlash(process.env.TRADEVETO_SCALE_BASE_URL ?? "https://tradeveto.com");
const concurrency = positiveInteger(process.env.TRADEVETO_SCALE_CONCURRENCY, 25);
const endpointDurationSeconds = positiveInteger(process.env.TRADEVETO_SCALE_DURATION_SECONDS, 60);
const timeoutMs = positiveInteger(process.env.TRADEVETO_SCALE_TIMEOUT_MS, 8_000);
const outputPath = process.env.TRADEVETO_SCALE_OUTPUT ?? "";
const authorization = process.env.TRADEVETO_SCALE_AUTHORIZATION ?? "";
const cookie = process.env.TRADEVETO_SCALE_COOKIE ?? "";
const streamConnections = positiveInteger(process.env.TRADEVETO_SCALE_STREAM_CONNECTIONS, 25);
const streamDurationSeconds = positiveInteger(process.env.TRADEVETO_SCALE_STREAM_DURATION_SECONDS, 35);
const includeSamples = truthy(process.env.TRADEVETO_SCALE_INCLUDE_SAMPLES);

const endpoints = [
  {
    cacheHeader: "x-tradeveto-discovery-cache",
    method: "GET",
    path: "/api/discovery",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
  },
  {
    cacheHeader: "x-tradeveto-live-cache",
    method: "GET",
    path: "/api/live-intelligence",
    p95BudgetMs: 400,
    p99BudgetMs: 800,
  },
];

const authenticatedCoverage = Boolean(authorization || cookie);
const authSmoke = await smokeAuthenticatedSession();
const samples = [];

for (const endpoint of endpoints) {
  await warmEndpoint(endpoint);
  samples.push(...await runEndpointSustained(endpoint));
}

const stream = await runStreamProbe();
const report = buildReport(samples, stream, authSmoke);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
console.log(serialized);

if (outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}

if (report.overallStatus !== "pass") {
  process.exitCode = 1;
}

async function smokeAuthenticatedSession() {
  if (!authenticatedCoverage) {
    return { ok: false, statusCode: 0 };
  }
  const sample = await measureEndpoint({
    cacheHeader: "",
    method: "GET",
    path: "/api/auth/me",
    p95BudgetMs: 1_000,
    p99BudgetMs: 1_500,
  });
  return {
    ok: sample.statusCode === 200,
    statusCode: sample.statusCode,
  };
}

async function warmEndpoint(endpoint) {
  const tasks = Array.from({ length: Math.min(10, concurrency) }, () => () => measureEndpoint(endpoint));
  await runPool(tasks, Math.min(10, concurrency));
}

async function runEndpointSustained(endpoint) {
  const deadline = performance.now() + endpointDurationSeconds * 1_000;
  const workerCount = Math.max(1, concurrency);
  const results = [];
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (performance.now() < deadline) {
      results.push(await measureEndpoint(endpoint));
    }
  }));
  return results;
}

async function runStreamProbe() {
  if (!authenticatedCoverage) {
    return {
      connections: 0,
      durationSeconds: 0,
      errors: streamConnections,
      events: 0,
      ok: false,
      statusCodes: {},
    };
  }

  const probes = await Promise.all(
    Array.from({ length: streamConnections }, (_, index) => measureStreamConnection(index)),
  );
  const statusCodes = {};
  for (const probe of probes) {
    statusCodes[String(probe.statusCode)] = (statusCodes[String(probe.statusCode)] ?? 0) + 1;
  }
  const errors = probes.filter((probe) => probe.error).length;
  const events = probes.reduce((sum, probe) => sum + probe.events, 0);
  const opened = probes.filter((probe) => probe.statusCode >= 200 && probe.statusCode < 300).length;
  return {
    connections: streamConnections,
    durationSeconds: streamDurationSeconds,
    errors,
    events,
    ok: opened === streamConnections && errors === 0 && events >= streamConnections,
    opened,
    statusCodes,
  };
}

async function measureStreamConnection(index) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), streamDurationSeconds * 1_000);
  let events = 0;
  let statusCode = 0;
  try {
    const response = await fetch(`${baseUrl}/api/live-intelligence/stream?intervalMs=10000&probe=${index}`, {
      cache: "no-store",
      headers: requestHeaders(),
      method: "GET",
      signal: controller.signal,
    });
    statusCode = response.status;
    if (!response.ok || !response.body) {
      return { error: `stream status ${response.status}`, events, statusCode };
    }
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
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      cache: "no-store",
      headers: requestHeaders(),
      method: endpoint.method,
      redirect: "manual",
      signal: controller.signal,
    });
    await response.arrayBuffer().catch(() => undefined);
    return {
      cacheStatus: endpoint.cacheHeader ? response.headers.get(endpoint.cacheHeader) ?? "missing" : "none",
      error: null,
      latencyMs: Math.round(performance.now() - startedAt),
      method: endpoint.method,
      path: endpoint.path,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      cacheStatus: "error",
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

function requestHeaders() {
  const headers = {
    Accept: "application/json,text/event-stream,text/html;q=0.9,*/*;q=0.8",
    "User-Agent": "TradeVeto-Phase21CriticalPerformanceProbe/1.0",
  };
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;
  return headers;
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

function buildReport(probeSamples, stream, authSmoke) {
  const endpointResults = endpoints.map((endpoint) => evaluateEndpoint(endpoint, probeSamples));
  const failedEndpoints = endpointResults.filter((result) => result.status === "fail").length;
  const blockers = [];
  if (!authenticatedCoverage || !authSmoke.ok) blockers.push("authenticated production session was not validated");
  if (concurrency < 25) blockers.push(`concurrency ${concurrency} below required 25`);
  if (failedEndpoints) blockers.push(`${failedEndpoints} hot endpoint(s) missed latency or reliability targets`);
  if (!stream.ok) blockers.push("live-intelligence stream stability probe failed");

  return {
    authenticatedCoverage,
    authSmoke,
    baseUrl,
    blockers,
    concurrency,
    endpointDurationSeconds,
    endpointResults,
    generatedAt: new Date().toISOString(),
    overallStatus: blockers.length ? "fail" : "pass",
    sampleDigest: buildSampleDigest(probeSamples),
    samples: includeSamples ? probeSamples : undefined,
    stream,
    summary: {
      failedEndpoints,
      maxLatencyMs: max(endpointResults.map((result) => result.maxLatencyMs)),
      p95WorstMs: max(endpointResults.map((result) => result.p95LatencyMs)),
      p99WorstMs: max(endpointResults.map((result) => result.p99LatencyMs)),
      sampleCount: endpointResults.reduce((sum, result) => sum + result.sampleCount, 0),
    },
    timeoutMs,
  };
}

function buildSampleDigest(probeSamples) {
  return endpoints.map((endpoint) => {
    const relevant = probeSamples.filter((sample) => sample.path === endpoint.path && sample.method === endpoint.method);
    return {
      method: endpoint.method,
      path: endpoint.path,
      sampleCount: relevant.length,
      window: {
        firstTimestamp: relevant[0]?.timestamp ?? null,
        lastTimestamp: relevant[relevant.length - 1]?.timestamp ?? null,
      },
    };
  });
}

function evaluateEndpoint(endpoint, probeSamples) {
  const relevant = probeSamples.filter((sample) => sample.path === endpoint.path && sample.method === endpoint.method);
  const latencies = relevant.map((sample) => sanitizeLatency(sample.latencyMs)).sort((left, right) => left - right);
  const successful = relevant.filter((sample) => sample.statusCode >= 200 && sample.statusCode < 300 && !sample.error);
  const failureCount = relevant.length - successful.length;
  const timeoutCount = relevant.filter((sample) => /abort|timeout|timed out/i.test(String(sample.error ?? ""))).length;
  const sampleCount = relevant.length;
  const successRatePct = sampleCount ? Math.round((successful.length / sampleCount) * 10_000) / 100 : 0;
  const timeoutRatePct = sampleCount ? Math.round((timeoutCount / sampleCount) * 10_000) / 100 : 0;
  const p50LatencyMs = percentile(latencies, 0.50);
  const p95LatencyMs = percentile(latencies, 0.95);
  const p99LatencyMs = percentile(latencies, 0.99);
  const maxLatencyMs = latencies.length ? latencies[latencies.length - 1] : 0;
  const cacheHeaders = {};
  for (const sample of successful) {
    cacheHeaders[sample.cacheStatus] = (cacheHeaders[sample.cacheStatus] ?? 0) + 1;
  }
  const failureReasons = [];
  if (sampleCount < concurrency) failureReasons.push(`only ${sampleCount} samples; need at least concurrency ${concurrency}`);
  if (successRatePct < 99) failureReasons.push(`success rate ${successRatePct}% below 99%`);
  if (p95LatencyMs > endpoint.p95BudgetMs) failureReasons.push(`p95 ${p95LatencyMs}ms exceeds ${endpoint.p95BudgetMs}ms`);
  if (p99LatencyMs > endpoint.p99BudgetMs) failureReasons.push(`p99 ${p99LatencyMs}ms exceeds ${endpoint.p99BudgetMs}ms`);
  return {
    cacheHeaders,
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
    sampleCount,
    status: failureReasons.length ? "fail" : "pass",
    successRatePct,
    timeoutCount,
    timeoutRatePct,
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

function truthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
