import assert from "node:assert/strict";
import test from "node:test";
import { buildUnifiedIntelligenceConsole } from "./unified-intelligence-console";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 76,
    averageDrawdownAfterEntry: "-4.0%",
    averageFollowthrough1d: 1.2,
    averageFollowthrough5d: 3.8,
    averageProfitPotential: "+11.0%",
    averageReversal5d: -2.2,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 48,
    chaseSuccessRate: 56,
    commonFailureConditions: ["failed when volatility expanded"],
    commonPreconditions: ["volatility compression"],
    currentSimilarityScore: 74,
    downsideRiskScore: 42,
    downsideShockCount: 4,
    doNotChaseZone: "$116.00+",
    historicalExitZone: "$122.00-$128.00",
    invalidationZone: "$96.00",
    largestDownside1d: -11.4,
    largestUpside1d: 17.8,
    lastUpdated: "2026-05-09T12:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -6.8,
    medianUpsideShock: 9.1,
    opportunityScore: 76,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 62,
    reliabilityScore: 68,
    researchEntryZone: "$100.00-$103.00",
    shockCompletedEventCount: 0,
    shockEventCount: 0,
    shockEventSpanDays: null,
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 61,
    upsideShockCount: 12,
    upsideShockScore: 81,
    ...overrides,
  };
}

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 74,
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-09T12:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Structure is improving but confirmation remains important.",
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

function workflow(): WorkflowEvolutionSummary {
  return {
    dailyBrief: ["AMD setup quality improved since last visit."],
    deterioratingSetups: [{
      changeType: "fragility_rising",
      detail: "MU became more fragile. Review invalidation and avoid treating this as a stronger core signal.",
      metricLabel: "Fragility +9.0",
      severity: "warning",
      symbol: "MU",
      title: "Fragility increased",
    }],
    improvingSetups: [{
      changeType: "improving",
      detail: "AMD setup quality improved versus the last recorded workflow snapshot.",
      metricLabel: "Score +5.0",
      severity: "positive",
      symbol: "AMD",
      title: "Setup quality improving",
    }],
    lastSeenAt: "2026-05-08T12:00:00.000Z",
    opportunityMaturity: [],
    snapshotRows: [],
    triggerMonitors: [],
    watchlistEvolution: [{
      changeType: "watchlist_momentum",
      detail: "AMD is on your watchlist and has become more relevant.",
      metricLabel: "Watch +5.0",
      severity: "positive",
      symbol: "AMD",
      title: "Watchlist momentum improving",
    }],
    whatChanged: [{
      changeType: "improving",
      detail: "AMD setup quality improved versus the last recorded workflow snapshot.",
      metricLabel: "Score +5.0",
      severity: "positive",
      symbol: "AMD",
      title: "Setup quality improving",
    }],
  };
}

test("unified console produces attention fields and consolidated sections", () => {
  const consoleModel = buildUnifiedIntelligenceConsole({
    marketCondition: "Risk-On Expansion",
    rows: [
      row({ symbol: "AMD" }),
      row({
        eventLabel: "Verified Event Pressure Elevated",
        eventRisk: 78,
        final_score: 64,
        fragility: 82,
        raw: {
          entry_distance_pct: 9,
          event_risk_score: 78,
          fragility_score: 82,
          return_1d: 8,
          score_change: -4,
          symbol: "MU",
          volatility_pressure: 84,
        },
        shockPattern: shock({ chaseRiskScore: 84, downsideRiskScore: 78, symbol: "MU", twoSidedVolatilityScore: 82 }),
        symbol: "MU",
      }),
    ],
    watchlistSymbols: ["AMD", "MU"],
    workflowEvolution: workflow(),
  });

  assert.ok(consoleModel.whatMattersMost.length >= 3);
  assert.ok(consoleModel.attentionQueue[0]?.attentionPriorityScore);
  assert.ok(consoleModel.attentionQueue[0]?.urgencyLabel);
  assert.ok(consoleModel.attentionQueue[0]?.reasonForAttention);
  assert.ok(consoleModel.attentionQueue[0]?.actionContext);
  assert.ok(consoleModel.topRisks.some((item) => item.symbol === "MU"));
  assert.ok(consoleModel.shockConditionsAligning.some((item) => item.symbol === "AMD" || item.symbol === "MU"));
  assert.ok(consoleModel.eventPressure.some((item) => item.symbol === "MU"));
  assert.ok(consoleModel.watchlistChanges.some((item) => item.symbol === "AMD"));
  assert.ok(consoleModel.rankedZones["best-setups"].topSymbols.length >= 2);
  assert.ok(consoleModel.rankedZones.dangerous.topSymbols.some((item) => item.symbol === "MU"));
  assert.ok(consoleModel.rankedZones["shock-watch"].topSymbols.every((item) => ["AMD", "MU"].includes(item.symbol)));
  assert.ok(consoleModel.rankedZones.watchlist.topSymbols.some((item) => item.symbol === "AMD"));
  assert.ok(consoleModel.rankedZones["risk-review"].rankingLogic.includes("risk/reward"));
  assert.equal(consoleModel.rankedZones.dangerous.topSymbols[0]?.rank, 1);
  assert.equal(consoleModel.llmSummaryPacket.guardrail.includes("must not invent"), true);
});

test("unified console keeps summary language non-advisory", () => {
  const consoleModel = buildUnifiedIntelligenceConsole({ rows: [row({ symbol: "NVDA" })] });
  const text = [
    consoleModel.summary,
    ...consoleModel.whatMattersMost,
    ...consoleModel.attentionQueue.map((item) => item.actionContext),
  ].join(" ");

  assert.doesNotMatch(text, /buy now|sell now|guaranteed|sure profit/i);
});
