import Link from "next/link";
import { AICopilotPanel } from "@/components/terminal/AICopilotPanel";
import { AICognitionLayerPanel } from "@/components/terminal/AICognitionLayerPanel";
import { AutomatedResearchAgentsPanel } from "@/components/terminal/AutomatedResearchAgentsPanel";
import { BestTradeNowCard } from "@/components/terminal/BestTradeNowCard";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { MarketOnboarding } from "@/components/onboarding/MarketOnboarding";
import { RiskTolerantOpportunityRadar } from "@/components/opportunities/RiskTolerantOpportunityRadar";
import { ShockMoveRadar } from "@/components/opportunities/ShockMoveRadar";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { PremiumAccessCta } from "@/components/premium/PremiumAccessCta";
import { DailyActionCard } from "@/components/terminal/DailyActionCard";
import { AdaptiveLearningInsightPanel } from "@/components/terminal/AdaptiveLearningInsightPanel";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { ExecutionIntelligencePanel } from "@/components/terminal/ExecutionIntelligencePanel";
import { InstitutionalIntelligencePanel } from "@/components/terminal/InstitutionalIntelligencePanel";
import { IntradayRegimeDriftPanel } from "@/components/terminal/IntradayRegimeDriftPanel";
import { IntelligenceFeedNotificationPanel } from "@/components/terminal/IntelligenceFeedNotificationPanel";
import { LiveIntelligencePanel } from "@/components/terminal/LiveIntelligencePanel";
import { MarketRegimeRadar } from "@/components/terminal/MarketRegimeRadar";
import { MarketChartHub } from "@/components/terminal/MarketChartHub";
import { MetricCard } from "@/components/terminal/MetricCard";
import { MyWatchlistWidget } from "@/components/terminal/MyWatchlistWidget";
import { RegimeShiftIntelligencePanel } from "@/components/terminal/RegimeShiftIntelligencePanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { ScenarioIntelligencePanel } from "@/components/terminal/ScenarioIntelligencePanel";
import { SignalCard } from "@/components/terminal/SignalCard";
import { SignalHeatmap } from "@/components/terminal/SignalHeatmap";
import { StrategyIntelligencePanel } from "@/components/terminal/StrategyIntelligencePanel";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { TerminalRightRail } from "@/components/terminal/TerminalRightRail";
import { UnifiedIntelligenceConsole } from "@/components/terminal/UnifiedIntelligenceConsole";
import { WorkspacePersonalizationPanel } from "@/components/terminal/WorkspacePersonalizationPanel";
import { WorkflowEvolutionPanel } from "@/components/terminal/WorkflowEvolutionPanel";
import { IntelligenceEcosystemPanel } from "@/components/visual/IntelligenceEcosystemPanel";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { getMarketChartHubData } from "@/lib/server/validated-price-history";
import { loadIntelligenceFeedForUser } from "@/lib/server/intelligence-feed";
import { readUserWorkspacePreferences } from "@/lib/server/user-workspace-preferences";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildAdaptiveLearningSystem } from "@/lib/trading/adaptive-learning";
import { buildAICognitionLayer } from "@/lib/trading/ai-cognition-layer";
import { buildEdgeLookup, selectBestTradeNow } from "@/lib/trading/conviction";
import { dailyActionBlocksTradeUi, getDailyAction, noTradeActionCopy } from "@/lib/trading/daily-action";
import { buildLiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import { buildIntelligenceEcosystemSystem } from "@/lib/trading/intelligence-ecosystem";
import { buildAutomatedResearchAgentsSystem } from "@/lib/trading/research-agents";
import { buildRegimeShiftSystem } from "@/lib/trading/regime-shift-intelligence";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";
import { formatMoney, formatPercent } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
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
    const accessState = premiumAccessState(entitlement);
    const publicAction = {
      action: "WAIT" as const,
      label: "WAIT",
      reason: publicPreview.scanSafety.active ? publicPreview.scanSafety.reason : entitlement.authenticated ? "Upgrade to Premium to unlock today's trade plan." : "Sign in with Premium to unlock today's trade plan.",
      symbol: null,
      tone: "wait" as const,
    };
    assertNoPremiumFields({ publicAction, summary: publicPreview.summary });

    return (
      <TerminalShell>
        <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <DailyActionCard
              action={publicAction}
              dataStatus={publicPreview.summary.scannerStatus}
              decisionDistribution={[
                { label: "WATCH", value: 0 },
                { label: "WAIT", value: 0 },
                { label: "AVOID", value: 0 },
              ]}
              whyReasons={["Premium rows are hidden in public preview.", "Decision details unlock after entitlement checks.", "Research only. Not financial advice."]}
            />
            <PublicSignalPreviewList accessState={accessState} authenticated={entitlement.authenticated} refreshOnPremium summary={publicPreview.summary} title="Market Preview" />
          </div>
          <GlassPanel className="p-5 xl:sticky xl:top-4 xl:self-start">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Premium</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Trade plans are locked</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Account access determines whether this preview unlocks checkout or the full Premium terminal. Trade plans stay hidden until entitlement is confirmed.
            </p>
            <div className="mt-4">
              <PremiumAccessCta initialState={accessState} refreshOnPremium />
            </div>
          </GlassPanel>
        </div>
        <MarketOnboarding tradePlanHref="/opportunities" />
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const [snapshot, performance, scanSafety, watchlistSymbols, activeAlertMatches, personalizationProfile, workspacePreferences, paperData, marketChartHubData] = await Promise.all([
    adapter.getTerminalSnapshot(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getCurrentScanSafety(),
    entitlement.user?.id ? readUserWatchlist(entitlement.user.id).catch(() => []) : Promise.resolve([]),
    getActiveAlertMatches(entitlement.user?.id ?? null).then((result) => result.matches).catch(() => []),
    getPersonalizationProfileForUser(entitlement.user?.id ?? null).catch(() => null),
    entitlement.user?.id ? readUserWorkspacePreferences(entitlement.user.id).catch(() => null) : Promise.resolve(null),
    getPaperData({ userId: entitlement.user?.id ?? null }).catch(() => ({ account: null, configured: false, events: [], positions: [] })),
    getMarketChartHubData().catch(() => []),
  ]);
  const edges = buildEdgeLookup(snapshot.signals, performance);
  const symbols = snapshot.signals.map((row) => row.symbol);
  const [shockPatterns, narratives, workflowEvolution, intradayDriftRows] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
    getWorkflowEvolutionForUser(entitlement.user?.id ?? null, snapshot.signals, { surface: "terminal", watchlistSymbols }).catch(() => null),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 18, minRuns: 2 }).catch(() => []),
  ]);
  const opportunityModel = buildOpportunitiesPageModel(snapshot.signals, performance, shockPatterns, narratives);
  const intelligenceFeed = await loadIntelligenceFeedForUser(entitlement.user?.id ?? null, {
    activeAlertMatches,
    marketCondition: snapshot.marketRegime.label,
    rows: opportunityModel.rows,
    scanUpdatedAt: scanSafety.lastUpdated,
    watchlistSymbols,
    workflowEvolution,
  });
  const cognitionLayer = buildAICognitionLayer({
    marketCondition: snapshot.marketRegime.label,
    rows: opportunityModel.rows,
    scanUpdatedAt: scanSafety.lastUpdated,
    workflowEvolution,
  });
  const adaptiveLearning = buildAdaptiveLearningSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    observationCount: performance?.forwardReturns.rows.length ?? 0,
  });
  const strategyIntelligence = buildStrategyIntelligenceSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: opportunityModel.rows,
    personalizationProfile,
  });
  const scenarioIntelligence = buildScenarioIntelligenceSystem({
    rows: opportunityModel.rows,
  });
  const regimeShiftSystem = buildRegimeShiftSystem({ rows: opportunityModel.rows, workflowEvolution });
  const liveIntelligence = buildLiveIntelligenceSystem({
    driftRows: intradayDriftRows,
    refreshIntervalMs: 30_000,
    rows: opportunityModel.rows,
    streamMode: "snapshot",
  });
  const portfolioIntelligence = buildPortfolioIntelligenceSystem({
    accountValue: paperData.account?.total_account_value ?? null,
    opportunities: opportunityModel.rows,
    positions: paperData.positions,
    scenarioSystem: scenarioIntelligence,
  });
  const intelligenceEcosystem = buildIntelligenceEcosystemSystem({
    feedItems: intelligenceFeed.items,
    generatedAt: scanSafety.lastUpdated,
    marketCondition: snapshot.marketRegime.label,
    personalizationProfile,
    portfolioSystem: portfolioIntelligence,
    rows: opportunityModel.rows,
    scanUpdatedAt: scanSafety.lastUpdated,
    watchlistSymbols,
    workflowEvolution,
  });
  const automatedResearchAgents = buildAutomatedResearchAgentsSystem({
    liveSystem: liveIntelligence,
    portfolioSystem: portfolioIntelligence,
    regimeSystem: regimeShiftSystem,
    rows: opportunityModel.rows,
    scenarioSystem: scenarioIntelligence,
    watchlistSymbols,
    workflowEvolution,
  });
  const best = selectBestTradeNow(snapshot.signals, edges);
  const leader = best?.row ?? snapshot.topSignals[0] ?? snapshot.signals[0];
  const dailyAction = getDailyAction({ best, fallbackRow: leader, marketRegime: snapshot.marketRegime, scanSafety });
  const tradePlanHref = leader?.symbol ? `/symbol/${leader.symbol}` : "/opportunities";
  const enterCount = snapshot.signals.filter((row) => String(row.final_decision ?? "").toUpperCase() === "ENTER").length;
  const avoidCount = snapshot.signals.filter((row) => String(row.final_decision ?? "").toUpperCase() === "AVOID").length;
  const actionBlocksTradeUi = dailyActionBlocksTradeUi(dailyAction);
  const noTradeCopy = noTradeActionCopy(dailyAction);
  const decisionDistribution = buildDecisionDistribution(snapshot.signals);
  const contextReasons = buildTodayActionReasons({ actionBlocksTradeUi, marketState: snapshot.marketRegime.label, scanSafetyStatus: scanSafety.status });

  return (
    <TerminalShell>
      <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div className="space-y-4">
          <DailyActionCard action={dailyAction} dataStatus={humanizeLabel(scanSafety.status)} decisionDistribution={decisionDistribution} marketState={snapshot.marketRegime.label} whyReasons={contextReasons} />
          <IntelligenceEcosystemPanel system={intelligenceEcosystem} />
          <WorkspacePersonalizationPanel
            initialPreferences={workspacePreferences}
            recentSymbols={uniqueTerminalSymbols([leader?.symbol, ...opportunityModel.rows.slice(0, 8).map((row) => row.symbol)])}
            watchlistSymbols={watchlistSymbols}
          />
          <UnifiedIntelligenceConsole
            marketCondition={snapshot.marketRegime.label}
            personalizationProfile={personalizationProfile}
            rows={opportunityModel.rows}
            workspacePreferences={workspacePreferences}
            workflowEvolution={workflowEvolution}
          />
          <AICognitionLayerPanel model={cognitionLayer} />
          <IntelligenceFeedNotificationPanel
            brief={intelligenceFeed.brief}
            initialPreferences={intelligenceFeed.preferences}
            items={intelligenceFeed.items}
            watchlistSymbols={watchlistSymbols}
          />
          <MarketChartHub charts={marketChartHubData} marketCondition={snapshot.marketRegime.label} updatedAt={scanSafety.lastUpdated} />
          <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
              <span>Advanced intelligence layers</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">expand</span>
            </summary>
            <div className="mt-4 space-y-4">
              <LiveIntelligencePanel compact initialSystem={liveIntelligence} />
              <AutomatedResearchAgentsPanel compact system={automatedResearchAgents} />
              <MarketTapeStrip rows={snapshot.signals} />
              <TerminalMonitoringBrief
                rows={snapshot.signals}
                scanStatus={humanizeLabel(scanSafety.status)}
                topWatchRows={opportunityModel.rows}
              />
              <IntradayRegimeDriftPanel compact driftRows={intradayDriftRows} rows={opportunityModel.rows} />
              <RegimeShiftIntelligencePanel compact rows={opportunityModel.rows} workflowEvolution={workflowEvolution} />
              <AdaptiveLearningInsightPanel compact system={adaptiveLearning} />
              <StrategyIntelligencePanel compact system={strategyIntelligence} />
              <ScenarioIntelligencePanel compact system={scenarioIntelligence} />
              <ExecutionIntelligencePanel compact rows={opportunityModel.rows} />
              {workflowEvolution ? <WorkflowEvolutionPanel summary={workflowEvolution} surface="terminal" /> : null}
              <InstitutionalIntelligencePanel compact rows={opportunityModel.rows} />
              <RiskTolerantOpportunityRadar compact initialProfile={personalizationProfile ?? undefined} marketCondition={snapshot.marketRegime.label} rows={opportunityModel.rows} />
              <ShockMoveRadar compact rows={opportunityModel.rows} />

              <GlassPanel className="overflow-hidden p-5">
                <div className="grid gap-5">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Command Center</div>
                    <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-50">Decision-first market intelligence</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                      Scanner signals, market regime, paper simulation, and risk controls are unified into one premium research workflow.
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <MetricCard label="Signals" value={snapshot.signals.length.toLocaleString()} meta="latest scan" />
                      {actionBlocksTradeUi ? (
                        <>
                          <MetricCard label="Mode" value="Research" meta="read-only" />
                          <MetricCard label="Action" value="No trade" meta="daily decision" />
                        </>
                      ) : (
                        <>
                          <MetricCard label="Research Signals" value={enterCount} meta="candidate count" />
                          <MetricCard label="Blocked" value={avoidCount} meta="risk filters" />
                        </>
                      )}
                      <MetricCard label="Paper PnL" value={formatMoney(snapshot.paperSummary.totalPnl)} meta={`${snapshot.paperSummary.totalTrades} trades`} tone="pnl" />
                    </div>
                  </div>
                  <MarketRegimeRadar regime={snapshot.marketRegime} researchMode={actionBlocksTradeUi} rows={snapshot.signals} />
                </div>
              </GlassPanel>
            </div>
          </details>

          {!actionBlocksTradeUi ? <BestTradeNowCard best={best} edges={edges} regime={snapshot.marketRegime} /> : null}

          {!actionBlocksTradeUi ? (
            <GlassPanel className="p-5">
              <SectionTitle eyebrow="Research Queue" title="Setups to Review" meta="scanner-ranked" />
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.topSignals.slice(0, 2).map((row) => <SignalCard edge={edges[row.symbol.toUpperCase()]} key={row.symbol} row={row} />)}
              </div>
            </GlassPanel>
          ) : null}

          {!actionBlocksTradeUi ? <SignalHeatmap rows={snapshot.signals} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="p-5">
              <SectionTitle eyebrow="Paper Performance" title="Simulation Pulse" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricCard label="Trades" value={snapshot.paperSummary.totalTrades} meta="paper only" />
                <MetricCard label="Open" value={snapshot.paperSummary.openTrades} meta="positions" />
                <MetricCard label="Win Rate" value={formatPercent(snapshot.paperSummary.winRate)} meta="closed" />
                <MetricCard label="Total PnL" value={formatMoney(snapshot.paperSummary.totalPnl)} meta="realized + open" tone="pnl" />
              </div>
            </GlassPanel>
            {!actionBlocksTradeUi ? (
              <MyWatchlistWidget rows={opportunityModel.rows} />
            ) : (
              <GlassPanel className="p-5">
                <SectionTitle eyebrow="Watchlist" title="Research Mode" />
                <p className="mt-4 text-sm leading-6 text-slate-400">Watchlist entry levels are hidden while the daily action says no active trade. Review symbols without acting.</p>
              </GlassPanel>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <TerminalRightRail
            alertMatches={activeAlertMatches}
            marketRegime={snapshot.marketRegime}
            rows={snapshot.signals}
            scanSafety={scanSafety}
            watchlistSymbols={watchlistSymbols}
          />
          {leader ? <AICopilotPanel contextLocked={actionBlocksTradeUi} lockedReason={noTradeCopy.reason} signal={leader} /> : null}
        </div>
      </div>
      <MarketOnboarding tradePlanHref={tradePlanHref} />
    </TerminalShell>
  );
}

function MarketTapeStrip({
  rows,
}: {
  rows: Array<{ final_decision?: unknown; final_score?: unknown; price?: unknown; return_1d?: unknown; symbol: string }>;
}) {
  const symbols = [
    { label: "S&P Proxy", symbol: "SPY" },
    { label: "Nasdaq Proxy", symbol: "QQQ" },
    { label: "BTC/USD", symbol: "BTC-USD" },
    { label: "Gold", symbol: "GLD" },
    { label: "Oil Proxy", symbol: "USO", fallback: "OXY" },
    { label: "Bitcoin ETF", symbol: "IBIT" },
  ];
  const bySymbol = new Map(rows.map((row) => [row.symbol.toUpperCase(), row]));
  return (
    <GlassPanel className="p-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <SectionTitle eyebrow="Market Tape" title="Cross-Asset Context" meta="from latest scanner data" />
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Research context only</div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {symbols.map((item) => {
          const row = bySymbol.get(item.symbol) ?? (item.fallback ? bySymbol.get(item.fallback) : undefined);
          const renderedSymbol = row?.symbol ?? item.symbol;
          return (
            <Link className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.06]" href={`/symbol/${renderedSymbol}`} key={item.symbol}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                  <div className="mt-1 font-mono text-base font-black text-slate-50">{renderedSymbol}</div>
                </div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">{row ? decisionLabel(row.final_decision) : "Unavailable"}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-slate-500">Price</div>
                  <div className="font-mono font-semibold text-slate-100">{row ? formatMoney(numeric(row.price)) : "Unavailable"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Score</div>
                  <div className="font-mono font-semibold text-slate-100">{row ? formatPercentLike(numeric(row.final_score)) : "N/A"}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function TerminalMonitoringBrief({
  rows,
  scanStatus,
  topWatchRows,
}: {
  rows: Array<{ [key: string]: unknown; final_decision?: unknown; symbol: string; decision_reason_codes?: unknown; decision_reason?: unknown; confidence_score?: unknown; final_score?: unknown; setup_type?: unknown }>;
  scanStatus: string;
  topWatchRows: Array<{ confidenceLabel: string; conviction: number; final_decision: string | null; final_score: number | null; fragility: number; structuralLabel: string; symbol: string }>;
}) {
  const watchRows = topWatchRows
    .filter((row) => ["WATCH", "WAIT_PULLBACK", "AVOID"].includes(String(row.final_decision ?? "").toUpperCase()))
    .slice(0, 4);
  const pulse = buildTerminalPulse(rows, topWatchRows);
  const changedRows = biggestSignalChanges(rows);
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Monitor Next" title="High-Signal Watchlist" meta={`Scanner ${scanStatus}`} />
      <div className="mt-4 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-2 sm:grid-cols-2">
          {watchRows.length ? watchRows.map((row) => (
            <Link className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.06]" href={`/symbol/${row.symbol}`} key={row.symbol}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-lg font-black text-slate-50">{row.symbol}</div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">{decisionLabel(row.final_decision)}</div>
              </div>
              <div className="mt-2 text-xs text-slate-400">Score {formatPercentLike(row.final_score)} · readiness {row.conviction} · fragility {row.fragility}</div>
              <div className="mt-1 text-[11px] font-semibold text-cyan-200">{row.structuralLabel}</div>
            </Link>
          )) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400">No watch candidates in the latest scan. Scanner remains in research context.</div>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Market read</div>
          <p className="mt-2 text-xs leading-5 text-slate-300">{pulse.narrative}</p>
          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Watch for</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
            {pulse.checklist.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IntelligenceTile title="What changed" value={changedRows.value} detail={changedRows.detail} />
        <IntelligenceTile title="Market breadth" value={pulse.breadth} detail={pulse.breadthDetail} />
        <IntelligenceTile title="Scanner pulse" value={pulse.scannerPulse} detail={pulse.scannerDetail} />
        <IntelligenceTile title="Signal quality" value={pulse.quality} detail={pulse.qualityDetail} />
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Latest focus shifts</div>
          <div className="text-[11px] text-slate-500">top 3</div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {pulse.movementRows.map((row) => (
            <Link className="rounded-lg border border-white/10 bg-slate-950/35 p-2 transition hover:border-cyan-300/35" href={`/symbol/${row.symbol}`} key={row.symbol}>
              <div className="font-mono text-sm font-black text-slate-50">{row.symbol}</div>
              <div className="mt-1 text-[11px] text-slate-400">{row.detail}</div>
            </Link>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

function IntelligenceTile({ detail, title, value }: { detail: string; title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-1 truncate font-mono text-base font-black text-slate-50" title={value}>{value}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{detail}</div>
    </div>
  );
}

function buildTerminalPulse(
  rows: Array<{ [key: string]: unknown; final_decision?: unknown; symbol: string; confidence_score?: unknown; final_score?: unknown; setup_type?: unknown }>,
  topWatchRows: Array<{ confidenceLabel: string; conviction: number; final_decision: string | null; final_score: number | null; fragility: number; structuralLabel: string; symbol: string }>,
) {
  const decisionDistribution = buildDecisionDistribution(rows);
  const avoid = decisionDistribution.find((item) => item.label === "Avoid")?.value ?? 0;
  const watch = decisionDistribution.find((item) => item.label === "Watch")?.value ?? 0;
  const waitPullback = decisionDistribution.find((item) => item.label === "Wait Pullback")?.value ?? 0;
  const fallbackCount = rows.filter((row) => Boolean(row.data_provider_fallback_used)).length;
  const staleCount = rows.filter((row) => Boolean(row.stale_data) || String(row.data_freshness_status ?? "").toLowerCase().includes("stale")).length;
  const vetoCount = rows.filter((row) => hasVetoes(row.vetoes)).length;
  const confidenceValues = rows.map((row) => numeric(row.confidence_score ?? row.final_score)).filter((value): value is number => value !== null);
  const averageConfidence = confidenceValues.length ? Math.round(confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length) : null;
  const highConfidence = topWatchRows.filter((row) => row.conviction >= 70).length;
  const fragileSetups = topWatchRows.filter((row) => row.fragility >= 70).length;
  const strongestSetup = topSetupLabel(rows);
  const movementRows = buildMovementRows(rows, topWatchRows);
  const narrative = avoid > rows.length * 0.45
    ? "Risk filters are doing most of the work right now. The terminal is prioritizing patience, cleaner pullbacks, and data-quality confirmation over forced activity."
    : watch + waitPullback > 0
      ? "The scanner sees research setups worth monitoring, but readiness is still gated by confirmation, vetoes, and regime context."
      : "The latest scan is quiet. That can be a healthy state when the evidence does not justify crowding the review queue.";

  return {
    breadth: `${watch + waitPullback} watch · ${avoid} avoid`,
    breadthDetail: `${strongestSetup} is the largest setup group in the current scanner universe.`,
    checklist: [
      "Watch whether high-confidence rows keep improving without new vetoes.",
      "Confirm data freshness before relying on historical context.",
      "Use symbol detail for reasons and risk context before interpreting a setup.",
    ],
    decisionDistribution,
    movementRows,
    narrative,
    quality: averageConfidence === null ? "Confidence N/A" : `${averageConfidence} avg confidence`,
    qualityDetail: `${highConfidence} high-readiness candidates and ${fragileSetups} elevated-fragility setups are visible in the current research queue.`,
    scannerDetail: `${fallbackCount} provider fallbacks, ${staleCount} stale rows, ${vetoCount} vetoed rows.`,
    scannerPulse: `${fallbackCount} fallback · ${vetoCount} vetoes`,
  };
}

function biggestSignalChanges(rows: Array<{ [key: string]: unknown; symbol: string }>): { detail: string; value: string } {
  const changed = rows
    .map((row) => ({ change: numeric(row.score_change ?? row.readiness_change ?? row.confidence_change), symbol: row.symbol }))
    .filter((item): item is { change: number; symbol: string } => item.change !== null)
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))[0];
  if (changed) {
    return {
      detail: `${changed.change > 0 ? "Improved" : "Weakened"} since the previous comparable snapshot.`,
      value: `${changed.symbol} ${changed.change > 0 ? "+" : ""}${changed.change.toFixed(1)}`,
    };
  }
  return {
    detail: "Change tracking will deepen as repeated scan snapshots accumulate.",
    value: "Stable latest scan",
  };
}

function buildMovementRows(
  rows: Array<{ [key: string]: unknown; symbol: string; final_decision?: unknown; confidence_score?: unknown; final_score?: unknown }>,
  topWatchRows: Array<{ confidenceLabel: string; conviction: number; final_decision: string | null; final_score: number | null; fragility: number; structuralLabel: string; symbol: string }>,
): Array<{ detail: string; symbol: string }> {
  const changed = rows
    .map((row) => ({ change: numeric(row.score_change ?? row.readiness_change ?? row.confidence_change), row }))
    .filter((item): item is { change: number; row: { [key: string]: unknown; symbol: string; final_decision?: unknown; confidence_score?: unknown; final_score?: unknown } } => item.change !== null)
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
    .slice(0, 3)
    .map((item) => ({
      detail: `${item.change > 0 ? "Improved" : "Weakened"} ${Math.abs(item.change).toFixed(1)} · ${decisionLabel(item.row.final_decision)}`,
      symbol: item.row.symbol,
    }));
  if (changed.length) return changed;
  return topWatchRows.slice(0, 3).map((row) => ({
    detail: `${row.structuralLabel} · ${row.conviction} readiness`,
    symbol: row.symbol,
  }));
}

function topSetupLabel(rows: Array<{ setup_type?: unknown }>): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = humanizeLabel(row.setup_type, "Unknown");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let selected = "Mixed setup";
  let selectedCount = -1;
  for (const [label, count] of counts) {
    if (count > selectedCount) {
      selected = label;
      selectedCount = count;
    }
  }
  return selected;
}

function hasVetoes(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  const text = String(value ?? "").trim();
  return Boolean(text && !["[]", "nan", "none", "null"].includes(text.toLowerCase()));
}

function buildDecisionDistribution(rows: Array<{ final_decision?: unknown }>): Array<{ label: string; value: number }> {
  return ["WATCH", "WAIT_PULLBACK", "AVOID"].map((label) => ({
    label: decisionLabel(label),
    value: rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === label).length,
  }));
}

function uniqueTerminalSymbols(symbols: Array<string | null | undefined>): string[] {
  return Array.from(new Set(symbols.map((symbol) => String(symbol ?? "").trim().toUpperCase()).filter(Boolean))).slice(0, 12);
}

function buildTodayActionReasons({ actionBlocksTradeUi, marketState, scanSafetyStatus }: { actionBlocksTradeUi: boolean; marketState: string; scanSafetyStatus: string }): string[] {
  if (scanSafetyStatus === "missing") return ["Scanner output is unavailable.", "Waiting for the next successful scan before showing decisions.", "Research only. Not financial advice."];
  if (scanSafetyStatus === "schema_mismatch") return ["Scanner output needs validation.", "Decisions are paused until the data shape is confirmed.", "Research only. Not financial advice."];
  if (scanSafetyStatus !== "fresh") return ["Latest completed scan is outside the active freshness window.", "Fresh decisions resume after the next successful scan.", "Research only. Not financial advice."];
  if (actionBlocksTradeUi) return ["The market is extended.", "Risk filters are asking for cleaner confirmation.", "No trade-ready setup passed every gate yet."];
  return [`Market regime: ${marketState}.`, "Review only setups with clean risk context.", "Research only. Not financial advice."];
}

function formatPercentLike(value: number | null): string {
  return value === null ? "N/A" : Math.round(value).toString();
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
