"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CsvRow } from "@/lib/types";

type SortDirection = "asc" | "desc";
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
  | "buy_zone"
  | "stop_loss"
  | "conservative_target"
  | "status"
  | "return_pct"
  | "days";
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
const DETAIL_NUMERIC_KEYS = new Set<DetailSortKey>(["final_score", "return_pct", "days"]);

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
  { key: "buy_zone", label: "Buy Zone" },
  { key: "stop_loss", label: "Stop" },
  { key: "conservative_target", label: "Target" },
  { key: "status", label: "Status" },
  { key: "return_pct", label: "Return %", align: "right" },
  { key: "days", label: "Days", align: "right" },
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

function daysValue(row: CsvRow) {
  const exitDays = numeric(row.days_to_exit);
  if (exitDays !== null) return exitDays;
  return numeric(row.days_to_entry);
}

function detailValue(row: CsvRow, key: DetailSortKey) {
  if (key === "days") return daysValue(row);
  return row[key];
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
  const leftText = text(left, "").toLowerCase();
  const rightText = text(right, "").toLowerCase();
  return direction === "desc" ? rightText.localeCompare(leftText) : leftText.localeCompare(rightText);
}

function stableSort<T extends string>(rows: CsvRow[], key: T | null, direction: SortDirection, valueForKey: (row: CsvRow, key: T) => unknown, numericKeys: Set<T>) {
  if (!key) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const result = compareValues(valueForKey(left.row, key), valueForKey(right.row, key), direction, numericKeys.has(key));
      return result || left.index - right.index;
    })
    .map((item) => item.row);
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

function statusTone(status: unknown) {
  const value = text(status, "").toUpperCase();
  if (value === "TARGET_HIT") return "text-emerald-300";
  if (value === "STOP_HIT") return "text-rose-300";
  if (value === "EXPIRED") return "text-amber-300";
  if (value === "OPEN" || value === "ENTRY_REACHED") return "text-sky-300";
  return "text-slate-400";
}

export function SignalLifecycle({ rows, summaryRows }: Props) {
  const [summarySortKey, setSummarySortKey] = useState<SummarySortKey | null>(null);
  const [summarySortDirection, setSummarySortDirection] = useState<SortDirection>("desc");
  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey | null>(null);
  const [detailSortDirection, setDetailSortDirection] = useState<SortDirection>("desc");

  const metrics = useMemo(() => {
    const total = rows.length;
    const statuses = rows.map((row) => text(row.status, "").toUpperCase());
    const entryReached = rows.filter((row) => text(row.entry_date, "") || ["ENTRY_REACHED", "TARGET_HIT", "STOP_HIT"].includes(text(row.status, "").toUpperCase())).length;
    const targetHit = statuses.filter((status) => status === "TARGET_HIT").length;
    const stopHit = statuses.filter((status) => status === "STOP_HIT").length;
    const expired = statuses.filter((status) => status === "EXPIRED").length;
    const open = statuses.filter((status) => ["OPEN", "CREATED", "ENTRY_REACHED"].includes(status)).length;
    return { entryReached, expired, open, stopHit, targetHit, total };
  }, [rows]);

  const sortedSummary = useMemo(() => {
    return stableSort(summaryRows, summarySortKey, summarySortDirection, (row, key) => row[key], SUMMARY_NUMERIC_KEYS).slice(0, 200);
  }, [summaryRows, summarySortDirection, summarySortKey]);

  const sortedDetails = useMemo(() => {
    const defaultRows = [...rows].sort((left, right) => text(right.signal_date, "").localeCompare(text(left.signal_date, "")) || symbolOf(left).localeCompare(symbolOf(right)));
    return stableSort(defaultRows, detailSortKey, detailSortDirection, detailValue, DETAIL_NUMERIC_KEYS).slice(0, 200);
  }, [detailSortDirection, detailSortKey, rows]);

  function handleSummarySort(key: SummarySortKey) {
    if (summarySortKey === key) {
      setSummarySortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSummarySortKey(key);
    setSummarySortDirection("desc");
  }

  function handleDetailSort(key: DetailSortKey) {
    if (detailSortKey === key) {
      setDetailSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setDetailSortKey(key);
    setDetailSortDirection("desc");
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
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Lifecycle Summary</div>
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
            {sortedSummary.length ? sortedSummary.map((row, index) => (
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
        <div className="border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Recent Signal Lifecycles</div>
        <table className="w-full min-w-[1560px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {DETAIL_COLUMNS.map((column) => (
                <SortHeader activeKey={detailSortKey} align={column.align} direction={detailSortDirection} key={column.key} label={column.label} onSort={handleDetailSort} thisKey={column.key} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {sortedDetails.length ? sortedDetails.map((row, index) => (
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
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{text(row.buy_zone)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{text(row.stop_loss)}</td>
                <td className="truncate px-2 py-1.5 font-mono text-slate-400">{text(row.conservative_target)}</td>
                <td className={`truncate px-2 py-1.5 font-semibold ${statusTone(row.status)}`}>{text(row.status)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{percent(row.return_pct)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-slate-300">{numberText(daysValue(row), 0)}</td>
              </tr>
            )) : (
              <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={12}>No tracked signal lifecycles yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
