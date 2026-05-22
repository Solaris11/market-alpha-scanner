import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaleReadinessReport,
  evaluateScaleEndpoint,
  percentile,
  SCALE_ENDPOINT_CATALOG,
  SCALE_READY_MIN_ENDPOINT_SAMPLES,
  type ScaleEndpointCategory,
  type ScaleProbeSample,
} from "./scale-readiness";

test("scale readiness catalog covers required hot endpoint categories", () => {
  const categories = new Set(SCALE_ENDPOINT_CATALOG.map((endpoint) => endpoint.category));
  const requiredCategories: ScaleEndpointCategory[] = ["chart", "health", "live", "macro", "ranking", "replay", "scanner", "strategy", "telemetry"];

  for (const category of requiredCategories) {
    assert.equal(categories.has(category), true, `missing category ${category}`);
  }
});

test("scale readiness endpoint evaluation reports p50, p95, p99, max, and success rate", () => {
  const endpoint = {
    ...SCALE_ENDPOINT_CATALOG.find((candidate) => candidate.path === "/api/discovery")!,
    p95BudgetMs: 300,
    p99BudgetMs: 600,
  };
  const samples = Array.from({ length: SCALE_READY_MIN_ENDPOINT_SAMPLES }, (_, index): ScaleProbeSample => ({
    latencyMs: (index + 1) * 25,
    method: endpoint.method,
    path: endpoint.path,
    statusCode: 200,
  }));

  const result = evaluateScaleEndpoint(endpoint, samples);

  assert.equal(result.sampleCount, SCALE_READY_MIN_ENDPOINT_SAMPLES);
  assert.equal(result.p50LatencyMs, 125);
  assert.equal(result.p95LatencyMs, 250);
  assert.equal(result.p99LatencyMs, 250);
  assert.equal(result.maxLatencyMs, 250);
  assert.equal(result.successRatePct, 100);
  assert.equal(result.status, "pass");
});

test("scale readiness refuses certification without sustained load and chaos evidence", () => {
  const samples = SCALE_ENDPOINT_CATALOG.flatMap((endpoint) =>
    Array.from({ length: SCALE_READY_MIN_ENDPOINT_SAMPLES }, (): ScaleProbeSample => ({
      latencyMs: Math.min(endpoint.p95BudgetMs, endpoint.p99BudgetMs) / 3,
      method: endpoint.method,
      path: endpoint.path,
      statusCode: 200,
    })),
  );

  const report = buildScaleReadinessReport({
    generatedAt: "2026-05-22T00:00:00.000Z",
    samples,
  });

  assert.equal(report.overallStatus, "not_ready");
  assert.equal(report.summary.failedEndpoints, 0);
  assert.equal(report.blockers.some((blocker) => blocker.includes("authenticated")), true);
  assert.equal(report.blockers.some((blocker) => blocker.includes("peak concurrency")), true);
  assert.equal(report.blockers.some((blocker) => blocker.includes("websocket")), true);
});

test("scale readiness can certify when endpoint and operational evidence pass", () => {
  const samples = SCALE_ENDPOINT_CATALOG.flatMap((endpoint) =>
    Array.from({ length: SCALE_READY_MIN_ENDPOINT_SAMPLES }, (): ScaleProbeSample => ({
      latencyMs: endpoint.p95BudgetMs / 4,
      method: endpoint.method,
      path: endpoint.path,
      statusCode: 200,
    })),
  );

  const report = buildScaleReadinessReport({
    generatedAt: "2026-05-22T00:00:00.000Z",
    evidence: {
      authenticatedCoverage: true,
      databaseHotPathExplained: true,
      mobileStressTested: true,
      peakConcurrency: 50,
      providerDegradationTested: true,
      sustainedMinutes: 30,
      websocketReconnectStormTested: true,
    },
    samples,
  });

  assert.equal(report.overallStatus, "ready");
  assert.equal(report.blockers.length, 0);
  assert.equal(report.summary.passedEndpoints, SCALE_ENDPOINT_CATALOG.length);
});

test("scale readiness percentile uses ceiling rank", () => {
  assert.equal(percentile([10, 20, 30, 40, 50], 0.5), 30);
  assert.equal(percentile([10, 20, 30, 40, 50], 0.95), 50);
  assert.equal(percentile([10, 20, 30, 40, 50], 0.99), 50);
});
