"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { EmptyState } from "./ui/EmptyState";

export type ChartCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSignalMarker = {
  time: string;
  type: "ENTER" | "EXIT" | "STOP" | "TARGET" | "WAIT";
  text?: string;
};

export type SymbolChartProps = {
  symbol: string;
  candles?: ChartCandle[];
  signals?: ChartSignalMarker[];
  height?: number;
};

const FALLBACK_DAYS = 30;
const FALLBACK_END_DATE = "2026-04-29";

export function SymbolChart({ symbol, candles, signals, height = 360 }: SymbolChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const normalizedCandles = useMemo(() => normalizeCandles(candles), [candles]);
  const fallback = !candles?.length;
  const chartCandles = useMemo(() => (
    fallback ? generateFallbackCandles(symbol) : normalizedCandles
  ), [fallback, normalizedCandles, symbol]);
  const chartSignals = useMemo(() => (
    signals?.length ? normalizeSignals(signals) : fallbackSignalMarkers(chartCandles)
  ), [chartCandles, signals]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !chartCandles.length) return undefined;

    let chart: ReturnType<typeof createChart> | null = null;
    try {
      setFailed(false);
      const bounds = container.getBoundingClientRect();
      chart = createChart(container, {
        autoSize: false,
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
        layout: {
          background: { color: "transparent", type: ColorType.Solid },
          textColor: "#D1D4DC",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        },
        grid: {
          vertLines: { color: "rgba(43, 43, 67, 0.45)" },
          horzLines: { color: "rgba(43, 43, 67, 0.45)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(148, 163, 184, 0.38)", labelBackgroundColor: "#0f172a" },
          horzLine: { color: "rgba(148, 163, 184, 0.38)", labelBackgroundColor: "#0f172a" },
        },
        rightPriceScale: {
          borderColor: "#1f2937",
          visible: true,
        },
        timeScale: {
          borderColor: "#1f2937",
          fixLeftEdge: true,
          fixRightEdge: true,
          timeVisible: true,
          visible: true,
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        borderDownColor: "#ef5350",
        borderUpColor: "#26a69a",
        downColor: "#ef5350",
        upColor: "#26a69a",
        wickDownColor: "#ef5350",
        wickUpColor: "#26a69a",
      });
      candleSeries.setData(toChartData(chartCandles));
      createSeriesMarkers(candleSeries, toSeriesMarkers(chartSignals), { zOrder: "top" });
      chart.timeScale().fitContent();

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chart) return;
        chart.resize(Math.max(1, Math.floor(entry.contentRect.width)), Math.max(1, Math.floor(entry.contentRect.height)));
      });
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        chart?.remove();
      };
    } catch {
      chart?.remove();
      setFailed(true);
      return undefined;
    }
  }, [chartCandles, chartSignals]);

  if (failed || (!fallback && candles?.length && !normalizedCandles.length)) {
    return <EmptyState title="Price chart unavailable" message="Scanner insights are still active." />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-xl shadow-black/20" style={{ height }}>
      <div ref={chartContainerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 shadow-lg backdrop-blur-xl">
        <div className="font-mono text-sm font-bold text-slate-50">{symbol.toUpperCase()}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Price Action</div>
        <div className="mt-1 text-xs text-slate-400">{chartCandles.length.toLocaleString()} candles</div>
      </div>
    </div>
  );
}

function toChartData(candles: ChartCandle[]): Array<CandlestickData<Time>> {
  return candles.map((candle) => ({
    close: candle.close,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    time: candle.time as Time,
  }));
}

function toSeriesMarkers(signals: ChartSignalMarker[]): Array<SeriesMarker<Time>> {
  return signals.map((signal, index) => markerForSignal(signal, index));
}

function markerForSignal(signal: ChartSignalMarker, index: number): SeriesMarker<Time> {
  const base = { id: `${signal.type}-${signal.time}-${index}`, time: signal.time as Time };
  if (signal.type === "ENTER") return { ...base, color: "#22c55e", position: "belowBar", shape: "arrowUp", text: signal.text ?? "ENTER" };
  if (signal.type === "EXIT") return { ...base, color: "#ef4444", position: "aboveBar", shape: "arrowDown", text: signal.text ?? "EXIT" };
  if (signal.type === "STOP") return { ...base, color: "#dc2626", position: "aboveBar", shape: "arrowDown", text: signal.text ?? "STOP" };
  if (signal.type === "TARGET") return { ...base, color: "#38bdf8", position: "aboveBar", shape: "arrowDown", text: signal.text ?? "TARGET" };
  return { ...base, color: "#f59e0b", position: "belowBar", shape: "circle", text: signal.text ?? "WAIT" };
}

function normalizeCandles(candles?: ChartCandle[]): ChartCandle[] {
  if (!candles?.length) return [];
  const byTime = new Map<string, ChartCandle>();
  for (const candle of candles) {
    const time = normalizeDate(candle.time);
    if (!time || !isValidCandle(candle)) continue;
    byTime.set(time, { ...candle, time });
  }
  return Array.from(byTime.values()).sort((a, b) => a.time.localeCompare(b.time));
}

function normalizeSignals(signals: ChartSignalMarker[]): ChartSignalMarker[] {
  return signals
    .map((signal) => ({ ...signal, time: normalizeDate(signal.time) ?? "" }))
    .filter((signal) => signal.time)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function fallbackSignalMarkers(candles: ChartCandle[]): ChartSignalMarker[] {
  if (candles.length < 3) return [];
  return [
    { time: candles[Math.floor(candles.length * 0.28)].time, type: "ENTER" },
    { time: candles[Math.floor(candles.length * 0.78)].time, type: "EXIT" },
  ];
}

function generateFallbackCandles(symbol: string): ChartCandle[] {
  const random = seededRandom(hashSymbol(symbol));
  const end = new Date(`${FALLBACK_END_DATE}T00:00:00.000Z`);
  let close = 60 + random() * 260;
  const trend = (random() - 0.42) * 0.018;
  const candles: ChartCandle[] = [];

  for (let index = FALLBACK_DAYS - 1; index >= 0; index -= 1) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - index);
    const open = close * (1 + (random() - 0.5) * 0.018);
    close = open * (1 + trend + (random() - 0.5) * 0.036);
    const high = Math.max(open, close) * (1 + random() * 0.02);
    const low = Math.min(open, close) * (1 - random() * 0.02);
    candles.push({
      close: roundPrice(close),
      high: roundPrice(high),
      low: roundPrice(low),
      open: roundPrice(open),
      time: date.toISOString().slice(0, 10),
    });
  }

  return candles;
}

function isValidCandle(candle: ChartCandle) {
  const values = [candle.open, candle.high, candle.low, candle.close];
  if (!values.every(Number.isFinite)) return false;
  return candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close);
}

function normalizeDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function hashSymbol(symbol: string) {
  return Array.from(symbol.toUpperCase()).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 17);
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}
