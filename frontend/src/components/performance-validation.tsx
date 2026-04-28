"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { compareSortValues, nextSortDirection, stableSortRows, type SortConfig, type SortDirection } from "@/lib/table-sort";
import type { CsvRow, HistorySummary, RankingRow } from "@/lib/types";

type Props = {
  forwardRows: CsvRow[];
  forwardObservationCount?: number;
  history: HistorySummary;
  rankingRows?: RankingRow[];
  summaryRows: CsvRow[];
};

type GroupedSortKey = "horizon" | "group_type" | "group_value" | "count" | "avg_return" | "median_return" | "hit_rate" | "avg_max_drawdown" | "avg_max_gain" | "worst_return" | "best_return" | "low_sample";
type ForwardSortKey = "symbol" | "company" | "timestamp_utc" | "horizon" | "forward_return" | "max_drawdown_after_signal" | "max_gain_after_signal" | "rating" | "action" | "setup_type" | "entry_status";
type ColumnAlign = "left" | "right" | "center";

const HORIZON_PRIORITY: Record<string, number> = {
  "1D": 1,
  "2D": 2,
  "5D": 5,
  "10D": 10,
  "20D": 20,
  "60D": 60,
};
const GROUPED_NUMERIC_SORT_KEYS = new Set<GroupedSortKey>(["count", "avg_return", "median_return", "hit_rate", "avg_max_drawdown", "avg_max_gain", "worst_return", "best_return"]);
const FORWARD_NUMERIC_SORT_KEYS = new Set<ForwardSortKey>(["forward_return", "max_drawdown_after_signal", "max_gain_after_signal"]);
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

const GROUPED_COLUMNS: { key: GroupedSortKey; label: string; align?: ColumnAlign }[] = [
  { key: "horizon", label: "Horizon" },
  { key: "group_type", label: "Group" },
  { key: "group_value", label: "Value" },
  { key: "count", label: "Count", align: "right" },
  { key: "avg_return", label: "Avg Return", align: "right" },
  { key: "median_return", label: "Median", align: "right" },
  { key: "hit_rate", label: "Hit Rate", align: "right" },
  { key: "avg_max_drawdown", label: "Max Drawdown", align: "right" },
  { key: "avg_max_gain", label: "Gain", align: "right" },
  { key: "worst_return", label: "Worst", align: "right" },
  { key: "best_return", label: "Best", align: "right" },
  { key: "low_sample", label: "Sample", align: "center" },
];

const FORWARD_COLUMNS: { key: ForwardSortKey; label: string; align?: ColumnAlign }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "company", label: "Company" },
  { key: "horizon", label: "Horizon", align: "center" },
  { key: "forward_return", label: "Return", align: "right" },
  { key: "max_drawdown_after_signal", label: "Drawdown", align: "right" },
  { key: "max_gain_after_signal", label: "Gain", align: "right" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
  { key: "setup_type", label: "Setup" },
  { key: "entry_status", label: "Entry" },
  { key: "timestamp_utc", label: "Signal Time" },
];

function text(value: unknown, fallback = "—") {
  const raw = String(value ?? "").trim();
  return raw && !["nan", "none", "null"].includes(raw.toLowerCase()) ? raw : fallback;
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown) {
  const parsed = numeric(value);
  return parsed === null ? 0 : Math.trunc(parsed);
}

function percent(value: unknown) {
  const parsed = numeric(value);
  if (parsed === null) return "—";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${(parsed * 100).toFixed(2)}%`;
}

function ratio(value: unknown) {
  const parsed = numeric(value);
  if (parsed === null) return "—";
  return `${(parsed * 100).toFixed(1)}%`;
}

function formatDate(value: unknown) {
  const raw = text(value, "");
  if (!raw) return "—";
  return raw.replace("T", " ").replace("Z", " UTC");
}

function symbolOf(row: CsvRow) {
  return text(row.symbol, "").toUpperCase();
}

function isForwardHeaderRow(row: CsvRow) {
  return text(row.symbol, "").toLowerCase() === "symbol" || text(row.horizon, "").toLowerCase() === "horizon";
}

function uniqueValues(rows: CsvRow[], key: string) {
  return Array.from(new Set(rows.map((row) => text(row[key], "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sortIndicator(active: boolean, direction: SortDirection) {
  return active ? (direction === "asc" ? "↑" : "↓") : "";
}

function horizonSortValue(row: CsvRow) {
  const horizon = text(row.horizon, "");
  return HORIZON_PRIORITY[horizon] ?? null;
}

function companyForRow(row: CsvRow, companyBySymbol: Map<string, string>) {
  const direct = text(row.company_name, "");
  if (direct) return direct;
  return companyBySymbol.get(symbolOf(row)) ?? "";
}

function forwardSortValue(row: CsvRow, key: ForwardSortKey, companyBySymbol: Map<string, string>) {
  if (key === "company") return companyForRow(row, companyBySymbol);
  if (key === "horizon") return horizonSortValue(row);
  return row[key];
}

function defaultSortGroupedRows(rows: CsvRow[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const avgResult = compareSortValues(left.row.avg_return, right.row.avg_return, "desc", { type: "number" });
      if (avgResult) return avgResult;
      const horizonResult = compareSortValues(horizonSortValue(left.row), horizonSortValue(right.row), "asc", { type: "number" });
      return horizonResult || left.index - right.index;
    })
    .map((item) => item.row);
}

function defaultSortForwardRows(rows: CsvRow[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const horizonResult = compareSortValues(horizonSortValue(left.row), horizonSortValue(right.row), "asc", { type: "number" });
      if (horizonResult) return horizonResult;
      const returnResult = compareSortValues(left.row.forward_return, right.row.forward_return, "desc", { type: "number" });
      return returnResult || left.index - right.index;
    })
    .map((item) => item.row);
}

function compactForwardRows(rows: CsvRow[]) {
  const bySymbolHorizon = new Map<string, CsvRow>();
  for (const row of rows) {
    const symbol = symbolOf(row);
    const horizon = text(row.horizon, "");
    if (!symbol || !horizon) continue;
    const key = `${symbol}:${horizon}`;
    const current = bySymbolHorizon.get(key);
    if (!current || String(row.timestamp_utc ?? "").localeCompare(String(current.timestamp_utc ?? "")) > 0) {
      bySymbolHorizon.set(key, row);
    }
  }
  return Array.from(bySymbolHorizon.values());
}

function groupedValueForSort(row: CsvRow, key: GroupedSortKey) {
  if (key === "horizon") return horizonSortValue(row);
  if (key === "low_sample") return String(row.low_sample).toLowerCase() === "true" ? 1 : 0;
  return row[key];
}

function groupedSortConfig(key: GroupedSortKey): SortConfig {
  if (key === "horizon" || key === "low_sample" || GROUPED_NUMERIC_SORT_KEYS.has(key)) return { type: "number" };
  return { type: "string" };
}

function stableSortGroupedRows(rows: CsvRow[], key: GroupedSortKey | null, direction: SortDirection) {
  if (!key) return defaultSortGroupedRows(rows);
  return stableSortRows(rows, key, direction, groupedValueForSort, groupedSortConfig);
}

function forwardSortConfig(key: ForwardSortKey): SortConfig {
  if (key === "rating") return { priority: RATING_PRIORITY };
  if (key === "action") return { priority: ACTION_PRIORITY };
  if (key === "timestamp_utc") return { type: "date" };
  if (key === "horizon" || FORWARD_NUMERIC_SORT_KEYS.has(key)) return { type: "number" };
  return { type: "string" };
}

function stableSortForwardRows(rows: CsvRow[], key: ForwardSortKey | null, direction: SortDirection, companyBySymbol: Map<string, string>) {
  if (!key) return defaultSortForwardRows(rows);
  return stableSortRows(rows, key, direction, (row, sortKey) => forwardSortValue(row, sortKey, companyBySymbol), forwardSortConfig);
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
        {active ? <span className="text-sky-300">{sortIndicator(active, direction)}</span> : null}
      </button>
    </th>
  );
}

function bestSummary(rows: CsvRow[], groupType: string, horizon = "10D") {
  return rows
    .filter((row) => text(row.group_type, "") === groupType && text(row.horizon, "") === horizon)
    .sort((left, right) => (numeric(right.avg_return) ?? -Infinity) - (numeric(left.avg_return) ?? -Infinity))[0];
}

function worstSummary(rows: CsvRow[], groupType: string, horizon = "10D") {
  return rows
    .filter((row) => text(row.group_type, "") === groupType && text(row.horizon, "") === horizon)
    .sort((left, right) => (numeric(left.avg_return) ?? Infinity) - (numeric(right.avg_return) ?? Infinity))[0];
}

function edgeLabel(row: CsvRow | undefined) {
  if (!row) return "—";
  return `${text(row.group_value)} ${percent(row.avg_return)}`;
}

function debugValue(value: string) {
  return value.trim() || "ALL";
}

function groupedPreview(rows: CsvRow[]) {
  return rows
    .slice(0, 3)
    .map((row) => `${text(row.horizon, "?")}/${text(row.group_type, "?")}/${text(row.group_value, "?")}:${integer(row.count)}`)
    .join(", ") || "none";
}

function forwardPreview(rows: CsvRow[]) {
  return rows
    .slice(0, 3)
    .map((row) => `${symbolOf(row)}:${percent(row.forward_return)}`)
    .join(", ") || "none";
}

function BarChart({ rows, groupType, metric, title, horizon = "10D" }: { rows: CsvRow[]; groupType: string; metric: "avg_return" | "hit_rate" | "avg_max_drawdown"; title: string; horizon?: string }) {
  const chartRows = rows
    .filter((row) => text(row.group_type, "") === groupType && text(row.horizon, "") === horizon)
    .sort((left, right) => (numeric(right[metric]) ?? -Infinity) - (numeric(left[metric]) ?? -Infinity))
    .slice(0, 8);

  if (!chartRows.length) {
    return <div className="rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">{title} is not available yet.</div>;
  }

  const values = chartRows.map((row) => numeric(row[metric]) ?? 0);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const span = Math.max(0.0001, maxValue - minValue);

  return (
    <div className="terminal-panel rounded-md p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">{title}</div>
        <div className="font-mono text-[10px] text-slate-500">{horizon}</div>
      </div>
      <div className="space-y-2">
        {chartRows.map((row) => {
          const value = numeric(row[metric]) ?? 0;
          const width = Math.max(3, (Math.abs(value) / span) * 100);
          const positive = value >= 0;
          return (
            <div className="grid grid-cols-[110px_minmax(0,1fr)_68px] items-center gap-2 text-xs" key={`${groupType}-${row.group_value}-${metric}`}>
              <div className="truncate text-slate-400" title={text(row.group_value)}>
                {text(row.group_value)}
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div className={`h-full rounded ${positive ? "bg-emerald-400/70" : "bg-rose-400/70"}`} style={{ width: `${width}%` }} />
              </div>
              <div className="text-right font-mono text-slate-300">{metric === "hit_rate" ? ratio(value) : percent(value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PerformanceValidation({ forwardRows, forwardObservationCount, history, rankingRows = [], summaryRows }: Props) {
  const [horizon, setHorizon] = useState("");
  const [groupType, setGroupType] = useState("");
  const [minCount, setMinCount] = useState("5");
  const [groupedSortKey, setGroupedSortKey] = useState<GroupedSortKey | null>("avg_return");
  const [groupedSortDirection, setGroupedSortDirection] = useState<SortDirection>("desc");
  const [forwardSortKey, setForwardSortKey] = useState<ForwardSortKey | null>("timestamp_utc");
  const [forwardSortDirection, setForwardSortDirection] = useState<SortDirection>("desc");
  const [showRawObservations, setShowRawObservations] = useState(false);
  const [rawForwardRows, setRawForwardRows] = useState<CsvRow[] | null>(null);
  const [rawForwardLoading, setRawForwardLoading] = useState(false);
  const [rawForwardError, setRawForwardError] = useState("");

  const cleanForwardRows = useMemo(() => forwardRows.filter((row) => !isForwardHeaderRow(row)), [forwardRows]);
  const horizons = useMemo(() => uniqueValues(summaryRows.length ? summaryRows : cleanForwardRows, "horizon"), [cleanForwardRows, summaryRows]);
  const groupTypes = useMemo(() => uniqueValues(summaryRows, "group_type"), [summaryRows]);
  const completedHorizons = useMemo(() => uniqueValues(cleanForwardRows, "horizon"), [cleanForwardRows]);
  const companyBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rankingRows) {
      const symbol = String(row.symbol ?? "").trim().toUpperCase();
      const company = text(row.company_name, "");
      if (symbol && company) map.set(symbol, company);
    }
    return map;
  }, [rankingRows]);
  const compactRows = useMemo(() => compactForwardRows(cleanForwardRows), [cleanForwardRows]);

  const filteredSummaryRows = useMemo(() => {
    const minimum = Number(minCount);
    const hasMinimum = minCount.trim() !== "" && Number.isFinite(minimum);
    return summaryRows.filter((row) => {
      if (horizon && text(row.horizon, "") !== horizon) return false;
      if (groupType && text(row.group_type, "") !== groupType) return false;
      if (hasMinimum && integer(row.count) < minimum) return false;
      return true;
    });
  }, [groupType, horizon, minCount, summaryRows]);

  const sortedSummaryRows = useMemo(() => {
    return stableSortGroupedRows(filteredSummaryRows, groupedSortKey, groupedSortDirection);
  }, [filteredSummaryRows, groupedSortDirection, groupedSortKey]);

  const visibleSummaryRows = useMemo(() => sortedSummaryRows.slice(0, 200), [sortedSummaryRows]);

  const forwardSourceRows = useMemo(() => {
    const sourceRows = showRawObservations ? rawForwardRows ?? [] : compactRows;
    return sourceRows.filter((row) => !isForwardHeaderRow(row));
  }, [compactRows, rawForwardRows, showRawObservations]);

  const filteredForwardRows = useMemo(() => {
    return forwardSourceRows.filter((row) => !horizon || text(row.horizon, "") === horizon);
  }, [forwardSourceRows, horizon]);

  const sortedForwardRows = useMemo(() => {
    return stableSortForwardRows(filteredForwardRows, forwardSortKey, forwardSortDirection, companyBySymbol);
  }, [companyBySymbol, filteredForwardRows, forwardSortDirection, forwardSortKey]);

  const visibleForwardRows = useMemo(() => sortedForwardRows.slice(0, 200), [sortedForwardRows]);

  useEffect(() => {
    if (!showRawObservations || rawForwardRows !== null || rawForwardLoading) return;
    let active = true;
    async function loadRawForwardRows() {
      setRawForwardLoading(true);
      setRawForwardError("");
      try {
        const response = await fetch("/api/performance/forward-returns");
        const payload = (await response.json()) as { rows?: CsvRow[]; error?: string };
        if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
        if (active) setRawForwardRows(payload.rows ?? []);
      } catch (error) {
        if (active) setRawForwardError(error instanceof Error ? error.message : "Failed to load raw forward-return observations.");
      } finally {
        if (active) setRawForwardLoading(false);
      }
    }
    loadRawForwardRows();
    return () => {
      active = false;
    };
  }, [rawForwardLoading, rawForwardRows, showRawObservations]);

  const readiness = [
    { label: "Snapshots", value: history.count.toLocaleString(), meta: "saved scans" },
    { label: "Unique Days", value: history.uniqueDates.length.toLocaleString(), meta: "trading days" },
    { label: "Completed Observations", value: (forwardObservationCount ?? cleanForwardRows.length).toLocaleString(), meta: "forward windows" },
    { label: "Horizons Available", value: completedHorizons.length ? completedHorizons.join(", ") : "None", meta: "1D / 2D / 5D / 10D / 20D / 60D" },
  ];

  function handleGroupedSort(key: GroupedSortKey) {
    const direction = nextSortDirection(groupedSortKey, key, groupedSortDirection, groupedSortConfig(key));
    setGroupedSortKey(key);
    setGroupedSortDirection(direction);
  }

  function handleForwardSort(key: ForwardSortKey) {
    const direction = nextSortDirection(forwardSortKey, key, forwardSortDirection, forwardSortConfig(key));
    setForwardSortKey(key);
    setForwardSortDirection(direction);
  }

  return (
    <section className="space-y-3">
      <section className="terminal-panel rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Readiness</div>
        <p className="mt-1 text-xs text-slate-400">Grouped results summarize signal buckets. Forward returns show symbol-level observations.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {readiness.map((metric) => (
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2" key={metric.label}>
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</div>
              <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div>
            </div>
          ))}
        </div>
        {!cleanForwardRows.length ? (
          <div className="mt-3 rounded border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Analysis complete, but no completed forward-return windows yet.</div>
        ) : null}
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Best Rating 5D", value: edgeLabel(bestSummary(summaryRows, "rating", "5D")) },
          { label: "Best Rating 10D", value: edgeLabel(bestSummary(summaryRows, "rating", "10D")) },
          { label: "Best Rating 20D", value: edgeLabel(bestSummary(summaryRows, "rating", "20D")) },
          { label: "Best Setup 10D", value: edgeLabel(bestSummary(summaryRows, "setup_type", "10D")) },
          { label: "Best Score Bucket", value: edgeLabel(bestSummary(summaryRows, "score_bucket", "10D")) },
          { label: "Worst Setup 10D", value: edgeLabel(worstSummary(summaryRows, "setup_type", "10D")) },
          { label: "Best Entry Status", value: edgeLabel(bestSummary(summaryRows, "entry_status", "10D")) },
          { label: "Summary Rows", value: summaryRows.length.toLocaleString() },
        ].map((metric) => (
          <div className="terminal-panel min-w-0 rounded-md px-3 py-2" key={metric.label}>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
            <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100" title={metric.value}>
              {metric.value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <BarChart groupType="score_bucket" metric="avg_return" rows={summaryRows} title="Avg Return by Score Bucket" />
        <BarChart groupType="rating" metric="hit_rate" rows={summaryRows} title="Hit Rate by Rating" />
        <BarChart groupType="setup_type" metric="avg_return" rows={summaryRows} title="Avg Return by Setup" />
        <BarChart groupType="entry_status" metric="avg_max_drawdown" rows={summaryRows} title="Avg Drawdown by Entry Status" />
      </section>

      <section className="terminal-panel rounded-md p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Horizon
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setHorizon(event.target.value)} value={horizon}>
              <option value="">All horizons</option>
              {horizons.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Group Type
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setGroupType(event.target.value)} value={groupType}>
              <option value="">All groups</option>
              {groupTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Min Count
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setMinCount(event.target.value)} onInput={(event) => setMinCount(event.currentTarget.value)} type="number" value={minCount} />
          </label>
        </div>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Grouped Results Table</div>
          <div className="mt-1 text-xs text-slate-500">
            Debug: raw={summaryRows.length.toLocaleString()} filtered={filteredSummaryRows.length.toLocaleString()} rendered={visibleSummaryRows.length.toLocaleString()} horizonFilter={debugValue(horizon)} groupTypeFilter={debugValue(groupType)} minCount={debugValue(minCount)} sortKey={groupedSortKey ?? "none"} sortDirection={groupedSortDirection} first3={groupedPreview(visibleSummaryRows)}
          </div>
        </div>
        <table className="w-full min-w-[1680px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 80 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {GROUPED_COLUMNS.map((column) => (
                <SortHeader activeKey={groupedSortKey} align={column.align} direction={groupedSortDirection} key={column.key} label={column.label} onSort={handleGroupedSort} thisKey={column.key} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {visibleSummaryRows.length ? visibleSummaryRows.map((row, index) => (
              <tr key={`${row.horizon}-${row.group_type}-${row.group_value}-${index}`}>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-300">{text(row.horizon)}</td>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.group_type)}</td>
                <td className="truncate px-2 py-1.5 text-slate-200">{text(row.group_value)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{integer(row.count).toLocaleString()}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.avg_return)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.median_return)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{ratio(row.hit_rate)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.avg_max_drawdown)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.avg_max_gain)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.worst_return)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.best_return)}</td>
                <td className={String(row.low_sample).toLowerCase() === "true" ? "whitespace-nowrap px-2 py-1.5 text-center text-amber-300" : "whitespace-nowrap px-2 py-1.5 text-center text-emerald-300"}>{String(row.low_sample).toLowerCase() === "true" ? "Low" : "OK"}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={12}>No grouped performance rows match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">{showRawObservations ? "Forward Returns (Raw Observations)" : "Forward Returns (Compact View)"}</div>
              <p className="mt-1 text-xs normal-case tracking-normal text-slate-500">
                {showRawObservations ? "Raw observations may include repeated intraday snapshots." : "Compact view shows the latest observation per symbol and horizon."}
              </p>
              <p className="mt-1 text-xs normal-case tracking-normal text-slate-500">
                Debug: raw={forwardSourceRows.length.toLocaleString()} filtered={filteredForwardRows.length.toLocaleString()} rendered={visibleForwardRows.length.toLocaleString()} sortKey={forwardSortKey ?? "none"} sortDirection={forwardSortDirection} first3={forwardPreview(visibleForwardRows)}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300">
              <input checked={showRawObservations} className="accent-sky-400" onChange={(event) => setShowRawObservations(event.target.checked)} type="checkbox" />
              Show raw observations
            </label>
          </div>
        </div>
        {rawForwardLoading ? <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-500">Loading raw observations...</div> : null}
        {rawForwardError ? <div className="border-b border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{rawForwardError}</div> : null}
        <table className="w-full min-w-[1690px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 230 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {FORWARD_COLUMNS.map((column) => (
                <SortHeader activeKey={forwardSortKey} align={column.align} direction={forwardSortDirection} key={column.key} label={column.label} onSort={handleForwardSort} thisKey={column.key} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {visibleForwardRows.length ? visibleForwardRows.map((row, index) => (
              <tr key={`${row.symbol}-${row.timestamp_utc}-${row.horizon}-${index}`}>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono font-semibold">
                  <Link className="text-sky-200 hover:text-sky-100" href={`/symbol/${symbolOf(row)}`}>
                    {text(row.symbol)}
                  </Link>
                </td>
                <td className="truncate px-2 py-1.5 text-slate-400" title={companyForRow(row, companyBySymbol)}>{companyForRow(row, companyBySymbol) || "—"}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-center font-mono text-slate-300">{text(row.horizon)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.forward_return)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.max_drawdown_after_signal)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.max_gain_after_signal)}</td>
                <td className="truncate px-2 py-1.5 text-slate-300">{text(row.rating)}</td>
                <td className="truncate px-2 py-1.5 text-slate-300">{text(row.action)}</td>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.setup_type)}</td>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.entry_status)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{formatDate(row.timestamp_utc)}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={11}>No completed forward-return observations yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
