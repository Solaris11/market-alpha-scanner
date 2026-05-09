import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInstitutionalDashboard,
  institutionalDashboardMetricLine,
  institutionalDashboardScoreLabel,
} from "./institutional-dashboard";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";

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

const universe = [
  row({ symbol: "AMD" }),
  row({ symbol: "MU", shockPattern: shock({ symbol: "MU", upsideShockScore: 84 }) }),
  row({
    assetType: "energy",
    company_name: "Occidental Petroleum",
    conviction: 60,
    raw: {
      sector: "Energy",
      setup_type: "momentum continuation",
      symbol: "OXY",
      volatility_pressure: 64,
    },
    sector: "Energy",
    shockPattern: shock({ symbol: "OXY", twoSidedVolatilityScore: 76, upsideShockScore: 62 }),
    symbol: "OXY",
  }),
  row({
    assetType: "etf",
    company_name: "SPDR Gold Trust",
    conviction: 54,
    final_score: 58,
    raw: {
      macro_alignment_score: 48,
      sector: "Gold",
      symbol: "GLD",
      volatility_pressure: 38,
    },
    sector: "Gold",
    shockPattern: null,
    symbol: "GLD",
  }),
  row({
    company_name: "Datadog",
    conviction: 62,
    final_score: 64,
    fragility: 86,
    raw: {
      entry_distance_pct: 12,
      liquidity_pressure: 82,
      return_1d: 9,
      sector: "Software",
      symbol: "DDOG",
      volatility_pressure: 88,
    },
    sector: "Software",
    shockPattern: shock({ chaseRiskScore: 88, downsideRiskScore: 78, symbol: "DDOG", twoSidedVolatilityScore: 84 }),
    symbol: "DDOG",
  }),
];

test("institutional dashboard builds market-wide heatmaps, briefing, and opportunity map", () => {
  const dashboard = buildInstitutionalDashboard({ rows: universe });

  assert.equal(dashboard.heatmaps.length, 7);
  assert.ok(dashboard.marketState.metrics.length >= 6);
  assert.ok(dashboard.executiveBriefing.length > 0);
  assert.ok(dashboard.opportunityMap.strongest.length > 0);
  assert.ok(dashboard.clusters.length > 0);
  assert.doesNotMatch(JSON.stringify(dashboard), /buy now|sell now|guaranteed|sure profit/i);
});

test("detects AI momentum, commodity shock, and fragility clusters from structured rows", () => {
  const dashboard = buildInstitutionalDashboard({ rows: universe });
  const labels = dashboard.clusters.map((cluster) => cluster.label);

  assert.ok(labels.includes("AI Momentum Cluster") || labels.includes("Semiconductor Expansion Cluster"));
  assert.ok(labels.includes("Commodity / Macro Shock Cluster"));
  assert.ok(labels.includes("High Fragility Zone"));
});

test("watchlist and dashboard modes change the visible universe without inventing rows", () => {
  const watchlist = buildInstitutionalDashboard({ mode: "watchlist", rows: universe, watchlistSymbols: ["AMD", "GLD"] });
  const conservative = buildInstitutionalDashboard({ mode: "conservative", rows: universe });
  const volatility = buildInstitutionalDashboard({ mode: "volatility", rows: universe });

  assert.equal(watchlist.visibleCount, 2);
  assert.ok(conservative.visibleCount < universe.length);
  assert.ok(volatility.visibleCount >= 1);
  assert.ok(volatility.opportunityMap.highestFragility.some((item) => item.symbol === "DDOG"));
});

test("score labels and metric lines stay concise and non-advisory", () => {
  const dashboard = buildInstitutionalDashboard({ rows: universe });
  const item = dashboard.opportunityMap.strongest[0];

  assert.equal(institutionalDashboardScoreLabel(72), "Constructive");
  assert.equal(institutionalDashboardScoreLabel(72, true), "Elevated Risk");
  assert.ok(item);
  assert.match(institutionalDashboardMetricLine(item), /opportunity .*risk/i);
  assert.doesNotMatch(institutionalDashboardMetricLine(item), /buy|sell|guaranteed/i);
});
