import Link from "next/link";
import type { RankingRow } from "@/lib/types";
import { actionFor, compact, formatNumber } from "@/lib/format";
import { Badge } from "./badge";

type Props = {
  rows: RankingRow[];
  highlight?: boolean;
  limit?: number;
};

export function RankingTable({ rows, highlight = false, limit }: Props) {
  const visibleRows = typeof limit === "number" ? rows.slice(0, limit) : rows;

  if (!visibleRows.length) {
    return <div className="border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-500">No scanner rows available.</div>;
  }

  return (
    <div className="terminal-panel overflow-hidden rounded-md">
      <div className="terminal-grid border-b border-slate-700/70 bg-slate-950/70 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <div>Symbol</div>
        <div>Company</div>
        <div>Asset</div>
        <div>Sector</div>
        <div className="text-right">Price</div>
        <div className="text-right">Score</div>
        <div>Rating</div>
        <div>Action</div>
      </div>
      <div className="divide-y divide-slate-800/90">
        {visibleRows.map((row, index) => (
          <div
            className={`terminal-grid items-center px-2 py-1.5 text-xs transition-colors hover:bg-sky-400/5 ${
              highlight && index < 3 ? "bg-sky-400/[0.035]" : "bg-transparent"
            }`}
            key={`${row.symbol}-${index}`}
          >
            <Link className="font-semibold text-sky-200 hover:text-sky-100" href={`/symbol/${row.symbol}`}>
              {row.symbol}
            </Link>
            <div className="truncate pr-3 text-slate-400" title={row.company_name || ""}>
              {compact(row.company_name || "—", 56)}
            </div>
            <div className="truncate text-slate-300">{row.asset_type || "—"}</div>
            <div className="truncate pr-3 text-slate-400">{row.sector || "—"}</div>
            <div className="text-right font-mono text-slate-200">{formatNumber(row.price)}</div>
            <div className="text-right font-mono text-emerald-200">{formatNumber(row.final_score)}</div>
            <div className="min-w-0">
              <Badge value={row.rating || "N/A"} />
            </div>
            <div className="min-w-0 truncate">
              <Badge value={actionFor(row)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
