import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildExecutionIntelligence } from "./execution-intelligence";
import { buildShockMovePattern, type ShockMovePriceBar } from "./shock-move";
import type { OpportunityViewModel } from "./opportunity-view-model";

/**
 * chaseSuccessRate and pullbackSuccessRate are fractions everywhere they are
 * produced -- `rate()` returns matched/total, and on production all 1,134 rows
 * of shock_move_patterns hold chase_success_rate in 0-1 and
 * pullback_success_rate in 0-0.6.
 *
 * Four places in execution-intelligence read them as if they were already
 * percentages. Math.round(0.2667) is 0, so every terminal card said "chase
 * success is limited at 0%" against a real figure of 24-58%; the guard
 * `rate < 45` was true for every possible fraction, so that warning fired on
 * every symbol; and pullbackQuality weighted the fraction against terms on
 * 0-100.
 *
 * None of it was caught because the test fixture set 58 and 64 -- percentages
 * the producer never emits -- and no test asserted on the rendered strings.
 * These do both: pin the producer's unit, and pin what the reader sees.
 */

function bars(): ShockMovePriceBar[] {
  const out: ShockMovePriceBar[] = [];
  let close = 100;
  for (let i = 0; i < 220; i += 1) {
    close += i % 6 === 0 ? 0.5 : 0.04;
    if (i % 19 === 0) close *= 1.1;
    if (i % 31 === 0) close *= 0.92;
    out.push({
      close,
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
      high: close * 1.02,
      low: close * 0.98,
      open: close * 0.996,
      volume: i % 19 === 0 || i % 31 === 0 ? 4_200_000 : 1_100_000 + i * 800,
    });
  }
  return out;
}

function rowWith(rates: { chaseSuccessRate: number | null; pullbackSuccessRate: number | null }): OpportunityViewModel {
  const pattern = buildShockMovePattern({ bars: bars(), lookbackWindow: "1y", symbol: "AMD" });
  assert.ok(pattern, "fixture must produce a pattern");
  return {
    conviction: 60,
    dataFreshness: { label: "Fresh", status: "fresh" },
    decision: "Watch",
    entryStatus: "watch",
    final_decision: "WATCH",
    final_score: 66,
    fragility: 40,
    price: 120,
    raw: { setup_type: "PULLBACK", symbol: "AMD" },
    shockPattern: { ...pattern, ...rates },
    stop_loss: 110,
    suggested_entry: 118,
    symbol: "AMD",
    target: 134,
  } as unknown as OpportunityViewModel;
}

describe("shock success rates are fractions", () => {
  // The producer is the authority on the unit. If this ever fails, the rest of
  // the file is asserting against the wrong scale.
  test("buildShockMovePattern emits rates in 0-1, not 0-100", () => {
    const pattern = buildShockMovePattern({ bars: bars(), lookbackWindow: "1y", symbol: "AMD" });
    assert.ok(pattern);
    for (const [name, value] of [
      ["chaseSuccessRate", pattern.chaseSuccessRate],
      ["pullbackSuccessRate", pattern.pullbackSuccessRate],
    ] as const) {
      if (value === null) continue;
      assert.ok(value >= 0 && value <= 1, `${name} should be a fraction, got ${value}`);
    }
  });

  test("a 0.2667 chase rate reads as 27%, not 0%", () => {
    const lines = buildExecutionIntelligence(rowWith({ chaseSuccessRate: 0.2667, pullbackSuccessRate: 0.31 })).keyRisks;
    const chase = lines.find((line) => line.includes("chase success is limited"));
    assert.ok(chase, "the chase-risk line should appear for a low rate");
    assert.match(chase, /limited at 27% in comparable/);
    assert.doesNotMatch(chase, /limited at 0%/);
  });

  // The guard was `< 45` against a fraction, so it was true for every symbol
  // that had a pattern at all. A strong historical rate must not be reported
  // as a risk.
  test("a strong chase rate does not raise the chase-risk warning", () => {
    const lines = buildExecutionIntelligence(rowWith({ chaseSuccessRate: 0.62, pullbackSuccessRate: 0.55 })).keyRisks;
    assert.equal(lines.find((line) => line.includes("chase success is limited")), undefined);
  });

  test("the historical context lines carry percentages too", () => {
    const context = buildExecutionIntelligence(rowWith({ chaseSuccessRate: 0.58, pullbackSuccessRate: 0.64 })).historicalExecutionContext;
    assert.ok(context.some((line) => line.includes("pullback entries 64% of the time")), context.join(" | "));
    assert.ok(context.some((line) => line.includes("worked 58% of the time")), context.join(" | "));
  });

  test("a null rate still degrades to the limited-sample wording", () => {
    const model = buildExecutionIntelligence(rowWith({ chaseSuccessRate: null, pullbackSuccessRate: null }));
    assert.ok(model.historicalExecutionContext.some((line) => line.includes("Chase success sample is still limited")));
    assert.equal(model.keyRisks.find((line) => line.includes("chase success is limited")), undefined);
  });

  // The scoring half. pullbackQuality mixes this term with five others on
  // 0-100; feeding it a fraction cost roughly six points wherever a pattern
  // existed, which is a silent scoring error rather than a visible one.
  test("pullback quality responds to the pullback rate at all", () => {
    const weak = buildExecutionIntelligence(rowWith({ chaseSuccessRate: 0.3, pullbackSuccessRate: 0.05 })).pullbackQuality.score;
    const strong = buildExecutionIntelligence(rowWith({ chaseSuccessRate: 0.3, pullbackSuccessRate: 0.95 })).pullbackQuality.score;
    assert.ok(strong > weak + 8, `a 0.05 -> 0.95 swing should move pullback quality; got ${weak} -> ${strong}`);
  });
});
