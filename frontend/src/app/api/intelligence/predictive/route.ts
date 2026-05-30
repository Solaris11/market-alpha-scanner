import { NextResponse } from "next/server";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { rateLimitRequest } from "@/lib/server/request-security";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { buildLiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import { buildPredictiveIntelligenceSystem } from "@/lib/trading/predictive-intelligence";
import { buildRegimeShiftSystem } from "@/lib/trading/regime-shift-intelligence";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/intelligence/predictive", async () => {
    const access = await requirePremium();
    if (!access.ok) return access.response;

    const limited = await rateLimitRequest(request, "predictive-intelligence", { limit: 45, windowMs: 60_000 });
    if (limited) return limited;

    try {
      const adapter = new ScannerDataAdapter();
      const [snapshot, performance, scanSafety, watchlistSymbols, paperData, intradayDriftRows] = await Promise.all([
        adapter.getTerminalSnapshot(),
        getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
        getCurrentScanSafety(),
        readUserWatchlist(access.user.id).catch(() => []),
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
        refreshIntervalMs: 30_000,
        rows: opportunities.rows,
        streamMode: "snapshot",
      });
      const portfolioSystem = buildPortfolioIntelligenceSystem({
        accountValue: paperData?.account?.total_account_value ?? null,
        opportunities: opportunities.rows,
        positions: paperData?.positions ?? [],
        scenarioSystem,
      });
      const predictive = buildPredictiveIntelligenceSystem({
        generatedAt: scanSafety.lastUpdated ?? undefined,
        liveSystem,
        portfolioSystem,
        regimeSystem,
        rows: opportunities.rows,
        watchlistSymbols,
      });

      return NextResponse.json({
        ok: true,
        predictive,
        scanUpdatedAt: scanSafety.lastUpdated,
      });
    } catch (error) {
      console.warn("[predictive-intelligence] load failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ ok: false, message: "Predictive intelligence is temporarily unavailable." }, { status: 503 });
    }
  });
}
