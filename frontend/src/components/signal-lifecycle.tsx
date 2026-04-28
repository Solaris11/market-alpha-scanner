"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { nextSortDirection, stableSortRows, type SortConfig, type SortDirection } from "@/lib/table-sort";
import type { CsvRow } from "@/lib/types";

type SummarySortKey =
  | "group_type"
  | "group_value"
  | "count"
  | "entry_reached_rate"
  | "target_hit_rate"
  | "stop_hit_rate"
  | "expired_rate"
  | "open_rate"
  | "avg_return_pct"
  | "avg_days_to_entry"
  | "avg_days_to_exit";
type DetailSortKey =
  | "symbol"
  | "signal_date"
  | "rating"
  | "action"
  | "entry_status"
  | "final_score"
  | "final_score_adjusted"
  | "buy_zone"
  | "stop_loss"
  | "conservative_target"
  | "status"
  | "return_pct"
  | "days_to_entry"
  | "days_to_exit"
  | "max_drawdown"
  | "max_gain";
type ColumnAlign = "left" | "right" | "center";

type Props = {
  rows: CsvRow[];
  summaryRows: CsvRow[];
};

const SUMMARY_NUMERIC_KEYS = new Set<SummarySortKey>([
  "count",
  "entry_reached_rate",
  "target_hit_rate",
  "stop_hit_rate",
  "expired_rate",
  "open_rate",
  "avg_return_pct",
  "avg_days_to_entry",
  "avg_days_to_exit",
]);
const DETAIL_NUMERIC_KEYS = new Set<DetailSortKey>([
  "final_score",
  "final_score_adjusted",
  "return_pct",
  "days_to_entry",
  "days_to_exit",
  "max_drawdown",
  "max_gain",
]);
const DETAIL_PAGE_SIZE = 200;
const STATUS_FILTER_OPTIONS = ["OPEN", "ENTRY_REACHED", "TARGET_HIT", "STOP_HIT", "EXPIRED"];
const RATING_FILTER_OPTIONS = ["TOP", "ACTIONABLE", "WATCH", "PASS"];
const ACTION_FILTER_OPTIONS = ["BUY", "STRONG BUY", "SELL", "STRONG SELL"];
const ENTRY_FILTER_OPTIONS = ["GOOD ENTRY", "NEAR ENTRY", "BUY ZONE", "OVEREXTENDED"];
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
const ENTRY_PRIORITY: Record<string, number> = {
  "GOOD ENTRY": 0,
  "NEAR ENTRY": 1,
  "BUY ZONE": 2,
  REVIEW: 3,
  OVEREXTENDED: 4,
  "STOP RISK": 5,
  "STOP HIT": 6,
};
const STATUS_PRIORITY: Record<string, number> = {
  OPEN: 0,
  ENTRY_REACHED: 1,
  TARGET_HIT: 2,
  STOP_HIT: 3,
  EXPIRED: 4,
};

const SUMMARY_COLUMNS: { key: SummarySortKey; label: string; align?: ColumnAlign }[] = [
  { key: "group_type", label: "Group" },
  { key: "group_value", label: "Value" },
  { key: "count", label: "Count", align: "right" },
  { key: "entry_reached_rate", label: "Entry %", align: "right" },
  { key: "target_hit_rate", label: "Target %", align: "right" },
  { key: "stop_hit_rate", label: "Stop %", align: "right" },
  { key: "expired_rate", label: "Expired %", align: "right" },
  { key: "open_rate", label: "Open %", align: "right" },
  { key: "avg_return_pct", label: "Avg Return", align: "right" },
  { key: "avg_days_to_entry", label: "Avg Days to Entry", align: "right" },
  { key: "avg_days_to_exit", label: "Avg Days to Exit", align: "right" },
];

const DETAIL_COLUMNS: { key: DetailSortKey; label: string; align?: ColumnAlign }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "signal_date", label: "Signal Date" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
  { key: "entry_status", label: "Entry" },
  { key: "final_score", label: "Score", align: "right" },
  { key: "final_score_adjusted", label: "Adjusted", align: "right" },
  { key: "buy_zone", label: "Buy Zone" },
  { key: "stop_loss", label: "Stop" },
  { key: "conservative_target", label: "Target" },
  { key: "status", label: "Status" },
  { key: "return_pct", label: "Return %", align: "right" },
  { key: "days_to_entry", label: "Days to Entry", align: "right" },
  { key: "days_to_exit", label: "Days to Exit", align: "right" },
  { key: "max_drawdown", label: "Drawdown", align: "right" },
  { key: "max_gain", label: "Gain", align: "right" },
];

function text(value: unknown, fallback = "—") {
  const raw = String(value ?? "").trim();
  return raw && !["nan", "none", "null"].includes(raw.toLowerCase()) ? raw : fallback;
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value: unknown) {
  const parsed = numeric(value);
  if (parsed === null) return "—";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${(parsed * 100).toFixed(1)}%`;
}

function numberText(value: unknown, digits = 1) {
  const parsed = numeric(value);
  return parsed === null ? "—" : parsed.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function symbolOf(row: CsvRow) {
  return text(row.symbol, "").toUpperCase();
}

function normalizeText(value: unknown) {
  return text(value, "").toUpperCase().replace(/\s+/g, " ");
}

function lifecycleStatus(value: unknown) {
  const status = normalizeText(value);
  return status === "CREATED" ? "OPEN" : status;
}

function parseSignalDate(value: unknown) {
  const raw = text(value, "");
  if (!raw) return null;
  const timestamp = Date.parse(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function detailValue(row: CsvRow, key: DetailSortKey) {
  if (key === "status") return lifecycleStatus(row.status);
  return row[key];
}

function summarySortConfig(key: SummarySortKey): SortConfig {
  return SUMMARY_NUMERIC_KEYS.has(key) ? { type: "number" } : { type: "string" };
}

function detailSortConfig(key: DetailSortKey): SortConfig {
  if (key === "signal_date") return { type: "date" };
  if (key === "rating") return { priority: RATING_PRIORITY };
  if (key === "action") return { priority: ACTION_PRIORITY };
  if (key === "entry_status") return { priority: ENTRY_PRIORITY };
  if (key === "status") return { priority: STATUS_PRIORITY };
  if (DETAIL_NUMERIC_KEYS.has(key)) return { type: "number" };
  return { type: "string" };
}

function alignmentClass(align: ColumnAlign | undefined) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function justifyClass(align: ColumnAlign | undefined) {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

function SortHeader<T extends string>({ activeKey, align, direction, label, onSort, thisKey }: { activeKey: T | null; align?: ColumnAlign; direction: SortDirection; label: string; onSort: (key: T) => void; thisKey: T }) {
  const active = activeKey === thisKey;
  return (
    <th className={`whitespace-nowrap px-2 py-1.5 ${alignmentClass(align)}`}>
      <button className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap hover:text-sky-200 ${justifyClass(align)}`} onClick={() => onSort(thisKey)} type="button">
        <span>{label}</span>
        {active ? <span className="text-sky-300">{direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

function statusBadgeClass(status: unknown) {
  const value = lifecycleStatus(status);
  if (value === "TARGET_HIT") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (value === "STOP_HIT") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (value === "EXPIRED") return "border-slate-600 bg-slate-800/70 text-slate-300";
  if (value === "ENTRY_REACHED") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (value === "OPEN") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function rowMatchesSearch(row: CsvRow, query: string) {
  if (!query) return true;
  return [row.symbol, row.company_name].some((value) => text(value, "").toLowerCase().includes(query));
}

export function SignalLifecycle({ rows, summaryRows }: Props) {
  const [summarySortKey, setSummarySortKey] = useState<SummarySortKey | null>("count");
  const [summarySortDirection, setSummarySortDirection] = useState<SortDirection>("desc");
  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey | null>("signal_date");
  const [detailSortDirection, setDetailSortDirection] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entryFilter, setEntryFilter] = useState("");
  const [minimumScore, setMinimumScore] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [detailPage, setDetailPage] = useState(0);

  const metrics = useMemo(() => {
    const total = rows.length;
    const statuses = rows.map((row) => lifecycleStatus(row.status));
    const entryReached = rows.filter((row) => text(row.entry_date, "") || ["ENTRY_REACHED", "TARGET_HIT", "STOP_HIT"].includes(lifecycleStatus(row.status))).length;
    const targetHit = statuses.filter((status) => status === "TARGET_HIT").length;
    const stopHit = statuses.filter((status) => status === "STOP_HIT").length;
    const expired = statuses.filter((status) => status === "EXPIRED").length;
    const open = statuses.filter((status) => ["OPEN", "CREATED", "ENTRY_REACHED"].includes(status)).length;
    return { entryReached, expired, open, stopHit, targetHit, total };
  }, [rows]);

  const filteredSummaryRows = useMemo(() => summaryRows, [summaryRows]);

  const sortedSummaryRows = useMemo(() => {
    return stableSortRows(filteredSummaryRows, summarySortKey, summarySortDirection, (row, key) => row[key], summarySortConfig);
  }, [filteredSummaryRows, summarySortDirection, summarySortKey]);
  const visibleSummaryRows = useMemo(() => sortedSummaryRows.slice(0, 200), [sortedSummaryRows]);

  const latestSignalDate = useMemo(() => {
    const dates = rows.map((row) => parseSignalDate(row.signal_date)).filter((value): value is number => value !== null);
    return dates.length ? Math.max(...dates) : null;
  }, [rows]);

  const filteredDetails = useMemo(() => {
    const rawQuery = symbolSearch.trim();
    const query = rawQuery.toLowerCase();
    const exactSymbolQuery = rawQuery.toUpperCase();
    const hasExactSymbolMatch = Boolean(exactSymbolQuery) && rows.some((row) => String(row.symbol ?? "").trim().toUpperCase() === exactSymbolQuery);
    const minScore = Number(minimumScore);
    const hasMinScore = minimumScore.trim() !== "" && Number.isFinite(minScore);
    const dateDays = dateRange === "all" ? null : Number(dateRange);
    const cutoff =
      latestSignalDate !== null && dateDays !== null && Number.isFinite(dateDays)
        ? latestSignalDate - (Math.max(1, dateDays) - 1) * 24 * 60 * 60 * 1000
        : null;

    return rows.filter((row) => {
      if (hasExactSymbolMatch) {
        if (String(row.symbol ?? "").trim().toUpperCase() !== exactSymbolQuery) return false;
      } else if (!rowMatchesSearch(row, query)) return false;
      if (statusFilter && lifecycleStatus(row.status) !== statusFilter) return false;
      if (ratingFilter && normalizeText(row.rating) !== ratingFilter) return false;
      if (actionFilter && normalizeText(row.action) !== actionFilter) return false;
      if (entryFilter && normalizeText(row.entry_status) !== entryFilter) return false;
      if (hasMinScore && (numeric(row.final_score) ?? -Infinity) < minScore) return false;
      if (cutoff !== null) {
        const rowDate = parseSignalDate(row.signal_date);
        if (rowDate === null || rowDate < cutoff || rowDate > latestSignalDate!) return false;
      }
      return true;
    });
  }, [actionFilter, dateRange, entryFilter, latestSignalDate, minimumScore, ratingFilter, rows, statusFilter, symbolSearch]);

  const sortedDetails = useMemo(() => {
    return stableSortRows(filteredDetails, detailSortKey, detailSortDirection, detailValue, detailSortConfig);
  }, [detailSortDirection, detailSortKey, filteredDetails]);

  const totalDetailPages = Math.max(1, Math.ceil(sortedDetails.length / DETAIL_PAGE_SIZE));
  const currentDetailPage = Math.min(detailPage, totalDetailPages - 1);
  const visibleDetails = sortedDetails.slice(currentDetailPage * DETAIL_PAGE_SIZE, currentDetailPage * DETAIL_PAGE_SIZE + DETAIL_PAGE_SIZE);

  useEffect(() => {
    setDetailPage(0);
  }, [actionFilter, dateRange, detailSortDirection, detailSortKey, entryFilter, minimumScore, ratingFilter, statusFilter, symbolSearch]);

  function handleSummarySort(key: SummarySortKey) {
    const direction = nextSortDirection(summarySortKey, key, summarySortDirection, summarySortConfig(key));
    setSummarySortKey(key);
    setSummarySortDirection(direction);
  }

  function handleDetailSort(key: DetailSortKey) {
    const direction = nextSortDirection(detailSortKey, key, detailSortDirection, detailSortConfig(key));
    setDetailSortKey(key);
    setDetailSortDirection(direction);
  }

  function resetLifecycleFilters() {
    setStatusFilter("");
    setRatingFilter("");
    setActionFilter("");
    setEntryFilter("");
    setMinimumScore("");
    setDateRange("all");
    setSymbolSearch("");
    setDetailSortKey("signal_date");
    setDetailSortDirection("desc");
    setDetailPage(0);
  }

  function applyQuickView(view: "recent" | "active" | "targets" | "stops") {
    setRatingFilter("");
    setActionFilter("");
    setEntryFilter("");
    setMinimumScore("");
    setSymbolSearch("");
    setDetailSortKey("signal_date");
    setDetailSortDirection("desc");
    if (view === "recent") {
      setStatusFilter("");
      setDateRange("3");
    } else if (view === "active") {
      setStatusFilter("OPEN");
      setDateRange("all");
    } else if (view === "targets") {
      setStatusFilter("TARGET_HIT");
      setDateRange("all");
    } else {
      setStatusFilter("STOP_HIT");
      setDateRange("all");
    }
    setDetailPage(0);
  }

  return (
    <section className="space-y-3">
      <section className="terminal-panel rounded-md p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Signal Lifecycle</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Signal Follow-Through Tracker</h2>
            <p className="mt-1 text-sm text-slate-400">Tracks whether scanner signals reached entry, hit target, hit stop, expired, or remain open.</p>
          </div>
          <div className="text-xs text-slate-500">Showing up to 200 rows per table</div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total Signals", value: metrics.total.toLocaleString() },
            { label: "Entry Reached", value: metrics.total ? percent(metrics.entryReached / metrics.total) : "—" },
            { label: "Target Hit", value: metrics.total ? percent(metrics.targetHit / metrics.total) : "—" },
            { label: "Stop Hit", value: metrics.total ? percent(metrics.stopHit / metrics.total) : "—" },
            { label: "Open", value: metrics.open.toLocaleString() },
            { label: "Expired", value: metrics.expired.toLocaleString() },
          ].map((metric) => (
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2" key={metric.label}>
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</div>
              <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Lifecycle Summary</div>
          <div className="mt-1 text-xs text-slate-500">
            Showing {visibleSummaryRows.length.toLocaleString()} of {filteredSummaryRows.length.toLocaleString()} lifecycle groups
          </div>
        </div>
        <table className="w-full min-w-[1420px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 230 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 150 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {SUMMARY_COLUMNS.map((column) => (
                <SortHeader activeKey={summarySortKey} align={column.align} direction={summarySortDirection} key={column.key} label={column.label} onSort={handleSummarySort} thisKey={column.key} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {visibleSummaryRows.length ? visibleSummaryRows.map((row, index) => (
              <tr key={`${row.group_type}-${row.group_value}-${index}`}>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.group_type)}</td>
                <td className="truncate px-2 py-1.5 text-slate-200">{text(row.group_value)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.count, 0)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.entry_reached_rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.target_hit_rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.stop_hit_rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.expired_rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.open_rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.avg_return_pct)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.avg_days_to_entry)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.avg_days_to_exit)}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={11}>No lifecycle summary rows yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Recent Signal Lifecycles</div>
              <p className="mt-1 text-xs text-slate-500">
                Showing {visibleDetails.length.toLocaleString()} of {filteredDetails.length.toLocaleString()} signal lifecycle rows
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded border border-slate-700/80 px-2 py-1 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={() => applyQuickView("recent")} type="button">Recent Signals</button>
              <button className="rounded border border-slate-700/80 px-2 py-1 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={() => applyQuickView("active")} type="button">Active Trades</button>
              <button className="rounded border border-slate-700/80 px-2 py-1 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={() => applyQuickView("targets")} type="button">Hit Targets</button>
              <button className="rounded border border-slate-700/80 px-2 py-1 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={() => applyQuickView("stops")} type="button">Stopped Out</button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1.1fr_0.85fr_0.85fr_0.85fr_0.9fr_0.75fr_0.75fr_auto]">
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Symbol
              <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setSymbolSearch(event.target.value)} onInput={(event) => setSymbolSearch(event.currentTarget.value)} placeholder="Search symbol or company" value={symbolSearch} />
            </label>
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
              <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">All</option>
                {STATUS_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Rating
              <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setRatingFilter(event.target.value)} value={ratingFilter}>
                <option value="">All</option>
                {RATING_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Action
              <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setActionFilter(event.target.value)} value={actionFilter}>
                <option value="">All</option>
                {ACTION_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Entry
              <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setEntryFilter(event.target.value)} value={entryFilter}>
                <option value="">All</option>
                {ENTRY_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Min Score
              <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" min="0" onChange={(event) => setMinimumScore(event.target.value)} onInput={(event) => setMinimumScore(event.currentTarget.value)} placeholder="0" type="number" value={minimumScore} />
            </label>
            <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Date
              <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setDateRange(event.target.value)} value={dateRange}>
                <option value="all">All</option>
                <option value="1">Last 1 day</option>
                <option value="3">Last 3 days</option>
                <option value="7">Last 7 days</option>
              </select>
            </label>
            <button className="self-end rounded border border-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-sky-400/50 hover:text-sky-200" onClick={resetLifecycleFilters} type="button">
              Reset
            </button>
          </div>
        </div>
        <table className="w-full min-w-[1905px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {DETAIL_COLUMNS.map((column) => (
                <SortHeader activeKey={detailSortKey} align={column.align} direction={detailSortDirection} key={column.key} label={column.label} onSort={handleDetailSort} thisKey={column.key} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {visibleDetails.length ? visibleDetails.map((row, index) => (
              <tr key={`${row.signal_id}-${index}`}>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono font-semibold">
                  <Link className="text-sky-200 hover:text-sky-100" href={`/symbol/${symbolOf(row)}`}>
                    {text(row.symbol)}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-400">{text(row.signal_date)}</td>
                <td className="truncate px-2 py-1.5 text-slate-300">{text(row.rating)}</td>
                <td className="truncate px-2 py-1.5 text-slate-300">{text(row.action)}</td>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.entry_status)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.final_score)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.final_score_adjusted)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{text(row.buy_zone)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{text(row.stop_loss)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{text(row.conservative_target)}</td>
                <td className="px-2 py-1.5">
                  <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(row.status)}`}>{lifecycleStatus(row.status) || "—"}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.return_pct)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.days_to_entry, 0)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(row.days_to_exit, 0)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.max_drawdown)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.max_gain)}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={16}>No tracked signal lifecycles match these filters.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-col gap-2 border-t border-slate-800 px-3 py-2 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {sortedDetails.length ? (currentDetailPage * DETAIL_PAGE_SIZE + 1).toLocaleString() : "0"}-
            {Math.min((currentDetailPage + 1) * DETAIL_PAGE_SIZE, sortedDetails.length).toLocaleString()} of {sortedDetails.length.toLocaleString()} filtered rows ({rows.length.toLocaleString()} total)
          </span>
          <div className="flex items-center gap-2">
            <button className="rounded border border-slate-700/80 px-2 py-1 font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:border-sky-400/50 hover:not-disabled:text-sky-200" disabled={currentDetailPage <= 0} onClick={() => setDetailPage((page) => Math.max(0, page - 1))} type="button">
              Previous
            </button>
            <span className="font-mono">Page {currentDetailPage + 1} / {totalDetailPages}</span>
            <button className="rounded border border-slate-700/80 px-2 py-1 font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:border-sky-400/50 hover:not-disabled:text-sky-200" disabled={currentDetailPage >= totalDetailPages - 1} onClick={() => setDetailPage((page) => Math.min(totalDetailPages - 1, page + 1))} type="button">
              Next
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
