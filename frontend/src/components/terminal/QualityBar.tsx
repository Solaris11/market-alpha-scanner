import type { RankingRow } from "@/lib/types";
import { formatNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";
import { DecisionBadge } from "./DecisionBadge";

export function QualityBar({ row }: { row: RankingRow }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:grid-cols-5">
      <div><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Decision</div><div className="mt-1"><DecisionBadge value={row.final_decision} /></div></div>
      <Cell label="Quality" value={row.recommendation_quality} />
      <Cell label="Entry" value={row.entry_status} />
      <Cell label="Score" value={formatNumber(row.final_score)} />
      <Cell label="Confidence" value={formatNumber(row.quality_score ?? row.final_score)} />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: unknown }) {
  return <div><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-1 truncate text-sm font-semibold text-slate-100">{humanizeLabel(value)}</div></div>;
}
