import Link from "next/link";
import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { BestTradeResult } from "@/lib/trading/conviction";
import { computeConviction, shortReason, tradeLevels } from "@/lib/trading/conviction";
import type { EdgeLookup } from "@/lib/trading/conviction";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";

export function BestTradeNowCard({ best, edges = {}, regime }: { best: BestTradeResult; edges?: EdgeLookup; regime?: MarketRegime }) {
  if (!best) {
    return (
      <div data-onboarding-target="best-trade">
        <GlassPanel className="overflow-hidden p-6 md:p-8">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Top Setup</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">No research signal right now</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Market conditions: {cleanText(regime?.label, "not favorable").toUpperCase()} - wait for pullbacks or stronger confirmation.
          </p>
        </GlassPanel>
      </div>
    );
  }

  const row = best.row;
  const levels = tradeLevels(row);
  const edge = edges[row.symbol.toUpperCase()];
  const conviction = computeConviction(row, edge);

  return (
    <div data-onboarding-target="best-trade">
      <GlassPanel className="overflow-hidden p-6 shadow-[0_0_90px_rgba(34,211,238,0.12)] md:p-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Top Setup</div>
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
              <h2 className="min-w-0 font-mono text-4xl font-black tracking-tight text-slate-50 sm:text-5xl md:text-6xl">{row.symbol}</h2>
              <DecisionBadge className="px-4 py-2 text-sm sm:px-5 sm:text-base" value={row.final_decision} />
            </div>
            <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(row.company_name || row.sector, "Scanner signal")}</div>
            <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-100">{shortReason(row)}</p>
            <p className="mt-3 text-sm font-semibold text-cyan-200">This is the highest-conviction research setup in the current market.</p>
            <div className="mt-5 flex min-w-0 flex-wrap gap-3">
              <Link className="w-full rounded-full bg-cyan-300 px-5 py-2.5 text-center text-sm font-bold text-slate-950 transition-all duration-200 hover:bg-cyan-200 sm:w-auto" data-onboarding-target="trade-plan-entry" href={`/symbol/${row.symbol}`}>
                View Research Plan
              </Link>
              <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
                Confidence <span className="font-mono font-semibold text-slate-50">{best.confidence}</span>/100
              </div>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <HeroMetric label="Conviction" value={`${conviction.score} ${conviction.label}`} />
            <HeroMetric label="Score" value={formatNumber(row.final_score, 0)} />
            <HeroMetric label="Entry" value={formatMoney(levels.entry)} />
            <HeroMetric label="Stop" value={formatMoney(levels.stop)} tone="risk" />
            <HeroMetric label="Target" value={formatMoney(levels.target)} tone="reward" />
            <HeroMetric label="Price" value={formatMoney(row.price)} />
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function HeroMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "reward" | "risk" }) {
  const color = tone === "reward" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-slate-50";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-mono text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
