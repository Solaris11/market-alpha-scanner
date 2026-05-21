import type { ChartCandle, ChartSignalMarker, ChartSignalMarkerType } from "./SymbolChart";
import type { NormalizedTradeLevels } from "./symbol-chart-utils";

export type ChartOverlayFamily = "confidence" | "events" | "levels" | "macro" | "memory" | "replay" | "risk";

export type ChartIntelligenceTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type ChartIndicatorId = "ema20" | "ema50" | "rangePressure";

export type ChartIndicatorDefinition = {
  color: string;
  description: string;
  id: ChartIndicatorId;
  label: string;
  tone: ChartIntelligenceTone;
};

export type ChartIndicatorPoint = {
  time: string;
  value: number;
};

export type ChartIndicatorSeries = ChartIndicatorDefinition & {
  points: ChartIndicatorPoint[];
};

export type ChartIntelligenceZone = {
  family: ChartOverlayFamily;
  heightPct: number;
  id: string;
  label: string;
  leftPct: number;
  narrative: string;
  tone: ChartIntelligenceTone;
  topPct: number;
  widthPct: number;
};

export type ChartStoryPoint = {
  detail: string;
  family: ChartOverlayFamily;
  title: string;
  tone: ChartIntelligenceTone;
};

export type ChartCompareRow = {
  detail: string;
  label: string;
  tone: ChartIntelligenceTone;
  value: string;
};

export type ChartWorkflowSummary = {
  activeFamilies: number;
  activeIndicators: number;
  candleCount: number;
  drawingCount: number;
  markerCount: number;
  narrative: string;
};

export const CHART_INDICATORS: ChartIndicatorDefinition[] = [
  {
    color: "#22d3ee",
    description: "Shorter-term average of validated closes. Useful for trend slope and near-term structure.",
    id: "ema20",
    label: "EMA 20",
    tone: "cyan",
  },
  {
    color: "#a78bfa",
    description: "Intermediate average of validated closes. Useful for broader trend context.",
    id: "ema50",
    label: "EMA 50",
    tone: "violet",
  },
  {
    color: "#fb7185",
    description: "Range expansion pressure derived from validated high-low ranges. Useful for uncertainty and shock context.",
    id: "rangePressure",
    label: "Range Pressure",
    tone: "rose",
  },
];

export const DEFAULT_CHART_INDICATORS: ChartIndicatorId[] = ["ema20", "ema50"];

export const CHART_OVERLAY_FAMILIES: Array<{ family: ChartOverlayFamily; label: string }> = [
  { family: "replay", label: "Replay" },
  { family: "macro", label: "Macro" },
  { family: "risk", label: "Risk" },
  { family: "events", label: "Events" },
  { family: "confidence", label: "Confidence" },
  { family: "memory", label: "Memory" },
  { family: "levels", label: "Levels" },
];

export const DEFAULT_CHART_OVERLAY_FAMILIES: ChartOverlayFamily[] = CHART_OVERLAY_FAMILIES.map((item) => item.family);

export function indicatorDefinition(id: ChartIndicatorId): ChartIndicatorDefinition {
  return CHART_INDICATORS.find((indicator) => indicator.id === id) ?? CHART_INDICATORS[0]!;
}

export function buildChartIndicatorSeries(candles: ChartCandle[], enabledIndicators: ChartIndicatorId[]): ChartIndicatorSeries[] {
  const enabled = new Set(enabledIndicators);
  const series: ChartIndicatorSeries[] = [];
  if (!candles.length) return series;
  if (enabled.has("ema20")) series.push({ ...indicatorDefinition("ema20"), points: buildEmaSeries(candles, 20) });
  if (enabled.has("ema50")) series.push({ ...indicatorDefinition("ema50"), points: buildEmaSeries(candles, 50) });
  if (enabled.has("rangePressure")) series.push({ ...indicatorDefinition("rangePressure"), points: buildRangePressureSeries(candles) });
  return series.filter((item) => item.points.length >= 2);
}

export function buildChartWorkflowSummary({
  candleCount,
  drawingCount,
  enabledFamilies,
  enabledIndicators,
  markerCount,
}: {
  candleCount: number;
  drawingCount: number;
  enabledFamilies: ChartOverlayFamily[];
  enabledIndicators: ChartIndicatorId[];
  markerCount: number;
}): ChartWorkflowSummary {
  const activeFamilies = enabledFamilies.length;
  const activeIndicators = enabledIndicators.length;
  const narrativeParts: string[] = [];
  if (markerCount > 0) narrativeParts.push(`${markerCount} synchronized intelligence marker${markerCount === 1 ? "" : "s"}`);
  if (activeIndicators > 0) narrativeParts.push(`${activeIndicators} managed indicator${activeIndicators === 1 ? "" : "s"}`);
  if (drawingCount > 0) narrativeParts.push(`${drawingCount} user drawing${drawingCount === 1 ? "" : "s"}`);
  if (!narrativeParts.length) narrativeParts.push("price-only validated chart context");

  return {
    activeFamilies,
    activeIndicators,
    candleCount,
    drawingCount,
    markerCount,
    narrative: `${narrativeParts.join(", ")} across ${candleCount.toLocaleString("en-US")} validated candle${candleCount === 1 ? "" : "s"}.`,
  };
}

export function overlayFamilyForMarker(type: ChartSignalMarkerType): ChartOverlayFamily {
  if (type === "MACRO") return "macro";
  if (type === "REPLAY") return "replay";
  if (type === "MEMORY") return "memory";
  if (type === "ALERT" || type === "EVENT") return "events";
  if (type === "CONTRADICTION" || type === "FAILURE" || type === "RISK" || type === "SHOCK" || type === "STALE" || type === "STOP" || type === "VOLATILITY") return "risk";
  return "confidence";
}

export function familyLabel(family: ChartOverlayFamily): string {
  return CHART_OVERLAY_FAMILIES.find((item) => item.family === family)?.label ?? family;
}

export function toneForFamily(family: ChartOverlayFamily): ChartIntelligenceTone {
  if (family === "risk" || family === "events") return "rose";
  if (family === "macro") return "cyan";
  if (family === "replay" || family === "memory") return "violet";
  if (family === "levels") return "amber";
  return "emerald";
}

export function buildChartIntelligenceZones({
  candles,
  enabledFamilies,
  levels,
  signals,
}: {
  candles: ChartCandle[];
  enabledFamilies: ChartOverlayFamily[];
  levels: NormalizedTradeLevels;
  signals: ChartSignalMarker[];
}): ChartIntelligenceZone[] {
  if (!candles.length) return [];
  const enabled = new Set(enabledFamilies);
  const zones: ChartIntelligenceZone[] = [];
  const signalZones = signals
    .filter((signal) => enabled.has(overlayFamilyForMarker(signal.type)))
    .slice(-14);

  for (const [index, signal] of signalZones.entries()) {
    const zone = zoneFromSignal(signal, candles, index);
    if (zone) zones.push(zone);
  }

  if (enabled.has("levels")) {
    zones.push(...zonesFromLevels(candles, levels));
  }

  zones.push(...zonesFromPriceBehavior(candles, levels, enabled));
  return zones.slice(0, 18);
}

export function buildChartStoryPoints(candles: ChartCandle[], signals: ChartSignalMarker[], levels: NormalizedTradeLevels): ChartStoryPoint[] {
  const counts = countFamilies(signals);
  const story: ChartStoryPoint[] = [];
  const priceStory = priceBehaviorStory(candles, levels);

  if ((counts.get("risk") ?? 0) > 0) {
    story.push({
      detail: "Risk, stale, volatility, shock, or contradiction markers are present in the selected range. Treat the price move as conditional until risk context improves.",
      family: "risk",
      title: "Risk layer is active",
      tone: "rose",
    });
  }
  if ((counts.get("macro") ?? 0) > 0) {
    story.push({
      detail: "Macro markers are synchronized to the chart, so the move should be interpreted with current regime, breadth, volatility, and liquidity context.",
      family: "macro",
      title: "Macro context is attached",
      tone: "cyan",
    });
  }
  if ((counts.get("replay") ?? 0) > 0 || (counts.get("memory") ?? 0) > 0) {
    story.push({
      detail: "Replay or Market Memory markers indicate historical-context evidence exists. Similarity is context for research, not a forecast.",
      family: "replay",
      title: "Historical memory is visible",
      tone: "violet",
    });
  }
  if ((counts.get("confidence") ?? 0) > 0) {
    story.push({
      detail: "Confidence and decision markers show where the intelligence state changed, not only where price moved.",
      family: "confidence",
      title: "Confidence evolved on-chart",
      tone: "emerald",
    });
  }
  if (priceStory) story.push(priceStory);
  if (!story.length) {
    story.push({
      detail: "This range currently has validated price history but no synchronized replay, risk, macro, or confidence overlays. TradeVeto does not draw unsupported intelligence.",
      family: "levels",
      title: "Price-only range",
      tone: "amber",
    });
  }
  return story.slice(0, 5);
}

export function buildChartCompareRows(candles: ChartCandle[], signals: ChartSignalMarker[], levels: NormalizedTradeLevels): ChartCompareRow[] {
  const counts = countFamilies(signals);
  const move = summarizeMove(candles);
  const hasLevels = [levels.entry, levels.entryLow, levels.entryHigh, levels.stop, levels.target].some((value) => value !== null);
  return [
    {
      detail: "Calculated from visible validated close prices.",
      label: "Visible move",
      tone: move.changePct === null ? "amber" : move.changePct >= 0 ? "emerald" : "rose",
      value: move.label,
    },
    {
      detail: "Risk, contradiction, stale, volatility, failure, shock, and stop markers.",
      label: "Risk overlays",
      tone: (counts.get("risk") ?? 0) > 0 ? "rose" : "emerald",
      value: `${counts.get("risk") ?? 0}`,
    },
    {
      detail: "Macro regime and broad-market context markers synchronized to the same timeline.",
      label: "Macro overlays",
      tone: (counts.get("macro") ?? 0) > 0 ? "cyan" : "amber",
      value: `${counts.get("macro") ?? 0}`,
    },
    {
      detail: "Replay and Market Memory evidence visible in this range.",
      label: "Historical context",
      tone: (counts.get("replay") ?? 0) + (counts.get("memory") ?? 0) > 0 ? "violet" : "amber",
      value: `${(counts.get("replay") ?? 0) + (counts.get("memory") ?? 0)}`,
    },
    {
      detail: "Research-only entry, stop, target, support, and resistance context.",
      label: "Level sync",
      tone: hasLevels ? "cyan" : "amber",
      value: hasLevels ? "Active" : "Limited",
    },
  ];
}

function zoneFromSignal(signal: ChartSignalMarker, candles: ChartCandle[], index: number): ChartIntelligenceZone | null {
  const candleIndex = nearestCandleIndex(candles, signal.time);
  if (candleIndex === null) return null;
  const family = overlayFamilyForMarker(signal.type);
  const leftPct = candles.length <= 1 ? 50 : (candleIndex / (candles.length - 1)) * 100;
  const widthPct = clamp(100 / Math.max(candles.length, 1) * 4.5, 3.5, 9);
  const vertical = verticalBandForMarker(signal.type);
  return {
    family,
    heightPct: vertical.heightPct,
    id: `signal-${signal.type}-${signal.time}-${index}`,
    label: signal.text ?? markerTypeDisplay(signal.type),
    leftPct: clamp(leftPct - widthPct / 2, 0, 100 - widthPct),
    narrative: signal.source ?? signal.uncertainty ?? "Validated chart intelligence marker.",
    tone: toneForMarker(signal.type),
    topPct: vertical.topPct,
    widthPct,
  };
}

function zonesFromLevels(candles: ChartCandle[], levels: NormalizedTradeLevels): ChartIntelligenceZone[] {
  const bounds = priceBounds(candles);
  if (!bounds) return [];
  const zones: ChartIntelligenceZone[] = [];
  if (levels.entryLow !== null && levels.entryHigh !== null) {
    const top = priceToYPercent(Math.max(levels.entryLow, levels.entryHigh), bounds);
    const bottom = priceToYPercent(Math.min(levels.entryLow, levels.entryHigh), bounds);
    zones.push({
      family: "levels",
      heightPct: clamp(bottom - top, 4, 18),
      id: "entry-zone-context",
      label: "Entry context",
      leftPct: 0,
      narrative: "Scanner-provided entry zone drawn as research context only.",
      tone: "amber",
      topPct: clamp(top, 0, 94),
      widthPct: 100,
    });
  }
  if (levels.stop !== null) zones.push(horizontalLevelZone("stop-zone-context", "Stop / invalidation", "Scanner-provided invalidation level. Not a trade instruction.", levels.stop, bounds, "risk", "rose"));
  if (levels.target !== null) zones.push(horizontalLevelZone("target-zone-context", "Target context", "Scanner-provided target context. Not a promise or forecast.", levels.target, bounds, "confidence", "cyan"));
  return zones;
}

function zonesFromPriceBehavior(candles: ChartCandle[], levels: NormalizedTradeLevels, enabled: Set<ChartOverlayFamily>): ChartIntelligenceZone[] {
  const latest = candles[candles.length - 1];
  if (!latest) return [];
  const zones: ChartIntelligenceZone[] = [];
  const widthPct = 18;
  const leftPct = 100 - widthPct;

  if (enabled.has("risk") && levels.stop !== null && latest.close <= levels.stop * 1.03) {
    zones.push({
      family: "risk",
      heightPct: 100,
      id: "failure-pressure-zone",
      label: "Failure zone",
      leftPct,
      narrative: "Latest validated close is near scanner invalidation context.",
      tone: "rose",
      topPct: 0,
      widthPct,
    });
  }
  if (enabled.has("confidence") && levels.entryHigh !== null && latest.close >= levels.entryHigh * 1.01) {
    zones.push({
      family: "confidence",
      heightPct: 100,
      id: "breakout-pressure-zone",
      label: "Breakout zone",
      leftPct,
      narrative: "Latest validated close is above the scanner entry context.",
      tone: "emerald",
      topPct: 0,
      widthPct,
    });
  }
  if (enabled.has("risk") && isVolatilityExpanding(candles)) {
    zones.push({
      family: "risk",
      heightPct: 72,
      id: "volatility-expansion-zone",
      label: "Volatility expansion",
      leftPct: Math.max(0, leftPct - 10),
      narrative: "Recent validated candle ranges are wider than the trailing range baseline.",
      tone: "rose",
      topPct: 0,
      widthPct: Math.min(26, widthPct + 8),
    });
  }
  return zones;
}

function horizontalLevelZone(
  id: string,
  label: string,
  narrative: string,
  price: number,
  bounds: { max: number; min: number },
  family: ChartOverlayFamily,
  tone: ChartIntelligenceTone,
): ChartIntelligenceZone {
  const yPct = priceToYPercent(price, bounds);
  return {
    family,
    heightPct: 3.5,
    id,
    label,
    leftPct: 0,
    narrative,
    tone,
    topPct: clamp(yPct - 1.75, 0, 96.5),
    widthPct: 100,
  };
}

function priceBehaviorStory(candles: ChartCandle[], levels: NormalizedTradeLevels): ChartStoryPoint | null {
  const latest = candles[candles.length - 1];
  if (!latest) return null;
  if (levels.stop !== null && latest.close <= levels.stop * 1.03) {
    return {
      detail: "Latest validated price is near scanner invalidation context. The chart is warning about failure risk before the setup is interpreted as attractive.",
      family: "risk",
      title: "Failure boundary is nearby",
      tone: "rose",
    };
  }
  if (levels.entryHigh !== null && latest.close >= levels.entryHigh * 1.01) {
    return {
      detail: "Latest validated price is above entry context. Breakout interpretation still depends on macro, replay, confidence, and risk overlays.",
      family: "confidence",
      title: "Breakout context detected",
      tone: "emerald",
    };
  }
  if (isVolatilityExpanding(candles)) {
    return {
      detail: "Recent validated candle ranges expanded versus the trailing baseline, so the same price move carries higher uncertainty.",
      family: "risk",
      title: "Volatility is expanding",
      tone: "rose",
    };
  }
  return null;
}

function countFamilies(signals: ChartSignalMarker[]): Map<ChartOverlayFamily, number> {
  const counts = new Map<ChartOverlayFamily, number>();
  for (const signal of signals) {
    const family = overlayFamilyForMarker(signal.type);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return counts;
}

function nearestCandleIndex(candles: ChartCandle[], time: string): number | null {
  if (!candles.length) return null;
  const exact = candles.findIndex((candle) => candle.time === time);
  if (exact >= 0) return exact;
  const target = Date.parse(time);
  if (!Number.isFinite(target)) return null;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  candles.forEach((candle, index) => {
    const parsed = Date.parse(candle.time);
    if (!Number.isFinite(parsed)) return;
    const distance = Math.abs(parsed - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return Number.isFinite(bestDistance) ? bestIndex : null;
}

function priceBounds(candles: ChartCandle[]): { max: number; min: number } | null {
  const highs = candles.map((candle) => candle.high).filter(Number.isFinite);
  const lows = candles.map((candle) => candle.low).filter(Number.isFinite);
  if (!highs.length || !lows.length) return null;
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  if (!Number.isFinite(max) || !Number.isFinite(min) || max <= min) return null;
  return { max, min };
}

function priceToYPercent(price: number, bounds: { max: number; min: number }): number {
  const span = Math.max(bounds.max - bounds.min, Math.abs(bounds.max) * 0.01, 1);
  return clamp(((bounds.max - price) / span) * 100, 0, 100);
}

function verticalBandForMarker(type: ChartSignalMarkerType): { heightPct: number; topPct: number } {
  if (type === "REPLAY" || type === "MEMORY") return { heightPct: 54, topPct: 22 };
  if (type === "CONFIDENCE" || type === "FRESHNESS" || type === "ENTER" || type === "TARGET" || type === "BREAKOUT") return { heightPct: 46, topPct: 38 };
  if (type === "MACRO") return { heightPct: 64, topPct: 10 };
  return { heightPct: 72, topPct: 0 };
}

function toneForMarker(type: ChartSignalMarkerType): ChartIntelligenceTone {
  if (type === "BREAKOUT" || type === "CONFIDENCE" || type === "ENTER" || type === "FRESHNESS") return "emerald";
  if (type === "MACRO") return "cyan";
  if (type === "MEMORY" || type === "REPLAY") return "violet";
  if (type === "TARGET" || type === "WAIT") return "amber";
  return "rose";
}

function markerTypeDisplay(type: ChartSignalMarkerType): string {
  if (type === "BREAKOUT") return "Breakout";
  if (type === "FAILURE") return "Failure";
  if (type === "MEMORY") return "Memory";
  if (type === "SHOCK") return "Shock";
  if (type === "VOLATILITY") return "Volatility";
  return type.toLowerCase();
}

function isVolatilityExpanding(candles: ChartCandle[]): boolean {
  if (candles.length < 12) return false;
  const ranges = candles.map((candle) => Math.max(0, candle.high - candle.low));
  const recent = average(ranges.slice(-3));
  const baseline = average(ranges.slice(-12, -3));
  return baseline > 0 && recent / baseline >= 1.45;
}

function summarizeMove(candles: ChartCandle[]): { changePct: number | null; label: string } {
  const first = candles[0]?.close;
  const last = candles[candles.length - 1]?.close;
  if (typeof first !== "number" || typeof last !== "number" || !Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return { changePct: null, label: "Limited" };
  }
  const changePct = ((last - first) / first) * 100;
  return { changePct, label: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` };
}

function buildEmaSeries(candles: ChartCandle[], period: number): ChartIndicatorPoint[] {
  if (candles.length < Math.max(2, Math.floor(period / 2))) return [];
  const smoothing = 2 / (period + 1);
  const points: ChartIndicatorPoint[] = [];
  let ema: number | null = null;
  candles.forEach((candle, index) => {
    if (!Number.isFinite(candle.close)) return;
    ema = ema === null ? candle.close : candle.close * smoothing + ema * (1 - smoothing);
    if (index >= Math.floor(period / 2) - 1) {
      points.push({
        time: candle.time,
        value: Number(ema.toFixed(4)),
      });
    }
  });
  return points;
}

function buildRangePressureSeries(candles: ChartCandle[]): ChartIndicatorPoint[] {
  if (candles.length < 8) return [];
  const ranges = candles.map((candle) => Math.max(0, candle.high - candle.low));
  const baselineWindow = Math.min(14, Math.max(5, Math.floor(candles.length / 4)));
  return candles
    .map((candle, index): ChartIndicatorPoint | null => {
      if (index < baselineWindow) return null;
      const baseline = average(ranges.slice(Math.max(0, index - baselineWindow), index));
      if (baseline <= 0) return null;
      const pressureRatio = ranges[index]! / baseline;
      const pressure = candle.close + (pressureRatio - 1) * candle.close * 0.03;
      return {
        time: candle.time,
        value: Number(pressure.toFixed(4)),
      };
    })
    .filter((point): point is ChartIndicatorPoint => point !== null);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
