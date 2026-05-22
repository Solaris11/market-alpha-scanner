import assert from "node:assert/strict";
import test from "node:test";

import { getDiscoveryPerformanceSnapshot, recordDiscoveryApiTiming, resetDiscoveryPerformanceForTests } from "./discovery-performance";

test("discovery performance snapshot tracks p50, p95, max, and cache hit rate", () => {
  resetDiscoveryPerformanceForTests();

  for (const latencyMs of [80, 120, 140, 260, 320]) {
    recordDiscoveryApiTiming({ cacheStatus: "system-hit", latencyMs, statusCode: 200 });
  }
  recordDiscoveryApiTiming({ cacheStatus: "system-miss", latencyMs: 900, statusCode: 200 });
  recordDiscoveryApiTiming({ cacheStatus: "limited", latencyMs: 20, statusCode: 401 });

  const snapshot = getDiscoveryPerformanceSnapshot();

  assert.equal(snapshot.sampleCount, 7);
  assert.equal(snapshot.p50LatencyMs, 140);
  assert.equal(snapshot.p95LatencyMs, 900);
  assert.equal(snapshot.maxLatencyMs, 900);
  assert.equal(snapshot.cacheHitRate, 83);
  assert.equal(snapshot.targetMet, false);
});

test("discovery performance snapshot reports target met for hot cached paths", () => {
  resetDiscoveryPerformanceForTests();

  for (const latencyMs of [42, 48, 51, 60, 77]) {
    recordDiscoveryApiTiming({ cacheStatus: "system-hit", latencyMs, statusCode: 200 });
  }

  const snapshot = getDiscoveryPerformanceSnapshot();

  assert.equal(snapshot.p95LatencyMs, 77);
  assert.equal(snapshot.targetMet, true);
});
