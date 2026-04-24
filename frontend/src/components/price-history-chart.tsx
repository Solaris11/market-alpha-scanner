import { formatNumber } from "@/lib/format";
import type { ScannerScalar } from "@/lib/types";

type HistoryRow = Record<string, ScannerScalar>;

type Point = {
  date: string;
  time: number;
  close: number;
};

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

function pointsFromRows(rows: HistoryRow[], period = "1y") {
  const parsed = rows
    .map((row) => {
      const date = dateValue(row);
      const close = closeValue(row);
      const time = Date.parse(date);
      if (!date || close === null || !Number.isFinite(time)) return null;
      return { date, time, close };
    })
    .filter((point): point is Point => point !== null)
    .sort((a, b) => a.time - b.time);

  if (!parsed.length || period === "all") return parsed;

  const latest = parsed[parsed.length - 1].time;
  const days = period === "1m" ? 31 : period === "3m" ? 93 : period === "6m" ? 186 : period === "2y" ? 730 : 365;
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return parsed.filter((point) => point.time >= cutoff);
}

export function PriceHistoryChart({ rows, period = "1y" }: { rows: HistoryRow[]; period?: string }) {
  const points = pointsFromRows(rows, period);

  if (!points.length) {
    return <div className="mt-3 rounded border border-dashed border-slate-700/70 px-3 py-10 text-center text-xs text-slate-500">Price history is not available for this symbol.</div>;
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
  const positive = change >= 0;

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-slate-500">
          {new Date(first.time).toISOString().slice(0, 10)} to {new Date(latest.time).toISOString().slice(0, 10)}
        </div>
        <div className={`font-mono font-semibold ${positive ? "text-emerald-200" : "text-rose-200"}`}>
          {formatNumber(latest.close)} {changePct === null ? "" : `(${positive ? "+" : ""}${changePct.toFixed(2)}%)`}
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-slate-800/90 bg-slate-950/40 p-2">
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
