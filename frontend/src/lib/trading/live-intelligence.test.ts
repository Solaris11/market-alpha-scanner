import assert from "node:assert/strict";
import test from "node:test";
import type { IntradayDriftRow } from "@/lib/types";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildLiveIntelligenceSystem } from "./live-intelligence";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 72,
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-09T16:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh",
    decision_reason: "Structure is improving.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$103",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WATCH",
    final_score: 74,
    fragility: 44,
    fragilityLabel: "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 106,
    raw: {
      exchange_health_score: 72,
      final_decision: "WATCH",
      final_score: 74,
      liquidity_pressure: 35,
      macro_alignment_score: 74,
      relative_volume: 1.2,
      sector: "Semiconductors",
      sector_alignment_score: 76,
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 38,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable",
    suggested_entry: 102,
    symbol,
    target: 122,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function drift(overrides: Partial<IntradayDriftRow> = {}): IntradayDriftRow {
  const symbol = overrides.symbol ?? "AMD";
  return {
    company_name: `${symbol} Inc.`,
    first_action: "WATCH",
    first_price: 100,
    first_rating: "WATCH",
    first_score: 62,
    latest_action: "WATCH",
    latest_price: 106,
    latest_rating: "WATCH",
    latest_score: 72,
    price_change: 6,
    price_change_pct: 0.06,
    score_change: 10,
    setup_type: "MOMENTUM_CONTINUATION",
    snapshot_count: 5,
    symbol,
    ...overrides,
  };
}

test("live intelligence detects shock escalation and unusual volume from structured scanner fields", () => {
  const system = buildLiveIntelligenceSystem({
    generatedAt: "2026-05-09T16:00:00.000Z",
    rows: [
      row({
        eventRisk: 78,
        raw: {
          event_risk_score: 78,
          event_shock_pressure_score: 82,
          relative_volume: 3.2,
          symbol: "AMD",
          verified_event_pressure_score: 76,
        },
        symbol: "AMD",
      }),
      row({
        raw: {
          relative_volume: 2.8,
          symbol: "MU",
          upside_shock_score: 78,
        },
        symbol: "MU",
      }),
    ],
    driftRows: [
      drift({ price_change_pct: 0.062, score_change: 9, symbol: "AMD" }),
      drift({ price_change_pct: 0.041, score_change: 6, symbol: "MU" }),
    ],
    refreshIntervalMs: 30_000,
  });

  assert.ok(system.shockEscalationScore >= 68);
  assert.ok(system.unusualVolumeScore >= 68);
  assert.ok(system.shockEscalations.some((item) => item.symbol === "AMD" && item.state === "Shock Escalation"));
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("LIVE_SHOCK_ESCALATION")));
  assert.match(system.liveSummary, /not a trade instruction/i);
});

test("live intelligence stays evidence-limited when only one snapshot is available", () => {
  const system = buildLiveIntelligenceSystem({
    rows: [row({ symbol: "SPY" })],
    driftRows: [drift({ score_change: 0, snapshot_count: 1, symbol: "SPY" })],
  });

  assert.equal(system.status, "degraded");
  assert.match(system.latencyLabel, /observation-limited/i);
  assert.ok(system.alerts.some((alert) => alert.reasonCodes.includes("LIMITED_INTRADAY_BASELINE")));
});

test("live intelligence reports event reaction only from supplied verified fields", () => {
  const system = buildLiveIntelligenceSystem({
    rows: [
      row({
        eventRisk: 84,
        raw: {
          event_risk_score: 84,
          event_shock_pressure_score: 80,
          relative_volume: 2,
          symbol: "OXY",
          verified_event_pressure_score: 82,
        },
        symbol: "OXY",
      }),
    ],
    driftRows: [drift({ price_change_pct: 0.052, score_change: 3, symbol: "OXY" })],
  });

  assert.ok(system.dashboardUpdates.some((item) => item.label === "Shock Detection"));
  assert.ok(system.shockEscalations.some((item) => item.symbol === "OXY" && item.eventPressureScore >= 80));
  assert.doesNotMatch(system.shockEscalations.map((item) => item.detail).join(" "), /rumor|unconfirmed|guaranteed/i);
});

test("live intelligence safety language forbids execution-style claims", () => {
  const system = buildLiveIntelligenceSystem({
    rows: [row({ symbol: "QQQ" })],
    driftRows: [drift({ symbol: "QQQ" })],
  });
  const combined = [
    system.liveSummary,
    ...system.limitations,
    ...system.alerts.map((alert) => alert.detail),
    ...system.dashboardUpdates.map((update) => update.detail),
    ...system.shockEscalations.map((item) => item.detail),
  ].join(" ");

  assert.doesNotMatch(combined, /buy now|sell now|guaranteed|sure profit|free money|place an order|execute this trade/i);
  assert.match(combined, /research|not a trade instruction|not broker execution/i);
});
