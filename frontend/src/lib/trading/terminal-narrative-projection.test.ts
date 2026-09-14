import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NarrativeIntelligence } from "./narrative-intelligence";
import { TERMINAL_NARRATIVE_FIELDS, stripNarrativeForTerminal, type OpportunityViewModel } from "./opportunity-view-model";
import { fieldReads, reachable, terminalRowConsumers } from "./terminal-client-graph.test-helper";

/**
 * Same contract as raw-field-allowlist.test.ts, scoped to /terminal.
 *
 * stripNarrativeForTerminal keeps only TERMINAL_NARRATIVE_FIELDS on the rows
 * TerminalPremiumView hands to client components. The roots of the walk are
 * derived from TerminalPremiumView itself -- every component that receives
 * `rows={clientRows}` -- so adding a new row consumer, or a new
 * `narrative.something` read anywhere it can reach, fails here instead of
 * arriving undefined in production.
 */

const roots = terminalRowConsumers();
const graph = reachable(roots);
const reads = fieldReads(graph, ["narrative"]).fields;
const KEPT = new Set<string>(TERMINAL_NARRATIVE_FIELDS);

describe("terminal narrative projection", () => {
  test("the walk starts from real row consumers and reaches a real graph", () => {
    assert.ok(roots.length >= 5, `expected the terminal row consumers, found ${roots.length}: ${roots.join(", ")}`);
    assert.ok(graph.length > 30, `expected a sizeable client graph, walked ${graph.length} modules`);
    assert.ok(reads.size >= 3, `expected narrative reads in the graph, found ${[...reads.keys()].join(", ")}`);
  });

  test("every narrative field a terminal row consumer reads survives the projection", () => {
    const missing = [...reads.entries()].filter(([key]) => !KEPT.has(key)).map(([key, files]) => `${key}  (read in ${[...new Set(files)].slice(0, 2).join(", ")})`);
    assert.deepEqual(missing, [], `these narrative fields are read on /terminal but stripped:\n  ${missing.join("\n  ")}\nAdd them to TERMINAL_NARRATIVE_FIELDS.`);
  });

  test("the projection keeps the kept fields verbatim, drops the rest, and leaves null narratives alone", () => {
    const narrative = {
      bearishNarrative: "bear",
      bullishNarrative: "bull",
      generatedAt: "2026-09-14T00:00:00.000Z",
      moderatorSummary: "mod",
      narrativeDrift: { deteriorationScore: 12, label: "stable", momentumScore: 55 },
      narrativeSummary: "sum",
      pressureStory: "pressure",
      source: "deterministic",
      symbol: "AMD",
      unsupportedClaimsDetected: false,
      whatToWatch: ["a", "b"],
    } as unknown as NarrativeIntelligence;
    const rows = [
      { symbol: "AMD", narrative } as unknown as OpportunityViewModel,
      { symbol: "NVDA", narrative: null } as unknown as OpportunityViewModel,
    ];
    const [amd, nvda] = stripNarrativeForTerminal(rows);
    const kept = amd.narrative as unknown as Record<string, unknown>;
    assert.deepEqual(Object.keys(kept).sort(), [...TERMINAL_NARRATIVE_FIELDS].sort());
    assert.equal(kept.moderatorSummary, "mod");
    assert.deepEqual(kept.narrativeDrift, narrative.narrativeDrift);
    assert.equal("bullishNarrative" in kept, false);
    assert.equal(nvda.narrative, null);
    assert.equal(rows[0].narrative, narrative, "the input row is not mutated");
  });

  test("the kept list has no duplicates and stays sorted", () => {
    assert.equal(new Set(TERMINAL_NARRATIVE_FIELDS).size, TERMINAL_NARRATIVE_FIELDS.length);
    assert.deepEqual([...TERMINAL_NARRATIVE_FIELDS], [...TERMINAL_NARRATIVE_FIELDS].sort());
  });
});
