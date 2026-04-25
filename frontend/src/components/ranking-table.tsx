"use client";

import Link from "next/link";
import type { RankingRow } from "@/lib/types";
import { actionFor, compact, formatNumber } from "@/lib/format";
import { Badge } from "./badge";

export type RankingSortKey = "symbol" | "company" | "asset" | "sector" | "price" | "score" | "rating" | "action";
export type RankingSortDirection = "asc" | "desc";

type Props = {
  rows: RankingRow[];
  highlight?: boolean;
  limit?: number;
  emptyMessage?: string;
  sortKey?: RankingSortKey | null;
  sortDirection?: RankingSortDirection;
  onSort?: (key: RankingSortKey) => void;
};

const COLUMNS: { key: RankingSortKey; label: string; align?: "left" | "right" }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "company", label: "Company" },
  { key: "asset", label: "Asset" },
  { key: "sector", label: "Sector" },
  { key: "price", label: "Price", align: "right" },
  { key: "score", label: "Score", align: "right" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
];
const SIGNAL_TONES: Record<string, string> = {
  positive: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/35 bg-amber-400/10 text-amber-200",
  danger: "border-rose-400/35 bg-rose-400/10 text-rose-200",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  neutral: "border-slate-500/30 bg-slate-500/12 text-slate-200",
};

type SignalBadge = {
  label: string;
  tone: keyof typeof SIGNAL_TONES;
};

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumbers(value: unknown) {
  if (value === null || value === undefined) return [];
  return Array.from(String(value).replace(/,/g, "").replace(/[–—]/g, "-").matchAll(/(?<!\d)-?\d+(?:\.\d+)?/g)).map((match) => Number(match[0])).filter(Number.isFinite);
}

function rangeFrom(row: RankingRow, lowKey: string, highKey: string, textKeys: string[]) {
  const low = numeric(row[lowKey]);
  const high = numeric(row[highKey]);
  if (low !== null && high !== null) return [Math.min(low, high), Math.max(low, high)] as const;

  for (const key of textKeys) {
    const numbers = extractNumbers(row[key]);
    if (numbers.length >= 2) return [Math.min(numbers[0], numbers[1]), Math.max(numbers[0], numbers[1])] as const;
    if (numbers.length === 1) return [numbers[0], numbers[0]] as const;
  }

  if (low !== null || high !== null) {
    const value = low ?? high ?? null;
    return [value, value] as const;
  }

  return [null, null] as const;
}

function signalBadges(row: RankingRow): SignalBadge[] {
  const badges: SignalBadge[] = [];
  const price = numeric(row.price);
  const [buyLow, buyHigh] = rangeFrom(row, "buy_zone_low", "buy_zone_high", ["buy_zone", "entry_zone"]);
  const stop = numeric(row.stop_loss) ?? numeric(row.invalidation_level);
  const [takeProfitLow, takeProfitHigh] = rangeFrom(row, "take_profit_low", "take_profit_high", ["take_profit_zone", "conservative_target", "take_profit", "target"]);

  if (price !== null && buyLow !== null && buyHigh !== null && buyHigh > 0) {
    if (price >= buyLow && price <= buyHigh) {
      badges.push({ label: "BUY ZONE", tone: "positive" });
    } else if (price > buyHigh && price <= buyHigh * 1.02) {
      badges.push({ label: "NEAR ENTRY", tone: "warning" });
    } else if (price > buyHigh * 1.02) {
      badges.push({ label: "EXTENDED", tone: "warning" });
    }
  }

  const target = takeProfitLow ?? takeProfitHigh;
  if (price !== null && target !== null && target > 0) {
    if (price >= target) {
      badges.push({ label: "TP HIT", tone: "positive" });
    } else if ((target - price) / target <= 0.03) {
      badges.push({ label: "TP NEAR", tone: "warning" });
    }
  }

  if (price !== null && stop !== null && price > 0) {
    if (price <= stop) {
      badges.push({ label: "STOP HIT", tone: "danger" });
    } else if ((price - stop) / price <= 0.03) {
      badges.push({ label: "STOP RISK", tone: "danger" });
    }
  }

  const rating = String(row.rating ?? "").trim().toUpperCase();
  if (rating === "TOP") badges.push({ label: "TOP", tone: "positive" });
  else if (rating === "ACTIONABLE") badges.push({ label: "ACTIONABLE", tone: "info" });
  else if (rating === "WATCH") badges.push({ label: "WATCH", tone: "neutral" });

  return badges;
}

function SignalPill({ badge }: { badge: SignalBadge }) {
  return <span className={`inline-flex min-w-max items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${SIGNAL_TONES[badge.tone]}`}>{badge.label}</span>;
}

export function RankingTable({ rows, highlight = false, limit, emptyMessage = "No scanner rows available.", sortKey = null, sortDirection = "asc", onSort }: Props) {
  const visibleRows = typeof limit === "number" ? rows.slice(0, limit) : rows;

  if (!visibleRows.length) {
    return <div className="border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="terminal-panel overflow-x-auto rounded-md">
      <table className="w-full min-w-[1120px] table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: 190 }} />
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
            {COLUMNS.map((column) => {
              const active = sortKey === column.key;
              const indicator = active ? (sortDirection === "asc" ? "▲" : "▼") : "";
              return (
                <th className={`px-2 py-1.5 ${column.align === "right" ? "text-right" : "text-left"}`} key={column.key}>
                  {onSort ? (
                    <button
                      className={`inline-flex items-center gap-1 hover:text-sky-200 ${column.align === "right" ? "justify-end" : "justify-start"}`}
                      onClick={() => onSort(column.key)}
                      type="button"
                    >
                      <span>{column.label}</span>
                      {indicator ? <span className="text-sky-300">{indicator}</span> : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {visibleRows.map((row, index) => {
            const rowBadges = signalBadges(row);
            return (
              <tr
                className={`transition-colors hover:bg-sky-400/5 ${highlight && index < 3 ? "bg-sky-400/[0.035]" : "bg-transparent"}`}
                key={`${row.symbol}-${index}`}
              >
                <td className="px-2 py-1.5 align-middle">
                  <div className="flex flex-col gap-1">
                    <Link className="font-semibold text-sky-200 hover:text-sky-100" href={`/symbol/${row.symbol}`}>
                      {row.symbol}
                    </Link>
                    {rowBadges.length ? (
                      <div className="flex max-w-full flex-wrap gap-1">
                        {rowBadges.map((badge) => (
                          <SignalPill badge={badge} key={badge.label} />
                        ))}
                      </div>
                    ) : null}
                  </div>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
