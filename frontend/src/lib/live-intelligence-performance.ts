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
let liveIntelligenceSuccessfulLatencies: number[] = [];
let liveIntelligenceSuccessfulSamples = 0;
let liveIntelligenceCacheHits = 0;

export function recordLiveIntelligenceApiTiming(input: LiveIntelligenceTimingInput): LiveIntelligencePerformanceSnapshot {
  const timing = sanitizeTiming(input);
  liveIntelligenceTimings.push(timing);
  addLiveIntelligenceTiming(timing);
  if (liveIntelligenceTimings.length > LIVE_INTELLIGENCE_TIMING_WINDOW_SIZE) {
    const removed = liveIntelligenceTimings.splice(0, liveIntelligenceTimings.length - LIVE_INTELLIGENCE_TIMING_WINDOW_SIZE);
    for (const removedTiming of removed) removeLiveIntelligenceTiming(removedTiming);
  }
  return getLiveIntelligencePerformanceSnapshot();
}

export function getLiveIntelligencePerformanceSnapshot(): LiveIntelligencePerformanceSnapshot {
  const sampleCount = liveIntelligenceSuccessfulLatencies.length;
  const p50LatencyMs = percentile(liveIntelligenceSuccessfulLatencies, 0.50);
  const p95LatencyMs = percentile(liveIntelligenceSuccessfulLatencies, 0.95);
  const p99LatencyMs = percentile(liveIntelligenceSuccessfulLatencies, 0.99);
  const maxLatencyMs = liveIntelligenceSuccessfulLatencies.length ? liveIntelligenceSuccessfulLatencies[liveIntelligenceSuccessfulLatencies.length - 1] ?? 0 : 0;
  const cacheHitRate = liveIntelligenceSuccessfulSamples ? Math.round((liveIntelligenceCacheHits / liveIntelligenceSuccessfulSamples) * 100) : 0;

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
  liveIntelligenceSuccessfulLatencies = [];
  liveIntelligenceSuccessfulSamples = 0;
  liveIntelligenceCacheHits = 0;
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

function addLiveIntelligenceTiming(timing: LiveIntelligenceTimingInput): void {
  if (timing.statusCode >= 500) return;
  insertSortedLatency(liveIntelligenceSuccessfulLatencies, timing.latencyMs);
  liveIntelligenceSuccessfulSamples += 1;
  if (timing.cacheStatus === "fresh-hit" || timing.cacheStatus === "stale-hit") {
    liveIntelligenceCacheHits += 1;
  }
}

function removeLiveIntelligenceTiming(timing: LiveIntelligenceTimingInput): void {
  if (timing.statusCode >= 500) return;
  removeSortedLatency(liveIntelligenceSuccessfulLatencies, timing.latencyMs);
  liveIntelligenceSuccessfulSamples = Math.max(0, liveIntelligenceSuccessfulSamples - 1);
  if (timing.cacheStatus === "fresh-hit" || timing.cacheStatus === "stale-hit") {
    liveIntelligenceCacheHits = Math.max(0, liveIntelligenceCacheHits - 1);
  }
}

function insertSortedLatency(values: number[], latencyMs: number): void {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const midpoint = Math.floor((low + high) / 2);
    if ((values[midpoint] ?? 0) <= latencyMs) low = midpoint + 1;
    else high = midpoint;
  }
  values.splice(low, 0, latencyMs);
}

function removeSortedLatency(values: number[], latencyMs: number): void {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2);
    const value = values[midpoint] ?? 0;
    if (value === latencyMs) {
      values.splice(midpoint, 1);
      return;
    }
    if (value < latencyMs) low = midpoint + 1;
    else high = midpoint - 1;
  }
}
