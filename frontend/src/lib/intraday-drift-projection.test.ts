import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildIntradaySignalDrift, dbDriftRowToHistoryRow, dbHistoryRowToHistoryRow } from "./scanner-data";

/**
 * The drift summary no longer fetches scanner_signals.payload.
 *
 * That blob is 36MB across the 18 runs /terminal asks for, it is jsonb so the
 * driver parses every byte of it, and buildIntradaySignalDrift reads none of it
 * directly. The lean query projects the handful of payload keys that
 * actionForRow and displayName can still fall back to, and nothing else.
 *
 * "Nothing else" is the claim that needs proving, so this builds the same
 * signals twice -- once through the full mapping with the payload attached,
 * once through the lean projection -- and asserts the drift rows come out
 * identical. If the projection ever misses a field the drift path reads, the
 * two diverge here rather than in production.
 */

type Signal = {
  action?: string | null;
  companyName?: string | null;
  finalScore: number;
  payload: Record<string, unknown>;
  price: number;
  rating?: string | null;
  setupType?: string | null;
  symbol: string;
  ts: string;
};

function fullRow(signal: Signal) {
  return {
    action: signal.action ?? null,
    asset_type: "Equity",
    buy_zone: null,
    company_name: signal.companyName ?? null,
    completed_at: signal.ts,
    conservative_target: null,
    created_at: signal.ts,
    entry_distance_pct: null,
    entry_status: null,
    entry_zone_high: null,
    entry_zone_low: null,
    final_decision: "WATCH",
    final_score: signal.finalScore,
    final_score_adjusted: null,
    market_regime: "neutral",
    payload: signal.payload,
    price: signal.price,
    quality_score: null,
    rank_position: 1,
    rating: signal.rating ?? null,
    recommendation_quality: null,
    risk_reward: null,
    scan_run_id: "run-1",
    sector: "Technology",
    setup_type: signal.setupType ?? null,
    stop_loss: null,
    suggested_entry: null,
    symbol: signal.symbol,
    take_profit: null,
  };
}

/** Exactly what the SQL projection produces: the columns, plus `payload->>key`. */
function leanRow(signal: Signal) {
  const key = (name: string) => {
    const value = signal.payload[name];
    return value === undefined || value === null ? null : String(value);
  };
  return {
    action: signal.action ?? null,
    company_name: signal.companyName ?? null,
    completed_at: signal.ts,
    composite_action: key("composite_action"),
    created_at: signal.ts,
    display_name: key("display_name"),
    final_score: signal.finalScore,
    long_action: key("long_action"),
    long_name: key("long_name"),
    mid_action: key("mid_action"),
    name: key("name"),
    price: signal.price,
    rank_position: 1,
    rating: signal.rating ?? null,
    recommended_action: key("recommended_action"),
    scan_run_id: "run-1",
    security_name: key("security_name"),
    setup_type: signal.setupType ?? null,
    short_action: key("short_action"),
    short_name: key("short_name"),
    symbol: signal.symbol,
  };
}

/** The parts of a real payload that matter here, plus a lot that does not. */
const bulk = {
  adjusted_weights: { macro: 0.2, momentum: 0.4, risk: 0.4 },
  alpaca_request_id: "aaaa,bbbb,cccc",
  composite_action: "REVIEW",
  data_provider_primary: "yfinance",
  decision_reason_codes: ["MOMENTUM_OK", "MACRO_SOFT"],
  factor_scores: { macro: 51, momentum: 72, risk: 44 },
  provider_latency_ms: 412,
  setup_thresholds: { enter: 80, watch: 60 },
  verified_event_recent_events: [{ source_url: "https://example.test", title: "x" }],
};

function drift(signals: Signal[]) {
  const full = signals.map((signal) => dbHistoryRowToHistoryRow(fullRow(signal) as never));
  const lean = signals.map((signal) => dbDriftRowToHistoryRow(leanRow(signal) as never));
  const symbols = [...new Set(signals.map((signal) => signal.symbol))].sort();
  return {
    fromFull: buildIntradaySignalDrift({ rows: full, symbols }),
    fromLean: buildIntradaySignalDrift({ rows: lean, symbols }),
  };
}

describe("intraday drift payload projection", () => {
  test("the ordinary case comes out identical", () => {
    const { fromFull, fromLean } = drift([
      { action: "WATCH", companyName: "Advanced Micro Devices", finalScore: 61, payload: bulk, price: 112.5, rating: "WATCH", setupType: "PULLBACK", symbol: "AMD", ts: "2026-09-03T06:00:00.000Z" },
      { action: "ACTIONABLE", companyName: "Advanced Micro Devices", finalScore: 68, payload: bulk, price: 118.25, rating: "TOP", setupType: "PULLBACK", symbol: "AMD", ts: "2026-09-03T07:00:00.000Z" },
      { action: "PASS", companyName: "NVIDIA", finalScore: 44, payload: bulk, price: 900, rating: "PASS", setupType: "BREAKOUT", symbol: "NVDA", ts: "2026-09-03T06:00:00.000Z" },
      { action: "PASS", companyName: "NVIDIA", finalScore: 41, payload: bulk, price: 880, rating: "PASS", setupType: "BREAKOUT", symbol: "NVDA", ts: "2026-09-03T07:00:00.000Z" },
    ]);
    assert.ok(fromFull.length > 0, "the fixture must actually produce drift rows");
    assert.deepEqual(fromLean, fromFull);
  });

  // actionForRow only reaches the payload when the action column is blank.
  // Prod currently has action on all 6408 rows, so this path is untested by
  // real traffic -- which is exactly why it is pinned here.
  test("the action fallback still resolves out of the payload", () => {
    const payload = { ...bulk, composite_action: "REVIEW", recommended_action: "ACTIONABLE" };
    const { fromFull, fromLean } = drift([
      { action: "", companyName: "Micron", finalScore: 55, payload, price: 90, rating: null, setupType: "PULLBACK", symbol: "MU", ts: "2026-09-03T06:00:00.000Z" },
      { action: null, companyName: "Micron", finalScore: 63, payload, price: 96, rating: null, setupType: "PULLBACK", symbol: "MU", ts: "2026-09-03T07:00:00.000Z" },
    ]);
    assert.deepEqual(fromLean, fromFull);
    assert.equal(fromLean[0]?.latest_action, "ACTIONABLE", "the fallback must resolve, or this test proves nothing");
  });

  // displayName walks the same list; company_name is a column but the rest of
  // the name fields live in the payload.
  test("the company-name fallback still resolves out of the payload", () => {
    const payload = { ...bulk, long_name: "Seagate Technology Holdings plc" };
    const { fromFull, fromLean } = drift([
      { action: "WATCH", companyName: null, finalScore: 50, payload, price: 70, rating: "WATCH", setupType: "PULLBACK", symbol: "STX", ts: "2026-09-03T06:00:00.000Z" },
      { action: "WATCH", companyName: null, finalScore: 52, payload, price: 72, rating: "WATCH", setupType: "PULLBACK", symbol: "STX", ts: "2026-09-03T07:00:00.000Z" },
    ]);
    assert.deepEqual(fromLean, fromFull);
    assert.equal(fromLean[0]?.company_name, "Seagate Technology Holdings plc", "the fallback must resolve, or this test proves nothing");
  });

  test("a symbol with one snapshot and missing numbers behaves the same", () => {
    const { fromFull, fromLean } = drift([
      { action: "REVIEW", companyName: "Intel", finalScore: Number.NaN, payload: bulk, price: Number.NaN, rating: null, setupType: null, symbol: "INTC", ts: "2026-09-03T06:00:00.000Z" },
    ]);
    assert.deepEqual(fromLean, fromFull);
  });

  test("the lean row carries no provider plumbing at all", () => {
    const [row] = [{ action: "WATCH", companyName: "AMD", finalScore: 61, payload: bulk, price: 112, rating: "WATCH", setupType: "PULLBACK", symbol: "AMD", ts: "2026-09-03T06:00:00.000Z" }];
    const serialised = JSON.stringify(dbDriftRowToHistoryRow(leanRow(row) as never));
    for (const field of ["alpaca_request_id", "provider_latency_ms", "data_provider_primary", "verified_event_recent_events", "factor_scores", "setup_thresholds"]) {
      assert.equal(serialised.includes(field), false, `${field} must not survive the projection`);
    }
  });
});
