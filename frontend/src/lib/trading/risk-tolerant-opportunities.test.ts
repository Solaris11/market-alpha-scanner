import assert from "node:assert/strict";
import test from "node:test";
import { buildRiskTolerantOpportunities, riskRewardProfile, type RiskRewardPreference } from "./risk-tolerant-opportunities";
import type { OpportunityViewModel } from "./opportunity-view-model";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    conviction: 72,
    confidenceLabel: "High",
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Core mode is waiting for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Context Mixed",
    eventRisk: 58,
    final_decision: "AVOID",
    final_score: 74,
    fragility: 55,
    fragilityLabel: "Moderate fragility",
    macroAdjustment: 1.2,
    macroLabel: "Macro Aligned",
    price: 105,
    raw: {
      symbol,
      final_score: 74,
      action: "WATCH",
      final_decision: "AVOID",
      price: 105,
      risk_reward: 2.4,
      setup_type: "CONTINUATION",
      technical_score: 78,
      setup_strength: 76,
      macro_alignment_score: 68,
      exchange_health_score: 66,
      sector_alignment_score: 72,
      event_shock_pressure_score: 70,
      return_1d: 3.1,
      entry_distance_pct: 2.2,
      stop_loss: 96,
      take_profit_high: 126,
      avg_max_gain: 0.08,
      avg_max_drawdown: -0.045,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable trend",
    suggested_entry: 101,
    symbol,
    target: 121,
  };
  return {
    ...base,
    ...overrides,
    confidenceLabel: overrides.confidenceLabel ?? base.confidenceLabel,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("risk tolerant mode still ranks avoided symbols instead of hiding all exposure", () => {
  const rows = [
    row({ symbol: "AMD" }),
    row({
      symbol: "LOWQ",
      conviction: 28,
      final_score: 42,
      fragility: 92,
      price: 12,
      raw: { ...row().raw, symbol: "LOWQ", final_score: 42, price: 12, return_1d: 18, risk_reward: 0.6, event_shock_pressure_score: 88, entry_distance_pct: 14 },
    }),
  ];

  const candidates = buildRiskTolerantOpportunities(rows, { riskLevel: "high", rewardLevel: "high" });

  assert.equal(candidates[0]?.symbol, "AMD");
  assert.equal(candidates[0]?.currentDecision, "Avoid");
  assert.ok(candidates[0]?.aggressiveOpportunityScore);
  assert.ok(candidates[0]?.keyRisks.some((item) => item.toLowerCase().includes("core") || item.toLowerCase().includes("chase") || item.toLowerCase().includes("downside")));
});

test("low risk high reward stays selective and does not fill the list with garbage", () => {
  const candidates = buildRiskTolerantOpportunities(
    [
      row({ symbol: "AMD", fragility: 72, raw: { ...row().raw, symbol: "AMD", entry_distance_pct: 8, return_1d: 9 } }),
      row({ symbol: "MU", fragility: 82, raw: { ...row().raw, symbol: "MU", event_shock_pressure_score: 82, entry_distance_pct: 11, return_1d: 12 } }),
    ],
    { riskLevel: "low", rewardLevel: "high" },
  );

  assert.equal(candidates.length, 0);
  const profile = riskRewardProfile({ riskLevel: "low", rewardLevel: "high" });
  assert.match(profile.warning, /No low-risk\/high-reward setup/);
});

test("risk reward profiles define an inefficient high risk low reward state", () => {
  const preference: RiskRewardPreference = { riskLevel: "high", rewardLevel: "low" };
  const profile = riskRewardProfile(preference);

  assert.equal(profile.inefficient, true);
  assert.match(profile.explanation, /Inefficient/);
});
