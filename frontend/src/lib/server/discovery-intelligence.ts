import "server-only";

import { getFullRanking, getPerformanceData } from "@/lib/scanner-data";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import { buildIntelligenceDiscoverySystem, type IntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export async function loadIntelligenceDiscoverySystem(userId: string | null): Promise<IntelligenceDiscoverySystem> {
  const [rawRows, performance, scanSafety, watchlistSymbols] = await Promise.all([
    getFullRanking(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getCurrentScanSafety(),
    userId ? readUserWatchlist(userId).catch(() => []) : Promise.resolve([]),
  ]);
  const rows = applyStaleDataSafetyToRows(rawRows, scanSafety);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  const opportunities = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  return buildIntelligenceDiscoverySystem({
    generatedAt: new Date().toISOString(),
    rows: opportunities.rows,
    watchlistSymbols,
  });
}
