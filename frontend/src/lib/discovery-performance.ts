export type DiscoveryCacheStatus = "base-hit" | "base-miss" | "limited" | "system-hit" | "system-miss";

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
  sampleCount: number;
  targetMet: boolean;
  windowSize: number;
};

const DISCOVERY_TIMING_WINDOW_SIZE = 200;
const DISCOVERY_HOT_PATH_TARGET_MS = 300;

let discoveryTimings: DiscoveryTimingInput[] = [];

export function recordDiscoveryApiTiming(input: DiscoveryTimingInput): DiscoveryPerformanceSnapshot {
  discoveryTimings = [...discoveryTimings, sanitizeTiming(input)].slice(-DISCOVERY_TIMING_WINDOW_SIZE);
  return getDiscoveryPerformanceSnapshot();
}

export function getDiscoveryPerformanceSnapshot(): DiscoveryPerformanceSnapshot {
  const successful = discoveryTimings.filter((timing) => timing.statusCode < 500);
  const values = successful.map((timing) => timing.latencyMs).sort((left, right) => left - right);
  const sampleCount = values.length;
  const p50LatencyMs = percentile(values, 0.50);
  const p95LatencyMs = percentile(values, 0.95);
  const p99LatencyMs = percentile(values, 0.99);
  const maxLatencyMs = values.length ? values[values.length - 1] ?? 0 : 0;
  const cacheable = successful.filter((timing) => timing.cacheStatus !== "limited");
  const hits = cacheable.filter((timing) => timing.cacheStatus === "system-hit" || timing.cacheStatus === "base-hit").length;
  const cacheHitRate = cacheable.length ? Math.round((hits / cacheable.length) * 100) : 0;

  return {
    cacheHitRate,
    hotPathTargetMs: DISCOVERY_HOT_PATH_TARGET_MS,
    maxLatencyMs,
    p50LatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    sampleCount,
    targetMet: p95LatencyMs > 0 && p95LatencyMs <= DISCOVERY_HOT_PATH_TARGET_MS,
    windowSize: DISCOVERY_TIMING_WINDOW_SIZE,
  };
}

export function resetDiscoveryPerformanceForTests(): void {
  discoveryTimings = [];
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
