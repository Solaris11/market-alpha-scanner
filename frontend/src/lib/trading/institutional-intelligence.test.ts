import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import {
  buildInstitutionalIntelligence,
  buildInstitutionalPressureSystem,
  compactInstitutionalLabels,
  institutionalOpportunityState,
} from "./institutional-intelligence";

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
    shockEventCount: 0,
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

test("institutional intelligence separates pressure, asymmetry, and position quality", () => {
  const model = buildInstitutionalIntelligence(row());

  assert.equal(model.symbol, "AMD");
  assert.ok(model.netMarketPressureScore >= 60);
  assert.ok(model.institutionalQualityScore >= 60);
  assert.ok(model.asymmetryScore >= 60);
  assert.ok(model.positionQualityScore >= 55);
  assert.ok(model.positiveForces.length > 0);
  assert.doesNotMatch(model.summary, /buy now|guaranteed|sure profit/i);
});

test("crowding engine flags strong signal with weak position quality", () => {
  const crowded = buildInstitutionalIntelligence(row({
    fragility: 82,
    raw: {
      entry_distance_pct: 12,
      liquidity_pressure: 66,
      return_1d: 11,
      score_change: -3,
      symbol: "AMD",
      volatility_pressure: 84,
    },
    shockPattern: shock({ chaseRiskScore: 86, downsideRiskScore: 75, reliabilityScore: 42 }),
  }));

  assert.ok(crowded.crowdingRiskScore >= 70);
  assert.ok(crowded.dangerAlerts.some((alert) => alert.label.includes("Crowding") || alert.label.includes("Extension")));
  assert.ok(crowded.compactLabels.includes("Elevated Crowding") || crowded.compactLabels.includes("Danger Alert"));
  assert.equal(institutionalOpportunityState(crowded), crowded.dangerAlerts.some((alert) => alert.severity === "critical") ? "Danger Alert" : "Elevated Crowding");
});

test("pressure system ranks institutional leaders and danger symbols", () => {
  const system = buildInstitutionalPressureSystem([
    row({ symbol: "AMD" }),
    row({
      final_score: 56,
      fragility: 84,
      macroLabel: "Macro Conflict",
      raw: {
        entry_distance_pct: 10,
        exchange_health_score: 38,
        liquidity_pressure: 78,
        macro_alignment_score: 35,
        return_1d: 9,
        sector_alignment_score: 42,
        symbol: "DDOG",
        volatility_pressure: 82,
      },
      shockPattern: shock({ chaseRiskScore: 82, symbol: "DDOG" }),
      symbol: "DDOG",
    }),
  ]);

  assert.ok(system.institutionalLeaders.some((model) => model.symbol === "AMD"));
  assert.ok(system.dangerSymbols.some((model) => model.symbol === "DDOG"));
  assert.ok(system.pressureSummary.includes("not a trade instruction"));
});

test("compact labels expose opportunity and risk states", () => {
  const labels = compactInstitutionalLabels(row());

  assert.ok(labels.includes("High Institutional Quality") || labels.includes("Strong Asymmetry") || labels.includes("Liquidity Supported"));
});
