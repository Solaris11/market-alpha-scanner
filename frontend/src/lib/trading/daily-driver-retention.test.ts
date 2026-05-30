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
    assert.deepEqual(model.morningWorkflow.map((item) => item.key), [
      "overnight_summary",
      "overnight_events",
      "important_events_today",
      "watchlist_movement",
      "scanner_changes",
      "risk_changes",
      "portfolio_pressure",
      "macro_updates",
      "ai_digest",
    ]);
    assert.deepEqual(model.dailyBriefing.map((item) => item.key), [
      "what_changed",
      "matters",
      "deteriorated",
      "improved",
      "risk",
      "next_action",
    ]);
    assert.equal(model.funnel.find((stage) => stage.key === "watchlist_anchor")?.value, 0);
    assert.deepEqual(model.activationMilestones.map((item) => item.key), [
      "first_watchlist",
      "first_scanner",
      "first_compare",
      "first_alert",
      "first_replay",
      "first_symbol_investigation",
    ]);
    assert.ok(model.activationMilestones.some((item) => item.key === "first_watchlist" && item.status === "blocked"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "scanner_habit_loop"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "briefing_return"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "symbol_return"));
    assert.equal(model.dailySetupCard.tasks.length, 8);
    assert.deepEqual(model.dailySetupCard.tasks.map((item) => item.key), [
      "daily_briefing",
      "watchlist_review",
      "market_opportunities",
      "alert_follow_up",
      "symbol_follow_up",
      "performance_review",
      "replay_review",
      "market_memory_updates",
    ]);
    assert.ok(model.returnReasons.some((reason) => reason.key === "new_opportunities" && reason.status === "ready"));
    assert.ok(model.returnReasons.some((reason) => reason.key === "watchlist_movers" && reason.status === "blocked"));
    assert.ok(model.notificationContextRules.some((rule) => rule.key === "why_matters"));
    assert.ok(model.habitMetrics.some((metric) => metric.key === "daily_active_users"));
    assert.ok(model.habitMetrics.some((metric) => metric.key === "symbol_returns" && metric.eventName === "symbol_return"));
    assert.ok(model.dependenceLoops.some((loop) => loop.key === "first_open" && loop.status === "ready"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "chart_return" && loop.status === "blocked"));
    assert.ok(model.continuationWorkflows.some((item) => item.key === "scanner_state"));
    assert.ok(model.alertQualityEngine.some((item) => item.key === "fatigue_score"));
    assert.ok(model.notificationQuality.some((item) => item.key === "fatigue_suppression"));
    assert.ok(model.retentionTargets.some((target) => target.key === "d2_retention" && target.targetLabel === "> 10%"));
    assert.ok(model.retentionTargets.some((target) => target.key === "d7_retention" && target.targetLabel === "> 6%"));
    assert.ok(model.retentionTargets.some((target) => target.key === "active_day_depth" && target.targetLabel === "> 15%"));
    assert.ok(model.telemetry.some((item) => item.eventName === "activation_milestone"));
    assert.ok(model.telemetry.some((item) => item.eventName === "workflow_dropoff"));
    assert.ok(model.telemetry.some((item) => item.eventName === "morning_workflow_complete"));
    assert.equal(model.changeVisualization[0]?.type, "baseline");
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
    assert.ok(model.primaryActions.some((action) => action.key === "workflow_restore"));
    assert.ok(model.primaryActions.some((action) => action.key === "save_scanner"));
    assert.ok(model.habitLoops.some((loop) => loop.key === "alert_return"));
    assert.ok(model.habitLoops.some((loop) => loop.key === "notification_feedback"));
    assert.ok(model.activationMilestones.some((item) => item.key === "first_alert" && item.status === "ready"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "chart_return" && loop.status === "partial"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "briefing_return" && loop.status === "ready"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "symbol_return" && loop.status === "partial"));
    assert.ok(model.returnLoops.some((loop) => loop.eventName === "compare_return" && loop.status === "partial"));
    assert.equal(model.continuationWorkflows.find((item) => item.key === "chart_state")?.value, "AMD");
    assert.ok(model.notificationQuality.some((item) => item.key === "adaptive_relevance" && item.status === "partial"));
    assert.equal(model.morningWorkflow.find((item) => item.key === "watchlist_movement")?.href, "/symbol/AMD");
    assert.equal(model.morningWorkflow.find((item) => item.key === "scanner_changes")?.metricLabel, "2 rows");
    assert.equal(model.morningWorkflow.find((item) => item.key === "portfolio_pressure")?.href, "/paper");
    assert.match(model.morningWorkflow.find((item) => item.key === "macro_updates")?.metricLabel ?? "", /1 trigger/);
    assert.equal(model.morningWorkflow.find((item) => item.key === "overnight_events")?.metricLabel, "4 signals");
    assert.equal(model.morningWorkflow.find((item) => item.key === "ai_digest")?.href, "/symbol/AMD");
    assert.equal(model.dailySetupCard.status, "ready");
    assert.ok(model.dailySetupCard.label.includes("watchlist symbol moved"));
    assert.ok(model.returnReasons.some((reason) => reason.key === "watchlist_movers" && reason.label === "1 watchlist symbol moved"));
    assert.ok(model.returnReasons.some((reason) => reason.key === "triggered_alerts" && reason.label === "1 alert triggered"));
    assert.ok(model.returnReasons.some((reason) => reason.key === "new_opportunities" && reason.label === "1 new opportunity detected"));
    assert.ok(model.notificationContextRules.some((rule) => rule.key === "opened" && rule.status === "ready"));
    assert.ok(model.habitMetrics.some((metric) => metric.key === "briefing_returns" && metric.eventName === "briefing_return"));
    assert.ok(model.dailyBriefing.some((item) => item.key === "deteriorated" && item.href === "/symbol/MU"));
    assert.ok(model.dependenceLoops.some((loop) => loop.key === "repeat_watchlist_usage" && loop.status === "ready"));
    assert.ok(model.alertQualityEngine.some((item) => item.key === "workflow_linked_alerts" && item.status === "partial"));
    assert.ok(model.changeVisualization.some((item) => item.symbol === "AMD" && item.type === "watchlist"));
    assert.ok(model.adaptivePriorities.some((item) => item.key === "adaptive_scanner" && item.proofEvent.includes("scanner_return")));
    assert.ok(model.retentionTargets.some((target) => target.key === "notification_useful_ratio" && target.targetLabel === "> 55%"));
    assert.ok(model.telemetry.some((item) => item.eventName === "watchlist_return / scanner_return" && item.status === "ready"));
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
