import "server-only";

import { getFullRanking, getPerformanceData } from "@/lib/scanner-data";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import { buildIntelligenceDiscoverySystem, type IntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { DiscoveryCacheStatus } from "@/lib/discovery-performance";

type DiscoveryBaseRows = {
  generatedAt: string;
  rows: OpportunityViewModel[];
};

type DiscoveryBaseCache = {
  expiresAt: number;
  refreshedAt: number;
  refreshing?: Promise<DiscoveryBaseRows>;
  staleUntil: number;
  value: Promise<DiscoveryBaseRows>;
  resolved?: DiscoveryBaseRows;
};

export type DiscoveryLoadMeta = {
  baseCacheStatus: "base-hit" | "base-miss" | "skipped";
  cacheStatus: DiscoveryCacheStatus;
  durationMs: number;
  systemCacheStatus: "system-hit" | "system-miss";
};

export type DiscoveryLoadResult = {
  meta: DiscoveryLoadMeta;
  system: IntelligenceDiscoverySystem;
};

type DiscoverySystemCache = {
  expiresAt: number;
  refreshedAt: number;
  refreshing?: Promise<IntelligenceDiscoverySystem>;
  staleUntil: number;
  value: Promise<IntelligenceDiscoverySystem>;
  resolved?: IntelligenceDiscoverySystem;
};

const DISCOVERY_BASE_CACHE_TTL_MS = 5 * 60_000;
const DISCOVERY_BASE_STALE_TTL_MS = 20 * 60_000;
const DISCOVERY_SYSTEM_CACHE_TTL_MS = 180_000;
const DISCOVERY_SYSTEM_STALE_TTL_MS = 10 * 60_000;

let discoveryBaseCache: DiscoveryBaseCache | null = null;
const discoverySystemCache = new Map<string, DiscoverySystemCache>();

export async function loadIntelligenceDiscoverySystem(userId: string | null): Promise<IntelligenceDiscoverySystem> {
  return (await loadIntelligenceDiscoverySystemWithMeta(userId)).system;
}

export async function loadIntelligenceDiscoverySystemWithMeta(userId: string | null): Promise<DiscoveryLoadResult> {
  const startedAt = Date.now();
  const cacheKey = userId ? `user:${userId}` : "anonymous";
  const now = Date.now();
  const cachedSystem = discoverySystemCache.get(cacheKey);
  if (cachedSystem && cachedSystem.expiresAt > now) {
    const system = await cachedSystem.value;
    return {
      meta: {
        baseCacheStatus: "skipped",
        cacheStatus: "system-hit",
        durationMs: Date.now() - startedAt,
        systemCacheStatus: "system-hit",
      },
      system,
    };
  }
  if (cachedSystem?.resolved && cachedSystem.staleUntil > now) {
    refreshDiscoverySystemCache(cacheKey, userId);
    return {
      meta: {
        baseCacheStatus: "skipped",
        cacheStatus: "stale-hit",
        durationMs: Date.now() - startedAt,
        systemCacheStatus: "system-hit",
      },
      system: cachedSystem.resolved,
    };
  }

  const baseStatus: { value: "base-hit" | "base-miss" } = { value: discoveryBaseCache && discoveryBaseCache.expiresAt > now ? "base-hit" : "base-miss" };
  const value = buildDiscoverySystem(userId);
  const cacheEntry: DiscoverySystemCache = {
    expiresAt: now + DISCOVERY_SYSTEM_CACHE_TTL_MS,
    refreshedAt: now,
    staleUntil: now + DISCOVERY_SYSTEM_STALE_TTL_MS,
    value,
  };
  discoverySystemCache.set(cacheKey, cacheEntry);

  try {
    const system = await value;
    cacheEntry.resolved = system;
    return {
      meta: {
        baseCacheStatus: baseStatus.value,
        cacheStatus: baseStatus.value === "base-hit" ? "base-hit" : "system-miss",
        durationMs: Date.now() - startedAt,
        systemCacheStatus: "system-miss",
      },
      system,
    };
  } catch (error) {
    if (discoverySystemCache.get(cacheKey)?.value === value) discoverySystemCache.delete(cacheKey);
    throw error;
  }
}

function refreshDiscoverySystemCache(cacheKey: string, userId: string | null): void {
  const cached = discoverySystemCache.get(cacheKey);
  if (!cached || cached.refreshing) return;

  const refresh = buildDiscoverySystem(userId);
  cached.refreshing = refresh;
  refresh
    .then((system) => {
      const now = Date.now();
      discoverySystemCache.set(cacheKey, {
        expiresAt: now + DISCOVERY_SYSTEM_CACHE_TTL_MS,
        refreshedAt: now,
        resolved: system,
        staleUntil: now + DISCOVERY_SYSTEM_STALE_TTL_MS,
        value: Promise.resolve(system),
      });
    })
    .catch((error: unknown) => {
      cached.refreshing = undefined;
      console.warn("[discovery] background system refresh failed", error instanceof Error ? error.message : error);
    });
}

async function buildDiscoverySystem(userId: string | null): Promise<IntelligenceDiscoverySystem> {
  const [base, watchlistSymbols] = await Promise.all([
    loadDiscoveryBaseRows(),
    userId ? readUserWatchlist(userId).catch(() => []) : Promise.resolve([]),
  ]);

  return buildIntelligenceDiscoverySystem({
    generatedAt: base.generatedAt,
    rows: base.rows,
    watchlistSymbols,
  });
}

async function loadDiscoveryBaseRows(): Promise<DiscoveryBaseRows> {
  const now = Date.now();
  if (discoveryBaseCache && discoveryBaseCache.expiresAt > now) {
    return discoveryBaseCache.value;
  }
  if (discoveryBaseCache?.resolved && discoveryBaseCache.staleUntil > now) {
    refreshDiscoveryBaseCache();
    return discoveryBaseCache.resolved;
  }

  const value = buildDiscoveryBaseRows();
  const cacheEntry: DiscoveryBaseCache = {
    expiresAt: now + DISCOVERY_BASE_CACHE_TTL_MS,
    refreshedAt: now,
    staleUntil: now + DISCOVERY_BASE_STALE_TTL_MS,
    value,
  };
  discoveryBaseCache = cacheEntry;

  try {
    const base = await value;
    cacheEntry.resolved = base;
    return base;
  } catch (error) {
    if (discoveryBaseCache?.value === value) discoveryBaseCache = null;
    throw error;
  }
}

function refreshDiscoveryBaseCache(): void {
  if (!discoveryBaseCache || discoveryBaseCache.refreshing) return;

  const cacheEntry = discoveryBaseCache;
  const refresh = buildDiscoveryBaseRows();
  cacheEntry.refreshing = refresh;
  refresh
    .then((base) => {
      const now = Date.now();
      discoveryBaseCache = {
        expiresAt: now + DISCOVERY_BASE_CACHE_TTL_MS,
        refreshedAt: now,
        resolved: base,
        staleUntil: now + DISCOVERY_BASE_STALE_TTL_MS,
        value: Promise.resolve(base),
      };
    })
    .catch((error: unknown) => {
      cacheEntry.refreshing = undefined;
      console.warn("[discovery] background base refresh failed", error instanceof Error ? error.message : error);
    });
}

async function buildDiscoveryBaseRows(): Promise<DiscoveryBaseRows> {
  const [rawRows, performance, scanSafety] = await Promise.all([
    getFullRanking(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getCurrentScanSafety(),
  ]);
  const rows = applyStaleDataSafetyToRows(rawRows, scanSafety);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  const opportunities = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  return {
    generatedAt: new Date().toISOString(),
    rows: opportunities.rows,
  };
}
