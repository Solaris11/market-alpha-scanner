import assert from "node:assert/strict";
import test from "node:test";

import { getDiscoveryPerformanceSnapshot, recordDiscoveryApiTiming, resetDiscoveryPerformanceForTests } from "./discovery-performance";

test("discovery performance snapshot tracks p50, p95, p99, max, and cache hit rate", () => {
  resetDiscoveryPerformanceForTests();

  for (const latencyMs of [80, 120, 140, 260, 320]) {
    recordDiscoveryApiTiming({ cacheStatus: "system-hit", latencyMs, statusCode: 200 });
  }
  recordDiscoveryApiTiming({ cacheStatus: "system-miss", latencyMs: 900, statusCode: 200 });
  recordDiscoveryApiTiming({ cacheStatus: "limited", latencyMs: 20, statusCode: 401 });
  recordDiscoveryApiTiming({ cacheStatus: "stale-hit", latencyMs: 85, statusCode: 200 });

  const snapshot = getDiscoveryPerformanceSnapshot();

  assert.equal(snapshot.sampleCount, 8);
  assert.equal(snapshot.p50LatencyMs, 120);
  assert.equal(snapshot.p95LatencyMs, 900);
  assert.equal(snapshot.p99LatencyMs, 900);
  assert.equal(snapshot.maxLatencyMs, 900);
  assert.equal(snapshot.cacheHitRate, 86);
  assert.equal(snapshot.targetMet, false);
});

test("discovery performance snapshot reports target met for hot cached paths", () => {
  resetDiscoveryPerformanceForTests();

  for (const [cacheStatus, latencyMs] of [
    ["response-hit", 22],
    ["response-hit", 28],
    ["system-hit", 42],
    ["system-hit", 48],
    ["stale-hit", 77],
  ] as const) {
    recordDiscoveryApiTiming({ cacheStatus, latencyMs, statusCode: 200 });
  }

  const snapshot = getDiscoveryPerformanceSnapshot();

  assert.equal(snapshot.cacheHitRate, 100);
  assert.equal(snapshot.p95LatencyMs, 77);
  assert.equal(snapshot.p99LatencyMs, 77);
  assert.equal(snapshot.targetMet, true);
});
