import assert from "node:assert/strict";
import test from "node:test";
import type { DataFreshness } from "@/lib/data-health";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildScenarioIntelligenceSystem } from "./scenario-intelligence";

const fresh: DataFreshness = {
  ageMinutes: 4,
  humanAge: "Updated 4 min ago",
  label: "Fresh",
  lastUpdated: "2026-05-09T00:00:00.000Z",
  message: "Fresh - updated 4 min ago",
  status: "fresh",
};

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 74,
    averageDrawdownAfterEntry: "-4.2%",
    averageFollowthrough1d: 1.2,
    averageFollowthrough5d: 3.8,
    averageProfitPotential: "+12.0%",
    averageReversal5d: -1.7,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 44,
    chaseSuccessRate: 55,
    commonFailureConditions: ["volatility expansion"],
    commonPreconditions: ["compression before expansion"],
    currentSimilarityScore: 70,
    downsideRiskScore: 48,
    downsideShockCount: 5,
    doNotChaseZone: "$118.00+",
    historicalExitZone: "$126.00-$132.00",
    invalidationZone: "$98.00",
    largestDownside1d: -12.1,
    largestUpside1d: 18.5,
    lastUpdated: "2026-05-09T00:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -6.8,
    medianUpsideShock: 9.1,
    opportunityScore: 72,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 62,
    reliabilityScore: 68,
    researchEntryZone: "$102.00-$104.00",
    shockCompletedEventCount: 0,
    shockEventCount: 0,
    shockEventSpanDays: null,
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 15,
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
    dataFreshness: fresh,
    decayLabel: "Fresh setup",
    decision_reason: "Structure improving while core mode waits for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$102.00-$104.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 44,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 106,
    raw: {
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 78,
      fragility_score: 44,
      liquidity_pressure: 35,
      macro_alignment_score: 72,
      price: 106,
      return_1d: 1.2,
      sector: "Semiconductors",
      sector_alignment_score: 74,
      setup_type: "pullback",
      symbol,
      volatility_pressure: 42,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: shock({ symbol }),
    stop_loss: 98,
    structuralLabel: "Stable structure",
    suggested_entry: 103,
    symbol,
    target: 126,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("scenario engine stresses high-beta growth under QQQ and VIX shocks", () => {
  const system = buildScenarioIntelligenceSystem({
    rows: [
      row({ symbol: "AMD" }),
      row({
        fragility: 82,
        raw: { liquidity_pressure: 78, return_1d: 8.5, sector: "Software", symbol: "DDOG", volatility_pressure: 86 },
        sector: "Software",
        shockPattern: shock({ downsideRiskScore: 82, symbol: "DDOG" }),
        symbol: "DDOG",
      }),
    ],
  });
  const ddog = system.symbolProfiles.find((profile) => profile.symbol === "DDOG");
  const amd = system.symbolProfiles.find((profile) => profile.symbol === "AMD");

  assert.ok(ddog);
  assert.ok(amd);
  assert.ok(ddog.worstCaseVulnerabilityScore > amd.worstCaseVulnerabilityScore);
  assert.ok(ddog.impacts.some((impact) => impact.scenario.key === "vix_spike" && impact.downsideVulnerabilityScore >= 70));
  assert.ok(ddog.impacts.some((impact) => impact.scenario.key === "liquidity_tightening" && impact.keyDrivers.includes("liquidity pressure")));
});

test("scenario engine treats energy names differently during oil breakout", () => {
  const system = buildScenarioIntelligenceSystem({
    rows: [
      row({
        raw: { macro_alignment_score: 62, sector: "Energy", symbol: "OXY" },
        sector: "Energy",
        symbol: "OXY",
      }),
      row({ symbol: "NVDA" }),
    ],
  });
  const oxy = system.symbolProfiles.find((profile) => profile.symbol === "OXY");
  const nvda = system.symbolProfiles.find((profile) => profile.symbol === "NVDA");
  const oxyOil = oxy?.impacts.find((impact) => impact.scenario.key === "oil_breakout");
  const nvdaOil = nvda?.impacts.find((impact) => impact.scenario.key === "oil_breakout");

  assert.ok(oxyOil);
  assert.ok(nvdaOil);
  assert.ok(oxyOil.resilienceScore > nvdaOil.resilienceScore);
});

test("scenario engine produces portfolio summaries without prediction language", () => {
  const system = buildScenarioIntelligenceSystem({
    rows: [
      row({ symbol: "TSM" }),
      row({ raw: { event_context_label: "earnings risk", event_risk_score: 80, symbol: "CRWD" }, symbol: "CRWD" }),
    ],
  });
  const text = JSON.stringify(system);

  assert.ok(system.scenarioSummaries.length >= 11);
  assert.ok(system.scenarioSummaries.some((summary) => summary.scenario.key === "liquidity_tightening"));
  assert.ok(system.terminalInsights.length > 0);
  assert.doesNotMatch(text, /guaranteed|predicts exact|buy now|sell now/i);
});
