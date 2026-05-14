"use client";

import { useMemo, useState } from "react";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { IntelligenceGraphPanel } from "@/components/visual/IntelligenceGraphPanel";
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
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { buildSignalTradeLevels, computeSignalLifecycle } from "@/lib/trading/signal-lifecycle";
import type { IntradayDriftRow, RankingRow, ScannerScalar } from "@/lib/types";
import { AICopilotPanel } from "./AICopilotPanel";
import { AICognitionLayerPanel } from "./AICognitionLayerPanel";
import { AdaptiveLearningInsightPanel } from "./AdaptiveLearningInsightPanel";
import { ConvictionFragilityCard } from "./ConvictionFragilityCard";
import { ConvictionTimeline } from "./ConvictionTimeline";
import { CorrectionMapCard } from "./CorrectionMapCard";
import { DecisionJournalCard } from "./DecisionJournalCard";
import { ExecutionTicket } from "./ExecutionTicket";
import { ExecutionIntelligencePanel } from "./ExecutionIntelligencePanel";
import { EvidenceMaturityCard } from "./EvidenceMaturityCard";
import { HistoricalEdgeCard } from "./HistoricalEdgeCard";
import { InstitutionalIntelligencePanel } from "./InstitutionalIntelligencePanel";
import { IntradayRegimeDriftPanel } from "./IntradayRegimeDriftPanel";
import { MacroExchangeContextCard } from "./MacroExchangeContextCard";
import { MarketMemoryCard } from "./MarketMemoryCard";
import { MetaIntelligenceOperatingSystemPanel } from "./MetaIntelligenceOperatingSystemPanel";
import { NarrativeIntelligenceCard } from "./NarrativeIntelligenceCard";
import { PaperContextCard } from "./PaperContextCard";
import { PersonalizedIntelligenceCard } from "./PersonalizedIntelligenceCard";
import { SymbolChart, type ChartCandle, type ChartSignalMarker } from "./SymbolChart";
import { SymbolDecisionIntelligencePanel } from "./SymbolDecisionIntelligencePanel";
import { SymbolDecisionHero } from "./SymbolDecisionHero";
import { SignalStatusCard } from "./SignalStatusCard";
import { ScenarioIntelligencePanel } from "./ScenarioIntelligencePanel";
import { ShockPatternMemoryCard } from "./ShockPatternMemoryCard";
import { StrategyIntelligencePanel } from "./StrategyIntelligencePanel";
import { TechnicalSnapshotCard } from "./TechnicalSnapshotCard";
import { TradePlanCard } from "./TradePlanCard";
import { VerifiedEventContextCard } from "./VerifiedEventContextCard";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { WorkflowEvolutionPanel } from "./WorkflowEvolutionPanel";
import { WhyDecisionCard } from "./WhyDecisionCard";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

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
  const [showHistoricalMarkers, setShowHistoricalMarkers] = useState(false);
  const tradeLevels = useMemo(() => buildSignalTradeLevels(row), [row]);
  const lifecycle = useMemo(() => computeSignalLifecycle(row, tradeLevels), [row, tradeLevels]);
  const structuralQuality = useMemo(() => buildConvictionFragilityModel(row, { history, macroContext: macroContext ?? undefined, marketMemory }), [history, macroContext, marketMemory, row]);
  const symbol = row.symbol.toUpperCase();
  const relationshipGraph = useMemo(
    () => buildSymbolIntelligenceGraph({ contextRows, macroContext, marketMemory, row, shockPattern: shockPattern ?? null }),
    [contextRows, macroContext, marketMemory, row, shockPattern],
  );
  const cognitionLayer = useMemo(
    () => institutionalOpportunity
      ? buildAICognitionLayer({
          marketCondition: String(row.market_regime ?? "Current market"),
          rows: [institutionalOpportunity],
          scanUpdatedAt: dataFreshness.lastUpdated,
          workflowEvolution: workflowEvolution ?? null,
          generatedAt: dataFreshness.lastUpdated ?? undefined,
        })
      : null,
    [dataFreshness.lastUpdated, institutionalOpportunity, row.market_regime, workflowEvolution],
  );
  const riskPortfolio = useMemo(() => buildRiskPortfolio(paperPositions, row.sector, symbol), [paperPositions, row.sector, symbol]);
  const tradeEngine = useTradePlanEngine(row, riskPortfolio);
  const symbolPositions = paperPositions.filter((position) => position.symbol.toUpperCase() === symbol);
  const openPaper = symbolPositions.filter((position) => position.status === "OPEN");
  const symbolEvents = paperEvents.filter((event) => event.symbol.toUpperCase() === symbol).slice(0, 12);
  const candles = useMemo(() => rowsToCandles(priceSeries), [priceSeries]);
  const chartSignals = useMemo(() => {
    if (!candles.length) return undefined;
    const markers = buildChartSignalMarkers(history, row, dataFreshness, marketMemory, candles[candles.length - 1]?.time ?? null);
    return markers.length ? markers : undefined;
  }, [candles, dataFreshness, history, marketMemory, row]);
  const canTrade = globalDecision ? dailyActionAllowsTrade(globalDecision) : true;
  const noTradeCopy = globalDecision && !canTrade ? noTradeActionCopy(globalDecision) : null;
  const researchModeReason = noTradeCopy?.reason ?? "The global decision system is keeping this in research mode for now.";

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

      <div id="intelligence">
        <IntelligenceGraphPanel graph={relationshipGraph} />
      </div>
      {cognitionLayer ? <AICognitionLayerPanel compact model={cognitionLayer} /> : null}

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
            <ConvictionFragilityCard model={structuralQuality} />
          </ResponsiveAdvancedDetails>
        </div>
        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start" id="risk">
          <WhatIfSimulator canTrade={canTrade} engine={tradeEngine} researchModeReason={researchModeReason} />
          {canTrade ? <ExecutionTicket canTrade={canTrade} engine={tradeEngine} researchModeReason={researchModeReason} symbol={symbol} /> : null}
        </aside>
      </div>

      {canTrade ? <SignalStatusCard lifecycle={lifecycle} /> : null}

      <GlassPanel className="p-6" id="chart">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle eyebrow="Chart" title="Current Signal Map" />
          <button
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300 transition-all duration-200 hover:border-cyan-300/40 hover:bg-white/[0.07] hover:text-cyan-100"
            onClick={() => setShowHistoricalMarkers((value) => !value)}
            type="button"
          >
            {showHistoricalMarkers ? "Hide historical markers" : "Advanced: show historical markers"}
          </button>
        </div>
        <div className="mt-5">
          <SymbolChart
            candles={candles.length ? candles : undefined}
            dataSource="scanner validated OHLC history"
            interpretation={`${symbol} price history is shown with real stored candles. Use it with decision quality, risk pressure, replay context, and market regime before interpreting the setup.`}
            lastUpdated={typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null}
            showHistoricalSignals={showHistoricalMarkers}
            showResearchLevelsToggle
            signals={chartSignals}
            symbol={symbol}
            tradeLevels={canTrade ? tradeLevels : undefined}
          />
        </div>
      </GlassPanel>

      <ResponsiveAdvancedDetails
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
      </ResponsiveAdvancedDetails>
    </div>
  );
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

    const topAnalog = marketMemory.analogs[0];
    if (marketMemory.available && topAnalog) {
      markers.push({
        source: "market memory similarity",
        text: `${Math.round(topAnalog.similarityScore)}% REPLAY`,
        time: currentTime,
        type: "REPLAY",
        uncertainty: `Closest analog: ${topAnalog.symbol}. Similarity is context, not a prediction.`,
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
