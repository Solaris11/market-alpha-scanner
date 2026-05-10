import assert from "node:assert/strict";
import test from "node:test";
import type { PaperPositionRow } from "@/lib/paper-data";
import { buildLiveIntelligenceSystem } from "./live-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { buildAutomatedResearchAgentsSystem } from "./research-agents";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import { buildScenarioIntelligenceSystem } from "./scenario-intelligence";
import type { ShockMovePattern } from "./shock-move";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 76,
    dataFreshness: {
      ageMinutes: 5,
      humanAge: "Updated 5 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-09T15:00:00.000Z",
      message: "Fresh - updated 5 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh",
    decision_reason: "Constructive setup with risk controls.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$103",
    eventLabel: "Event Risk Contained",
    eventRisk: 32,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 44,
    fragilityLabel: "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: {
      bearishNarrative: "Volatility expansion can weaken follow-through.",
      bullishNarrative: "Sector participation supports momentum.",
      conditionalOpportunity: "Improves if pullback stabilizes.",
      decisionReasoning: "Watch state reflects improving evidence.",
      eventReasoning: "No verified event catalyst dominates.",
      fragilityReasoning: "Fragility remains contained.",
      generatedAt: "2026-05-09T15:00:00.000Z",
      liquidityNarrative: "Liquidity pressure is moderate.",
      macroNarrative: "Macro context is supportive.",
      moderatorSummary: "Constructive, but research only.",
      narrativeDrift: {
        deteriorationScore: 24,
        label: "strengthening",
        momentumScore: 68,
        transitionSignals: ["sector breadth"],
      },
      narrativeSummary: "Sector participation supports the setup.",
      positioningNarrative: "Crowding is not dominant.",
      pressureStory: "Positive sector pressure offsets moderate risk.",
      riskLanguage: "Research only. Not financial advice.",
      riskNarrative: "Risk remains two-sided.",
      sectorNarrative: "Semiconductor breadth is supportive.",
      source: "deterministic",
      symbol,
      unsupportedClaimsDetected: false,
      volatilityNarrative: "Volatility is contained.",
      whatCouldBreak: "Breadth deterioration.",
      whatToWatch: ["relative volume", "breadth"],
      whySetupMatters: "High-priority watch candidate.",
    },
    price: 105,
    raw: {
      breadth_score: 72,
      exchange_health_score: 68,
      final_decision: "WATCH",
      final_score: 78,
      fragility_score: 44,
      liquidity_pressure: 35,
      macro_alignment_score: 70,
      price: 105,
      risk_on_score: 70,
      sector: "Semiconductors",
      sector_alignment_score: 72,
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 40,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
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

function shockPattern(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 73,
    averageDrawdownAfterEntry: "4.2%",
    averageFollowthrough1d: 1.1,
    averageFollowthrough5d: 3.8,
    averageProfitPotential: "8.5%",
    averageReversal5d: -1.5,
    chaseRiskLabel: "Elevated",
    chaseRiskScore: 70,
    chaseSuccessRate: 42,
    commonFailureConditions: ["late chase"],
    commonPreconditions: ["volatility compression"],
    currentSimilarityScore: 72,
    downsideRiskScore: 58,
    downsideShockCount: 4,
    doNotChaseZone: "extended above prior high",
    historicalExitZone: "8-12% above entry",
    invalidationZone: "below prior base",
    largestDownside1d: -9.2,
    largestUpside1d: 13.7,
    lastUpdated: "2026-05-09T15:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -6.2,
    medianUpsideShock: 8.4,
    opportunityScore: 76,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 61,
    reliabilityScore: 67,
    researchEntryZone: "$100-$103",
    shockEvents: [],
    symbol: "AMD",
    timingValidation: null,
    twoSidedVolatilityScore: 64,
    upsideShockCount: 8,
    upsideShockScore: 78,
    ...overrides,
  };
}

function paperPosition(overrides: Partial<PaperPositionRow> = {}): PaperPositionRow {
  return {
    close_reason: null,
    closed_at: null,
    current_price: 105,
    entry_price: 100,
    entry_status: "watch",
    exit_price: null,
    final_decision: "WATCH",
    id: "pos-1",
    opened_at: "2026-05-09T15:00:00.000Z",
    quantity: 100,
    rating: "B",
    realized_pnl: null,
    recommendation_quality: "watch",
    return_pct: null,
    setup_type: "MOMENTUM_CONTINUATION",
    status: "OPEN",
    stop_loss: 92,
    symbol: "AMD",
    target_price: 126,
    unrealized_pnl: 500,
    ...overrides,
  };
}

test("automated research agents escalate macro, volatility, and shock risks from structured inputs", () => {
  const rows = [
    row({ shockPattern: shockPattern(), raw: { event_shock_pressure_score: 74, return_1d: 5.4, symbol: "AMD", volume_spike_ratio: 2.5 } }),
    row({
      conviction: 58,
      eventLabel: "Verified earnings pressure",
      eventRisk: 78,
      final_score: 64,
      fragility: 76,
      macroLabel: "Macro Conflict",
      raw: {
        event_confidence: 78,
        event_context_summary: "Earnings guidance pressure confirmed from verified source.",
        event_risk_score: 78,
        liquidity_pressure: 76,
        macro_alignment_score: 38,
        symbol: "MU",
        verified_event_pressure_score: 80,
        volatility_pressure: 82,
      },
      sector: "Semiconductors",
      symbol: "MU",
    }),
  ];
  const regimeSystem = buildRegimeShiftSystem({ rows });
  const liveSystem = buildLiveIntelligenceSystem({
    driftRows: [{ latest_score: 64, price_change_pct: 5.3, score_change: 6, snapshot_count: 4, symbol: "AMD" }],
    rows,
  });

  const system = buildAutomatedResearchAgentsSystem({
    liveSystem,
    regimeSystem,
    rows,
    watchlistSymbols: ["NVDA"],
  });

  assert.equal(system.status, "active");
  assert.ok(system.agentSummaries.some((agent) => agent.agentId === "shock" && agent.status === "active"));
  assert.ok(system.riskEscalations.some((item) => item.reasonCodes.includes("VOLATILITY_PRESSURE") || item.reasonCodes.includes("VERIFIED_EVENT_CONTEXT")));
  assert.ok(system.opportunityCandidates.some((item) => item.symbol === "AMD"));
  assert.ok(system.watchlistUpdates.some((item) => item.symbol === "AMD"));
});

test("automated research agents monitor portfolio concentration without autonomous watchlist mutation", () => {
  const rows = [
    row({ shockPattern: shockPattern(), symbol: "AMD" }),
    row({ conviction: 70, fragility: 62, raw: { sector: "Semiconductors", symbol: "MU" }, sector: "Semiconductors", symbol: "MU" }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows });
  const portfolioSystem = buildPortfolioIntelligenceSystem({
    accountValue: 100_000,
    opportunities: rows,
    positions: [
      paperPosition({ quantity: 250, symbol: "AMD" }),
      paperPosition({ id: "pos-2", quantity: 220, symbol: "MU" }),
    ],
    scenarioSystem,
  });

  const system = buildAutomatedResearchAgentsSystem({
    portfolioSystem,
    rows,
    scenarioSystem,
    watchlistSymbols: ["AMD", "MU"],
  });

  const portfolioAgent = system.agentSummaries.find((agent) => agent.agentId === "portfolio_risk");
  assert.ok(portfolioAgent);
  assert.equal(portfolioAgent.status, "active");
  assert.ok(system.portfolioAlerts.length > 0);
  assert.equal(system.watchlistUpdates.some((item) => item.symbol === "AMD"), false);
});

test("automated research agent language stays research-only", () => {
  const system = buildAutomatedResearchAgentsSystem({
    rows: [row({ shockPattern: shockPattern() })],
  });
  const serialized = JSON.stringify(system).toLowerCase();
  assert.doesNotMatch(serialized, /\bbuy now\b/);
  assert.doesNotMatch(serialized, /\bsell now\b/);
  assert.doesNotMatch(serialized, /\bguaranteed\b/);
  assert.match(serialized, /research/);
});
