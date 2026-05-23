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

export type ScaleConcurrencyTier = 25 | 50 | 100;

export type ScaleConcurrencyTierEvidence = {
  achievedConcurrency: number;
  durationMinutes: number;
  failureRatePct: number;
  p95WorstMs: number;
  p99WorstMs: number;
  sampleCount: number;
  target: ScaleConcurrencyTier;
  timeoutRatePct: number;
};

export type ScaleReconnectStormEvidence = {
  attemptedConnections: number;
  durationSeconds: number;
  eventsReceived: number;
  failedConnections: number;
  maxConcurrentConnections: number;
  reconnectAttempts: number;
};

export type ScaleProviderOutageEvidence = {
  fallbackObserved: boolean;
  provider: string;
  recoverySeconds: number | null;
  surface: string;
};

export type ScaleDatabaseExplainEvidence = {
  indexEvidence: string;
  maxExecutionMs: number;
  queryLabel: string;
  sequentialScan: boolean;
};

export type ScaleMobileStressEvidence = {
  horizontalOverflow: boolean;
  longTaskCount: number;
  maxDomNodes: number;
  maxHeapMb: number | null;
  routeCount: number;
  viewportCount: number;
};

export type ScaleLargeWatchlistStressEvidence = {
  maxSymbols: number;
  p95InteractionMs: number;
  scannerRows: number;
  virtualized: boolean;
};

export type ScaleMemoryRenderCeilingEvidence = {
  maxContainerMemoryPct: number | null;
  maxProcessRssMb: number | null;
  maxRenderLatencyMs: number;
  runawayGrowthObserved: boolean;
};

export type ScaleObservabilityEvidence = {
  dashboard: "cache_hit" | "hot_endpoint_latency" | "request_latency" | "scale_artifact" | "synthetics" | "system_memory";
  status: "available" | "missing";
};

export type ScaleEvidenceInput = {
  authenticatedCoverage: boolean;
  concurrencyTiers: ScaleConcurrencyTierEvidence[];
  databaseHotPathExplained: boolean;
  databaseExplainAnalyses: ScaleDatabaseExplainEvidence[];
  largeWatchlistScannerStress: ScaleLargeWatchlistStressEvidence | null;
  memoryRenderCeiling: ScaleMemoryRenderCeilingEvidence | null;
  mobileStressTested: boolean;
  mobileStress: ScaleMobileStressEvidence | null;
  observabilityDashboards: ScaleObservabilityEvidence[];
  peakConcurrency: number;
  providerDegradationTested: boolean;
  providerOutages: ScaleProviderOutageEvidence[];
  sustainedMinutes: number;
  websocketReconnectStormTested: boolean;
  websocketReconnectStorm: ScaleReconnectStormEvidence | null;
};

export type ScaleChaosMatrixItem = {
  detail: string;
  label: string;
  passed: boolean;
  required: string;
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
  chaosMatrix: ScaleChaosMatrixItem[];
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
export const SCALE_REQUIRED_CONCURRENCY_TIERS: readonly ScaleConcurrencyTier[] = [25, 50, 100] as const;
export const SCALE_REQUIRED_OBSERVABILITY_DASHBOARDS: readonly ScaleObservabilityEvidence["dashboard"][] = [
  "cache_hit",
  "hot_endpoint_latency",
  "request_latency",
  "scale_artifact",
  "synthetics",
  "system_memory",
] as const;

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
  const chaosMatrix = buildScaleChaosMatrix(evidence);
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
    chaosMatrix,
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
  const concurrencyTiers = Array.isArray(input?.concurrencyTiers)
    ? input.concurrencyTiers.map(normalizeConcurrencyTierEvidence).filter((tier): tier is ScaleConcurrencyTierEvidence => tier !== null)
    : [];
  const providerOutages = Array.isArray(input?.providerOutages)
    ? input.providerOutages.map(normalizeProviderOutageEvidence).filter((outage): outage is ScaleProviderOutageEvidence => outage !== null)
    : [];
  const databaseExplainAnalyses = Array.isArray(input?.databaseExplainAnalyses)
    ? input.databaseExplainAnalyses.map(normalizeDatabaseExplainEvidence).filter((item): item is ScaleDatabaseExplainEvidence => item !== null)
    : [];
  const observabilityDashboards = Array.isArray(input?.observabilityDashboards)
    ? input.observabilityDashboards.map(normalizeObservabilityEvidence).filter((item): item is ScaleObservabilityEvidence => item !== null)
    : [];
  return {
    authenticatedCoverage: input?.authenticatedCoverage ?? false,
    concurrencyTiers,
    databaseHotPathExplained: input?.databaseHotPathExplained ?? false,
    databaseExplainAnalyses,
    largeWatchlistScannerStress: normalizeLargeWatchlistStress(input?.largeWatchlistScannerStress),
    memoryRenderCeiling: normalizeMemoryRenderCeiling(input?.memoryRenderCeiling),
    mobileStressTested: input?.mobileStressTested ?? false,
    mobileStress: normalizeMobileStress(input?.mobileStress),
    observabilityDashboards,
    peakConcurrency: Math.max(0, Math.round(input?.peakConcurrency ?? 0)),
    providerDegradationTested: input?.providerDegradationTested ?? false,
    providerOutages,
    sustainedMinutes: Math.max(0, Math.round(input?.sustainedMinutes ?? 0)),
    websocketReconnectStormTested: input?.websocketReconnectStormTested ?? false,
    websocketReconnectStorm: normalizeReconnectStorm(input?.websocketReconnectStorm),
  };
}

function normalizeConcurrencyTierEvidence(value: ScaleConcurrencyTierEvidence | undefined): ScaleConcurrencyTierEvidence | null {
  if (!value || !SCALE_REQUIRED_CONCURRENCY_TIERS.includes(value.target)) return null;
  return {
    achievedConcurrency: Math.max(0, Math.round(value.achievedConcurrency)),
    durationMinutes: Math.max(0, value.durationMinutes),
    failureRatePct: Math.max(0, value.failureRatePct),
    p95WorstMs: Math.max(0, Math.round(value.p95WorstMs)),
    p99WorstMs: Math.max(0, Math.round(value.p99WorstMs)),
    sampleCount: Math.max(0, Math.round(value.sampleCount)),
    target: value.target,
    timeoutRatePct: Math.max(0, value.timeoutRatePct),
  };
}

function normalizeReconnectStorm(value: ScaleReconnectStormEvidence | null | undefined): ScaleReconnectStormEvidence | null {
  if (!value) return null;
  return {
    attemptedConnections: Math.max(0, Math.round(value.attemptedConnections)),
    durationSeconds: Math.max(0, Math.round(value.durationSeconds)),
    eventsReceived: Math.max(0, Math.round(value.eventsReceived)),
    failedConnections: Math.max(0, Math.round(value.failedConnections)),
    maxConcurrentConnections: Math.max(0, Math.round(value.maxConcurrentConnections)),
    reconnectAttempts: Math.max(0, Math.round(value.reconnectAttempts)),
  };
}

function normalizeProviderOutageEvidence(value: ScaleProviderOutageEvidence | undefined): ScaleProviderOutageEvidence | null {
  if (!value?.provider || !value.surface) return null;
  return {
    fallbackObserved: Boolean(value.fallbackObserved),
    provider: String(value.provider).slice(0, 80),
    recoverySeconds: value.recoverySeconds === null ? null : Math.max(0, Math.round(value.recoverySeconds)),
    surface: String(value.surface).slice(0, 80),
  };
}

function normalizeDatabaseExplainEvidence(value: ScaleDatabaseExplainEvidence | undefined): ScaleDatabaseExplainEvidence | null {
  if (!value?.queryLabel) return null;
  return {
    indexEvidence: String(value.indexEvidence ?? "").slice(0, 160),
    maxExecutionMs: Math.max(0, value.maxExecutionMs),
    queryLabel: String(value.queryLabel).slice(0, 100),
    sequentialScan: Boolean(value.sequentialScan),
  };
}

function normalizeMobileStress(value: ScaleMobileStressEvidence | null | undefined): ScaleMobileStressEvidence | null {
  if (!value) return null;
  return {
    horizontalOverflow: Boolean(value.horizontalOverflow),
    longTaskCount: Math.max(0, Math.round(value.longTaskCount)),
    maxDomNodes: Math.max(0, Math.round(value.maxDomNodes)),
    maxHeapMb: value.maxHeapMb === null ? null : Math.max(0, value.maxHeapMb),
    routeCount: Math.max(0, Math.round(value.routeCount)),
    viewportCount: Math.max(0, Math.round(value.viewportCount)),
  };
}

function normalizeLargeWatchlistStress(value: ScaleLargeWatchlistStressEvidence | null | undefined): ScaleLargeWatchlistStressEvidence | null {
  if (!value) return null;
  return {
    maxSymbols: Math.max(0, Math.round(value.maxSymbols)),
    p95InteractionMs: Math.max(0, Math.round(value.p95InteractionMs)),
    scannerRows: Math.max(0, Math.round(value.scannerRows)),
    virtualized: Boolean(value.virtualized),
  };
}

function normalizeMemoryRenderCeiling(value: ScaleMemoryRenderCeilingEvidence | null | undefined): ScaleMemoryRenderCeilingEvidence | null {
  if (!value) return null;
  return {
    maxContainerMemoryPct: value.maxContainerMemoryPct === null ? null : Math.max(0, value.maxContainerMemoryPct),
    maxProcessRssMb: value.maxProcessRssMb === null ? null : Math.max(0, value.maxProcessRssMb),
    maxRenderLatencyMs: Math.max(0, Math.round(value.maxRenderLatencyMs)),
    runawayGrowthObserved: Boolean(value.runawayGrowthObserved),
  };
}

function normalizeObservabilityEvidence(value: ScaleObservabilityEvidence | undefined): ScaleObservabilityEvidence | null {
  if (!value || !SCALE_REQUIRED_OBSERVABILITY_DASHBOARDS.includes(value.dashboard)) return null;
  return {
    dashboard: value.dashboard,
    status: value.status === "available" ? "available" : "missing",
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
  blockers.push(...concurrencyTierBlockers(evidence.concurrencyTiers));
  if (!evidence.databaseHotPathExplained) blockers.push("database hot paths were not verified with query/index evidence");
  if (!databaseExplainEvidencePasses(evidence.databaseExplainAnalyses)) blockers.push("EXPLAIN/ANALYZE evidence is missing or shows unbounded sequential hot-path scans");
  if (!evidence.providerDegradationTested) blockers.push("degraded provider behavior was not tested");
  if (!providerOutageEvidencePasses(evidence.providerOutages)) blockers.push("provider outage simulation did not prove fallback and recovery behavior");
  if (!evidence.websocketReconnectStormTested) blockers.push("websocket/SSE reconnect storm behavior was not tested");
  if (!reconnectStormEvidencePasses(evidence.websocketReconnectStorm)) blockers.push("websocket/SSE reconnect storm evidence is missing or failed");
  if (!evidence.mobileStressTested) blockers.push("mobile render/memory stress evidence is missing");
  if (!mobileStressEvidencePasses(evidence.mobileStress)) blockers.push("mobile stress proof is missing or still shows overflow/long-task pressure");
  if (!largeWatchlistStressPasses(evidence.largeWatchlistScannerStress)) blockers.push("large watchlist/scanner stress evidence is missing or over budget");
  if (!memoryRenderCeilingPasses(evidence.memoryRenderCeiling)) blockers.push("memory/render ceiling evidence is missing or shows runaway growth");
  if (!observabilityDashboardsPass(evidence.observabilityDashboards)) blockers.push("production observability dashboards do not cover all required scale dimensions");
  return blockers;
}

function concurrencyTierBlockers(tiers: readonly ScaleConcurrencyTierEvidence[]): string[] {
  const blockers: string[] = [];
  for (const requiredTier of SCALE_REQUIRED_CONCURRENCY_TIERS) {
    const tier = tiers.find((candidate) => candidate.target === requiredTier);
    if (!tier) {
      blockers.push(`concurrency tier ${requiredTier} was not tested`);
      continue;
    }
    if (tier.achievedConcurrency < requiredTier) blockers.push(`concurrency tier ${requiredTier} achieved only ${tier.achievedConcurrency}`);
    if (tier.durationMinutes < SCALE_READY_MIN_SUSTAINED_MINUTES) blockers.push(`concurrency tier ${requiredTier} sustained ${tier.durationMinutes}m below ${SCALE_READY_MIN_SUSTAINED_MINUTES}m`);
    if (tier.sampleCount < SCALE_READY_MIN_ENDPOINT_SAMPLES) blockers.push(`concurrency tier ${requiredTier} has only ${tier.sampleCount} samples`);
    if (tier.failureRatePct > 1) blockers.push(`concurrency tier ${requiredTier} failure rate ${tier.failureRatePct}% exceeds 1%`);
    if (tier.timeoutRatePct > 0) blockers.push(`concurrency tier ${requiredTier} had ${tier.timeoutRatePct}% timeouts`);
  }
  return blockers;
}

function reconnectStormEvidencePasses(evidence: ScaleReconnectStormEvidence | null): boolean {
  if (!evidence) return false;
  if (evidence.maxConcurrentConnections < 25 || evidence.attemptedConnections < 25) return false;
  if (evidence.durationSeconds < 30) return false;
  if (evidence.failedConnections > 0) return false;
  return evidence.eventsReceived >= evidence.attemptedConnections;
}

function providerOutageEvidencePasses(outages: readonly ScaleProviderOutageEvidence[]): boolean {
  if (!outages.length) return false;
  return outages.some((outage) => outage.fallbackObserved && (outage.recoverySeconds === null || outage.recoverySeconds <= 60));
}

function databaseExplainEvidencePasses(items: readonly ScaleDatabaseExplainEvidence[]): boolean {
  if (items.length < 3) return false;
  return items.every((item) => item.maxExecutionMs <= 50 && (!item.sequentialScan || /bounded|small|index/i.test(item.indexEvidence)));
}

function mobileStressEvidencePasses(evidence: ScaleMobileStressEvidence | null): boolean {
  if (!evidence) return false;
  if (evidence.routeCount < 6 || evidence.viewportCount < 2) return false;
  if (evidence.horizontalOverflow) return false;
  return evidence.longTaskCount <= 2 && evidence.maxDomNodes <= 5_000;
}

function largeWatchlistStressPasses(evidence: ScaleLargeWatchlistStressEvidence | null): boolean {
  if (!evidence) return false;
  return evidence.maxSymbols >= 100 && evidence.scannerRows >= 150 && evidence.p95InteractionMs <= 250 && evidence.virtualized;
}

function memoryRenderCeilingPasses(evidence: ScaleMemoryRenderCeilingEvidence | null): boolean {
  if (!evidence) return false;
  if (evidence.runawayGrowthObserved) return false;
  if (evidence.maxContainerMemoryPct !== null && evidence.maxContainerMemoryPct > 85) return false;
  if (evidence.maxProcessRssMb !== null && evidence.maxProcessRssMb > 1_024) return false;
  return evidence.maxRenderLatencyMs <= 500;
}

function observabilityDashboardsPass(evidence: readonly ScaleObservabilityEvidence[]): boolean {
  const available = new Set(evidence.filter((item) => item.status === "available").map((item) => item.dashboard));
  return SCALE_REQUIRED_OBSERVABILITY_DASHBOARDS.every((dashboard) => available.has(dashboard));
}

function buildScaleChaosMatrix(evidence: ScaleEvidenceInput): ScaleChaosMatrixItem[] {
  const tierLabels = SCALE_REQUIRED_CONCURRENCY_TIERS.map((tier) => {
    const item = evidence.concurrencyTiers.find((candidate) => candidate.target === tier);
    return item ? `${tier}c ${item.durationMinutes}m` : `${tier}c missing`;
  });
  return [
    {
      detail: tierLabels.join(", "),
      label: "Sustained concurrency tiers",
      passed: concurrencyTierBlockers(evidence.concurrencyTiers).length === 0,
      required: "25/50/100 concurrency, each sustained at least 15 minutes",
    },
    {
      detail: evidence.websocketReconnectStorm
        ? `${evidence.websocketReconnectStorm.attemptedConnections} attempts, ${evidence.websocketReconnectStorm.failedConnections} failed, ${evidence.websocketReconnectStorm.eventsReceived} event(s)`
        : "No reconnect storm artifact",
      label: "Websocket/SSE storm",
      passed: evidence.websocketReconnectStormTested && reconnectStormEvidencePasses(evidence.websocketReconnectStorm),
      required: "25+ concurrent stream reconnects with events and zero failed connections",
    },
    {
      detail: evidence.providerOutages.length ? `${evidence.providerOutages.length} outage artifact(s)` : "No outage artifact",
      label: "Provider outage recovery",
      passed: evidence.providerDegradationTested && providerOutageEvidencePasses(evidence.providerOutages),
      required: "Fallback observed and recovery bounded",
    },
    {
      detail: evidence.databaseExplainAnalyses.length ? `${evidence.databaseExplainAnalyses.length} query plan artifact(s)` : "No query plan artifact",
      label: "DB hot-path plans",
      passed: evidence.databaseHotPathExplained && databaseExplainEvidencePasses(evidence.databaseExplainAnalyses),
      required: "EXPLAIN/ANALYZE on scanner, live, replay, and telemetry hot paths",
    },
    {
      detail: evidence.mobileStress ? `${evidence.mobileStress.routeCount} routes, ${evidence.mobileStress.viewportCount} viewport(s)` : "No mobile stress artifact",
      label: "Mobile render stress",
      passed: evidence.mobileStressTested && mobileStressEvidencePasses(evidence.mobileStress),
      required: "Large mobile route set without overflow or long-task pressure",
    },
    {
      detail: evidence.largeWatchlistScannerStress
        ? `${evidence.largeWatchlistScannerStress.maxSymbols} symbols, ${evidence.largeWatchlistScannerStress.scannerRows} scanner rows`
        : "No large watchlist artifact",
      label: "Large watchlist/scanner",
      passed: largeWatchlistStressPasses(evidence.largeWatchlistScannerStress),
      required: "100+ symbols and 150+ scanner rows with p95 interaction <= 250ms",
    },
    {
      detail: evidence.memoryRenderCeiling
        ? `render ${evidence.memoryRenderCeiling.maxRenderLatencyMs}ms, memory ${evidence.memoryRenderCeiling.maxContainerMemoryPct ?? "unknown"}%`
        : "No memory ceiling artifact",
      label: "Memory/render ceiling",
      passed: memoryRenderCeilingPasses(evidence.memoryRenderCeiling),
      required: "No runaway growth, container memory <= 85%, render <= 500ms",
    },
    {
      detail: `${evidence.observabilityDashboards.filter((item) => item.status === "available").length}/${SCALE_REQUIRED_OBSERVABILITY_DASHBOARDS.length} dashboards available`,
      label: "Production observability",
      passed: observabilityDashboardsPass(evidence.observabilityDashboards),
      required: "Latency, cache, synthetics, system, and scale artifacts visible",
    },
  ];
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
  if (blockers.some((blocker) => blocker.includes("concurrency tier"))) recommendations.push("run 25/50/100 production load tiers for at least 15 minutes each before scale certification");
  if (blockers.some((blocker) => blocker.includes("websocket"))) recommendations.push("run reconnect-storm tests against live-intelligence streams before certification");
  if (blockers.some((blocker) => blocker.includes("database"))) recommendations.push("capture EXPLAIN/ANALYZE evidence for scanner, replay, macro, telemetry, and chart hot queries");
  if (blockers.some((blocker) => blocker.includes("provider"))) recommendations.push("run controlled provider outage drills and verify explicit degraded-mode fallback plus recovery");
  if (blockers.some((blocker) => blocker.includes("mobile"))) recommendations.push("run mobile stress passes with large watchlists, dense scanner mode, fullscreen charts, and overlay churn");
  if (blockers.some((blocker) => blocker.includes("watchlist"))) recommendations.push("stress 100+ saved symbols and dense scanner rows with virtualization and p95 interaction telemetry");
  if (blockers.some((blocker) => blocker.includes("memory"))) recommendations.push("record container memory, process RSS, DOM node count, and render latency during load and mobile stress");
  if (blockers.some((blocker) => blocker.includes("observability"))) recommendations.push("publish scale-artifact, latency, cache-hit, synthetics, and system-memory panels in production observability");
  if (!recommendations.length) recommendations.push("keep scale probes scheduled and alert on p95/p99 budget regression");
  return recommendations;
}

function sanitizeLatency(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function maxMetric(values: readonly number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0);
}
