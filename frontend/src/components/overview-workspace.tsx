"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RankingTable } from "@/components/ranking-table";
import type { RankingSortDirection, RankingSortKey } from "@/components/ranking-table";
import { WatchlistPanel } from "@/components/watchlist-controls";
import { actionFor } from "@/lib/format";
import type { RankingRow } from "@/lib/types";

type Props = {
  alertRules: AlertRule[];
  ranking: RankingRow[];
  topCandidates: RankingRow[];
};

type AlertRule = {
  id: string;
  scope?: string;
  symbol?: string;
  type: string;
  channels: string[];
  enabled: boolean;
};

function uniqueOptions(rows: RankingRow[], key: keyof RankingRow) {
  return Array.from(new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function matchesText(value: unknown, query: string) {
  return String(value ?? "")
    .toLowerCase()
    .includes(query);
}

const NUMERIC_SORT_KEYS = new Set<RankingSortKey>(["price", "score"]);
const RATING_PRIORITY: Record<string, number> = {
  TOP: 0,
  ACTIONABLE: 1,
  WATCH: 2,
  PASS: 3,
};
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

function normalizeAction(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function priorityCompare(left: number | null, right: number | null, direction: RankingSortDirection) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "desc" ? left - right : right - left;
}

function valueForSort(row: RankingRow, key: RankingSortKey) {
  if (key === "symbol") return row.symbol;
  if (key === "company") return row.company_name ?? "";
  if (key === "asset") return row.asset_type ?? "";
  if (key === "sector") return row.sector ?? "";
  if (key === "price") return row.price;
  if (key === "score") return row.final_score;
  if (key === "rating") return row.rating ?? "";
  if (key === "action") return actionFor(row);
  return "";
}

function sortRows(rows: RankingRow[], key: RankingSortKey | null, direction: RankingSortDirection) {
  if (!key) return rows;

  return [...rows].sort((left, right) => {
    if (key === "rating") {
      return priorityCompare(RATING_PRIORITY[String(left.rating ?? "").toUpperCase()] ?? null, RATING_PRIORITY[String(right.rating ?? "").toUpperCase()] ?? null, direction);
    }
    if (key === "action") {
      return priorityCompare(ACTION_PRIORITY[normalizeAction(actionFor(left))] ?? null, ACTION_PRIORITY[normalizeAction(actionFor(right))] ?? null, direction);
    }
    if (NUMERIC_SORT_KEYS.has(key)) {
      const leftValue = typeof valueForSort(left, key) === "number" ? (valueForSort(left, key) as number) : null;
      const rightValue = typeof valueForSort(right, key) === "number" ? (valueForSort(right, key) as number) : null;
      if (leftValue === null && rightValue === null) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
    }

    const leftText = String(valueForSort(left, key) ?? "");
    const rightText = String(valueForSort(right, key) ?? "");
    if (!leftText && !rightText) return 0;
    if (!leftText) return 1;
    if (!rightText) return -1;
    return direction === "desc" ? rightText.localeCompare(leftText) : leftText.localeCompare(rightText);
  });
}

function alertTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function alertScopeLabel(value?: string) {
  if (value === "global") return "Global";
  if (value === "watchlist") return "Watchlist";
  return "Symbol";
}

function alertTarget(rule: AlertRule) {
  if (rule.scope === "global") return "All symbols";
  if (rule.scope === "watchlist") return "Watchlist";
  return rule.symbol || "—";
}

function ActiveAlertsPanel({ rules }: { rules: AlertRule[] }) {
  const visibleRules = useMemo(() => [...rules].sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.type.localeCompare(right.type)).slice(0, 8), [rules]);

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Active Alerts</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Alert Coverage</h2>
        </div>
        <Link className="whitespace-nowrap text-xs font-semibold text-sky-300 hover:text-sky-100" href="/alerts">
          Go to Alerts →
        </Link>
      </div>

      <div className="mt-3 divide-y divide-slate-800/80 text-xs">
        {visibleRules.length ? (
          visibleRules.map((rule) => (
            <div className="grid gap-2 py-2 md:grid-cols-[1.3fr_0.85fr_1fr_0.55fr_0.9fr]" key={rule.id}>
              <div className="truncate font-semibold text-slate-200" title={rule.id}>
                {alertTypeLabel(rule.type)}
              </div>
              <div className="truncate text-slate-400">{alertScopeLabel(rule.scope)}</div>
              <div className="truncate font-mono text-sky-200">{alertTarget(rule)}</div>
              <div className={rule.enabled ? "text-emerald-300" : "text-slate-500"}>{rule.enabled ? "On" : "Off"}</div>
              <div className="truncate text-slate-400">{rule.channels.join(", ") || "—"}</div>
            </div>
          ))
        ) : (
          <div className="py-3 text-slate-500">No alert rules configured.</div>
        )}
      </div>
    </section>
  );
}

export function OverviewWorkspace({ alertRules, ranking, topCandidates }: Props) {
  const [symbolSearch, setSymbolSearch] = useState("");
  const [assetType, setAssetType] = useState("");
  const [sector, setSector] = useState("");
  const [rating, setRating] = useState("");
  const [minimumScore, setMinimumScore] = useState("");
  const [sortKey, setSortKey] = useState<RankingSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<RankingSortDirection>("asc");

  const assetTypes = useMemo(() => uniqueOptions(ranking, "asset_type"), [ranking]);
  const sectors = useMemo(() => {
    const source = assetType ? ranking.filter((row) => String(row.asset_type ?? "") === assetType) : ranking;
    return uniqueOptions(source, "sector");
  }, [assetType, ranking]);
  const ratings = useMemo(() => uniqueOptions(ranking, "rating"), [ranking]);

  const filteredRows = useMemo(() => {
    const query = symbolSearch.trim().toLowerCase();
    const minScore = Number(minimumScore);
    const hasMinScore = minimumScore.trim() !== "" && Number.isFinite(minScore);

    return ranking.filter((row) => {
      if (query) {
        if (!matchesText(row.symbol, query) && !matchesText(row.company_name, query)) return false;
      }
      if (assetType && String(row.asset_type ?? "") !== assetType) return false;
      if (sector && String(row.sector ?? "") !== sector) return false;
      if (rating && String(row.rating ?? "") !== rating) return false;
      if (hasMinScore && (typeof row.final_score !== "number" || row.final_score < minScore)) return false;
      return true;
    });
  }, [assetType, minimumScore, ranking, rating, sector, symbolSearch]);
  const filteredTopCandidates = useMemo(() => {
    const visibleSymbols = new Set(filteredRows.map((row) => row.symbol));
    return topCandidates.filter((row) => visibleSymbols.has(row.symbol));
  }, [filteredRows, topCandidates]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDirection), [filteredRows, sortDirection, sortKey]);

  function resetFilters() {
    setSymbolSearch("");
    setAssetType("");
    setSector("");
    setRating("");
    setMinimumScore("");
    setSortKey(null);
    setSortDirection("asc");
  }

  function handleSort(key: RankingSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(NUMERIC_SORT_KEYS.has(key) ? "desc" : "asc");
  }

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px]">
      <section className="min-w-0">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Full Ranking</div>
            <h2 className="text-lg font-semibold text-slate-50">Scanner Table</h2>
          </div>
          <div className="whitespace-nowrap text-xs text-slate-500">
            {filteredRows.length.toLocaleString()} of {ranking.length.toLocaleString()} rows
          </div>
        </div>

        <div className="terminal-panel mb-3 rounded-md p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_0.85fr_0.75fr_auto]">
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Symbol
              <input
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSymbolSearch(event.target.value)}
                placeholder="Search symbol or company"
                value={symbolSearch}
              />
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Asset Type
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => {
                  setAssetType(event.target.value);
                  setSector("");
                }}
                value={assetType}
              >
                <option value="">All asset types</option>
                {assetTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Sector
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSector(event.target.value)}
                value={sector}
              >
                <option value="">All sectors</option>
                {sectors.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Rating
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setRating(event.target.value)}
                value={rating}
              >
                <option value="">All ratings</option>
                {ratings.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Min Score
              <input
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                min="0"
                onChange={(event) => setMinimumScore(event.target.value)}
                placeholder="0"
                type="number"
                value={minimumScore}
              />
            </label>

            <button
              className="self-end rounded border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200"
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>

        <RankingTable rows={sortedRows} emptyMessage="No matching symbols" sortDirection={sortDirection} sortKey={sortKey} onSort={handleSort} />
      </section>

      <aside className="space-y-3">
        <ActiveAlertsPanel rules={alertRules} />

        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Top Candidates</div>
            <h2 className="text-lg font-semibold text-slate-50">High Conviction</h2>
          </div>
          <RankingTable rows={filteredTopCandidates} highlight limit={10} emptyMessage="No matching symbols" />
        </section>

        <WatchlistPanel />
      </aside>
    </div>
  );
}
