"use client";

import { useMemo, useState } from "react";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { RankingRow, ScannerScalar } from "@/lib/types";
import { firstNumber, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { AICopilotPanel } from "./AICopilotPanel";
import { ConvictionTimeline } from "./ConvictionTimeline";
import { DecisionGauge } from "./DecisionGauge";
import { ExecutionTicket } from "./ExecutionTicket";
import { QualityBar } from "./QualityBar";
import { SymbolChart } from "./SymbolChart";
import { TechnicalExplainer } from "./TechnicalExplainer";
import { TechnicalGauge } from "./TechnicalGauge";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

const TABS = ["Decision", "Chart", "Technicals", "Context", "Paper"] as const;
type Tab = (typeof TABS)[number];

export function SymbolTerminalWorkspace({
  row,
  history,
  priceSeries,
  paperPositions,
  paperEvents,
}: {
  row: RankingRow;
  history: SignalHistoryPoint[];
  priceSeries: Record<string, ScannerScalar>[];
  paperPositions: PaperPositionRow[];
  paperEvents: PaperTradeEventRow[];
}) {
  const [tab, setTab] = useState<Tab>("Decision");
  const entry = firstNumber(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price) ?? Number(row.price ?? 0);
  const stop = firstNumber(row.stop_loss ?? row.invalidation_level) ?? Math.max(0, entry * 0.95);
  const target = firstNumber(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high) ?? entry * 1.08;
  const openPaper = paperPositions.filter((position) => position.symbol === row.symbol && position.status === "OPEN");
  const closedPaper = paperPositions.filter((position) => position.symbol === row.symbol && position.status === "CLOSED");
  const symbolEvents = paperEvents.filter((event) => event.symbol === row.symbol).slice(0, 12);
  const markers = useMemo(() => history.map((point) => ({ time: point.timestamp, label: point.final_decision, tone: point.final_decision === "ENTER" ? "enter" as const : point.final_decision === "EXIT" ? "exit" as const : "wait" as const })), [history]);

  return (
    <div className="space-y-4">
      <GlassPanel className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="font-mono text-5xl font-black tracking-tight text-slate-50">{row.symbol}</div>
            <div className="mt-2 text-sm text-slate-400">{row.company_name || row.sector || "Scanner signal"}</div>
            <div className="mt-4"><DecisionBadge value={row.final_decision ?? row.action} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniMetric label="Price" value={formatMoney(row.price)} />
            <MiniMetric label="Score" value={formatNumber(row.final_score)} />
            <MiniMetric label="Entry" value={formatMoney(entry)} />
            <MiniMetric label="R/R" value={`${formatNumber(row.risk_reward, 2)}R`} />
          </div>
        </div>
        <div className="mt-5"><QualityBar row={row} /></div>
      </GlassPanel>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${tab === item ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5"}`} key={item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      {tab === "Decision" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <SectionTitle eyebrow="Decision" title="Trade Plan" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <DecisionGauge finalDecision={row.final_decision} recommendationQuality={row.recommendation_quality} finalScore={row.final_score} />
                <TechnicalGauge score={typeof row.technical_score === "number" ? row.technical_score : Number(row.final_score ?? 0)} />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                <PlanItem label="Reason" value={row.decision_reason ?? row.quality_reason ?? "No decision reason available."} />
                <PlanItem label="Suggested Entry" value={formatMoney(entry)} />
                <PlanItem label="Stop" value={formatMoney(stop)} />
                <PlanItem label="Target" value={formatMoney(target)} />
              </div>
            </GlassPanel>
            <WhatIfSimulator defaults={{ accountSize: 10000, riskPct: 2, entry, stop, target }} />
          </div>
          <div className="space-y-4">
            <AICopilotPanel signal={row} />
            <ExecutionTicket symbol={row.symbol} qty={1} limitPrice={entry} stopPrice={stop} />
          </div>
        </div>
      ) : null}

      {tab === "Chart" ? <GlassPanel className="p-5"><SectionTitle eyebrow="Chart" title="Price and Signal Markers" /><div className="mt-4"><SymbolChart priceSeries={priceSeries} markers={markers} /></div></GlassPanel> : null}
      {tab === "Technicals" ? <GlassPanel className="p-5"><SectionTitle eyebrow="Technicals" title="Indicator Interpretation" /><div className="mt-4"><TechnicalExplainer row={row} /></div></GlassPanel> : null}
      {tab === "Context" ? <ContextPanel row={row} /> : null}
      {tab === "Paper" ? <PaperPanel openPaper={openPaper} closedPaper={closedPaper} events={symbolEvents} /> : null}
      <ConvictionTimeline points={history} />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-1 font-mono text-sm font-semibold text-slate-100">{value}</div></div>;
}

function PlanItem({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-1 text-slate-100">{String(value ?? "N/A")}</div></div>;
}

function ContextPanel({ row }: { row: RankingRow }) {
  const items = ["sector", "asset_type", "setup_type", "revenue_growth", "earnings_growth", "forward_pe", "headline_bias", "key_risk", "upside_driver"];
  return <GlassPanel className="p-5"><SectionTitle eyebrow="Context" title="Fundamental and Macro Context" /><div className="mt-4 grid gap-2 md:grid-cols-3">{items.map((key) => <PlanItem key={key} label={key.replace(/_/g, " ")} value={row[key]} />)}</div></GlassPanel>;
}

function PaperPanel({ openPaper, closedPaper, events }: { openPaper: PaperPositionRow[]; closedPaper: PaperPositionRow[]; events: PaperTradeEventRow[] }) {
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Paper" title="Paper Trading Memory" />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <PaperList title="Open Position" rows={openPaper.map((item) => `${item.symbol} ${formatNumber(item.quantity)} @ ${formatMoney(item.entry_price)} PnL ${formatMoney(item.unrealized_pnl)}`)} />
        <PaperList title="Closed Trades" rows={closedPaper.slice(0, 5).map((item) => `${item.close_reason ?? "CLOSED"} ${formatMoney(item.realized_pnl)}`)} />
        <PaperList title="Recent Events" rows={events.map((item) => `${item.event_type} ${item.event_reason ?? ""} ${formatMoney(item.price)}`)} />
      </div>
    </GlassPanel>
  );
}

function PaperList({ title, rows }: { title: string; rows: string[] }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><div className="text-sm font-semibold text-slate-100">{title}</div><div className="mt-3 space-y-2 text-xs text-slate-400">{rows.length ? rows.map((row) => <div key={row}>{row}</div>) : <div>No data yet.</div>}</div></div>;
}
