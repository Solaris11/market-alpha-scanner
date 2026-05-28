export type DiscoveryCacheStatus = "base-hit" | "base-miss" | "limited" | "stale-hit" | "system-hit" | "system-miss";

export type DiscoveryTimingInput = {
  cacheStatus: DiscoveryCacheStatus;
  latencyMs: number;
  statusCode: number;
};

export type DiscoveryPerformanceSnapshot = {
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

const DISCOVERY_TIMING_WINDOW_SIZE = 200;
const DISCOVERY_HOT_PATH_TARGET_MS = 300;
const DISCOVERY_P99_TARGET_MS = 600;
const DISCOVERY_TIMING_SAMPLE_RATE = boundedSampleRate(process.env.TRADEVETO_DISCOVERY_TIMING_SAMPLE_RATE, 0.2);

let discoveryTimings: DiscoveryTimingInput[] = [];
let discoverySuccessfulLatencies: number[] = [];
let discoveryCacheableSamples = 0;
let discoveryCacheHits = 0;
let discoverySnapshotCache: DiscoveryPerformanceSnapshot | null = null;

export function recordDiscoveryApiTiming(input: DiscoveryTimingInput): DiscoveryPerformanceSnapshot {
  const timing = sanitizeTiming(input);
  discoveryTimings.push(timing);
  addDiscoveryTiming(timing);
  if (discoveryTimings.length > DISCOVERY_TIMING_WINDOW_SIZE) {
    const removed = discoveryTimings.splice(0, discoveryTimings.length - DISCOVERY_TIMING_WINDOW_SIZE);
    for (const removedTiming of removed) removeDiscoveryTiming(removedTiming);
  }
  discoverySnapshotCache = buildDiscoveryPerformanceSnapshot();
  return discoverySnapshotCache;
}

export function getDiscoveryPerformanceSnapshot(): DiscoveryPerformanceSnapshot {
  if (discoverySnapshotCache) return discoverySnapshotCache;
  discoverySnapshotCache = buildDiscoveryPerformanceSnapshot();
  return discoverySnapshotCache;
}

export function shouldRecordDiscoveryApiTiming(): boolean {
  if (discoverySuccessfulLatencies.length === 0) return true;
  if (DISCOVERY_TIMING_SAMPLE_RATE >= 1) return true;
  if (DISCOVERY_TIMING_SAMPLE_RATE <= 0) return false;
  return Math.random() < DISCOVERY_TIMING_SAMPLE_RATE;
}

export function resetDiscoveryPerformanceForTests(): void {
  discoveryTimings = [];
  discoverySuccessfulLatencies = [];
  discoveryCacheableSamples = 0;
  discoveryCacheHits = 0;
  discoverySnapshotCache = null;
}

function buildDiscoveryPerformanceSnapshot(): DiscoveryPerformanceSnapshot {
  const sampleCount = discoverySuccessfulLatencies.length;
  const p50LatencyMs = percentile(discoverySuccessfulLatencies, 0.50);
  const p95LatencyMs = percentile(discoverySuccessfulLatencies, 0.95);
  const p99LatencyMs = percentile(discoverySuccessfulLatencies, 0.99);
  const maxLatencyMs = discoverySuccessfulLatencies.length ? discoverySuccessfulLatencies[discoverySuccessfulLatencies.length - 1] ?? 0 : 0;
  const cacheHitRate = discoveryCacheableSamples ? Math.round((discoveryCacheHits / discoveryCacheableSamples) * 100) : 0;

  return {
    cacheHitRate,
    hotPathTargetMs: DISCOVERY_HOT_PATH_TARGET_MS,
    maxLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    p99TargetMs: DISCOVERY_P99_TARGET_MS,
    sampleCount,
    targetMet: p95LatencyMs > 0 && p95LatencyMs <= DISCOVERY_HOT_PATH_TARGET_MS && p99LatencyMs <= DISCOVERY_P99_TARGET_MS,
    windowSize: DISCOVERY_TIMING_WINDOW_SIZE,
  };
}

function sanitizeTiming(input: DiscoveryTimingInput): DiscoveryTimingInput {
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

function addDiscoveryTiming(timing: DiscoveryTimingInput): void {
  if (timing.statusCode >= 500) return;
  insertSortedLatency(discoverySuccessfulLatencies, timing.latencyMs);
  if (timing.cacheStatus === "limited") return;
  discoveryCacheableSamples += 1;
  if (timing.cacheStatus === "system-hit" || timing.cacheStatus === "base-hit" || timing.cacheStatus === "stale-hit") {
    discoveryCacheHits += 1;
  }
}

function removeDiscoveryTiming(timing: DiscoveryTimingInput): void {
  if (timing.statusCode >= 500) return;
  removeSortedLatency(discoverySuccessfulLatencies, timing.latencyMs);
  if (timing.cacheStatus === "limited") return;
  discoveryCacheableSamples = Math.max(0, discoveryCacheableSamples - 1);
  if (timing.cacheStatus === "system-hit" || timing.cacheStatus === "base-hit" || timing.cacheStatus === "stale-hit") {
    discoveryCacheHits = Math.max(0, discoveryCacheHits - 1);
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

function boundedSampleRate(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}
