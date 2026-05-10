import assert from "node:assert/strict";
import test from "node:test";
import { buildCommunityIntelligence, type CommunityFollowAggregate } from "./community-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";

test("community intelligence aggregates opt-in activity without exposing user identity", () => {
  const system = buildCommunityIntelligence({
    follows: [
      { count: 4, interest: "monitoring", symbol: "AMD" },
      { count: 1, interest: "learning", symbol: "AMD" },
      { count: 2, interest: "cautious", symbol: "MU" },
    ],
    replayStudies: [
      {
        createdAt: "2026-05-09T12:00:00Z",
        id: "study-1",
        ownerLabel: "Community member",
        replayTimestamp: "2026-05-08T20:00:00Z",
        summary: "Reviewed pre-move evidence and chase risk.",
        symbol: "AMD",
        tags: ["shock"],
        title: "AMD shock replay",
      },
    ],
    rows: [row("AMD", 82, 44, "Semiconductors"), row("MU", 63, 74, "Semiconductors")],
    sharedWatchlists: [
      {
        createdAt: "2026-05-09T12:00:00Z",
        description: "AI hardware research basket.",
        id: "watch-1",
        name: "AI hardware",
        ownerLabel: "Community member",
        symbols: ["AMD", "MU"],
      },
    ],
  });

  assert.equal(system.metrics.find((metric) => metric.key === "opportunity_markers")?.value, "7");
  assert.equal(system.mostFollowedOpportunities[0]?.symbol, "AMD");
  assert.equal(system.mostFollowedOpportunities[0]?.followCount, 5);
  assert.equal(system.mostFollowedOpportunities[0]?.sentimentLabel, "Constructive monitoring");
  assert.equal(system.sharedWatchlists[0]?.ownerLabel, "Community member");
  assert.equal(JSON.stringify(system).includes("user_id"), false);
});

test("community caution remains risk-aware instead of becoming hype sentiment", () => {
  const follows: CommunityFollowAggregate[] = [
    { count: 1, interest: "monitoring", symbol: "MU" },
    { count: 4, interest: "cautious", symbol: "MU" },
  ];
  const system = buildCommunityIntelligence({
    follows,
    replayStudies: [],
    rows: [row("MU", 70, 82, "Semiconductors")],
    sharedWatchlists: [],
  });
  const trend = system.mostFollowedOpportunities.find((item) => item.symbol === "MU");

  assert.equal(trend?.sentimentLabel, "Cautious interest");
  assert.match(trend?.keyRisk ?? "", /caution|fragility|risk/i);
  assert.equal(JSON.stringify(system).toLowerCase().includes("buy now"), false);
  assert.equal(JSON.stringify(system).toLowerCase().includes("sell now"), false);
});

test("community themes are derived from scanner sectors and opt-in activity", () => {
  const system = buildCommunityIntelligence({
    follows: [
      { count: 3, interest: "monitoring", symbol: "AMD" },
      { count: 2, interest: "learning", symbol: "NVDA" },
      { count: 1, interest: "monitoring", symbol: "OXY" },
    ],
    replayStudies: [],
    rows: [row("AMD", 78, 45, "Semiconductors"), row("NVDA", 84, 48, "Semiconductors"), row("OXY", 58, 52, "Energy")],
    sharedWatchlists: [
      {
        createdAt: "2026-05-09T12:00:00Z",
        description: null,
        id: "watch-1",
        name: "Semis",
        ownerLabel: "Community member",
        symbols: ["AMD", "NVDA"],
      },
    ],
  });

  assert.equal(system.topThemes[0]?.theme, "Semiconductors");
  assert.ok((system.topThemes[0]?.symbolCount ?? 0) >= 2);
  assert.ok(system.trustBoundaries.some((line) => line.includes("anonymous aggregates")));
});

function row(symbol: string, finalScore: number, fragility: number, sector: string): OpportunityViewModel {
  return {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    conviction: Math.max(20, Math.min(90, finalScore - 5)),
    confidenceLabel: "Medium",
    dataFreshness: { ageMinutes: 5, label: "Fresh", status: "fresh" },
    decayLabel: "Stable",
    decision_reason: "Momentum is improving, but risk context still matters.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$105",
    eventLabel: "No verified event catalyst",
    eventRisk: 35,
    evidence: {
      analogQualityScore: 68,
      confidenceReliability: 72,
      evidenceMaturity: "Developing Evidence",
      evidenceSampleSize: 18,
      historicalDepthDays: 90,
      outcomeCoverage: 62,
    },
    final_decision: "WATCH",
    final_score: finalScore,
    fragility,
    fragilityLabel: fragility >= 70 ? "Elevated" : "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Supportive",
    narrative: null,
    price: 100,
    raw: {
      final_score: finalScore,
      last_updated_utc: "2026-05-09T12:00:00Z",
      price: 100,
      sector,
      symbol,
      volatility_pressure: fragility,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector,
    shockPattern: {
      asymmetryScore: 65,
      chaseRiskLabel: fragility >= 70 ? "Elevated" : "Low",
      chaseRiskScore: fragility,
      downsideRiskScore: fragility,
      opportunityScore: finalScore,
      opportunityState: "Elevated Upside Potential",
      reliabilityScore: 70,
      upsideShockScore: finalScore,
    },
    stop_loss: 94,
    structuralLabel: "Improving structure",
    suggested_entry: 102,
    symbol,
    target: 118,
  } as unknown as OpportunityViewModel;
}
