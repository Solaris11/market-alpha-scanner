"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RankingTable, signalLabelsForRow, signalPriorityForRow } from "@/components/ranking-table";
import type { RankingSortDirection, RankingSortKey } from "@/components/ranking-table";
import { WatchlistPanel } from "@/components/watchlist-controls";
import { actionFor } from "@/lib/format";
import { nextSortDirection, stableSortRows, type SortConfig } from "@/lib/table-sort";
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
const QUALITY_FILTER_OPTIONS = ["TRADE_READY", "WAIT_PULLBACK", "LOW_EDGE", "AVOID"];
const QUALITY_PRIORITY: Record<string, number> = {
  TRADE_READY: 0,
  WAIT_PULLBACK: 1,
  LOW_EDGE: 2,
  AVOID: 3,
};
const DECISION_PRIORITY: Record<string, number> = {
  ENTER: 0,
  WAIT_PULLBACK: 1,
  WATCH: 2,
  AVOID: 3,
  EXIT: 4,
};

function normalizeAction(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeQuality(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
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
  if (key === "decision") return row.final_decision ?? "";
  if (key === "quality") return row.recommendation_quality ?? "";
  if (key === "signals") return signalPriorityForRow(row);
  return "";
}

function sortConfigForKey(key: RankingSortKey): SortConfig {
  if (key === "rating") return { priority: RATING_PRIORITY };
  if (key === "action") return { priority: ACTION_PRIORITY };
  if (key === "decision") return { priority: DECISION_PRIORITY };
  if (key === "quality") return { priority: QUALITY_PRIORITY };
  if (NUMERIC_SORT_KEYS.has(key)) return { type: "number" };
  return { type: "string" };
}

function sortRows(rows: RankingRow[], key: RankingSortKey | null, direction: RankingSortDirection) {
  return stableSortRows(rows, key, direction, valueForSort, sortConfigForKey);
}

function filterRows(rows: RankingRow[], filters: { action: string; assetType: string; minimumScore: string; quality: string; rating: string; sector: string; signal: string; symbolSearch: string }) {
  const rawQuery = filters.symbolSearch.trim();
  const query = rawQuery.toLowerCase();
  const exactSymbolQuery = rawQuery.toUpperCase();
  const hasExactSymbolMatch = Boolean(exactSymbolQuery) && rows.some((row) => String(row.symbol ?? "").trim().toUpperCase() === exactSymbolQuery);
  const minScore = Number(filters.minimumScore);
  const hasMinScore = filters.minimumScore.trim() !== "" && Number.isFinite(minScore);
  const selectedAction = normalizeAction(filters.action);
  const selectedQuality = normalizeQuality(filters.quality);

  return rows.filter((row) => {
    if (hasExactSymbolMatch) {
      if (String(row.symbol ?? "").trim().toUpperCase() !== exactSymbolQuery) return false;
    } else if (!rowMatchesSearch(row, query)) return false;
    if (filters.assetType && String(row.asset_type ?? "").trim() !== filters.assetType) return false;
    if (filters.sector && String(row.sector ?? "").trim() !== filters.sector) return false;
    if (filters.rating && String(row.rating ?? "").trim().toUpperCase() !== filters.rating) return false;
    if (selectedAction && normalizeAction(actionFor(row)) !== selectedAction) return false;
    if (selectedQuality && normalizeQuality(row.recommendation_quality) !== selectedQuality) return false;
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
  const [assetTypeFilter, setAssetTypeFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [signalFilter, setSignalFilter] = useState("");
  const [qualityFilter, setQualityFilter] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState("");
  const [sortKey, setSortKey] = useState<RankingSortKey | null>("score");
  const [sortDirection, setSortDirection] = useState<RankingSortDirection>("desc");
  const [topSortKey, setTopSortKey] = useState<RankingSortKey | null>("score");
  const [topSortDirection, setTopSortDirection] = useState<RankingSortDirection>("desc");
  const [showAllRankingRows, setShowAllRankingRows] = useState(false);

  const assetTypes = useMemo(() => uniqueOptions(ranking, "asset_type"), [ranking]);
  const sectors = useMemo(() => {
    const source = assetTypeFilter ? ranking.filter((row) => String(row.asset_type ?? "").trim() === assetTypeFilter) : ranking;
    return uniqueOptions(source, "sector");
  }, [assetTypeFilter, ranking]);
  const rankingBySymbol = useMemo(() => {
    const map = new Map<string, RankingRow>();
    for (const row of ranking) {
      const symbol = String(row.symbol ?? "").trim().toUpperCase();
      if (symbol) map.set(symbol, row);
    }
    return map;
  }, [ranking]);

  const filteredRows = useMemo(() => {
    return filterRows(ranking, { action: actionFilter, assetType: assetTypeFilter, minimumScore: minScoreFilter, quality: qualityFilter, rating: ratingFilter, sector: sectorFilter, signal: signalFilter, symbolSearch });
  }, [actionFilter, assetTypeFilter, minScoreFilter, qualityFilter, ranking, ratingFilter, sectorFilter, signalFilter, symbolSearch]);
  const enrichedTopCandidates = useMemo(() => {
    return topCandidates.map((row) => mergeRankingFallback(row, rankingBySymbol.get(String(row.symbol ?? "").trim().toUpperCase())));
  }, [rankingBySymbol, topCandidates]);
  const filteredTopCandidates = useMemo(() => {
    return filterRows(enrichedTopCandidates, { action: actionFilter, assetType: assetTypeFilter, minimumScore: minScoreFilter, quality: qualityFilter, rating: ratingFilter, sector: sectorFilter, signal: signalFilter, symbolSearch });
  }, [actionFilter, assetTypeFilter, enrichedTopCandidates, minScoreFilter, qualityFilter, ratingFilter, sectorFilter, signalFilter, symbolSearch]);
  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDirection), [filteredRows, sortDirection, sortKey]);
  const sortedTopCandidates = useMemo(() => sortRows(filteredTopCandidates, topSortKey, topSortDirection), [filteredTopCandidates, topSortDirection, topSortKey]);
  const renderedRows = useMemo(() => (showAllRankingRows ? sortedRows : sortedRows.slice(0, 200)), [showAllRankingRows, sortedRows]);
  const renderedTopCandidates = useMemo(() => sortedTopCandidates.slice(0, 10), [sortedTopCandidates]);
  const visibleRankingCount = renderedRows.length;
  const visibleTopCount = renderedTopCandidates.length;

  function resetFilters() {
    setSymbolSearch("");
    setAssetTypeFilter("");
    setSectorFilter("");
    setRatingFilter("");
    setActionFilter("");
    setSignalFilter("");
    setQualityFilter("");
    setMinScoreFilter("");
    setSortKey("score");
    setSortDirection("desc");
    setTopSortKey("score");
    setTopSortDirection("desc");
    setShowAllRankingRows(false);
  }

  function handleSort(key: RankingSortKey) {
    const direction = nextSortDirection(sortKey, key, sortDirection, sortConfigForKey(key));
    setSortKey(key);
    setSortDirection(direction);
  }

  function handleTopSort(key: RankingSortKey) {
    const direction = nextSortDirection(topSortKey, key, topSortDirection, sortConfigForKey(key));
    setTopSortKey(key);
    setTopSortDirection(direction);
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
            Showing {visibleRankingCount.toLocaleString()} of {filteredRows.length.toLocaleString()} rows
          </div>
        </div>

        <div className="terminal-panel mb-3 rounded-md p-3">
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 lg:grid-cols-8">
            <div className="min-w-0">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Symbol
                <input
                  className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                  onChange={(event) => setSymbolSearch(event.currentTarget.value)}
                  placeholder="Search symbol"
                  value={symbolSearch}
                />
              </label>
            </div>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Asset Type
              <select
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => {
                  setAssetTypeFilter(event.target.value);
                  setSectorFilter("");
                }}
                value={assetTypeFilter}
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
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSectorFilter(event.target.value)}
                value={sectorFilter}
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
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setRatingFilter(event.target.value)}
                value={ratingFilter}
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
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setActionFilter(event.target.value)}
                value={actionFilter}
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
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setSignalFilter(event.target.value)}
                value={signalFilter}
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
              Quality
              <select
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                onChange={(event) => setQualityFilter(event.target.value)}
                value={qualityFilter}
              >
                <option value="">All qualities</option>
                {QUALITY_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Min Score
              <input
                className="mt-1 h-9 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60"
                min="0"
                onChange={(event) => setMinScoreFilter(event.target.value)}
                onInput={(event) => setMinScoreFilter(event.currentTarget.value)}
                placeholder="0"
                type="number"
                value={minScoreFilter}
              />
            </label>

            <button
              className="col-start-2 h-9 self-end rounded border border-slate-700/80 px-3 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200 md:col-start-4 lg:col-start-8"
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>
          </div>
        </div>

        <RankingTable rows={renderedRows} emptyMessage="No matching symbols" sortDirection={sortDirection} sortKey={sortKey} onSort={handleSort} />
        {sortedRows.length > 200 ? (
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Showing {visibleRankingCount.toLocaleString()} of {sortedRows.length.toLocaleString()} filtered rows</span>
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
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Top Candidates</div>
              <h2 className="text-lg font-semibold text-slate-50">High Conviction</h2>
            </div>
            <div className="whitespace-nowrap text-xs text-slate-500">
              Showing {visibleTopCount.toLocaleString()} of {filteredTopCandidates.length.toLocaleString()} rows
            </div>
          </div>
          <RankingTable rows={renderedTopCandidates} highlight emptyMessage="No matching symbols" sortDirection={topSortDirection} sortKey={topSortKey} onSort={handleTopSort} />
        </section>

        <WatchlistPanel />
      </aside>
    </div>
  );
}
