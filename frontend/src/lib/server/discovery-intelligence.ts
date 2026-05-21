import "server-only";

import { getFullRanking, getPerformanceData } from "@/lib/scanner-data";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import { buildIntelligenceDiscoverySystem, type IntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "@/lib/trading/opportunity-view-model";

type DiscoveryBaseRows = {
  generatedAt: string;
  rows: OpportunityViewModel[];
};

type DiscoveryBaseCache = {
  expiresAt: number;
  value: Promise<DiscoveryBaseRows>;
};

const DISCOVERY_BASE_CACHE_TTL_MS = 30_000;

let discoveryBaseCache: DiscoveryBaseCache | null = null;

export async function loadIntelligenceDiscoverySystem(userId: string | null): Promise<IntelligenceDiscoverySystem> {
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
