"use client";

import { useMemo, useState } from "react";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { ConvictionTimelineModel } from "@/lib/trading/conviction-timeline-types";
import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { buildSignalTradeLevels, computeSignalLifecycle } from "@/lib/trading/signal-lifecycle";
import type { RankingRow, ScannerScalar } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import { AICopilotPanel } from "./AICopilotPanel";
import { ConvictionTimeline } from "./ConvictionTimeline";
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
  history,
  timeline,
  priceSeries,
  paperPositions,
  paperEvents,
}: {
  edgeProof: HistoricalEdgeProof;
  row: RankingRow;
  history: SignalHistoryPoint[];
  timeline: ConvictionTimelineModel;
  priceSeries: Record<string, ScannerScalar>[];
  paperPositions: PaperPositionRow[];
  paperEvents: PaperTradeEventRow[];
}) {
  const [showHistoricalMarkers, setShowHistoricalMarkers] = useState(false);
  const tradeLevels = useMemo(() => buildSignalTradeLevels(row), [row]);
  const lifecycle = useMemo(() => computeSignalLifecycle(row, tradeLevels), [row, tradeLevels]);
  const entry = tradeLevels.entry ?? finiteNumber(row.price) ?? 0;
  const stop = tradeLevels.stop ?? Math.max(0, entry * 0.95);
  const target = tradeLevels.target ?? entry * 1.08;
  const symbol = row.symbol.toUpperCase();
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
      <SymbolDecisionHero edge={edgeProof} row={row} />
      <SignalStatusCard lifecycle={lifecycle} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="space-y-5">
          <TradePlanCard row={row} />
          <HistoricalEdgeCard edge={edgeProof} />
          <WhyDecisionCard row={row} />
          <TechnicalSnapshotCard row={row} />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <AICopilotPanel signal={row} />
          <WhatIfSimulator defaults={{ accountSize: 10000, riskPct: 2, entry, stop, target }} />
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
