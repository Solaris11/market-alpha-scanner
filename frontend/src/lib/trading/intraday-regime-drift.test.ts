import assert from "node:assert/strict";
import test from "node:test";
import type { IntradayDriftRow } from "@/lib/types";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildIntradayRegimeDriftSystem } from "./intraday-regime-drift";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "QQQ";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 70,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-09T16:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh",
    decision_reason: "Structure is constructive.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$102",
    eventLabel: "Event Risk Contained",
    eventRisk: 35,
    final_decision: "WATCH",
    final_score: 72,
    fragility: 42,
    fragilityLabel: "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      exchange_health_score: 72,
      final_decision: "WATCH",
      final_score: 72,
      liquidity_pressure: 34,
      macro_alignment_score: 72,
      sector: "Technology",
      sector_alignment_score: 72,
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 36,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Technology",
    shockPattern: null,
    stop_loss: 95,
    structuralLabel: "Stable",
    suggested_entry: 101,
    symbol,
    target: 124,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function drift(overrides: Partial<IntradayDriftRow> = {}): IntradayDriftRow {
  const symbol = overrides.symbol ?? "QQQ";
  return {
    company_name: `${symbol} Inc.`,
    first_action: "WATCH",
    first_price: 100,
    first_rating: "WATCH",
    first_score: 60,
    latest_action: "WATCH",
    latest_price: 102,
    latest_rating: "WATCH",
    latest_score: 64,
    price_change: 2,
    price_change_pct: 0.02,
    score_change: 4,
    setup_type: "MOMENTUM_CONTINUATION",
    snapshot_count: 4,
    symbol,
    ...overrides,
  };
}

test("intraday regime drift flags volatility expansion and breadth breakdown", () => {
  const system = buildIntradayRegimeDriftSystem({
    generatedAt: "2026-05-09T16:00:00.000Z",
    rows: [
      row({
        conviction: 34,
        final_decision: "AVOID",
        final_score: 33,
        fragility: 84,
        raw: {
          exchange_health_score: 34,
          final_decision: "AVOID",
          final_score: 33,
          liquidity_pressure: 82,
          macro_alignment_score: 30,
          sector: "Technology",
          sector_alignment_score: 34,
          symbol: "QQQ",
          volatility_pressure: 88,
        },
        symbol: "QQQ",
      }),
      row({
        conviction: 38,
        final_decision: "AVOID",
        final_score: 36,
        fragility: 80,
        raw: {
          exchange_health_score: 38,
          final_decision: "AVOID",
          final_score: 36,
          liquidity_pressure: 78,
          macro_alignment_score: 35,
          sector: "Semiconductors",
          sector_alignment_score: 36,
          symbol: "AMD",
          volatility_pressure: 84,
        },
        symbol: "AMD",
      }),
    ],
    driftRows: [
      drift({ latest_price: 95, price_change: -5, price_change_pct: -0.05, score_change: -8, symbol: "QQQ" }),
      drift({ latest_price: 96, price_change: -4, price_change_pct: -0.04, score_change: -6, symbol: "AMD" }),
    ],
  });

  assert.equal(system.currentMarketState, "Intraday Volatility Expansion");
  assert.ok(system.volatilityPressure >= 70);
  assert.ok(system.liquidityPressure >= 70);
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("VOLATILITY_EXPANSION_ALERT")));
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("BREADTH_BREAKDOWN_ALERT")));
});

test("intraday regime drift surfaces improving setups without overriding safety language", () => {
  const system = buildIntradayRegimeDriftSystem({
    rows: [
      row({ symbol: "NVDA" }),
      row({ symbol: "TSM", raw: { symbol: "TSM", sector: "Semiconductors", sector_alignment_score: 74 } }),
    ],
    driftRows: [
      drift({ price_change_pct: 0.025, score_change: 7, symbol: "NVDA" }),
      drift({ price_change_pct: 0.018, score_change: 5, symbol: "TSM" }),
    ],
  });

  assert.ok(system.opportunityDrifts.some((item) => item.state === "Improving Setup"));
  assert.doesNotMatch([...system.whatChangedIntraday, system.terminalSummary, system.llmBoundary].join(" "), /buy now|sell now|guaranteed|sure profit/i);
});

test("intraday regime drift marks one-snapshot coverage as limited baseline", () => {
  const system = buildIntradayRegimeDriftSystem({
    rows: [row({ symbol: "SPY" })],
    driftRows: [drift({ score_change: 0, snapshot_count: 1, symbol: "SPY" })],
  });

  assert.equal(system.coverage.snapshotCountMax, 1);
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("LIMITED_INTRADAY_BASELINE")));
  assert.match(system.whatChangedIntraday.join(" "), /baseline/i);
});

test("intraday regime drift reports verified event reaction only from supplied fields", () => {
  const system = buildIntradayRegimeDriftSystem({
    rows: [
      row({
        eventRisk: 82,
        raw: {
          event_risk_score: 82,
          event_shock_pressure_score: 78,
          macro_alignment_score: 46,
          symbol: "OXY",
          verified_event_pressure_score: 80,
        },
        symbol: "OXY",
      }),
    ],
    driftRows: [drift({ price_change_pct: 0.055, score_change: 2, symbol: "OXY" })],
  });

  assert.ok(system.eventReactionFeed.some((item) => item.symbol === "OXY"));
  assert.match(system.llmBoundary, /must not invent/i);
  assert.doesNotMatch(system.eventReactionFeed.map((item) => item.detail).join(" "), /unconfirmed|rumor|guaranteed/i);
});
