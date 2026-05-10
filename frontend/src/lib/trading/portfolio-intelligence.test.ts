import assert from "node:assert/strict";
import test from "node:test";
import type { DataFreshness } from "@/lib/data-health";
import type { PaperPositionRow } from "@/lib/paper-data";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildPortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { buildScenarioIntelligenceSystem } from "./scenario-intelligence";

const fresh: DataFreshness = {
  ageMinutes: 4,
  humanAge: "Updated 4 min ago",
  label: "Fresh",
  lastUpdated: "2026-05-09T00:00:00.000Z",
  message: "Fresh - updated 4 min ago",
  status: "fresh",
};

function position(overrides: Partial<PaperPositionRow> = {}): PaperPositionRow {
  const symbol = overrides.symbol ?? "AMD";
  return {
    close_reason: null,
    closed_at: null,
    current_price: 106,
    entry_price: 100,
    entry_status: "watch",
    exit_price: null,
    final_decision: "WATCH",
    id: `${symbol}-position`,
    opened_at: "2026-05-09T00:00:00.000Z",
    quantity: 10,
    rating: "A",
    realized_pnl: null,
    recommendation_quality: "watch",
    return_pct: null,
    setup_type: "pullback",
    status: "OPEN",
    stop_loss: 92,
    symbol,
    target_price: 126,
    unrealized_pnl: 60,
    ...overrides,
  };
}

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
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 15,
    upsideShockScore: 78,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const sector = overrides.sector ?? "Semiconductors";
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
      sector,
      sector_alignment_score: 74,
      setup_type: "pullback",
      symbol,
      volatility_pressure: 42,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector,
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

function priceHistory(symbol: string, beta: number): Array<{ close: number; date: string }> {
  const rows: Array<{ close: number; date: string }> = [];
  let close = symbol === "AMD" ? 100 : 210;
  for (let index = 0; index < 90; index += 1) {
    const marketMove = Math.sin(index / 4) * 0.006 + (index % 9 === 0 ? 0.012 : 0.002);
    close *= 1 + marketMove * beta;
    rows.push({
      close: Number(close.toFixed(2)),
      date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    });
  }
  return rows;
}

test("portfolio intelligence detects concentrated correlated fragility", () => {
  const opportunities = [
    opportunity({ symbol: "AMD" }),
    opportunity({ fragility: 78, raw: { sector: "Semiconductors", symbol: "NVDA", volatility_pressure: 80 }, sector: "Semiconductors", shockPattern: shock({ downsideRiskScore: 78, symbol: "NVDA" }), symbol: "NVDA" }),
    opportunity({ raw: { sector: "Energy", symbol: "OXY" }, sector: "Energy", symbol: "OXY" }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const system = buildPortfolioIntelligenceSystem({
    accountValue: 10000,
    opportunities,
    positions: [
      position({ current_price: 106, quantity: 20, symbol: "AMD" }),
      position({ current_price: 900, entry_price: 880, quantity: 3, stop_loss: 790, symbol: "NVDA" }),
      position({ current_price: 61, entry_price: 60, quantity: 4, stop_loss: 54, symbol: "OXY" }),
    ],
    scenarioSystem,
  });

  assert.ok(system.openPositionCount === 3);
  assert.ok(system.concentrationScore > 35);
  assert.ok(system.liquidityRiskScore >= 35);
  assert.ok(system.shockExposureScore >= 45);
  assert.ok(system.correlationClusters.some((cluster) => cluster.label.includes("Semiconductors") || cluster.label.includes("Growth")));
  assert.ok(system.scenarioStress.some((stress) => stress.scenarioKey === "qqq_down_3" && stress.weightedVulnerabilityScore >= 45));
  assert.ok(system.scenarioStress.some((stress) => stress.scenarioKey === "liquidity_tightening"));
  assert.ok(system.stressProofSummary.length >= 1);
});

test("portfolio intelligence rewards diversified lower-fragility exposure", () => {
  const opportunities = [
    opportunity({ raw: { sector: "Energy", symbol: "OXY" }, sector: "Energy", symbol: "OXY" }),
    opportunity({ assetType: "commodity", raw: { macro_alignment_score: 68, sector: "Gold", symbol: "GLD", volatility_pressure: 28 }, sector: "Gold", symbol: "GLD" }),
    opportunity({ assetType: "index", raw: { macro_alignment_score: 62, sector: "Index", symbol: "SPY", volatility_pressure: 32 }, sector: "Index", symbol: "SPY" }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const system = buildPortfolioIntelligenceSystem({
    accountValue: 10000,
    opportunities,
    positions: [
      position({ current_price: 61, entry_price: 60, quantity: 10, stop_loss: 54, symbol: "OXY" }),
      position({ current_price: 185, entry_price: 184, quantity: 4, stop_loss: 176, symbol: "GLD" }),
      position({ current_price: 520, entry_price: 518, quantity: 1, stop_loss: 500, symbol: "SPY" }),
    ],
    scenarioSystem,
  });

  assert.ok(system.diversificationQualityScore >= 55);
  assert.ok(system.portfolioQualityScore >= 50);
  assert.ok(system.exposureBuckets.some((bucket) => bucket.label === "Defensive / Hedge"));
  assert.ok(system.hedgeOffsetContexts.some((offset) => /offset|ballast/i.test(offset.label)));
});

test("portfolio intelligence surfaces hidden factor correlation and event concentration", () => {
  const opportunities = [
    opportunity({
      eventRisk: 76,
      fragility: 72,
      raw: { event_risk_score: 78, liquidity_pressure: 74, sector: "Software", symbol: "DDOG", volatility_pressure: 76 },
      sector: "Software",
      shockPattern: shock({ downsideRiskScore: 76, symbol: "DDOG", twoSidedVolatilityScore: 82, upsideShockScore: 84 }),
      symbol: "DDOG",
    }),
    opportunity({
      eventRisk: 73,
      fragility: 70,
      raw: { event_risk_score: 75, liquidity_pressure: 72, sector: "Software", symbol: "CRWD", volatility_pressure: 74 },
      sector: "Software",
      shockPattern: shock({ downsideRiskScore: 72, symbol: "CRWD", twoSidedVolatilityScore: 79, upsideShockScore: 81 }),
      symbol: "CRWD",
    }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const system = buildPortfolioIntelligenceSystem({
    accountValue: 10000,
    opportunities,
    positions: [
      position({ current_price: 142, entry_price: 140, quantity: 20, stop_loss: 124, symbol: "DDOG" }),
      position({ current_price: 360, entry_price: 350, quantity: 8, stop_loss: 312, symbol: "CRWD" }),
    ],
    scenarioSystem,
  });

  assert.ok(system.eventConcentrationScore >= 65);
  assert.ok(system.hiddenCorrelationWarning);
  assert.ok(system.correlationClusters.some((cluster) => cluster.type === "event" || cluster.type === "liquidity" || cluster.type === "shock"));
  assert.ok(system.exposureBuckets.some((bucket) => bucket.type === "event" && bucket.label === "Elevated Event Pressure"));
  assert.ok(system.exposureBuckets.some((bucket) => bucket.type === "liquidity" && bucket.label === "Liquidity Pressure Elevated"));
  assert.ok(system.exposureBuckets.some((bucket) => bucket.type === "shock" && bucket.label === "High Shock Exposure"));
});

test("portfolio intelligence uses rolling correlation when price history is available", () => {
  const opportunities = [
    opportunity({ symbol: "AMD" }),
    opportunity({ raw: { sector: "Semiconductors", symbol: "NVDA" }, sector: "Semiconductors", symbol: "NVDA" }),
    opportunity({ raw: { sector: "Energy", symbol: "OXY" }, sector: "Energy", symbol: "OXY" }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const system = buildPortfolioIntelligenceSystem({
    opportunities,
    positions: [
      position({ current_price: 106, quantity: 10, symbol: "AMD" }),
      position({ current_price: 900, entry_price: 880, quantity: 1, stop_loss: 790, symbol: "NVDA" }),
      position({ current_price: 61, entry_price: 60, quantity: 4, stop_loss: 54, symbol: "OXY" }),
    ],
    priceHistories: {
      AMD: priceHistory("AMD", 1.0),
      NVDA: priceHistory("NVDA", 1.03),
      OXY: priceHistory("OXY", -0.35),
    },
    scenarioSystem,
  });

  assert.ok(system.rollingCorrelationPairs.length >= 1);
  assert.ok(system.rollingCorrelationConfidenceScore > 0);
  assert.ok(system.correlationClusters.some((cluster) => /rolling correlation/i.test(cluster.label)));
  assert.match(system.limitations.join(" "), /Rolling correlation uses available daily close history/);
});

test("portfolio intelligence keeps language research-oriented", () => {
  const opportunities = [opportunity({ symbol: "AMD" })];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const system = buildPortfolioIntelligenceSystem({
    opportunities,
    positions: [position({ symbol: "AMD" })],
    scenarioSystem,
  });
  const text = JSON.stringify(system);

  assert.match(system.summary, /Portfolio quality/i);
  assert.doesNotMatch(text, /guaranteed|buy now|sell now|exact forecast|financial advice[^.]/i);
});
