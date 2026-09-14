import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TERMINAL_SHOCK_PATTERN_FIELDS,
  TERMINAL_TIMING_VALIDATION_FIELDS,
  stripShockEventsForClient,
  stripShockPatternForTerminal,
  type OpportunityViewModel,
} from "./opportunity-view-model";
import { fieldReads, reachable, terminalRowConsumers } from "./terminal-client-graph.test-helper";

/**
 * Same contract as terminal-narrative-projection.test.ts, for shockPattern.
 * The consumers read it as `row.shockPattern`, `shock` and `pattern`, so all
 * three receivers are walked; anything read that is not kept fails here.
 */

const roots = terminalRowConsumers();
const graph = reachable(roots);
const { fields, subFields } = fieldReads(graph, ["shockPattern", "shock", "pattern"]);
const KEPT = new Set<string>(TERMINAL_SHOCK_PATTERN_FIELDS);
const KEPT_TIMING = new Set<string>(TERMINAL_TIMING_VALIDATION_FIELDS);
// Dropped on purpose by stripShockEventsForClient; the server-side execution
// path is the only reader and it runs before the strip.
const ALREADY_STRIPPED = new Set(["shockEvents"]);

describe("terminal shock pattern projection", () => {
  test("the walk reaches the row consumers and finds shock pattern reads", () => {
    assert.ok(roots.length >= 5, `expected the terminal row consumers, found ${roots.length}`);
    assert.ok(fields.size >= 10, `expected many shock pattern reads, found ${[...fields.keys()].join(", ")}`);
  });

  test("every shock pattern field a terminal row consumer reads survives the projection", () => {
    const missing = [...fields.entries()]
      .filter(([key]) => !KEPT.has(key) && !ALREADY_STRIPPED.has(key))
      .map(([key, files]) => `${key}  (read in ${[...new Set(files)].slice(0, 2).join(", ")})`);
    assert.deepEqual(missing, [], `these shock pattern fields are read on /terminal but stripped:\n  ${missing.join("\n  ")}\nAdd them to TERMINAL_SHOCK_PATTERN_FIELDS.`);
  });

  test("every timingValidation sub-field read survives the projection", () => {
    const wanted = [...(subFields.get("timingValidation") ?? [])];
    const missing = wanted.filter((key) => !KEPT_TIMING.has(key));
    assert.ok(wanted.length >= 2, `expected timingValidation sub-reads, found ${wanted.join(", ")}`);
    assert.deepEqual(missing, [], `timingValidation fields read on /terminal but stripped: ${missing.join(", ")}`);
  });

  test("the projection keeps kept fields verbatim, projects timingValidation, and leaves null patterns alone", () => {
    const pattern = {
      asymmetryScore: 61,
      averageFollowthrough5d: 1.2,
      chaseRiskScore: 40,
      commonFailureConditions: ["gap fade"],
      latestEvent: { eventDate: "2026-09-10", return1d: -8.1 },
      lookbackWindow: { bars: 500 },
      opportunityScore: 70,
      opportunityState: "monitor",
      shockEventCount: 12,
      shockEvents: [{ eventDate: "2026-09-10", preconditions: { rsi: 71 } }],
      timingValidation: { entryQualityScore: 66, replayStudies: [{ id: 1 }], summary: "42/100 timing proof", timingQualityScore: 42, validationSampleSize: 23 },
      upsideShockScore: 55,
    } as unknown as NonNullable<OpportunityViewModel["shockPattern"]>;
    const rows = [
      { symbol: "AMD", shockPattern: pattern } as unknown as OpportunityViewModel,
      { symbol: "NVDA", shockPattern: null } as unknown as OpportunityViewModel,
    ];
    const [amd, nvda] = stripShockPatternForTerminal(stripShockEventsForClient(rows));
    const kept = amd.shockPattern as unknown as Record<string, unknown>;
    assert.equal("commonFailureConditions" in kept, false);
    assert.equal("lookbackWindow" in kept, false);
    assert.equal("shockEvents" in kept, false);
    assert.equal(kept.asymmetryScore, 61);
    assert.equal(kept.shockEventCount, 12);
    assert.deepEqual(kept.latestEvent, { eventDate: "2026-09-10", return1d: -8.1 });
    assert.deepEqual(kept.timingValidation, { entryQualityScore: 66, summary: "42/100 timing proof", timingQualityScore: 42, validationSampleSize: 23 });
    assert.ok(Object.keys(kept).every((key) => KEPT.has(key)));
    assert.equal(nvda.shockPattern, null);
    assert.equal(rows[0].shockPattern, pattern, "the input row is not mutated");
  });

  test("the kept lists have no duplicates and stay sorted", () => {
    for (const list of [TERMINAL_SHOCK_PATTERN_FIELDS, TERMINAL_TIMING_VALIDATION_FIELDS]) {
      assert.equal(new Set(list).size, list.length);
      assert.deepEqual([...list], [...list].sort());
    }
  });
});
