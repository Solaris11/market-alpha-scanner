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
  value: Promise<DiscoveryBaseRows>;
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
  value: Promise<IntelligenceDiscoverySystem>;
};

const DISCOVERY_BASE_CACHE_TTL_MS = 90_000;
const DISCOVERY_SYSTEM_CACHE_TTL_MS = 20_000;

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

  const baseStatus: { value: "base-hit" | "base-miss" } = { value: discoveryBaseCache && discoveryBaseCache.expiresAt > now ? "base-hit" : "base-miss" };
  const value = buildDiscoverySystem(userId);
  discoverySystemCache.set(cacheKey, {
    expiresAt: now + DISCOVERY_SYSTEM_CACHE_TTL_MS,
    value,
  });

  try {
    const system = await value;
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

  const value = buildDiscoveryBaseRows();
  discoveryBaseCache = {
    expiresAt: now + DISCOVERY_BASE_CACHE_TTL_MS,
    value,
  };

  try {
    return await value;
  } catch (error) {
    if (discoveryBaseCache?.value === value) discoveryBaseCache = null;
    throw error;
  }
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
