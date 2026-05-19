import assert from "node:assert/strict";
import test from "node:test";
import { buildIntelligenceConsciousnessSystem } from "./intelligence-consciousness";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
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
      lastUpdated: "2026-05-19T09:00:00.000Z",
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
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      analog_quality_score: 66,
      evidence_sample_size: 140,
      final_decision: "WATCH",
      final_score: 72,
      macro_alignment_score: 68,
      price: 105,
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

const profile: UserPersonalizationProfile = {
  asymmetryPreference: 55,
  behavior: {
    alertEngagement: 2,
    ignoredOpportunityCount: 0,
    lastUpdated: "2026-05-19T09:00:00.000Z",
    repeatedSymbolViews: 5,
    topSymbols: ["AMD", "NVDA"],
    watchlistCount: 3,
  },
  continuationPreference: 60,
  description: "Balanced risk/reward with selective momentum exposure.",
  drawdownTolerance: 55,
  eventPreference: 50,
  guardrails: ["Confirm evidence quality."],
  label: "Balanced",
  momentumPreference: 60,
  personality: "balanced",
  personalityConfidence: 70,
  preferredRewardLevel: "medium",
  preferredRiskLevel: "medium",
  pullbackPreference: 50,
  source: "hybrid",
  volatilityTolerance: 50,
};

const workflow: WorkflowEvolutionSummary = {
  dailyBrief: ["AMD quality improved."],
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
    detail: "AMD setup quality improved versus the prior workflow snapshot.",
    metricLabel: "Score +8",
    severity: "positive",
    symbol: "AMD",
    title: "Setup quality improving",
  }],
  lastSeenAt: "2026-05-18T09:00:00.000Z",
  opportunityMaturity: [],
  snapshotRows: [],
  triggerMonitors: [{
    condition: "Research trigger proximity",
    distanceLabel: "2.1% away",
    priority: "high",
    reason: "Entry distance is close enough to monitor.",
    symbol: "AMD",
  }],
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

test("consciousness system grounds narrative in rows, workflow, memory, and personalization", () => {
  const system = buildIntelligenceConsciousnessSystem({
    generatedAt: "2026-05-19T09:05:00.000Z",
    marketCondition: "RISK REVIEW",
    personalizationProfile: profile,
    rows: [
      opportunity({ symbol: "AMD", final_score: 78 }),
      opportunity({ eventRisk: 78, final_score: 48, fragility: 82, raw: { macro_alignment_score: 32, symbol: "TSLA" }, symbol: "TSLA" }),
    ],
    workflowEvolution: workflow,
  });

  assert.match(system.headline, /Risk|Opportunity|Memory|watching/i);
  assert.ok(system.stories.some((story) => story.symbol === "AMD" || story.symbol === "TSLA"));
  assert.ok(system.memorySignals.some((signal) => signal.symbol === "AMD"));
  assert.ok(system.adaptiveSignals.some((signal) => /AMD|NVDA|Balanced/i.test(signal.detail + signal.title)));
  assert.ok(system.narrativeTimeline.some((item) => item.symbol === "TSLA"));
  assert.ok(system.crossSystemLinks.length > 0);
  assert.match(system.guardrail, /does not predict/i);
});

test("consciousness system degrades honestly without history or rows", () => {
  const system = buildIntelligenceConsciousnessSystem({
    generatedAt: "2026-05-19T09:05:00.000Z",
    rows: [],
  });

  assert.equal(system.memorySignals.length, 0);
  assert.equal(system.crossSystemLinks.length, 0);
  assert.ok(system.narrativeTimeline.some((item) => /building/i.test(`${item.title} ${item.detail}`)));
  assert.ok(system.predictiveAttention.some((item) => /No proactive/i.test(item.title)));
});
