"use client";

import { useMemo, useState } from "react";
import { compact, formatNumber } from "@/lib/format";
import { nextSortDirection, stableSortRows, type SortConfig, type SortDirection } from "@/lib/table-sort";
import type { IntradayDriftRow, SymbolHistoryRow } from "@/lib/types";

type Props = {
  rows: IntradayDriftRow[];
  forwardReturnsReady: boolean;
};

type SortKey = "symbol" | "company" | "price_change_pct" | "score_change" | "latest_score" | "rating_change" | "action" | "snapshot_count";

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

const NUMERIC_SORT_KEYS = new Set<SortKey>(["price_change_pct", "score_change", "latest_score", "snapshot_count"]);
const ACTION_PRIORITY: Record<string, number> = {
  "STRONG BUY": 0,
  BUY: 1,
  "WAIT / HOLD": 2,
  "WAIT/HOLD": 2,
  WAIT: 2,
  HOLD: 3,
  SELL: 4,
  "STRONG SELL": 5,
};
const RATING_PRIORITY: Record<string, number> = {
  TOP: 0,
  ACTIONABLE: 1,
  WATCH: 2,
  PASS: 3,
};

function sortValue(row: IntradayDriftRow, key: SortKey) {
  if (key === "symbol") return row.symbol;
  if (key === "company") return row.company_name ?? "";
  if (key === "price_change_pct") return row.price_change_pct;
  if (key === "score_change") return row.score_change;
  if (key === "latest_score") return row.latest_score;
  if (key === "rating_change") return row.latest_rating ?? "";
  if (key === "action") return row.latest_action ?? "";
  return row.snapshot_count;
}

function sortConfig(key: SortKey): SortConfig {
  if (key === "action") return { priority: ACTION_PRIORITY };
  if (key === "rating_change") return { priority: RATING_PRIORITY };
  if (NUMERIC_SORT_KEYS.has(key)) return { type: "number" };
  return { type: "string" };
}

function sortRows(rows: IntradayDriftRow[], key: SortKey | null, direction: SortDirection) {
  return stableSortRows(rows, key ?? "score_change", direction, sortValue, sortConfig);
}

function timestampMs(row: SymbolHistoryRow) {
  const ms = Date.parse(row.timestamp_utc);
  return Number.isFinite(ms) ? ms : null;
}

function DetailChart({ rows, field, label }: { rows: SymbolHistoryRow[]; field: "final_score" | "price"; label: string }) {
  const points = rows
    .map((row) => ({ time: timestampMs(row), value: typeof row[field] === "number" ? row[field] : null }))
    .filter((point): point is { time: number; value: number } => point.time !== null && point.value !== null);

  if (!points.length) {
    return <div className="rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">{label} data not available.</div>;
  }

  const width = 520;
  const height = 150;
  const padding = 22;
  const minTime = Math.min(...points.map((point) => point.time));
  const maxTime = Math.max(...points.map((point) => point.time));
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const timeSpan = Math.max(1, maxTime - minTime);
  const valueSpan = Math.max(1, maxValue - minValue);
  const plotted = points.map((point, index) => {
    if (points.length === 1) return { x: width / 2, y: height / 2, index };
    return {
      x: padding + ((point.time - minTime) / timeSpan) * (width - padding * 2),
      y: height - padding - ((point.value - minValue) / valueSpan) * (height - padding * 2),
      index,
    };
  });
  const path = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

  return (
    <div className="terminal-panel overflow-x-auto rounded-md p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="font-semibold uppercase tracking-[0.14em] text-sky-300">{label}</div>
        <div className="font-mono text-slate-400">
          {formatNumber(points[0].value)} → {formatNumber(points[points.length - 1].value)}
        </div>
      </div>
      <svg className="min-w-[520px]" height={height} role="img" viewBox={`0 0 ${width} ${height}`} width="100%">
        <title>{label} over time</title>
        <line stroke="rgba(148,163,184,0.22)" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line stroke="rgba(148,163,184,0.22)" x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <path d={path} fill="none" stroke={field === "price" ? "rgb(52,211,153)" : "rgb(125,211,252)"} strokeWidth="2" />
        {plotted.map((point) => (
          <circle cx={point.x} cy={point.y} fill="rgb(226,232,240)" key={point.index} r="2.8" />
        ))}
      </svg>
    </div>
  );
}

function SortHeader({
  label,
  sortDirection,
  sortKey,
  thisKey,
  onSort,
  align = "left",
}: {
  label: string;
  sortDirection: SortDirection;
  sortKey: SortKey | null;
  thisKey: SortKey;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === thisKey;
  return (
    <th className={`px-2 py-1.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 hover:text-sky-300" onClick={() => onSort(thisKey)} type="button">
        {label}
        {active ? <span>{sortDirection === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

export function PerformanceDrift({ rows, forwardReturnsReady }: Props) {
  const [symbolSearch, setSymbolSearch] = useState("");
  const [onlyUpgrades, setOnlyUpgrades] = useState(false);
  const [onlyScoreGainers, setOnlyScoreGainers] = useState(false);
  const [minimumScoreChange, setMinimumScoreChange] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("score_change");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<SymbolHistoryRow[]>([]);
  const [selectedHistoryLoading, setSelectedHistoryLoading] = useState(false);
  const [selectedHistoryError, setSelectedHistoryError] = useState("");

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

    const filtered = rows.filter((row) => {
        if (query) {
          const haystack = `${row.symbol} ${row.company_name ?? ""}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (onlyUpgrades && ratingDirection(row) !== "upgrade") return false;
        if (onlyScoreGainers && !(typeof row.score_change === "number" && row.score_change > 0)) return false;
        if (hasMinChange && Math.abs(row.score_change ?? 0) < minChange) return false;
        return true;
      });

    return sortRows(filtered, sortKey, sortDirection);
  }, [minimumScoreChange, onlyScoreGainers, onlyUpgrades, rows, sortDirection, sortKey, symbolSearch]);

  const selectedRow = useMemo(() => rows.find((row) => row.symbol === selectedSymbol) ?? null, [rows, selectedSymbol]);
  const visibleRows = useMemo(() => filteredRows.slice(0, 200), [filteredRows]);
  const latestHistoryRow = selectedHistoryRows[selectedHistoryRows.length - 1];
  const selectedDisplay = selectedRow ?? (latestHistoryRow ? {
    symbol: latestHistoryRow.symbol,
    company_name: latestHistoryRow.company_name,
    first_score: typeof selectedHistoryRows[0]?.final_score === "number" ? selectedHistoryRows[0].final_score : undefined,
    latest_score: typeof latestHistoryRow.final_score === "number" ? latestHistoryRow.final_score : undefined,
    score_change:
      typeof selectedHistoryRows[0]?.final_score === "number" && typeof latestHistoryRow.final_score === "number"
        ? latestHistoryRow.final_score - selectedHistoryRows[0].final_score
        : undefined,
    first_price: typeof selectedHistoryRows[0]?.price === "number" ? selectedHistoryRows[0].price : undefined,
    latest_price: typeof latestHistoryRow.price === "number" ? latestHistoryRow.price : undefined,
    price_change_pct:
      typeof selectedHistoryRows[0]?.price === "number" && selectedHistoryRows[0].price !== 0 && typeof latestHistoryRow.price === "number"
        ? (latestHistoryRow.price - selectedHistoryRows[0].price) / selectedHistoryRows[0].price
        : undefined,
    first_rating: selectedHistoryRows[0]?.rating,
    latest_rating: latestHistoryRow.rating,
    latest_action: latestHistoryRow.action ?? latestHistoryRow.composite_action ?? latestHistoryRow.mid_action ?? latestHistoryRow.short_action ?? latestHistoryRow.long_action,
    snapshot_count: selectedHistoryRows.length,
  } : null);

  async function selectSymbol(symbol: string) {
    setSelectedSymbol(symbol);
    setSelectedHistoryRows([]);
    setSelectedHistoryError("");
    setSelectedHistoryLoading(true);
    try {
      const response = await fetch(`/api/history/symbol/${encodeURIComponent(symbol)}`);
      const payload = (await response.json()) as { rows?: SymbolHistoryRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
      setSelectedHistoryRows((payload.rows ?? []).sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc))));
    } catch (error) {
      setSelectedHistoryError(error instanceof Error ? error.message : "Failed to load symbol history.");
    } finally {
      setSelectedHistoryLoading(false);
    }
  }

  function handleSort(nextKey: SortKey) {
    setSortDirection((current) => nextSortDirection(sortKey, nextKey, current, sortConfig(nextKey)));
    setSortKey(nextKey);
  }

  return (
    <section className="space-y-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Intraday Signal Drift</div>
        <h2 className="text-lg font-semibold text-slate-50">Intraday Signal Drift</h2>
        <p className="mt-1 text-sm text-slate-400">Shows largest changes in score and price between saved scan snapshots.</p>
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
          Intraday Movers · showing {visibleRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} filtered ({rows.length.toLocaleString()} total)
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
              <SortHeader label="Symbol" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="symbol" />
              <SortHeader label="Company" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="company" />
              <SortHeader align="right" label="Price %" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="price_change_pct" />
              <SortHeader align="right" label="Score Change" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="score_change" />
              <SortHeader align="right" label="Latest Score" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="latest_score" />
              <SortHeader label="Rating" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="rating_change" />
              <SortHeader label="Action" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="action" />
              <SortHeader align="right" label="Snapshots" onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} thisKey="snapshot_count" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <tr
                  className={`cursor-pointer hover:bg-sky-400/5 ${selectedSymbol === row.symbol ? "bg-sky-400/10" : ""}`}
                  key={row.symbol}
                  onClick={() => selectSymbol(row.symbol)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectSymbol(row.symbol);
                  }}
                  tabIndex={0}
                >
                  <td className="px-2 py-1.5 font-mono font-semibold text-sky-200">
                    <button
                      className="font-mono font-semibold text-sky-200 hover:text-sky-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectSymbol(row.symbol);
                      }}
                      type="button"
                    >
                      {row.symbol}
                    </button>
                  </td>
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

      {selectedSymbol && selectedDisplay ? (
        <section className="terminal-panel rounded-md p-4">
          <div className="flex flex-col gap-3 border-b border-slate-800 pb-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-2xl font-semibold text-slate-50">{selectedDisplay.symbol}</div>
              <div className="truncate text-sm text-slate-400">{selectedDisplay.company_name || "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              <div>
                <div className="uppercase tracking-[0.12em] text-slate-500">Latest Score</div>
                <div className="font-mono text-slate-100">{formatNumber(selectedDisplay.latest_score)}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.12em] text-slate-500">Rating</div>
                <div className="text-slate-100">{selectedDisplay.latest_rating ?? "N/A"}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.12em] text-slate-500">Action</div>
                <div className="text-slate-100">{selectedDisplay.latest_action ?? "N/A"}</div>
              </div>
              <button
                className="self-start rounded border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200"
                onClick={() => setSelectedSymbol(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            {[
              { label: "First Score", value: formatNumber(selectedDisplay.first_score) },
              { label: "Latest Score", value: formatNumber(selectedDisplay.latest_score) },
              { label: "Score Change", value: signedNumber(selectedDisplay.score_change) },
              { label: "First Price", value: formatNumber(selectedDisplay.first_price) },
              { label: "Latest Price", value: formatNumber(selectedDisplay.latest_price) },
              { label: "Price Change", value: percent(selectedDisplay.price_change_pct) },
              { label: "Snapshots", value: selectedDisplay.snapshot_count.toLocaleString() },
              { label: "Rating", value: `${selectedDisplay.first_rating ?? "N/A"} → ${selectedDisplay.latest_rating ?? "N/A"}` },
            ].map((metric) => (
              <div className="rounded border border-slate-800 bg-slate-950/50 p-2" key={metric.label}>
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</div>
                <div className="mt-1 truncate font-mono text-xs text-slate-100">{metric.value}</div>
              </div>
            ))}
          </div>

          {selectedHistoryLoading ? (
            <div className="mt-3 rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">Loading symbol history...</div>
          ) : selectedHistoryError ? (
            <div className="mt-3 rounded border border-rose-400/25 bg-rose-400/10 px-3 py-3 text-xs text-rose-100">{selectedHistoryError}</div>
          ) : selectedHistoryRows.length ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <DetailChart field="final_score" label="Final Score" rows={selectedHistoryRows} />
              <DetailChart field="price" label="Price" rows={selectedHistoryRows} />
            </div>
          ) : (
            <div className="mt-3 rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">No history available for this symbol.</div>
          )}
        </section>
      ) : null}
    </section>
  );
}
