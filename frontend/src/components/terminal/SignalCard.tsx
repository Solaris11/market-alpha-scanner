import Link from "next/link";
import { DataHealthIndicator } from "@/components/data-health-indicator";
import { freshnessFromTimestamp } from "@/lib/data-health";
import type { HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { computeConviction } from "@/lib/trading/conviction";
import { buildConvictionFragilityModel, compactStructuralLabel } from "@/lib/trading/conviction-fragility";
import type { RankingRow } from "@/lib/types";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { DecisionBadge } from "./DecisionBadge";

function boundedScore(value: unknown) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, parsed));
}

function riskRewardLabel(row: RankingRow) {
  const value = typeof row.risk_reward === "number" && Number.isFinite(row.risk_reward) ? row.risk_reward : null;
  return value === null ? "R/R N/A" : `R/R ${value.toFixed(2)}x`;
}

export function SignalCard({ edge, row }: { edge?: HistoricalEdgeProof; row: RankingRow }) {
  const score = boundedScore(row.final_score);
  const baseScore = numericField(row, "base_score") ?? numericField(row, "final_score_base") ?? row.technical_score ?? null;
  const macroAdjustment = numericField(row, "macro_context_adjustment_total") ?? row.regime_adjustment ?? null;
  const reward = typeof row.risk_reward === "number" && Number.isFinite(row.risk_reward) ? Math.max(0, Math.min(100, row.risk_reward * 22)) : score;
  const conviction = computeConviction(row, edge);
  const structural = buildConvictionFragilityModel(row);
  const dataFreshness = freshnessFromTimestamp(typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null);

  return (
    <Link className="group block w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.07] hover:shadow-cyan-950/30" href={`/symbol/${row.symbol}`}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-2xl font-semibold text-slate-50">{row.symbol}</div>
          <div className="mt-1 text-xs text-slate-400">{cleanText(row.company_name, cleanText(row.sector, "Signal"))}</div>
        </div>
        <DecisionBadge value={row.final_decision ?? row.action} />
      </div>
      <div className="mt-3">
        <DataHealthIndicator compact freshness={dataFreshness} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
        <div>
          <div className="text-slate-500">Context Score</div>
          <div className="mt-1 font-mono text-slate-100">{formatNumber(row.final_score)}</div>
        </div>
        <div>
          <div className="text-slate-500">Base</div>
          <div className="mt-1 font-mono text-slate-100">{formatNumber(baseScore)}</div>
        </div>
        <div>
          <div className="text-slate-500">Price</div>
          <div className="mt-1 font-mono text-slate-100">{formatMoney(row.price)}</div>
        </div>
        <div>
          <div className="text-slate-500">Conviction</div>
          <div className="mt-1 font-mono text-slate-100">{conviction.score}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] font-semibold text-cyan-200">Macro context {signedAdjustment(macroAdjustment)}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-2">
          <div className="text-slate-500">Structure</div>
          <div className="mt-1 text-[11px] font-semibold text-cyan-100">{compactStructuralLabel(structural)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-2">
          <div className="text-slate-500">Fragility</div>
          <div className="mt-1 font-mono text-[11px] font-semibold text-slate-100">{structural.fragility.score}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-900/80">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${score}%` }} />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-rose-500/20">
            <div className="h-full rounded-full bg-amber-300/80" style={{ width: `${reward}%` }} />
          </div>
          <div className="font-mono text-[10px] text-slate-400">{riskRewardLabel(row)}</div>
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-400">{humanizeInsightText(row.decision_reason ?? row.quality_reason ?? row.setup_type, "No decision reason available.")}</div>
    </Link>
  );
}

function numericField(row: RankingRow, key: string): number | null {
  const value = (row as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function signedAdjustment(value: number | null): string {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}`;
}
