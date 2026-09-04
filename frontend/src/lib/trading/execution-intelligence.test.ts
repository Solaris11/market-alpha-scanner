import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMoveEvent, ShockMovePattern } from "./shock-move";
import {
  buildExecutionIntelligence,
  buildExecutionTimingSystem,
  compactExecutionLabels,
} from "./execution-intelligence";

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 76,
    averageDrawdownAfterEntry: "-4.2%",
    averageFollowthrough1d: 1.8,
    averageFollowthrough5d: 4.4,
    averageProfitPotential: "+13.4%",
    averageReversal5d: -2.1,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 42,
    // Fractions, because rate() and the shock_move_patterns columns are
    // fractions. This fixture said 58 and 64 for a long time, which is the
    // reason "chase success is limited at 0%" shipped and no test noticed.
    chaseSuccessRate: 0.58,
    commonFailureConditions: ["failed follow-through after extended gaps"],
    commonPreconditions: ["volatility compression before expansion"],
    currentSimilarityScore: 68,
    downsideRiskScore: 45,
    downsideShockCount: 6,
    doNotChaseZone: "$116.00+",
    historicalExitZone: "$122.00-$128.00",
    invalidationZone: "$96.00",
    largestDownside1d: -12.3,
    largestUpside1d: 18.8,
    lastUpdated: "2026-05-08T20:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -7.1,
    medianUpsideShock: 9.4,
    opportunityScore: 74,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 0.64,
    reliabilityScore: 70,
    researchEntryZone: "$100.00-$103.00",
    shockEvents: shockEvents(),
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 16,
    upsideShockScore: 78,
    ...overrides,
  };
}

function shockEvents(): ShockMoveEvent[] {
  return [
    event({ closeVsMa20Pct: -1.2, closeVsMa50Pct: 0.8, maxAdverseExcursion5d: -2.4, maxFavorableExcursion5d: 8.1, priorFiveDayReturnPct: -1.6, return1d: 6.2, return5d: 4.8 }),
    event({ closeVsMa20Pct: 0.6, closeVsMa50Pct: 2.1, maxAdverseExcursion5d: -1.8, maxFavorableExcursion5d: 7.4, priorFiveDayReturnPct: 2.5, return1d: 5.7, return5d: 5.2, volumeSpikeRatio: 1.6 }),
    event({ closeVsMa20Pct: 1.8, closeVsMa50Pct: 3.3, gapPercent: 4.8, maxAdverseExcursion5d: -7.4, maxFavorableExcursion5d: 3.2, priorFiveDayReturnPct: 9.4, return1d: 9.1, return5d: -2.6, volumeSpikeRatio: 2.9 }),
    event({ closeVsMa20Pct: 0.2, closeVsMa50Pct: 1.5, compressionPercentile: 54, maxAdverseExcursion5d: -2.1, maxFavorableExcursion5d: 9.5, priorFiveDayReturnPct: 1.1, return1d: 7.3, return5d: 6.8, volumeSpikeRatio: 1.8 }),
    event({ closeVsMa20Pct: -0.4, closeVsMa50Pct: 0.2, maxAdverseExcursion5d: -3.1, maxFavorableExcursion5d: 5.6, priorFiveDayReturnPct: -0.7, return1d: 5.2, return5d: 2.4, volumeSpikeRatio: 1.2 }),
    event({ closeVsMa20Pct: 0.8, closeVsMa50Pct: 1.7, gapPercent: 3.7, maxAdverseExcursion5d: -6.3, maxFavorableExcursion5d: 2.9, priorFiveDayReturnPct: 8.8, return1d: 8.4, return5d: -1.4, volumeSpikeRatio: 2.5 }),
  ];
}

function event(overrides: {
  closeVsMa20Pct: number;
  closeVsMa50Pct: number;
  compressionPercentile?: number;
  gapPercent?: number;
  maxAdverseExcursion5d: number;
  maxFavorableExcursion5d: number;
  priorFiveDayReturnPct: number;
  return1d: number;
  return5d: number;
  volumeSpikeRatio?: number;
}): ShockMoveEvent {
  return {
    atrNormalizedMove: 2.1,
    eventDate: "2026-04-01",
    gapPercent: overrides.gapPercent ?? 0.8,
    maxAdverseExcursion5d: overrides.maxAdverseExcursion5d,
    maxFavorableExcursion5d: overrides.maxFavorableExcursion5d,
    moveType: "upside",
    outcomeStatus: "complete",
    preconditions: {
      atrPercent: 2.4,
      closeVsMa20Pct: overrides.closeVsMa20Pct,
      closeVsMa50Pct: overrides.closeVsMa50Pct,
      compressionPercentile: overrides.compressionPercentile ?? 28,
      gapPercent: overrides.gapPercent ?? 0.8,
      ma20TrendPct: null,
      priorFiveDayReturnPct: overrides.priorFiveDayReturnPct,
      realizedVolatility10d: 1.8,
      returnZScore: 0.9,
      volumeSpikeRatio: overrides.volumeSpikeRatio ?? 1.25,
    },
    return1d: overrides.return1d,
    return2d: null,
    return3d: null,
    return5d: overrides.return5d,
    return10d: null,
    returnZScore: 2.4,
    volumeSpikeRatio: overrides.volumeSpikeRatio ?? 1.25,
  };
}

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 76,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Core mode is waiting for confirmation while structure improves.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 46,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      atr_pct: 2.1,
      breadth_score: 72,
      entry_distance_pct: 1.4,
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 78,
      fragility_score: 46,
      liquidity_pressure: 36,
      macro_alignment_score: 72,
      price: 105,
      relative_volume: 1.4,
      return_1d: 1.2,
      risk_on_score: 68,
      risk_reward: 2.4,
      score_change: 3,
      sector: "Semiconductors",
      sector_alignment_score: 74,
      setup_type: "PULLBACK",
      symbol,
      technical_score: 76,
      volatility_pressure: 42,
      volume: 54000000,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: shock({ symbol }),
    stop_loss: 96,
    structuralLabel: "Stable structure",
    suggested_entry: 101,
    symbol,
    target: 126,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("execution intelligence rewards cleaner pullback timing", () => {
  const model = buildExecutionIntelligence(row());

  assert.equal(model.symbol, "AMD");
  assert.ok(model.entryQuality.score >= 55);
  assert.ok(model.pullbackQuality.score >= 60);
  assert.ok(model.chaseRisk.score < 70);
  assert.equal(model.calibration.currentEntryType, "pullback_entry");
  assert.ok(model.calibration.currentEntryTypeMetrics);
  assert.ok(model.calibration.currentEntryTypeMetrics.averageMfePct !== null);
  assert.ok(model.calibration.currentEntryTypeMetrics.averageMaePct !== null);
  assert.ok(model.calibration.currentEntryTypeMetrics.continuationRate !== null);
  assert.ok(model.calibration.timingProofReport.length > 0);
  assert.ok(model.compactLabels.length > 0);
  assert.doesNotMatch(model.summary, /buy now|guaranteed|sure profit/i);
});

test("execution intelligence flags extended chase-prone entries", () => {
  const model = buildExecutionIntelligence(row({
    entryStatus: "overextended",
    fragility: 84,
    raw: {
      entry_distance_pct: 11,
      return_1d: 9,
      return_5d: 18,
      rsi: 78,
      setup_type: "BREAKOUT",
      symbol: "DDOG",
      volatility_pressure: 84,
    },
    shockPattern: shock({ chaseRiskScore: 88, chaseSuccessRate: 32, symbol: "DDOG", twoSidedVolatilityScore: 82 }),
    symbol: "DDOG",
  }));

  assert.ok(model.chaseRisk.score >= 70);
  assert.ok(model.executionState === "avoid_chase" || model.executionState === "extended_entry");
  assert.ok(model.keyRisks.some((risk) => /chase|extended|volatility/i.test(risk)));
  assert.equal(model.calibration.currentEntryType, "post_gap_chase");
  assert.ok(model.calibration.currentEntryTypeMetrics?.failedBreakoutRate !== null);
});

test("execution timing system separates clean timing from confirmation risk", () => {
  const system = buildExecutionTimingSystem([
    row({ symbol: "AMD" }),
    row({
      dataFreshness: {
        ageMinutes: 120,
        humanAge: "Updated 2 hours ago",
        label: "Stale",
        lastUpdated: "2026-05-08T18:00:00.000Z",
        message: "Stale",
        status: "stale",
      },
      raw: {
        data_freshness_status: "stale",
        entry_distance_pct: 4,
        relative_volume: 0.8,
        symbol: "TSM",
      },
      symbol: "TSM",
    }),
  ]);

  assert.ok(system.topTimingQuality.some((model) => model.symbol === "AMD"));
  assert.ok(system.confirmationNeeded.some((model) => model.symbol === "TSM"));
  assert.ok(system.systemSummary.includes("setup quality from execution quality"));
  assert.match(system.calibrationSummary, /Execution calibration reviewed/);
});

test("compact execution labels expose state without advisory language", () => {
  const labels = compactExecutionLabels(row());

  assert.ok(labels.length > 0);
  assert.equal(labels.some((label) => /buy|sell/i.test(label)), false);
});

test("execution outcome calibration validates required entry types without advisory language", () => {
  const model = buildExecutionIntelligence(row({
    raw: {
      compression_percentile: 48,
      setup_type: "VOLATILITY_COMPRESSION_BREAKOUT",
      symbol: "NVDA",
    },
    symbol: "NVDA",
  }));

  const entryTypes = model.calibration.outcomeMetrics.map((metric) => metric.entryType);
  assert.deepEqual(entryTypes, [
    "pullback_entry",
    "breakout_confirmation",
    "early_momentum",
    "post_gap_chase",
    "retest_entry",
    "volatility_compression_breakout",
  ]);
  assert.ok(model.calibration.outcomeMetrics.some((metric) => metric.averageMfePct !== null && metric.averageMaePct !== null));
  assert.ok(model.calibration.outcomeMetrics.some((metric) => metric.invalidationHitRate !== null));
  assert.doesNotMatch(JSON.stringify(model.calibration), /buy now|sell now|guaranteed|sure profit/i);
});
