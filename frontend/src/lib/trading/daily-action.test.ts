import assert from "node:assert/strict";
import test from "node:test";
import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import { dailyActionAllowsTrade, getDailyAction } from "./daily-action";

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
  assert.equal(action.label, "NO TRADE TODAY");
  assert.equal(dailyActionAllowsTrade(action), false);
});

test("BUY decision permits one active research setup", () => {
  const action = getDailyAction({
    best: { confidence: 82, row: { final_decision: "ENTER", symbol: "AAPL" }, score: 82 },
    marketRegime: normalRegime,
  });

  assert.equal(action.action, "BUY");
  assert.equal(action.label, "RESEARCH SIGNAL AAPL");
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
      reason: "Data is stale. Refresh scan before acting.",
      status: "stale",
    },
  });

  assert.equal(action.action, "DATA_STALE");
  assert.equal(action.label, "NO TRADE TODAY");
  assert.equal(action.reason, "Data is outdated. No action recommended.");
  assert.equal(dailyActionAllowsTrade(action), false);
});
