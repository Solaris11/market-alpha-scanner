"use client";

import type { RankingRow } from "@/lib/types";
import { formatNumber } from "@/lib/ui/formatters";
import { SymbolChart, type ChartCandle } from "./SymbolChart";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

const VETO_WATCH_MAP: Record<string, string> = {
  DATA_STALE: "Wait for a fresh scanner run before trusting the research context.",
  HIGH_VOLATILITY: "Watch for volatility to cool and ranges to become more orderly.",
  LOW_CONFIDENCE_DATA: "Wait for cleaner provider coverage and stronger confirmation.",
  MISSING_PRICE_HISTORY: "Wait until enough price history is available for the scanner to score reliably.",
  POOR_RISK_REWARD: "Watch for a cleaner structure where risk and potential reward are better balanced.",
  WEAK_VOLUME_CONFIRMATION: "Watch for stronger volume confirmation before treating this as a serious setup.",
  MACRO_MISMATCH: "Watch for market regime and symbol behavior to align.",
};

export function SymbolDecisionIntelligencePanel({ candles, row }: { candles: ChartCandle[]; row: RankingRow }) {
  const factors = factorRows(row);
  const reasonCodes = reasonList(row.decision_reason_codes ?? row.decision_reason ?? row.quality_reason);
  const vetoes = reasonList(row.vetoes ?? row.veto_reason ?? row.decision_reason_codes);
  const confidence = numeric(row.confidence_score ?? row.final_score) ?? 0;

  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Setup Intelligence" title="Why This Decision Exists" meta="research context" />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Factor Scores</div>
            <div className="space-y-2">
              {factors.map((factor) => (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={factor.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-100">{factor.label}</span>
                    <span className={factor.value >= 65 ? "text-emerald-200" : factor.value < 40 ? "text-rose-200" : "text-amber-100"}>{Math.round(factor.value)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${factor.value >= 65 ? "bg-emerald-300" : factor.value < 40 ? "bg-rose-300" : "bg-amber-300"}`} style={{ width: `${Math.max(4, Math.min(100, factor.value))}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{factor.value >= 65 ? "Constructive input" : factor.value < 40 ? "Weak input" : "Mixed input"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <InsightList title="Decision Reasons" items={reasonCodes.length ? reasonCodes : ["Decision is based on current scanner score, risk filters, and data quality."]} />
            <InsightList title="What To Watch" items={whatToWatch(vetoes)} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mini Price Context</div>
            <SymbolChart candles={candles.slice(-80)} height={220} symbol={row.symbol} />
            <p className="mt-2 text-xs leading-5 text-slate-500">Chart context is for research only. Trade levels remain governed by the daily decision system.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence</div>
            <div className="text-3xl font-semibold text-slate-50">{Math.round(confidence)}</div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(4, Math.min(100, confidence))}%` }} />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Risk Snapshot</div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="ATR" value={formatNumber(row.atr)} />
              <Metric label="ATR %" value={percentLike(row.atr_pct ?? row.atr_percent)} />
              <Metric label="Volatility" value={percentLike(row.volatility ?? row.volatility_pct)} />
              <Metric label="Stop distance" value={stopDistance(row)} />
            </dl>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function InsightList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-300">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-mono text-slate-100">{value}</dd>
    </div>
  );
}

function factorRows(row: RankingRow): Array<{ label: string; value: number }> {
  return [
    { label: "Trend / Technical", value: numeric(row.technical_score) ?? numeric(row.trend_score) ?? 50 },
    { label: "Momentum", value: numeric(row.momentum_score) ?? numeric(row.technical_score) ?? 50 },
    { label: "Macro", value: numeric(row.macro_score) ?? 50 },
    { label: "Fundamental", value: numeric(row.fundamental_score) ?? 50 },
    { label: "Data Quality", value: numeric(row.data_quality_score) ?? (row.stale_data ? 35 : 75) },
    { label: "Risk", value: Math.max(0, 100 - (numeric(row.risk_penalty) ?? 0) * 5) },
  ];
}

function whatToWatch(vetoes: string[]): string[] {
  const mapped = vetoes.map((veto) => VETO_WATCH_MAP[veto.toUpperCase()] ?? null).filter((item): item is string => Boolean(item));
  if (mapped.length) return mapped;
  return [
    "Watch whether confidence improves on the next scan.",
    "Watch whether the symbol remains constructive while risk filters stay quiet.",
    "Use the daily action as the source of truth before considering any setup.",
  ];
}

function reasonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(cleanReason).filter(Boolean).slice(0, 8);
  const text = String(value ?? "").trim();
  if (!text || text === "[object Object]") return [];
  return text.split(/[,|;]/).map(cleanReason).filter(Boolean).slice(0, 8);
}

function cleanReason(value: string): string {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function stopDistance(row: RankingRow): string {
  const price = numeric(row.price);
  const stop = numeric(row.stop_loss ?? row.invalidation_level);
  if (price === null || stop === null || price <= 0) return "N/A";
  return `${Math.abs(((price - stop) / price) * 100).toFixed(1)}%`;
}

function percentLike(value: unknown): string {
  const parsed = numeric(value);
  if (parsed === null) return "N/A";
  const pct = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${pct.toFixed(1)}%`;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
