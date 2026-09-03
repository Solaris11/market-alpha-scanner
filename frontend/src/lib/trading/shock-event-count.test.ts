import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildOpportunityTrustModel } from "./institutional-trust";
import { buildShockMovePattern, shockPatternFromDbRow, type ShockMovePriceBar } from "./shock-move";
import type { OpportunityViewModel } from "./opportunity-view-model";

/**
 * Stage 0 and 1 of dropping shockEvents from the /terminal payload.
 *
 * The array is 4.7 MB of that payload and no client component on /terminal
 * reads its contents -- but institutional-trust reads its *length*, as the
 * fallback when a pattern has no stored timingValidation. So the count has to
 * survive the array, and it has to be its own field.
 *
 * The reason it cannot simply be derived is the thing worth pinning, because
 * upsideShockCount + downsideShockCount looks like it would do the job:
 *
 *   - those two count only |return1d| >= 5, while detectShockEvents also
 *     admits smaller moves on a z-score, ATR or gap/volume rule
 *   - they are computed over the full event list, while shockEvents is capped
 *     at the last 80
 *
 * so the sum can be larger *or* smaller than the array length. The cap is the
 * half that can be constructed deterministically, and it is asserted below.
 */

/** 200 bars alternating a +6% and a -5.5% day: ~200 qualifying shocks, well past the cap. */
function heavilyShockedBars(): ShockMovePriceBar[] {
  const bars: ShockMovePriceBar[] = [];
  let close = 100;
  for (let index = 0; index < 200; index += 1) {
    close *= index % 2 === 0 ? 1.06 : 0.945;
    bars.push({
      close,
      date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      high: close * 1.02,
      low: close * 0.98,
      open: close * 0.995,
      volume: 2_000_000 + index * 1_000,
    });
  }
  return bars;
}

function quietBars(): ShockMovePriceBar[] {
  const bars: ShockMovePriceBar[] = [];
  let close = 100;
  for (let index = 0; index < 120; index += 1) {
    close += 0.05;
    bars.push({
      close,
      date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      high: close * 1.004,
      low: close * 0.996,
      open: close * 0.999,
      volume: 1_000_000,
    });
  }
  return bars;
}

/** buildShockMovePattern returns null when a fixture is too thin to score; these are not. */
function pattern(bars: ShockMovePriceBar[], symbol: string) {
  const built = buildShockMovePattern({ bars, lookbackWindow: "1y", symbol });
  assert.ok(built, `the ${symbol} fixture must produce a pattern, or the test below proves nothing`);
  return built;
}

describe("shockEventCount", () => {
  test("matches the array in buildShockMovePattern", () => {
    const built = pattern(heavilyShockedBars(), "AMD");
    assert.equal(built.shockEventCount, (built.shockEvents ?? []).length);
  });

  test("matches the array in shockPatternFromDbRow", () => {
    const built = pattern(heavilyShockedBars(), "AMD");
    const restored = shockPatternFromDbRow({
      lookback_window: "1y",
      shock_events: JSON.parse(JSON.stringify(built.shockEvents ?? [])),
      symbol: "AMD",
    });
    assert.ok(restored);
    assert.equal(restored.shockEventCount, (restored.shockEvents ?? []).length);
    assert.equal(restored.shockEventCount, built.shockEventCount);
  });

  test("is zero, not absent, when a symbol has no shocks at all", () => {
    const quiet = pattern(quietBars(), "KO");
    assert.equal((quiet.shockEvents ?? []).length, 0);
    assert.equal(quiet.shockEventCount, 0);
  });

  // The guard. If someone deletes this field and derives it from the two shock
  // counts instead, this is what fails.
  test("is NOT upsideShockCount + downsideShockCount", () => {
    const built = pattern(heavilyShockedBars(), "AMD");
    const derived = built.upsideShockCount + built.downsideShockCount;

    assert.equal(built.shockEventCount, 80, "the fixture must actually hit the 80 cap, or this proves nothing");
    assert.ok(derived > 80, `the fixture must produce more raw shocks than the cap, got ${derived}`);
    assert.notEqual(built.shockEventCount, derived);
  });
});

function rowWithPattern(pattern: unknown): OpportunityViewModel {
  return {
    dataFreshness: { label: "Fresh", status: "fresh" },
    evidence: { label: "Validated", limitations: [], score: 72 },
    eventRisk: 20,
    fragility: 30,
    price: 118,
    raw: {},
    shockPattern: pattern,
    symbol: "AMD",
  } as unknown as OpportunityViewModel;
}

describe("institutional trust reads the count, not the array", () => {
  // Deliberately the DB constructor, not buildShockMovePattern. The built
  // pattern always computes a timingValidation, so it never reaches the
  // fallback this change is about; a pattern restored from a row whose metrics
  // column has no timingValidation key does, and that is the production case
  // where the count is load-bearing.
  const restored = shockPatternFromDbRow({
    lookback_window: "1y",
    shock_events: JSON.parse(JSON.stringify(pattern(heavilyShockedBars(), "AMD").shockEvents ?? [])),
    symbol: "AMD",
  });
  assert.ok(restored, "the DB fixture must restore a pattern");

  test("the fixture exercises the fallback rather than stored timing validation", () => {
    assert.equal(restored.timingValidation ?? null, null, "with no stored metrics the fallback branch must be the live one");
    assert.ok(restored.shockEventCount > 0);
  });

  test("a row without the array produces the same model as a row with it", () => {
    const { shockEvents: _dropped, ...withoutArray } = restored;
    const full = buildOpportunityTrustModel(rowWithPattern(restored));
    const stripped = buildOpportunityTrustModel(rowWithPattern(withoutArray));
    assert.deepEqual(stripped, full);
  });

  // Pins why the scalar is mandatory: drop it as well and the panel quietly
  // changes from "80 replay samples" to "no replay context".
  test("a row without the count degrades, which is what the count exists to prevent", () => {
    const { shockEvents: _dropped, shockEventCount: _alsoDropped, ...withoutEither } = restored;
    const full = buildOpportunityTrustModel(rowWithPattern(restored));
    const bare = buildOpportunityTrustModel(rowWithPattern(withoutEither));
    assert.notDeepEqual(bare, full, "if this ever passes, the count is free -- until then it must travel with the row");
  });
});
