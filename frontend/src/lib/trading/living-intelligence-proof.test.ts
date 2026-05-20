import assert from "node:assert/strict";
import test from "node:test";
import { buildLivingIntelligenceProofSystem } from "./living-intelligence-proof";
import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { LiveIntelligenceSystem } from "./live-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 72,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-20T14:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Research mode only.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$103",
    eventLabel: "Event Context Mixed",
    eventRisk: 42,
    final_decision: "WATCH",
    final_score: 72,
    fragility: 44,
    fragilityLabel: "Moderate",
    macroAdjustment: 3,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      analog_quality_score: 66,
      confidence_change: 7,
      evidence_sample_size: 140,
      final_decision: "WATCH",
      final_score: 72,
      macro_alignment_score: 68,
      price: 105,
      replay_similarity_score: 64,
      setup_type: "CONTINUATION",
      shock_score: 48,
      symbol,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Technology",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable trend",
    suggested_entry: 101,
    symbol,
    target: 122,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

const workflow: WorkflowEvolutionSummary = {
  dailyBrief: ["AMD improved while TSLA weakened."],
  deterioratingSetups: [{
    changeType: "fragility_rising",
    detail: "TSLA became more fragile.",
    metricLabel: "Fragility +12",
    severity: "warning",
    symbol: "TSLA",
    title: "Fragility increased",
  }],
  improvingSetups: [{
    changeType: "improving",
    detail: "AMD setup quality improved.",
    metricLabel: "Score +8",
    severity: "positive",
    symbol: "AMD",
    title: "Setup quality improving",
  }],
  lastSeenAt: "2026-05-20T13:00:00.000Z",
  opportunityMaturity: [],
  snapshotRows: [],
  triggerMonitors: [],
  watchlistEvolution: [{
    changeType: "watchlist_momentum",
    detail: "AMD watchlist attention increased.",
    metricLabel: "Watch +6",
    severity: "positive",
    symbol: "AMD",
    title: "Watchlist momentum improved",
  }],
  whatChanged: [{
    changeType: "macro_shift",
    detail: "TSLA macro alignment deteriorated.",
    metricLabel: "Macro -9",
    severity: "warning",
    symbol: "TSLA",
    title: "Macro alignment deteriorated",
  }],
};

const feedItem: IntelligenceFeedItem = {
  actionHref: "/symbol/TSLA",
  category: "watchlist_risk_escalation",
  dataTimestamp: "2026-05-20T14:00:00.000Z",
  evidenceLabel: "Latest scan",
  itemType: "risk_pressure_increased",
  monitorNext: "Watch whether fragility keeps broadening.",
  notificationEligible: true,
  relatedSymbol: "TSLA",
  severity: "warning",
  sourceKey: "risk-tsla",
  summary: "TSLA risk pressure increased.",
  title: "Tracked risk escalated",
  whyItMatters: "Watchlist context is now more fragile.",
};

const portfolioSystem: PortfolioIntelligenceSystem = {
  accountValue: 100000,
  asymmetryScore: 62,
  concentrationScore: 71,
  correlationClusters: [{
    label: "Technology overlap",
    reason: "AMD and NVDA share technology and macro exposure.",
    score: 74,
    symbols: ["AMD", "NVDA"],
    tone: "warn",
    type: "macro",
  }],
  diversificationQualityScore: 42,
  eventConcentrationScore: 36,
  exposureBuckets: [{
    label: "Technology",
    percent: 68,
    riskScore: 71,
    symbols: ["AMD", "NVDA"],
    tone: "warn",
    type: "sector",
    value: 68000,
  }],
  fragilityScore: 64,
  generatedAt: "2026-05-20T14:00:00.000Z",
  hedgeOffsetContexts: [],
  heatmap: [],
  hiddenCorrelationWarning: null,
  limitations: [],
  liquidityRiskScore: 48,
  macroAlignmentScore: 56,
  openPositionCount: 2,
  openRiskAmount: 3400,
  portfolioQualityLabel: "Concentrated",
  portfolioQualityScore: 52,
  positionContexts: [],
  rollingCorrelationConfidenceScore: 44,
  rollingCorrelationPairs: [],
  scenarioStress: [],
  scenarioVulnerabilityScore: 58,
  shockExposureScore: 55,
  stressProofSummary: [],
  summary: "Portfolio exposure is concentrated in technology with moderate fragility.",
  totalExposureValue: 68000,
};

const liveSystem: LiveIntelligenceSystem = {
  alerts: [{
    detail: "Volatility and breadth are shifting quickly enough to monitor risk.",
    reasonCodes: ["LIVE_REGIME_SHIFT"],
    score: 78,
    severity: "warning",
    title: "Live regime shift watch",
  }],
  breadthScore: 42,
  dashboardUpdates: [{
    detail: "Market state is deteriorating across live drift rows.",
    label: "Market State",
    score: 74,
    severity: "warning",
  }],
  eventReactionScore: 65,
  generatedAt: "2026-05-20T14:00:00.000Z",
  intraday: {} as LiveIntelligenceSystem["intraday"],
  latencyLabel: "30s bounded",
  limitations: [],
  liveSummary: "Risk is shifting.",
  marketState: "RISK REVIEW",
  opportunityDriftScore: 58,
  refreshIntervalMs: 30000,
  regimeShiftScore: 74,
  sequence: 2,
  shockEscalations: [],
  shockEscalationScore: 66,
  status: "connected",
  streamMode: "snapshot",
  unusualVolumeScore: 52,
  volatilityPressure: 78,
};

test("living intelligence proof composes feed, workflow, memory, risk, portfolio, and telemetry contract", () => {
  const system = buildLivingIntelligenceProofSystem({
    feedItems: [feedItem],
    generatedAt: "2026-05-20T14:05:00.000Z",
    liveSystem,
    marketCondition: "RISK REVIEW",
    portfolioSystem,
    rows: [
      opportunity({ symbol: "AMD" }),
      opportunity({ eventRisk: 82, final_score: 46, fragility: 84, raw: { macro_alignment_score: 32, shock_score: 78, symbol: "TSLA" }, sector: "Technology", symbol: "TSLA" }),
      opportunity({ final_score: 69, raw: { confidence_change: -5, macro_alignment_score: 61, replay_similarity_score: 52, symbol: "NVDA" }, sector: "Technology", symbol: "NVDA" }),
    ],
    watchlistSymbols: ["AMD", "TSLA"],
    workflowEvolution: workflow,
  });

  assert.ok(system.proofScore >= 70);
  assert.ok(system.proofSignals.some((signal) => signal.category === "evolving_feed"));
  assert.ok(system.proofSignals.some((signal) => signal.category === "risk_evolution"));
  assert.ok(system.proofSignals.some((signal) => signal.category === "memory_awareness"));
  assert.ok(system.proofSignals.some((signal) => signal.category === "portfolio_warning"));
  assert.ok(system.attentionShifts.some((signal) => signal.category === "dynamic_attention" || signal.category === "adaptive_prioritization"));
  assert.deepEqual(system.telemetryContract.map((item) => item.eventName), [
    "first_useful_action",
    "feed_engagement",
    "watchlist_usage",
    "scanner_usage",
    "strategy_usage",
    "replay_usage",
    "notification_engagement",
  ]);
  assert.match(system.guardrail, /not a market prediction/i);
});

test("living intelligence proof degrades honestly when no evidence exists", () => {
  const system = buildLivingIntelligenceProofSystem({ rows: [] });

  assert.ok(system.proofScore < 60);
  assert.ok(system.proofSignals.some((signal) => /building|waiting/i.test(`${signal.title} ${signal.detail}`)));
  assert.ok(system.telemetryContract.length >= 7);
});
