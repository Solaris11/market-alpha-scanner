export type LiveIntelligenceCacheStatus = "degraded-fallback" | "fresh-hit" | "stale-hit" | "warm-miss";

export type LiveIntelligenceTimingInput = {
  cacheStatus: LiveIntelligenceCacheStatus;
  latencyMs: number;
  statusCode: number;
};

export type LiveIntelligencePerformanceSnapshot = {
  cacheHitRate: number;
  hotPathTargetMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  p99TargetMs: number;
  sampleCount: number;
  targetMet: boolean;
  windowSize: number;
};

const LIVE_INTELLIGENCE_TIMING_WINDOW_SIZE = 200;
const LIVE_INTELLIGENCE_HOT_PATH_TARGET_MS = 400;
const LIVE_INTELLIGENCE_P99_TARGET_MS = 800;

let liveIntelligenceTimings: LiveIntelligenceTimingInput[] = [];

export function recordLiveIntelligenceApiTiming(input: LiveIntelligenceTimingInput): LiveIntelligencePerformanceSnapshot {
  liveIntelligenceTimings = [...liveIntelligenceTimings, sanitizeTiming(input)].slice(-LIVE_INTELLIGENCE_TIMING_WINDOW_SIZE);
  return getLiveIntelligencePerformanceSnapshot();
}

export function getLiveIntelligencePerformanceSnapshot(): LiveIntelligencePerformanceSnapshot {
  const successful = liveIntelligenceTimings.filter((timing) => timing.statusCode < 500);
  const values = successful.map((timing) => timing.latencyMs).sort((left, right) => left - right);
  const sampleCount = values.length;
  const p50LatencyMs = percentile(values, 0.50);
  const p95LatencyMs = percentile(values, 0.95);
  const p99LatencyMs = percentile(values, 0.99);
  const maxLatencyMs = values.length ? values[values.length - 1] ?? 0 : 0;
  const hits = successful.filter((timing) => timing.cacheStatus === "fresh-hit" || timing.cacheStatus === "stale-hit").length;
  const cacheHitRate = successful.length ? Math.round((hits / successful.length) * 100) : 0;

  return {
    cacheHitRate,
    hotPathTargetMs: LIVE_INTELLIGENCE_HOT_PATH_TARGET_MS,
    maxLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    p99TargetMs: LIVE_INTELLIGENCE_P99_TARGET_MS,
    sampleCount,
    targetMet: p95LatencyMs > 0 && p95LatencyMs <= LIVE_INTELLIGENCE_HOT_PATH_TARGET_MS && p99LatencyMs <= LIVE_INTELLIGENCE_P99_TARGET_MS,
    windowSize: LIVE_INTELLIGENCE_TIMING_WINDOW_SIZE,
  };
}

export function resetLiveIntelligencePerformanceForTests(): void {
  liveIntelligenceTimings = [];
}

function sanitizeTiming(input: LiveIntelligenceTimingInput): LiveIntelligenceTimingInput {
  const latencyMs = Number.isFinite(input.latencyMs) ? Math.max(0, Math.round(input.latencyMs)) : 0;
  const statusCode = Number.isFinite(input.statusCode) ? Math.max(100, Math.min(599, Math.round(input.statusCode))) : 500;
  return {
    cacheStatus: input.cacheStatus,
    latencyMs,
    statusCode,
  };
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentileValue) - 1));
  return values[index] ?? 0;
}
