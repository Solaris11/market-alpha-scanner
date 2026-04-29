"use client";

import { useMemo } from "react";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import type { RankingRow, ScannerScalar } from "@/lib/types";
import { firstNumber } from "@/lib/ui/formatters";
import { AICopilotPanel } from "./AICopilotPanel";
import { ConvictionTimeline } from "./ConvictionTimeline";
import { HistoricalEdgeCard } from "./HistoricalEdgeCard";
import { PaperContextCard } from "./PaperContextCard";
import { SymbolChart } from "./SymbolChart";
import { SymbolDecisionHero } from "./SymbolDecisionHero";
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
  priceSeries,
  paperPositions,
  paperEvents,
}: {
  edgeProof: HistoricalEdgeProof;
  row: RankingRow;
  history: SignalHistoryPoint[];
  priceSeries: Record<string, ScannerScalar>[];
  paperPositions: PaperPositionRow[];
  paperEvents: PaperTradeEventRow[];
}) {
  const entry = firstNumber(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price) ?? Number(row.price ?? 0);
  const stop = firstNumber(row.stop_loss ?? row.invalidation_level) ?? Math.max(0, entry * 0.95);
  const target = firstNumber(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price) ?? entry * 1.08;
  const symbol = row.symbol.toUpperCase();
  const symbolPositions = paperPositions.filter((position) => position.symbol.toUpperCase() === symbol);
  const openPaper = symbolPositions.filter((position) => position.status === "OPEN");
  const symbolEvents = paperEvents.filter((event) => event.symbol.toUpperCase() === symbol).slice(0, 12);
  const markers = useMemo(
    () => history.map((point) => ({ time: point.timestamp, label: point.final_decision, tone: point.final_decision === "ENTER" ? "enter" as const : point.final_decision === "EXIT" ? "exit" as const : "wait" as const })),
    [history],
  );

  return (
    <div className="space-y-5">
      <SymbolDecisionHero row={row} />

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
      <ConvictionTimeline points={history} />

      <GlassPanel className="p-6">
        <SectionTitle eyebrow="Chart" title="Price and Signal Markers" />
        <div className="mt-5">
          <SymbolChart priceSeries={priceSeries} markers={markers} />
        </div>
      </GlassPanel>
    </div>
  );
}
