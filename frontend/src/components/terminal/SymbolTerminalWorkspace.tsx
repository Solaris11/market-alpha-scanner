"use client";

import { useMemo, useState } from "react";
import { useTradePlanEngine } from "@/hooks/useTradePlanEngine";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { DataFreshness } from "@/lib/data-health";
import type { PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { ConvictionTimelineModel } from "@/lib/trading/conviction-timeline-types";
import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import type { RiskPortfolioPosition } from "@/lib/trading/risk-veto";
import { buildSignalTradeLevels, computeSignalLifecycle } from "@/lib/trading/signal-lifecycle";
import type { RankingRow, ScannerScalar } from "@/lib/types";
import { AICopilotPanel } from "./AICopilotPanel";
import { ConvictionTimeline } from "./ConvictionTimeline";
import { CorrectionMapCard } from "./CorrectionMapCard";
import { ExecutionTicket } from "./ExecutionTicket";
import { HistoricalEdgeCard } from "./HistoricalEdgeCard";
import { PaperContextCard } from "./PaperContextCard";
import { SymbolChart, type ChartCandle, type ChartSignalMarker } from "./SymbolChart";
import { SymbolDecisionHero } from "./SymbolDecisionHero";
import { SignalStatusCard } from "./SignalStatusCard";
import { TechnicalSnapshotCard } from "./TechnicalSnapshotCard";
import { TradePlanCard } from "./TradePlanCard";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { WhyDecisionCard } from "./WhyDecisionCard";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function SymbolTerminalWorkspace({
  edgeProof,
  row,
  dataFreshness,
  history,
  timeline,
  priceSeries,
  paperPositions,
  paperEvents,
}: {
  edgeProof: HistoricalEdgeProof;
  row: RankingRow;
  dataFreshness: DataFreshness;
  history: SignalHistoryPoint[];
  timeline?: ConvictionTimelineModel;
  priceSeries: Record<string, ScannerScalar>[];
  paperPositions: PaperPositionRow[];
  paperEvents: PaperTradeEventRow[];
}) {
  const [showHistoricalMarkers, setShowHistoricalMarkers] = useState(false);
  const tradeLevels = useMemo(() => buildSignalTradeLevels(row), [row]);
  const lifecycle = useMemo(() => computeSignalLifecycle(row, tradeLevels), [row, tradeLevels]);
  const symbol = row.symbol.toUpperCase();
  const riskPortfolio = useMemo(() => buildRiskPortfolio(paperPositions, row.sector, symbol), [paperPositions, row.sector, symbol]);
  const tradeEngine = useTradePlanEngine(row, riskPortfolio);
  const symbolPositions = paperPositions.filter((position) => position.symbol.toUpperCase() === symbol);
  const openPaper = symbolPositions.filter((position) => position.status === "OPEN");
  const symbolEvents = paperEvents.filter((event) => event.symbol.toUpperCase() === symbol).slice(0, 12);
  const candles = useMemo(() => rowsToCandles(priceSeries), [priceSeries]);
  const chartSignals = useMemo(() => {
    if (!candles.length) return undefined;
    const markers = history.map(historyPointToMarker).filter((marker): marker is ChartSignalMarker => Boolean(marker));
    return markers.length ? markers : undefined;
  }, [candles.length, history]);

  return (
    <div className="space-y-5">
      <SymbolDecisionHero dataFreshness={dataFreshness} edge={edgeProof} row={row} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <AICopilotPanel engine={tradeEngine} signal={row} />
        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <WhatIfSimulator engine={tradeEngine} />
          <ExecutionTicket engine={tradeEngine} symbol={symbol} />
        </aside>
      </div>

      <SignalStatusCard lifecycle={lifecycle} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="space-y-5">
          <TradePlanCard engine={tradeEngine} row={row} />
          <CorrectionMapCard row={row} />
          <HistoricalEdgeCard edge={edgeProof} />
          <WhyDecisionCard row={row} />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <TechnicalSnapshotCard row={row} />
        </aside>
      </div>

      <PaperContextCard events={symbolEvents} openPositions={openPaper} positions={symbolPositions} symbol={symbol} />
      <ConvictionTimeline timeline={timeline} />

      <GlassPanel className="p-6">
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
            showHistoricalSignals={showHistoricalMarkers}
            signals={chartSignals}
            symbol={symbol}
            tradeLevels={tradeLevels}
          />
        </div>
      </GlassPanel>
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

function historyPointToMarker(point: SignalHistoryPoint): ChartSignalMarker | null {
  const decision = point.final_decision.toUpperCase();
  if (decision === "ENTER") return { time: point.timestamp, type: "ENTER", text: "ENTER" };
  if (decision === "EXIT") return { time: point.timestamp, type: "EXIT", text: "EXIT" };
  if (decision === "WAIT_PULLBACK" || decision === "WATCH") return { time: point.timestamp, type: "WAIT", text: decision === "WATCH" ? "WATCH" : "WAIT" };
  return null;
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
