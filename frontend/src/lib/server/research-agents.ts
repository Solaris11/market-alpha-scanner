import "server-only";

import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { buildLiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import { buildAutomatedResearchAgentsSystem, type AutomatedResearchAgentsSystem } from "@/lib/trading/research-agents";
import { buildRegimeShiftSystem } from "@/lib/trading/regime-shift-intelligence";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { getNarrativeMap } from "./narrative-intelligence";
import { getShockMovePatternMap } from "./shock-move-patterns";
import { readUserWatchlist } from "./user-watchlist";
import { getWorkflowEvolutionForUser } from "./workflow-evolution";

export type ResearchAgentsLoadOptions = {
  userId?: string | null;
};

export async function loadAutomatedResearchAgentsSystem(options: ResearchAgentsLoadOptions = {}): Promise<AutomatedResearchAgentsSystem> {
  const adapter = new ScannerDataAdapter();
  const [signals, performance, watchlistSymbols, intradayDriftRows, paperData] = await Promise.all([
    adapter.getOverviewSignals().catch(() => []),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    options.userId ? readUserWatchlist(options.userId).catch(() => []) : Promise.resolve([]),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 18, minRuns: 2 }).catch(() => []),
    getPaperData({ userId: options.userId ?? null }).catch(() => ({ account: null, configured: false, events: [], positions: [] })),
  ]);
  const symbols = signals.map((row) => row.symbol);
  const [shockPatterns, narratives, workflowEvolution] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
    getWorkflowEvolutionForUser(options.userId ?? null, signals, { surface: "terminal", watchlistSymbols }).catch(() => null),
  ]);
  const opportunityModel = buildOpportunitiesPageModel(signals, performance, shockPatterns, narratives);
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunityModel.rows });
  const regimeSystem = buildRegimeShiftSystem({ rows: opportunityModel.rows, workflowEvolution });
  const liveSystem = buildLiveIntelligenceSystem({
    driftRows: intradayDriftRows,
    refreshIntervalMs: 30_000,
    rows: opportunityModel.rows,
    streamMode: "snapshot",
  });
  const portfolioSystem = buildPortfolioIntelligenceSystem({
    accountValue: paperData.account?.total_account_value ?? null,
    opportunities: opportunityModel.rows,
    positions: paperData.positions,
    scenarioSystem,
  });
  return buildAutomatedResearchAgentsSystem({
    liveSystem,
    portfolioSystem,
    regimeSystem,
    rows: opportunityModel.rows,
    scenarioSystem,
    watchlistSymbols,
    workflowEvolution,
  });
}
