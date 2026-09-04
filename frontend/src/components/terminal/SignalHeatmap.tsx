import Link from "next/link";
import type { CSSProperties } from "react";
import type { RankingRow } from "@/lib/types";
import { CONVICTION_BANDS, convictionTileClass } from "@/lib/ui/conviction-bands";
import { gaugePercent } from "@/lib/ui/gauge-utils";
import { SectionTitle } from "./ui/SectionTitle";
import { GlassPanel } from "./ui/GlassPanel";

export function SignalHeatmap({ rows }: { rows: RankingRow[] }) {
  const visibleRows = rows.slice(0, 40);
  const deferredPaintStyle: CSSProperties = {
    containIntrinsicSize: "420px",
    contentVisibility: "auto",
  };

  return (
    <GlassPanel className="p-4" style={deferredPaintStyle}>
      <SectionTitle eyebrow="Signal Heatmap" title="Scanner Conviction" meta={`${rows.length} names`} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Conviction</span>
        {CONVICTION_BANDS.map((band) => (
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400" key={band.label}>
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${band.swatch}`} />
            {band.label}
          </span>
        ))}
      </div>
      {visibleRows.length === 0 ? (
        <div className="mt-4 grid min-h-[12rem] place-items-center rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 text-center text-sm leading-6 text-slate-400">
          No scanner rows in this snapshot yet. The heatmap fills in once a scan completes.
        </div>
      ) : (
      <div className="mt-4 grid min-h-[12rem] grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {visibleRows.map((row) => {
          const score = gaugePercent(row.final_score);
          return (
            <Link className={`rounded-xl p-2 text-center transition-all duration-200 hover:scale-[1.03] ${convictionTileClass(score)}`} href={`/symbol/${row.symbol}`} key={row.symbol}>
              <div className="font-mono text-xs font-bold text-slate-950">{row.symbol}</div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-900">{Math.round(score)}</div>
            </Link>
          );
        })}
      </div>
      )}
    </GlassPanel>
  );
}
