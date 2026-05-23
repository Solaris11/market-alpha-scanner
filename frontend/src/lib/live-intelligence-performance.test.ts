import assert from "node:assert/strict";
import test from "node:test";

import { getLiveIntelligencePerformanceSnapshot, recordLiveIntelligenceApiTiming, resetLiveIntelligencePerformanceForTests } from "./live-intelligence-performance";

test("live intelligence performance snapshot tracks latency and cache hit rate", () => {
  resetLiveIntelligencePerformanceForTests();

  for (const latencyMs of [90, 120, 180, 240]) {
    recordLiveIntelligenceApiTiming({ cacheStatus: "fresh-hit", latencyMs, statusCode: 200 });
  }
  recordLiveIntelligenceApiTiming({ cacheStatus: "stale-hit", latencyMs: 135, statusCode: 200 });
  recordLiveIntelligenceApiTiming({ cacheStatus: "warm-miss", latencyMs: 390, statusCode: 200 });
  recordLiveIntelligenceApiTiming({ cacheStatus: "degraded-fallback", latencyMs: 260, statusCode: 200 });

  const snapshot = getLiveIntelligencePerformanceSnapshot();

  assert.equal(snapshot.sampleCount, 7);
  assert.equal(snapshot.p50LatencyMs, 180);
  assert.equal(snapshot.p95LatencyMs, 390);
  assert.equal(snapshot.p99LatencyMs, 390);
  assert.equal(snapshot.maxLatencyMs, 390);
  assert.equal(snapshot.cacheHitRate, 71);
  assert.equal(snapshot.targetMet, true);
});
