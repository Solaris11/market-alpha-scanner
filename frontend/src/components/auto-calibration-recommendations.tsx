"use client";

import { useMemo, useState } from "react";
import { nextSortDirection, stableSortRows, type SortConfig, type SortDirection } from "@/lib/table-sort";
import type { CsvFileState, CsvRow } from "@/lib/types";
import { humanizeLabel, humanizeQuantText } from "@/lib/ui/labels";

type Props = {
  rows: CsvRow[];
  state: CsvFileState;
};

type SortKey =
  | "recommendation"
  | "group_type"
  | "group_value"
  | "horizon"
  | "count"
  | "avg_return"
  | "hit_rate"
  | "avg_max_drawdown"
  | "target_hit_rate"
  | "stop_hit_rate"
  | "confidence_score"
  | "suggested_action"
  | "reason";
type ColumnAlign = "left" | "right";

const NUMERIC_KEYS = new Set<SortKey>([
  "count",
  "avg_return",
  "hit_rate",
  "avg_max_drawdown",
  "target_hit_rate",
  "stop_hit_rate",
  "confidence_score",
]);
const RECOMMENDATION_PRIORITY: Record<string, number> = {
  SUPPRESS: 0,
  DOWNGRADE: 1,
  BOOST: 2,
  WATCH: 3,
  NO_CHANGE: 4,
};
const SUMMARY_RECOMMENDATIONS = ["BOOST", "DOWNGRADE", "SUPPRESS", "WATCH"] as const;
const COLUMNS: { key: SortKey; label: string; align?: ColumnAlign }[] = [
  { key: "recommendation", label: "Recommendation" },
  { key: "group_type", label: "Group" },
  { key: "group_value", label: "Value" },
  { key: "horizon", label: "Horizon" },
  { key: "count", label: "Count", align: "right" },
  { key: "avg_return", label: "Avg Return", align: "right" },
  { key: "hit_rate", label: "Hit Rate", align: "right" },
  { key: "avg_max_drawdown", label: "Drawdown", align: "right" },
  { key: "target_hit_rate", label: "Target %", align: "right" },
  { key: "stop_hit_rate", label: "Stop %", align: "right" },
  { key: "confidence_score", label: "Confidence", align: "right" },
  { key: "suggested_action", label: "Suggested Action" },
  { key: "reason", label: "Reason" },
];

function text(value: unknown, fallback = "N/A") {
  const raw = String(value ?? "").trim();
  return raw && !["nan", "none", "null"].includes(raw.toLowerCase()) ? raw : fallback;
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown) {
  const parsed = numeric(value);
  return parsed === null ? 0 : Math.trunc(parsed);
}

function percent(value: unknown, digits = 1) {
  const parsed = numeric(value);
  if (parsed === null) return "N/A";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${(parsed * 100).toFixed(digits)}%`;
}

function numberText(value: unknown) {
  const parsed = numeric(value);
  return parsed === null ? "N/A" : parsed.toLocaleString();
}

function uniqueValues(rows: CsvRow[], key: string) {
  return Array.from(new Set(rows.map((row) => text(row[key], "")).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function sortConfig(key: SortKey): SortConfig {
  if (key === "recommendation") return { priority: RECOMMENDATION_PRIORITY };
  if (NUMERIC_KEYS.has(key)) return { type: "number" };
  return { type: "string" };
}

function alignmentClass(align: ColumnAlign | undefined) {
  return align === "right" ? "text-right" : "text-left";
}

function justifyClass(align: ColumnAlign | undefined) {
  return align === "right" ? "justify-end" : "justify-start";
}

function recommendationBadgeClass(value: unknown) {
  const recommendation = text(value, "").toUpperCase();
  if (recommendation === "BOOST") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (recommendation === "DOWNGRADE") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (recommendation === "SUPPRESS") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (recommendation === "WATCH") return "border-slate-600 bg-slate-800/70 text-slate-300";
  return "border-sky-400/25 bg-sky-400/10 text-sky-100";
}

function recommendationLabel(value: unknown): string {
  const recommendation = text(value, "").toUpperCase();
  if (recommendation === "BOOST") return "Looks stronger";
  if (recommendation === "DOWNGRADE") return "Looks weaker";
  if (recommendation === "SUPPRESS") return "Keep filtered";
  if (recommendation === "WATCH") return "Keep monitoring";
  if (recommendation === "NO_CHANGE") return "No change";
  return humanizeLabel(recommendation, "No change");
}

function evidenceLabel(value: unknown): string {
  const confidence = integer(value);
  if (confidence >= 75) return "High evidence";
  if (confidence >= 45) return "Medium evidence";
  return "Early/low evidence";
}

function SortHeader({ activeKey, align, direction, label, onSort, thisKey }: { activeKey: SortKey | null; align?: ColumnAlign; direction: SortDirection; label: string; onSort: (key: SortKey) => void; thisKey: SortKey }) {
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

function sortRows(rows: CsvRow[], key: SortKey | null, direction: SortDirection) {
  return stableSortRows(rows, key, direction, (row, sortKey) => row[sortKey], sortConfig);
}

export function AutoCalibrationRecommendations({ rows, state }: Props) {
  const [recommendationFilter, setRecommendationFilter] = useState("");
  const [groupTypeFilter, setGroupTypeFilter] = useState("");
  const [horizonFilter, setHorizonFilter] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("confidence_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const recommendationOptions = useMemo(() => uniqueValues(rows, "recommendation"), [rows]);
  const groupTypeOptions = useMemo(() => uniqueValues(rows, "group_type"), [rows]);
  const horizonOptions = useMemo(() => uniqueValues(rows, "horizon"), [rows]);
  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = { total: rows.length, BOOST: 0, DOWNGRADE: 0, SUPPRESS: 0, WATCH: 0 };
    for (const row of rows) {
      const recommendation = text(row.recommendation, "").toUpperCase();
      if (recommendation in counts) counts[recommendation] += 1;
    }
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const confidence = Number(minConfidence);
    const hasConfidence = minConfidence.trim() !== "" && Number.isFinite(confidence);
    return rows.filter((row) => {
      if (recommendationFilter && text(row.recommendation, "") !== recommendationFilter) return false;
      if (groupTypeFilter && text(row.group_type, "") !== groupTypeFilter) return false;
      if (horizonFilter && text(row.horizon, "") !== horizonFilter) return false;
      if (hasConfidence && integer(row.confidence_score) < confidence) return false;
      return true;
    });
  }, [groupTypeFilter, horizonFilter, minConfidence, recommendationFilter, rows]);

  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDirection), [filteredRows, sortDirection, sortKey]);
  const visibleRows = useMemo(() => sortedRows.slice(0, 250), [sortedRows]);
  const insightRows = useMemo(() => sortedRows.slice(0, 3), [sortedRows]);

  function handleSort(key: SortKey) {
    const direction = nextSortDirection(sortKey, key, sortDirection, sortConfig(key));
    setSortKey(key);
    setSortDirection(direction);
  }

  return (
    <section className="terminal-panel rounded-md p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Scanner Learning</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Human-Readable Calibration Review</h2>
          <p className="mt-1 text-sm text-slate-400">Analysis-only evidence from forward returns and signal lifecycle results. Advanced metrics remain below.</p>
        </div>
        <div className="font-mono text-xs text-slate-500">{state === "data" ? `${filteredRows.length.toLocaleString()} of ${rows.length.toLocaleString()} rows` : "Not generated yet"}</div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <div className="rounded border border-slate-800 bg-slate-950/50 p-2">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total</div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-100">{summaryCounts.total.toLocaleString()}</div>
        </div>
        {SUMMARY_RECOMMENDATIONS.map((recommendation) => (
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2" key={recommendation}>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{recommendationLabel(recommendation)}</div>
            <div className="mt-1 font-mono text-sm font-semibold text-slate-100">{summaryCounts[recommendation].toLocaleString()}</div>
          </div>
        ))}
      </div>

      {insightRows.length ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {insightRows.map((row, index) => (
            <div className="rounded border border-white/10 bg-white/[0.035] p-3" key={`${text(row.group_type, "group")}-${text(row.group_value, "value")}-${index}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">{recommendationLabel(row.recommendation)}</div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">{evidenceLabel(row.confidence_score)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {humanizeLabel(row.group_value, text(row.group_value))} in {humanizeLabel(row.group_type, "this group")} is being watched over {text(row.horizon)}.
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{humanizeQuantText(row.reason, "Keep collecting evidence before changing scanner behavior.")}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Suggested interpretation: {humanizeQuantText(row.suggested_action, "Preserve current conservative settings.")}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="text-xs text-slate-400">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recommendation</span>
          <select className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100" value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value)}>
            <option value="">All</option>
            {recommendationOptions.map((option) => <option key={option} value={option}>{recommendationLabel(option)}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Group</span>
          <select className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100" value={groupTypeFilter} onChange={(event) => setGroupTypeFilter(event.target.value)}>
            <option value="">All</option>
            {groupTypeOptions.map((option) => <option key={option} value={option}>{humanizeLabel(option)}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Horizon</span>
          <select className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100" value={horizonFilter} onChange={(event) => setHorizonFilter(event.target.value)}>
            <option value="">All</option>
            {horizonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Min Confidence</span>
          <input className="mt-1 h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100" min="0" max="100" placeholder="0" type="number" value={minConfidence} onChange={(event) => setMinConfidence(event.target.value)} />
        </label>
      </div>

      {state !== "data" || !rows.length ? (
        <div className="mt-3 rounded border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">No auto calibration recommendations found. Run performance analysis to generate them.</div>
      ) : !filteredRows.length ? (
        <div className="mt-3 rounded border border-dashed border-slate-700/70 px-3 py-8 text-center text-xs text-slate-500">No recommendations match the selected filters.</div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded border border-slate-800">
          <table className="min-w-[1280px] w-full text-xs">
            <thead className="bg-slate-950/80 text-slate-400">
              <tr>
                {COLUMNS.map((column) => (
                  <SortHeader activeKey={sortKey} align={column.align} direction={sortDirection} key={column.key} label={column.label} onSort={handleSort} thisKey={column.key} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleRows.map((row, index) => (
                <tr className="hover:bg-slate-900/60" key={`${text(row.group_type, "group")}-${text(row.group_value, "value")}-${text(row.horizon, "horizon")}-${index}`}>
                  <td className="whitespace-nowrap px-2 py-2">
                    <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${recommendationBadgeClass(row.recommendation)}`}>{recommendationLabel(row.recommendation)}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-300">{humanizeLabel(row.group_type, text(row.group_type))}</td>
                  <td className="max-w-[220px] truncate whitespace-nowrap px-2 py-2 text-slate-100" title={humanizeLabel(row.group_value, text(row.group_value))}>{humanizeLabel(row.group_value, text(row.group_value))}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-300">{text(row.horizon)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-300">{numberText(row.count)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-300">{percent(row.avg_return, 2)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-300">{percent(row.hit_rate)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-300">{percent(row.avg_max_drawdown, 2)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-300">{percent(row.target_hit_rate)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-300">{percent(row.stop_hit_rate)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-slate-100">{numberText(row.confidence_score)}</td>
                  <td className="max-w-[260px] truncate whitespace-nowrap px-2 py-2 text-slate-300" title={humanizeQuantText(row.suggested_action)}>{humanizeQuantText(row.suggested_action)}</td>
                  <td className="min-w-[260px] px-2 py-2 text-slate-400">{humanizeQuantText(row.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedRows.length > visibleRows.length ? <div className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">Showing first {visibleRows.length.toLocaleString()} recommendations.</div> : null}
        </div>
      )}
    </section>
  );
}
