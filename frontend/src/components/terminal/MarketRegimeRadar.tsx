import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { RankingRow } from "@/lib/types";
import { DecisionBadge } from "./DecisionBadge";
import { SectionTitle } from "./ui/SectionTitle";

function countDecision(rows: RankingRow[], value: string) {
  return rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === value).length;
}

export function MarketRegimeRadar({ regime, rows }: { regime: MarketRegime; rows: RankingRow[] }) {
  const enter = countDecision(rows, "ENTER");
  const avoid = countDecision(rows, "AVOID");
  const watch = countDecision(rows, "WATCH");
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/45 p-5 ring-1 ring-white/5">
      <SectionTitle eyebrow="Market Regime Radar" title={regime.label} meta={regime.source} />
      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="mx-auto flex size-44 max-w-full items-center justify-center rounded-full border border-cyan-300/20 bg-[radial-gradient(circle,rgba(34,211,238,0.18),rgba(15,23,42,0.24)_58%,rgba(2,6,23,0.2)_100%)] p-6 ring-1 ring-white/10">
          <div className="flex size-full items-center justify-center rounded-full border border-emerald-300/20 bg-slate-950/40 text-center">
            <div>
              <div className="font-mono text-3xl font-black text-slate-50">{Math.round(regime.confidence)}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Confidence</div>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-slate-500">Aggressive Entries</div>
            <div className="mt-2 max-w-full">
              <DecisionBadge value={regime.aggressiveEntriesAllowed ? "ENTER" : "WAIT_PULLBACK"} />
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-slate-500">Breadth</div>
            <div className="mt-1 break-words text-sm font-semibold text-slate-100">{regime.breadth}</div>
            <div className="mt-3 text-xs text-slate-500">Leadership</div>
            <div className="mt-1 break-words text-sm font-semibold text-slate-100">{regime.leadership}</div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-slate-500">Strongest</div>
            <div className="mt-2 flex max-w-full flex-wrap gap-2 text-xs text-emerald-200">{regime.strongestSectors.map((item) => <span className="max-w-full break-words rounded-full bg-emerald-400/10 px-2 py-1" key={item}>{item}</span>)}</div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-slate-500">Weakest</div>
            <div className="mt-2 flex max-w-full flex-wrap gap-2 text-xs text-rose-200">{regime.weakestSectors.map((item) => <span className="max-w-full break-words rounded-full bg-rose-400/10 px-2 py-1" key={item}>{item}</span>)}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-400">
        <div className="rounded-xl bg-white/[0.04] p-2">ENTER <span className="font-mono text-emerald-300">{enter}</span></div>
        <div className="rounded-xl bg-white/[0.04] p-2">WATCH <span className="font-mono text-cyan-300">{watch}</span></div>
        <div className="rounded-xl bg-white/[0.04] p-2">AVOID <span className="font-mono text-rose-300">{avoid}</span></div>
        <div className="rounded-xl bg-white/[0.04] p-2">Rows <span className="font-mono text-slate-100">{rows.length}</span></div>
      </div>
    </section>
  );
}
