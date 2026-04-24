"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { ScannerScalar } from "@/lib/types";

type HistoryRow = Record<string, ScannerScalar>;
type PeriodKey = "1d" | "1wk" | "1mo" | "6mo" | "ytd" | "1y" | "5y" | "max";
type ApiPayload = {
  ok: boolean;
  rows?: HistoryRow[];
  error?: string;
};

type Point = {
  date: string;
  time: number;
  close: number;
  high: number;
  low: number;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "1wk", label: "1W" },
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "max", label: "Max" },
];

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(row: HistoryRow) {
  return String(row.date ?? row.datetime ?? row.timestamp ?? row.timestamp_utc ?? "").trim();
}

function closeValue(row: HistoryRow) {
  return numeric(row.close ?? row.adj_close ?? row.adjclose ?? row.price);
}

function highValue(row: HistoryRow, close: number) {
  return numeric(row.high) ?? close;
}

function lowValue(row: HistoryRow, close: number) {
  return numeric(row.low) ?? close;
}

function pointsFromRows(rows: HistoryRow[], period = "1y") {
  const parsed = rows
    .map((row) => {
      const date = dateValue(row);
      const close = closeValue(row);
      const time = Date.parse(date);
      if (!date || close === null || !Number.isFinite(time)) return null;
      return { date, time, close, high: highValue(row, close), low: lowValue(row, close) };
    })
    .filter((point): point is Point => point !== null)
    .sort((a, b) => a.time - b.time);

  if (!parsed.length || period === "all") return parsed;

  const latest = parsed[parsed.length - 1].time;
  const days = period === "1m" ? 31 : period === "3m" ? 93 : period === "6m" ? 186 : period === "2y" ? 730 : 365;
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return parsed.filter((point) => point.time >= cutoff);
}

export function PriceHistoryChart({ symbol, initialRows, defaultPeriod = "1y" }: { symbol: string; initialRows: HistoryRow[]; defaultPeriod?: PeriodKey }) {
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod);
  const [rows, setRows] = useState<HistoryRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const points = useMemo(() => pointsFromRows(rows, period), [period, rows]);

  useEffect(() => {
    let cancelled = false;

    async function loadRange() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/price-history/${encodeURIComponent(symbol)}?period=${period}`);
        const payload = (await response.json()) as ApiPayload;
        if (cancelled) return;
        if (!response.ok || !payload.ok || !payload.rows?.length) {
          setRows([]);
          setError(payload.error || "No price history returned for this range.");
          return;
        }
        setRows(payload.rows);
      } catch (requestError) {
        if (!cancelled) {
          setRows([]);
          setError(requestError instanceof Error ? requestError.message : "Price history request failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRange();
    return () => {
      cancelled = true;
    };
  }, [period, symbol]);

  if (!points.length) {
    return (
      <div className="mt-3">
        <RangeButtons period={period} setPeriod={setPeriod} />
        <div className="mt-3 rounded border border-dashed border-slate-700/70 px-3 py-10 text-center text-xs text-slate-500">
          {loading ? "Loading price history..." : error || "Price history is not available for this range."}
        </div>
      </div>
    );
  }

  const width = 680;
  const height = 220;
  const paddingX = 26;
  const paddingY = 20;
  const minTime = Math.min(...points.map((point) => point.time));
  const maxTime = Math.max(...points.map((point) => point.time));
  const minClose = Math.min(...points.map((point) => point.close));
  const maxClose = Math.max(...points.map((point) => point.close));
  const timeSpan = Math.max(1, maxTime - minTime);
  const priceSpan = Math.max(0.01, maxClose - minClose);
  const plotted = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : paddingX + ((point.time - minTime) / timeSpan) * (width - paddingX * 2);
    const y = points.length === 1 ? height / 2 : height - paddingY - ((point.close - minClose) / priceSpan) * (height - paddingY * 2);
    return { ...point, x, y, index };
  });
  const path = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const first = points[0];
  const latest = points[points.length - 1];
  const change = latest.close - first.close;
  const changePct = first.close ? (change / first.close) * 100 : null;
  const periodHigh = Math.max(...points.map((point) => point.high));
  const periodLow = Math.min(...points.map((point) => point.low));
  const positive = change >= 0;

  return (
    <div className="mt-3">
      <RangeButtons period={period} setPeriod={setPeriod} />
      {error ? <div className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{error}</div> : null}
      <div className="my-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
        {[
          { label: "Start", value: new Date(first.time).toISOString().slice(0, 10) },
          { label: "End", value: new Date(latest.time).toISOString().slice(0, 10) },
          { label: "Latest Close", value: formatNumber(latest.close) },
          { label: "Return", value: changePct === null ? "N/A" : `${positive ? "+" : ""}${changePct.toFixed(2)}%`, tone: positive ? "text-emerald-200" : "text-rose-200" },
          { label: "High", value: formatNumber(periodHigh) },
          { label: "Low", value: formatNumber(periodLow) },
        ].map((item) => (
          <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1.5" key={item.label}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</div>
            <div className={`mt-0.5 truncate font-mono text-slate-200 ${item.tone ?? ""}`}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded border border-slate-800/90 bg-slate-950/40 p-2">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>{loading ? "Refreshing..." : `${points.length.toLocaleString()} points`}</span>
          <span>{PERIODS.find((item) => item.key === period)?.label}</span>
        </div>
        <svg className="min-w-[680px]" height={height} role="img" viewBox={`0 0 ${width} ${height}`} width="100%">
          <title>Price history</title>
          <line stroke="rgba(148,163,184,0.20)" x1={paddingX} x2={width - paddingX} y1={height - paddingY} y2={height - paddingY} />
          <line stroke="rgba(148,163,184,0.20)" x1={paddingX} x2={paddingX} y1={paddingY} y2={height - paddingY} />
          <path d={path} fill="none" stroke={positive ? "rgb(52,211,153)" : "rgb(251,113,133)"} strokeWidth="2.2" />
          {plotted.length === 1 ? <circle cx={plotted[0].x} cy={plotted[0].y} fill="rgb(226,232,240)" r="3" /> : null}
        </svg>
      </div>
    </div>
  );
}

function RangeButtons({ period, setPeriod }: { period: PeriodKey; setPeriod: (period: PeriodKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PERIODS.map((item) => {
        const active = item.key === period;
        return (
          <button
            className={`rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
              active ? "border-sky-400/50 bg-sky-400/10 text-sky-100" : "border-slate-700/80 text-slate-400 hover:border-sky-400/40 hover:text-sky-200"
            }`}
            key={item.key}
            onClick={() => setPeriod(item.key)}
            type="button"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
