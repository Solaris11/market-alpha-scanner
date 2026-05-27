import "server-only";

import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import type { LiveIntelligenceCacheStatus } from "@/lib/live-intelligence-performance";
import { buildLiveIntelligenceSystem, type LiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export type LiveIntelligenceLoadOptions = {
  refreshIntervalMs?: number;
  sequence?: number;
  streamMode?: "snapshot" | "sse";
};

export type LiveIntelligenceLoadResult = {
  cacheStatus: LiveIntelligenceCacheStatus;
  durationMs: number;
  serializedSystem: string;
  system: LiveIntelligenceSystem;
};

type LiveIntelligenceCacheEntry = {
  expiresAt: number;
  refreshing?: Promise<LiveIntelligenceSystem>;
  resolved: LiveIntelligenceSystem;
  serializedSnapshots: Map<string, string>;
  staleUntil: number;
};

const LIVE_INTELLIGENCE_CACHE_TTL_MS = 20_000;
const LIVE_INTELLIGENCE_STALE_TTL_MS = 180_000;
const LIVE_INTELLIGENCE_BUILD_TIMEOUT_MS = 260;
const LIVE_INTELLIGENCE_ROW_LIMIT = 64;

let liveIntelligenceCache: LiveIntelligenceCacheEntry | null = null;
let liveIntelligenceInflight: Promise<LiveIntelligenceSystem> | null = null;

export async function loadLiveIntelligenceSystem(options: LiveIntelligenceLoadOptions = {}): Promise<LiveIntelligenceSystem> {
  return (await loadLiveIntelligenceSystemWithMeta(options)).system;
}

export async function loadLiveIntelligenceSystemWithMeta(options: LiveIntelligenceLoadOptions = {}): Promise<LiveIntelligenceLoadResult> {
  const startedAt = Date.now();
  const now = Date.now();
  const cached = liveIntelligenceCache;
  if (cached && cached.expiresAt > now) {
    const system = packetForOptions(cached.resolved, options);
    return {
      cacheStatus: "fresh-hit",
      durationMs: Date.now() - startedAt,
      serializedSystem: serializedLiveIntelligenceSnapshot(cached, system, options),
      system,
    };
  }
  if (cached && cached.staleUntil > now) {
    refreshLiveIntelligenceCache();
    const system = packetForOptions(cached.resolved, options);
    return {
      cacheStatus: "stale-hit",
      durationMs: Date.now() - startedAt,
      serializedSystem: serializedLiveIntelligenceSnapshot(cached, system, options),
      system,
    };
  }

  const build = getOrStartLiveIntelligenceBuild();
  build.then((system) => setLiveIntelligenceCache(system)).catch((error: unknown) => {
    console.warn("[live-intelligence] background cache warm failed", error instanceof Error ? error.message : error);
  });

  const warmed = await settleWithTimeout(build.catch(() => null), LIVE_INTELLIGENCE_BUILD_TIMEOUT_MS);
  if (warmed) {
    const system = packetForOptions(warmed, options);
    return {
      cacheStatus: "warm-miss",
      durationMs: Date.now() - startedAt,
      serializedSystem: serializeLiveIntelligenceSystem(system),
      system,
    };
  }

  const system = degradedLiveIntelligencePacket(options);
  return {
    cacheStatus: "degraded-fallback",
    durationMs: Date.now() - startedAt,
    serializedSystem: serializeLiveIntelligenceSystem(system),
    system,
  };
}

async function buildLiveIntelligencePacket(): Promise<LiveIntelligenceSystem> {
  const adapter = new ScannerDataAdapter();
  const [rows, driftRows] = await Promise.all([
    adapter.getOverviewSignals().catch(() => []),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 24, minRuns: 2 }).catch(() => []),
  ]);
  const model = buildOpportunitiesPageModel(rows.slice(0, LIVE_INTELLIGENCE_ROW_LIMIT), null);
  return buildLiveIntelligenceSystem({
    driftRows,
    refreshIntervalMs: 30_000,
    rows: model.rows,
    sequence: 0,
    streamMode: "snapshot",
  });
}

function refreshLiveIntelligenceCache(): void {
  if (liveIntelligenceCache?.refreshing) return;
  const refresh = getOrStartLiveIntelligenceBuild();
  if (liveIntelligenceCache) liveIntelligenceCache.refreshing = refresh;
  refresh.then((system) => setLiveIntelligenceCache(system)).catch((error: unknown) => {
    if (liveIntelligenceCache) liveIntelligenceCache.refreshing = undefined;
    console.warn("[live-intelligence] stale refresh failed", error instanceof Error ? error.message : error);
  });
}

function getOrStartLiveIntelligenceBuild(): Promise<LiveIntelligenceSystem> {
  if (liveIntelligenceInflight) return liveIntelligenceInflight;

  liveIntelligenceInflight = buildLiveIntelligencePacket()
    .finally(() => {
      liveIntelligenceInflight = null;
    });
  return liveIntelligenceInflight;
}

function setLiveIntelligenceCache(system: LiveIntelligenceSystem): void {
  const now = Date.now();
  liveIntelligenceCache = {
    expiresAt: now + LIVE_INTELLIGENCE_CACHE_TTL_MS,
    resolved: system,
    serializedSnapshots: new Map(),
    staleUntil: now + LIVE_INTELLIGENCE_STALE_TTL_MS,
  };
}

async function settleWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function packetForOptions(system: LiveIntelligenceSystem, options: LiveIntelligenceLoadOptions): LiveIntelligenceSystem {
  const refreshIntervalMs = boundedRefreshInterval(options.refreshIntervalMs);
  const streamMode = options.streamMode ?? "snapshot";
  return {
    ...system,
    generatedAt: streamMode === "sse" ? new Date().toISOString() : system.generatedAt,
    latencyLabel: latencyLabel(refreshIntervalMs, system.status),
    refreshIntervalMs,
    sequence: Math.max(0, Math.trunc(options.sequence ?? system.sequence)),
    streamMode,
  };
}

function degradedLiveIntelligencePacket(options: LiveIntelligenceLoadOptions): LiveIntelligenceSystem {
  const refreshIntervalMs = boundedRefreshInterval(options.refreshIntervalMs);
  const system = buildLiveIntelligenceSystem({
    driftRows: [],
    generatedAt: new Date().toISOString(),
    refreshIntervalMs,
    rows: [],
    sequence: options.sequence,
    streamMode: options.streamMode ?? "snapshot",
  });
  return {
    ...system,
    latencyLabel: "Degraded warmup fallback",
    limitations: [
      "Live Intelligence returned a bounded degraded packet because the scanner-derived market packet did not warm inside the latency budget.",
      ...system.limitations,
    ],
  };
}

function boundedRefreshInterval(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 30_000;
  return Math.max(10_000, Math.min(120_000, Math.trunc(parsed)));
}

function latencyLabel(refreshIntervalMs: number, status: LiveIntelligenceSystem["status"]): string {
  if (status === "paused") return "Waiting for scanner rows";
  if (status === "degraded") return `Live-ish, observation-limited (${Math.round(refreshIntervalMs / 1000)}s refresh)`;
  return `Streaming every ${Math.round(refreshIntervalMs / 1000)}s`;
}

function serializeLiveIntelligenceSystem(system: LiveIntelligenceSystem): string {
  return JSON.stringify(system);
}

function serializedLiveIntelligenceSnapshot(cacheEntry: LiveIntelligenceCacheEntry, system: LiveIntelligenceSystem, options: LiveIntelligenceLoadOptions): string {
  const streamMode = options.streamMode ?? "snapshot";
  if (streamMode === "sse") return serializeLiveIntelligenceSystem(system);
  const key = `${boundedRefreshInterval(options.refreshIntervalMs)}:${system.sequence}:${system.status}`;
  const cached = cacheEntry.serializedSnapshots.get(key);
  if (cached) return cached;
  const serialized = serializeLiveIntelligenceSystem(system);
  cacheEntry.serializedSnapshots.set(key, serialized);
  while (cacheEntry.serializedSnapshots.size > 12) {
    const oldest = cacheEntry.serializedSnapshots.keys().next().value;
    if (!oldest) break;
    cacheEntry.serializedSnapshots.delete(oldest);
  }
  return serialized;
}
