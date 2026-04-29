import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { RankingRow } from "@/lib/types";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function countDecision(rows: RankingRow[], value: string) {
  return rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === value).length;
}

export function MarketRegimeRadar({ regime, rows }: { regime: MarketRegime; rows: RankingRow[] }) {
  const enter = countDecision(rows, "ENTER");
  const avoid = countDecision(rows, "AVOID");
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Market Regime Radar" title={regime.label} meta={regime.source} />
      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="relative mx-auto flex size-44 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(34,211,238,0.2),rgba(15,23,42,0.25)_55%,transparent_70%)]">
          <div className="absolute inset-5 rounded-full border border-cyan-300/20" />
          <div className="absolute inset-10 rounded-full border border-emerald-300/20" />
          <div className="text-center">
            <div className="font-mono text-3xl font-black text-slate-50">{Math.round(regime.confidence)}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Confidence</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-xs text-slate-500">Aggressive Entries</div>
            <div className="mt-2"><DecisionBadge value={regime.aggressiveEntriesAllowed ? "ENTER" : "WAIT_PULLBACK"} /></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Breadth <span className="font-semibold text-slate-100">{regime.breadth}</span> · Leadership <span className="font-semibold text-slate-100">{regime.leadership}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-xs text-slate-500">Strongest</div>
            <div className="mt-2 flex flex-wrap gap-1 text-xs text-emerald-200">{regime.strongestSectors.map((item) => <span className="rounded-full bg-emerald-400/10 px-2 py-1" key={item}>{item}</span>)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-xs text-slate-500">Weakest</div>
            <div className="mt-2 flex flex-wrap gap-1 text-xs text-rose-200">{regime.weakestSectors.map((item) => <span className="rounded-full bg-rose-400/10 px-2 py-1" key={item}>{item}</span>)}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
        <div className="rounded-xl bg-white/[0.04] p-2">ENTER <span className="font-mono text-emerald-300">{enter}</span></div>
        <div className="rounded-xl bg-white/[0.04] p-2">AVOID <span className="font-mono text-rose-300">{avoid}</span></div>
        <div className="rounded-xl bg-white/[0.04] p-2">Rows <span className="font-mono text-slate-100">{rows.length}</span></div>
      </div>
    </GlassPanel>
  );
}
