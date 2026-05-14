import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildAICognitionLayer } from "./ai-cognition-layer";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 74,
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
    entryZoneLabel: "$100-$103",
    eventLabel: "Event Risk Contained",
    eventRisk: 24,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 38,
    fragilityLabel: "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      breadth_score: 74,
      final_score: 78,
      macro_alignment_score: 76,
      momentum_score: 78,
      risk_reward: 1.8,
      symbol,
      volatility_pressure: 32,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Technology",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable structure",
    suggested_entry: 101,
    symbol,
    target: 126,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("AI cognition layer creates grounded baseline timeline without prior workflow", () => {
  const model = buildAICognitionLayer({
    generatedAt: "2026-05-08T20:00:00.000Z",
    marketCondition: "OVERHEATED",
    rows: [row()],
    scanUpdatedAt: "2026-05-08T20:00:00.000Z",
    workflowEvolution: null,
  });

  assert.equal(model.posture, "baseline");
  assert.ok(model.timeline.some((item) => /baseline/i.test(item.deltaLabel)));
  assert.ok(model.groundingPacket.some((item) => /scanner opportunity rows/i.test(item)));
  assert.doesNotMatch(JSON.stringify(model), /buy now|sell now|guaranteed|sure profit/i);
});

test("AI cognition layer surfaces stale confidence and contradictions from real row fields", () => {
  const model = buildAICognitionLayer({
    generatedAt: "2026-05-08T20:00:00.000Z",
    marketCondition: "TRANSITION",
    rows: [
      row({
        dataFreshness: {
          ageMinutes: 42,
          humanAge: "Updated 42 min ago",
          label: "Stale",
          lastUpdated: "2026-05-08T19:18:00.000Z",
          message: "Stale - updated 42 min ago",
          status: "stale",
        },
        evidence: {
          analogQualityScore: 10,
          calibrationDrift: 20,
          confidenceConfidence: 25,
          confidenceReliability: 18,
          evidenceConsistency: 18,
          evidenceSampleSize: 4,
          historicalDepthDays: 3,
          label: "Limited Evidence",
          limitations: ["sample size is not yet mature enough"],
          outcomeCoverage: 0,
          reasons: ["4 comparable observations"],
          score: 12,
          setupReliabilityHistory: 20,
          tier: "limited",
        },
        final_score: 76,
        raw: {
          breadth_score: 32,
          final_score: 76,
          macro_alignment_score: 38,
          momentum_score: 82,
          risk_reward: 0.8,
          symbol: "AMD",
          volatility_pressure: 74,
        },
      }),
    ],
    scanUpdatedAt: "2026-05-08T20:00:00.000Z",
    workflowEvolution: null,
  });

  assert.ok(model.confidenceDecay.some((item) => item.status === "stale"));
  assert.ok(model.contradictions.some((item) => item.title === "High score, low evidence"));
  assert.ok(model.contradictions.some((item) => item.title === "Momentum conflicts with breadth"));
  assert.match(model.overview, /contradiction checks/);
});
