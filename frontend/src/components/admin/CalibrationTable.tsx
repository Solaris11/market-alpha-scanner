"use client";

import { useMemo, useState } from "react";
import type { CalibrationMetricRow } from "@/lib/server/admin-data";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

type SortKey = "avgDrawdownPct" | "avgReturnPct" | "count" | "expectancyPct" | "groupValue" | "horizon" | "medianReturnPct" | "sampleSize" | "winRatePct" | "worstReturnPct";

const HEADERS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "horizon", label: "Horizon" },
  { key: "groupValue", label: "Group" },
  { key: "count", label: "Count", numeric: true },
  { key: "avgReturnPct", label: "Avg return", numeric: true },
  { key: "medianReturnPct", label: "Median", numeric: true },
  { key: "winRatePct", label: "Win rate", numeric: true },
  { key: "expectancyPct", label: "Expectancy", numeric: true },
  { key: "avgDrawdownPct", label: "Drawdown", numeric: true },
  { key: "worstReturnPct", label: "Worst", numeric: true },
  { key: "sampleSize", label: "Sample" },
];

export function CalibrationTable({ rows }: { rows: CalibrationMetricRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [ascending, setAscending] = useState(false);
  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const comparison = compareValues(left[sortKey], right[sortKey]);
      return ascending ? comparison : -comparison;
    });
  }, [ascending, rows, sortKey]);

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setAscending((value) => !value);
      return;
    }
    setSortKey(nextKey);
    setAscending(nextKey === "groupValue" || nextKey === "horizon");
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[1080px] w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <tr>
            {HEADERS.map((header) => (
              <th className={`px-3 py-3 ${header.numeric ? "text-right" : ""}`} key={header.key}>
                <button className="inline-flex min-h-9 items-center transition hover:text-cyan-200" onClick={() => toggleSort(header.key)} type="button">
                  {header.label}
                  {sortKey === header.key ? <span className="ml-1 text-cyan-300">{ascending ? "ASC" : "DESC"}</span> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {sortedRows.map((row) => (
            <tr className="text-slate-300" key={`${row.groupType}-${row.horizon}-${row.groupValue}`}>
              <td className="px-3 py-3 font-mono text-xs text-slate-400">{row.horizon}</td>
              <td className="px-3 py-3 font-semibold text-slate-100">{groupDisplay(row)}</td>
              <td className="px-3 py-3 text-right font-mono">{row.count.toLocaleString()}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(row.avgReturnPct)}`}>{formatPercent(row.avgReturnPct)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(row.medianReturnPct)}`}>{formatPercent(row.medianReturnPct)}</td>
              <td className="px-3 py-3 text-right font-mono">{formatPercent(row.winRatePct)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(row.expectancyPct)}`}>{formatPercent(row.expectancyPct)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(row.avgDrawdownPct)}`}>{formatPercent(row.avgDrawdownPct)}</td>
              <td className={`px-3 py-3 text-right font-mono ${returnTone(row.worstReturnPct)}`}>{formatPercent(row.worstReturnPct)}</td>
              <td className="px-3 py-3">
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${sampleTone(row.sampleSize)}`}>
                  {sampleLabel(row.sampleSize)}
                </span>
                {row.lowConfidence ? <div className="mt-1 text-[10px] text-amber-100">Do not tune from this alone</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupDisplay(row: CalibrationMetricRow): string {
  if (row.groupType === "decision") return decisionLabel(row.groupValue);
  if (row.groupType === "setup_type" || row.groupType === "market_regime" || row.groupType === "asset_type") return humanizeLabel(row.groupValue);
  return row.groupValue;
}

function sampleTone(value: "LOW" | "MEDIUM" | "HIGH"): string {
  if (value === "HIGH") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (value === "MEDIUM") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return "border-amber-300/25 bg-amber-400/10 text-amber-100";
}

function sampleLabel(value: "LOW" | "MEDIUM" | "HIGH"): string {
  if (value === "HIGH") return "High evidence";
  if (value === "MEDIUM") return "Medium evidence";
  return "Early/low evidence";
}

function compareValues(left: string | number | boolean | null, right: string | number | boolean | null): number {
  if (typeof left === "number" || typeof right === "number") {
    return Number(left ?? Number.NEGATIVE_INFINITY) - Number(right ?? Number.NEGATIVE_INFINITY);
  }
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function formatPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value.toFixed(2)}%`;
}

function returnTone(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value > 0) return "text-emerald-200";
  if (value < 0) return "text-rose-200";
  return "text-slate-300";
}
