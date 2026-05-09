import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { applyValidatedLlmNarrative, buildNarrativeInputPacket, buildNarrativeIntelligence, NARRATIVE_FORBIDDEN_LANGUAGE } from "./narrative-intelligence";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    conviction: 76,
    confidenceLabel: "High",
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Core mode is waiting for confirmation because chase risk remains elevated.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Elevated",
    eventRisk: 70,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 66,
    fragilityLabel: "Elevated fragility",
    macroAdjustment: -2,
    macroLabel: "Macro Mixed",
    narrative: null,
    price: 105,
    raw: {
      symbol,
      event_context_available: true,
      event_context_label: "Event Risk Elevated",
      event_context_reason_codes: ["EVENT_SHOCK_PRESSURE", "EVENT_AI_SEMICONDUCTOR_THEME"],
      event_context_summary: "Verified event context shows elevated volatility pressure.",
      event_risk_score: 70,
      final_decision: "WATCH",
      final_score: 78,
      fragility_score: 66,
      liquidity_pressure: 62,
      macro_pressure_score: 64,
      price: 105,
      score_change: 3,
      sector: "Semiconductors",
      sector_alignment_score: 72,
      setup_type: "CONTINUATION",
      volatility_pressure: 69,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Strong but fragile",
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

test("narrative engine creates balanced grounded reasoning", () => {
  const narrative = buildNarrativeIntelligence({ row: row() });

  assert.match(narrative.narrativeSummary, /AMD/);
  assert.match(narrative.bullishNarrative, /Conviction/);
  assert.match(narrative.bearishNarrative, /Fragility|fragility/);
  assert.match(narrative.moderatorSummary, /balanced view|stronger evidence/i);
  assert.equal(narrative.unsupportedClaimsDetected, false);
  assert.ok(narrative.whatToWatch.length >= 3);
  assert.doesNotMatch(Object.values(narrative).join(" "), NARRATIVE_FORBIDDEN_LANGUAGE);
});

test("narrative packet exposes fresh deterministic evidence for llm layer", () => {
  const inputRow = row();
  const narrative = buildNarrativeIntelligence({ row: inputRow });
  const packet = buildNarrativeInputPacket({ row: inputRow }, narrative);

  assert.equal(packet.symbol, "AMD");
  assert.equal(packet.decision.finalDecision, "Watch");
  assert.equal(packet.event.available, true);
  assert.ok(packet.event.reasonLabels.some((label) => label.toLowerCase().includes("shock")));
  assert.equal(packet.dataFreshness.status, "fresh");
});

test("llm narrative validator rejects unsupported or advisory output", () => {
  const base = buildNarrativeIntelligence({ row: row() });
  const invalid = applyValidatedLlmNarrative(base, {
    ...base,
    unsupportedClaimsDetected: false,
    narrativeSummary: "Buy now because this will definitely work.",
  });

  assert.equal(invalid, null);
});
