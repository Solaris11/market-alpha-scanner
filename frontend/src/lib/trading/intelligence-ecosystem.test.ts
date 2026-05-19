import assert from "node:assert/strict";
import test from "node:test";
import { buildIntelligenceEcosystemSystem } from "./intelligence-ecosystem";
import type { IntelligenceFeedItem } from "./intelligence-feed";
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
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-19T09:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Research mode only.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$103",
    eventLabel: "Event Context Mixed",
    eventRisk: 44,
    final_decision: "WATCH",
    final_score: 72,
    fragility: 42,
    fragilityLabel: "Moderate",
    macroAdjustment: 4,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      final_decision: "WATCH",
      final_score: 72,
      large_move_history_score: 62,
      macro_alignment_score: 68,
      price: 105,
      replay_similarity_score: 61,
      setup_type: "CONTINUATION",
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
  lastSeenAt: "2026-05-18T09:00:00.000Z",
  opportunityMaturity: [],
  snapshotRows: [],
  triggerMonitors: [],
  watchlistEvolution: [{
    changeType: "watchlist_momentum",
    detail: "AMD is on your watchlist and became more relevant.",
    metricLabel: "Watch +5",
    severity: "positive",
    symbol: "AMD",
    title: "Watchlist momentum improving",
  }],
  whatChanged: [{
    changeType: "macro_shift",
    detail: "TSLA has weaker macro alignment than the previous workflow baseline.",
    metricLabel: "Macro -9",
    severity: "warning",
    symbol: "TSLA",
    title: "Macro alignment deteriorated",
  }],
};

const feedItem: IntelligenceFeedItem = {
  actionHref: "/symbol/TSLA",
  category: "watchlist_risk_escalation",
  dataTimestamp: "2026-05-19T09:00:00.000Z",
  evidenceLabel: "Latest scan",
  itemType: "risk_pressure_increased",
  monitorNext: "Watch whether fragility keeps rising.",
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
  concentrationScore: 58,
  correlationClusters: [{
    label: "Technology overlap",
    reason: "AMD and NVDA share technology and macro pressure exposure.",
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
  generatedAt: "2026-05-19T09:00:00.000Z",
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

test("ecosystem system connects brief, feed, watchlist, cross-symbol, and portfolio context", () => {
  const system = buildIntelligenceEcosystemSystem({
    feedItems: [feedItem],
    generatedAt: "2026-05-19T09:05:00.000Z",
    marketCondition: "RISK REVIEW",
    portfolioSystem,
    rows: [
      opportunity({ symbol: "AMD" }),
      opportunity({ final_score: 69, sector: "Technology", symbol: "NVDA" }),
      opportunity({ eventRisk: 82, final_score: 45, fragility: 84, macroAdjustment: -12, macroLabel: "Macro Headwind", sector: "Technology", symbol: "TSLA" }),
    ],
    scanUpdatedAt: "2026-05-19T09:00:00.000Z",
    watchlistSymbols: ["AMD", "TSLA"],
    workflowEvolution: workflow,
  });

  assert.match(system.headline, /Risk|ecosystem|monitoring|opportunity|memory/i);
  assert.ok(system.morningBrief.some((item) => /AMD|TSLA|Daily/.test(`${item.title} ${item.detail}`)));
  assert.ok(system.feedEvolution.some((item) => item.title === "Tracked risk escalated"));
  assert.ok(system.sinceLastVisit.some((item) => /TSLA|AMD/.test(item.title)));
  assert.ok(system.crossSymbolCognition.some((item) => item.symbols.includes("TSLA") || item.symbols.includes("AMD")));
  assert.ok(system.portfolioAwareness.some((item) => /Concentrated|Exposure|Correlation/i.test(item.title)));
  assert.ok(system.notificationIntelligence.some((item) => item.title === "Tracked risk escalated"));
  assert.match(system.guardrail, /research context only/i);
});

test("ecosystem system degrades honestly when personal and historical context is missing", () => {
  const system = buildIntelligenceEcosystemSystem({
    generatedAt: "2026-05-19T09:05:00.000Z",
    rows: [],
  });

  assert.ok(system.morningBrief.some((item) => /0 research candidates/i.test(item.detail)));
  assert.ok(system.feedEvolution.some((item) => /still building/i.test(item.detail)));
  assert.ok(system.sinceLastVisit.some((item) => /baseline/i.test(item.detail)));
  assert.ok(system.portfolioAwareness.some((item) => /unavailable/i.test(item.title)));
  assert.ok(system.crossSymbolCognition.some((item) => /limited/i.test(item.title)));
});
