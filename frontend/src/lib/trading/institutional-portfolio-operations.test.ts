import assert from "node:assert/strict";
import test from "node:test";
import type { DataFreshness } from "@/lib/data-health";
import type { PaperPositionRow } from "@/lib/paper-data";
import type { CsvRow } from "@/lib/types";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildInstitutionalPortfolioOperationsSystem } from "./institutional-portfolio-operations";
import { buildPortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { buildScenarioIntelligenceSystem } from "./scenario-intelligence";
import { buildSimulatedAiPortfolioSystem } from "./simulated-ai-portfolio";

const fresh: DataFreshness = {
  ageMinutes: 3,
  humanAge: "Updated 3 min ago",
  label: "Fresh",
  lastUpdated: "2026-05-21T16:00:00.000Z",
  message: "Fresh - updated 3 min ago",
  status: "fresh",
};

function position(overrides: Partial<PaperPositionRow> = {}): PaperPositionRow {
  const symbol = overrides.symbol ?? "AMD";
  return {
    close_reason: null,
    closed_at: null,
    current_price: 111,
    entry_price: 105,
    entry_status: "watch",
    exit_price: null,
    final_decision: "WATCH",
    id: `${symbol}-paper`,
    opened_at: "2026-05-19T14:30:00.000Z",
    quantity: 12,
    rating: "A",
    realized_pnl: null,
    recommendation_quality: "watch",
    return_pct: null,
    setup_type: "pullback",
    status: "OPEN",
    stop_loss: 97,
    symbol,
    target_price: 128,
    unrealized_pnl: 72,
    ...overrides,
  };
}

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 72,
    averageDrawdownAfterEntry: "-3.2%",
    averageFollowthrough1d: 1.1,
    averageFollowthrough5d: 3.4,
    averageProfitPotential: "+10.0%",
    averageReversal5d: -1.4,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 42,
    chaseSuccessRate: 58,
    commonFailureConditions: ["macro support weakens"],
    commonPreconditions: ["compression before expansion"],
    currentSimilarityScore: 70,
    downsideRiskScore: 44,
    downsideShockCount: 3,
    doNotChaseZone: "$124.00+",
    historicalExitZone: "$126.00-$132.00",
    invalidationZone: "$97.00",
    largestDownside1d: -9.2,
    largestUpside1d: 14.4,
    lastUpdated: "2026-05-21T16:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -5.1,
    medianUpsideShock: 8.2,
    opportunityScore: 73,
    opportunityState: "Constructive Watch",
    pullbackSuccessRate: 63,
    reliabilityScore: 66,
    researchEntryZone: "$108.00-$111.00",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 52,
    upsideShockCount: 14,
    upsideShockScore: 76,
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
    conviction: 78,
    dataFreshness: fresh,
    decayLabel: "Fresh setup",
    decision_reason: "Structure is improving while the model waits for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$108.00-$111.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 36,
    final_decision: "WATCH",
    final_score: 79,
    fragility: 42,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 111,
    raw: {
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 79,
      fragility_score: 42,
      liquidity_pressure: 34,
      macro_alignment_score: 74,
      price: 111,
      risk_reward: 2.1,
      sector,
      setup_type: "pullback",
      symbol,
      volatility_pressure: 38,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector,
    shockPattern: shock({ symbol }),
    stop_loss: 97,
    structuralLabel: "Stable structure",
    suggested_entry: 109,
    symbol,
    target: 128,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function forwardRows(): CsvRow[] {
  return [
    { date: "2026-01-02", drawdown: -1.2, final_score: 86, fragility_score: 34, macro_alignment_score: 78, price: 100, return_pct: 4.2, risk_reward: 2.2, sector: "Semiconductors", setup_type: "pullback", symbol: "AMD", volatility_pressure: 42 },
    { date: "2026-01-05", drawdown: -6.4, final_score: 82, fragility_score: 48, macro_alignment_score: 66, price: 880, return_pct: 1.8, risk_reward: 1.7, sector: "Semiconductors", setup_type: "momentum", symbol: "NVDA", volatility_pressure: 58 },
    { date: "2026-01-08", drawdown: -7.2, final_score: 76, fragility_score: 66, macro_alignment_score: 41, price: 240, return_pct: -2.9, risk_reward: 1.3, sector: "Software", setup_type: "breakout", symbol: "CRWD", volatility_pressure: 72 },
    { date: "2026-01-12", drawdown: -2.1, final_score: 84, fragility_score: 38, macro_alignment_score: 72, price: 540, return_pct: 3.1, risk_reward: 1.9, sector: "Index", setup_type: "trend", symbol: "SPY", volatility_pressure: 35 },
  ];
}

test("institutional portfolio operations exposes lifecycle and risk budgets without inventing missing thesis data", () => {
  const opportunities = [
    opportunity({ symbol: "AMD" }),
    opportunity({
      fragility: 78,
      raw: { fragility_score: 78, macro_alignment_score: 34, sector: "Software", symbol: "DDOG", volatility_pressure: 76 },
      sector: "Software",
      shockPattern: shock({ downsideRiskScore: 76, symbol: "DDOG", twoSidedVolatilityScore: 80 }),
      symbol: "DDOG",
    }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const portfolio = buildPortfolioIntelligenceSystem({
    accountValue: 50000,
    opportunities,
    positions: [
      position({ current_price: 111, quantity: 18, symbol: "AMD" }),
      position({ current_price: 142, entry_price: 139, quantity: 10, stop_loss: null, symbol: "DDOG", target_price: null }),
    ],
    scenarioSystem,
  });

  const system = buildInstitutionalPortfolioOperationsSystem({ portfolio });

  assert.equal(system.openPositionCount, 2);
  assert.ok(system.positionLifecycle.some((item) => item.symbol === "DDOG" && item.status === "incomplete"));
  assert.ok(system.operatingLanes.some((lane) => lane.label === "Thesis Completion"));
  assert.ok(system.limitations.some((line) => /missing stop\/target\/thesis fields/i.test(line)));
  assert.ok(system.rebalanceHistory.length === 0);
});

test("institutional portfolio operations derives rebalance and strategy memory from simulation evidence", () => {
  const opportunities = [opportunity({ symbol: "AMD" }), opportunity({ raw: { sector: "Index", symbol: "SPY" }, sector: "Index", symbol: "SPY" })];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const portfolio = buildPortfolioIntelligenceSystem({
    accountValue: 100000,
    opportunities,
    positions: [position({ current_price: 111, quantity: 25, symbol: "AMD" }), position({ current_price: 545, entry_price: 540, quantity: 2, symbol: "SPY" })],
    scenarioSystem,
  });
  const simulatedPortfolio = buildSimulatedAiPortfolioSystem({
    forwardRows: forwardRows(),
    opportunities,
    startingCapital: 100000,
  });

  const system = buildInstitutionalPortfolioOperationsSystem({
    portfolio,
    preferredMode: "balanced",
    simulatedPortfolio,
  });

  assert.equal(system.activeMode, "balanced");
  assert.ok(system.rebalanceHistory.length >= 1);
  assert.ok(system.strategyMemory.length >= 1);
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Strategy Labs Memory" && item.status === "available"));
  assert.match(system.limitations.join(" "), /derived from Strategy Labs simulation evidence/i);
});
