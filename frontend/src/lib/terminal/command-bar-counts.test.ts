import assert from "node:assert/strict";
import { test } from "node:test";
import { countTerminalDecisions } from "./command-bar-counts";

test("counts every decision the scanner emits", () => {
  const counts = countTerminalDecisions([
    { final_decision: "ENTER" },
    { final_decision: "WATCH" },
    { final_decision: "WATCH" },
    { final_decision: "WAIT_PULLBACK" },
    { final_decision: "AVOID" },
    { final_decision: "EXIT" },
  ]);
  assert.equal(counts.enter, 1);
  assert.equal(counts.watch, 2);
  assert.equal(counts.waitPullback, 1);
  assert.equal(counts.avoid, 1);
  assert.equal(counts.exit, 1);
  assert.equal(counts.total, 6);
});

test("ENTER is counted at all, which the existing distribution never did", () => {
  // The regression this whole component exists to fix: the page could not say
  // whether an entry existed, because ENTER was absent from the only counter.
  assert.equal(countTerminalDecisions([{ final_decision: "ENTER" }]).enter, 1);
});

test("normalises casing, whitespace and the hyphenated spelling", () => {
  const counts = countTerminalDecisions([
    { final_decision: "  enter " },
    { final_decision: "wait-pullback" },
    { final_decision: "Wait_Pullback" },
  ]);
  assert.equal(counts.enter, 1);
  assert.equal(counts.waitPullback, 2);
});

test("unknown and missing decisions are counted in the total but not miscategorised", () => {
  const counts = countTerminalDecisions([{ final_decision: "SOMETHING_NEW" }, { final_decision: null }, {}]);
  assert.equal(counts.total, 3);
  assert.equal(counts.enter + counts.watch + counts.waitPullback + counts.avoid + counts.exit, 0);
});

test("a missing or non-array input is zero rather than a crash", () => {
  // The terminal renders before every model is guaranteed present; a status bar
  // that throws would take the whole page with it.
  for (const input of [null, undefined, "not an array" as unknown as never]) {
    const counts = countTerminalDecisions(input as never);
    assert.equal(counts.total, 0);
    assert.equal(counts.enter, 0);
  }
});
