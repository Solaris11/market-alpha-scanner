import { finiteNumber, formatMoney } from "../ui/formatters";

export type ShockMoveWindow = "1y" | "3y" | "5y";
export type ShockDirection = "upside" | "downside" | "two_sided";
export type ShockOutcomeStatus = "complete" | "partial" | "pending";

export type ShockMovePriceBar = {
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
  volume: number | null;
};

export type ShockMovePreconditions = {
  atrPercent: number | null;
  closeVsMa20Pct: number | null;
  closeVsMa50Pct: number | null;
  compressionPercentile: number | null;
  gapPercent: number | null;
  ma20TrendPct: number | null;
  priorFiveDayReturnPct: number | null;
  realizedVolatility10d: number | null;
  returnZScore: number | null;
  volumeSpikeRatio: number | null;
};

export type ShockMoveEvent = {
  atrNormalizedMove: number | null;
  /**
   * Present on the server, dropped before the event crosses to a client
   * component on /terminal. It is by far the heaviest part of the flight
   * payload -- 12,726 of these objects, 15.2 MB of an 18.3 MB document -- and
   * the only consumer, execution-intelligence, now runs on the server there.
   * Readers must treat it as optional rather than assume it survived.
   */
  eventDate: string;
  gapPercent: number | null;
  maxAdverseExcursion5d: number | null;
  maxFavorableExcursion5d: number | null;
  moveType: ShockDirection;
  outcomeStatus: ShockOutcomeStatus;
  preconditions?: ShockMovePreconditions;
  return1d: number;
  return2d: number | null;
  return3d: number | null;
  return5d: number | null;
  return10d: number | null;
  returnZScore: number | null;
  volumeSpikeRatio: number | null;
};

export type ShockMoveReplayStudy = {
  beforeMoveEvidence: string[];
  chaseOutcome: string;
  daysBeforeSignal: number | null;
  eventDate: string;
  maxAdverseExcursion5d: number | null;
  moveType: ShockDirection;
  preMoveDetected: boolean;
  preMoveScore: number;
  pullbackOutcome: string;
  return1d: number;
  return5d: number | null;
  verdict: string;
};

export type ShockTimingValidation = {
  averageDrawdownAfterChasePct: number | null;
  bestHistoricalEntryZone: string;
  bestHistoricalExitZone: string;
  earlyDetectionRate: number | null;
  entryQualityScore: number;
  falsePositiveRate: number | null;
  missedOpportunityRate: number | null;
  pullbackEntrySuccessRate: number | null;
  replayStudies: ShockMoveReplayStudy[];
  shockReliabilityScore: number;
  summary: string;
  timingQualityScore: number;
  validationSampleSize: number;
};

export type ShockMovePattern = {
  asymmetryScore: number;
  averageDrawdownAfterEntry: string;
  averageFollowthrough1d: number | null;
  averageFollowthrough5d: number | null;
  averageProfitPotential: string;
  averageReversal5d: number | null;
  chaseRiskLabel: string;
  chaseRiskScore: number;
  chaseSuccessRate: number | null;
  commonFailureConditions: string[];
  commonPreconditions: string[];
  currentSimilarityScore: number;
  downsideRiskScore: number;
  downsideShockCount: number;
  doNotChaseZone: string;
  evidenceQualityScore?: number;
  falsePositiveRiskScore?: number;
  historicalExitZone: string;
  invalidationZone: string;
  largestDownside1d: number | null;
  largestUpside1d: number | null;
  lastUpdated: string;
  latestEvent: ShockMoveEvent | null;
  liquidityQualityScore?: number;
  lookbackWindow: ShockMoveWindow;
  medianDownsideShock: number | null;
  medianUpsideShock: number | null;
  opportunityScore: number;
  opportunityState: string;
  pullbackSuccessRate: number | null;
  reliabilityScore: number;
  researchEntryZone: string;
  /**
   * shockEvents.length, carried separately so the array can be dropped from
   * the /terminal payload without taking the count with it.
   *
   * Not derivable from upsideShockCount + downsideShockCount, which is the
   * trap this field exists to avoid. Those two count only |return1d| >= 5,
   * while detectShockEvents also admits two-sided events on a z-score, ATR or
   * gap/volume rule; and they are computed over the uncapped event list while
   * shockEvents is capped at 80. The three numbers diverge in both directions.
   */
  shockEventCount: number;
  /**
   * Optional because /terminal ships rows without it.
   *
   * Optional rather than an empty array on purpose: `[]` compiles everywhere
   * and silently yields sampleSize 0 and null coverage, which is exactly the
   * quiet degradation this refactor exists to avoid. Undefined makes the
   * compiler point at every reader instead.
   */
  shockEvents?: ShockMoveEvent[];
  symbol: string;
  timingValidation?: ShockTimingValidation | null;
  twoSidedVolatilityScore: number;
  upsideShockCount: number;
  upsideShockScore: number;
};

export type BuildShockMovePatternInput = {
  bars: ShockMovePriceBar[];
  lookbackWindow: ShockMoveWindow;
  symbol: string;
};

type ComputedBar = ShockMovePriceBar & {
  atrPercent: number | null;
  gapPercent: number | null;
  ma20: number | null;
  ma50: number | null;
  priorFiveDayReturnPct: number | null;
  realizedVolatility10d: number | null;
  return1d: number | null;
  returnZScore: number | null;
  volumeSpikeRatio: number | null;
};

const WINDOW_DAYS: Record<ShockMoveWindow, number> = {
  "1y": 370,
  "3y": 3 * 370,
  "5y": 5 * 370,
};
const PRE_SHOCK_SIGNAL_THRESHOLD = 62;

export function normalizeShockPriceBars(rows: Record<string, unknown>[]): ShockMovePriceBar[] {
  return rows
    .map((row) => {
      const date = textValue(row.date ?? row.datetime ?? row.ts ?? row.timestamp);
      const open = finiteNumber(row.open);
      const high = finiteNumber(row.high);
      const low = finiteNumber(row.low);
      const close = finiteNumber(row.close);
      if (!date || open === null || high === null || low === null || close === null || open <= 0 || high <= 0 || low <= 0 || close <= 0) return null;
      return {
        close,
        date,
        high,
        low,
        open,
        volume: finiteNumber(row.volume),
      };
    })
    .filter((row): row is ShockMovePriceBar => row !== null)
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
}

export function buildShockMovePattern(input: BuildShockMovePatternInput): ShockMovePattern | null {
  const bars = selectWindow(input.bars, input.lookbackWindow);
  if (bars.length < 80) return null;
  const computed = computeBars(bars);
  const events = detectShockEvents(computed);
  const latest = computed[computed.length - 1];
  if (!latest) return null;

  const upsideEvents = events.filter((event) => event.return1d >= 5);
  const downsideEvents = events.filter((event) => event.return1d <= -5);
  const upsideReturns = upsideEvents.map((event) => event.return1d);
  const downsideReturns = downsideEvents.map((event) => event.return1d);
  const followthrough1d = events.map((event) => event.return2d).filter(isFiniteNumber);
  const followthrough5d = events.map((event) => event.return5d).filter(isFiniteNumber);
  const reversals5d = events.map((event) => reversalAfterShock(event)).filter(isFiniteNumber);
  const mfeValues = events.map((event) => event.maxFavorableExcursion5d).filter(isFiniteNumber);
  const maeValues = events.map((event) => event.maxAdverseExcursion5d).filter(isFiniteNumber);
  const currentShockPressure = scoreLatestShockPressure(latest);
  const tailFrequency = events.length / Math.max(1, computed.length);
  const upsideFrequency = upsideEvents.length / Math.max(1, computed.length);
  const downsideFrequency = downsideEvents.length / Math.max(1, computed.length);
  const continuationRate = rate(followthrough5d.map((value) => value > 0));
  const reversalRate = rate(reversals5d.map((value) => value > 0));
  const chaseSuccessRate = rate(events.map((event) => chaseWorked(event)));
  const pullbackSuccessRate = rate(events.map((event) => pullbackWorked(event)));
  const asymmetry = asymmetryScore({ downsideFrequency, events, mfeValues, upsideFrequency });
  const reliability = reliabilityScore(events, continuationRate, bars.length);
  const downsideRisk = downsideRiskScore({ downsideEvents, downsideFrequency, latest, maeValues, reversalRate });
  const twoSided = twoSidedVolatilityScore({ downsideEvents, events, latest, upsideEvents });
  const upsideScore = upsideShockScore({ currentShockPressure, events, latest, upsideEvents, upsideFrequency });
  const similarity = currentSimilarityScore(latest, events);
  const chaseRisk = chaseRiskScore({ latest, upsideEvents });
  const liquidityQuality = liquidityQualityScore(computed, events);
  const opportunity = opportunityScore({ asymmetry, chaseRisk, downsideRisk, reliability, similarity, twoSided, upsideScore });
  const zones = buildResearchZones(latest, computed, events);
  const timingValidation = buildShockTimingValidation({ bars: computed, events, symbol: input.symbol.trim().toUpperCase() });
  const falsePositiveRisk = falsePositiveRiskScore({ events, followthrough5d, liquidityQuality, timingValidation });
  const evidenceQuality = evidenceQualityScore({ barCount: bars.length, events, liquidityQuality, timingValidation });
  const guardedChaseRisk = clamp(chaseRisk + Math.max(0, 55 - liquidityQuality) * 0.22 + falsePositiveRisk * 0.14);
  const guardedDownsideRisk = clamp(downsideRisk + Math.max(0, 52 - liquidityQuality) * 0.16 + falsePositiveRisk * 0.10);
  const calibratedReliability = clamp(reliability * 0.58 + timingValidation.shockReliabilityScore * 0.34 + evidenceQuality * 0.08 - falsePositiveRisk * 0.16);
  const calibratedSimilarity = clamp(similarity * 0.72 + timingValidation.entryQualityScore * 0.18 + timingValidation.timingQualityScore * 0.1);
  const calibratedAsymmetry = clamp(asymmetry * 0.74 + timingValidation.entryQualityScore * 0.12 + (100 - guardedChaseRisk) * 0.08 + evidenceQuality * 0.06);
  const calibratedOpportunity = opportunityScore({
    asymmetry: calibratedAsymmetry,
    chaseRisk: guardedChaseRisk,
    downsideRisk: guardedDownsideRisk,
    reliability: calibratedReliability,
    similarity: calibratedSimilarity,
    twoSided,
    upsideScore,
  });
  const failureConditions = hardenedFailureConditions({
    events,
    falsePositiveRisk,
    followthrough5d,
    liquidityQuality,
    timingValidation,
  });

  // One slice, two fields, so the count cannot drift from the array it counts.
  const cappedEvents = events.slice(-80);

  return {
    asymmetryScore: Math.round(calibratedAsymmetry),
    averageDrawdownAfterEntry: maeValues.length ? `${formatSignedPercent(mean(maeValues))} average five-day drawdown after similar shocks` : "Not enough completed shocks to estimate drawdown yet",
    averageFollowthrough1d: meanOrNull(followthrough1d),
    averageFollowthrough5d: meanOrNull(followthrough5d),
    averageProfitPotential: mfeValues.length ? `${formatSignedPercent(mean(mfeValues))} average five-day upside after similar shocks` : "Not enough completed shocks to estimate upside yet",
    averageReversal5d: meanOrNull(reversals5d),
    chaseRiskLabel: guardedChaseRisk >= 72 ? "Avoid chase" : guardedChaseRisk >= 52 ? "Chase risk elevated" : "Chase risk contained",
    chaseRiskScore: Math.round(guardedChaseRisk),
    chaseSuccessRate,
    commonFailureConditions: failureConditions,
    commonPreconditions: commonPreconditions(events),
    currentSimilarityScore: Math.round(calibratedSimilarity),
    downsideRiskScore: Math.round(guardedDownsideRisk),
    downsideShockCount: downsideEvents.length,
    doNotChaseZone: zones.doNotChaseZone,
    evidenceQualityScore: Math.round(evidenceQuality),
    falsePositiveRiskScore: Math.round(falsePositiveRisk),
    historicalExitZone: zones.historicalExitZone,
    invalidationZone: zones.invalidationZone,
    largestDownside1d: downsideReturns.length ? Math.min(...downsideReturns) : null,
    largestUpside1d: upsideReturns.length ? Math.max(...upsideReturns) : null,
    lastUpdated: new Date().toISOString(),
    latestEvent: latestEvent(events),
    liquidityQualityScore: Math.round(liquidityQuality),
    lookbackWindow: input.lookbackWindow,
    medianDownsideShock: medianOrNull(downsideReturns),
    medianUpsideShock: medianOrNull(upsideReturns),
    opportunityScore: Math.round(calibratedOpportunity),
    opportunityState: opportunityState({ chaseRisk: guardedChaseRisk, downsideRisk: guardedDownsideRisk, opportunity: calibratedOpportunity, twoSided, upsideScore }),
    pullbackSuccessRate,
    reliabilityScore: Math.round(calibratedReliability),
    researchEntryZone: zones.researchEntryZone,
    shockEventCount: cappedEvents.length,
    shockEvents: cappedEvents,
    symbol: input.symbol.trim().toUpperCase(),
    timingValidation,
    twoSidedVolatilityScore: Math.round(twoSided),
    upsideShockCount: upsideEvents.length,
    upsideShockScore: Math.round(upsideScore),
  };
}

export function shockPatternFromDbRow(row: Record<string, unknown>): ShockMovePattern | null {
  const symbol = textValue(row.symbol);
  const lookbackWindow = asLookbackWindow(row.lookback_window);
  if (!symbol || !lookbackWindow) return null;
  const storedEvents = parseEvents(row.shock_events);
  return {
    asymmetryScore: numeric(row.asymmetry_score, 0),
    averageDrawdownAfterEntry: textValue(row.average_drawdown_after_entry) ?? "Not enough completed shocks to estimate drawdown yet",
    averageFollowthrough1d: optionalNumeric(row.average_followthrough_1d),
    averageFollowthrough5d: optionalNumeric(row.average_followthrough_5d),
    averageProfitPotential: textValue(row.average_profit_potential) ?? "Not enough completed shocks to estimate upside yet",
    averageReversal5d: optionalNumeric(row.average_reversal_5d),
    chaseRiskLabel: textValue(row.chase_risk_label) ?? "Chase risk elevated",
    chaseRiskScore: numeric(row.chase_risk_score, 50),
    chaseSuccessRate: optionalNumeric(row.chase_success_rate),
    commonFailureConditions: stringArray(row.common_failure_conditions),
    commonPreconditions: stringArray(row.common_preconditions),
    currentSimilarityScore: numeric(row.current_similarity_score, 0),
    downsideRiskScore: numeric(row.downside_risk_score, 50),
    downsideShockCount: numeric(row.downside_shock_count, 0),
    doNotChaseZone: textValue(row.do_not_chase_zone) ?? "Do-not-chase zone unavailable",
    evidenceQualityScore: numeric(row.evidence_quality_score, numeric(row.reliability_score, 0)),
    falsePositiveRiskScore: numeric(row.false_positive_risk_score, 50),
    historicalExitZone: textValue(row.historical_exit_zone) ?? "Historical exit zone unavailable",
    invalidationZone: textValue(row.invalidation_zone) ?? "Invalidation area unavailable",
    largestDownside1d: optionalNumeric(row.largest_downside_1d),
    largestUpside1d: optionalNumeric(row.largest_upside_1d),
    lastUpdated: textValue(row.last_updated) ?? new Date(0).toISOString(),
    latestEvent: parseEvent(row.latest_event),
    liquidityQualityScore: numeric(row.liquidity_quality_score, 58),
    lookbackWindow,
    medianDownsideShock: optionalNumeric(row.median_downside_shock),
    medianUpsideShock: optionalNumeric(row.median_upside_shock),
    opportunityScore: numeric(row.opportunity_score, 0),
    opportunityState: textValue(row.opportunity_state) ?? "High Volatility Watch",
    pullbackSuccessRate: optionalNumeric(row.pullback_success_rate),
    reliabilityScore: numeric(row.reliability_score, 0),
    researchEntryZone: textValue(row.research_entry_zone) ?? "Research entry zone unavailable",
    shockEventCount: storedEvents.length,
    shockEvents: storedEvents,
    symbol: symbol.toUpperCase(),
    timingValidation: parseTimingValidation(row.metrics),
    twoSidedVolatilityScore: numeric(row.two_sided_volatility_score, 0),
    upsideShockCount: numeric(row.upside_shock_count, 0),
    upsideShockScore: numeric(row.upside_shock_score, 0),
  };
}

function selectWindow(bars: ShockMovePriceBar[], lookbackWindow: ShockMoveWindow): ShockMovePriceBar[] {
  const sorted = [...bars].sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  const latest = sorted[sorted.length - 1];
  if (!latest) return [];
  const cutoff = Date.parse(latest.date) - WINDOW_DAYS[lookbackWindow] * 24 * 60 * 60 * 1000;
  return sorted.filter((bar) => Date.parse(bar.date) >= cutoff);
}

function computeBars(bars: ShockMovePriceBar[]): ComputedBar[] {
  return bars.map((bar, index) => {
    const prev = bars[index - 1] ?? null;
    const returns60 = dailyReturns(bars.slice(Math.max(0, index - 61), index));
    const ret = prev && prev.close > 0 ? ((bar.close - prev.close) / prev.close) * 100 : null;
    return {
      ...bar,
      atrPercent: atrPercent(bars, index, 14),
      gapPercent: prev && prev.close > 0 ? ((bar.open - prev.close) / prev.close) * 100 : null,
      ma20: movingAverage(bars, index, 20),
      ma50: movingAverage(bars, index, 50),
      priorFiveDayReturnPct: index >= 5 && bars[index - 5]?.close > 0 ? ((bar.close - bars[index - 5].close) / bars[index - 5].close) * 100 : null,
      realizedVolatility10d: realizedVolatility(dailyReturns(bars.slice(Math.max(0, index - 10), index + 1))),
      return1d: ret,
      returnZScore: ret === null ? null : zScore(ret, returns60),
      volumeSpikeRatio: volumeSpikeRatio(bars, index, 20),
    };
  });
}

function detectShockEvents(bars: ComputedBar[]): ShockMoveEvent[] {
  const events: ShockMoveEvent[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index];
    const ret = bar.return1d;
    if (ret === null) continue;
    const absZ = Math.abs(bar.returnZScore ?? 0);
    const atrNormalized = atrNormalizedMove(bar);
    const volumeSpike = bar.volumeSpikeRatio ?? 0;
    const gap = Math.abs(bar.gapPercent ?? 0);
    const qualifies = Math.abs(ret) >= 5 || (Math.abs(ret) >= 2 && absZ >= 2.5) || (Math.abs(ret) >= 2 && atrNormalized !== null && atrNormalized >= 1.8) || (gap >= 4 && volumeSpike >= 1.6);
    if (!qualifies) continue;
    const preShockBar = bars[index - 1] ?? bar;
    events.push({
      atrNormalizedMove: atrNormalized,
      eventDate: bar.date,
      gapPercent: bar.gapPercent,
      maxAdverseExcursion5d: excursion(bars, index, 5, "adverse"),
      maxFavorableExcursion5d: excursion(bars, index, 5, "favorable"),
      moveType: ret >= 5 ? "upside" : ret <= -5 ? "downside" : "two_sided",
      outcomeStatus: outcomeStatus(bars, index),
      preconditions: preconditions(preShockBar),
      return1d: round(ret, 3),
      return2d: forwardReturn(bars, index, 2),
      return3d: forwardReturn(bars, index, 3),
      return5d: forwardReturn(bars, index, 5),
      return10d: forwardReturn(bars, index, 10),
      returnZScore: roundOrNull(bar.returnZScore, 3),
      volumeSpikeRatio: roundOrNull(bar.volumeSpikeRatio, 3),
    });
  }
  return events;
}

function preconditions(bar: ComputedBar): ShockMovePreconditions {
  return {
    atrPercent: roundOrNull(bar.atrPercent, 3),
    closeVsMa20Pct: percentGap(bar.ma20, bar.close),
    closeVsMa50Pct: percentGap(bar.ma50, bar.close),
    compressionPercentile: compressionPercentile(bar.realizedVolatility10d, bar.atrPercent),
    gapPercent: roundOrNull(bar.gapPercent, 3),
    ma20TrendPct: null,
    priorFiveDayReturnPct: roundOrNull(bar.priorFiveDayReturnPct, 3),
    realizedVolatility10d: roundOrNull(bar.realizedVolatility10d, 3),
    returnZScore: roundOrNull(bar.returnZScore, 3),
    volumeSpikeRatio: roundOrNull(bar.volumeSpikeRatio, 3),
  };
}

function buildResearchZones(latest: ComputedBar, bars: ComputedBar[], events: ShockMoveEvent[]): {
  doNotChaseZone: string;
  historicalExitZone: string;
  invalidationZone: string;
  researchEntryZone: string;
} {
  const atrPct = latest.atrPercent ?? 3.5;
  const atrValue = latest.close * (atrPct / 100);
  const support = Math.min(...bars.slice(-20).map((bar) => bar.low));
  const resistance = Math.max(...bars.slice(-20).map((bar) => bar.high));
  const pullbackRate = rate(events.map((event) => pullbackWorked(event))) ?? 0.45;
  const entryLow = latest.close - atrValue * (pullbackRate >= 0.5 ? 1.2 : 0.8);
  const entryHigh = latest.close - atrValue * 0.25;
  const invalidation = Math.min(support, latest.close - atrValue * 1.8);
  const exit = Math.max(resistance, latest.close + atrValue * 2.2);
  const chase = latest.close + atrValue * 1.4;
  return {
    doNotChaseZone: `Above ${formatMoney(chase)}`,
    historicalExitZone: `${formatMoney(Math.max(latest.close, exit - atrValue * 0.5))}-${formatMoney(exit)}`,
    invalidationZone: `${formatMoney(invalidation)} area`,
    researchEntryZone: `${formatMoney(Math.min(entryLow, entryHigh))}-${formatMoney(Math.max(entryLow, entryHigh))}`,
  };
}

function buildShockTimingValidation(input: { bars: ComputedBar[]; events: ShockMoveEvent[]; symbol: string }): ShockTimingValidation {
  const upsideEvents = input.events.filter((event) => event.return1d >= 5);
  const dateToIndex = new Map(input.bars.map((bar, index) => [dayKey(bar.date), index]));
  const candidateSignals = compressPreShockSignals(input.bars
    .slice(40, Math.max(40, input.bars.length - 5))
    .map((bar, index) => ({ bar, index: index + 40, ...preShockReadiness(bar) }))
    .filter((signal) => signal.score >= PRE_SHOCK_SIGNAL_THRESHOLD));
  const detectedEvents = upsideEvents.filter((event) => {
    const index = dateToIndex.get(dayKey(event.eventDate));
    if (index === undefined) return false;
    return bestPreMoveSignal(input.bars, index).score >= PRE_SHOCK_SIGNAL_THRESHOLD;
  });
  const falsePositiveCount = candidateSignals.filter((signal) => !hasUpcomingUpsideShock(input.events, signal.index, dateToIndex)).length;
  const earlyDetectionRate = upsideEvents.length ? detectedEvents.length / upsideEvents.length : null;
  const missedOpportunityRate = upsideEvents.length ? 1 - (earlyDetectionRate ?? 0) : null;
  const falsePositiveRate = candidateSignals.length ? falsePositiveCount / candidateSignals.length : null;
  const chaseSuccessRate = rate(input.events.map((event) => chaseWorked(event)));
  const pullbackEntrySuccessRate = rate(input.events.map((event) => pullbackWorked(event)));
  const chaseDrawdowns = input.events.map((event) => event.maxAdverseExcursion5d).filter(isFiniteNumber);
  const favorableExcursions = input.events.map((event) => event.maxFavorableExcursion5d).filter(isFiniteNumber);
  const pullbackDepths = input.events.map((event) => Math.abs(event.maxAdverseExcursion5d ?? 0)).filter((value) => value > 0);
  const early = earlyDetectionRate === null ? 35 : earlyDetectionRate * 100;
  const falsePositiveControl = falsePositiveRate === null ? 45 : 100 - falsePositiveRate * 100;
  const pullback = pullbackEntrySuccessRate === null ? 40 : pullbackEntrySuccessRate * 100;
  const chaseRiskControl = chaseSuccessRate === null ? 45 : 100 - Math.max(0, 55 - chaseSuccessRate * 100);
  const drawdownPenalty = Math.min(34, Math.abs(mean(chaseDrawdowns)) * 3.5);
  const timingQualityScore = Math.round(clamp(early * 0.34 + falsePositiveControl * 0.24 + pullback * 0.22 + chaseRiskControl * 0.14 - drawdownPenalty + 8));
  const entryQualityScore = Math.round(clamp(pullback * 0.42 + falsePositiveControl * 0.22 + early * 0.2 + (100 - drawdownPenalty * 1.6) * 0.16));
  const shockReliabilityScore = Math.round(clamp(sampleScore(input.events.length) * 0.34 + early * 0.28 + falsePositiveControl * 0.18 + pullback * 0.12 + Math.min(100, input.bars.length / 12) * 0.08));

  return {
    averageDrawdownAfterChasePct: meanOrNull(chaseDrawdowns),
    bestHistoricalEntryZone: pullbackDepths.length ? `Historically cleaner entries appeared after ${formatSignedPercent(-quantile(pullbackDepths, 0.35))} to ${formatSignedPercent(-quantile(pullbackDepths, 0.70))} pullbacks from shock context.` : "Entry timing sample still limited.",
    bestHistoricalExitZone: favorableExcursions.length ? `Historically observed 5D favorable excursions clustered around ${formatSignedPercent(quantile(favorableExcursions, 0.45))} to ${formatSignedPercent(quantile(favorableExcursions, 0.75))}.` : "Exit timing sample still limited.",
    earlyDetectionRate: roundRatioOrNull(earlyDetectionRate),
    entryQualityScore,
    falsePositiveRate: roundRatioOrNull(falsePositiveRate),
    missedOpportunityRate: roundRatioOrNull(missedOpportunityRate),
    pullbackEntrySuccessRate: roundRatioOrNull(pullbackEntrySuccessRate),
    replayStudies: replayStudies({ dateToIndex, events: upsideEvents, bars: input.bars, symbol: input.symbol }),
    shockReliabilityScore,
    summary: timingSummary({ earlyDetectionRate, falsePositiveRate, pullbackEntrySuccessRate, timingQualityScore, validationSampleSize: input.events.length }),
    timingQualityScore,
    validationSampleSize: input.events.length,
  };
}

function replayStudies(input: { bars: ComputedBar[]; dateToIndex: Map<string, number>; events: ShockMoveEvent[]; symbol: string }): ShockMoveReplayStudy[] {
  return [...input.events]
    .sort((left, right) => Math.abs(right.return1d) - Math.abs(left.return1d))
    .slice(0, 4)
    .map((event) => {
      const index = input.dateToIndex.get(dayKey(event.eventDate));
      const signal = index === undefined ? { daysBeforeSignal: null, evidence: [] as string[], score: 0 } : bestPreMoveSignal(input.bars, index);
      const preMoveDetected = signal.score >= PRE_SHOCK_SIGNAL_THRESHOLD;
      const followThrough = event.return5d ?? null;
      const chaseSucceeded = chaseWorked(event);
      const pullbackSucceeded = pullbackWorked(event);
      return {
        beforeMoveEvidence: signal.evidence,
        chaseOutcome: chaseSucceeded ? "Chasing showed follow-through in the historical window." : "Chasing was historically fragile or failed to add clean follow-through.",
        daysBeforeSignal: signal.daysBeforeSignal,
        eventDate: event.eventDate,
        maxAdverseExcursion5d: event.maxAdverseExcursion5d,
        moveType: event.moveType,
        preMoveDetected,
        preMoveScore: Math.round(signal.score),
        pullbackOutcome: pullbackSucceeded ? "Pullback/retest behavior offered a cleaner historical entry window." : "Pullback evidence was limited or did not improve the historical outcome.",
        return1d: event.return1d,
        return5d: followThrough,
        verdict: preMoveDetected ? `${input.symbol} showed detectable pre-move evidence before this shock.` : `${input.symbol} did not meet pre-move evidence threshold before this shock.`,
      };
    });
}

function compressPreShockSignals(signals: Array<{ bar: ComputedBar; index: number; reasons: string[]; score: number }>): Array<{ bar: ComputedBar; index: number; reasons: string[]; score: number }> {
  const compressed: Array<{ bar: ComputedBar; index: number; reasons: string[]; score: number }> = [];
  let cluster: Array<{ bar: ComputedBar; index: number; reasons: string[]; score: number }> = [];
  for (const signal of signals) {
    const first = cluster[0];
    if (!first || signal.index <= first.index + 5) {
      cluster.push(signal);
      continue;
    }
    compressed.push(bestCandidateSignal(cluster));
    cluster = [signal];
  }
  if (cluster.length) compressed.push(bestCandidateSignal(cluster));
  return compressed;
}

function bestCandidateSignal(signals: Array<{ bar: ComputedBar; index: number; reasons: string[]; score: number }>): { bar: ComputedBar; index: number; reasons: string[]; score: number } {
  const first = signals[0];
  if (!first) throw new Error("pre-shock signal cluster cannot be empty");
  return signals.slice(1).reduce((best, signal) => (signal.score > best.score ? signal : best), first);
}

function bestPreMoveSignal(bars: ComputedBar[], eventIndex: number): { daysBeforeSignal: number | null; evidence: string[]; score: number } {
  let best = { daysBeforeSignal: null as number | null, evidence: [] as string[], score: 0 };
  for (let daysBefore = 1; daysBefore <= 3; daysBefore += 1) {
    const bar = bars[eventIndex - daysBefore];
    if (!bar) continue;
    const readiness = preShockReadiness(bar);
    if (readiness.score > best.score) {
      best = {
        daysBeforeSignal: daysBefore,
        evidence: readiness.reasons,
        score: readiness.score,
      };
    }
  }
  return best;
}

function preShockReadiness(bar: ComputedBar): { reasons: string[]; score: number } {
  const conditions = preconditions(bar);
  let score = 18;
  const reasons: string[] = [];
  if ((conditions.compressionPercentile ?? 0) >= 35) {
    score += 18;
    reasons.push("volatility compression was visible before the move");
  }
  if ((conditions.closeVsMa20Pct ?? -1) >= 0) {
    score += 14;
    reasons.push("price held above the 20-day trend before the move");
  }
  if ((conditions.closeVsMa50Pct ?? -1) >= 0) {
    score += 10;
    reasons.push("medium-term trend support was positive");
  }
  const priorFive = conditions.priorFiveDayReturnPct ?? 0;
  if (priorFive >= -4 && priorFive <= 8) {
    score += 10;
    reasons.push("the setup was not already in an extreme five-day chase state");
  }
  if (Math.abs(conditions.returnZScore ?? 0) <= 1.5) {
    score += 8;
    reasons.push("one-day return pressure was not already extreme");
  }
  if ((conditions.volumeSpikeRatio ?? 1) >= 1.15) {
    score += 8;
    reasons.push("volume was beginning to expand before the shock");
  }
  if ((conditions.atrPercent ?? 0) >= 2.2) {
    score += 7;
    reasons.push("ATR profile supported larger-than-normal movement");
  }
  return {
    reasons: reasons.length ? reasons.slice(0, 4) : ["no strong pre-move signal cluster was visible"],
    score: clamp(score),
  };
}

function hasUpcomingUpsideShock(events: ShockMoveEvent[], candidateIndex: number, dateToIndex: Map<string, number>): boolean {
  if (candidateIndex < 0) return false;
  return events.some((event) => {
    if (event.return1d < 5) return false;
    const eventIndex = dateToIndex.get(dayKey(event.eventDate));
    return eventIndex !== undefined && eventIndex > candidateIndex && eventIndex <= candidateIndex + 5;
  });
}

function timingSummary(input: { earlyDetectionRate: number | null; falsePositiveRate: number | null; pullbackEntrySuccessRate: number | null; timingQualityScore: number; validationSampleSize: number }): string {
  const early = input.earlyDetectionRate === null ? "limited early-detection evidence" : `${Math.round(input.earlyDetectionRate * 100)}% early-detection rate`;
  const falsePositive = input.falsePositiveRate === null ? "false-positive rate still unavailable" : `${Math.round(input.falsePositiveRate * 100)}% false-positive rate`;
  const pullback = input.pullbackEntrySuccessRate === null ? "pullback-entry evidence still limited" : `${Math.round(input.pullbackEntrySuccessRate * 100)}% pullback-entry success`;
  return `${input.timingQualityScore}/100 timing proof from ${input.validationSampleSize} shock events: ${early}, ${falsePositive}, ${pullback}.`;
}

function sampleScore(count: number): number {
  if (count >= 30) return 100;
  if (count >= 18) return 78;
  if (count >= 10) return 58;
  if (count >= 5) return 38;
  return 18;
}

function commonPreconditions(events: ShockMoveEvent[]): string[] {
  const conditions: string[] = [];
  if (!events.length) return ["No repeatable shock precondition cluster is available yet."];
  if (rateValue(events.map((event) => (event.preconditions?.volumeSpikeRatio ?? 0) >= 1.5)) >= 0.35) conditions.push("volume expansion frequently preceded shock events");
  if (rateValue(events.map((event) => Math.abs(event.preconditions?.returnZScore ?? 0) >= 2)) >= 0.3) conditions.push("return z-score pressure was already elevated before similar moves");
  if (rateValue(events.map((event) => (event.preconditions?.closeVsMa20Pct ?? 0) > 0)) >= 0.55) conditions.push("price was usually above the 20-day trend line");
  if (rateValue(events.map((event) => (event.preconditions?.gapPercent ?? 0) > 2)) >= 0.25) conditions.push("gap activity appeared in a meaningful subset of shock events");
  if (rateValue(events.map((event) => (event.preconditions?.realizedVolatility10d ?? 0) <= (event.preconditions?.atrPercent ?? 0))) >= 0.35) conditions.push("volatility compression often appeared before expansion");
  return conditions.length ? conditions.slice(0, 4) : ["Shock events were mixed; no single indicator dominated the preconditions."];
}

function commonFailureConditions(events: ShockMoveEvent[]): string[] {
  const conditions: string[] = [];
  const reversalEvents = events.filter((event) => reversalAfterShock(event) !== null && (reversalAfterShock(event) ?? 0) > 0);
  if (!events.length) return ["Failure pattern evidence is unavailable until more shock events accumulate."];
  if (reversalEvents.length / events.length >= 0.35) conditions.push("chasing after the shock often reversed within five sessions");
  if (rateValue(events.map((event) => Math.abs(event.preconditions?.gapPercent ?? 0) >= 4)) >= 0.25) conditions.push("large gaps increased do-not-chase risk");
  if (rateValue(events.map((event) => (event.maxAdverseExcursion5d ?? 0) <= -6)) >= 0.25) conditions.push("post-shock drawdowns were frequently sharp");
  if (rateValue(events.map((event) => (event.preconditions?.volumeSpikeRatio ?? 0) >= 3)) >= 0.2) conditions.push("extreme volume spikes sometimes marked exhaustion rather than clean follow-through");
  return conditions.length ? conditions.slice(0, 4) : ["Observed failures are mixed; downside must still be monitored because shock setups are high-volatility by design."];
}

function hardenedFailureConditions(input: {
  events: ShockMoveEvent[];
  falsePositiveRisk: number;
  followthrough5d: number[];
  liquidityQuality: number;
  timingValidation: ShockTimingValidation;
}): string[] {
  const conditions = commonFailureConditions(input.events);
  const extra: string[] = [];
  if (input.liquidityQuality < 45) extra.push("thin or incomplete volume history reduces confidence in shock quality");
  if (input.falsePositiveRisk >= 66) extra.push("pre-shock signals have produced too many noisy candidates");
  if (input.timingValidation.falsePositiveRate !== null && input.timingValidation.falsePositiveRate >= 0.45) extra.push("similar early signals often failed to become large moves");
  if (input.followthrough5d.length >= 3 && mean(input.followthrough5d) <= 0) extra.push("five-day follow-through after shocks has been weak");
  return [...extra, ...conditions].slice(0, 4);
}

function opportunityState(input: { chaseRisk: number; downsideRisk: number; opportunity: number; twoSided: number; upsideScore: number }): string {
  if (input.chaseRisk >= 78) return "Avoid Chase";
  if (input.twoSided >= 72 && input.downsideRisk >= 65) return "Two-Sided Volatility";
  if (input.opportunity >= 76 && input.upsideScore >= 70) return "Asymmetric Opportunity";
  if (input.upsideScore >= 70) return "Elevated Upside Potential";
  if (input.opportunity >= 62) return "Emerging Opportunity";
  return "High Volatility Watch";
}

function opportunityScore(input: { asymmetry: number; chaseRisk: number; downsideRisk: number; reliability: number; similarity: number; twoSided: number; upsideScore: number }): number {
  return clamp(input.upsideScore * 0.28 + input.asymmetry * 0.2 + input.similarity * 0.16 + input.reliability * 0.2 + input.twoSided * 0.08 - input.downsideRisk * 0.13 - input.chaseRisk * 0.08 + 12);
}

function liquidityQualityScore(bars: ComputedBar[], events: ShockMoveEvent[]): number {
  const volumes = bars.map((bar) => bar.volume).filter(isFiniteNumber);
  if (!volumes.length) return 58;
  const medianVolume = quantile(volumes, 0.5);
  const volumeDepth = medianVolume >= 2_000_000 ? 100 : medianVolume >= 1_000_000 ? 86 : medianVolume >= 500_000 ? 70 : medianVolume >= 150_000 ? 48 : 24;
  const volumeCoverage = (volumes.length / Math.max(1, bars.length)) * 100;
  const eventVolumeCoverage = events.length ? (events.filter((event) => event.volumeSpikeRatio !== null).length / events.length) * 100 : 45;
  const sample = sampleScore(events.length);
  return clamp(volumeDepth * 0.42 + volumeCoverage * 0.22 + eventVolumeCoverage * 0.18 + sample * 0.18);
}

function evidenceQualityScore(input: { barCount: number; events: ShockMoveEvent[]; liquidityQuality: number; timingValidation: ShockTimingValidation }): number {
  const completeRate = input.events.length ? (input.events.filter((event) => event.outcomeStatus === "complete").length / input.events.length) * 100 : 0;
  const historyDepth = clamp((input.barCount / 252) * 38);
  const timing = input.timingValidation.shockReliabilityScore;
  return clamp(sampleScore(input.events.length) * 0.30 + completeRate * 0.24 + input.liquidityQuality * 0.20 + timing * 0.16 + historyDepth * 0.10);
}

function falsePositiveRiskScore(input: { events: ShockMoveEvent[]; followthrough5d: number[]; liquidityQuality: number; timingValidation: ShockTimingValidation }): number {
  const falsePositive = input.timingValidation.falsePositiveRate === null ? 42 : input.timingValidation.falsePositiveRate * 100;
  const lowEvidence = 100 - sampleScore(input.events.length);
  const weakFollowThrough = input.followthrough5d.length >= 3 ? clamp(55 - mean(input.followthrough5d) * 8) : 38;
  const pendingRate = input.events.length ? (input.events.filter((event) => event.outcomeStatus !== "complete").length / input.events.length) * 100 : 55;
  const liquidityPenalty = 100 - input.liquidityQuality;
  return clamp(falsePositive * 0.34 + lowEvidence * 0.20 + weakFollowThrough * 0.20 + pendingRate * 0.12 + liquidityPenalty * 0.14);
}

function upsideShockScore(input: { currentShockPressure: number; events: ShockMoveEvent[]; latest: ComputedBar; upsideEvents: ShockMoveEvent[]; upsideFrequency: number }): number {
  const largest = input.upsideEvents.map((event) => event.return1d).reduce((max, value) => Math.max(max, value), 0);
  const frequencyScore = clamp(input.upsideFrequency * 1000);
  const currentContext = input.currentShockPressure;
  const history = clamp(input.upsideEvents.length * 9 + largest * 3);
  return clamp(history * 0.32 + frequencyScore * 0.2 + currentContext * 0.28 + currentSimilarityScore(input.latest, input.events) * 0.2);
}

function downsideRiskScore(input: { downsideEvents: ShockMoveEvent[]; downsideFrequency: number; latest: ComputedBar; maeValues: number[]; reversalRate: number | null }): number {
  const largestDown = Math.abs(input.downsideEvents.map((event) => event.return1d).reduce((min, value) => Math.min(min, value), 0));
  const frequencyScore = clamp(input.downsideFrequency * 1200);
  const mae = Math.abs(mean(input.maeValues));
  const currentVol = clamp((input.latest.atrPercent ?? 3) * 10 + (input.latest.volumeSpikeRatio ?? 1) * 8);
  return clamp(largestDown * 4 + frequencyScore * 0.25 + mae * 4 + currentVol * 0.25 + (input.reversalRate ?? 0.35) * 22);
}

function twoSidedVolatilityScore(input: { downsideEvents: ShockMoveEvent[]; events: ShockMoveEvent[]; latest: ComputedBar; upsideEvents: ShockMoveEvent[] }): number {
  const balance = Math.min(input.upsideEvents.length, input.downsideEvents.length) / Math.max(1, input.events.length);
  const latestPressure = scoreLatestShockPressure(input.latest);
  return clamp(balance * 120 + input.events.length * 2.4 + latestPressure * 0.32);
}

function asymmetryScore(input: { downsideFrequency: number; events: ShockMoveEvent[]; mfeValues: number[]; upsideFrequency: number }): number {
  const mfe = mean(input.mfeValues);
  const directionalEdge = clamp((input.upsideFrequency - input.downsideFrequency) * 1200 + 50);
  const sample = clamp(input.events.length * 5);
  return clamp(directionalEdge * 0.44 + mfe * 5 + sample * 0.18 + 18);
}

function reliabilityScore(events: ShockMoveEvent[], continuationRate: number | null, barCount: number): number {
  const sampleScore = clamp(events.length * 7);
  const continuation = continuationRate === null ? 45 : continuationRate * 100;
  const historyDepth = clamp((barCount / 252) * 18);
  return clamp(sampleScore * 0.45 + continuation * 0.3 + historyDepth + 18);
}

function currentSimilarityScore(latest: ComputedBar, events: ShockMoveEvent[]): number {
  if (!events.length) return 0;
  const latestVector = [
    latest.atrPercent ?? 0,
    latest.volumeSpikeRatio ?? 1,
    latest.priorFiveDayReturnPct ?? 0,
    latest.close > 0 && latest.ma20 ? ((latest.close - latest.ma20) / latest.close) * 100 : 0,
  ];
  const scores = events.map((event) => {
    const vector = [
      event.preconditions?.atrPercent ?? 0,
      event.preconditions?.volumeSpikeRatio ?? 1,
      event.preconditions?.priorFiveDayReturnPct ?? 0,
      event.preconditions?.closeVsMa20Pct ?? 0,
    ];
    const distance = vector.reduce((total, value, index) => total + Math.abs(value - latestVector[index]), 0);
    return clamp(100 - distance * 4);
  });
  return Math.max(...scores);
}

function chaseRiskScore(input: { latest: ComputedBar; upsideEvents: ShockMoveEvent[] }): number {
  const extension = input.latest.ma20 && input.latest.ma20 > 0 ? ((input.latest.close - input.latest.ma20) / input.latest.ma20) * 100 : 0;
  const latestMove = Math.max(0, input.latest.return1d ?? 0);
  const poorChaseRate = 1 - (rate(input.upsideEvents.map((event) => chaseWorked(event))) ?? 0.5);
  return clamp(extension * 6 + latestMove * 8 + poorChaseRate * 42 + Math.max(0, (input.latest.volumeSpikeRatio ?? 1) - 2) * 12);
}

function scoreLatestShockPressure(latest: ComputedBar): number {
  const move = Math.abs(latest.return1d ?? 0) * 8;
  const z = Math.abs(latest.returnZScore ?? 0) * 18;
  const atr = (atrNormalizedMove(latest) ?? 0) * 18;
  const volume = (latest.volumeSpikeRatio ?? 1) * 12;
  return clamp(mean([move, z, atr, volume]));
}

function latestEvent(events: ShockMoveEvent[]): ShockMoveEvent | null {
  return events[events.length - 1] ?? null;
}

function forwardReturn(bars: ComputedBar[], index: number, days: number): number | null {
  const start = bars[index];
  const end = bars[index + days];
  if (!start || !end || start.close <= 0) return null;
  return round(((end.close - start.close) / start.close) * 100, 3);
}

function excursion(bars: ComputedBar[], index: number, days: number, mode: "adverse" | "favorable"): number | null {
  const start = bars[index];
  if (!start || start.close <= 0) return null;
  const future = bars.slice(index + 1, index + days + 1);
  if (!future.length) return null;
  if (mode === "favorable") {
    const high = Math.max(...future.map((bar) => bar.high));
    return round(((high - start.close) / start.close) * 100, 3);
  }
  const low = Math.min(...future.map((bar) => bar.low));
  return round(((low - start.close) / start.close) * 100, 3);
}

function outcomeStatus(bars: ComputedBar[], index: number): ShockOutcomeStatus {
  const remaining = bars.length - index - 1;
  if (remaining >= 10) return "complete";
  if (remaining > 0) return "partial";
  return "pending";
}

function reversalAfterShock(event: ShockMoveEvent): number | null {
  if (event.return5d === null) return null;
  if (event.return1d > 0) return event.return5d < 0 ? Math.abs(event.return5d) : 0;
  return event.return5d > 0 ? Math.abs(event.return5d) : 0;
}

function chaseWorked(event: ShockMoveEvent): boolean {
  if (event.return1d > 0) return (event.return5d ?? 0) > Math.max(1, event.return1d * 0.18);
  if (event.return1d < 0) return (event.return5d ?? 0) < Math.min(-1, event.return1d * 0.18);
  return false;
}

function pullbackWorked(event: ShockMoveEvent): boolean {
  const mae = event.maxAdverseExcursion5d;
  const mfe = event.maxFavorableExcursion5d;
  if (mae === null || mfe === null) return false;
  return mae <= -1.5 && mfe >= Math.abs(mae) * 1.2;
}

function atrNormalizedMove(bar: ComputedBar): number | null {
  if (bar.return1d === null || bar.atrPercent === null || bar.atrPercent <= 0) return null;
  return Math.abs(bar.return1d) / bar.atrPercent;
}

function atrPercent(bars: ShockMovePriceBar[], index: number, period: number): number | null {
  if (index < 1) return null;
  const values: number[] = [];
  for (let cursor = Math.max(1, index - period + 1); cursor <= index; cursor += 1) {
    const bar = bars[cursor];
    const prev = bars[cursor - 1];
    if (!bar || !prev) continue;
    const trueRange = Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close));
    values.push((trueRange / bar.close) * 100);
  }
  return values.length ? mean(values) : null;
}

function volumeSpikeRatio(bars: ShockMovePriceBar[], index: number, period: number): number | null {
  const current = bars[index]?.volume;
  if (current === null || current === undefined || current <= 0) return null;
  const values = bars.slice(Math.max(0, index - period), index).map((bar) => bar.volume).filter(isFiniteNumber);
  if (!values.length) return null;
  const avg = mean(values);
  return avg > 0 ? current / avg : null;
}

function movingAverage(bars: ShockMovePriceBar[], index: number, period: number): number | null {
  if (index < period - 1) return null;
  return mean(bars.slice(index - period + 1, index + 1).map((bar) => bar.close));
}

function dailyReturns(bars: ShockMovePriceBar[]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const prev = bars[index - 1];
    const current = bars[index];
    if (prev && current && prev.close > 0) returns.push(((current.close - prev.close) / prev.close) * 100);
  }
  return returns;
}

function realizedVolatility(returns: number[]): number | null {
  if (returns.length < 3) return null;
  return standardDeviation(returns) * Math.sqrt(252);
}

function zScore(value: number, values: number[]): number | null {
  if (values.length < 12) return null;
  const std = standardDeviation(values);
  if (std <= 0) return null;
  return (value - mean(values)) / std;
}

function compressionPercentile(realizedVolatilityValue: number | null, atrPercentValue: number | null): number | null {
  if (realizedVolatilityValue === null || atrPercentValue === null || atrPercentValue <= 0) return null;
  return clamp(100 - (realizedVolatilityValue / Math.max(atrPercentValue * Math.sqrt(252), 1)) * 100);
}

function percentGap(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from <= 0) return null;
  return round(((to - from) / from) * 100, 3);
}

function mean(values: number[]): number {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function meanOrNull(values: number[]): number | null {
  return values.length ? round(mean(values), 3) : null;
}

function medianOrNull(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid], 3);
}

function quantile(values: number[], percentile: number): number {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * percentile)));
  return sorted[index] ?? 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function rate(values: boolean[]): number | null {
  if (!values.length) return null;
  return values.filter(Boolean).length / values.length;
}

function rateValue(values: boolean[]): number {
  return rate(values) ?? 0;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundOrNull(value: number | null | undefined, digits: number): number | null {
  return isFiniteNumber(value) ? round(value, digits) : null;
}

function roundRatioOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value, 4);
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function dayKey(value: string): string {
  return value.slice(0, 10);
}

function textValue(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return null;
  return text;
}

function numeric(value: unknown, fallback: number): number {
  return finiteNumber(value) ?? fallback;
}

function optionalNumeric(value: unknown): number | null {
  return finiteNumber(value);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    } catch {
      return value.split(/[|;]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseEvents(value: unknown): ShockMoveEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseEvent).filter((event): event is ShockMoveEvent => event !== null);
}

function parseTimingValidation(value: unknown): ShockTimingValidation | null {
  const metrics = objectValue(value);
  const raw = objectValue(metrics.timingValidation ?? metrics.timing_validation);
  if (!Object.keys(raw).length) return null;
  return {
    averageDrawdownAfterChasePct: optionalNumeric(raw.averageDrawdownAfterChasePct ?? raw.average_drawdown_after_chase_pct),
    bestHistoricalEntryZone: textValue(raw.bestHistoricalEntryZone ?? raw.best_historical_entry_zone) ?? "Entry timing sample still limited.",
    bestHistoricalExitZone: textValue(raw.bestHistoricalExitZone ?? raw.best_historical_exit_zone) ?? "Exit timing sample still limited.",
    earlyDetectionRate: optionalNumeric(raw.earlyDetectionRate ?? raw.early_detection_rate),
    entryQualityScore: numeric(raw.entryQualityScore ?? raw.entry_quality_score, 0),
    falsePositiveRate: optionalNumeric(raw.falsePositiveRate ?? raw.false_positive_rate),
    missedOpportunityRate: optionalNumeric(raw.missedOpportunityRate ?? raw.missed_opportunity_rate),
    pullbackEntrySuccessRate: optionalNumeric(raw.pullbackEntrySuccessRate ?? raw.pullback_entry_success_rate),
    replayStudies: parseReplayStudies(raw.replayStudies ?? raw.replay_studies),
    shockReliabilityScore: numeric(raw.shockReliabilityScore ?? raw.shock_reliability_score, 0),
    summary: textValue(raw.summary) ?? "Shock timing proof is still building.",
    timingQualityScore: numeric(raw.timingQualityScore ?? raw.timing_quality_score, 0),
    validationSampleSize: numeric(raw.validationSampleSize ?? raw.validation_sample_size, 0),
  };
}

function parseReplayStudies(value: unknown): ShockMoveReplayStudy[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = objectValue(item);
    const eventDate = textValue(record.eventDate ?? record.event_date);
    const return1d = optionalNumeric(record.return1d ?? record.return_1d);
    if (!eventDate || return1d === null) return null;
    const moveType = textValue(record.moveType ?? record.move_type);
    return {
      beforeMoveEvidence: stringArray(record.beforeMoveEvidence ?? record.before_move_evidence),
      chaseOutcome: textValue(record.chaseOutcome ?? record.chase_outcome) ?? "Chase outcome unavailable.",
      daysBeforeSignal: optionalNumeric(record.daysBeforeSignal ?? record.days_before_signal),
      eventDate,
      maxAdverseExcursion5d: optionalNumeric(record.maxAdverseExcursion5d ?? record.max_adverse_excursion_5d),
      moveType: moveType === "downside" || moveType === "two_sided" ? moveType : "upside",
      preMoveDetected: Boolean(record.preMoveDetected ?? record.pre_move_detected),
      preMoveScore: numeric(record.preMoveScore ?? record.pre_move_score, 0),
      pullbackOutcome: textValue(record.pullbackOutcome ?? record.pullback_outcome) ?? "Pullback outcome unavailable.",
      return1d,
      return5d: optionalNumeric(record.return5d ?? record.return_5d),
      verdict: textValue(record.verdict) ?? "Replay verdict unavailable.",
    };
  }).filter((study): study is ShockMoveReplayStudy => study !== null);
}

function parseEvent(value: unknown): ShockMoveEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const eventDate = textValue(record.eventDate ?? record.event_date);
  const moveType = textValue(record.moveType ?? record.move_type);
  const return1d = finiteNumber(record.return1d ?? record.return_1d);
  if (!eventDate || return1d === null) return null;
  return {
    atrNormalizedMove: optionalNumeric(record.atrNormalizedMove ?? record.atr_normalized_move),
    eventDate,
    gapPercent: optionalNumeric(record.gapPercent ?? record.gap_percent),
    maxAdverseExcursion5d: optionalNumeric(record.maxAdverseExcursion5d ?? record.max_adverse_excursion_5d),
    maxFavorableExcursion5d: optionalNumeric(record.maxFavorableExcursion5d ?? record.max_favorable_excursion_5d),
    moveType: moveType === "downside" || moveType === "two_sided" ? moveType : "upside",
    outcomeStatus: outcomeStatusText(record.outcomeStatus ?? record.outcome_status),
    preconditions: parsePreconditions(record.preconditions),
    return1d,
    return2d: optionalNumeric(record.return2d ?? record.return_2d),
    return3d: optionalNumeric(record.return3d ?? record.return_3d),
    return5d: optionalNumeric(record.return5d ?? record.return_5d),
    return10d: optionalNumeric(record.return10d ?? record.return_10d),
    returnZScore: optionalNumeric(record.returnZScore ?? record.return_zscore),
    volumeSpikeRatio: optionalNumeric(record.volumeSpikeRatio ?? record.volume_spike_ratio),
  };
}

function parsePreconditions(value: unknown): ShockMovePreconditions {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    atrPercent: optionalNumeric(record.atrPercent ?? record.atr_percent),
    closeVsMa20Pct: optionalNumeric(record.closeVsMa20Pct ?? record.close_vs_ma20_pct),
    closeVsMa50Pct: optionalNumeric(record.closeVsMa50Pct ?? record.close_vs_ma50_pct),
    compressionPercentile: optionalNumeric(record.compressionPercentile ?? record.compression_percentile),
    gapPercent: optionalNumeric(record.gapPercent ?? record.gap_percent),
    ma20TrendPct: optionalNumeric(record.ma20TrendPct ?? record.ma20_trend_pct),
    priorFiveDayReturnPct: optionalNumeric(record.priorFiveDayReturnPct ?? record.prior_five_day_return_pct),
    realizedVolatility10d: optionalNumeric(record.realizedVolatility10d ?? record.realized_volatility_10d),
    returnZScore: optionalNumeric(record.returnZScore ?? record.return_zscore),
    volumeSpikeRatio: optionalNumeric(record.volumeSpikeRatio ?? record.volume_spike_ratio),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function outcomeStatusText(value: unknown): ShockOutcomeStatus {
  const text = textValue(value);
  if (text === "complete" || text === "partial" || text === "pending") return text;
  return "pending";
}

function asLookbackWindow(value: unknown): ShockMoveWindow | null {
  const text = textValue(value);
  if (text === "1y" || text === "3y" || text === "5y") return text;
  return null;
}
