"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { formatNumber } from "@/lib/format";
import type { ScannerScalar } from "@/lib/types";

type HistoryRow = Record<string, ScannerScalar>;
type PeriodKey = "1d" | "1wk" | "1mo" | "6mo" | "ytd" | "1y" | "5y" | "max";
type ApiPayload = {
  ok: boolean;
  requested_period?: string;
  yf_period?: string;
  yf_interval?: string;
  point_count?: number;
  start_date?: string | null;
  end_date?: string | null;
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

function pointsFromRows(rows: HistoryRow[]) {
  return rows
    .map((row) => {
      const date = dateValue(row);
      const close = closeValue(row);
      const time = Date.parse(date);
      if (!date || close === null || !Number.isFinite(time)) return null;
      return { date, time, close, high: highValue(row, close), low: lowValue(row, close) };
    })
    .filter((point): point is Point => point !== null)
    .sort((a, b) => a.time - b.time);
}

function axisFormatter(period: PeriodKey) {
  if (period === "1d") {
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }
  if (period === "1wk") {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
  }
  if (period === "1mo") {
    return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  }
  if (["6mo", "ytd", "1y"].includes(period)) {
    return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  }
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric" });
}

function hoverDateFormatter(period: PeriodKey) {
  if (period === "1d") {
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }
  if (period === "1wk") {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
  }
  if (period === "1mo") {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  if (["6mo", "ytd", "1y"].includes(period)) {
    return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  }
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric" });
}

function tooltipPrice(value: number) {
  return `$${value.toFixed(2)}`;
}

function xAxisTicks(points: Point[], period: PeriodKey, width: number, paddingLeft: number, paddingRight: number) {
  if (!points.length) return [];
  const count = Math.min(6, points.length);
  const formatter = axisFormatter(period);
  const minTime = points[0].time;
  const maxTime = points[points.length - 1].time;
  const timeSpan = Math.max(1, maxTime - minTime);
  const ticks = Array.from({ length: count }, (_value, index) => {
    const pointIndex = count === 1 ? 0 : Math.round((index / (count - 1)) * (points.length - 1));
    const point = points[pointIndex];
    const x = points.length === 1 ? width / 2 : paddingLeft + ((point.time - minTime) / timeSpan) * (width - paddingLeft - paddingRight);
    return { x, label: formatter.format(new Date(point.time)), key: `${point.time}-${index}` };
  });
  return ticks.filter((tick, index) => index === 0 || tick.label !== ticks[index - 1].label);
}

export function PriceHistoryChart({ symbol, initialRows = [], defaultPeriod = "1y" }: { symbol: string; initialRows?: HistoryRow[]; defaultPeriod?: PeriodKey }) {
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod);
  const [rows, setRows] = useState<HistoryRow[]>(initialRows);
  const [metadata, setMetadata] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = useMemo(() => pointsFromRows(rows), [rows]);

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
          setMetadata(payload);
          setError(payload.error || "No price history returned for this range.");
          return;
        }
        setRows(payload.rows);
        setMetadata(payload);
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

  useEffect(() => {
    setHoverIndex(null);
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
  const chartHeight = 220;
  const height = 250;
  const paddingLeft = 32;
  const paddingRight = 54;
  const paddingY = 18;
  const minTime = Math.min(...points.map((point) => point.time));
  const maxTime = Math.max(...points.map((point) => point.time));
  const minClose = Math.min(...points.map((point) => point.close));
  const maxClose = Math.max(...points.map((point) => point.close));
  const timeSpan = Math.max(1, maxTime - minTime);
  const priceSpan = Math.max(0.01, maxClose - minClose);
  const yForPrice = (value: number) =>
    points.length === 1 ? chartHeight / 2 : chartHeight - paddingY - ((value - minClose) / priceSpan) * (chartHeight - paddingY * 2);
  const plotted = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : paddingLeft + ((point.time - minTime) / timeSpan) * (width - paddingLeft - paddingRight);
    const y = yForPrice(point.close);
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
  const ticks = xAxisTicks(points, period, width, paddingLeft, paddingRight);
  const yTicks = [
    { value: maxClose, y: yForPrice(maxClose) },
    { value: minClose + priceSpan / 2, y: yForPrice(minClose + priceSpan / 2) },
    { value: minClose, y: yForPrice(minClose) },
  ];
  const hoverFormatter = hoverDateFormatter(period);
  const hoverPoint = hoverIndex === null ? null : plotted[hoverIndex] ?? null;
  const tooltipWidth = 112;
  const tooltipHeight = 46;
  const tooltipX = hoverPoint ? Math.min(Math.max(hoverPoint.x + 10, 8), width - tooltipWidth - 8) : 0;
  const tooltipY = hoverPoint ? Math.min(Math.max(hoverPoint.y - tooltipHeight - 10, 8), chartHeight - tooltipHeight - 4) : 0;
  const pointCount = metadata?.point_count ?? points.length;

  function handleChartPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = ((event.clientX - rect.left) / rect.width) * width;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const point of plotted) {
      const distance = Math.abs(point.x - cursorX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = point.index;
      }
    }
    setHoverIndex(nearestIndex);
  }

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
          <span>{loading ? "Refreshing..." : `${pointCount.toLocaleString()} points`}</span>
          <span>
            Close price · {metadata?.yf_period ?? period} / {metadata?.yf_interval ?? "artifact"}
          </span>
        </div>
        <svg
          className="min-w-[680px]"
          height={height}
          onPointerDown={handleChartPointer}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerMove={handleChartPointer}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
        >
          <title>Price History - close price</title>
          <line stroke="rgba(148,163,184,0.20)" x1={paddingLeft} x2={width - paddingRight} y1={chartHeight - paddingY} y2={chartHeight - paddingY} />
          <line stroke="rgba(148,163,184,0.20)" x1={paddingLeft} x2={paddingLeft} y1={paddingY} y2={chartHeight - paddingY} />
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line stroke="rgba(148,163,184,0.10)" x1={paddingLeft} x2={width - paddingRight} y1={tick.y} y2={tick.y} />
              <text fill="rgb(100,116,139)" fontSize="10" textAnchor="end" x={width - 4} y={tick.y + 3}>
                {formatNumber(tick.value)}
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke={positive ? "rgb(52,211,153)" : "rgb(251,113,133)"} strokeWidth="2.2" />
          {ticks.map((tick) => (
            <g key={tick.key}>
              <line stroke="rgba(148,163,184,0.16)" x1={tick.x} x2={tick.x} y1={chartHeight - paddingY} y2={chartHeight - paddingY + 5} />
              <text fill="rgb(100,116,139)" fontSize="11" textAnchor="middle" x={tick.x} y={chartHeight + 10}>
                {tick.label}
              </text>
            </g>
          ))}
          {plotted.length === 1 ? <circle cx={plotted[0].x} cy={plotted[0].y} fill="rgb(226,232,240)" r="3" /> : null}
          <rect fill="transparent" height={chartHeight - paddingY * 2} width={width - paddingLeft - paddingRight} x={paddingLeft} y={paddingY} />
          {hoverPoint ? (
            <g pointerEvents="none">
              <line stroke="rgba(125,211,252,0.55)" strokeDasharray="3 3" x1={hoverPoint.x} x2={hoverPoint.x} y1={paddingY} y2={chartHeight - paddingY} />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} fill="rgb(15,23,42)" r="4.5" stroke="rgb(125,211,252)" strokeWidth="2" />
              <g transform={`translate(${tooltipX} ${tooltipY})`}>
                <rect fill="rgba(2,6,23,0.96)" height={tooltipHeight} rx="6" stroke="rgba(125,211,252,0.45)" width={tooltipWidth} />
                <text fill="rgb(203,213,225)" fontSize="11" fontWeight="600" x="10" y="18">
                  {hoverFormatter.format(new Date(hoverPoint.time))}
                </text>
                <text fill="rgb(226,232,240)" fontFamily="monospace" fontSize="13" fontWeight="700" x="10" y="35">
                  {tooltipPrice(hoverPoint.close)}
                </text>
              </g>
            </g>
          ) : null}
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
