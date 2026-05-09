import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
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
    chaseSuccessRate: 58,
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
    pullbackSuccessRate: 64,
    reliabilityScore: 70,
    researchEntryZone: "$100.00-$103.00",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 16,
    upsideShockScore: 78,
    ...overrides,
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
});

test("compact execution labels expose state without advisory language", () => {
  const labels = compactExecutionLabels(row());

  assert.ok(labels.length > 0);
  assert.equal(labels.some((label) => /buy|sell/i.test(label)), false);
});
