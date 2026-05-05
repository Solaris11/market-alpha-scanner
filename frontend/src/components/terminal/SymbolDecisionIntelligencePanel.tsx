"use client";

import type { RankingRow } from "@/lib/types";
import { buildDecisionFactors, buildDecisionIntelligence } from "@/lib/trading/decision-intelligence";
import { confidenceTone } from "@/lib/trading/confidence";
import { formatNumber } from "@/lib/ui/formatters";
import { ConfidenceDonut } from "./ConfidenceDonut";
import { DecisionBadge } from "./DecisionBadge";
import { MiniPriceContextChart } from "./MiniPriceContextChart";
import type { ChartCandle } from "./SymbolChart";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function SymbolDecisionIntelligencePanel({ candles, row }: { candles: ChartCandle[]; row: RankingRow }) {
  const intelligence = buildDecisionIntelligence(row);
  const factors = buildDecisionFactors(row);
  const confidence = intelligence.confidence;
  const confidenceStyle = confidenceTone(confidence);

  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Setup Intelligence" title="Why This Decision Exists" meta="research context" />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(160px,0.55fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Decision</div>
              <div className="mt-3">
                <DecisionBadge className="px-4 py-2 text-sm" value={intelligence.decision} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Research only. Not financial advice.</p>
            </div>
            <ReadinessBar value={intelligence.readiness_score} />
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Factor Scores</div>
            <div className="grid gap-2 md:grid-cols-2">
              {factors.map((factor) => (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5" key={factor.label}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-100">{factor.label}</span>
                    <span className={factor.value >= 65 ? "text-emerald-200" : factor.value < 40 ? "text-rose-200" : "text-amber-100"}>{Math.round(factor.value)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${factor.value >= 65 ? "bg-emerald-300" : factor.value < 40 ? "bg-rose-300" : "bg-amber-300"}`} style={{ width: `${Math.max(4, Math.min(100, factor.value))}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{factor.value >= 65 ? "Constructive" : factor.value < 40 ? "Weak" : "Mixed"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <InsightList title="Positive Context" items={intelligence.why.positives} />
            <InsightList title="Negative Context" items={intelligence.why.negatives} />
            <InsightList title="Risk Context" items={intelligence.risks} />
            <InsightList title="What To Watch" items={intelligence.what_to_watch} />
            <InsightList title="Regime Impact" items={[intelligence.regime_impact]} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <MiniPriceContextChart candles={candles} entryContext={entryContext(row)} symbol={row.symbol} />
            <p className="mt-2 text-xs leading-5 text-slate-500">Chart context is for research only. Trade levels remain governed by the daily decision system.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence</div>
              <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${confidenceStyle.textClass}`}>{confidenceStyle.label}</div>
            </div>
            <div className="flex items-center justify-center">
              <ConfidenceDonut compact score={confidence} />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${confidenceStyle.barClass}`} style={{ width: `${Math.max(4, Math.min(100, confidence))}%` }} />
            </div>
            <div className="mt-2 text-[11px] leading-5 text-slate-500">Confidence reflects signal strength and data quality. Not a prediction.</div>
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

function ReadinessBar({ value }: { value: number }) {
  const tone = confidenceTone(value);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Readiness</div>
        <div className={`font-mono text-lg font-black ${tone.textClass}`}>{value}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone.barClass}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
      <div className="mt-2 text-[11px] leading-5 text-slate-500">Readiness combines confidence, vetoes, and data quality.</div>
    </div>
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

function entryContext(row: RankingRow): string {
  const low = numeric(row.entry_zone_low ?? row.buy_zone_low);
  const high = numeric(row.entry_zone_high ?? row.buy_zone_high);
  const entry = numeric(row.suggested_entry ?? row.entry_price ?? row.entry);
  if (low !== null && high !== null) return `${formatNumber(low)} - ${formatNumber(high)}`;
  if (entry !== null) return formatNumber(entry);
  return "No active entry context";
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
