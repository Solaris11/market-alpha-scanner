import {
  LineStyle,
  type CandlestickData,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { buildResearchContextLevels as buildResearchLevels } from "@/lib/trading/research-levels";
import type { ChartCandle, ChartSignalMarker, ChartTradeLevels } from "./SymbolChart";

export type NormalizedTradeLevels = Required<ChartTradeLevels>;
export type ChartResearchLevel = {
  color: string;
  label: "Support" | "Resistance" | "Entry zone" | "Stop" | "Target";
  lineStyle: LineStyle;
  price: number;
  priority: number;
};

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

export function addResearchContextLines(candleSeries: ISeriesApi<"Candlestick">, levels: ChartResearchLevel[]) {
  for (const level of levels) {
    addPriceLine(candleSeries, level.price, level.color, level.lineStyle, level.label);
  }
}

export function buildResearchContextLevels(candles: ChartCandle[], tradeLevels?: NormalizedTradeLevels, maxLevels = 7): ChartResearchLevel[] {
  return buildResearchLevels(candles, tradeLevels, maxLevels).map((level) => ({
    color: level.color,
    label: level.label,
    lineStyle: level.lineKind === "solid" ? LineStyle.Solid : LineStyle.Dashed,
    price: level.price,
    priority: level.priority,
  }));
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

function validLevel(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
