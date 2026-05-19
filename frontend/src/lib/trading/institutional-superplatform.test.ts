import assert from "node:assert/strict";
import test from "node:test";
import { buildInstitutionalSuperplatformSystem } from "./institutional-superplatform";
import type { IntelligenceEcosystemSystem } from "./intelligence-ecosystem";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { WorkspacePreferences } from "./workspace-preferences";
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
    fragility: 42,
    fragilityLabel: "Moderate",
    macroAdjustment: 5,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      breadth_score: 62,
      final_decision: "WATCH",
      final_score: 72,
      large_move_history_score: 58,
      liquidity_score: 61,
      macro_alignment_score: 68,
      price: 105,
      replay_similarity_score: 61,
      setup_type: "CONTINUATION",
      symbol,
      volatility_score: 44,
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
  watchlistEvolution: [],
  whatChanged: [{
    changeType: "macro_shift",
    detail: "Macro pressure increased.",
    metricLabel: "Macro -9",
    severity: "warning",
    symbol: "TSLA",
    title: "Macro alignment deteriorated",
  }],
};

const preferences: WorkspacePreferences = {
  favoriteActions: ["open_terminal", "review_opportunities"],
  favoriteModules: ["macro", "watchlist", "alerts"],
  favoriteSymbols: ["AMD", "NVDA"],
  hiddenModules: [],
  macroFirstMode: true,
  mobileLastViewedSymbol: "AMD",
  mobilePreferredOverview: "macro",
  moduleOrder: ["macro", "watchlist", "alerts", "what_matters_now", "best_setups", "dangerous", "shock_watch", "replay", "copilot"],
  pinnedMobileCards: ["macro", "watchlist"],
  preferredRiskStyle: "conservative",
  preferredTimeframes: ["1W", "1M"],
  updatedAt: "2026-05-19T09:00:00.000Z",
  watchlistFirstMode: false,
  workspaceMode: "macro_first",
};

const ecosystem: IntelligenceEcosystemSystem = {
  activeMonitors: [],
  attentionScore: 67,
  crossSymbolCognition: [],
  ecosystemLabel: "Risk review",
  ecosystemTone: "amber",
  feedEvolution: [],
  generatedAt: "2026-05-19T09:05:00.000Z",
  guardrail: "Research context only.",
  headline: "Risk is controlling attention.",
  marketWorld: [],
  morningBrief: [],
  notificationIntelligence: [],
  portfolioAwareness: [],
  sinceLastVisit: [],
  summary: "Market context is mixed.",
};

test("institutional superplatform builds persistent workspaces and market context", () => {
  const system = buildInstitutionalSuperplatformSystem({
    ecosystem,
    generatedAt: "2026-05-19T09:05:00.000Z",
    marketCondition: "RISK REVIEW",
    rows: [
      opportunity({ symbol: "AMD" }),
      opportunity({ final_score: 69, sector: "Technology", symbol: "NVDA" }),
      opportunity({ eventRisk: 82, final_score: 45, fragility: 84, macroAdjustment: -14, macroLabel: "Macro Headwind", sector: "Consumer Cyclical", symbol: "TSLA" }),
    ],
    scanUpdatedAt: "2026-05-19T09:00:00.000Z",
    watchlistSymbols: ["AMD", "TSLA"],
    workflowEvolution: workflow,
    workspacePreferences: preferences,
  });

  assert.equal(system.activeWorkspaceId, "macro");
  assert.ok(system.workspaces.some((workspace) => workspace.id === "macro"));
  assert.ok(system.workspaces.some((workspace) => workspace.id === "risk_monitoring" && workspace.symbols.includes("TSLA")));
  assert.ok(system.workspaces.some((workspace) => workspace.id === "watchlist_operations" && workspace.summary.includes("tracked symbols")));
  assert.ok(system.context.regimeScore !== null);
  assert.ok(system.context.values.some((value) => value !== null));
  assert.ok(system.intelligenceMapNodes.length >= 2);
  assert.ok(system.intelligenceMapLinks.some((link) => link.to === "risk_monitoring"));
  assert.ok(system.timeline.some((track) => track.points.length > 0));
  assert.ok(system.crossWorkspaceCognition.some((item) => item.workspaces.includes("risk_monitoring")));
  assert.match(system.guardrail, /does not create broker execution instructions/i);
});

test("institutional superplatform degrades honestly when data is limited", () => {
  const system = buildInstitutionalSuperplatformSystem({
    generatedAt: "2026-05-19T09:05:00.000Z",
    rows: [],
  });

  assert.equal(system.workspaces.length, 8);
  assert.ok(system.workspaces.some((workspace) => workspace.score === null));
  assert.ok(system.intelligenceMapNodes.some((node) => /Global Market Context/.test(node.title)));
  assert.ok(system.memoryPersistence.some((item) => /baseline/i.test(item.detail)));
  assert.ok(system.crossWorkspaceCognition.some((item) => /calm|available/i.test(item.title)));
  assert.match(system.summary, /limited evidence|workspace|platform|linking/i);
});
