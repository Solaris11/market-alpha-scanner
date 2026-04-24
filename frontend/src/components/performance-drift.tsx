"use client";

import { useMemo, useState } from "react";
import { compact, formatNumber } from "@/lib/format";
import type { IntradayDriftRow } from "@/lib/types";

type Props = {
  rows: IntradayDriftRow[];
  forwardReturnsReady: boolean;
};

const RATING_RANK: Record<string, number> = {
  PASS: 0,
  WATCH: 1,
  ACTIONABLE: 2,
  TOP: 3,
};

function ratingRank(value: unknown) {
  return RATING_RANK[String(value ?? "").toUpperCase()] ?? null;
}

function ratingDirection(row: IntradayDriftRow) {
  const first = ratingRank(row.first_rating);
  const latest = ratingRank(row.latest_rating);
  if (first === null || latest === null || first === latest) return "flat";
  return latest > first ? "upgrade" : "downgrade";
}

function percent(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function signedNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

function metricSymbol(row: IntradayDriftRow | undefined, field: "score_change" | "price_change_pct") {
  if (!row) return "N/A";
  const value = field === "price_change_pct" ? percent(row[field]) : signedNumber(row[field]);
  return `${row.symbol} ${value}`;
}

export function PerformanceDrift({ rows, forwardReturnsReady }: Props) {
  const [symbolSearch, setSymbolSearch] = useState("");
  const [onlyUpgrades, setOnlyUpgrades] = useState(false);
  const [onlyScoreGainers, setOnlyScoreGainers] = useState(false);
  const [minimumScoreChange, setMinimumScoreChange] = useState("");

  const summary = useMemo(() => {
    const withScore = rows.filter((row) => typeof row.score_change === "number");
    const withPrice = rows.filter((row) => typeof row.price_change_pct === "number");
    return {
      biggestScoreGain: [...withScore].sort((a, b) => (b.score_change ?? 0) - (a.score_change ?? 0))[0],
      biggestScoreDrop: [...withScore].sort((a, b) => (a.score_change ?? 0) - (b.score_change ?? 0))[0],
      biggestPriceGain: [...withPrice].sort((a, b) => (b.price_change_pct ?? 0) - (a.price_change_pct ?? 0))[0],
      biggestPriceDrop: [...withPrice].sort((a, b) => (a.price_change_pct ?? 0) - (b.price_change_pct ?? 0))[0],
      upgrades: rows.filter((row) => ratingDirection(row) === "upgrade").length,
      downgrades: rows.filter((row) => ratingDirection(row) === "downgrade").length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = symbolSearch.trim().toLowerCase();
    const minChange = Number(minimumScoreChange);
    const hasMinChange = minimumScoreChange.trim() !== "" && Number.isFinite(minChange);

    return rows
      .filter((row) => {
        if (query) {
          const haystack = `${row.symbol} ${row.company_name ?? ""}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (onlyUpgrades && ratingDirection(row) !== "upgrade") return false;
        if (onlyScoreGainers && !(typeof row.score_change === "number" && row.score_change > 0)) return false;
        if (hasMinChange && Math.abs(row.score_change ?? 0) < minChange) return false;
        return true;
      })
      .sort((a, b) => Math.abs(b.score_change ?? 0) - Math.abs(a.score_change ?? 0));
  }, [minimumScoreChange, onlyScoreGainers, onlyUpgrades, rows, symbolSearch]);

  return (
    <section className="space-y-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Intraday Signal Drift</div>
        <h2 className="text-lg font-semibold text-slate-50">Saved Snapshot Movers</h2>
        {!forwardReturnsReady ? (
          <p className="mt-1 text-sm text-slate-400">Forward-return analysis is not ready yet. Showing intraday signal drift from saved snapshots.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Biggest Score Gain", value: metricSymbol(summary.biggestScoreGain, "score_change") },
          { label: "Biggest Score Drop", value: metricSymbol(summary.biggestScoreDrop, "score_change") },
          { label: "Biggest Price Gain", value: metricSymbol(summary.biggestPriceGain, "price_change_pct") },
          { label: "Biggest Price Drop", value: metricSymbol(summary.biggestPriceDrop, "price_change_pct") },
          { label: "Rating Upgrades", value: summary.upgrades.toLocaleString() },
          { label: "Rating Downgrades", value: summary.downgrades.toLocaleString() },
        ].map((metric) => (
          <div className="terminal-panel min-w-0 rounded-md px-3 py-2" key={metric.label}>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
            <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="terminal-panel rounded-md p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.3fr_auto_auto_0.8fr]">
          <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Symbol
            <input
              className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
              onChange={(event) => setSymbolSearch(event.target.value)}
              placeholder="Search symbol or company"
              value={symbolSearch}
            />
          </label>
          <label className="flex items-end gap-2 pb-1 text-xs text-slate-300">
            <input checked={onlyUpgrades} onChange={(event) => setOnlyUpgrades(event.target.checked)} type="checkbox" />
            Only upgrades
          </label>
          <label className="flex items-end gap-2 pb-1 text-xs text-slate-300">
            <input checked={onlyScoreGainers} onChange={(event) => setOnlyScoreGainers(event.target.checked)} type="checkbox" />
            Only score gainers
          </label>
          <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Min Score Change
            <input
              className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
              min="0"
              onChange={(event) => setMinimumScoreChange(event.target.value)}
              placeholder="0"
              type="number"
              value={minimumScoreChange}
            />
          </label>
        </div>
      </div>

      <div className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-700/70 bg-slate-950/70 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Intraday Movers · {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()}
        </div>
        <table className="w-full min-w-[1020px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 85 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 115 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 95 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left">Symbol</th>
              <th className="px-2 py-1.5 text-left">Company</th>
              <th className="px-2 py-1.5 text-right">Price %</th>
              <th className="px-2 py-1.5 text-right">Score Change</th>
              <th className="px-2 py-1.5 text-right">Latest Score</th>
              <th className="px-2 py-1.5 text-left">Rating Change</th>
              <th className="px-2 py-1.5 text-left">Action</th>
              <th className="px-2 py-1.5 text-right">Snapshots</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {filteredRows.length ? (
              filteredRows.map((row) => (
                <tr className="hover:bg-sky-400/5" key={row.symbol}>
                  <td className="px-2 py-1.5 font-mono font-semibold text-sky-200">{row.symbol}</td>
                  <td className="truncate px-2 py-1.5 text-slate-400" title={row.company_name ?? ""}>
                    {compact(row.company_name || "—", 48)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-200">{percent(row.price_change_pct)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-200">{signedNumber(row.score_change)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-emerald-200">{formatNumber(row.latest_score)}</td>
                  <td className="truncate px-2 py-1.5 text-slate-300">
                    {row.first_rating ?? "N/A"} → {row.latest_rating ?? "N/A"}
                  </td>
                  <td className="truncate px-2 py-1.5 text-slate-300">{row.latest_action ?? "N/A"}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-slate-400">{row.snapshot_count.toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-6 text-center text-slate-500" colSpan={8}>
                  No intraday movers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
