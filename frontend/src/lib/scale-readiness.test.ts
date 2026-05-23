import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaleReadinessReport,
  evaluateScaleEndpoint,
  percentile,
  SCALE_ENDPOINT_CATALOG,
  SCALE_READY_MIN_ENDPOINT_SAMPLES,
  SCALE_REQUIRED_CONCURRENCY_TIERS,
  SCALE_REQUIRED_OBSERVABILITY_DASHBOARDS,
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
  assert.equal(report.blockers.some((blocker) => blocker.includes("concurrency tier 100")), true);
  assert.equal(report.blockers.some((blocker) => blocker.includes("websocket")), true);
  assert.equal(report.blockers.some((blocker) => blocker.includes("provider outage")), true);
  assert.equal(report.chaosMatrix.some((item) => item.label === "Production observability" && !item.passed), true);
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
      concurrencyTiers: SCALE_REQUIRED_CONCURRENCY_TIERS.map((target) => ({
        achievedConcurrency: target,
        durationMinutes: 20,
        failureRatePct: 0,
        p95WorstMs: 220,
        p99WorstMs: 420,
        sampleCount: 250,
        target,
        timeoutRatePct: 0,
      })),
      databaseHotPathExplained: true,
      databaseExplainAnalyses: [
        { indexEvidence: "idx_request_metrics_route_created_at", maxExecutionMs: 8.5, queryLabel: "request_metrics hot route", sequentialScan: false },
        { indexEvidence: "idx_monitoring_events_event_type_created_at", maxExecutionMs: 6.2, queryLabel: "monitoring events", sequentialScan: false },
        { indexEvidence: "bounded small table scan", maxExecutionMs: 3.1, queryLabel: "synthetic checks", sequentialScan: true },
      ],
      largeWatchlistScannerStress: {
        maxSymbols: 150,
        p95InteractionMs: 180,
        scannerRows: 250,
        virtualized: true,
      },
      memoryRenderCeiling: {
        maxContainerMemoryPct: 56,
        maxProcessRssMb: 420,
        maxRenderLatencyMs: 240,
        runawayGrowthObserved: false,
      },
      mobileStressTested: true,
      mobileStress: {
        horizontalOverflow: false,
        longTaskCount: 0,
        maxDomNodes: 3200,
        maxHeapMb: 128,
        routeCount: 8,
        viewportCount: 2,
      },
      observabilityDashboards: SCALE_REQUIRED_OBSERVABILITY_DASHBOARDS.map((dashboard) => ({
        dashboard,
        status: "available",
      })),
      peakConcurrency: 100,
      providerDegradationTested: true,
      providerOutages: [
        { fallbackObserved: true, provider: "macro-feed", recoverySeconds: 12, surface: "macro" },
      ],
      sustainedMinutes: 30,
      websocketReconnectStormTested: true,
      websocketReconnectStorm: {
        attemptedConnections: 50,
        durationSeconds: 45,
        eventsReceived: 60,
        failedConnections: 0,
        maxConcurrentConnections: 50,
        reconnectAttempts: 50,
      },
    },
    samples,
  });

  assert.equal(report.overallStatus, "ready");
  assert.equal(report.blockers.length, 0);
  assert.equal(report.chaosMatrix.every((item) => item.passed), true);
  assert.equal(report.summary.passedEndpoints, SCALE_ENDPOINT_CATALOG.length);
});

test("scale readiness blocks incomplete 25/50/100 tier evidence", () => {
  const samples = SCALE_ENDPOINT_CATALOG.flatMap((endpoint) =>
    Array.from({ length: SCALE_READY_MIN_ENDPOINT_SAMPLES }, (): ScaleProbeSample => ({
      latencyMs: endpoint.p95BudgetMs / 4,
      method: endpoint.method,
      path: endpoint.path,
      statusCode: 200,
    })),
  );

  const report = buildScaleReadinessReport({
    evidence: {
      authenticatedCoverage: true,
      concurrencyTiers: [
        {
          achievedConcurrency: 25,
          durationMinutes: 15,
          failureRatePct: 0,
          p95WorstMs: 180,
          p99WorstMs: 320,
          sampleCount: 100,
          target: 25,
          timeoutRatePct: 0,
        },
      ],
      databaseHotPathExplained: true,
      mobileStressTested: true,
      peakConcurrency: 100,
      providerDegradationTested: true,
      sustainedMinutes: 15,
      websocketReconnectStormTested: true,
    },
    samples,
  });

  assert.equal(report.overallStatus, "not_ready");
  assert.ok(report.blockers.some((blocker) => blocker.includes("concurrency tier 50")));
  assert.ok(report.blockers.some((blocker) => blocker.includes("concurrency tier 100")));
});

test("scale readiness percentile uses ceiling rank", () => {
  assert.equal(percentile([10, 20, 30, 40, 50], 0.5), 30);
  assert.equal(percentile([10, 20, 30, 40, 50], 0.95), 50);
  assert.equal(percentile([10, 20, 30, 40, 50], 0.99), 50);
});
