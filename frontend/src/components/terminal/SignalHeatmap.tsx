import Link from "next/link";
import type { RankingRow } from "@/lib/types";
import { gaugePercent } from "@/lib/ui/gauge-utils";
import { SectionTitle } from "./ui/SectionTitle";
import { GlassPanel } from "./ui/GlassPanel";

function heatColor(score: number) {
  if (score >= 80) return "bg-emerald-400/80 shadow-[0_0_16px_rgba(52,211,153,0.35)]";
  if (score >= 65) return "bg-cyan-400/75";
  if (score >= 50) return "bg-amber-300/75";
  return "bg-rose-400/75";
}

export function SignalHeatmap({ rows }: { rows: RankingRow[] }) {
  return (
    <GlassPanel className="p-4">
      <SectionTitle eyebrow="Signal Heatmap" title="Scanner Conviction" meta={`${rows.length} names`} />
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {rows.slice(0, 40).map((row) => {
          const score = gaugePercent(row.final_score);
          return (
            <Link className={`rounded-xl p-2 text-center transition-all duration-200 hover:scale-[1.03] ${heatColor(score)}`} href={`/symbol/${row.symbol}`} key={row.symbol}>
              <div className="font-mono text-xs font-bold text-slate-950">{row.symbol}</div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-900">{Math.round(score)}</div>
            </Link>
          );
        })}
      </div>
    </GlassPanel>
  );
}
