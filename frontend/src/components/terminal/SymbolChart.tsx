"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import {
  addTradeLevelLines,
  generateFallbackCandles,
  normalizeCandles,
  normalizeSignals,
  normalizeTradeLevels,
  toChartData,
  toSeriesMarkers,
} from "./symbol-chart-utils";
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

export type ChartTradeLevels = {
  entry?: number | null;
  entryLow?: number | null;
  entryHigh?: number | null;
  stop?: number | null;
  target?: number | null;
};

export type SymbolChartProps = {
  symbol: string;
  candles?: ChartCandle[];
  signals?: ChartSignalMarker[];
  showHistoricalSignals?: boolean;
  tradeLevels?: ChartTradeLevels;
  height?: number;
};

export function SymbolChart({ symbol, candles, signals, showHistoricalSignals = false, tradeLevels, height = 360 }: SymbolChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const entryBandRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const normalizedCandles = useMemo(() => normalizeCandles(candles), [candles]);
  const fallback = !candles?.length;
  const chartCandles = useMemo(() => (
    fallback ? generateFallbackCandles(symbol) : normalizedCandles
  ), [fallback, normalizedCandles, symbol]);
  const chartSignals = useMemo(() => (
    showHistoricalSignals && signals?.length ? normalizeSignals(signals) : []
  ), [showHistoricalSignals, signals]);
  const chartLevels = useMemo(() => normalizeTradeLevels(tradeLevels), [tradeLevels]);
  const hasTradeLevels = chartLevels.entry !== null || chartLevels.entryLow !== null || chartLevels.entryHigh !== null || chartLevels.stop !== null || chartLevels.target !== null;

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
      addTradeLevelLines(candleSeries, chartLevels);
      chart.timeScale().fitContent();

      const updateEntryBand = () => {
        const band = entryBandRef.current;
        if (!band || chartLevels.entryLow === null || chartLevels.entryHigh === null) return;
        const top = candleSeries.priceToCoordinate(Math.max(chartLevels.entryLow, chartLevels.entryHigh));
        const bottom = candleSeries.priceToCoordinate(Math.min(chartLevels.entryLow, chartLevels.entryHigh));
        if (top === null || bottom === null) {
          band.style.display = "none";
          return;
        }
        band.style.display = "block";
        band.style.top = `${Math.min(top, bottom)}px`;
        band.style.height = `${Math.max(3, Math.abs(bottom - top))}px`;
      };
      updateEntryBand();

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chart) return;
        chart.resize(Math.max(1, Math.floor(entry.contentRect.width)), Math.max(1, Math.floor(entry.contentRect.height)));
        updateEntryBand();
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
  }, [chartCandles, chartLevels, chartSignals]);

  if (failed || (!fallback && candles?.length && !normalizedCandles.length)) {
    return <EmptyState title="Price chart unavailable" message="Scanner insights are still active." />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-xl shadow-black/20" style={{ height }}>
      <div ref={chartContainerRef} className="absolute inset-0" />
      <div ref={entryBandRef} className="pointer-events-none absolute left-0 right-0 hidden border-y border-amber-300/35 bg-amber-300/10" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 shadow-lg backdrop-blur-xl">
        <div className="font-mono text-sm font-bold text-slate-50">{symbol.toUpperCase()}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Price Action</div>
        <div className="mt-1 text-xs text-slate-400">{chartCandles.length.toLocaleString()} candles</div>
      </div>
      {hasTradeLevels ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-xs shadow-lg backdrop-blur-xl">
          <div className="font-semibold text-amber-200">Entry zone</div>
          <div className="mt-1 font-semibold text-rose-200">Stop line</div>
          <div className="mt-1 font-semibold text-sky-200">Target line</div>
        </div>
      ) : null}
    </div>
  );
}
