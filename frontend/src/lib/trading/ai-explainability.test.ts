import assert from "node:assert/strict";
import test from "node:test";
import type { RankingRow } from "@/lib/types";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildAIExplainabilityFromOpportunity, buildAIExplainabilityFromSignal } from "./ai-explainability";

function rankingRow(overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    breadth_score: 72,
    company_name: "Advanced Micro Devices, Inc.",
    evidence_maturity: "mature",
    evidence_sample_size: 44,
    final_decision: "WATCH",
    final_score: 72,
    last_updated: "2026-05-08T20:00:00.000Z",
    macro_alignment_score: 68,
    momentum_score: 74,
    price: 101,
    risk_reward: 1.8,
    symbol: "AMD",
    volatility_pressure: 32,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const raw = rankingRow(overrides.raw ?? {});
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: "Advanced Micro Devices, Inc.",
    confidenceLabel: "High",
    conviction: 72,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Research context remains constructive.",
    entryStatus: "watch",
    entryZoneLabel: "$98-$101",
    eventLabel: "Event Risk Contained",
    eventRisk: 24,
    final_decision: "WATCH",
    final_score: 72,
    fragility: 38,
    fragilityLabel: "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 101,
    raw,
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Technology",
    shockPattern: null,
    stop_loss: 94,
    structuralLabel: "Stable structure",
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

test("AI explainability explains high score with limited evidence as a contradiction", () => {
  const model = buildAIExplainabilityFromOpportunity(opportunity({
    evidence: {
      analogQualityScore: 8,
      calibrationDrift: 22,
      confidenceConfidence: 18,
      confidenceReliability: 15,
      evidenceConsistency: 12,
      evidenceSampleSize: 3,
      historicalDepthDays: 2,
      label: "Limited Evidence",
      limitations: ["sample size is not mature"],
      outcomeCoverage: 0,
      reasons: ["3 comparable observations"],
      score: 14,
      setupReliabilityHistory: 18,
      tier: "limited",
    },
    final_score: 76,
    raw: rankingRow({
      breadth_score: 32,
      evidence_maturity: "limited",
      evidence_sample_size: 3,
      final_score: 76,
      macro_alignment_score: 38,
      momentum_score: 82,
      volatility_pressure: 74,
    }),
  }));

  assert.ok(model.contradictions.some((item) => item.title === "High score, limited evidence"));
  assert.ok(model.contradictions.some((item) => item.title === "Momentum vs weak breadth"));
  assert.match(model.beginnerSummary, /not a prediction/i);
});

test("AI explainability weakens confidence when data is stale", () => {
  const model = buildAIExplainabilityFromSignal(rankingRow({
    confidence_score: 78,
    last_updated: "2026-05-08T18:00:00.000Z",
    stale_data: true,
  }));

  assert.ok(model.trustBadges.some((item) => item.label === "Needs refresh"));
  assert.equal(model.confidence.tone, "risk");
  assert.match(model.confidence.whyChanged, /fresh scan/i);
});

test("AI explainability stays non-advisory", () => {
  const model = buildAIExplainabilityFromSignal(rankingRow({
    decision_reason: "Strong context, but still research only.",
    final_score: 82,
  }));
  assert.doesNotMatch(JSON.stringify(model), /buy now|sell now|guaranteed|sure profit|must buy|must sell/i);
});
