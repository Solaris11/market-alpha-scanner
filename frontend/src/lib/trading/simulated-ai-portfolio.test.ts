import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildSimulatedAiPortfolioSystem } from "./simulated-ai-portfolio";
import { buildStrategyIntelligenceSystem } from "./strategy-intelligence";

function forwardRows({
  count,
  drawdown,
  finalScore = 76,
  fragility = 44,
  macro = 70,
  returnPct,
  setup = "pullback_continuation",
  shock = 66,
  startDay = 1,
  symbol = "AMD",
}: {
  count: number;
  drawdown: number;
  finalScore?: number;
  fragility?: number;
  macro?: number;
  returnPct: number;
  setup?: string;
  shock?: number;
  startDay?: number;
  symbol?: string;
}) {
  return Array.from({ length: count }, (_, index) => ({
    created_at: `2026-01-${String(((startDay + index - 1) % 28) + 1).padStart(2, "0")}T14:30:00.000Z`,
    final_score: finalScore,
    forward_return: returnPct / 100,
    fragility_score: fragility,
    horizon: "5D",
    liquidity_pressure: 38,
    macro_alignment_score: macro,
    market_regime: macro >= 66 ? "risk_on_expansion" : "mixed",
    max_drawdown_after_signal: drawdown / 100,
    price: 100 + index,
    return_pct: returnPct / 100,
    risk_reward: 2.4,
    sector: "Semiconductors",
    setup_type: setup,
    symbol: `${symbol}${index % 4}`,
    upside_shock_score: shock,
    volatility_pressure: fragility > 75 ? 82 : 42,
  }));
}

function shockPattern(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 74,
    averageDrawdownAfterEntry: "-4.0%",
    averageFollowthrough1d: 1.2,
    averageFollowthrough5d: 3.4,
    averageProfitPotential: "+10.5%",
    averageReversal5d: -1.6,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 38,
    chaseSuccessRate: 55,
    commonFailureConditions: ["failed follow-through when volatility expanded"],
    commonPreconditions: ["volatility compression before expansion"],
    currentSimilarityScore: 70,
    downsideRiskScore: 44,
    downsideShockCount: 5,
    doNotChaseZone: "$118+",
    historicalExitZone: "$124-$130",
    invalidationZone: "$96",
    largestDownside1d: -10.5,
    largestUpside1d: 18.6,
    lastUpdated: "2026-05-09T00:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -6.4,
    medianUpsideShock: 8.2,
    opportunityScore: 72,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 62,
    reliabilityScore: 70,
    researchEntryZone: "$101-$104",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 55,
    upsideShockCount: 16,
    upsideShockScore: 76,
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
    entryZoneLabel: "$101-$104",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 42,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 106,
    raw: {
      final_decision: "WATCH",
      final_score: 78,
      fragility_score: 42,
      liquidity_pressure: 36,
      macro_alignment_score: 72,
      price: 106,
      return_1d: 1.1,
      risk_reward: 2.5,
      sector: "Semiconductors",
      setup_type: "pullback",
      symbol,
      volatility_pressure: 42,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: shockPattern({ symbol }),
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

test("simulated AI portfolios build three research-only modes with transparent metrics", () => {
  const forward = [
    ...forwardRows({ count: 44, drawdown: -2.2, returnPct: 2.3 }),
    ...forwardRows({ count: 36, drawdown: -8.4, finalScore: 82, fragility: 84, returnPct: 4.2, setup: "momentum_breakout", shock: 84, startDay: 8, symbol: "DDOG" }),
  ];
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows: forward });
  const system = buildSimulatedAiPortfolioSystem({
    forwardRows: forward,
    opportunities: [opportunity({ symbol: "AMD" }), opportunity({ fragility: 84, raw: { setup_type: "momentum_breakout", symbol: "DDOG", volatility_pressure: 82 }, shockPattern: shockPattern({ chaseRiskScore: 78, opportunityScore: 82, symbol: "DDOG", upsideShockScore: 86 }), symbol: "DDOG" })],
    strategySystem,
  });

  assert.equal(system.simulationOnly, true);
  assert.deepEqual(Object.keys(system.modes).sort(), ["aggressive", "balanced", "conservative"]);
  assert.ok(system.modes.balanced.stats.closedTradeCount > 0);
  assert.ok(system.modes.balanced.equityCurve.length > 1);
  assert.ok(system.modes.balanced.stats.strategyQualityScore >= 0);
  assert.ok(system.modes.balanced.learning.learningTimeline.length > 0);
  assert.ok(system.modes.balanced.learning.heatmap.length >= 4);
  assert.ok(system.modes.balanced.learning.lessons.length > 0);
  assert.deepEqual(system.modes.balanced.capitalScenarios.map((scenario) => scenario.startingCapital), [10_000, 50_000, 100_000]);
  assert.doesNotMatch(JSON.stringify(system), /buy now|sell now|guaranteed|sure profit|free money/i);
});

test("conservative mode filters more fragility than aggressive mode", () => {
  const forward = [
    ...forwardRows({ count: 30, drawdown: -2.4, returnPct: 1.4 }),
    ...forwardRows({ count: 34, drawdown: -9.4, finalScore: 84, fragility: 86, returnPct: 4.8, setup: "momentum_breakout", shock: 88, symbol: "MU" }),
  ];
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows: forward });
  const system = buildSimulatedAiPortfolioSystem({
    forwardRows: forward,
    opportunities: [
      opportunity({ symbol: "AMD" }),
      opportunity({ fragility: 86, raw: { setup_type: "momentum_breakout", symbol: "MU", volatility_pressure: 86 }, shockPattern: shockPattern({ chaseRiskScore: 62, opportunityScore: 88, symbol: "MU", upsideShockScore: 90 }), symbol: "MU" }),
    ],
    strategySystem,
  });

  assert.ok(system.modes.aggressive.openPositions.length >= system.modes.conservative.openPositions.length);
  assert.ok(system.modes.aggressive.stats.totalCurrentAllocationPct >= system.modes.conservative.stats.totalCurrentAllocationPct);
  assert.equal(system.modes.conservative.config.maxFragilityScore < system.modes.aggressive.config.maxFragilityScore, true);
});

test("closed trade history explains entries and exits without LLM-authored numbers", () => {
  const forward = forwardRows({ count: 32, drawdown: -3, returnPct: 2.1 });
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows: forward });
  const system = buildSimulatedAiPortfolioSystem({ forwardRows: forward, opportunities: [opportunity()], strategySystem });
  const trade = system.modes.balanced.closedTrades[0];

  assert.ok(trade);
  assert.ok(trade.entryReasons.some((reason) => /score|threshold|strategy/i.test(reason)));
  assert.ok(trade.exitReasons.some((reason) => /completed 5D evidence window/i.test(reason)));
  assert.ok(Number.isFinite(trade.realizedPnl));
  assert.ok(Number.isFinite(trade.realizedReturnPct));
  assert.ok(Number.isFinite(trade.investedAmount));
  assert.ok(Number.isFinite(trade.capitalBefore));
  assert.ok(Number.isFinite(trade.capitalAfter));
  assert.ok(trade.confidenceAtEntry >= 0);
  assert.ok(trade.confidenceAtExit >= 0);
  assert.ok(trade.learning.lesson.length > 0);
  assert.ok(trade.learning.adjustment.length > 0);
});

test("portfolio learning system exposes decision reviews and allocation exposure", () => {
  const forward = [
    ...forwardRows({ count: 26, drawdown: -2.0, returnPct: 3.2, symbol: "NVDA" }),
    ...forwardRows({ count: 24, drawdown: -11.0, finalScore: 70, fragility: 82, macro: 38, returnPct: -4.1, setup: "momentum_breakout", symbol: "TSLA" }),
  ];
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows: forward });
  const system = buildSimulatedAiPortfolioSystem({
    forwardRows: forward,
    opportunities: [opportunity({ symbol: "NVDA" }), opportunity({ fragility: 78, raw: { macro_alignment_score: 42, setup_type: "momentum_breakout", symbol: "TSLA", volatility_pressure: 82 }, symbol: "TSLA" })],
    strategySystem,
  });
  const learning = system.modes.aggressive.learning;

  assert.ok(learning.decisionReview.bestDecision.label.length > 0);
  assert.ok(learning.decisionReview.weakestDecision.label.length > 0);
  assert.ok(learning.exposureBuckets.some((bucket) => bucket.type === "strategy" || bucket.type === "sector"));
  assert.ok(learning.confidenceTrend.every((value) => Number.isFinite(value)));
  assert.ok(learning.riskTrend.every((value) => Number.isFinite(value)));
  assert.ok(learning.adjustmentSummary.length > 0);
});
