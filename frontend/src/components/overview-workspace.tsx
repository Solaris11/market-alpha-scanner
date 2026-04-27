"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RankingTable, signalLabelsForRow, signalPriorityForRow } from "@/components/ranking-table";
import type { RankingSortDirection, RankingSortKey } from "@/components/ranking-table";
import { WatchlistPanel } from "@/components/watchlist-controls";
import { actionFor } from "@/lib/format";
import type { RankingRow } from "@/lib/types";

type Props = {
  alertRules: AlertRule[];
  alertState?: AlertState;
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

type AlertStateEntry = {
  alert_id?: string;
  symbol?: string;
  last_sent_at?: string;
  last_trigger_value?: string;
  last_status?: string;
  last_entry_status?: string;
};

type AlertState = {
  alerts: Record<string, AlertStateEntry>;
};

function uniqueOptions(rows: RankingRow[], key: keyof RankingRow) {
  return Array.from(new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function matchesText(value: unknown, query: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .includes(query);
}

function rowMatchesSearch(row: RankingRow, query: string) {
  if (!query) return true;
  return [
    row.symbol,
    row.company_name,
    row.long_name,
    row.longName,
    row.short_name,
    row.shortName,
    row.display_name,
    row.displayName,
    row.name,
    row.sector,
  ].some((value) => matchesText(value, query));
}

const NUMERIC_SORT_KEYS = new Set<RankingSortKey>(["price", "score", "signals"]);
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
const SIGNAL_FILTER_OPTIONS = ["BUY ZONE", "NEAR ENTRY", "EXTENDED", "TP NEAR", "STOP RISK", "STOP HIT", "TOP", "ACTIONABLE", "WATCH"];
const RATING_FILTER_OPTIONS = ["TOP", "ACTIONABLE", "WATCH", "PASS"];
const ACTION_FILTER_OPTIONS = ["STRONG BUY", "BUY", "WAIT / HOLD", "SELL", "STRONG SELL"];

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
  if (key === "signals") return signalPriorityForRow(row);
  return "";
}

function sortRows(rows: RankingRow[], key: RankingSortKey | null, direction: RankingSortDirection) {
  if (!key) return rows;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((leftItem, rightItem) => {
      const left = leftItem.row;
      const right = rightItem.row;
      let result = 0;

      if (key === "rating") {
        result = priorityCompare(RATING_PRIORITY[String(left.rating ?? "").toUpperCase()] ?? null, RATING_PRIORITY[String(right.rating ?? "").toUpperCase()] ?? null, direction);
      } else if (key === "action") {
        result = priorityCompare(ACTION_PRIORITY[normalizeAction(actionFor(left))] ?? null, ACTION_PRIORITY[normalizeAction(actionFor(right))] ?? null, direction);
      } else if (NUMERIC_SORT_KEYS.has(key)) {
        const leftRaw = valueForSort(left, key);
        const rightRaw = valueForSort(right, key);
        const leftValue = typeof leftRaw === "number" && Number.isFinite(leftRaw) ? leftRaw : null;
        const rightValue = typeof rightRaw === "number" && Number.isFinite(rightRaw) ? rightRaw : null;
        if (leftValue === null && rightValue === null) result = 0;
        else if (leftValue === null) result = 1;
        else if (rightValue === null) result = -1;
        else result = direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
      } else {
        const leftText = String(valueForSort(left, key) ?? "").trim().toLowerCase();
        const rightText = String(valueForSort(right, key) ?? "").trim().toLowerCase();
        if (!leftText && !rightText) result = 0;
        else if (!leftText) result = 1;
        else if (!rightText) result = -1;
        else result = direction === "desc" ? rightText.localeCompare(leftText) : leftText.localeCompare(rightText);
      }

      return result || leftItem.index - rightItem.index;
    })
    .map((item) => item.row);
}

function filterRows(rows: RankingRow[], filters: { action: string; assetType: string; minimumScore: string; rating: string; sector: string; signal: string; symbolSearch: string }) {
  const query = filters.symbolSearch.trim().toLowerCase();
  const minScore = Number(filters.minimumScore);
  const hasMinScore = filters.minimumScore.trim() !== "" && Number.isFinite(minScore);
  const selectedAction = normalizeAction(filters.action);

  return rows.filter((row) => {
    if (!rowMatchesSearch(row, query)) return false;
    if (filters.assetType && String(row.asset_type ?? "") !== filters.assetType) return false;
    if (filters.sector && String(row.sector ?? "") !== filters.sector) return false;
    if (filters.rating && String(row.rating ?? "") !== filters.rating) return false;
    if (selectedAction && normalizeAction(actionFor(row)) !== selectedAction) return false;
    if (filters.signal && !signalLabelsForRow(row).includes(filters.signal)) return false;
    if (hasMinScore && (typeof row.final_score !== "number" || row.final_score < minScore)) return false;
    return true;
  });
}

function mergeRankingFallback(row: RankingRow, fallback?: RankingRow) {
  if (!fallback) return row;
  const merged: RankingRow = { ...fallback, ...row };
  for (const key of ["company_name", "asset_type", "sector", "rating", "action"] as const) {
    if (!String(merged[key] ?? "").trim() && fallback[key]) {
      merged[key] = fallback[key];
    }
  }
  if (typeof merged.price !== "number" && typeof fallback.price === "number") merged.price = fallback.price;
  if (typeof merged.final_score !== "number" && typeof fallback.final_score === "number") merged.final_score = fallback.final_score;
  return merged;
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

function stateRuleId(key: string, state: AlertStateEntry) {
  return state.alert_id || key.split(":")[0];
}

function stateSymbol(key: string, state: AlertStateEntry) {
  return state.symbol || key.split(":")[1] || "—";
}

function formatAlertTime(value?: string) {
  if (!value) return "—";
  return value.replace("T", " ").replace("Z", " UTC");
}

function ActiveAlertRulesPanel({ rules }: { rules: AlertRule[] }) {
  const visibleRules = useMemo(() => [...rules].filter((rule) => rule.enabled).sort((left, right) => left.type.localeCompare(right.type)).slice(0, 8), [rules]);

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Active Alert Rules</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Rule Coverage</h2>
          <p className="mt-1 text-xs text-slate-500">These are enabled rules, not currently triggered alerts.</p>
        </div>
        <Link className="whitespace-nowrap text-xs font-semibold text-sky-300 hover:text-sky-100" href="/alerts">
          Go to Alerts →
        </Link>
      </div>

      <div className="mt-3 divide-y divide-slate-800/80 text-xs">
        <div className="hidden grid-cols-[1.3fr_0.85fr_1fr_0.55fr_0.9fr] gap-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:grid">
          <div>Rule Type</div>
          <div>Scope</div>
          <div>Target</div>
          <div>Status</div>
          <div>Channels</div>
        </div>
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
          <div className="py-3 text-slate-500">No enabled alert rules configured.</div>
        )}
      </div>
    </section>
  );
}

function RecentAlertEventsPanel({ rules, state }: { rules: AlertRule[]; state: AlertState }) {
  const ruleById = useMemo(() => {
    const map = new Map<string, AlertRule>();
    for (const rule of rules) map.set(rule.id, rule);
    return map;
  }, [rules]);
  const events = useMemo(() => {
    return Object.entries(state.alerts ?? {})
      .filter(([, entry]) => Boolean(entry.last_sent_at))
      .map(([key, entry]) => {
        const ruleId = stateRuleId(key, entry);
        return {
          key,
          rule: ruleById.get(ruleId),
          ruleId,
          symbol: stateSymbol(key, entry),
          time: entry.last_sent_at ?? "",
          triggerValue: entry.last_trigger_value,
          status: entry.last_status,
        };
      })
      .sort((left, right) => right.time.localeCompare(left.time))
      .slice(0, 8);
  }, [ruleById, state.alerts]);

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Recent Alert Events</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Triggered Alerts</h2>
        </div>
        <Link className="whitespace-nowrap text-xs font-semibold text-sky-300 hover:text-sky-100" href="/alerts">
          Review →
        </Link>
      </div>
      <div className="mt-3 divide-y divide-slate-800/80 text-xs">
        {events.length ? (
          events.map((event) => (
            <div className="grid gap-2 py-2 md:grid-cols-[1.1fr_0.75fr_1.4fr_0.8fr]" key={event.key}>
              <div className="truncate font-semibold text-slate-200">{alertTypeLabel(event.rule?.type ?? event.ruleId)}</div>
              <div className="truncate font-mono text-sky-200">{event.symbol}</div>
              <div className="truncate text-slate-400">{formatAlertTime(event.time)}</div>
              <div className="truncate text-slate-500">{event.status || event.triggerValue || "sent"}</div>
            </div>
          ))
        ) : (
          <div className="py-3 text-slate-500">No recent triggered alerts.</div>
        )}
      </div>
    </section>
  );
}

export function OverviewWorkspace({ alertRules, alertState = { alerts: {} }, ranking, topCandidates }: Props) {
  const [symbolSearch, setSymbolSearch] = useState("");
  const [assetType, setAssetType] = useState("");
  const [sector, setSector] = useState("");
  const [rating, setRating] = useState("");
  const [action, setAction] = useState("");
  const [signal, setSignal] = useState("");
  const [minimumScore, setMinimumScore] = useState("");
  const [sortKey, setSortKey] = useState<RankingSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<RankingSortDirection>("desc");
  const [topSortKey, setTopSortKey] = useState<RankingSortKey | null>(null);
  const [topSortDirection, setTopSortDirection] = useState<RankingSortDirection>("desc");
  const [showAllRankingRows, setShowAllRankingRows] = useState(false);

  const assetTypes = useMemo(() => uniqueOptions(ranking, "asset_type"), [ranking]);
  const sectors = useMemo(() => {
    const source = assetType ? ranking.filter((row) => String(row.asset_type ?? "") === assetType) : ranking;
    return uniqueOptions(source, "sector");
  }, [assetType, ranking]);
  const rankingBySymbol = useMemo(() => {
    const map = new Map<string, RankingRow>();
    for (const row of ranking) {
      const symbol = String(row.symbol ?? "").trim().toUpperCase();
      if (symbol) map.set(symbol, row);
    }
    return map;
  }, [ranking]);

  const activeFilters = useMemo(() => ({ action, assetType, minimumScore, rating, sector, signal, symbolSearch }), [action, assetType, minimumScore, rating, sector, signal, symbolSearch]);
  const filteredRows = useMemo(() => filterRows(ranking, activeFilters), [activeFilters, ranking]);
  const enrichedTopCandidates = useMemo(() => {
    return topCandidates.map((row) => mergeRankingFallback(row, rankingBySymbol.get(String(row.symbol ?? "").trim().toUpperCase())));
  }, [rankingBySymbol, topCandidates]);
  const filteredTopCandidates = useMemo(() => {
    return filterRows(enrichedTopCandidates, activeFilters);
  }, [activeFilters, enrichedTopCandidates]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDirection), [filteredRows, sortDirection, sortKey]);
  const sortedTopCandidates = useMemo(() => sortRows(filteredTopCandidates, topSortKey, topSortDirection), [filteredTopCandidates, topSortDirection, topSortKey]);

  function resetFilters() {
    setSymbolSearch("");
    setAssetType("");
    setSector("");
    setRating("");
    setAction("");
    setSignal("");
    setMinimumScore("");
    setSortKey(null);
    setSortDirection("desc");
    setTopSortKey(null);
    setTopSortDirection("desc");
    setShowAllRankingRows(false);
  }

  function handleSort(key: RankingSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  }

  function handleTopSort(key: RankingSortKey) {
    if (topSortKey === key) {
      setTopSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setTopSortKey(key);
    setTopSortDirection("desc");
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
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_0.9fr_0.85fr_0.9fr_0.95fr_0.7fr_auto]">
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
                {RATING_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Action
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setAction(event.target.value)}
                value={action}
              >
                <option value="">All actions</option>
                {ACTION_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Signal
              <select
                className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSignal(event.target.value)}
                value={signal}
              >
                <option value="">All signals</option>
                {SIGNAL_FILTER_OPTIONS.map((option) => (
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

        <RankingTable rows={sortedRows} emptyMessage="No matching symbols" limit={showAllRankingRows ? undefined : 100} sortDirection={sortDirection} sortKey={sortKey} onSort={handleSort} />
        {sortedRows.length > 100 ? (
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Showing {showAllRankingRows ? sortedRows.length.toLocaleString() : "100"} of {sortedRows.length.toLocaleString()} rows</span>
            <button className="rounded border border-slate-700/80 px-2 py-1 font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={() => setShowAllRankingRows((current) => !current)} type="button">
              {showAllRankingRows ? "Show less" : "Show more"}
            </button>
          </div>
        ) : null}
      </section>

      <aside className="space-y-3">
        <ActiveAlertRulesPanel rules={alertRules} />
        <RecentAlertEventsPanel rules={alertRules} state={alertState} />

        <section>
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Top Candidates</div>
            <h2 className="text-lg font-semibold text-slate-50">High Conviction</h2>
          </div>
          <RankingTable rows={sortedTopCandidates} highlight limit={10} emptyMessage="No matching symbols" sortDirection={topSortDirection} sortKey={topSortKey} onSort={handleTopSort} />
        </section>

        <WatchlistPanel />
      </aside>
    </div>
  );
}
