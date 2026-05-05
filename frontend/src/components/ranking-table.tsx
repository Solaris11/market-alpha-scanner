"use client";

import Link from "next/link";
import type { RankingRow } from "@/lib/types";
import { actionFor, compact, formatNumber } from "@/lib/format";
import { cleanText } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel, normalizedToken } from "@/lib/ui/labels";

export type RankingSortKey = "symbol" | "company" | "asset" | "sector" | "price" | "score" | "rating" | "action" | "decision" | "quality" | "signals";
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

type SignalBadge = {
  label: string;
  tone: "positive" | "warning" | "danger" | "info" | "neutral";
};

const SIGNAL_PRIORITY: Record<string, number> = {
  "STOP HIT": 100,
  "STOP RISK": 90,
  "TP HIT": 85,
  "BUY ZONE": 80,
  "NEAR ENTRY": 70,
  "TP NEAR": 60,
  EXTENDED: 50,
  WATCH: 20,
};

const DECISION_STYLES: Record<string, string> = {
  ENTER: "border-emerald-300/50 bg-emerald-400/15 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.18)]",
  WAIT_PULLBACK: "border-amber-300/50 bg-amber-400/15 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.14)]",
  WATCH: "border-cyan-300/35 bg-cyan-400/10 text-cyan-100",
  AVOID: "border-rose-300/45 bg-rose-400/15 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.14)]",
  EXIT: "border-red-300/45 bg-red-500/15 text-red-100 shadow-[0_0_24px_rgba(239,68,68,0.16)]",
};

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumbers(value: unknown) {
  if (value === null || value === undefined) return [];
  return Array.from(String(value).replace(/,/g, "").replace(/[–—]/g, "-").matchAll(/(?<!\d)-?\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
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
    if (price >= buyLow && price <= buyHigh) badges.push({ label: "BUY ZONE", tone: "positive" });
    else if (price > buyHigh && price <= buyHigh * 1.02) badges.push({ label: "NEAR ENTRY", tone: "warning" });
    else if (price > buyHigh * 1.02) badges.push({ label: "EXTENDED", tone: "warning" });
  }

  const target = takeProfitLow ?? takeProfitHigh;
  if (price !== null && target !== null && target > 0) {
    if (price >= target) badges.push({ label: "TP HIT", tone: "positive" });
    else if ((target - price) / target <= 0.03) badges.push({ label: "TP NEAR", tone: "warning" });
  }

  if (price !== null && stop !== null && price > 0) {
    if (price <= stop) badges.push({ label: "STOP HIT", tone: "danger" });
    else if ((price - stop) / price <= 0.03) badges.push({ label: "STOP RISK", tone: "danger" });
  }

  return badges;
}

export function signalPriorityForRow(row: RankingRow) {
  const priorities = signalBadges(row).map((badge) => SIGNAL_PRIORITY[badge.label] ?? 0);
  return priorities.length ? Math.max(...priorities) : 0;
}

export function signalLabelsForRow(row: RankingRow) {
  return signalBadges(row).map((badge) => badge.label);
}

function money(value: unknown) {
  const parsed = numeric(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: parsed >= 100 ? 2 : 4 });
}

function percent(value: unknown) {
  const parsed = numeric(value);
  if (parsed === null) return "";
  if (Math.abs(parsed) < 0.0001) return "0.0%";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${(parsed * 100).toFixed(1)}%`;
}

function decisionText(row: RankingRow) {
  return decisionLabel(row.final_decision ?? row.action ?? "WATCH");
}

function decisionClass(row: RankingRow) {
  const key = normalizedToken(row.final_decision ?? row.action);
  return DECISION_STYLES[key] ?? DECISION_STYLES.WATCH;
}

function shortReason(row: RankingRow) {
  return cleanText(row.decision_reason ?? row.quality_reason ?? row.setup_type ?? row.market_regime, "No decision reason available.");
}

function suggestedEntry(row: RankingRow) {
  const decision = String(row.final_decision ?? "").trim().toUpperCase();
  const entry = cleanText(row.suggested_entry ?? row.buy_zone ?? row.entry_zone, "");
  const distance = decision === "WAIT_PULLBACK" ? percent(row.entry_distance_pct) : "";
  if (entry && distance) return `${entry} (${distance})`;
  return entry || "N/A";
}

function scoreValue(row: RankingRow) {
  const score = numeric(row.final_score);
  if (score === null) return 0;
  return Math.max(0, Math.min(100, score));
}

function scoreWidth(row: RankingRow) {
  return `${scoreValue(row)}%`;
}

function SortButton({ active, direction, label, onClick }: { active: boolean; direction: RankingSortDirection; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full border px-3 py-1.5 transition-all duration-200 ${
        active ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-400/40 hover:bg-white/5 hover:text-cyan-100"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
      {active ? <span className="ml-1 text-cyan-200">{direction === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}

export function RankingTable({ rows, highlight = false, limit, emptyMessage = "No scanner rows available.", sortKey = null, sortDirection = "asc", onSort }: Props) {
  const visibleRows = typeof limit === "number" ? rows.slice(0, limit) : rows;

  if (!visibleRows.length) {
    return <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
      {onSort ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sort</span>
          <SortButton active={sortKey === "score"} direction={sortDirection} label="Score" onClick={() => onSort("score")} />
          <SortButton active={sortKey === "decision"} direction={sortDirection} label="Decision" onClick={() => onSort("decision")} />
          <SortButton active={sortKey === "symbol"} direction={sortDirection} label="Symbol" onClick={() => onSort("symbol")} />
        </div>
      ) : null}

      {visibleRows.map((row, index) => {
        const signals = signalLabelsForRow(row);
        return (
          <article
            className={`group rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/[0.05] ${
              highlight && index < 3 ? "shadow-cyan-950/20" : ""
            }`}
            key={row.symbol || index}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_150px_130px_190px_130px] lg:items-center">
              <div className="min-w-0">
                <Link className="font-mono text-2xl font-semibold text-slate-50 transition-colors hover:text-cyan-100" href={`/symbol/${row.symbol}`}>
                  {row.symbol}
                </Link>
                <div className="mt-1 truncate text-sm text-slate-400" title={row.company_name || ""}>
                  {compact(row.company_name || row.sector || "Market signal", 72)}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Price</div>
                <div className="mt-1 font-mono text-sm text-slate-100">{money(row.price)}</div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Score</span>
                  <span className="font-mono text-slate-200">{formatNumber(row.final_score)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/80">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: scoreWidth(row) }} />
                </div>
              </div>

              <div className="min-w-0">
                <div className={`inline-flex max-w-full rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${decisionClass(row)}`}>
                  <span className="truncate">{decisionText(row)}</span>
                </div>
                <div className="mt-2 truncate text-xs text-slate-400" title={shortReason(row)}>
                  {shortReason(row)}
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <div className="text-left lg:text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Entry</div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-200" title={suggestedEntry(row)}>
                    {suggestedEntry(row)}
                  </div>
                </div>
                <Link className="inline-flex w-fit rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-all duration-200 hover:border-cyan-300/60 hover:bg-cyan-400/15" href={`/symbol/${row.symbol}`}>
                  View Details
                </Link>
              </div>
            </div>

            <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
              <summary className="cursor-pointer font-semibold uppercase tracking-[0.14em] text-slate-500">Advanced details</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><span className="text-slate-500">Asset</span><div className="mt-1 text-slate-200">{row.asset_type || "N/A"}</div></div>
                <div><span className="text-slate-500">Sector</span><div className="mt-1 text-slate-200">{row.sector || "N/A"}</div></div>
                <div><span className="text-slate-500">Decision</span><div className="mt-1 text-slate-200">{decisionText(row)}</div></div>
                <div><span className="text-slate-500">Scanner action context</span><div className="mt-1 text-slate-200">{humanizeLabel(actionFor(row))}</div></div>
                <div><span className="text-slate-500">Quality</span><div className="mt-1 text-slate-200">{humanizeLabel(row.recommendation_quality)}</div></div>
                <div><span className="text-slate-500">Entry status</span><div className="mt-1 text-slate-200">{humanizeLabel(row.entry_status)}</div></div>
                <div><span className="text-slate-500">Setup</span><div className="mt-1 text-slate-200">{humanizeLabel(row.setup_type)}</div></div>
                <div><span className="text-slate-500">Signal tags</span><div className="mt-1 text-slate-200">{signals.length ? signals.map((signal) => humanizeLabel(signal)).join(", ") : "N/A"}</div></div>
              </div>
            </details>
          </article>
        );
      })}
    </div>
  );
}
