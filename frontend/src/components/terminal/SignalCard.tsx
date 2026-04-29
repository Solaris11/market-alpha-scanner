import Link from "next/link";
import type { RankingRow } from "@/lib/types";
import { cleanText, formatMoney, formatNumber, formatPercent } from "@/lib/ui/formatters";
import { DecisionBadge } from "./DecisionBadge";

export function SignalCard({ row }: { row: RankingRow }) {
  return (
    <Link className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-cyan-950/30" href={`/symbol/${row.symbol}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-2xl font-semibold text-slate-50">{row.symbol}</div>
          <div className="mt-1 truncate text-xs text-slate-400">{cleanText(row.company_name, cleanText(row.sector, "Signal"))}</div>
        </div>
        <DecisionBadge value={row.final_decision ?? row.action} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Score</div>
          <div className="mt-1 font-mono text-slate-100">{formatNumber(row.final_score)}</div>
        </div>
        <div>
          <div className="text-slate-500">Price</div>
          <div className="mt-1 font-mono text-slate-100">{formatMoney(row.price)}</div>
        </div>
        <div>
          <div className="text-slate-500">Entry Dist.</div>
          <div className="mt-1 font-mono text-slate-100">{formatPercent(row.entry_distance_pct)}</div>
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-400">{cleanText(row.decision_reason ?? row.quality_reason ?? row.setup_type, "No decision reason available.")}</div>
    </Link>
  );
}
