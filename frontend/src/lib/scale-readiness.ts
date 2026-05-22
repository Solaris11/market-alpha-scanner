export type ScaleEndpointCategory =
  | "chart"
  | "health"
  | "live"
  | "macro"
  | "ranking"
  | "replay"
  | "scanner"
  | "strategy"
  | "telemetry";

export type ScaleHttpMethod = "GET" | "POST";

export type ScaleEndpointBudget = {
  cachePolicy: string;
  category: ScaleEndpointCategory;
  concurrencyTarget: number;
  freshnessPolicy: string;
  method: ScaleHttpMethod;
  path: string;
  p95BudgetMs: number;
  p99BudgetMs: number;
  requiresAuth: boolean;
  scaleRisk: "high" | "low" | "medium";
};

export type ScaleProbeSample = {
  error?: string | null;
  latencyMs: number;
  method: ScaleHttpMethod;
  path: string;
  statusCode: number;
  timestamp?: string | null;
};

export type ScaleEvidenceInput = {
  authenticatedCoverage: boolean;
  databaseHotPathExplained: boolean;
  mobileStressTested: boolean;
  peakConcurrency: number;
  providerDegradationTested: boolean;
  sustainedMinutes: number;
  websocketReconnectStormTested: boolean;
};

export type ScaleEndpointResult = {
  cachePolicy: string;
  category: ScaleEndpointCategory;
  failureReasons: string[];
  freshnessPolicy: string;
  maxLatencyMs: number;
  method: ScaleHttpMethod;
  p50LatencyMs: number;
  p95BudgetMs: number;
  p95LatencyMs: number;
  p99BudgetMs: number;
  p99LatencyMs: number;
  path: string;
  sampleCount: number;
  status: "fail" | "insufficient_evidence" | "pass" | "warn";
  successRatePct: number;
};

export type ScaleCategoryScore = {
  category: ScaleEndpointCategory;
  endpointCount: number;
  score: number;
};

export type ScaleReadinessReport = {
  blockers: string[];
  categoryScores: ScaleCategoryScore[];
  endpointResults: ScaleEndpointResult[];
  evidence: ScaleEvidenceInput;
  evidenceBoundary: string;
  generatedAt: string;
  overallStatus: "not_ready" | "ready" | "watch";
  recommendations: string[];
  summary: {
    failedEndpoints: number;
    insufficientEndpoints: number;
    maxLatencyMs: number;
    p95WorstMs: number;
    p99WorstMs: number;
    passedEndpoints: number;
    warnedEndpoints: number;
  };
};

export type ScaleDatabaseIndexRecommendation = {
  reason: string;
  sql: string;
  table: string;
};

export type ScaleCacheGovernanceRule = {
  invalidation: string;
  keyBoundary: string;
  maxTtlSeconds: number;
  staleProtection: string;
  system: string;
};

export const SCALE_READY_MIN_ENDPOINT_SAMPLES = 10;
export const SCALE_READY_MIN_PEAK_CONCURRENCY = 25;
export const SCALE_READY_MIN_SUSTAINED_MINUTES = 15;
export const SCALE_READY_MIN_SUCCESS_RATE_PCT = 99;

export const SCALE_ENDPOINT_CATALOG: ScaleEndpointBudget[] = [
  {
    cachePolicy: "no-cache; health must reflect current dependency state",
    category: "health",
    concurrencyTarget: 25,
    freshnessPolicy: "live dependency check",
    method: "GET",
    path: "/api/health",
    p95BudgetMs: 150,
    p99BudgetMs: 300,
    requiresAuth: false,
    scaleRisk: "low",
  },
  {
    cachePolicy: "short internal memoization acceptable only for nested dependency probes",
    category: "health",
    concurrencyTarget: 25,
    freshnessPolicy: "live dependency check with explicit degraded state",
    method: "GET",
    path: "/api/health/deep",
    p95BudgetMs: 750,
    p99BudgetMs: 1_500,
    requiresAuth: false,
    scaleRisk: "medium",
  },
  {
    cachePolicy: "freshness-aware hot-category cache; never hide limited/stale evidence",
    category: "scanner",
    concurrencyTarget: 50,
    freshnessPolicy: "scanner packet must expose generated_at and cache status",
    method: "GET",
    path: "/api/discovery",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiresAuth: true,
    scaleRisk: "high",
  },
  {
    cachePolicy: "rank packet cache keyed by scanner run and freshness state",
    category: "ranking",
    concurrencyTarget: 50,
    freshnessPolicy: "ranking must downgrade when scanner freshness is stale",
    method: "GET",
    path: "/api/ranking",
    p95BudgetMs: 300,
    p99BudgetMs: 600,
    requiresAuth: true,
    scaleRisk: "high",
  },
  {
    cachePolicy: "symbol replay cache keyed by symbol and replay snapshot generation",
    category: "replay",
    concurrencyTarget: 35,
    freshnessPolicy: "replay snapshot must expose generated_at and limited evidence warnings",
    method: "GET",
    path: "/api/history/replay?symbol=AMD",
    p95BudgetMs: 700,
    p99BudgetMs: 1_200,
    requiresAuth: true,
    scaleRisk: "medium",
  },
  {
    cachePolicy: "public replay cache with provider attribution and stale-state disclosure",
    category: "replay",
    concurrencyTarget: 35,
    freshnessPolicy: "latest replay packet must expose generated_at and source depth",
    method: "GET",
    path: "/api/v1/replay?symbol=AMD",
    p95BudgetMs: 600,
    p99BudgetMs: 1_000,
    requiresAuth: false,
    scaleRisk: "medium",
  },
  {
    cachePolicy: "macro packet cache bounded by provider freshness and event calendar updates",
    category: "macro",
    concurrencyTarget: 35,
    freshnessPolicy: "macro packet must expose generated_at and source freshness",
    method: "GET",
    path: "/api/v1/macro",
    p95BudgetMs: 500,
    p99BudgetMs: 900,
    requiresAuth: false,
    scaleRisk: "medium",
  },
  {
    cachePolicy: "OHLC cache keyed by symbol, period, source, and freshness state",
    category: "chart",
    concurrencyTarget: 35,
    freshnessPolicy: "chart response must expose source and unavailable/limited history state",
    method: "GET",
    path: "/api/price-history/AMD?period=1y",
    p95BudgetMs: 700,
    p99BudgetMs: 1_200,
    requiresAuth: true,
    scaleRisk: "medium",
  },
  {
    cachePolicy: "no-cache writes; aggregate analytics asynchronously",
    category: "telemetry",
    concurrencyTarget: 50,
    freshnessPolicy: "telemetry writes must not block primary UX",
    method: "POST",
    path: "/api/analytics/events",
    p95BudgetMs: 250,
    p99BudgetMs: 500,
    requiresAuth: false,
    scaleRisk: "high",
  },
  {
    cachePolicy: "live-intelligence packet cache bounded by stream interval and freshness state",
    category: "live",
    concurrencyTarget: 50,
    freshnessPolicy: "live packet must expose stream state and stale/degraded status",
    method: "GET",
    path: "/api/live-intelligence",
    p95BudgetMs: 400,
    p99BudgetMs: 800,
    requiresAuth: false,
    scaleRisk: "high",
  },
  {
    cachePolicy: "scenario reads may reuse strategy memory; scenario request body is never cached",
    category: "strategy",
    concurrencyTarget: 25,
    freshnessPolicy: "portfolio scenario output must expose limited data and replay freshness",
    method: "POST",
    path: "/api/v1/portfolio/scenario",
    p95BudgetMs: 900,
    p99BudgetMs: 1_600,
    requiresAuth: true,
    scaleRisk: "medium",
  },
];

export const SCALE_DATABASE_INDEX_RECOMMENDATIONS: ScaleDatabaseIndexRecommendation[] = [
  {
    reason: "Admin monitoring, scale probes, and route scorecards group request metrics by route and time window.",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_metrics_route_created_at ON request_metrics (route, created_at DESC);",
    table: "request_metrics",
  },
  {
    reason: "Retention cleanup and global p50/p95/p99 windows scan by created_at.",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_request_metrics_created_at ON request_metrics (created_at DESC);",
    table: "request_metrics",
  },
  {
    reason: "Operational event dashboards and degraded-mode audits query recent events by type.",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monitoring_events_event_type_created_at ON monitoring_events (event_type, created_at DESC);",
    table: "monitoring_events",
  },
  {
    reason: "Synthetic health dashboards query latest status by check name.",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synthetic_check_results_name_created_at ON synthetic_check_results (check_name, created_at DESC);",
    table: "synthetic_check_results",
  },
];

export const SCALE_CACHE_GOVERNANCE: ScaleCacheGovernanceRule[] = [
  {
    invalidation: "invalidate when scanner run id, watchlist state, or evidence freshness changes",
    keyBoundary: "user id + scanner run id + preset + filter hash",
    maxTtlSeconds: 60,
    staleProtection: "mark stale and downgrade confidence instead of serving as live",
    system: "scanner/discovery",
  },
  {
    invalidation: "invalidate on replay snapshot generation or symbol evidence refresh",
    keyBoundary: "symbol + replay snapshot id + macro regime",
    maxTtlSeconds: 900,
    staleProtection: "show generated_at, evidence depth, and limited replay warning",
    system: "replay/market memory",
  },
  {
    invalidation: "invalidate on macro provider update, economic event update, or source freshness breach",
    keyBoundary: "macro packet version + provider timestamp",
    maxTtlSeconds: 300,
    staleProtection: "surface delayed-provider disclosure and avoid live language",
    system: "macro/news",
  },
  {
    invalidation: "invalidate on OHLC provider update or source fallback change",
    keyBoundary: "symbol + period + provider + source freshness",
    maxTtlSeconds: 300,
    staleProtection: "chart overlays must show source and unavailable state instead of invented points",
    system: "charts",
  },
];

export const SCALE_LIVE_STABILITY_REQUIREMENTS = [
  "cap client reconnect attempts with jittered backoff",
  "deduplicate live intelligence packets by generated_at and sequence",
  "expire stale subscriptions after heartbeat misses",
  "fan out shared packets instead of rebuilding per connection",
  "record reconnect storm counts and live packet send failures",
] as const;

export const SCALE_FRONTEND_CEILING_REQUIREMENTS = [
  "virtualize scanner rows above 150 rendered items",
  "defer noncritical cinematic panels below first viewport",
  "lazy-load fullscreen chart tooling and heavy visualizations",
  "preserve reduced-motion and low-bandwidth modes",
  "track DOM node count, long tasks, hydration warnings, and overlay open latency",
] as const;

export function buildScaleReadinessReport(input: {
  endpointCatalog?: readonly ScaleEndpointBudget[];
  evidence?: Partial<ScaleEvidenceInput>;
  generatedAt?: string;
  samples: readonly ScaleProbeSample[];
}): ScaleReadinessReport {
  const endpointCatalog = input.endpointCatalog ?? SCALE_ENDPOINT_CATALOG;
  const evidence = normalizeEvidence(input.evidence);
  const endpointResults = endpointCatalog.map((endpoint) => evaluateScaleEndpoint(endpoint, input.samples));
  const blockers = scaleEvidenceBlockers(evidence, endpointResults, endpointCatalog);
  const summary = summarizeEndpointResults(endpointResults);
  const categoryScores = buildCategoryScores(endpointResults);
  const recommendations = buildScaleRecommendations(endpointResults, blockers);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const hasEndpointFailure = endpointResults.some((result) => result.status === "fail" || result.status === "insufficient_evidence");
  const hasWarnings = endpointResults.some((result) => result.status === "warn");
  const overallStatus = blockers.length > 0 || hasEndpointFailure ? "not_ready" : hasWarnings ? "watch" : "ready";

  return {
    blockers,
    categoryScores,
    endpointResults,
    evidence,
    evidenceBoundary: "Scale certification requires authenticated production samples, sustained concurrency, database hot-path evidence, provider degradation tests, websocket reconnect-storm tests, and mobile stress evidence. Synthetic local checks alone cannot certify scale readiness.",
    generatedAt,
    overallStatus,
    recommendations,
    summary,
  };
}

export function evaluateScaleEndpoint(endpoint: ScaleEndpointBudget, samples: readonly ScaleProbeSample[]): ScaleEndpointResult {
  const relevant = samples.filter((sample) => sample.method === endpoint.method && sample.path === endpoint.path);
  const latencies = relevant.map((sample) => sanitizeLatency(sample.latencyMs)).sort((left, right) => left - right);
  const sampleCount = relevant.length;
  const successful = relevant.filter((sample) => sample.statusCode < 500 && !sample.error);
  const successRatePct = sampleCount ? Math.round((successful.length / sampleCount) * 10_000) / 100 : 0;
  const p50LatencyMs = percentile(latencies, 0.50);
  const p95LatencyMs = percentile(latencies, 0.95);
  const p99LatencyMs = percentile(latencies, 0.99);
  const maxLatencyMs = latencies.length ? latencies[latencies.length - 1] ?? 0 : 0;
  const failureReasons = endpointFailureReasons(endpoint, {
    p95LatencyMs,
    p99LatencyMs,
    sampleCount,
    successRatePct,
  });
  const status = endpointStatus(endpoint, {
    failureReasons,
    p95LatencyMs,
    p99LatencyMs,
    sampleCount,
    successRatePct,
  });

  return {
    cachePolicy: endpoint.cachePolicy,
    category: endpoint.category,
    failureReasons,
    freshnessPolicy: endpoint.freshnessPolicy,
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

export function percentile(values: readonly number[], percentileValue: number): number {
  if (!values.length) return 0;
  const normalizedPercentile = Math.max(0, Math.min(1, percentileValue));
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * normalizedPercentile) - 1));
  return values[index] ?? 0;
}

function endpointFailureReasons(
  endpoint: ScaleEndpointBudget,
  metrics: {
    p95LatencyMs: number;
    p99LatencyMs: number;
    sampleCount: number;
    successRatePct: number;
  },
): string[] {
  const reasons: string[] = [];
  if (metrics.sampleCount < SCALE_READY_MIN_ENDPOINT_SAMPLES) {
    reasons.push(`only ${metrics.sampleCount} samples; need at least ${SCALE_READY_MIN_ENDPOINT_SAMPLES}`);
  }
  if (metrics.successRatePct < SCALE_READY_MIN_SUCCESS_RATE_PCT) {
    reasons.push(`success rate ${metrics.successRatePct}% below ${SCALE_READY_MIN_SUCCESS_RATE_PCT}%`);
  }
  if (metrics.p95LatencyMs > endpoint.p95BudgetMs) {
    reasons.push(`p95 ${metrics.p95LatencyMs}ms exceeds ${endpoint.p95BudgetMs}ms`);
  }
  if (metrics.p99LatencyMs > endpoint.p99BudgetMs) {
    reasons.push(`p99 ${metrics.p99LatencyMs}ms exceeds ${endpoint.p99BudgetMs}ms`);
  }
  return reasons;
}

function endpointStatus(
  endpoint: ScaleEndpointBudget,
  metrics: {
    failureReasons: readonly string[];
    p95LatencyMs: number;
    p99LatencyMs: number;
    sampleCount: number;
    successRatePct: number;
  },
): ScaleEndpointResult["status"] {
  if (metrics.sampleCount < SCALE_READY_MIN_ENDPOINT_SAMPLES) return "insufficient_evidence";
  if (metrics.failureReasons.length > 0) return "fail";
  if (metrics.p95LatencyMs > endpoint.p95BudgetMs * 0.85 || metrics.p99LatencyMs > endpoint.p99BudgetMs * 0.85 || metrics.successRatePct < 100) return "warn";
  return "pass";
}

function normalizeEvidence(input: Partial<ScaleEvidenceInput> | undefined): ScaleEvidenceInput {
  return {
    authenticatedCoverage: input?.authenticatedCoverage ?? false,
    databaseHotPathExplained: input?.databaseHotPathExplained ?? false,
    mobileStressTested: input?.mobileStressTested ?? false,
    peakConcurrency: Math.max(0, Math.round(input?.peakConcurrency ?? 0)),
    providerDegradationTested: input?.providerDegradationTested ?? false,
    sustainedMinutes: Math.max(0, Math.round(input?.sustainedMinutes ?? 0)),
    websocketReconnectStormTested: input?.websocketReconnectStormTested ?? false,
  };
}

function scaleEvidenceBlockers(
  evidence: ScaleEvidenceInput,
  endpointResults: readonly ScaleEndpointResult[],
  endpointCatalog: readonly ScaleEndpointBudget[],
): string[] {
  const blockers: string[] = [];
  const hasAuthRequiredEndpoint = endpointCatalog.some((endpoint) => endpoint.requiresAuth);
  const failedEndpoints = endpointResults.filter((result) => result.status === "fail");
  const insufficientEndpoints = endpointResults.filter((result) => result.status === "insufficient_evidence");

  if (failedEndpoints.length) blockers.push(`${failedEndpoints.length} hot endpoint(s) failed scale budgets`);
  if (insufficientEndpoints.length) blockers.push(`${insufficientEndpoints.length} hot endpoint(s) have insufficient sample depth`);
  if (hasAuthRequiredEndpoint && !evidence.authenticatedCoverage) blockers.push("authenticated scanner/chart/strategy paths were not covered");
  if (evidence.peakConcurrency < SCALE_READY_MIN_PEAK_CONCURRENCY) blockers.push(`peak concurrency ${evidence.peakConcurrency} below ${SCALE_READY_MIN_PEAK_CONCURRENCY}`);
  if (evidence.sustainedMinutes < SCALE_READY_MIN_SUSTAINED_MINUTES) blockers.push(`sustained load window ${evidence.sustainedMinutes}m below ${SCALE_READY_MIN_SUSTAINED_MINUTES}m`);
  if (!evidence.databaseHotPathExplained) blockers.push("database hot paths were not verified with query/index evidence");
  if (!evidence.providerDegradationTested) blockers.push("degraded provider behavior was not tested");
  if (!evidence.websocketReconnectStormTested) blockers.push("websocket/SSE reconnect storm behavior was not tested");
  if (!evidence.mobileStressTested) blockers.push("mobile render/memory stress evidence is missing");
  return blockers;
}

function summarizeEndpointResults(endpointResults: readonly ScaleEndpointResult[]): ScaleReadinessReport["summary"] {
  return {
    failedEndpoints: endpointResults.filter((result) => result.status === "fail").length,
    insufficientEndpoints: endpointResults.filter((result) => result.status === "insufficient_evidence").length,
    maxLatencyMs: maxMetric(endpointResults.map((result) => result.maxLatencyMs)),
    p95WorstMs: maxMetric(endpointResults.map((result) => result.p95LatencyMs)),
    p99WorstMs: maxMetric(endpointResults.map((result) => result.p99LatencyMs)),
    passedEndpoints: endpointResults.filter((result) => result.status === "pass").length,
    warnedEndpoints: endpointResults.filter((result) => result.status === "warn").length,
  };
}

function buildCategoryScores(endpointResults: readonly ScaleEndpointResult[]): ScaleCategoryScore[] {
  const grouped = endpointResults.reduce<Map<ScaleEndpointCategory, number[]>>((acc, result) => {
    const score = endpointScore(result);
    acc.set(result.category, [...(acc.get(result.category) ?? []), score]);
    return acc;
  }, new Map<ScaleEndpointCategory, number[]>());

  return Array.from(grouped.entries())
    .map(([category, scores]) => ({
      category,
      endpointCount: scores.length,
      score: Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length)),
    }))
    .sort((left, right) => left.category.localeCompare(right.category));
}

function endpointScore(result: ScaleEndpointResult): number {
  if (result.status === "pass") return 100;
  if (result.status === "warn") return 82;
  if (result.status === "fail") return 45;
  return 25;
}

function buildScaleRecommendations(endpointResults: readonly ScaleEndpointResult[], blockers: readonly string[]): string[] {
  const recommendations: string[] = [];
  const failedScanner = endpointResults.some((result) => result.category === "scanner" && result.status !== "pass");
  const failedReplay = endpointResults.some((result) => result.category === "replay" && result.status !== "pass");
  const failedChart = endpointResults.some((result) => result.category === "chart" && result.status !== "pass");
  const failedTelemetry = endpointResults.some((result) => result.category === "telemetry" && result.status !== "pass");

  if (failedScanner) recommendations.push("precompute scanner hot categories and verify /api/discovery p95 under 300ms with authenticated traffic");
  if (failedReplay) recommendations.push("cache replay and memory analog packets by snapshot id with explicit generated_at/freshness metadata");
  if (failedChart) recommendations.push("index OHLC lookups by symbol and timestamp, then verify chart API budgets under authenticated load");
  if (failedTelemetry) recommendations.push("batch telemetry writes and keep analytics ingestion off the interaction critical path");
  if (blockers.some((blocker) => blocker.includes("websocket"))) recommendations.push("run reconnect-storm tests against live-intelligence streams before certification");
  if (blockers.some((blocker) => blocker.includes("database"))) recommendations.push("capture EXPLAIN/ANALYZE evidence for scanner, replay, macro, telemetry, and chart hot queries");
  if (blockers.some((blocker) => blocker.includes("mobile"))) recommendations.push("run mobile stress passes with large watchlists, dense scanner mode, fullscreen charts, and overlay churn");
  if (!recommendations.length) recommendations.push("keep scale probes scheduled and alert on p95/p99 budget regression");
  return recommendations;
}

function sanitizeLatency(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function maxMetric(values: readonly number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0);
}
