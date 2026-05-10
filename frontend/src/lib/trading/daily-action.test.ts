import assert from "node:assert/strict";
import test from "node:test";
import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import { dailyActionAllowsTrade, getDailyAction } from "./daily-action";
import { MISSING_DATA_ACTION_REASON, STALE_DATA_ACTION_REASON } from "@/lib/stale-data-safety";

const normalRegime: MarketRegime = {
  aggressiveEntriesAllowed: true,
  breadth: "NORMAL",
  confidence: 70,
  label: "NORMAL",
  leadership: "BROAD",
  riskMode: "risk-on",
  source: "inferred",
  strongestSectors: [],
  weakestSectors: [],
};

test("WAIT market blocks trade UI", () => {
  const action = getDailyAction({
    best: { confidence: 80, row: { final_decision: "ENTER", symbol: "TSM" }, score: 80 },
    marketRegime: { ...normalRegime, label: "OVERHEATED" },
  });

  assert.equal(action.action, "WAIT");
  assert.equal(action.label, "Wait for a Cleaner Setup");
  assert.match(action.reason, /entry quality/i);
  assert.equal(dailyActionAllowsTrade(action), false);
});

test("BUY decision permits one active research setup", () => {
  const action = getDailyAction({
    best: { confidence: 82, row: { final_decision: "ENTER", symbol: "AAPL" }, score: 82 },
    marketRegime: normalRegime,
  });

  assert.equal(action.action, "BUY");
  assert.equal(action.label, "Research Setup AAPL");
  assert.equal(dailyActionAllowsTrade(action), true);
});

test("stale data disables decisions", () => {
  const action = getDailyAction({
    best: { confidence: 90, row: { final_decision: "ENTER", symbol: "NVDA" }, score: 90 },
    marketRegime: normalRegime,
    scanSafety: {
      active: true,
      ageMinutes: 300,
      humanAge: "Updated 5 hr ago",
      lastUpdated: "2026-05-03T10:00:00.000Z",
      maxAgeMinutes: 240,
      reason: STALE_DATA_ACTION_REASON,
      status: "stale",
    },
  });

  assert.equal(action.action, "DATA_STALE");
  assert.equal(action.label, "Decision Paused");
  assert.equal(action.reason, STALE_DATA_ACTION_REASON);
  assert.equal(dailyActionAllowsTrade(action), false);
});

test("missing scanner output uses a calm paused decision state", () => {
  const action = getDailyAction({
    best: { confidence: 90, row: { final_decision: "ENTER", symbol: "NVDA" }, score: 90 },
    marketRegime: normalRegime,
    scanSafety: {
      active: true,
      ageMinutes: null,
      humanAge: "Unknown",
      lastUpdated: null,
      maxAgeMinutes: 240,
      reason: MISSING_DATA_ACTION_REASON,
      status: "missing",
    },
  });

  assert.equal(action.action, "DATA_STALE");
  assert.equal(action.label, "Decision Paused");
  assert.equal(action.reason, MISSING_DATA_ACTION_REASON);
  assert.equal(dailyActionAllowsTrade(action), false);
});
