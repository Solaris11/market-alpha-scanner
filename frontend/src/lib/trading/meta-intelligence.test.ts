import assert from "node:assert/strict";
import test from "node:test";
import { buildUserPersonalizationProfile } from "./personalized-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildTradeVetoOperatingSystem, metaOpportunityLabel } from "./meta-intelligence";

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 78,
    averageDrawdownAfterEntry: "-4.0%",
    averageFollowthrough1d: 1.6,
    averageFollowthrough5d: 4.2,
    averageProfitPotential: "+13.0%",
    averageReversal5d: -2.0,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 44,
    chaseSuccessRate: 58,
    commonFailureConditions: ["failed continuation when volatility expanded"],
    commonPreconditions: ["volatility compression before expansion"],
    currentSimilarityScore: 70,
    downsideRiskScore: 44,
    downsideShockCount: 5,
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
    opportunityScore: 76,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 64,
    reliabilityScore: 70,
    researchEntryZone: "$100.00-$103.00",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 16,
    upsideShockScore: 80,
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

test("meta intelligence orchestrates opportunity, risk, and briefing layers", () => {
  const system = buildTradeVetoOperatingSystem({
    rows: [
      row({ symbol: "AMD" }),
      row({
        final_score: 60,
        fragility: 78,
        raw: {
          entry_distance_pct: 9,
          liquidity_pressure: 76,
          return_1d: 8,
          symbol: "DDOG",
          volatility_pressure: 82,
        },
        shockPattern: shock({ chaseRiskScore: 82, downsideRiskScore: 76, symbol: "DDOG" }),
        symbol: "DDOG",
      }),
    ],
  });

  assert.ok(system.priorityQueue.length > 0);
  assert.ok(system.executiveBriefing.length >= 2);
  assert.ok(system.opportunityHierarchy.length > 0);
  assert.ok(system.dangerQueue.some((item) => item.symbol === "DDOG"));
  assert.doesNotMatch(system.summary, /buy now|guaranteed|sure profit/i);
});

test("decision quality distinguishes attractive context from high-risk timing", () => {
  const system = buildTradeVetoOperatingSystem({
    rows: [
      row({ symbol: "AMD" }),
      row({
        final_score: 82,
        fragility: 86,
        raw: {
          entry_distance_pct: 14,
          final_score: 82,
          liquidity_pressure: 82,
          return_1d: 12,
          symbol: "MU",
          volatility_pressure: 88,
        },
        shockPattern: shock({ chaseRiskScore: 88, downsideRiskScore: 78, symbol: "MU" }),
        symbol: "MU",
      }),
    ],
  });
  const amd = system.priorityQueue.find((item) => item.symbol === "AMD");
  const mu = system.priorityQueue.find((item) => item.symbol === "MU");

  assert.ok(amd);
  assert.ok(mu);
  assert.ok(mu.metaRiskScore > amd.metaRiskScore);
  assert.ok(mu.timingQualityScore < amd.timingQualityScore);
});

test("personalized briefing reflects user risk profile without changing deterministic priority", () => {
  const profile = buildUserPersonalizationProfile({
    profile: {
      asymmetryPreference: 78,
      personalityProfile: "asymmetric_swing",
      preferredRewardLevel: "high",
      preferredRiskLevel: "medium",
    },
  });
  const system = buildTradeVetoOperatingSystem({ personalizationProfile: profile, rows: [row({ symbol: "TSM" })] });

  assert.ok(system.personalizedBriefing.some((line) => line.includes("Asymmetric Swing") || line.includes("asymmetry")));
  assert.equal(system.priorityQueue[0]?.symbol, "TSM");
});

test("meta labels expose high-level attention state", () => {
  const system = buildTradeVetoOperatingSystem({ rows: [row({ symbol: "NVDA" })] });
  const label = system.priorityQueue[0] ? metaOpportunityLabel(system.priorityQueue[0]) : "";

  assert.ok(label.length > 0);
});
