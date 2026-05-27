import type { InteractiveChartPeriod } from "@/lib/interactive-chart-data";
import type { ChartIndicatorId, ChartOverlayFamily } from "./chart-intelligence-overlays";
import type { ChartLayoutMode } from "./chart-workflow-storage";
import type { ChartCandle, ChartSignalMarker, ChartTradeLevels } from "./SymbolChart";

export type ChartDecisionWorkstationStatus = "available" | "limited";

export type ChartDecisionWorkstationCapability = {
  detail: string;
  label: string;
  status: ChartDecisionWorkstationStatus;
};

export type ChartDecisionWorkstationOverlayId =
  | "aiDecisionLayer"
  | "anchoredVwap"
  | "atrBands"
  | "liquidityZones"
  | "marketRegime"
  | "relativeStrength"
  | "replayPlayback"
  | "sessionVolume"
  | "strategyZones"
  | "volumeProfile";

export type ChartDecisionWorkstationOverlay = {
  evidence: string;
  id: ChartDecisionWorkstationOverlayId;
  label: string;
  reason?: string;
  source: string;
  status: ChartDecisionWorkstationStatus;
  summary: string;
};

export type ChartDecisionZone = {
  label: string;
  source: string;
  status: ChartDecisionWorkstationStatus;
  value: string;
};

export type ChartDecisionLayer = {
  confirms: string;
  confidenceChanged: string;
  invalidates: string;
  setupQuality: "limited" | "mixed" | "strong" | "weak";
  whyExists: string;
};

export type ChartReplayPlaybackModel = {
  markers: Array<{
    label: string;
    time: string;
    type: string;
  }>;
  reason?: string;
  status: ChartDecisionWorkstationStatus;
};

export type ChartDecisionWorkstationModel = {
  advancedOverlays: ChartDecisionWorkstationOverlay[];
  capabilities: ChartDecisionWorkstationCapability[];
  decisionLayer: ChartDecisionLayer;
  latestClose: number | null;
  period: InteractiveChartPeriod;
  replay: ChartReplayPlaybackModel;
  strategyZones: ChartDecisionZone[];
  symbol: string;
};

export type BuildChartDecisionWorkstationInput = {
  candles: ChartCandle[];
  enabledIndicators: ChartIndicatorId[];
  enabledOverlayFamilies: ChartOverlayFamily[];
  interpretation?: string | null;
  layoutMode: ChartLayoutMode;
  period: InteractiveChartPeriod;
  scannerScore?: number | null;
  signals: ChartSignalMarker[];
  symbol: string;
  tradeLevels?: ChartTradeLevels;
};

type CandleWithVolume = ChartCandle & {
  volume: number;
};

const UNSUPPORTED_DECISION_CLAIMS = [
  "guaranteed",
  "sure thing",
  "will go",
  "will rise",
  "will fall",
  "must buy",
  "must sell",
  "should buy",
  "should sell",
  "risk-free",
];

export function buildChartDecisionWorkstationModel(input: BuildChartDecisionWorkstationInput): ChartDecisionWorkstationModel {
  const candles = normalizeWorkstationCandles(input.candles);
  const latestClose = candles.at(-1)?.close ?? null;
  const volumeCandles = candlesWithVolume(candles);
  const hasVolume = volumeCandles.length >= Math.max(2, Math.floor(candles.length * 0.8));
  const replayMarkers = input.signals
    .filter((signal) => signal.type === "REPLAY" || signal.type === "MEMORY")
    .slice(-12)
    .map((signal) => ({
      label: signal.text?.trim() || signal.source?.trim() || signal.type,
      time: signal.time,
      type: signal.type,
    }));
  const macroRiskMarkers = input.signals.filter((signal) => signal.type === "MACRO" || signal.type === "RISK" || signal.type === "VOLATILITY" || signal.type === "SHOCK");
  const normalizedLevels = normalizeWorkstationTradeLevels(input.tradeLevels);
  const atr = averageTrueRange(candles, 14);
  const liquidity = liquidityZoneSummary(candles);
  const move = summarizeMove(candles);
  const score = boundedScore(input.scannerScore);

  return {
    advancedOverlays: [
      buildAnchoredVwapOverlay(candles, volumeCandles, hasVolume),
      buildVolumeProfileOverlay(volumeCandles, hasVolume),
      buildSessionVolumeOverlay(volumeCandles, hasVolume),
      atr !== null
        ? availableOverlay("atrBands", "ATR bands", `${formatMoney(atr)} ATR context from validated OHLC ranges.`, "Validated OHLC candles", "Average true range is computed from real high/low/close history.")
        : limitedOverlay("atrBands", "ATR bands", "At least 15 validated candles are required before ATR bands can be shown.", "Validated OHLC candles"),
      liquidity.status === "available"
        ? availableOverlay("liquidityZones", "Liquidity zones", liquidity.summary, "Validated OHLC candles", "Price-touch liquidity proxy only; no order-book liquidity is claimed.")
        : limitedOverlay("liquidityZones", "Liquidity zones", liquidity.reason, "Validated OHLC candles"),
      input.enabledIndicators.includes("ema20") || input.enabledIndicators.includes("ema50") || input.enabledIndicators.includes("sma20")
        ? limitedOverlay("relativeStrength", "Relative strength", "Benchmark-relative strength needs a second validated benchmark series. Current chart has managed trend overlays only.", "Chart workspace")
        : limitedOverlay("relativeStrength", "Relative strength", "Enable a trend template and attach benchmark data before relative strength can be computed.", "Chart workspace"),
      macroRiskMarkers.length > 0 || input.enabledOverlayFamilies.includes("macro") || input.enabledOverlayFamilies.includes("risk")
        ? availableOverlay("marketRegime", "Market regime overlay", `${macroRiskMarkers.length} macro/risk marker${macroRiskMarkers.length === 1 ? "" : "s"} available for regime context.`, "Scanner and macro marker stream", "Regime context is descriptive and source-bound.")
        : limitedOverlay("marketRegime", "Market regime overlay", "No macro, risk, volatility, or shock markers are present in this chart range.", "Scanner and macro marker stream"),
      hasAnyStrategyLevel(normalizedLevels)
        ? availableOverlay("strategyZones", "Strategy zones", "Entry, stop, target, and invalidation zones are rendered from real scanner trade-level fields.", "Scanner trade levels", "Zones are research context, not order instructions.")
        : limitedOverlay("strategyZones", "Strategy zones", "No source-backed entry, stop, or target levels are attached to this symbol payload.", "Scanner trade levels"),
      replayMarkers.length > 0
        ? availableOverlay("replayPlayback", "Replay playback", `${replayMarkers.length} replay/memory marker${replayMarkers.length === 1 ? "" : "s"} can drive a historical scrubber.`, "Replay and market-memory markers", "Playback uses historical markers only.")
        : limitedOverlay("replayPlayback", "Replay playback", "No replay or market-memory markers are available for this chart range.", "Replay and market-memory markers"),
      availableOverlay("aiDecisionLayer", "Decision layer", "The decision layer explains setup context, weakness, invalidation, confirmation, and confidence changes without predictive claims.", "Derived from validated chart, levels, markers, and scanner score", "Research-only explanation layer."),
    ],
    capabilities: buildCapabilities(input.layoutMode),
    decisionLayer: buildDecisionLayer({
      hasReplay: replayMarkers.length > 0,
      interpretation: input.interpretation,
      latestClose,
      levels: normalizedLevels,
      macroRiskCount: macroRiskMarkers.length,
      move,
      score,
      symbol: input.symbol,
    }),
    latestClose,
    period: input.period,
    replay: replayMarkers.length > 0
      ? { markers: replayMarkers, status: "available" }
      : { markers: [], reason: "No replay or memory markers are present in the current validated range.", status: "limited" },
    strategyZones: buildStrategyZones(normalizedLevels),
    symbol: input.symbol.trim().toUpperCase(),
  };
}

export function chartDecisionTextContainsUnsupportedClaim(value: string): boolean {
  const normalized = value.toLowerCase();
  return UNSUPPORTED_DECISION_CLAIMS.some((claim) => normalized.includes(claim));
}

function buildCapabilities(layoutMode: ChartLayoutMode): ChartDecisionWorkstationCapability[] {
  const multiPanelActive = layoutMode !== "focus";
  return [
    {
      detail: `Focus, split, grid, and stack layouts are persisted. Current layout: ${layoutMode}.`,
      label: "Split and compare layouts",
      status: "available",
    },
    {
      detail: "Timeframe changes are shared across fullscreen panes and saved in the chart workspace.",
      label: "Synced timeframe",
      status: "available",
    },
    {
      detail: multiPanelActive
        ? "Crosshair movement is synchronized across active fullscreen panes."
        : "Activate split, grid, or stack layout to synchronize cursors across panes.",
      label: "Synced cursors",
      status: multiPanelActive ? "available" : "limited",
    },
    {
      detail: "The current workstation links panes for one symbol. Multi-symbol linked groups still require a validated compare-symbol workspace.",
      label: "Synced symbol groups",
      status: "limited",
    },
  ];
}

function buildDecisionLayer({
  hasReplay,
  interpretation,
  latestClose,
  levels,
  macroRiskCount,
  move,
  score,
  symbol,
}: {
  hasReplay: boolean;
  interpretation?: string | null;
  latestClose: number | null;
  levels: NormalizedWorkstationTradeLevels;
  macroRiskCount: number;
  move: { changePct: number | null; tone: "down" | "flat" | "up" };
  score: number | null;
  symbol: string;
}): ChartDecisionLayer {
  const symbolLabel = symbol.trim().toUpperCase() || "This symbol";
  const hasLevels = hasAnyStrategyLevel(levels);
  const setupSignals: string[] = [];
  if (hasLevels) setupSignals.push("scanner trade-level context");
  if (hasReplay) setupSignals.push("replay or market-memory evidence");
  if (macroRiskCount > 0) setupSignals.push(`${macroRiskCount} macro/risk marker${macroRiskCount === 1 ? "" : "s"}`);
  if (score !== null) setupSignals.push(`scanner score ${Math.round(score)}`);
  if (!setupSignals.length && interpretation) setupSignals.push("chart interpretation text");

  let setupQuality: ChartDecisionLayer["setupQuality"] = "limited";
  if (score !== null && score >= 72 && hasLevels && macroRiskCount <= 1) setupQuality = "strong";
  else if (score !== null && score < 45) setupQuality = "weak";
  else if (hasLevels || hasReplay || macroRiskCount > 0 || score !== null) setupQuality = "mixed";

  const invalidation = levels.stop !== null
    ? `Research context weakens if price loses the source-backed stop/invalidation zone near ${formatMoney(levels.stop)}.`
    : "No source-backed stop or invalidation level is attached yet; treat setup invalidation as limited.";
  const target = levels.target !== null ? `target context near ${formatMoney(levels.target)}` : "source-backed target context";
  const entry = levels.entryLow !== null && levels.entryHigh !== null
    ? `entry zone ${formatMoney(levels.entryLow)}-${formatMoney(levels.entryHigh)}`
    : levels.entry !== null
      ? `entry context near ${formatMoney(levels.entry)}`
      : "a source-backed entry zone";
  const confirms = hasLevels
    ? `Confirmation requires validated price behavior around ${entry} plus renewed scanner/macro evidence before relying on ${target}.`
    : "Confirmation is limited until scanner levels, replay markers, or source-backed catalysts are attached.";
  const confidenceChanged = confidenceChangeNarrative(score, move, macroRiskCount, latestClose);

  return {
    confirms,
    confidenceChanged,
    invalidates: invalidation,
    setupQuality,
    whyExists: setupSignals.length
      ? `${symbolLabel} workstation context exists because ${setupSignals.join(", ")} are present in the validated payload.`
      : `${symbolLabel} has a price-only workstation state; TradeVeto is not adding unsupported setup claims.`,
  };
}

function confidenceChangeNarrative(score: number | null, move: { changePct: number | null; tone: "down" | "flat" | "up" }, macroRiskCount: number, latestClose: number | null): string {
  const closeText = latestClose === null ? "latest close unavailable" : `latest close ${formatMoney(latestClose)}`;
  if (score === null && move.changePct === null) return `Confidence is limited because scanner score and range move are unavailable; ${closeText}.`;
  const parts: string[] = [];
  if (score !== null) parts.push(`scanner score is ${Math.round(score)}`);
  if (move.changePct !== null) parts.push(`selected-range move is ${move.changePct >= 0 ? "+" : ""}${move.changePct.toFixed(2)}%`);
  if (macroRiskCount > 0) parts.push(`${macroRiskCount} macro/risk marker${macroRiskCount === 1 ? "" : "s"} add uncertainty`);
  return `Confidence context is descriptive: ${parts.join(", ")}; ${closeText}.`;
}

function buildStrategyZones(levels: NormalizedWorkstationTradeLevels): ChartDecisionZone[] {
  return [
    zone("Entry", levels.entry ?? midpoint(levels.entryLow, levels.entryHigh), "Scanner trade levels"),
    levels.entryLow !== null || levels.entryHigh !== null
      ? {
          label: "Entry range",
          source: "Scanner trade levels",
          status: "available",
          value: `${formatMoney(levels.entryLow)} - ${formatMoney(levels.entryHigh)}`,
        }
      : {
          label: "Entry range",
          source: "Scanner trade levels",
          status: "limited",
          value: "No source-backed entry range",
        },
    zone("Stop / invalidation", levels.stop, "Scanner trade levels"),
    zone("Take-profit context", levels.target, "Scanner trade levels"),
    riskRewardZone(levels),
  ];
}

function riskRewardZone(levels: NormalizedWorkstationTradeLevels): ChartDecisionZone {
  const entry = levels.entry ?? midpoint(levels.entryLow, levels.entryHigh);
  if (entry === null || levels.stop === null || levels.target === null || Math.abs(entry - levels.stop) <= 0) {
    return {
      label: "Risk/reward box",
      source: "Scanner trade levels",
      status: "limited",
      value: "Requires entry, stop, and target",
    };
  }
  const reward = Math.abs(levels.target - entry);
  const risk = Math.abs(entry - levels.stop);
  return {
    label: "Risk/reward box",
    source: "Scanner trade levels",
    status: "available",
    value: `${(reward / risk).toFixed(2)}R research context`,
  };
}

function zone(label: string, value: number | null, source: string): ChartDecisionZone {
  if (value === null) {
    return {
      label,
      source,
      status: "limited",
      value: "No source-backed level",
    };
  }
  return {
    label,
    source,
    status: "available",
    value: formatMoney(value),
  };
}

function buildAnchoredVwapOverlay(candles: ChartCandle[], volumeCandles: CandleWithVolume[], hasVolume: boolean): ChartDecisionWorkstationOverlay {
  if (!candles.length) return limitedOverlay("anchoredVwap", "Anchored VWAP", "No validated candles exist for VWAP calculation.", "Validated OHLCV candles");
  if (!hasVolume) return limitedOverlay("anchoredVwap", "Anchored VWAP", "Current chart payload is OHLC-only. VWAP remains limited until validated volume is attached.", "Validated OHLCV candles");
  const totals = volumeCandles.reduce((accumulator, candle) => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    return {
      priceVolume: accumulator.priceVolume + typicalPrice * candle.volume,
      volume: accumulator.volume + candle.volume,
    };
  }, { priceVolume: 0, volume: 0 });
  if (totals.volume <= 0) return limitedOverlay("anchoredVwap", "Anchored VWAP", "Validated volume is present but not positive.", "Validated OHLCV candles");
  return availableOverlay("anchoredVwap", "Anchored VWAP", `Anchored VWAP context ${formatMoney(totals.priceVolume / totals.volume)} from validated OHLCV history.`, "Validated OHLCV candles", "VWAP uses source volume only.");
}

function buildVolumeProfileOverlay(volumeCandles: CandleWithVolume[], hasVolume: boolean): ChartDecisionWorkstationOverlay {
  if (!hasVolume) return limitedOverlay("volumeProfile", "Volume profile", "No validated volume provider is attached to the chart candle payload.", "Validated OHLCV candles");
  const totalVolume = volumeCandles.reduce((sum, candle) => sum + candle.volume, 0);
  return availableOverlay("volumeProfile", "Volume profile", `${formatCompact(totalVolume)} total validated volume can be bucketed by price range.`, "Validated OHLCV candles", "Profile is derived from source volume only.");
}

function buildSessionVolumeOverlay(volumeCandles: CandleWithVolume[], hasVolume: boolean): ChartDecisionWorkstationOverlay {
  if (!hasVolume) return limitedOverlay("sessionVolume", "Session volume", "Session volume remains hidden until intraday OHLCV history is supplied.", "Intraday OHLCV provider");
  const latest = volumeCandles.at(-1);
  return latest
    ? availableOverlay("sessionVolume", "Session volume", `Latest validated candle volume ${formatCompact(latest.volume)}.`, "Validated OHLCV candles", "Session volume does not estimate missing intraday data.")
    : limitedOverlay("sessionVolume", "Session volume", "No latest OHLCV candle is available.", "Validated OHLCV candles");
}

function availableOverlay(id: ChartDecisionWorkstationOverlayId, label: string, summary: string, source: string, evidence: string): ChartDecisionWorkstationOverlay {
  return {
    evidence,
    id,
    label,
    source,
    status: "available",
    summary,
  };
}

function limitedOverlay(id: ChartDecisionWorkstationOverlayId, label: string, reason: string, source: string): ChartDecisionWorkstationOverlay {
  return {
    evidence: "No synthetic overlay is rendered.",
    id,
    label,
    reason,
    source,
    status: "limited",
    summary: reason,
  };
}

type NormalizedWorkstationTradeLevels = {
  entry: number | null;
  entryHigh: number | null;
  entryLow: number | null;
  stop: number | null;
  target: number | null;
};

function normalizeWorkstationTradeLevels(levels?: ChartTradeLevels): NormalizedWorkstationTradeLevels {
  return {
    entry: finiteNumber(levels?.entry),
    entryHigh: finiteNumber(levels?.entryHigh),
    entryLow: finiteNumber(levels?.entryLow),
    stop: finiteNumber(levels?.stop),
    target: finiteNumber(levels?.target),
  };
}

function hasAnyStrategyLevel(levels: NormalizedWorkstationTradeLevels): boolean {
  return levels.entry !== null || levels.entryHigh !== null || levels.entryLow !== null || levels.stop !== null || levels.target !== null;
}

function normalizeWorkstationCandles(candles: ChartCandle[]): ChartCandle[] {
  return candles
    .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value)) && candle.time.trim().length > 0)
    .sort((left, right) => left.time.localeCompare(right.time));
}

function candlesWithVolume(candles: ChartCandle[]): CandleWithVolume[] {
  const output: CandleWithVolume[] = [];
  for (const candle of candles) {
    if (!isRecord(candle)) continue;
    const record = candle as Record<string, unknown>;
    const rawVolume = record["volume"];
    const volume = typeof rawVolume === "number" ? rawVolume : typeof rawVolume === "string" ? Number.parseFloat(rawVolume) : Number.NaN;
    if (Number.isFinite(volume) && volume > 0) output.push({ ...candle, volume });
  }
  return output;
}

function averageTrueRange(candles: ChartCandle[], windowSize: number): number | null {
  if (candles.length <= windowSize) return null;
  const ranges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    if (!current || !previous) continue;
    ranges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    ));
  }
  const tail = ranges.slice(-windowSize);
  if (tail.length < windowSize) return null;
  return tail.reduce((sum, value) => sum + value, 0) / tail.length;
}

function liquidityZoneSummary(candles: ChartCandle[]): { reason: string; status: "limited" } | { status: "available"; summary: string } {
  if (candles.length < 30) return { reason: "At least 30 validated candles are required to identify repeated high/low touch zones.", status: "limited" };
  const highs = candles.map((candle) => candle.high).sort((left, right) => left - right);
  const lows = candles.map((candle) => candle.low).sort((left, right) => left - right);
  const support = percentile(lows, 0.18);
  const resistance = percentile(highs, 0.82);
  if (support === null || resistance === null || support >= resistance) return { reason: "Validated high/low distribution is insufficient for a stable zone.", status: "limited" };
  return {
    status: "available",
    summary: `Repeated range-touch zones around ${formatMoney(support)} support context and ${formatMoney(resistance)} resistance context.`,
  };
}

function summarizeMove(candles: ChartCandle[]): { changePct: number | null; tone: "down" | "flat" | "up" } {
  const first = candles[0]?.close;
  const last = candles.at(-1)?.close;
  if (typeof first !== "number" || typeof last !== "number" || !Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return { changePct: null, tone: "flat" };
  }
  const changePct = ((last - first) / first) * 100;
  return {
    changePct,
    tone: Math.abs(changePct) < 0.25 ? "flat" : changePct > 0 ? "up" : "down",
  };
}

function boundedScore(score: number | null | undefined): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return Math.min(100, Math.max(0, score));
}

function midpoint(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;
  return (left + right) / 2;
}

function percentile(values: number[], fraction: number): number | null {
  const clean = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!clean.length) return null;
  const index = Math.min(clean.length - 1, Math.max(0, Math.round((clean.length - 1) * fraction)));
  return clean[index] ?? null;
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "limited";
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2, style: "currency" });
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" }).format(value);
}
