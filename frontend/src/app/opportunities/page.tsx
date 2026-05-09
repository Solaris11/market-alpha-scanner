import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { OpportunitiesWorkspace } from "@/components/opportunities/OpportunitiesWorkspace";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildAdaptiveLearningSystem } from "@/lib/trading/adaptive-learning";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    return (
      <TerminalShell>
        <PublicSignalPreviewList accessState={premiumAccessState(entitlement)} authenticated={entitlement.authenticated} refreshOnPremium summary={publicPreview.summary} title="Research Preview" />
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const [rows, regime, performance, personalizationProfile, watchlistSymbols] = await Promise.all([
    adapter.getOverviewSignals(),
    adapter.getMarketRegime(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getPersonalizationProfileForUser(entitlement.user?.id ?? null).catch(() => null),
    entitlement.user?.id ? readUserWatchlist(entitlement.user.id).catch(() => []) : Promise.resolve([]),
  ]);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives, intradayDriftRows] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 18, minRuns: 2 }).catch(() => []),
  ]);
  const model = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  const adaptiveLearning = buildAdaptiveLearningSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    observationCount: performance?.forwardReturns.rows.length ?? 0,
  });
  const strategyIntelligence = buildStrategyIntelligenceSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: model.rows,
    personalizationProfile,
  });
  const scenarioIntelligence = buildScenarioIntelligenceSystem({
    rows: model.rows,
  });
  const workflowEvolution = await getWorkflowEvolutionForUser(entitlement.user?.id ?? null, rows, { surface: "opportunities", watchlistSymbols }).catch(() => null);
  const bestDetail = model.best ? await adapter.getSymbolDetail(model.best.symbol).catch(() => null) : null;

  return (
    <TerminalShell>
      <OpportunitiesWorkspace adaptiveLearning={adaptiveLearning} best={model.best} bestPriceSeries={bestDetail?.history ?? []} initialProfile={personalizationProfile ?? undefined} intradayDriftRows={intradayDriftRows} marketCondition={regime.label} rows={model.rows} scenarioIntelligence={scenarioIntelligence} strategyIntelligence={strategyIntelligence} workflowEvolution={workflowEvolution ?? undefined} />
    </TerminalShell>
  );
}
