import {
  LineStyle,
  type CandlestickData,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { ChartCandle, ChartSignalMarker, ChartTradeLevels } from "./SymbolChart";

export const FALLBACK_DAYS = 30;
export const FALLBACK_END_DATE = "2026-04-29";

export type NormalizedTradeLevels = Required<ChartTradeLevels>;

export function toChartData(candles: ChartCandle[]): Array<CandlestickData<Time>> {
  return candles.map((candle) => ({
    close: candle.close,
    high: candle.high,
    low: candle.low,
    open: candle.open,
    time: candle.time as Time,
  }));
}

export function toSeriesMarkers(signals: ChartSignalMarker[]): Array<SeriesMarker<Time>> {
  return signals.map((signal, index) => markerForSignal(signal, index));
}

export function normalizeCandles(candles?: ChartCandle[]): ChartCandle[] {
  if (!candles?.length) return [];
  const byTime = new Map<string, ChartCandle>();
  for (const candle of candles) {
    const time = normalizeDate(candle.time);
    if (!time || !isValidCandle(candle)) continue;
    byTime.set(time, { ...candle, time });
  }
  return Array.from(byTime.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export function normalizeSignals(signals: ChartSignalMarker[]): ChartSignalMarker[] {
  return signals
    .map((signal) => ({ ...signal, time: normalizeDate(signal.time) ?? "" }))
    .filter((signal) => signal.time)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function generateFallbackCandles(symbol: string): ChartCandle[] {
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

export function normalizeTradeLevels(levels?: ChartTradeLevels): NormalizedTradeLevels {
  const entry = validLevel(levels?.entry);
  const entryLow = validLevel(levels?.entryLow) ?? entry;
  const entryHigh = validLevel(levels?.entryHigh) ?? entry;
  return {
    entry,
    entryHigh: entryLow !== null && entryHigh !== null ? Math.max(entryLow, entryHigh) : entryHigh,
    entryLow: entryLow !== null && entryHigh !== null ? Math.min(entryLow, entryHigh) : entryLow,
    stop: validLevel(levels?.stop),
    target: validLevel(levels?.target),
  };
}

export function addTradeLevelLines(candleSeries: ISeriesApi<"Candlestick">, levels: NormalizedTradeLevels) {
  addPriceLine(candleSeries, levels.entry, "#f59e0b", LineStyle.Dashed, "Entry zone");
  addPriceLine(candleSeries, levels.stop, "#ef4444", LineStyle.Solid, "Stop");
  addPriceLine(candleSeries, levels.target, "#38bdf8", LineStyle.Solid, "Target");
}

function addPriceLine(candleSeries: ISeriesApi<"Candlestick">, price: number | null, color: string, lineStyle: LineStyle, title: string) {
  if (price === null) return;
  candleSeries.createPriceLine({
    axisLabelVisible: true,
    color,
    lineStyle,
    lineWidth: 2,
    price,
    title,
  });
}

function markerForSignal(signal: ChartSignalMarker, index: number): SeriesMarker<Time> {
  const base = { id: `${signal.type}-${signal.time}-${index}`, time: signal.time as Time };
  if (signal.type === "ENTER") return { ...base, color: "#22c55e", position: "belowBar", shape: "arrowUp", text: signal.text ?? "ENTER" };
  if (signal.type === "EXIT") return { ...base, color: "#ef4444", position: "aboveBar", shape: "arrowDown", text: signal.text ?? "EXIT" };
  if (signal.type === "STOP") return { ...base, color: "#dc2626", position: "aboveBar", shape: "arrowDown", text: signal.text ?? "STOP" };
  if (signal.type === "TARGET") return { ...base, color: "#38bdf8", position: "aboveBar", shape: "arrowDown", text: signal.text ?? "TARGET" };
  return { ...base, color: "#f59e0b", position: "belowBar", shape: "circle", text: signal.text ?? "WAIT" };
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

function validLevel(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
