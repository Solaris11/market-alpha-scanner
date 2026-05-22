import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { freshnessFromTimestamp } from "@/lib/data-health";
import type { IntelligenceFeedItem } from "@/lib/trading/intelligence-feed";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { buildEcosystemContinuitySystem } from "@/lib/trading/ecosystem-continuity";
import { normalizeWorkspacePreferences } from "@/lib/trading/workspace-preferences";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";

describe("ecosystem continuity system", () => {
  test("connects workspace preferences, workflow memory, feed items, and recent symbols", () => {
    const model = buildEcosystemContinuitySystem({
      feedItems: [feedItem("AMD")],
      generatedAt: "2026-05-21T15:10:00.000Z",
      institutionalSuperplatform: null,
      marketCondition: "Risk Mixed",
      rows: [
        opportunityRow({ conviction: 78, evidenceScore: 82, finalScore: 74, fragility: 34, macroAdjustment: 8, symbol: "AMD" }),
        opportunityRow({ conviction: 62, evidenceScore: 66, finalScore: 58, fragility: 52, macroAdjustment: -4, symbol: "NVDA" }),
      ],
      watchlistSymbols: ["AMD", "NVDA"],
      workflowEvolution: returningWorkflow(),
      workspacePreferences: normalizeWorkspacePreferences({
        favoriteModules: ["macro", "best_setups", "replay"],
        favoriteSymbols: ["NVDA"],
        macroFirstMode: true,
        mobileLastViewedSymbol: "AMD",
        preferredRiskStyle: "balanced",
        updatedAt: "2026-05-21T15:00:00.000Z",
        workspaceMode: "macro_first",
      }),
    });

    assert.ok(model.continuityScore >= 65);
    assert.deepEqual(model.recentSymbols.slice(0, 2), ["AMD", "NVDA"]);
    assert.ok(model.continuationItems.some((item) => item.id === "last-symbol" && item.href === "/symbol/AMD"));
    assert.ok(model.crossSystemThreads.some((thread) => thread.links.some((link) => link.href === "/macro")));
    assert.ok(model.adaptivePriorities.some((priority) => priority.id === "macro-first"));
    assert.ok(model.restoreReadiness.some((item) => item.label === "Workflow memory" && item.status === "ready"));
    assert.match(model.guardrail, /does not claim broker execution continuity/i);
  });

  test("admits partial continuity when no persisted user memory exists", () => {
    const model = buildEcosystemContinuitySystem({
      rows: [opportunityRow({ symbol: "MU" })],
      watchlistSymbols: [],
      workflowEvolution: null,
      workspacePreferences: null,
    });

    assert.ok(model.continuityScore < 70);
    assert.ok(model.recentSymbols.includes("MU"));
    assert.ok(model.restoreReadiness.some((item) => item.label === "Device session" && item.status === "device"));
    assert.ok(model.limitations.some((limitation) => /workspace layout restore is partial/i.test(limitation)));
    assert.ok(model.sessionPersistence.some((item) => item.context === "Overlay and fullscreen state" && item.status === "limited"));
  });
});

function opportunityRow(overrides: {
  conviction?: number;
  evidenceScore?: number;
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
    conviction: overrides.conviction ?? 66,
    dataFreshness: freshnessFromTimestamp("2026-05-21T15:00:00.000Z", Date.parse("2026-05-21T15:02:00.000Z")),
    decayLabel: "Stable",
    decision_reason: "Validated research context.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$105",
    eventLabel: "Event pressure moderate",
    eventRisk: 38,
    evidence: {
      analogQualityScore: overrides.evidenceScore ?? 64,
      calibrationDrift: 22,
      confidenceConfidence: 70,
      confidenceReliability: 68,
      evidenceConsistency: 66,
      evidenceSampleSize: 120,
      historicalDepthDays: 90,
      label: "Mature Evidence",
      limitations: [],
      outcomeCoverage: 62,
      reasons: ["Evidence depth is usable for continuity testing."],
      score: overrides.evidenceScore ?? 64,
      setupReliabilityHistory: 67,
      tier: "mature",
    },
    final_decision: "WATCH",
    final_score: overrides.finalScore ?? 60,
    fragility: overrides.fragility ?? 46,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: overrides.macroAdjustment ?? 0,
    macroLabel: (overrides.macroAdjustment ?? 0) >= 0 ? "Macro Supportive" : "Macro Pressure",
    narrative: null,
    price: 100,
    raw: {
      macro_alignment_score: 50 + (overrides.macroAdjustment ?? 0),
      sector: overrides.sector ?? "Technology",
      symbol,
    },
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

function feedItem(symbol: string): IntelligenceFeedItem {
  return {
    actionHref: `/symbol/${symbol}`,
    category: "macro_regime_shift",
    createdAt: "2026-05-21T15:05:00.000Z",
    dataTimestamp: "2026-05-21T15:05:00.000Z",
    evidenceLabel: "Macro + replay",
    id: "feed-amd",
    itemType: "macro_pressure_changed",
    monitorNext: "Watch macro pressure and replay support.",
    notificationEligible: true,
    relatedSymbol: symbol,
    severity: "warning",
    sourceKey: "macro-amd",
    summary: `${symbol} macro pressure changed.`,
    title: "Macro pressure shifted",
    whyItMatters: "This can change symbol-level risk context.",
  };
}

function returningWorkflow(): WorkflowEvolutionSummary {
  return {
    dailyBrief: ["AMD changed enough to revisit."],
    deterioratingSetups: [],
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
      detail: "AMD is near research trigger context.",
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
    watchlistEvolution: [],
    whatChanged: [{
      changeType: "macro_shift",
      detail: "AMD macro alignment deteriorated versus the previous workflow baseline.",
      metricLabel: "Macro -8.0",
      severity: "warning",
      symbol: "AMD",
      title: "Macro alignment deteriorated",
    }],
  };
}
