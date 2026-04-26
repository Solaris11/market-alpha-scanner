"use client";

import { useMemo, useState } from "react";
import type { CsvRow, HistorySummary } from "@/lib/types";

type Props = {
  forwardRows: CsvRow[];
  history: HistorySummary;
  summaryRows: CsvRow[];
};

type SortDirection = "asc" | "desc";
type GroupedSortKey = "horizon" | "group_type" | "group_value" | "count" | "avg_return" | "median_return" | "hit_rate" | "avg_max_drawdown" | "avg_max_gain" | "worst_return" | "best_return" | "low_sample";
type ForwardSortKey = "symbol" | "timestamp_utc" | "horizon" | "forward_return" | "max_drawdown_after_signal" | "max_gain_after_signal" | "rating" | "action" | "setup_type" | "entry_status";

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

const GROUPED_COLUMNS: { key: GroupedSortKey; label: string; align?: "left" | "right" }[] = [
  { key: "horizon", label: "Horizon" },
  { key: "group_type", label: "Group" },
  { key: "group_value", label: "Value" },
  { key: "count", label: "Count", align: "right" },
  { key: "avg_return", label: "Avg", align: "right" },
  { key: "median_return", label: "Median", align: "right" },
  { key: "hit_rate", label: "Hit", align: "right" },
  { key: "avg_max_drawdown", label: "Drawdown", align: "right" },
  { key: "avg_max_gain", label: "Gain", align: "right" },
  { key: "worst_return", label: "Worst", align: "right" },
  { key: "best_return", label: "Best", align: "right" },
  { key: "low_sample", label: "Sample" },
];

const FORWARD_COLUMNS: { key: ForwardSortKey; label: string; align?: "left" | "right" }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "timestamp_utc", label: "Signal Time" },
  { key: "horizon", label: "Horizon" },
  { key: "forward_return", label: "Return", align: "right" },
  { key: "max_drawdown_after_signal", label: "Drawdown", align: "right" },
  { key: "max_gain_after_signal", label: "Gain", align: "right" },
  { key: "rating", label: "Rating" },
  { key: "action", label: "Action" },
  { key: "setup_type", label: "Setup" },
  { key: "entry_status", label: "Entry" },
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

function uniqueValues(rows: CsvRow[], key: string) {
  return Array.from(new Set(rows.map((row) => text(row[key], "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sortIndicator(active: boolean, direction: SortDirection) {
  return active ? (direction === "asc" ? "↑" : "↓") : "";
}

function compareValues(left: unknown, right: unknown, direction: SortDirection, numericSort: boolean) {
  const leftMissing = left === null || left === undefined || left === "";
  const rightMissing = right === null || right === undefined || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  if (numericSort) {
    const leftValue = numeric(left);
    const rightValue = numeric(right);
    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
  }

  const leftText = text(left, "");
  const rightText = text(right, "");
  return direction === "desc" ? rightText.localeCompare(leftText) : leftText.localeCompare(rightText);
}

function normalizePriorityText(value: unknown) {
  return text(value, "").toUpperCase().replace(/\s+/g, " ");
}

function comparePriority(left: number | null, right: number | null, direction: SortDirection) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "desc" ? left - right : right - left;
}

function horizonSortValue(row: CsvRow) {
  const horizon = text(row.horizon, "");
  return HORIZON_PRIORITY[horizon] ?? null;
}

function stableSortGroupedRows(rows: CsvRow[], key: GroupedSortKey | null, direction: SortDirection) {
  if (!key) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      if (key === "group_value") {
        const leftType = text(left.row.group_type, "");
        const rightType = text(right.row.group_type, "");
        if (leftType === "rating" && rightType === "rating") {
          const result = comparePriority(RATING_PRIORITY[normalizePriorityText(left.row.group_value)] ?? null, RATING_PRIORITY[normalizePriorityText(right.row.group_value)] ?? null, direction);
          return result || left.index - right.index;
        }
        if (leftType === "action" && rightType === "action") {
          const result = comparePriority(ACTION_PRIORITY[normalizePriorityText(left.row.group_value)] ?? null, ACTION_PRIORITY[normalizePriorityText(right.row.group_value)] ?? null, direction);
          return result || left.index - right.index;
        }
      }
      const leftValue = key === "horizon" ? horizonSortValue(left.row) : left.row[key];
      const rightValue = key === "horizon" ? horizonSortValue(right.row) : right.row[key];
      const result = compareValues(leftValue, rightValue, direction, key === "horizon" || GROUPED_NUMERIC_SORT_KEYS.has(key));
      return result || left.index - right.index;
    })
    .map((item) => item.row);
}

function stableSortForwardRows(rows: CsvRow[], key: ForwardSortKey | null, direction: SortDirection) {
  if (!key) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      if (key === "rating") {
        const result = comparePriority(RATING_PRIORITY[normalizePriorityText(left.row.rating)] ?? null, RATING_PRIORITY[normalizePriorityText(right.row.rating)] ?? null, direction);
        return result || left.index - right.index;
      }
      if (key === "action") {
        const result = comparePriority(ACTION_PRIORITY[normalizePriorityText(left.row.action)] ?? null, ACTION_PRIORITY[normalizePriorityText(right.row.action)] ?? null, direction);
        return result || left.index - right.index;
      }
      const leftValue = key === "horizon" ? horizonSortValue(left.row) : left.row[key];
      const rightValue = key === "horizon" ? horizonSortValue(right.row) : right.row[key];
      const result = compareValues(leftValue, rightValue, direction, key === "horizon" || FORWARD_NUMERIC_SORT_KEYS.has(key));
      return result || left.index - right.index;
    })
    .map((item) => item.row);
}

function SortHeader<T extends string>({ activeKey, align, direction, label, onSort, thisKey }: { activeKey: T | null; align?: "left" | "right"; direction: SortDirection; label: string; onSort: (key: T) => void; thisKey: T }) {
  const active = activeKey === thisKey;
  return (
    <th className={`px-2 py-1.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button className={`inline-flex items-center gap-1 hover:text-sky-200 ${align === "right" ? "justify-end" : "justify-start"}`} onClick={() => onSort(thisKey)} type="button">
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

export function PerformanceValidation({ forwardRows, history, summaryRows }: Props) {
  const [horizon, setHorizon] = useState("");
  const [groupType, setGroupType] = useState("");
  const [minCount, setMinCount] = useState("5");
  const [groupedSortKey, setGroupedSortKey] = useState<GroupedSortKey | null>(null);
  const [groupedSortDirection, setGroupedSortDirection] = useState<SortDirection>("desc");
  const [forwardSortKey, setForwardSortKey] = useState<ForwardSortKey | null>(null);
  const [forwardSortDirection, setForwardSortDirection] = useState<SortDirection>("desc");

  const horizons = useMemo(() => uniqueValues(summaryRows.length ? summaryRows : forwardRows, "horizon"), [forwardRows, summaryRows]);
  const groupTypes = useMemo(() => uniqueValues(summaryRows, "group_type"), [summaryRows]);
  const completedHorizons = useMemo(() => uniqueValues(forwardRows, "horizon"), [forwardRows]);

  const filteredSummary = useMemo(() => {
    const minimum = Number(minCount);
    const hasMinimum = minCount.trim() !== "" && Number.isFinite(minimum);
    const filtered = summaryRows
      .filter((row) => {
        if (horizon && text(row.horizon, "") !== horizon) return false;
        if (groupType && text(row.group_type, "") !== groupType) return false;
        if (hasMinimum && integer(row.count) < minimum) return false;
        return true;
      });
    return stableSortGroupedRows(filtered, groupedSortKey, groupedSortDirection);
  }, [groupType, groupedSortDirection, groupedSortKey, horizon, minCount, summaryRows]);

  const visibleForwardRows = useMemo(() => {
    const filtered = forwardRows.filter((row) => !horizon || text(row.horizon, "") === horizon);
    return stableSortForwardRows(filtered, forwardSortKey, forwardSortDirection).slice(0, 300);
  }, [forwardRows, forwardSortDirection, forwardSortKey, horizon]);

  const readiness = [
    { label: "Snapshots", value: history.count.toLocaleString(), meta: "saved scans" },
    { label: "Unique Days", value: history.uniqueDates.length.toLocaleString(), meta: "trading days" },
    { label: "Completed Observations", value: forwardRows.length.toLocaleString(), meta: "forward windows" },
    { label: "Horizons Available", value: completedHorizons.length ? completedHorizons.join(", ") : "None", meta: "1D / 2D / 5D / 10D / 20D / 60D" },
  ];

  function handleGroupedSort(key: GroupedSortKey) {
    if (groupedSortKey === key) {
      setGroupedSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setGroupedSortKey(key);
    setGroupedSortDirection("desc");
  }

  function handleForwardSort(key: ForwardSortKey) {
    if (forwardSortKey === key) {
      setForwardSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setForwardSortKey(key);
    setForwardSortDirection("desc");
  }

  return (
    <section className="space-y-3">
      <section className="terminal-panel rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Readiness</div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {readiness.map((metric) => (
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2" key={metric.label}>
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</div>
              <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div>
            </div>
          ))}
        </div>
        {!forwardRows.length ? (
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
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setMinCount(event.target.value)} type="number" value={minCount} />
          </label>
        </div>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Grouped Results Table</div>
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-xs">
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {GROUPED_COLUMNS.map((column) => (
                <SortHeader activeKey={groupedSortKey} align={column.align} direction={groupedSortDirection} key={column.key} label={column.label} onSort={handleGroupedSort} thisKey={column.key} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {filteredSummary.length ? filteredSummary.slice(0, 300).map((row, index) => (
              <tr key={`${row.horizon}-${row.group_type}-${row.group_value}-${index}`}>
                <td className="px-2 py-1.5 font-mono text-slate-300">{text(row.horizon)}</td>
                <td className="px-2 py-1.5 text-slate-400">{text(row.group_type)}</td>
                <td className="truncate px-2 py-1.5 text-slate-200">{text(row.group_value)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{integer(row.count).toLocaleString()}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.avg_return)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.median_return)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{ratio(row.hit_rate)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.avg_max_drawdown)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.avg_max_gain)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.worst_return)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.best_return)}</td>
                <td className={String(row.low_sample).toLowerCase() === "true" ? "px-2 py-1.5 text-amber-300" : "px-2 py-1.5 text-emerald-300"}>{String(row.low_sample).toLowerCase() === "true" ? "Low" : "OK"}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={12}>No grouped performance rows match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Forward Returns Table</div>
        <table className="w-full min-w-[1160px] table-fixed border-collapse text-xs">
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
                <td className="px-2 py-1.5 font-mono font-semibold text-sky-200">{text(row.symbol)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{formatDate(row.timestamp_utc)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{text(row.horizon)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.forward_return)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.max_drawdown_after_signal)}</td>
                <td className="px-2 py-1.5 font-mono text-slate-300">{percent(row.max_gain_after_signal)}</td>
                <td className="px-2 py-1.5 text-slate-300">{text(row.rating)}</td>
                <td className="truncate px-2 py-1.5 text-slate-300">{text(row.action)}</td>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.setup_type)}</td>
                <td className="truncate px-2 py-1.5 text-slate-400">{text(row.entry_status)}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={10}>No completed forward-return observations yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
