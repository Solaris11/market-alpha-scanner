import assert from "node:assert/strict";
import test from "node:test";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "QQQ";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 72,
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Structure is constructive but still probabilistic.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 34,
    final_decision: "WATCH",
    final_score: 74,
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
      final_score: 74,
      fragility_score: 42,
      liquidity_pressure: 34,
      macro_alignment_score: 72,
      price: 105,
      return_1d: 1.1,
      return_5d: 3.2,
      risk_on_score: 70,
      score_change: 2,
      sector: "Technology",
      sector_alignment_score: 72,
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 38,
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

test("regime shift engine classifies a broad supportive tape as risk-on expansion", () => {
  const system = buildRegimeShiftSystem({
    generatedAt: "2026-05-08T20:00:00.000Z",
    rows: [
      row({ symbol: "SPY", sector: "Index", raw: { sector: "Index", symbol: "SPY" } }),
      row({ symbol: "QQQ", sector: "Index", raw: { sector: "Index", symbol: "QQQ" } }),
      row({ symbol: "NVDA", sector: "Semiconductors", raw: { sector: "Semiconductors", symbol: "NVDA" } }),
      row({ symbol: "TSM", sector: "Semiconductors", raw: { sector: "Semiconductors", symbol: "TSM" } }),
    ],
  });

  assert.equal(system.currentMarketState, "Risk-On Expansion");
  assert.ok(system.riskAppetiteScore >= 65);
  assert.ok(system.breadthHealthScore >= 60);
  assert.equal(system.alerts.some((alert) => alert.severity === "critical"), false);
});

test("regime shift engine flags volatility, liquidity, and breadth deterioration", () => {
  const system = buildRegimeShiftSystem({
    generatedAt: "2026-05-08T20:00:00.000Z",
    rows: [
      row({
        conviction: 38,
        final_decision: "AVOID",
        final_score: 35,
        fragility: 82,
        raw: {
          breadth_score: 28,
          exchange_health_score: 34,
          final_decision: "AVOID",
          final_score: 35,
          liquidity_pressure: 78,
          macro_alignment_score: 32,
          return_1d: -3.8,
          risk_on_score: 26,
          score_change: -4,
          sector_alignment_score: 30,
          symbol: "QQQ",
          volatility_pressure: 84,
        },
        symbol: "QQQ",
      }),
      row({
        conviction: 40,
        final_decision: "AVOID",
        final_score: 38,
        fragility: 80,
        raw: {
          breadth_score: 32,
          exchange_health_score: 36,
          final_decision: "AVOID",
          final_score: 38,
          liquidity_pressure: 76,
          macro_alignment_score: 34,
          return_1d: -2.9,
          risk_on_score: 30,
          score_change: -3,
          sector_alignment_score: 35,
          symbol: "AMD",
          volatility_pressure: 82,
        },
        symbol: "AMD",
      }),
    ],
  });

  assert.equal(system.currentMarketState, "Volatility Expansion");
  assert.ok(system.transitionRiskScore >= 70);
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("VOLATILITY_EXPANSION")));
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("LIQUIDITY_TIGHTENING")));
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("BREADTH_DETERIORATION")));
});

test("regime shift engine detects defensive rotation without claiming hidden flows", () => {
  const system = buildRegimeShiftSystem({
    rows: [
      row({ final_score: 76, sector: "Healthcare", symbol: "LLY", raw: { final_score: 76, sector: "Healthcare", sector_alignment_score: 76, symbol: "LLY" } }),
      row({ final_score: 72, sector: "Utilities", symbol: "XLU", raw: { final_score: 72, sector: "Utilities", sector_alignment_score: 72, symbol: "XLU" } }),
      row({ final_score: 40, sector: "Consumer Discretionary", symbol: "TSLA", raw: { final_score: 40, sector: "Consumer Discretionary", sector_alignment_score: 40, symbol: "TSLA" } }),
    ],
  });

  assert.equal(system.currentMarketState, "Defensive Rotation");
  assert.ok(system.sectorLeadership.rotationScore >= 60);
  assert.doesNotMatch(`${system.terminalSummary} ${system.stateExplanation}`, /fund flows|guaranteed|buy now|sell now/i);
});

test("regime shift copy keeps LLM as explanation layer only", () => {
  const system = buildRegimeShiftSystem({ rows: [row({ symbol: "SPY" }), row({ symbol: "QQQ" })] });

  assert.match(system.llmBoundary, /may explain/i);
  assert.match(system.llmBoundary, /may not invent/i);
  assert.doesNotMatch([...system.whatToMonitor, system.terminalSummary, system.llmBoundary].join(" "), /financial advice|guaranteed|buy now|sell now/i);
});
