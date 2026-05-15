import assert from "node:assert/strict";
import test from "node:test";
import type { RankingRow } from "@/lib/types";
import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildAIExplainabilityFromOpportunity } from "./ai-explainability";
import { buildExplainabilityTrustModel, buildFeedItemTrustModel, buildOpportunityTrustModel } from "./institutional-trust";

function rankingRow(overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    breadth_score: 34,
    company_name: "Advanced Micro Devices, Inc.",
    evidence_maturity: "limited",
    evidence_sample_size: 4,
    event_risk_score: 74,
    final_decision: "WATCH",
    final_score: 76,
    last_updated: "2026-05-08T20:00:00.000Z",
    macro_alignment_score: 42,
    momentum_score: 82,
    price: 101,
    symbol: "AMD",
    volatility_pressure: 72,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const raw = rankingRow(overrides.raw ?? {});
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: "Advanced Micro Devices, Inc.",
    confidenceLabel: "Medium",
    conviction: 54,
    dataFreshness: {
      ageMinutes: 45,
      humanAge: "Updated 45 min ago",
      label: "Stale",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Stale - updated 45 min ago",
      status: "stale",
    },
    decayLabel: "Needs refresh",
    decision_reason: "Research context is interesting but risk pressure is elevated.",
    entryStatus: "watch",
    entryZoneLabel: "$98-$101",
    eventLabel: "Event Risk Elevated",
    eventRisk: 74,
    evidence: {
      analogQualityScore: 12,
      calibrationDrift: 30,
      confidenceConfidence: 20,
      confidenceReliability: 18,
      evidenceConsistency: 14,
      evidenceSampleSize: 4,
      historicalDepthDays: 2,
      label: "Limited Evidence",
      limitations: ["Only 4 comparable observations are available."],
      outcomeCoverage: 8,
      reasons: ["4 comparable observations"],
      score: 18,
      setupReliabilityHistory: 18,
      tier: "limited",
    },
    final_decision: "WATCH",
    final_score: 76,
    fragility: 78,
    fragilityLabel: "Elevated",
    macroAdjustment: -4,
    macroLabel: "Macro Mixed",
    narrative: null,
    price: 101,
    raw,
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Technology",
    shockPattern: null,
    stop_loss: 94,
    structuralLabel: "Fragile structure",
    suggested_entry: 99,
    symbol: "AMD",
    target: 118,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function feedItem(overrides: Partial<IntelligenceFeedItem> = {}): IntelligenceFeedItem {
  return {
    actionHref: "/symbol/AMD",
    category: "watchlist_risk_escalation",
    createdAt: "2026-05-08T20:10:00.000Z",
    dataTimestamp: "2026-05-08T20:05:00.000Z",
    evidenceLabel: "Limited Evidence",
    itemType: "risk_pressure_increased",
    monitorNext: "Watch whether risk pressure confirms on the next scanner packet.",
    notificationEligible: false,
    relatedSymbol: "AMD",
    severity: "warning",
    sourceKey: "watchlist:amd:risk",
    summary: "Risk pressure increased for AMD.",
    title: "AMD risk pressure increased",
    whyItMatters: "Watchlist risk changes can weaken a setup even when the score remains high.",
    ...overrides,
  };
}

test("opportunity trust model exposes limitations and provenance without fake certainty", () => {
  const model = buildOpportunityTrustModel(opportunity(), { shownBecause: "Shown by scanner filter.", watchlisted: true });

  assert.ok(model.provenance.some((item) => item.label === "Freshness" && item.value === "Stale"));
  assert.ok(model.limitations.some((item) => /limited/i.test(item)));
  assert.ok(model.personalization.some((item) => /watchlist/i.test(item)));
  assert.ok(model.workflow.some((item) => item.label === "Open symbol" && item.href === "/symbol/AMD"));
  assert.doesNotMatch(JSON.stringify(model), /guaranteed|buy now|sell now|must buy|must sell/i);
});

test("feed item trust model explains why the item appeared and why it is feed-only", () => {
  const model = buildFeedItemTrustModel(feedItem(), { watchlistSymbols: ["AMD"] });

  assert.ok(model.personalization.some((item) => /watchlist/i.test(item)));
  assert.ok(model.provenance.some((item) => item.label === "Delivery" && item.value === "Feed only"));
  assert.ok(model.traceability.some((item) => /what changed/i.test(item)));
});

test("explainability trust model keeps score and confidence traceable", () => {
  const explainability = buildAIExplainabilityFromOpportunity(opportunity());
  const model = buildExplainabilityTrustModel(explainability, { symbol: "AMD" });

  assert.match(model.headline, /AMD/);
  assert.ok(model.provenance.some((item) => item.label === "Confidence"));
  assert.ok(model.traceability.some((item) => /does not predict/i.test(item)));
});
