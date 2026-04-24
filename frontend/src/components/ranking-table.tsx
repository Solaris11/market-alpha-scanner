import Link from "next/link";
import type { RankingRow } from "@/lib/types";
import { actionFor, compact, formatNumber } from "@/lib/format";
import { Badge } from "./badge";

type Props = {
  rows: RankingRow[];
  highlight?: boolean;
  limit?: number;
  emptyMessage?: string;
};

export function RankingTable({ rows, highlight = false, limit, emptyMessage = "No scanner rows available." }: Props) {
  const visibleRows = typeof limit === "number" ? rows.slice(0, limit) : rows;

  if (!visibleRows.length) {
    return <div className="border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="terminal-panel overflow-x-auto rounded-md">
      <table className="w-full min-w-[1000px] table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: 80 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 150 }} />
        </colgroup>
        <thead className="border-b border-slate-700/70 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-left">Symbol</th>
            <th className="px-2 py-1.5 text-left">Company</th>
            <th className="px-2 py-1.5 text-left">Asset</th>
            <th className="px-2 py-1.5 text-left">Sector</th>
            <th className="px-2 py-1.5 text-right">Price</th>
            <th className="px-2 py-1.5 text-right">Score</th>
            <th className="px-2 py-1.5 text-left">Rating</th>
            <th className="px-2 py-1.5 text-left">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {visibleRows.map((row, index) => (
            <tr
              className={`transition-colors hover:bg-sky-400/5 ${highlight && index < 3 ? "bg-sky-400/[0.035]" : "bg-transparent"}`}
              key={`${row.symbol}-${index}`}
            >
              <td className="px-2 py-1.5 align-middle">
                <Link className="font-semibold text-sky-200 hover:text-sky-100" href={`/symbol/${row.symbol}`}>
                  {row.symbol}
                </Link>
              </td>
              <td className="px-2 py-1.5 align-middle">
                <div className="truncate text-slate-400" title={row.company_name || ""}>
                  {compact(row.company_name || "—", 56)}
                </div>
              </td>
              <td className="truncate px-2 py-1.5 align-middle text-slate-300">{row.asset_type || "—"}</td>
              <td className="truncate px-2 py-1.5 align-middle text-slate-400">{row.sector || "—"}</td>
              <td className="px-2 py-1.5 text-right align-middle font-mono text-slate-200">{formatNumber(row.price)}</td>
              <td className="px-2 py-1.5 text-right align-middle font-mono text-emerald-200">{formatNumber(row.final_score)}</td>
              <td className="px-2 py-1.5 align-middle">
                <Badge value={row.rating || "N/A"} />
              </td>
              <td className="px-2 py-1.5 align-middle">
                <Badge value={actionFor(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
