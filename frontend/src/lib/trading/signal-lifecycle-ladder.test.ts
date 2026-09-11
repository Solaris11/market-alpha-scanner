import assert from "node:assert/strict";
import { test } from "node:test";
import type { RankingRow } from "@/lib/types";
import { buildSignalTradeLevels } from "./signal-lifecycle";

const base = (over: Partial<RankingRow>): RankingRow => ({ symbol: "AAA", ...over }) as RankingRow;

test("draws the full R-ladder when the rungs ascend", () => {
  const l = buildSignalTradeLevels(base({
    suggested_entry: "100", stop_loss: "95",
    conservative_target: "110", take_profit_high: "120", aggressive_target_high: "135",
  }));
  assert.equal(l.target, 110);
  assert.equal(l.target2, 120);
  assert.equal(l.target3, 135);
});

test("drops a rung that is not strictly above the previous one", () => {
  // balanced below conservative, aggressive above -> T2 null, T3 still drawn
  const l = buildSignalTradeLevels(base({
    conservative_target: "110", take_profit_high: "108", aggressive_target_high: "130",
  }));
  assert.equal(l.target, 110);
  assert.equal(l.target2, null);
  assert.equal(l.target3, 130);
});

test("no ladder when only the conservative target exists", () => {
  const l = buildSignalTradeLevels(base({ conservative_target: "110" }));
  assert.equal(l.target, 110);
  assert.equal(l.target2, null);
  assert.equal(l.target3, null);
});

test("equal rungs do not draw (strictly-above guard)", () => {
  const l = buildSignalTradeLevels(base({
    conservative_target: "110", take_profit_high: "110", aggressive_target_high: "110",
  }));
  assert.equal(l.target2, null);
  assert.equal(l.target3, null);
});

test("entry/stop/target1 still behave exactly as before", () => {
  const l = buildSignalTradeLevels(base({ suggested_entry: "50-52", stop_loss: "47", conservative_target: "60" }));
  assert.equal(l.entryLow, 50);
  assert.equal(l.entryHigh, 52);
  assert.equal(l.stop, 47);
  assert.equal(l.target, 60);
});
