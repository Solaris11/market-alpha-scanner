import {
  LineStyle,
  type CandlestickData,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { buildResearchContextLevels as buildResearchLevels } from "@/lib/trading/research-levels";
import type { ChartCandle, ChartSignalMarker, ChartTradeLevels } from "./SymbolChart";
import { markerVisualPolicy } from "./symbol-chart-marker-policy";

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
    target2: validLevel(levels?.target2),
    target3: validLevel(levels?.target3),
  };
}

export function addTradeLevelLines(candleSeries: ISeriesApi<"Candlestick">, levels: NormalizedTradeLevels) {
  addPriceLine(candleSeries, levels.entry, "#f59e0b", LineStyle.Dashed, "Ideal entry");
  addPriceLine(candleSeries, levels.stop, "#ef4444", LineStyle.Solid, "Stop / invalidation");
  // The R-target ladder. T1 solid and brightest; T2/T3 dashed but still
  // saturated so their axis-label chips stay readable inside the breakout-zone
  // shaded band (the earlier light blues washed out there).
  addPriceLine(candleSeries, levels.target, "#38bdf8", LineStyle.Solid, "Target 1");
  addPriceLine(candleSeries, levels.target2, "#0ea5e9", LineStyle.Dashed, "Target 2");
  addPriceLine(candleSeries, levels.target3, "#0284c7", LineStyle.Dashed, "Target 3");
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
  const policy = markerVisualPolicy(signal.type);
  return { ...base, color: policy.color, position: policy.position, shape: policy.shape, text: signal.text ?? policy.fallbackText };
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


// --- Volume (item 2) -------------------------------------------------------
// Volume already rides in the price-history rows the server ships; the chart
// simply dropped it. These surface it as a histogram + a reference average so a
// trader can answer "is this move backed by real volume?" without any new
// payload or library. Never fabricates a bar: a candle without finite volume is
// skipped, not treated as zero.

export type ChartVolumePoint = { time: Time; value: number; color: string };

const VOLUME_UP = "rgba(38,166,154,0.5)";
const VOLUME_DOWN = "rgba(239,83,80,0.5)";

export function hasVolume(candles: ChartCandle[]): boolean {
  return candles.some((candle) => typeof candle.volume === "number" && Number.isFinite(candle.volume) && candle.volume > 0);
}

export function toVolumeData(candles: ChartCandle[]): ChartVolumePoint[] {
  const out: ChartVolumePoint[] = [];
  for (const candle of candles) {
    const volume = candle.volume;
    if (typeof volume !== "number" || !Number.isFinite(volume) || volume <= 0) continue;
    out.push({ color: candle.close >= candle.open ? VOLUME_UP : VOLUME_DOWN, time: candle.time as Time, value: volume });
  }
  return out;
}

// Rolling mean of volume over the last `period` candles that carry volume. The
// reference line that turns raw bars into "above / below average" -- the actual
// signal a trader reads for volume confirmation. Only emitted once enough real
// bars exist, so it never implies confidence the data cannot support.
export function volumeAverageLine(candles: ChartCandle[], period = 20): Array<{ time: Time; value: number }> {
  const vols = candles
    .filter((c) => typeof c.volume === "number" && Number.isFinite(c.volume) && (c.volume as number) > 0)
    .map((c) => ({ time: c.time, value: c.volume as number }));
  if (vols.length < period) return [];
  const out: Array<{ time: Time; value: number }> = [];
  let sum = 0;
  for (let i = 0; i < vols.length; i += 1) {
    sum += vols[i]!.value;
    if (i >= period) sum -= vols[i - period]!.value;
    if (i >= period - 1) out.push({ time: vols[i]!.time as Time, value: sum / period });
  }
  return out;
}
