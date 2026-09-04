import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildOpportunityActionability } from "./opportunity-actionability";
import { actionabilityCardFor, buildTerminalActionabilityMap } from "./terminal-actionability";
import { buildShockMovePattern, type ShockMovePriceBar } from "./shock-move";
import { stripShockEventsForClient, type OpportunityViewModel } from "./opportunity-view-model";

/**
 * Stage 2: the terminal computes actionability on the server.
 *
 * Two client components on /terminal call buildOpportunityActionability, which
 * reads every shock event on the row to calibrate the execution state behind
 * the five strings they render. That is the only reason shockEvents -- 4.7 MB,
 * 28% of the payload -- is serialised to the browser at all.
 *
 * This stage changes no payload. It moves the computation to the server and
 * passes the result down, so that Stage 3 can drop the array without any
 * rendered value changing. These tests are what make that claim checkable.
 */

function barsWithShock(seed: number): ShockMovePriceBar[] {
  const bars: ShockMovePriceBar[] = [];
  let close = 100 + seed;
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

/** ~200 qualifying shocks, enough to engage the calibration the light fixture never reaches. */
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

/**
 * The one bar shape I could find that still exposes the strip.
 *
 * heavilyShockedBars above also reaches the 80-event cap, but its events are a
 * clean alternating pattern whose calibration lands the same way with or
 * without the array -- swept across 60 setup/decision/entry-status
 * combinations, it differs in none. This one mixes shock direction with the
 * drift, and differs on the combinations noted at the test below.
 */
function mixedShockBars(): ShockMovePriceBar[] {
  const bars: ShockMovePriceBar[] = [];
  let close = 100;
  for (let index = 0; index < 260; index += 1) {
    close += index % 9 === 0 ? 0.2 : 0.05;
    const shock = index % 3 === 0;
    if (shock) close *= index % 2 ? 1.09 : 0.93;
    bars.push({
      close,
      date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      high: close * 1.012,
      low: close * 0.988,
      open: close * 0.995,
      volume: shock ? 3_500_000 : 1_000_000 + index * 1_000,
    });
  }
  return bars;
}

function row(symbol: string, seed: number): OpportunityViewModel {
  return {
    assetType: "Equity",
    companyName: `${symbol} Inc`,
    confidence: 72,
    dataFreshness: { label: "Fresh", status: "fresh" },
    decision: "Watch",
    decision_reason: "Validated scanner context.",
    entryStatus: "Watch",
    eventRisk: 20,
    final_decision: "WATCH",
    final_score: 68,
    fragility: 41,
    price: 118,
    raw: { final_score: 68, price: 118, setup_type: "PULLBACK", symbol },
    sector: "Technology",
    shockPattern: buildShockMovePattern({ bars: seed < 0 ? heavilyShockedBars() : barsWithShock(seed), lookbackWindow: "1y", symbol }),
    stop_loss: 110,
    suggested_entry: 116,
    symbol,
    target: 132,
  } as unknown as OpportunityViewModel;
}

const SYMBOLS = ["AMD", "NVDA", "MU", "INTC"];
const rows = SYMBOLS.map((symbol, index) => row(symbol, index));

describe("terminal actionability map", () => {
  test("the fixture carries the shock events the map is built from", () => {
    for (const candidate of rows) {
      assert.ok((candidate.shockPattern?.shockEvents?.length ?? 0) > 0, `${candidate.symbol} must have shock events`);
    }
  });

  // Assertion 2 from the migration plan: the rendered values do not change.
  test("a server card is byte-identical to what the client used to compute", () => {
    const map = buildTerminalActionabilityMap(rows);
    for (const candidate of rows) {
      const computed = buildOpportunityActionability(candidate);
      assert.deepEqual(map[candidate.symbol], {
        actionContext: computed.actionContext,
        earlyOrLate: computed.earlyOrLate,
        invalidationExplanation: computed.invalidationExplanation,
        primaryActionLabel: computed.primaryActionLabel,
        whatToWaitFor: computed.whatToWaitFor,
      });
    }
  });

  // The coverage guard. Both radars choose which symbols to show on the client
  // -- one sorts and slices, the other re-derives on every risk profile change
  // -- so a map that covered only the visible subset would silently fall back
  // to a degraded card for everything else once the array is stripped.
  test("the map covers every row, not the subset a panel happens to show", () => {
    const map = buildTerminalActionabilityMap(rows);
    assert.deepEqual(Object.keys(map).sort(), [...SYMBOLS].sort());
  });

  test("lookup is case-insensitive on the symbol", () => {
    const map = buildTerminalActionabilityMap(rows);
    const lowercased = { ...rows[0], symbol: "amd" } as OpportunityViewModel;
    assert.deepEqual(actionabilityCardFor(lowercased, map), map.AMD);
  });

  test("without a map the lookup still computes, which is what /opportunities relies on", () => {
    const card = actionabilityCardFor(rows[0]);
    const computed = buildOpportunityActionability(rows[0]);
    assert.equal(card.primaryActionLabel, computed.primaryActionLabel);
    assert.equal(card.whatToWaitFor, computed.whatToWaitFor);
  });

  test("a row missing from the map falls back rather than throwing", () => {
    const map = buildTerminalActionabilityMap([rows[0]]);
    const card = actionabilityCardFor(rows[1], map);
    assert.ok(card.primaryActionLabel.length > 0);
  });

  /**
   * This is not insurance. It is a repair -- but a narrower one than this test
   * originally claimed, and the correction matters.
   *
   * /terminal passes stripped rows straight to ShockMoveRadar and
   * RiskTolerantOpportunityRadar, which used to call
   * buildOpportunityActionability on the client. When the array is gone the
   * calibration sees no events, and some of the five rendered strings change.
   *
   * How often is the part I got wrong. The first version of this test asserted
   * the difference appears whenever a symbol has "real shock history", using a
   * PULLBACK/WATCH fixture. It did -- until fixing the success-rate unit bug
   * moved pullbackQuality by about six points and that fixture stopped
   * straddling the threshold it had been sitting on. The assertion then failed,
   * which is the correct outcome: it was pinning one fixture's accident as a
   * general law.
   *
   * Swept across 144 fixtures (shock counts 2-90, four seeds, three setups,
   * two decisions), stripping changes the card in **8**. All eight need the
   * event list at its 80-event cap AND a WAIT_PULLBACK decision on a
   * BREAKOUT or MOMENTUM setup. So the exposure is real and narrow, not
   * universal -- and narrow is exactly why it shipped unnoticed.
   *
   * The server map is what removes the exposure regardless of how narrow it
   * is, which is what the next test asserts.
   */
  test("stripped rows change the rendered guidance on the combination that exposes it", () => {
    const heavy = {
      ...row("AMD", 0),
      decision: "Wait for pullback",
      final_decision: "WAIT_PULLBACK",
      raw: { final_score: 68, price: 118, setup_type: "BREAKOUT", symbol: "AMD" },
      shockPattern: buildShockMovePattern({ bars: mixedShockBars(), lookbackWindow: "1y", symbol: "AMD" }),
    } as unknown as OpportunityViewModel;
    assert.equal(heavy.shockPattern?.shockEvents?.length, 80, "the exposure needs the event list at its cap");
    const stripped = stripShockEventsForClient([heavy])[0];
    assert.notDeepEqual(
      actionabilityCardFor(stripped),
      actionabilityCardFor(heavy),
      "if this ever passes, the client may compute actionability from stripped rows again",
    );
  });

  test("the server map gives a stripped row the text the unstripped row would have produced", () => {
    const heavy = row("AMD", -1);
    const stripped = stripShockEventsForClient([heavy])[0];
    const map = buildTerminalActionabilityMap([heavy]);
    assert.deepEqual(actionabilityCardFor(stripped, map), actionabilityCardFor(heavy));
  });

  // Why it stayed invisible: a thin history produces the same text either way.
  test("a thin shock history hides the difference, which is how this shipped unnoticed", () => {
    const light = row("NVDA", 1);
    const stripped = stripShockEventsForClient([light])[0];
    assert.deepEqual(actionabilityCardFor(stripped), actionabilityCardFor(light));
  });
});
