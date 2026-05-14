import { NextResponse } from "next/server";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getCurrentUser } from "@/lib/server/auth";
import { loadIntelligenceFeedForUser } from "@/lib/server/intelligence-feed";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to view intelligence feed." }, { status: 401 });
  }

  try {
    const adapter = new ScannerDataAdapter();
    const [snapshot, performance, scanSafety, watchlistSymbols, activeAlertMatches] = await Promise.all([
      adapter.getTerminalSnapshot(),
      getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
      getCurrentScanSafety(),
      readUserWatchlist(user.id).catch(() => []),
      getActiveAlertMatches(user.id).then((result) => result.matches).catch(() => []),
    ]);
    const symbols = snapshot.signals.map((row) => row.symbol);
    const [shockPatterns, narratives, workflowEvolution] = await Promise.all([
      getShockMovePatternMap(symbols).catch(() => new Map()),
      getNarrativeMap(symbols).catch(() => new Map()),
      getWorkflowEvolutionForUser(user.id, snapshot.signals, { surface: "terminal", watchlistSymbols }).catch(() => null),
    ]);
    const opportunityModel = buildOpportunitiesPageModel(snapshot.signals, performance, shockPatterns, narratives);
    const feed = await loadIntelligenceFeedForUser(user.id, {
      activeAlertMatches,
      marketCondition: snapshot.marketRegime.label,
      rows: opportunityModel.rows,
      scanUpdatedAt: scanSafety.lastUpdated,
      watchlistSymbols,
      workflowEvolution,
    });
    return NextResponse.json({ ok: true, ...feed });
  } catch (error) {
    console.warn("[intelligence-feed] load failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Intelligence feed is unavailable." }, { status: 503 });
  }
}
