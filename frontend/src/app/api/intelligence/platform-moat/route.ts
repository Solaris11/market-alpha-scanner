import { NextResponse } from "next/server";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { requirePremium } from "@/lib/server/access-control";
import { getMarketMemoryForSignal } from "@/lib/server/market-memory";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { rateLimitRequest } from "@/lib/server/request-security";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import { buildLiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { buildPlatformMoatSystem } from "@/lib/trading/platform-moat";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import { buildPredictiveIntelligenceSystem } from "@/lib/trading/predictive-intelligence";
import { buildRegimeShiftSystem } from "@/lib/trading/regime-shift-intelligence";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/intelligence/platform-moat", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    const limited = await rateLimitRequest(request, "platform-moat", { limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    try {
      const adapter = new ScannerDataAdapter();
      const [snapshot, performance, scanSafety, watchlistSymbols, personalizationProfile, paperData, intradayDriftRows] = await Promise.all([
        adapter.getTerminalSnapshot(),
        getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
        getCurrentScanSafety(),
        readUserWatchlist(access.user.id).catch(() => []),
        getPersonalizationProfileForUser(access.user.id).catch(() => null),
        getPaperData({ userId: access.user.id }).catch(() => null),
        getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 18, minRuns: 2 }).catch(() => []),
      ]);
      const symbols = snapshot.signals.map((row) => row.symbol);
      const [shockPatterns, narratives, workflowEvolution] = await Promise.all([
        getShockMovePatternMap(symbols).catch(() => new Map()),
        getNarrativeMap(symbols).catch(() => new Map()),
        getWorkflowEvolutionForUser(access.user.id, snapshot.signals, { surface: "terminal", watchlistSymbols }).catch(() => null),
      ]);
      const opportunities = buildOpportunitiesPageModel(snapshot.signals, performance, shockPatterns, narratives);
      const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities.rows });
      const regimeSystem = buildRegimeShiftSystem({ rows: opportunities.rows, workflowEvolution });
      const liveSystem = buildLiveIntelligenceSystem({
        driftRows: intradayDriftRows,
        generatedAt: scanSafety.lastUpdated ?? undefined,
        rows: opportunities.rows,
        streamMode: "snapshot",
      });
      const portfolioSystem = buildPortfolioIntelligenceSystem({
        accountValue: paperData?.account?.total_account_value ?? null,
        opportunities: opportunities.rows,
        positions: paperData?.positions ?? [],
        scenarioSystem,
      });
      const predictiveSystem = buildPredictiveIntelligenceSystem({
        generatedAt: scanSafety.lastUpdated ?? undefined,
        liveSystem,
        portfolioSystem,
        regimeSystem,
        rows: opportunities.rows,
        watchlistSymbols,
      });
      const marketMemoryBySymbol = await buildMarketMemoryMap(opportunities.rows);
      const moat = buildPlatformMoatSystem({
        generatedAt: scanSafety.lastUpdated ?? undefined,
        marketMemoryBySymbol,
        personalizationProfile,
        predictiveSystem,
        rows: opportunities.rows,
        watchlistSymbols,
        workflowEvolution,
      });

      return NextResponse.json({
        moat,
        ok: true,
        scanUpdatedAt: scanSafety.lastUpdated,
      });
    } catch (error) {
      console.warn("[platform-moat] load failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ ok: false, message: "Platform moat certification is temporarily unavailable." }, { status: 503 });
    }
  });
}

async function buildMarketMemoryMap(rows: OpportunityViewModel[]): Promise<Map<string, MarketMemorySummary>> {
  const selected = rows
    .slice(0, 16)
    .filter((row) => row.symbol)
    .map(async (row) => {
      const memory = await getMarketMemoryForSignal(row.raw).catch(() => null);
      return memory ? ([row.symbol.toUpperCase(), memory] as const) : null;
    });
  const entries = await Promise.all(selected);
  return new Map(entries.filter((entry): entry is readonly [string, MarketMemorySummary] => entry !== null));
}
