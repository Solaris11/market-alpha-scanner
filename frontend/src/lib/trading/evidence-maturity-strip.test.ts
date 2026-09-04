import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildEvidenceMaturityFromSignal } from "./evidence-maturity";
import { buildShockMovePattern, type ShockMovePriceBar } from "./shock-move";
import { stripShockEventsForClient } from "./opportunity-view-model";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { RankingRow } from "@/lib/types";

/**
 * Stage 3 drops shockEvents from the /terminal payload. The actionability
 * regression happened because a client component recomputed from rows that had
 * lost an input; evidence maturity reads the same array in three more places,
 * from three client components on the same page (SymbolDecisionHero,
 * TerminalRightRail, EvidenceMaturityCard).
 *
 * These are the assertions that say whether the card shows the same numbers
 * with the array and without it.
 */

function bars(seed: number): ShockMovePriceBar[] {
  const out: ShockMovePriceBar[] = [];
  let close = 100 + seed;
  for (let i = 0; i < 200; i += 1) {
    close += i % 7 === 0 ? 0.4 : 0.05;
    if (i % 23 === 0) close *= 1.09;
    if (i % 37 === 0) close *= 0.93;
    out.push({
      close,
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
      high: close * 1.02,
      low: close * 0.98,
      open: close * 0.995,
      volume: i % 23 === 0 || i % 37 === 0 ? 4_000_000 : 1_000_000 + i * 900,
    });
  }
  return out;
}

// A row with no explicit sample or depth columns, so the shock pattern is what
// the model has to fall back on. That is the case the strip actually changes.
const bareRow = { price: 120, symbol: "AMD" } as unknown as RankingRow;

function patternFor(symbol: string) {
  const pattern = buildShockMovePattern({ bars: bars(3), lookbackWindow: "1y", symbol });
  assert.ok(pattern, "fixture must produce a pattern");
  assert.ok((pattern.shockEvents?.length ?? 0) > 0, "fixture must produce shock events");
  return pattern;
}

function strippedPatternFor(symbol: string) {
  const pattern = patternFor(symbol);
  const rows = [{ raw: {}, shockPattern: pattern, symbol }] as unknown as OpportunityViewModel[];
  const stripped = stripShockEventsForClient(rows);
  const out = stripped[0]?.shockPattern;
  assert.ok(out, "stripping must keep the pattern itself");
  assert.equal(out.shockEvents, undefined, "the array is what Stage 3 drops");
  return out;
}

describe("evidence maturity across the Stage 3 strip", () => {
  test("the count survives, because it travels in its own field", () => {
    assert.equal(strippedPatternFor("AMD").shockEventCount, patternFor("AMD").shockEventCount);
  });

  test("every rendered evidence number is the same with and without the array", () => {
    const full = buildEvidenceMaturityFromSignal(bareRow, { shockPattern: patternFor("AMD") });
    const stripped = buildEvidenceMaturityFromSignal(bareRow, { shockPattern: strippedPatternFor("AMD") });
    assert.deepEqual(stripped, full);
  });

  test("the sample size does not silently fall to the two shock counters alone", () => {
    const pattern = patternFor("AMD");
    const full = buildEvidenceMaturityFromSignal(bareRow, { shockPattern: pattern });
    const stripped = buildEvidenceMaturityFromSignal(bareRow, { shockPattern: strippedPatternFor("AMD") });
    assert.equal(
      stripped.evidenceSampleSize,
      full.evidenceSampleSize,
      `stripping must not change the sample size (${full.evidenceSampleSize} -> ${stripped.evidenceSampleSize})`,
    );
  });
});
