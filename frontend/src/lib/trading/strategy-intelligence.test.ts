import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildStrategyIntelligenceSystem } from "./strategy-intelligence";

function forwardRows({
  count,
  drawdown,
  event = "none",
  fragility = 42,
  macro = 64,
  regime = "balanced",
  returnPct,
  sector = "Semiconductors",
  setup,
  symbol = "AMD",
  volatility = 38,
}: {
  count: number;
  drawdown: number;
  event?: string;
  fragility?: number;
  macro?: number;
  regime?: string;
  returnPct: number;
  sector?: string;
  setup: string;
  symbol?: string;
  volatility?: number;
}) {
  return Array.from({ length: count }, (_, index) => ({
    final_score: 72,
    forward_return: returnPct / 100,
    fragility_score: fragility,
    horizon: "5D",
    liquidity_pressure: 38,
    macro_alignment_score: macro,
    market_regime: regime,
    max_drawdown_after_signal: drawdown / 100,
    return_pct: returnPct / 100,
    sector,
    setup_type: setup,
    symbol: `${symbol}${index % 3}`,
    verified_event_signature: event,
    volatility_pressure: volatility,
  }));
}

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 76,
    averageDrawdownAfterEntry: "-4.5%",
    averageFollowthrough1d: 1.1,
    averageFollowthrough5d: 3.8,
    averageProfitPotential: "+12.0%",
    averageReversal5d: -1.8,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 42,
    chaseSuccessRate: 56,
    commonFailureConditions: ["failed follow-through when volatility expanded"],
    commonPreconditions: ["volatility compression before expansion"],
    currentSimilarityScore: 72,
    downsideRiskScore: 46,
    downsideShockCount: 4,
    doNotChaseZone: "$118.00+",
    historicalExitZone: "$124.00-$130.00",
    invalidationZone: "$96.00",
    largestDownside1d: -11.5,
    largestUpside1d: 19.2,
    lastUpdated: "2026-05-09T00:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -6.9,
    medianUpsideShock: 8.8,
    opportunityScore: 74,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 62,
    reliabilityScore: 70,
    researchEntryZone: "$101.00-$104.00",
    shockCompletedEventCount: 0,
    shockEventCount: 0,
    shockEventSpanDays: null,
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 57,
    upsideShockCount: 15,
    upsideShockScore: 78,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 74,
    dataFreshness: {
      ageMinutes: 6,
      humanAge: "Updated 6 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-09T00:00:00.000Z",
      message: "Fresh - updated 6 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Structure improving while core mode waits for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$101.00-$104.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WATCH",
    final_score: 76,
    fragility: 44,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 106,
    raw: {
      final_decision: "WATCH",
      final_score: 76,
      fragility_score: 44,
      macro_alignment_score: 72,
      price: 106,
      return_1d: 1.1,
      sector: "Semiconductors",
      setup_type: "pullback",
      symbol,
      volatility_pressure: 42,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: shock({ symbol }),
    stop_loss: 96,
    structuralLabel: "Stable structure",
    suggested_entry: 102,
    symbol,
    target: 126,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("strategy intelligence identifies alpha persistence versus baseline", () => {
  const system = buildStrategyIntelligenceSystem({
    forwardRows: [
      ...forwardRows({ count: 48, drawdown: -2.4, returnPct: 2.4, setup: "pullback_continuation" }),
      ...forwardRows({ count: 40, drawdown: -5.8, returnPct: -0.4, setup: "momentum_breakout", symbol: "MU" }),
    ],
    generatedAt: "2026-05-09T00:00:00.000Z",
  });

  const pullback = system.bestStrategies.find((row) => row.family === "pullback_continuation");
  assert.ok(pullback);
  assert.ok(pullback.alphaScore > 55);
  assert.ok(pullback.strategyQualityScore >= 55);
  assert.ok(system.alphaClusters.some((cluster) => cluster.strategyFamily === "pullback_continuation"));
});

test("strategy quality separates high-momentum returns from poor position quality", () => {
  const system = buildStrategyIntelligenceSystem({
    forwardRows: [
      ...forwardRows({ count: 42, drawdown: -3.2, returnPct: 2.1, setup: "pullback_continuation" }),
      ...forwardRows({ count: 42, drawdown: -13.5, fragility: 92, returnPct: 3.4, setup: "momentum_breakout", symbol: "DDOG", volatility: 88 }),
    ],
  });
  const pullback = system.bestStrategies.find((row) => row.family === "pullback_continuation");
  const highFragility = [...system.bestStrategies, ...system.deterioratingStrategies].find((row) => row.family === "high_fragility_momentum");

  assert.ok(pullback);
  assert.ok(highFragility);
  assert.ok(highFragility.downsideRiskScore > pullback.downsideRiskScore);
  assert.ok(highFragility.strategyQualityScore < pullback.strategyQualityScore);
});

test("strategy matrix includes regime and event-sensitive cohorts", () => {
  const system = buildStrategyIntelligenceSystem({
    forwardRows: [
      ...forwardRows({ count: 35, drawdown: -2.8, event: "earnings_beat", regime: "risk_on_expansion", returnPct: 2.2, setup: "momentum_breakout" }),
      ...forwardRows({ count: 35, drawdown: -4.4, event: "fed_rates_pressure", regime: "liquidity_tightening", returnPct: -0.6, setup: "momentum_breakout", symbol: "QQQ" }),
    ],
  });

  assert.ok(system.strategyMatrix.some((row) => row.axis === "market_regime"));
  assert.ok(system.strategyMatrix.some((row) => row.axis === "event_signature"));
  assert.ok(system.bestStrategies.some((row) => row.family === "post_earnings_continuation"));
});

test("current opportunity ranking uses strategy evidence without unsafe language", () => {
  const system = buildStrategyIntelligenceSystem({
    forwardRows: [
      ...forwardRows({ count: 40, drawdown: -2.6, returnPct: 2.5, setup: "pullback_continuation" }),
      ...forwardRows({ count: 36, drawdown: -4.2, returnPct: 0.2, setup: "momentum_breakout", symbol: "TSM" }),
    ],
    opportunities: [
      opportunity({ symbol: "AMD" }),
      opportunity({ fragility: 82, raw: { setup_type: "momentum_breakout", symbol: "MU", volatility_pressure: 85 }, symbol: "MU" }),
    ],
  });
  const unsafeText = JSON.stringify(system);

  assert.equal(system.currentOpportunities[0]?.symbol, "AMD");
  assert.doesNotMatch(unsafeText, /buy now|guaranteed|free money|sure profit/i);
});
