import assert from "node:assert/strict";
import { test } from "node:test";
import type { RankingRow } from "@/lib/types";
import { buildActionTriage, normalizeDecision } from "./action-triage";

const row = (over: Partial<RankingRow>): RankingRow => ({ symbol: "AAA", ...over }) as RankingRow;

test("buckets by the scanner's own decision without reinterpreting it", () => {
  const triage = buildActionTriage([
    row({ symbol: "A", final_decision: "ENTER", final_score: 70 }),
    row({ symbol: "B", final_decision: "WATCH", final_score: 60 }),
    row({ symbol: "C", final_decision: "WAIT_PULLBACK", final_score: 50 }),
    row({ symbol: "D", final_decision: "AVOID", final_score: 10 }),
    row({ symbol: "E", final_decision: "EXIT", final_score: 5 }),
  ]);
  assert.equal(triage.counts.ENTER, 1);
  assert.equal(triage.counts.WATCH, 1);
  assert.equal(triage.counts.WAIT_PULLBACK, 1);
  assert.equal(triage.counts.AVOID, 1);
  assert.equal(triage.counts.EXIT, 1);
  assert.deepEqual(triage.enter.map((e) => e.symbol), ["A"]);
});

test("orders each bucket by the score the scanner already assigned", () => {
  const triage = buildActionTriage([
    row({ symbol: "LOW", final_decision: "WATCH", final_score: 41 }),
    row({ symbol: "HIGH", final_decision: "WATCH", final_score: 88 }),
    row({ symbol: "MID", final_decision: "WATCH", final_score: 65 }),
  ]);
  assert.deepEqual(triage.watch.map((e) => e.symbol), ["HIGH", "MID", "LOW"]);
});

test("an unscored row sorts last rather than being treated as zero", () => {
  // "unscored" and "scored zero" are different states; collapsing them would
  // quietly promote a broken row above a real one.
  const triage = buildActionTriage([
    row({ symbol: "NOSCORE", final_decision: "WATCH", final_score: undefined }),
    row({ symbol: "ZERO", final_decision: "WATCH", final_score: 0 }),
  ]);
  assert.deepEqual(triage.watch.map((e) => e.symbol), ["ZERO", "NOSCORE"]);
});

test("caps each bucket at the requested size", () => {
  const rows = Array.from({ length: 9 }, (_, i) => row({ symbol: `S${i}`, final_decision: "WATCH", final_score: i }));
  assert.equal(buildActionTriage(rows, 3).watch.length, 3);
  assert.equal(buildActionTriage(rows, 5).watch.length, 5);
});

test("normalises casing, whitespace and the hyphenated spelling", () => {
  assert.equal(normalizeDecision(" wait-pullback "), "WAIT_PULLBACK");
  assert.equal(normalizeDecision("Enter"), "ENTER");
  assert.equal(normalizeDecision("something else"), "OTHER");
  assert.equal(normalizeDecision(null), "OTHER");
});

test("rows without a symbol are counted but never named", () => {
  // A nameless row still happened and belongs in the count; it just cannot be
  // rendered as a link.
  const triage = buildActionTriage([row({ symbol: "", final_decision: "ENTER", final_score: 90 })]);
  assert.equal(triage.counts.ENTER, 1);
  assert.equal(triage.enter.length, 0);
});

test("an empty, null or non-array input yields empty buckets rather than throwing", () => {
  for (const input of [null, undefined, [] as RankingRow[]]) {
    const triage = buildActionTriage(input);
    assert.equal(triage.counts.ENTER, 0);
    assert.deepEqual(triage.enter, []);
  }
});
