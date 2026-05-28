"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Activity, Brain, LineChart, ShieldAlert, Target } from "lucide-react";
import type { CinematicCluster, CinematicHeatCell, CinematicTimelineItem } from "@/components/visual/CinematicIntelligencePanels";
import type { ScoreFactor, VisualTone } from "@/components/visual/MiniVisuals";
import { useTradePlanEngine } from "@/hooks/useTradePlanEngine";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { DataFreshness } from "@/lib/data-health";
import type { PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { AdaptiveLearningSystem } from "@/lib/trading/adaptive-learning";
import type { DecisionJournalEntry, DecisionMemorySummary, PersonalizedDecisionCoaching } from "@/lib/trading/decision-journal";
import { buildAICognitionLayer } from "@/lib/trading/ai-cognition-layer";
import { buildConvictionFragilityModel } from "@/lib/trading/conviction-fragility";
import { dailyActionAllowsTrade, noTradeActionCopy, type DailyAction } from "@/lib/trading/daily-action";
import type { ConvictionTimelineModel } from "@/lib/trading/conviction-timeline-types";
import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { buildSymbolIntelligenceGraph } from "@/lib/trading/intelligence-graph";
import type { MacroExchangeContext } from "@/lib/trading/macro-regime";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { NarrativeIntelligence } from "@/lib/trading/narrative-intelligence";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { RiskPortfolioPosition } from "@/lib/trading/risk-veto";
import type { ScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import type { ShockMovePattern } from "@/lib/trading/shock-move";
import type { StrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";
import { buildSymbolKnowledgeGraphModel } from "@/lib/trading/symbol-knowledge-graph";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { buildSymbolResearchModel } from "@/lib/trading/market-research";
import { buildSignalTradeLevels, computeSignalLifecycle } from "@/lib/trading/signal-lifecycle";
import type { IntradayDriftRow, RankingRow, ScannerScalar } from "@/lib/types";
import type { ChartCandle, ChartSignalMarker } from "./SymbolChart";
import { SymbolDecisionHero } from "./SymbolDecisionHero";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

const PremiumLockedState = dynamic(() => import("@/components/premium/PremiumLockedState").then((mod) => mod.PremiumLockedState), { ssr: false });
const SymbolDeepResearchCockpit = dynamic(() => import("@/components/research/SymbolDeepResearchCockpit").then((mod) => mod.SymbolDeepResearchCockpit), { ssr: false });
const SymbolKnowledgeGraphPanel = dynamic(() => import("@/components/symbol/SymbolKnowledgeGraphPanel").then((mod) => mod.SymbolKnowledgeGraphPanel), { ssr: false });
const IntelligenceGraphPanel = dynamic(() => import("@/components/visual/IntelligenceGraphPanel").then((mod) => mod.IntelligenceGraphPanel), { ssr: false });
const CinematicClusterMosaic = dynamic(() => import("@/components/visual/CinematicIntelligencePanels").then((mod) => mod.CinematicClusterMosaic), { ssr: false });
const CinematicHeatMatrix = dynamic(() => import("@/components/visual/CinematicIntelligencePanels").then((mod) => mod.CinematicHeatMatrix), { ssr: false });
const CinematicTimeline = dynamic(() => import("@/components/visual/CinematicIntelligencePanels").then((mod) => mod.CinematicTimeline), { ssr: false });
const AICopilotPanel = dynamic(() => import("./AICopilotPanel").then((mod) => mod.AICopilotPanel), { ssr: false });
const AICognitionLayerPanel = dynamic(() => import("./AICognitionLayerPanel").then((mod) => mod.AICognitionLayerPanel), { ssr: false });
const AdaptiveLearningInsightPanel = dynamic(() => import("./AdaptiveLearningInsightPanel").then((mod) => mod.AdaptiveLearningInsightPanel), { ssr: false });
const ConvictionFragilityCard = dynamic(() => import("./ConvictionFragilityCard").then((mod) => mod.ConvictionFragilityCard), { ssr: false });
const ConvictionTimeline = dynamic(() => import("./ConvictionTimeline").then((mod) => mod.ConvictionTimeline), { ssr: false });
const CorrectionMapCard = dynamic(() => import("./CorrectionMapCard").then((mod) => mod.CorrectionMapCard), { ssr: false });
const DecisionJournalCard = dynamic(() => import("./DecisionJournalCard").then((mod) => mod.DecisionJournalCard), { ssr: false });
const ExecutionTicket = dynamic(() => import("./ExecutionTicket").then((mod) => mod.ExecutionTicket), { ssr: false });
const ExecutionIntelligencePanel = dynamic(() => import("./ExecutionIntelligencePanel").then((mod) => mod.ExecutionIntelligencePanel), { ssr: false });
const EvidenceMaturityCard = dynamic(() => import("./EvidenceMaturityCard").then((mod) => mod.EvidenceMaturityCard), { ssr: false });
const HistoricalEdgeCard = dynamic(() => import("./HistoricalEdgeCard").then((mod) => mod.HistoricalEdgeCard), { ssr: false });
const InstitutionalIntelligencePanel = dynamic(() => import("./InstitutionalIntelligencePanel").then((mod) => mod.InstitutionalIntelligencePanel), { ssr: false });
const IntradayRegimeDriftPanel = dynamic(() => import("./IntradayRegimeDriftPanel").then((mod) => mod.IntradayRegimeDriftPanel), { ssr: false });
const MacroExchangeContextCard = dynamic(() => import("./MacroExchangeContextCard").then((mod) => mod.MacroExchangeContextCard), { ssr: false });
const MarketMemoryCard = dynamic(() => import("./MarketMemoryCard").then((mod) => mod.MarketMemoryCard), { ssr: false });
const MetaIntelligenceOperatingSystemPanel = dynamic(() => import("./MetaIntelligenceOperatingSystemPanel").then((mod) => mod.MetaIntelligenceOperatingSystemPanel), { ssr: false });
const NarrativeIntelligenceCard = dynamic(() => import("./NarrativeIntelligenceCard").then((mod) => mod.NarrativeIntelligenceCard), { ssr: false });
const PaperContextCard = dynamic(() => import("./PaperContextCard").then((mod) => mod.PaperContextCard), { ssr: false });
const PersonalizedIntelligenceCard = dynamic(() => import("./PersonalizedIntelligenceCard").then((mod) => mod.PersonalizedIntelligenceCard), { ssr: false });
const SignalStatusCard = dynamic(() => import("./SignalStatusCard").then((mod) => mod.SignalStatusCard), { ssr: false });
const ScenarioIntelligencePanel = dynamic(() => import("./ScenarioIntelligencePanel").then((mod) => mod.ScenarioIntelligencePanel), { ssr: false });
const ShockPatternMemoryCard = dynamic(() => import("./ShockPatternMemoryCard").then((mod) => mod.ShockPatternMemoryCard), { ssr: false });
const StrategyIntelligencePanel = dynamic(() => import("./StrategyIntelligencePanel").then((mod) => mod.StrategyIntelligencePanel), { ssr: false });
const SymbolChart = dynamic(() => import("./SymbolChart").then((mod) => mod.SymbolChart), { ssr: false });
const SymbolDecisionIntelligencePanel = dynamic(() => import("./SymbolDecisionIntelligencePanel").then((mod) => mod.SymbolDecisionIntelligencePanel), { ssr: false });
const TechnicalSnapshotCard = dynamic(() => import("./TechnicalSnapshotCard").then((mod) => mod.TechnicalSnapshotCard), { ssr: false });
const TradePlanCard = dynamic(() => import("./TradePlanCard").then((mod) => mod.TradePlanCard), { ssr: false });
const VerifiedEventContextCard = dynamic(() => import("./VerifiedEventContextCard").then((mod) => mod.VerifiedEventContextCard), { ssr: false });
const WhatIfSimulator = dynamic(() => import("./WhatIfSimulator").then((mod) => mod.WhatIfSimulator), { ssr: false });
const WorkflowEvolutionPanel = dynamic(() => import("./WorkflowEvolutionPanel").then((mod) => mod.WorkflowEvolutionPanel), { ssr: false });
const WhyDecisionCard = dynamic(() => import("./WhyDecisionCard").then((mod) => mod.WhyDecisionCard), { ssr: false });

export function SymbolTerminalWorkspace({
  edgeProof,
  row,
  contextRows = [],
  dataFreshness,
  history,
  marketMemory,
  timeline,
  priceSeries,
  paperPositions,
  paperEvents,
  globalDecision,
  macroContext,
  narrative,
  decisionJournalEntries = [],
  decisionMemory,
  decisionCoaching,
  adaptiveLearning,
  workflowEvolution,
  institutionalOpportunity,
  intradayDriftRows = [],
  strategyIntelligence,
  scenarioIntelligence,
  personalizationProfile,
  shockPattern,
  premiumAccess = true,
  viewerAuthenticated = false,
}: {
  edgeProof: HistoricalEdgeProof;
  row: RankingRow;
  contextRows?: RankingRow[];
  dataFreshness: DataFreshness;
  history: SignalHistoryPoint[];
  marketMemory: MarketMemorySummary;
  timeline?: ConvictionTimelineModel;
  priceSeries: Record<string, ScannerScalar>[];
  paperPositions: PaperPositionRow[];
  paperEvents: PaperTradeEventRow[];
  globalDecision?: DailyAction;
  macroContext: MacroExchangeContext | null;
  narrative?: NarrativeIntelligence | null;
  decisionJournalEntries?: DecisionJournalEntry[];
  decisionMemory?: DecisionMemorySummary | null;
  decisionCoaching?: PersonalizedDecisionCoaching | null;
  adaptiveLearning?: AdaptiveLearningSystem | null;
  workflowEvolution?: WorkflowEvolutionSummary | null;
  institutionalOpportunity?: OpportunityViewModel | null;
  intradayDriftRows?: IntradayDriftRow[];
  strategyIntelligence?: StrategyIntelligenceSystem | null;
  scenarioIntelligence?: ScenarioIntelligenceSystem | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  shockPattern?: ShockMovePattern | null;
  premiumAccess?: boolean;
  viewerAuthenticated?: boolean;
}) {
  const [showHistoricalMarkers, setShowHistoricalMarkers] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [deepPanelsReady, setDeepPanelsReady] = useState(false);
  const tradeLevels = useMemo(() => buildSignalTradeLevels(row), [row]);
  const lifecycle = useMemo(() => computeSignalLifecycle(row, tradeLevels), [row, tradeLevels]);
  const symbol = row.symbol.toUpperCase();
  const structuralQuality = useMemo(() => (
    deepPanelsReady ? buildConvictionFragilityModel(row, { history, macroContext: macroContext ?? undefined, marketMemory }) : null
  ), [deepPanelsReady, history, macroContext, marketMemory, row]);
  const relationshipGraph = useMemo(
    () => deepPanelsReady ? buildSymbolIntelligenceGraph({ contextRows, macroContext, marketMemory, row, shockPattern: shockPattern ?? null }) : null,
    [contextRows, deepPanelsReady, macroContext, marketMemory, row, shockPattern],
  );
  const knowledgeGraph = useMemo(
    () => deepPanelsReady ? buildSymbolKnowledgeGraphModel({ contextRows, history, marketMemory, priceSeries, row }) : null,
    [contextRows, deepPanelsReady, history, marketMemory, priceSeries, row],
  );
  const cognitionLayer = useMemo(
    () => deepPanelsReady && institutionalOpportunity
      ? buildAICognitionLayer({
          marketCondition: String(row.market_regime ?? "Current market"),
          rows: [institutionalOpportunity],
          scanUpdatedAt: dataFreshness.lastUpdated,
          workflowEvolution: workflowEvolution ?? null,
          generatedAt: dataFreshness.lastUpdated ?? undefined,
        })
      : null,
    [dataFreshness.lastUpdated, deepPanelsReady, institutionalOpportunity, row.market_regime, workflowEvolution],
  );
  const riskPortfolio = useMemo(() => buildRiskPortfolio(paperPositions, row.sector, symbol), [paperPositions, row.sector, symbol]);
  const symbolResearch = useMemo(() => (deepPanelsReady ? buildSymbolResearchModel(row, contextRows) : null), [contextRows, deepPanelsReady, row]);
  const tradeEngine = useTradePlanEngine(row, riskPortfolio);
  const symbolPositions = paperPositions.filter((position) => position.symbol.toUpperCase() === symbol);
  const openPaper = symbolPositions.filter((position) => position.status === "OPEN");
  const symbolEvents = paperEvents.filter((event) => event.symbol.toUpperCase() === symbol).slice(0, 12);
  const candles = useMemo(() => rowsToCandles(priceSeries), [priceSeries]);
  const usesScannerSignalPriceTrail = useMemo(
    () => priceSeries.some((point) => String(point.source ?? "") === "scanner_signal_price_history"),
    [priceSeries],
  );
  const chartSignals = useMemo(() => {
    if (!candles.length) return undefined;
    const markers = buildChartSignalMarkers(history, row, dataFreshness, marketMemory, candles[candles.length - 1]?.time ?? null);
    return markers.length ? markers : undefined;
  }, [candles, dataFreshness, history, marketMemory, row]);
  const canTrade = globalDecision ? dailyActionAllowsTrade(globalDecision) : true;
  const noTradeCopy = globalDecision && !canTrade ? noTradeActionCopy(globalDecision) : null;
  const researchModeReason = noTradeCopy?.reason ?? "The global decision system is keeping this in research mode for now.";

  useEffect(() => {
    setChartReady(false);
    setDeepPanelsReady(false);
    let cancelled = false;
    const chartTimer = window.setTimeout(() => {
      if (!cancelled) setChartReady(true);
    }, 0);
    const run = () => {
      if (!cancelled) setDeepPanelsReady(true);
    };
    const idleWindow = window as Window & {
      cancelIdleCallback?: (handle: number) => void;
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const handle = idleWindow.requestIdleCallback(run, { timeout: 700 });
      return () => {
        cancelled = true;
        window.clearTimeout(chartTimer);
        idleWindow.cancelIdleCallback?.(handle);
      };
    }
    const timeout = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(chartTimer);
      window.clearTimeout(timeout);
    };
  }, [symbol]);

  if (!premiumAccess) {
    return (
      <div className="space-y-5">
        <SymbolDecisionHero dataFreshness={dataFreshness} edge={edgeProof} previewMode row={row} tradeAllowed={false} />
        <PremiumLockedState
          authenticated={viewerAuthenticated}
          description="Full trade plans, AI decision details, What-If simulation, execution tickets, signal history, and advanced chart context are premium symbol tools."
          previewItems={["AI Copilot and risk-rule veto context", "What-If simulator and execution planning", "Historical edge, conviction timeline, and signal map"]}
          title="Full symbol trade plan is locked"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div id="overview">
        <SymbolDecisionHero dataFreshness={dataFreshness} edge={edgeProof} researchModeReason={researchModeReason} row={row} tradeAllowed={canTrade} />
      </div>

      {!canTrade ? (
        <GlassPanel className="border-amber-300/25 bg-amber-400/[0.08] p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Global Decision</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{noTradeCopy?.title ?? "Research Mode"}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            This is a research signal only. {researchModeReason} Entry, stop, target, and execution surfaces stay hidden until timing improves.
          </p>
          <div className="mt-4 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-100">Best next step: monitor patiently</div>
        </GlassPanel>
      ) : null}

      <GlassPanel className="p-6" id="chart">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle eyebrow="Chart" title="Current Signal Map" />
          <button
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300 transition-all duration-200 hover:border-cyan-300/40 hover:bg-white/[0.07] hover:text-cyan-100"
            onClick={() => setShowHistoricalMarkers((value) => !value)}
            type="button"
          >
            {showHistoricalMarkers ? "Hide intelligence overlays" : "Show intelligence overlays"}
          </button>
        </div>
        <div className="mt-5">
          {chartReady ? (
            <SymbolChart
              candles={candles.length ? candles : undefined}
              dataSource={usesScannerSignalPriceTrail ? "scanner signal price trail" : "scanner validated OHLC history"}
              interpretation={usesScannerSignalPriceTrail
                ? `${symbol} chart is using real stored scanner price observations because full OHLC history is not populated yet. Use it as sparse signal-evolution context, not a complete tape.`
                : `${symbol} price history is shown with real stored candles. Use it with decision quality, risk pressure, replay context, and market regime before interpreting the setup.`}
              lastUpdated={typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null}
              scannerScore={numericValue(row.final_score ?? row.score ?? row.quality_score)}
              showHistoricalSignals={showHistoricalMarkers}
              showResearchLevelsToggle
              signals={chartSignals}
              symbol={symbol}
              symbolSequence={contextRows.map((contextRow) => String(contextRow.symbol ?? ""))}
              tradeLevels={canTrade ? tradeLevels : undefined}
            />
          ) : (
            <FastSymbolChartShell candles={candles} dataSource={usesScannerSignalPriceTrail ? "scanner signal price trail" : "scanner validated OHLC history"} symbol={symbol} />
          )}
        </div>
      </GlassPanel>

      {symbolResearch ? <SymbolDeepResearchCockpit model={symbolResearch} /> : (
        <GlassPanel className="p-5" data-symbol-deferred-intelligence="true">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Deferred intelligence</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">Chart and decision shell are ready. Deep replay, market memory, and provider panels hydrate after first paint using existing evidence.</p>
        </GlassPanel>
      )}

      {deepPanelsReady ? (
        <SymbolCinematicResearchCockpit
          candles={candles}
          canTrade={canTrade}
          dataFreshness={dataFreshness}
          history={history}
          marketMemory={marketMemory}
          row={row}
          shockPattern={shockPattern ?? null}
          symbol={symbol}
          workflowEvolution={workflowEvolution ?? null}
        />
      ) : null}

      {relationshipGraph ? (
        <div id="intelligence">
          <IntelligenceGraphPanel graph={relationshipGraph} />
        </div>
      ) : null}
      {knowledgeGraph ? <SymbolKnowledgeGraphPanel model={knowledgeGraph} /> : null}
      {cognitionLayer ? <AICognitionLayerPanel compact model={cognitionLayer} /> : null}

      {deepPanelsReady ? (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="space-y-5">
          {canTrade ? (
            <AICopilotPanel engine={tradeEngine} signal={row} />
          ) : (
            <GlassPanel className="p-6">
              <SectionTitle eyebrow="Decision Assistant" title="Research Mode" />
              <p className="mt-4 text-sm leading-6 text-slate-400">AI trade guidance stays in research mode while the global decision asks for patience. Review the context and wait for cleaner confirmation.</p>
            </GlassPanel>
          )}
          <SymbolDecisionIntelligencePanel candles={candles} row={row} />
          <EvidenceMaturityCard marketMemory={marketMemory} row={row} shockPattern={shockPattern ?? null} />
          <NarrativeIntelligenceCard narrative={narrative ?? null} />
          <ResponsiveAdvancedDetails
            eyebrow="Symbol detail"
            summary="Secondary research stays available without pushing timing tools too far down the phone screen."
            title={`More ${symbol} intelligence`}
          >
            {institutionalOpportunity ? <MetaIntelligenceOperatingSystemPanel compact focusSymbol={symbol} personalizationProfile={personalizationProfile ?? null} rows={[institutionalOpportunity]} workflowEvolution={workflowEvolution ?? null} /> : null}
            {institutionalOpportunity ? <IntradayRegimeDriftPanel compact driftRows={intradayDriftRows} focusSymbol={symbol} rows={[institutionalOpportunity]} /> : null}
            <AdaptiveLearningInsightPanel compact focusSymbol={symbol} system={adaptiveLearning ?? null} />
            <StrategyIntelligencePanel compact focusSymbol={symbol} system={strategyIntelligence ?? null} />
            <ScenarioIntelligencePanel compact focusSymbol={symbol} system={scenarioIntelligence ?? null} />
            {institutionalOpportunity ? <ExecutionIntelligencePanel compact focusSymbol={symbol} rows={[institutionalOpportunity]} /> : null}
            <PersonalizedIntelligenceCard narrative={narrative ?? null} profile={personalizationProfile ?? null} row={row} />
            {decisionMemory && decisionCoaching ? (
              <DecisionJournalCard coaching={decisionCoaching} entries={decisionJournalEntries} memory={decisionMemory} profile={personalizationProfile ?? null} row={row} />
            ) : null}
            {workflowEvolution ? <WorkflowEvolutionPanel compact summary={workflowEvolution} surface="symbol" /> : null}
            {institutionalOpportunity ? <InstitutionalIntelligencePanel compact focusSymbol={symbol} rows={[institutionalOpportunity]} /> : null}
            {macroContext ? <MacroExchangeContextCard context={macroContext} row={row} /> : null}
            <VerifiedEventContextCard row={row} />
            {structuralQuality ? <ConvictionFragilityCard model={structuralQuality} /> : null}
          </ResponsiveAdvancedDetails>
        </div>
        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start" id="risk">
          <WhatIfSimulator canTrade={canTrade} engine={tradeEngine} researchModeReason={researchModeReason} />
          {canTrade ? <ExecutionTicket canTrade={canTrade} engine={tradeEngine} researchModeReason={researchModeReason} symbol={symbol} /> : null}
        </aside>
      </div>
      ) : null}

      {deepPanelsReady && canTrade ? <SignalStatusCard lifecycle={lifecycle} /> : null}

      {deepPanelsReady ? <ResponsiveAdvancedDetails
        deferMount
        eyebrow="Deep symbol proof"
        summary="Open for trade plan, market memory, historical edge, paper context, and conviction timeline."
        title={`${symbol} research proof and risk detail`}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
          <div className="space-y-5">
            {canTrade ? <TradePlanCard engine={tradeEngine} row={row} /> : null}
            {canTrade ? <CorrectionMapCard row={row} /> : null}
            <ShockPatternMemoryCard pattern={shockPattern ?? null} />
            <MarketMemoryCard memory={marketMemory} />
            <HistoricalEdgeCard edge={edgeProof} />
            <WhyDecisionCard row={row} />
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <TechnicalSnapshotCard row={row} />
          </aside>
        </div>

        <PaperContextCard events={symbolEvents} openPositions={openPaper} positions={symbolPositions} symbol={symbol} />
        <ConvictionTimeline timeline={timeline} />
      </ResponsiveAdvancedDetails> : null}
    </div>
  );
}

function FastSymbolChartShell({ candles, dataSource, symbol }: { candles: ChartCandle[]; dataSource: string; symbol: string }) {
  const latest = candles[candles.length - 1]?.close ?? null;
  const first = candles[0]?.close ?? null;
  const movePct = latest !== null && first !== null && first !== 0 ? ((latest - first) / first) * 100 : null;
  const path = fastChartPath(candles, 900, 260);
  return (
    <div
      className="rounded-3xl border border-cyan-300/15 bg-slate-950/55 p-4"
      data-chart-fast-shell="true"
      data-chart-symbol={symbol}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Chart shell</div>
          <h3 className="mt-1 font-mono text-xl font-black text-slate-50">{symbol}</h3>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div className="font-mono text-lg font-black text-slate-100">{latest === null ? "Limited" : moneyText(latest)}</div>
          <div className={movePct !== null && movePct >= 0 ? "text-emerald-200" : "text-rose-200"}>{movePct === null ? "Move limited" : `${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%`}</div>
        </div>
      </div>
      <div className="mt-4 h-[260px] overflow-hidden rounded-2xl border border-white/10 bg-black/25">
        {path ? (
          <svg aria-label={`${symbol} real candle chart preview`} className="h-full w-full" preserveAspectRatio="none" role="img" viewBox="0 0 900 260">
            <path d={path.area} fill="rgba(34, 211, 238, 0.10)" />
            <path d={path.line} fill="none" stroke="rgb(103, 232, 249)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-slate-400">Chart preview is limited because no verified candles are available.</div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{dataSource}</span>
        <span>Full chart workstation loading after first paint.</span>
      </div>
    </div>
  );
}

function SymbolCinematicResearchCockpit({
  candles,
  canTrade,
  dataFreshness,
  history,
  marketMemory,
  row,
  shockPattern,
  symbol,
  workflowEvolution,
}: {
  candles: ChartCandle[];
  canTrade: boolean;
  dataFreshness: DataFreshness;
  history: SignalHistoryPoint[];
  marketMemory: MarketMemorySummary;
  row: RankingRow;
  shockPattern: ShockMovePattern | null;
  symbol: string;
  workflowEvolution: WorkflowEvolutionSummary | null;
}) {
  const score = numericValue(row.final_score ?? row.score ?? row.quality_score);
  const confidence = numericValue(row.confidence ?? row.confidence_score ?? row.readiness_score ?? row.final_score);
  const riskPressure = numericValue(row.risk_pressure ?? row.risk_pressure_score ?? row.macro_pressure_score ?? row.event_risk_score);
  const fragility = numericValue(row.fragility_score ?? row.fragility ?? row.structural_fragility);
  const entry = numericValue(row.suggested_entry ?? row.entry_zone ?? row.buy_zone ?? row.price);
  const stop = numericValue(row.stop_loss ?? row.invalidation_level);
  const target = numericValue(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price);
  const recentScores = history
    .slice()
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map((point) => point.final_score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const priceValues = candles.map((candle) => candle.close);
  const latestClose = candles[candles.length - 1]?.close ?? numericValue(row.price);
  const analogs = marketMemory.analogs ?? [];
  const topAnalog = analogs[0];
  const workflowChanges = workflowEvolution?.whatChanged ?? [];
  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "No validated score history exists for this symbol yet.",
      eyebrow: "Decision cockpit",
      factors: [
        symbolFactor("Score", score, "cyan"),
        symbolFactor("Confidence", confidence, "emerald"),
        symbolFactor("Freshness", freshnessScore(dataFreshness), "cyan"),
      ],
      icon: <Target className="h-6 w-6" />,
      items: [
        { detail: "Latest stored scanner price context.", label: "Latest available", tone: "cyan", value: moneyText(latestClose) },
        { detail: "Scanner-provided entry zone or current price fallback.", label: "Entry context", tone: "emerald", value: moneyText(entry) },
        { detail: "Stored invalidation/stop context when available.", label: "Invalidation", tone: "rose", value: moneyText(stop) },
        { detail: "Stored target or profit-taking context when available.", label: "Target context", tone: "amber", value: moneyText(target) },
      ],
      metric: String(row.final_decision ?? row.action ?? "Research"),
      metricLabel: "decision state",
      score,
      summary: `${symbol} is shown as a research cockpit with decision, price context, evidence freshness, and risk state in one surface.`,
      title: "Symbol Decision Stack",
      tone: canTrade ? "emerald" : "amber",
      updatedAt: dataFreshness.lastUpdated ?? undefined,
      values: recentScores.length ? recentScores : [score, confidence],
    },
    {
      emptyMessage: "Risk and fragility fields are not available in this scanner packet.",
      eyebrow: "Risk cluster",
      factors: [
        symbolFactor("Risk Pressure", riskPressure, "rose"),
        symbolFactor("Fragility", fragility, "amber"),
        symbolFactor("Event Risk", numericValue(row.event_risk ?? row.event_risk_score), "rose"),
      ],
      icon: <ShieldAlert className="h-6 w-6" />,
      items: [
        { detail: "Higher values require more patience and cleaner confirmation.", label: "Risk pressure", tone: "rose", value: scoreText(riskPressure) },
        { detail: "Structural fragility from current scanner context.", label: "Fragility", tone: "amber", value: scoreText(fragility) },
        { detail: "Decision assistant keeps timing gated when broader risk is elevated.", label: "Research mode", tone: canTrade ? "emerald" : "amber", value: canTrade ? "Open" : "Wait" },
      ],
      metric: scoreText(riskPressure),
      metricLabel: "risk pressure",
      score: riskPressure,
      summary: "Risk context is elevated visually before deeper trade mechanics so the user sees caution first.",
      title: "Risk and Wait System",
      tone: riskPressure !== null && riskPressure >= 65 ? "rose" : "amber",
      values: [riskPressure, fragility, numericValue(row.event_risk ?? row.event_risk_score)],
    },
    {
      emptyMessage: "No stored candles are available for a chart story yet.",
      eyebrow: "Chart cluster",
      factors: [
        symbolFactor("Candles", Math.min(100, candles.length * 2), "cyan"),
        symbolFactor("Score History", Math.min(100, recentScores.length * 6), "violet"),
        symbolFactor("Replay Markers", marketMemory.available ? topAnalog?.similarityScore ?? null : null, "violet"),
      ],
      icon: <LineChart className="h-6 w-6" />,
      items: [
        { detail: "Stored OHLC candles powering the symbol chart.", label: "Price history", tone: "cyan", value: candles.length ? `${candles.length}` : "Limited" },
        { detail: "Scanner history points powering score evolution.", label: "Signal history", tone: "violet", value: history.length ? `${history.length}` : "Limited" },
        { detail: "Closest validated historical analog when available.", label: "Replay analog", tone: "violet", value: topAnalog ? `${Math.round(topAnalog.similarityScore)}%` : "Limited" },
      ],
      metric: candles.length ? `${candles.length}` : "Limited",
      metricLabel: "stored candles",
      score: candles.length ? Math.min(100, candles.length * 2) : null,
      summary: "Chart and replay context use stored candles, scanner history, and market memory only.",
      title: "Chart and Replay Timeline",
      tone: "violet",
      values: priceValues,
    },
    {
      emptyMessage: "No validated market memory analogs are available for this symbol.",
      eyebrow: "Memory cluster",
      factors: [
        symbolFactor("Memory Score", marketMemory.available ? topAnalog?.similarityScore ?? null : null, "violet"),
        symbolFactor("Analog Count", Math.min(100, analogs.length * 20), "cyan"),
        symbolFactor("Evidence", marketMemory.evidence.sampleSize ? Math.min(100, marketMemory.evidence.sampleSize * 10) : null, "emerald"),
      ],
      icon: <Brain className="h-6 w-6" />,
      items: analogs.slice(0, 4).map((analog) => ({
        detail: analog.reasonCodes.length
          ? analog.reasonCodes.join(", ")
          : analog.outcomes.length
            ? analog.outcomes.join(", ")
            : analog.setupType ?? "Historical analog context.",
        href: `/symbol/${encodeURIComponent(analog.symbol)}`,
        label: analog.symbol,
        tone: "violet" as const,
        value: `${Math.round(analog.similarityScore)}%`,
      })),
      metric: topAnalog ? `${Math.round(topAnalog.similarityScore)}%` : "Limited",
      metricLabel: "closest analog",
      score: topAnalog?.similarityScore ?? null,
      summary: marketMemory.available ? "Market memory compares the current setup with validated historical analogs." : marketMemory.evidence.explanation,
      title: "Market Memory Layer",
      tone: "violet",
      values: analogs.map((analog) => analog.similarityScore),
    },
    {
      emptyMessage: "No shock or workflow movement has been validated for this symbol yet.",
      eyebrow: "Evolution cluster",
      factors: [
        symbolFactor("Shock Similarity", shockPattern?.currentSimilarityScore ?? null, "rose"),
        symbolFactor("Workflow Changes", workflowChanges.length ? Math.min(100, workflowChanges.length * 18) : null, "cyan"),
        symbolFactor("Freshness", freshnessScore(dataFreshness), "cyan"),
      ],
      icon: <Activity className="h-6 w-6" />,
      items: [
        shockPattern ? { detail: shockPattern.chaseRiskLabel, label: "Shock context", tone: "rose" as const, value: `${shockPattern.currentSimilarityScore}/100` } : null,
        workflowChanges[0] ? { detail: workflowChanges[0].detail, label: workflowChanges[0].title, tone: "cyan" as const, value: workflowChanges[0].metricLabel } : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null),
      metric: shockPattern ? `${shockPattern.currentSimilarityScore}` : "Limited",
      metricLabel: "shock score",
      score: shockPattern?.currentSimilarityScore ?? null,
      summary: "Evolution combines shock memory, workflow movement, freshness, and change state where available.",
      title: "Shock and Workflow Evolution",
      tone: shockPattern ? "rose" : "cyan",
      values: [shockPattern?.currentSimilarityScore ?? null, freshnessScore(dataFreshness)],
    },
  ];
  const heatCells: CinematicHeatCell[] = [
    { detail: "Current score from the scanner packet.", label: "Score", tone: "cyan", value: score },
    { detail: "Confidence/readiness context if present.", label: "Confidence", tone: "emerald", value: confidence },
    { detail: "Risk pressure from risk/macro/event fields.", label: "Risk", tone: "rose", value: riskPressure },
    { detail: "Signal freshness based on stored update timestamp.", label: "Freshness", tone: "cyan", value: freshnessScore(dataFreshness) },
    { detail: "Replay or market memory similarity.", label: "Memory", tone: "violet", value: topAnalog?.similarityScore ?? null },
    { detail: "Current shock move similarity where validated.", label: "Shock", tone: "rose", value: shockPattern?.currentSimilarityScore ?? null },
  ];
  const timelineItems: CinematicTimelineItem[] = history
    .slice()
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, 7)
    .map((point) => ({
      detail: point.final_decision ? `Decision state: ${point.final_decision}` : "Stored scanner history point.",
      label: `${symbol} score`,
      metric: point.final_score === null ? "Limited" : `${Math.round(point.final_score)}`,
      timestamp: point.timestamp,
      tone: point.final_score !== null && point.final_score >= 60 ? "emerald" : point.final_score !== null && point.final_score < 40 ? "rose" : "cyan",
    }));

  return (
    <div className="space-y-4">
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Symbol cinematic cockpit"
        summary="A dense symbol intelligence layer that connects decision, chart, replay, market memory, risk, shock, and freshness without inventing missing evidence."
        title={`${symbol} Research Command Surface`}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <CinematicHeatMatrix
          cells={heatCells}
          emptyMessage="This symbol needs more validated scanner fields before a heat map can be shown."
          eyebrow="Factor heat"
          summary="Each heat cell maps to the current scanner packet, freshness model, market memory, or shock model."
          title="Signal Pressure Matrix"
        />
        <CinematicTimeline
          emptyMessage="No stored scanner history exists for this symbol yet."
          eyebrow="Signal evolution"
          items={timelineItems}
          summary="Chronological score and decision states from saved scanner history."
          title="Cognition Timeline"
        />
      </div>
    </div>
  );
}

function symbolFactor(label: string, value: number | null | undefined, tone: VisualTone): ScoreFactor {
  return { label, tone, value: value ?? null };
}

function freshnessScore(dataFreshness: DataFreshness): number | null {
  if (dataFreshness.status === "fresh") return 100;
  if (dataFreshness.status === "slightly_stale") return 72;
  if (dataFreshness.status === "stale") return 38;
  return null;
}

function moneyText(value: number | null): string {
  return value === null ? "Limited" : `$${value.toFixed(2)}`;
}

function fastChartPath(candles: ChartCandle[], width: number, height: number): { area: string; line: string } | null {
  const closes = candles
    .map((candle) => candle.close)
    .filter((value) => Number.isFinite(value));
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const step = width / Math.max(1, closes.length - 1);
  const points = closes.map((close, index) => {
    const x = index * step;
    const y = height - ((close - min) / span) * (height - 24) - 12;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M ${points.join(" L ")}`;
  const lastX = (closes.length - 1) * step;
  const area = `${line} L ${lastX.toFixed(2)},${height} L 0,${height} Z`;
  return { area, line };
}

function scoreText(value: number | null): string {
  return value === null ? "Limited" : `${Math.round(value)}`;
}

function rowsToCandles(rows: Record<string, ScannerScalar>[]): ChartCandle[] {
  return rows
    .map((row) => {
      const time = textValue(row.date ?? row.datetime ?? row.timestamp_utc ?? row.time);
      const open = numericValue(row.open ?? row.Open);
      const high = numericValue(row.high ?? row.High);
      const low = numericValue(row.low ?? row.Low);
      const close = numericValue(row.close ?? row.Close);
      if (!time || open === null || high === null || low === null || close === null) return null;
      return { close, high, low, open, time };
    })
    .filter((candle): candle is ChartCandle => Boolean(candle));
}

function buildChartSignalMarkers(
  history: SignalHistoryPoint[],
  row: RankingRow,
  dataFreshness: DataFreshness,
  marketMemory: MarketMemorySummary,
  fallbackTimestamp: string | null,
): ChartSignalMarker[] {
  const markers: ChartSignalMarker[] = [];
  const sortedHistory = [...history].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

  sortedHistory.forEach((point, index) => {
    const decisionMarker = historyPointToMarker(point);
    if (decisionMarker) markers.push(decisionMarker);

    const previousScore = index > 0 ? sortedHistory[index - 1]?.final_score ?? null : null;
    if (point.final_score !== null && previousScore !== null) {
      const delta = point.final_score - previousScore;
      if (Math.abs(delta) >= 8) {
        markers.push({
          source: "scanner signal history",
          text: `${delta > 0 ? "+" : ""}${Math.round(delta)} score`,
          time: point.timestamp,
          type: "CONFIDENCE",
          uncertainty: "Score-change markers require stored scanner history and do not predict future movement.",
        });
      }
    }

    const entryStatus = point.entry_status.toLowerCase();
    if (entryStatus.includes("stale") || entryStatus.includes("extended")) {
      markers.push({
        source: "scanner entry-status history",
        text: entryStatus.includes("stale") ? "STALE" : "EXTENDED",
        time: point.timestamp,
        type: entryStatus.includes("stale") ? "STALE" : "RISK",
        uncertainty: "Freshness and entry-status markers are research context only.",
      });
    }
  });

  const currentTime = textValue(row.last_updated_utc ?? row.last_updated ?? fallbackTimestamp);
  if (currentTime) {
    if (dataFreshness.status === "fresh") {
      markers.push({
        source: "scanner freshness timestamp",
        text: "FRESH",
        time: currentTime,
        type: "FRESHNESS",
        uncertainty: dataFreshness.message,
      });
    }
    if (dataFreshness.status === "stale" || dataFreshness.status === "slightly_stale" || dataFreshness.status === "missing") {
      markers.push({
        source: "scanner freshness timestamp",
        text: dataFreshness.status === "slightly_stale" ? "AGING" : "STALE",
        time: currentTime,
        type: "STALE",
        uncertainty: dataFreshness.message,
      });
    }

    const eventRisk = numericValue(row.event_risk ?? row.event_risk_score ?? row.verified_event_risk_score ?? null);
    if (eventRisk !== null && eventRisk >= 70) {
      markers.push({
        source: "verified event risk score",
        text: "EVENT RISK",
        time: currentTime,
        type: "EVENT",
        uncertainty: "Event-risk markers appear only when the current scanner payload contains elevated event risk.",
      });
    }

    const volatilityPressure = numericValue(row.volatility_pressure ?? row.volatility_pressure_score ?? row.volatility_pressure_adjustment ?? row.atr_pct ?? row.atr_percent ?? null);
    if (volatilityPressure !== null && Math.abs(volatilityPressure) >= 65) {
      markers.push({
        source: "volatility pressure model",
        text: "VOLATILITY",
        time: currentTime,
        type: "VOLATILITY",
        uncertainty: "Volatility markers are synchronized from scanner risk context and visible price behavior.",
      });
    }

    const shockPressure = numericValue(row.event_shock_pressure_score ?? row.verified_event_pressure_score ?? row.shock_risk_score ?? row.large_move_score ?? row.event_similarity_score ?? null);
    if (shockPressure !== null && shockPressure >= 65) {
      markers.push({
        source: "shock and large-move pressure model",
        text: "SHOCK",
        time: currentTime,
        type: "SHOCK",
        uncertainty: "Shock markers appear only when event, volatility, or large-move pressure is elevated in source data.",
      });
    }

    const fragility = numericValue(row.fragility_score ?? row.fragility ?? row.structural_fragility ?? null);
    if (fragility !== null && fragility >= 70) {
      markers.push({
        source: "conviction and fragility model",
        text: "FRAGILITY",
        time: currentTime,
        type: "RISK",
        uncertainty: "Fragility markers indicate elevated structural risk, not a trade instruction.",
      });
    }

    const macroAdjustment = numericValue(row.macro_context_adjustment_total ?? row.regime_adjustment ?? null);
    if (macroAdjustment !== null && Math.abs(macroAdjustment) >= 5) {
      markers.push({
        source: "macro regime adjustment",
        text: macroAdjustment > 0 ? "MACRO +" : "MACRO -",
        time: currentTime,
        type: "MACRO",
        uncertainty: "Macro markers reflect current context adjustment only.",
      });
    }

    const finalScore = numericValue(row.final_score_adjusted ?? row.final_score ?? row.macro_adjusted_score ?? null);
    const contradictionCount = numericValue(row.contradiction_count ?? row.contradictions ?? null);
    const hasContradiction = (contradictionCount !== null && contradictionCount > 0)
      || (finalScore !== null && finalScore >= 65 && fragility !== null && fragility >= 65)
      || (finalScore !== null && finalScore >= 65 && macroAdjustment !== null && macroAdjustment <= -5)
      || (finalScore !== null && finalScore >= 65 && (dataFreshness.status === "stale" || dataFreshness.status === "missing"));
    if (hasContradiction) {
      markers.push({
        source: "cross-system contradiction checks",
        text: "CONFLICT",
        time: currentTime,
        type: "CONTRADICTION",
        uncertainty: "Contradiction markers highlight where score, macro, freshness, or fragility evidence does not agree.",
      });
    }

    const replayQuality = numericValue(row.analog_quality_score ?? row.regime_similarity_score ?? row.event_similarity_score ?? null);
    if (replayQuality !== null && replayQuality >= 60) {
      markers.push({
        source: "replay and analog quality model",
        text: `${Math.round(replayQuality)}% REPLAY`,
        time: currentTime,
        type: "REPLAY",
        uncertainty: "Replay similarity is historical context, not a prediction.",
      });
    }

    const topAnalog = marketMemory.analogs[0];
    if (marketMemory.available && topAnalog) {
      markers.push({
        source: "market memory similarity",
        text: `${Math.round(topAnalog.similarityScore)}% MEMORY`,
        time: currentTime,
        type: "MEMORY",
        uncertainty: `Closest analog: ${topAnalog.symbol}. Similarity is context, not a prediction.`,
      });
    }

    const price = numericValue(row.price ?? row.last_price ?? row.close ?? null);
    const entryHigh = numericValue(row.entry_zone_high ?? row.buy_zone_high ?? row.correction_zone_high ?? row.suggested_entry ?? null);
    const stop = numericValue(row.stop_loss ?? row.invalidation_level ?? row.recent_swing_low ?? row.swing_low ?? null);
    const target = numericValue(row.conservative_target ?? row.take_profit_high ?? row.take_profit_zone ?? row.balanced_target ?? row.aggressive_target ?? null);
    if (price !== null && entryHigh !== null && price >= entryHigh * 1.01) {
      markers.push({
        source: "scanner price and entry context",
        text: "BREAKOUT",
        time: currentTime,
        type: "BREAKOUT",
        uncertainty: "Breakout markers require validated price to be above scanner entry context. They are research context only.",
      });
    }
    if (price !== null && stop !== null && price <= stop * 1.03) {
      markers.push({
        source: "scanner price and invalidation context",
        text: "FAILURE",
        time: currentTime,
        type: "FAILURE",
        uncertainty: "Failure markers require validated price to be near scanner invalidation context.",
      });
    }
    if (price !== null && target !== null && price >= target * 0.98) {
      markers.push({
        source: "scanner price and target context",
        text: "TARGET",
        time: currentTime,
        type: "TARGET",
        uncertainty: "Target context is a research overlay, not a projected outcome.",
      });
    }
  }

  return dedupeChartMarkers(markers);
}

function historyPointToMarker(point: SignalHistoryPoint): ChartSignalMarker | null {
  const decision = point.final_decision.toUpperCase();
  if (decision === "ENTER") return { source: "scanner decision history", time: point.timestamp, type: "ENTER", text: "ENTER" };
  if (decision === "EXIT") return { source: "scanner decision history", time: point.timestamp, type: "EXIT", text: "EXIT" };
  if (decision === "WAIT_PULLBACK" || decision === "WATCH") return { source: "scanner decision history", time: point.timestamp, type: "WAIT", text: decision === "WATCH" ? "WATCH" : "WAIT" };
  if (decision.includes("RISK") || decision === "AVOID") return { source: "scanner decision history", time: point.timestamp, type: "RISK", text: "RISK" };
  return null;
}

function dedupeChartMarkers(markers: ChartSignalMarker[]): ChartSignalMarker[] {
  const seen = new Set<string>();
  const deduped: ChartSignalMarker[] = [];
  for (const marker of markers) {
    const key = `${marker.time}|${marker.type}|${marker.text ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(marker);
  }
  return deduped.sort((left, right) => left.time.localeCompare(right.time));
}

function numericValue(value: ScannerScalar) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: ScannerScalar) {
  const text = String(value ?? "").trim();
  return text || null;
}

function buildRiskPortfolio(positions: PaperPositionRow[], currentSector: string | undefined, currentSymbol: string): RiskPortfolioPosition[] {
  return positions
    .filter((position) => position.status.toUpperCase() === "OPEN")
    .map((position) => {
      const sector = (position as PaperPositionRow & { sector?: string | null }).sector;
      const quantity = numericValue(position.quantity);
      const entry = numericValue(position.entry_price);
      const currentPrice = numericValue(position.current_price ?? position.entry_price);
      const stop = numericValue(position.stop_loss);
      const riskAmount = quantity !== null && entry !== null && stop !== null && entry > stop ? (entry - stop) * quantity : null;
      const positionValue = quantity !== null && currentPrice !== null ? quantity * currentPrice : null;
      return {
        positionValue,
        riskAmount,
        sector: sector ?? (position.symbol.toUpperCase() === currentSymbol ? currentSector ?? null : null),
        status: position.status,
        symbol: position.symbol,
      };
    });
}
