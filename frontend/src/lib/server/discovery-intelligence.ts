import "server-only";

import { getFullRanking, getPerformanceData } from "@/lib/scanner-data";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserSavedScans } from "@/lib/server/user-saved-scans";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import { buildIntelligenceDiscoverySystem, compactIntelligenceDiscoverySystem, type IntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
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
  serialized?: string;
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
  serializedSystem: string;
  system: IntelligenceDiscoverySystem;
};

export type DiscoveryPacketMode = "full" | "initial";

type DiscoverySystemCache = {
  expiresAt: number;
  refreshedAt: number;
  refreshing?: Promise<IntelligenceDiscoverySystem>;
  serializedFull?: string;
  serializedInitial?: string;
  staleUntil: number;
  value: Promise<IntelligenceDiscoverySystem>;
  resolved?: IntelligenceDiscoverySystem;
};

const DISCOVERY_INITIAL_PACKET_ROW_LIMIT = 40;
const DISCOVERY_BASE_CACHE_TTL_MS = 10 * 60_000;
const DISCOVERY_BASE_STALE_TTL_MS = 30 * 60_000;
const DISCOVERY_SYSTEM_CACHE_TTL_MS = 10 * 60_000;
const DISCOVERY_SYSTEM_STALE_TTL_MS = 30 * 60_000;

let discoveryBaseCache: DiscoveryBaseCache | null = null;
const discoverySystemCache = new Map<string, DiscoverySystemCache>();

export async function loadIntelligenceDiscoverySystem(userId: string | null): Promise<IntelligenceDiscoverySystem> {
  return (await loadIntelligenceDiscoverySystemWithMeta(userId)).system;
}

export async function loadIntelligenceDiscoverySystemWithMeta(userId: string | null, options: { packetMode?: DiscoveryPacketMode } = {}): Promise<DiscoveryLoadResult> {
  const startedAt = Date.now();
  const packetMode = options.packetMode ?? "full";
  const cacheKey = userId ? `user:${userId}:${packetMode}` : `anonymous:${packetMode}`;
  const now = Date.now();
  const cachedSystem = discoverySystemCache.get(cacheKey);
  if (cachedSystem && cachedSystem.expiresAt > now) {
    const system = await cachedSystem.value;
    const serializedSystem = serializedDiscoverySystem(cachedSystem, system, packetMode);
    return {
      meta: {
        baseCacheStatus: "skipped",
        cacheStatus: "system-hit",
        durationMs: Date.now() - startedAt,
        systemCacheStatus: "system-hit",
      },
      serializedSystem,
      system: systemForPacketMode(system, packetMode),
    };
  }
  if (cachedSystem?.resolved && cachedSystem.staleUntil > now) {
    refreshDiscoverySystemCache(cacheKey, userId);
    const serializedSystem = serializedDiscoverySystem(cachedSystem, cachedSystem.resolved, packetMode);
    return {
      meta: {
        baseCacheStatus: "skipped",
        cacheStatus: "stale-hit",
        durationMs: Date.now() - startedAt,
        systemCacheStatus: "system-hit",
      },
      serializedSystem,
      system: systemForPacketMode(cachedSystem.resolved, packetMode),
    };
  }

  const baseStatus: { value: "base-hit" | "base-miss" } = { value: discoveryBaseCache && discoveryBaseCache.expiresAt > now ? "base-hit" : "base-miss" };
  const value = buildDiscoverySystem(userId, packetMode);
  const cacheEntry: DiscoverySystemCache = {
    expiresAt: now + DISCOVERY_SYSTEM_CACHE_TTL_MS,
    refreshedAt: now,
    staleUntil: now + DISCOVERY_SYSTEM_STALE_TTL_MS,
    value,
  };
  discoverySystemCache.set(cacheKey, cacheEntry);

  try {
    const system = await value;
    const serializedSystem = serializedDiscoverySystem(cacheEntry, system, packetMode);
    cacheEntry.resolved = system;
    return {
      meta: {
        baseCacheStatus: baseStatus.value,
        cacheStatus: baseStatus.value === "base-hit" ? "base-hit" : "system-miss",
        durationMs: Date.now() - startedAt,
        systemCacheStatus: "system-miss",
      },
      serializedSystem,
      system: systemForPacketMode(system, packetMode),
    };
  } catch (error) {
    if (discoverySystemCache.get(cacheKey)?.value === value) discoverySystemCache.delete(cacheKey);
    throw error;
  }
}

export function invalidateDiscoverySystemCache(userId: string | null): void {
  discoverySystemCache.delete(userId ? `user:${userId}` : "anonymous");
}

function refreshDiscoverySystemCache(cacheKey: string, userId: string | null): void {
  const cached = discoverySystemCache.get(cacheKey);
  if (!cached || cached.refreshing) return;

  const packetMode = cacheKey.endsWith(":initial") ? "initial" : "full";
  const refresh = buildDiscoverySystem(userId, packetMode);
  cached.refreshing = refresh;
  refresh
    .then((system) => {
      const now = Date.now();
      discoverySystemCache.set(cacheKey, {
        expiresAt: now + DISCOVERY_SYSTEM_CACHE_TTL_MS,
        refreshedAt: now,
        resolved: system,
        serializedFull: serializeDiscoverySystem(system),
        serializedInitial: serializeDiscoverySystem(systemForPacketMode(system, "initial")),
        staleUntil: now + DISCOVERY_SYSTEM_STALE_TTL_MS,
        value: Promise.resolve(system),
      });
    })
    .catch((error: unknown) => {
      cached.refreshing = undefined;
      console.warn("[discovery] background system refresh failed", error instanceof Error ? error.message : error);
    });
}

function serializeDiscoverySystem(system: IntelligenceDiscoverySystem): string {
  return JSON.stringify(system);
}

function systemForPacketMode(system: IntelligenceDiscoverySystem, packetMode: DiscoveryPacketMode): IntelligenceDiscoverySystem {
  return packetMode === "initial" ? compactIntelligenceDiscoverySystem(system) : system;
}

function serializedDiscoverySystem(cacheEntry: DiscoverySystemCache, system: IntelligenceDiscoverySystem, packetMode: DiscoveryPacketMode): string {
  if (packetMode === "initial") {
    cacheEntry.serializedInitial ??= serializeDiscoverySystem(systemForPacketMode(system, "initial"));
    return cacheEntry.serializedInitial;
  }
  cacheEntry.serializedFull ??= serializeDiscoverySystem(system);
  return cacheEntry.serializedFull;
}

async function buildDiscoverySystem(userId: string | null, packetMode: DiscoveryPacketMode): Promise<IntelligenceDiscoverySystem> {
  const [base, watchlistSymbols, savedScans] = await Promise.all([
    loadDiscoveryBaseRows(),
    userId ? readUserWatchlist(userId).catch(() => []) : Promise.resolve([]),
    userId ? readUserSavedScans(userId).catch(() => []) : Promise.resolve([]),
  ]);

  const rows = packetMode === "initial" ? base.rows.slice(0, DISCOVERY_INITIAL_PACKET_ROW_LIMIT) : base.rows;
  const system = buildIntelligenceDiscoverySystem({
    generatedAt: base.generatedAt,
    rows,
    savedScans,
    watchlistSymbols,
  });
  if (packetMode !== "initial" || base.rows.length <= rows.length || system.limited) return system;

  const baseSymbolSet = new Set(base.rows.map((row) => row.symbol.toUpperCase()));
  return {
    ...system,
    summary: `Initial discovery packet loaded ${rows.length.toLocaleString()} of ${base.rows.length.toLocaleString()} validated symbols. Full-universe rows hydrate progressively when the workspace is open.`,
    universeCount: base.rows.length,
    watchlistCount: watchlistSymbols.filter((symbol) => baseSymbolSet.has(symbol.trim().toUpperCase())).length,
  };
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
