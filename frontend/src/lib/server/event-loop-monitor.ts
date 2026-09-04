// Deliberately no `server-only` import: this module holds no secrets and no
// server state, and keeping it importable lets it carry unit tests under the
// project's own test runner. `node:perf_hooks` cannot resolve in a client
// bundle anyway, so the boundary is still enforced by the runtime.
import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";

import { readCacheSizes } from "./cache-registry";

/**
 * Process-level stall detection.
 *
 * The 2026-06-10 stability observation recorded a 934 second time-to-first-byte
 * on `/api/health`, an endpoint that performs no I/O at all. Nothing in the
 * request path can explain that, which leaves the process itself: either the
 * event loop was blocked or the process was not scheduled. Until now there was
 * no way to tell those apart after the fact.
 *
 * `monitorEventLoopDelay` samples the delay between a timer's scheduled and
 * actual firing using a native histogram, so the cost is a single libuv timer
 * regardless of request volume. The histogram is cumulative and deliberately
 * never reset by a request: `/api/health` is polled every 30s by the container
 * healthcheck and every 60s by the stability observer, so a monotonically
 * growing `maxMs` can be localised in time by diffing consecutive samples,
 * while a reset-on-read would let whichever poller ran first swallow the spike.
 */

const RESOLUTION_MS = 10;

type EventLoopMonitorGlobal = typeof globalThis & {
  __tradevetoEventLoopHistogram?: IntervalHistogram;
  __tradevetoEventLoopStartedAt?: number;
};

export type EventLoopDelaySnapshot = {
  /** Milliseconds of delay at the worst observed tick since process start. */
  maxMs: number;
  meanMs: number;
  p99Ms: number;
  /** Seconds the histogram has been collecting. */
  windowSeconds: number;
};

export type ProcessHealthSnapshot = {
  /** Live entry count per registered module-level cache. */
  caches: Record<string, number>;
  eventLoopDelay: EventLoopDelaySnapshot;
  /** Bytes held outside the V8 heap: large strings and buffers land here. */
  externalMb: number;
  /**
   * heapTotal minus heapUsed is the fragmentation signal. A process that keeps
   * building multi-megabyte strings holds arenas it cannot return to the OS,
   * which reads as growing rss with a flat heapUsed -- a different problem from
   * a retained object graph, and the two need different fixes.
   */
  heapTotalMb: number;
  heapUsedMb: number;
  rssMb: number;
};

function eventLoopHistogram(): IntervalHistogram {
  const monitorGlobal = globalThis as EventLoopMonitorGlobal;
  if (!monitorGlobal.__tradevetoEventLoopHistogram) {
    const histogram = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
    histogram.enable();
    // Do not hold the process open for the sake of measurement.
    monitorGlobal.__tradevetoEventLoopHistogram = histogram;
    monitorGlobal.__tradevetoEventLoopStartedAt = Date.now();
  }
  return monitorGlobal.__tradevetoEventLoopHistogram;
}

export function readEventLoopDelay(): EventLoopDelaySnapshot {
  const monitorGlobal = globalThis as EventLoopMonitorGlobal;
  const histogram = eventLoopHistogram();
  const startedAt = monitorGlobal.__tradevetoEventLoopStartedAt ?? Date.now();
  return {
    maxMs: nanosecondsToMs(histogram.max),
    meanMs: nanosecondsToMs(histogram.mean),
    p99Ms: nanosecondsToMs(histogram.percentile(99)),
    windowSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
  };
}

export function readProcessHealth(): ProcessHealthSnapshot {
  const memory = process.memoryUsage();
  return {
    caches: readCacheSizes(),
    eventLoopDelay: readEventLoopDelay(),
    externalMb: bytesToMb(memory.external),
    heapTotalMb: bytesToMb(memory.heapTotal),
    heapUsedMb: bytesToMb(memory.heapUsed),
    rssMb: bytesToMb(memory.rss),
  };
}

function nanosecondsToMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 100_000) / 10;
}

function bytesToMb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 104_857.6) / 10;
}
