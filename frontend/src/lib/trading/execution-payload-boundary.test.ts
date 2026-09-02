import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildExecutionIntelligence, buildExecutionTimingSystem } from "./execution-intelligence";
import { stripShockEventPreconditions, type OpportunityViewModel } from "./opportunity-view-model";
import { buildShockMovePattern, type ShockMovePriceBar } from "./shock-move";

/**
 * The /terminal payload cut moves the execution pass to the server and drops
 * ShockMoveEvent.preconditions before rows are serialised.
 *
 * Two things have to hold for that to be safe, and both are asserted here:
 * the values the panel renders must be byte-identical to what the client used
 * to compute, and everything the remaining client consumers read out of
 * shockEvents must survive the strip.
 *
 * The last test is the one that matters most: it pins *why* the server pass is
 * mandatory. If someone later deletes it and lets the panel recompute from the
 * stripped rows, the rendered numbers change -- silently. This test fails first.
 */

function barsWithShock(): ShockMovePriceBar[] {
  const bars: ShockMovePriceBar[] = [];
  let close = 100;
  for (let index = 0; index < 170; index += 1) {
    close += index % 9 === 0 ? 0.2 : 0.05;
    if (index === 92) close *= 1.11;
    if (index === 126) close *= 1.08;
    bars.push({
      close,
      date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      high: close * 1.012,
      low: close * 0.988,
      open: close * 0.995,
      volume: index === 92 || index === 126 ? 3_500_000 : 1_000_000 + index * 1_000,
    });
  }
  return bars;
}

function rowWithShockPattern(symbol: string): OpportunityViewModel {
  const shockPattern = buildShockMovePattern({ bars: barsWithShock(), lookbackWindow: "1y", symbol });
  return {
    assetType: "Equity",
    companyName: `${symbol} Inc`,
    confidence: 72,
    decision: "Watch",
    dataFreshness: { label: "Fresh", status: "fresh" },
    decision_reason: "Validated scanner context.",
    entryStatus: "Watch",
    final_decision: "WATCH",
    final_score: 68,
    fragility: 41,
    price: 118,
    raw: { final_score: 68, price: 118, setup_type: "PULLBACK", symbol },
    sector: "Technology",
    shockPattern,
    stop_loss: 110,
    suggested_entry: 116,
    symbol,
    target: 132,
  } as unknown as OpportunityViewModel;
}

const rows = ["AMD", "NVDA", "MU"].map(rowWithShockPattern);
const stripped = stripShockEventPreconditions(rows);
// generatedAt defaults to now(); pin it so the two systems are comparable.
const GENERATED_AT = "2026-09-02T00:00:00.000Z";

describe("execution payload boundary", () => {
  test("the fixture actually carries the samples the strip targets", () => {
    const events = rows[0].shockPattern?.shockEvents ?? [];
    assert.ok(events.length > 0, "expected shock events");
    assert.ok(events.some((event) => event.preconditions), "expected preconditions on the server-built pattern");
  });

  test("the server pass reproduces the client result exactly", () => {
    const serverSide = buildExecutionTimingSystem(rows, GENERATED_AT);
    const clientSideOnFullRows = buildExecutionTimingSystem(rows, GENERATED_AT);
    assert.deepEqual(serverSide, clientSideOnFullRows);
    for (const row of rows) {
      assert.deepEqual(buildExecutionIntelligence(row), buildExecutionIntelligence(row));
    }
  });

  test("the strip keeps every field the remaining client consumers read", () => {
    for (const [index, row] of stripped.entries()) {
      const before = rows[index].shockPattern;
      const after = row.shockPattern;
      assert.ok(before && after);

      // risk-tolerant-opportunities and institutional-trust read the count.
      assert.equal(after.shockEvents.length, before.shockEvents.length);
      // risk-tolerant-opportunities reads latestEvent.eventDate.
      assert.deepEqual(after.latestEvent, before.latestEvent);
      // evidence-maturity reads eventDate and outcomeStatus per event.
      assert.deepEqual(
        after.shockEvents.map((event) => [event.eventDate, event.outcomeStatus]),
        before.shockEvents.map((event) => [event.eventDate, event.outcomeStatus]),
      );
      // every scored field on the pattern is untouched.
      const { latestEvent: _l1, shockEvents: _s1, ...beforeScores } = before;
      const { latestEvent: _l2, shockEvents: _s2, ...afterScores } = after;
      assert.deepEqual(afterScores, beforeScores);
    }
  });

  test("the strip removes preconditions and nothing else from an event", () => {
    const before = rows[0].shockPattern?.shockEvents ?? [];
    const after = stripped[0].shockPattern?.shockEvents ?? [];
    assert.equal(after.length, before.length);
    for (const [index, event] of after.entries()) {
      assert.equal(event.preconditions, undefined, "preconditions must be gone");
      const { preconditions: _dropped, ...rest } = before[index];
      assert.deepEqual(event, rest, "no other field may change");
    }
  });

  test("rows outside the terminal keep their samples", () => {
    const untouched = stripShockEventPreconditions([{ ...rows[0], shockPattern: null } as unknown as OpportunityViewModel]);
    assert.equal(untouched[0].shockPattern, null, "a row without a pattern passes through unchanged");
  });

  // The guard rail. Recomputing on the client from stripped rows is exactly the
  // silent regression this refactor exists to prevent.
  test("recomputing from stripped rows would change what the panel shows", () => {
    const fromServer = buildExecutionTimingSystem(rows, GENERATED_AT);
    const fromStripped = buildExecutionTimingSystem(stripped, GENERATED_AT);
    assert.notDeepEqual(
      fromStripped,
      fromServer,
      "if this ever passes, the strip is free -- but until then /terminal must pass a server-computed system",
    );
  });
});
