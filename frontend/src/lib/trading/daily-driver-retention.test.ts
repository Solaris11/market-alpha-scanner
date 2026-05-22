import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { freshnessFromTimestamp } from "@/lib/data-health";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { normalizeWorkspacePreferences } from "@/lib/trading/workspace-preferences";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { buildDailyDriverRetentionModel } from "./daily-driver-retention";

describe("daily driver retention model", () => {
  test("prioritizes first watchlist creation when no tracked symbols exist", () => {
    const model = buildDailyDriverRetentionModel({
      marketCondition: "Risk-On Transition",
      rows: [opportunityRow({ finalScore: 72, symbol: "AMD" })],
      watchlistSymbols: [],
      workflowEvolution: null,
      workspacePreferences: null,
    });

    assert.equal(model.primaryActions[0]?.key, "create_watchlist");
    assert.equal(model.funnel.find((stage) => stage.key === "watchlist_anchor")?.value, 0);
    assert.ok(model.blockers.some((blocker) => blocker.includes("No watchlist anchor")));
    assert.match(model.proofBoundary, /does not claim retention victory/i);
  });

  test("connects returning watchlist users to scanner, replay, alerts, and strategy loops", () => {
    const model = buildDailyDriverRetentionModel({
      marketCondition: "Risk Mixed",
      rows: [
        opportunityRow({ conviction: 76, finalScore: 71, fragility: 38, sector: "Semiconductors", symbol: "AMD" }),
        opportunityRow({ conviction: 58, eventRisk: 72, finalScore: 49, fragility: 82, sector: "Semiconductors", symbol: "MU" }),
      ],
      watchlistSymbols: ["AMD", "MU"],
      workflowEvolution: returningWorkflow(),
      workspacePreferences: normalizeWorkspacePreferences({
        favoriteModules: ["best_setups", "replay", "alerts"],
        preferredTimeframes: ["1D", "1M"],
        updatedAt: "2026-05-21T15:00:00.000Z",
        workspaceMode: "swing_trader",
      }),
    });

    assert.ok(model.activationScore >= 60);
    assert.ok(model.primaryActions.some((action) => action.key === "review_watchlist"));
    assert.ok(model.primaryActions.some((action) => action.key === "save_scanner"));
    assert.ok(model.habitLoops.some((loop) => loop.key === "alert_return"));
    assert.equal(model.personalization.find((item) => item.label === "Focus cluster")?.value, "Semiconductors");
    assert.equal(model.continuity.find((item) => item.label === "Workspace restore")?.value, "Saved");
  });
});

function opportunityRow(overrides: {
  conviction?: number;
  eventRisk?: number;
  finalScore?: number;
  fragility?: number;
  macroAdjustment?: number;
  sector?: string;
  symbol: string;
}): OpportunityViewModel {
  const symbol = overrides.symbol;
  return {
    assetType: "equity",
    company_name: `${symbol} Corp`,
    confidenceLabel: "High",
    conviction: overrides.conviction ?? 68,
    dataFreshness: freshnessFromTimestamp("2026-05-21T15:00:00.000Z", Date.parse("2026-05-21T15:03:00.000Z")),
    decayLabel: "Stable",
    decision_reason: "Validated research context.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$105",
    eventLabel: "Event pressure developing",
    eventRisk: overrides.eventRisk ?? 34,
    evidence: {
      analogQualityScore: 70,
      calibrationDrift: 24,
      confidenceConfidence: 74,
      confidenceReliability: 72,
      evidenceConsistency: 70,
      evidenceSampleSize: 150,
      historicalDepthDays: 120,
      label: "Mature Evidence",
      limitations: [],
      outcomeCoverage: 68,
      reasons: ["Sample is mature enough for contextual evidence."],
      score: 76,
      setupReliabilityHistory: 72,
      tier: "mature",
    },
    final_decision: "WATCH",
    final_score: overrides.finalScore ?? 64,
    fragility: overrides.fragility ?? 42,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: overrides.macroAdjustment ?? 5,
    macroLabel: "Macro Supportive",
    narrative: null,
    price: 100,
    raw: { symbol },
    recommendationQuality: "developing",
    recommendationQualityLabel: "Developing",
    sector: overrides.sector ?? "Technology",
    shockPattern: null,
    stop_loss: 94,
    structuralLabel: "Constructive but confirm risk",
    suggested_entry: 101,
    symbol,
    target: 112,
  };
}

function returningWorkflow(): WorkflowEvolutionSummary {
  return {
    dailyBrief: ["2 watchlist symbols changed enough to revisit."],
    deterioratingSetups: [{
      changeType: "fragility_rising",
      detail: "MU became more fragile.",
      metricLabel: "Fragility +9.0",
      severity: "warning",
      symbol: "MU",
      title: "Fragility increased",
    }],
    improvingSetups: [{
      changeType: "improving",
      detail: "AMD setup quality improved.",
      metricLabel: "Score +5.0",
      severity: "positive",
      symbol: "AMD",
      title: "Setup quality improving",
    }],
    lastSeenAt: "2026-05-20T15:00:00.000Z",
    opportunityMaturity: [{
      detail: "Near research trigger context.",
      maturityState: "Trigger Approaching",
      symbol: "AMD",
    }],
    snapshotRows: [],
    triggerMonitors: [{
      condition: "Research trigger proximity",
      distanceLabel: "1.2% from research zone",
      priority: "high",
      reason: "AMD is close to its current research entry context.",
      symbol: "AMD",
    }],
    watchlistEvolution: [{
      changeType: "watchlist_momentum",
      detail: "AMD is on your watchlist and became more relevant.",
      metricLabel: "Watch +5.0",
      severity: "positive",
      symbol: "AMD",
      title: "Watchlist momentum improving",
    }],
    whatChanged: [{
      changeType: "improving",
      detail: "AMD setup quality improved versus the last recorded workflow snapshot.",
      metricLabel: "Score +5.0",
      severity: "positive",
      symbol: "AMD",
      title: "Setup quality improving",
    }],
  };
}
