import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildDecisionReplayReport, buildReplayOutcome } from "./decision-replay";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 76,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Structure is constructive but still probabilistic.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 34,
    final_decision: "WATCH",
    final_score: 80,
    fragility: 42,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      breadth_score: 72,
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 80,
      fragility_score: 42,
      liquidity_pressure: 34,
      macro_alignment_score: 72,
      price: 105,
      risk_on_score: 70,
      sector: "Semiconductors",
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 38,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
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

test("replay outcomes classify follow-through without predictive language", () => {
  const outcome = buildReplayOutcome("5d", 6.2);

  assert.equal(outcome.horizon, "5D");
  assert.equal(outcome.returnPct, 6.2);
  assert.match(outcome.interpretation, /strong positive follow-through/i);
  assert.doesNotMatch(JSON.stringify(outcome), /buy now|sell now|guaranteed|sure profit/i);
});

test("decision replay preserves before state and after outcome evidence", () => {
  const outcomesBySymbol = new Map([
    ["AMD", [buildReplayOutcome("1D", 1.4), buildReplayOutcome("5D", 5.8)]],
  ]);
  const report = buildDecisionReplayReport({
    asOf: "2026-05-08T20:00:00.000Z",
    matchedScanRunId: "scan-1",
    outcomesBySymbol,
    requestedTimestamp: "2026-05-08T19:00:00.000Z",
    rows: [
      row({ symbol: "AMD" }),
      row({
        final_score: 63,
        fragility: 78,
        macroLabel: "Macro Mixed",
        raw: {
          final_score: 63,
          fragility_score: 78,
          liquidity_pressure: 72,
          macro_alignment_score: 48,
          symbol: "MU",
          volatility_pressure: 80,
        },
        symbol: "MU",
      }),
    ],
    symbol: "AMD",
  });

  assert.equal(report.before.selected?.symbol, "AMD");
  assert.equal(report.after.outcomes.length, 2);
  assert.ok(report.before.topOpportunities.length > 0);
  assert.ok(report.decisionQualityReview.some((item) => item.includes("Conviction") || item.includes("5D")));
  assert.match(report.limitations.join(" "), /Not financial advice/i);
  assert.doesNotMatch(JSON.stringify(report), /buy now|sell now|guaranteed|sure profit/i);
});

test("decision replay reviews defensive decisions against later downside", () => {
  const report = buildDecisionReplayReport({
    asOf: "2026-05-08T20:00:00.000Z",
    matchedScanRunId: "scan-2",
    outcomesBySymbol: new Map([["DDOG", [buildReplayOutcome("5D", -4.4)]]]),
    rows: [
      row({
        conviction: 34,
        final_decision: "AVOID",
        final_score: 42,
        fragility: 82,
        raw: {
          final_decision: "AVOID",
          final_score: 42,
          fragility_score: 82,
          setup_type: "EXTENDED_MOMENTUM",
          symbol: "DDOG",
          volatility_pressure: 84,
        },
        symbol: "DDOG",
      }),
    ],
    symbol: "DDOG",
  });

  assert.ok(report.decisionQualityReview.some((item) => item.includes("aligned with later downside evidence")));
  assert.ok(report.decisionQualityReview.some((item) => item.includes("Fragility was elevated")));
  assert.doesNotMatch(JSON.stringify(report), /buy now|sell now|guaranteed|sure profit/i);
});
