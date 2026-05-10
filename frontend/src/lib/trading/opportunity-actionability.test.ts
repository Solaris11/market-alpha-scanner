import assert from "node:assert/strict";
import test from "node:test";
import { buildOpportunityActionability } from "./opportunity-actionability";
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
    narrative: null,
    price: 105,
    raw: {
      symbol,
      action: "WATCH",
      entry_distance_pct: 2.2,
      final_decision: "AVOID",
      final_score: 74,
      macro_alignment_score: 68,
      price: 105,
      relative_volume: 1.25,
      return_1d: 3.1,
      risk_reward: 2.4,
      setup_strength: 76,
      setup_type: "CONTINUATION",
      stop_loss: 96,
      take_profit_high: 126,
      technical_score: 78,
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
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("actionability explains late setups with pullback and invalidation context", () => {
  const actionability = buildOpportunityActionability(row({
    entryStatus: "extended",
    raw: {
      ...row().raw,
      entry_distance_pct: 10,
      return_1d: 11,
      rsi: 76,
      setup_type: "BREAKOUT",
    },
  }));

  assert.match(actionability.actionContext, /late|stretched|pullback/i);
  assert.match(actionability.whatToWaitFor, /pullback|research|entry/i);
  assert.match(actionability.invalidationExplanation, /\$96/);
  assert.match(actionability.chaseRiskVisibility.value, /Avoid chase|Risk rising|Contained/);
});

test("actionability exposes timing, confirmation, pullback, and chase visibility fields", () => {
  const actionability = buildOpportunityActionability(row({
    final_decision: "WAIT_PULLBACK",
    raw: {
      ...row().raw,
      entry_distance_pct: 1.4,
      final_decision: "WAIT_PULLBACK",
      relative_volume: 0.9,
      setup_type: "PULLBACK",
    },
  }));

  assert.ok(actionability.actionContext.length > 20);
  assert.ok(actionability.timingQuality.score !== null);
  assert.ok(actionability.pullbackQuality.score !== null);
  assert.ok(actionability.confirmationStatus.value.length > 0);
  assert.ok(actionability.chaseRiskVisibility.value.length > 0);
  assert.match(actionability.entryZoneClarity, /Research|Preferred/i);
});

test("actionability stays research-oriented and avoids direct financial advice", () => {
  const actionability = buildOpportunityActionability(row());
  const text = JSON.stringify(actionability).toLowerCase();

  assert.doesNotMatch(text, /buy now|sell now|guaranteed|sure profit/);
  assert.match(actionability.historicalExitGuidance, /research context/);
});

test("representative validation symbols receive complete actionability packets", () => {
  const symbols = ["AMD", "MU", "DDOG", "NVDA", "AVGO", "TSM", "OXY", "SPY", "QQQ"];

  for (const symbol of symbols) {
    const actionability = buildOpportunityActionability(row({ symbol }));
    assert.equal(typeof actionability.actionContext, "string");
    assert.equal(typeof actionability.whatToWaitFor, "string");
    assert.equal(typeof actionability.invalidationExplanation, "string");
    assert.ok(actionability.actionContext.length > 20);
    assert.ok(actionability.whatToWaitFor.length > 20);
    assert.ok(actionability.invalidationExplanation.length > 20);
  }
});
