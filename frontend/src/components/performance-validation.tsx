"use client";

import { useMemo, useState } from "react";
import type { CsvRow, HistorySummary } from "@/lib/types";

type Props = {
  forwardRows: CsvRow[];
  history: HistorySummary;
  summaryRows: CsvRow[];
};

type SortMetric = "avg_return" | "hit_rate" | "avg_max_drawdown";

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
  const [sortMetric, setSortMetric] = useState<SortMetric>("avg_return");

  const horizons = useMemo(() => uniqueValues(summaryRows.length ? summaryRows : forwardRows, "horizon"), [forwardRows, summaryRows]);
  const groupTypes = useMemo(() => uniqueValues(summaryRows, "group_type"), [summaryRows]);
  const completedHorizons = useMemo(() => uniqueValues(forwardRows, "horizon"), [forwardRows]);

  const filteredSummary = useMemo(() => {
    const minimum = Number(minCount);
    const hasMinimum = minCount.trim() !== "" && Number.isFinite(minimum);
    return summaryRows
      .filter((row) => {
        if (horizon && text(row.horizon, "") !== horizon) return false;
        if (groupType && text(row.group_type, "") !== groupType) return false;
        if (hasMinimum && integer(row.count) < minimum) return false;
        return true;
      })
      .sort((left, right) => (numeric(right[sortMetric]) ?? -Infinity) - (numeric(left[sortMetric]) ?? -Infinity));
  }, [groupType, horizon, minCount, sortMetric, summaryRows]);

  const visibleForwardRows = useMemo(() => {
    return forwardRows
      .filter((row) => !horizon || text(row.horizon, "") === horizon)
      .sort((left, right) => String(right.timestamp_utc ?? "").localeCompare(String(left.timestamp_utc ?? "")))
      .slice(0, 300);
  }, [forwardRows, horizon]);

  const readiness = [
    { label: "Snapshots", value: history.count.toLocaleString(), meta: "saved scans" },
    { label: "Unique Days", value: history.uniqueDates.length.toLocaleString(), meta: "trading days" },
    { label: "Completed Observations", value: forwardRows.length.toLocaleString(), meta: "forward windows" },
    { label: "Horizons Available", value: completedHorizons.length ? completedHorizons.join(", ") : "None", meta: "1D / 2D / 5D / 10D / 20D / 60D" },
  ];

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
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_1fr]">
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
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Sort By
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setSortMetric(event.target.value as SortMetric)} value={sortMetric}>
              <option value="avg_return">Avg Return</option>
              <option value="hit_rate">Hit Rate</option>
              <option value="avg_max_drawdown">Drawdown</option>
            </select>
          </label>
        </div>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Grouped Results Table</div>
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-xs">
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {["Horizon", "Group", "Value", "Count", "Avg", "Median", "Hit", "Drawdown", "Gain", "Worst", "Best", "Sample"].map((header) => (
                <th className="px-2 py-1.5" key={header}>{header}</th>
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
              {["Symbol", "Signal Time", "Horizon", "Return", "Drawdown", "Gain", "Rating", "Action", "Setup", "Entry"].map((header) => (
                <th className="px-2 py-1.5" key={header}>{header}</th>
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
