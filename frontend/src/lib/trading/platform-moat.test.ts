import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { MarketMemorySummary } from "./market-memory";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildPlatformMoatSystem } from "./platform-moat";
import { buildUserPersonalizationProfile } from "./personalized-intelligence";
import { buildPredictiveIntelligenceSystem } from "./predictive-intelligence";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

function row(symbol: string, sector: string, score: number, overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: score >= 70 ? "High" : "Medium",
    conviction: Math.max(45, score - 4),
    dataFreshness: {
      ageMinutes: 2,
      humanAge: "Updated 2 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-30T18:00:00.000Z",
      message: "Fresh - updated 2 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: `${symbol} has source-backed scanner context and bounded risk evidence.`,
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: score % 2 === 0 ? "Verified Event Watch" : "Event Risk Contained",
    eventRisk: score % 2 === 0 ? 64 : 34,
    final_decision: "WATCH",
    final_score: score,
    fragility: Math.max(25, 100 - score),
    fragilityLabel: "Measured fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 100 + score,
    raw: {
      event_context_label: score % 2 === 0 ? "source-linked catalyst" : "contained",
      final_decision: "WATCH",
      final_score: score,
      fragility_score: Math.max(25, 100 - score),
      liquidity_pressure: 38,
      macro_alignment_score: Math.min(88, score + 4),
      macro_event_regime_signature: "risk-on-growth",
      market_regime: "RISK_ON",
      price: 100 + score,
      sector,
      setup_type: score >= 75 ? "MOMENTUM_CONTINUATION" : "PULLBACK_WATCH",
      symbol,
      verified_event_signature: score % 2 === 0 ? `${symbol}-verified-catalyst` : undefined,
      volatility_pressure: 42,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector,
    shockPattern: null,
    stop_loss: 92,
    structuralLabel: "Stable structure",
    suggested_entry: 101,
    symbol,
    target: 124,
  };
  return { ...base, ...overrides, raw: { ...base.raw, ...(overrides.raw ?? {}) } };
}

function memory(symbol: string, peer: string): MarketMemorySummary {
  return {
    analogs: [
      {
        decision: "WATCH",
        finalScore: 78,
        marketRegime: "RISK_ON",
        outcomes: [{ horizon: "5D", returnPct: 0.042 }],
        reasonCodes: ["same_setup_type", "similar_regime", "same_sector"],
        scoreBucket: "75-84",
        sector: "Technology",
        setupType: "MOMENTUM_CONTINUATION",
        signalTimestamp: "2026-05-20T18:00:00.000Z",
        similarityScore: 82,
        symbol: peer,
      },
      {
        decision: "WATCH",
        finalScore: 72,
        marketRegime: "RISK_ON",
        outcomes: [{ horizon: "5D", returnPct: -0.012 }],
        reasonCodes: ["similar_score_range", "similar_macro_event_regime"],
        scoreBucket: "65-74",
        sector: "Technology",
        setupType: "PULLBACK_WATCH",
        signalTimestamp: "2026-05-18T18:00:00.000Z",
        similarityScore: 68,
        symbol,
      },
    ],
    available: true,
    confidence: { drivers: ["analog depth", "outcome coverage"], label: "Moderate confidence", score: 72 },
    evidence: {
      explanation: "Moderate evidence confidence based on comparable historical setups. Outcomes can still vary by regime.",
      label: "Moderate evidence confidence",
      sampleSize: 42,
      tier: "moderate",
    },
    generatedAt: "2026-05-30T18:00:00.000Z",
    narrative: ["Comparable setup memory exists."],
    outcome: {
      averageReturn: 0.015,
      downsideRisk: -0.012,
      horizon: "5D",
      medianReturn: 0.015,
      winRate: 0.56,
    },
  };
}

const workflow: WorkflowEvolutionSummary = {
  dailyBrief: ["AMD and NVDA improved in the latest workflow baseline."],
  deterioratingSetups: [],
  improvingSetups: [{
    changeType: "improving",
    detail: "AMD setup quality improved versus the prior workflow snapshot.",
    metricLabel: "Score +6",
    severity: "positive",
    symbol: "AMD",
    title: "Setup quality improving",
  }],
  lastSeenAt: "2026-05-29T18:00:00.000Z",
  opportunityMaturity: [],
  snapshotRows: [],
  triggerMonitors: [{
    condition: "Research trigger proximity",
    distanceLabel: "1.2%",
    priority: "high",
    reason: "NVDA moved closer to a research trigger zone.",
    symbol: "NVDA",
  }],
  watchlistEvolution: [],
  whatChanged: [],
};

function rows(): OpportunityViewModel[] {
  return [
    row("AMD", "Semiconductors", 82),
    row("NVDA", "Semiconductors", 80),
    row("AVGO", "Semiconductors", 76),
    row("MSFT", "Software", 74),
    row("AAPL", "Technology", 72),
    row("XLF", "Financials", 68),
    row("JPM", "Financials", 66),
    row("XLE", "Energy", 70),
    row("OXY", "Energy", 64),
    row("XLV", "Healthcare", 67),
    row("LLY", "Healthcare", 73),
    row("QQQ", "Index", 75),
  ];
}

describe("platform moat construction", () => {
  test("certifies proprietary datasets, unique signals, and defensibility when evidence is present", () => {
    const sourceRows = rows();
    const marketMemoryBySymbol = new Map([
      ["AMD", memory("AMD", "NVDA")],
      ["NVDA", memory("NVDA", "AMD")],
      ["AVGO", memory("AVGO", "AMD")],
      ["MSFT", memory("MSFT", "AAPL")],
    ]);
    const predictiveSystem = buildPredictiveIntelligenceSystem({
      regimeSystem: buildRegimeShiftSystem({ rows: sourceRows, workflowEvolution: workflow }),
      rows: sourceRows,
      watchlistSymbols: ["AMD", "NVDA", "MSFT"],
    });
    const system = buildPlatformMoatSystem({
      marketMemoryBySymbol,
      personalizationProfile: buildUserPersonalizationProfile({
        behavior: { alertEngagement: 3, repeatedSymbolViews: 8, watchlistCount: 3 },
        profile: { personalityProfile: "momentum" },
        source: "hybrid",
      }),
      predictiveSystem,
      rows: sourceRows,
      watchlistSymbols: ["AMD", "NVDA", "MSFT"],
      workflowEvolution: workflow,
    });

    assert.equal(system.certification.overallStatus, "ready");
    assert.equal(system.certification.finalVerdict, "TRADEVETO PLATFORM MOAT CONSTRUCTION ACCOMPLISHED");
    assert.ok(system.proprietaryDatasets.length >= 3);
    assert.ok(system.uniqueSignals.length >= 4);
    assert.ok(system.defensibility.moatScore >= 70);
    assert.ok(system.marketMemoryGraph.edges.length >= 8);
    assert.ok(system.userIntelligenceGraph.edges.length >= 3);
    assert.ok(system.opportunityKnowledgeGraph.edges.length >= 20);
  });

  test("keeps moat claims bounded and free of unsupported monopoly language", () => {
    const system = buildPlatformMoatSystem({
      marketMemoryBySymbol: new Map([["AMD", memory("AMD", "NVDA")]]),
      rows: rows(),
      watchlistSymbols: ["AMD"],
      workflowEvolution: workflow,
    });
    const serialized = JSON.stringify(system);

    assert.equal(system.certification.noUnsupportedClaims, true);
    assert.match(system.proofBoundary, /does not claim competitors cannot copy every visible feature/i);
    assert.doesNotMatch(serialized, /\bimpossible to copy|permanent monopoly|guaranteed moat|unbeatable\b/i);
  });

  test("refuses readiness when graph evidence is too thin", () => {
    const sourceRows = [row("AMD", "Semiconductors", 82)];
    const system = buildPlatformMoatSystem({ rows: sourceRows });

    assert.equal(system.certification.overallStatus, "not_ready");
    assert.ok(system.certification.blockers.length > 0);
  });
});
