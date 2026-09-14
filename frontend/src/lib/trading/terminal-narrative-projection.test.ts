import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import type { NarrativeIntelligence } from "./narrative-intelligence";
import { TERMINAL_NARRATIVE_FIELDS, stripNarrativeForTerminal, type OpportunityViewModel } from "./opportunity-view-model";

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

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TERMINAL_VIEW = join(SRC, "components", "terminal", "TerminalPremiumView.tsx");

const NON_FIELD_MEMBERS = new Set([
  "concat", "endsWith", "entries", "every", "filter", "find", "forEach", "includes", "indexOf", "join", "keys",
  "length", "map", "match", "push", "reduce", "replace", "slice", "some", "sort", "split", "startsWith",
  "toLowerCase", "toString", "toUpperCase", "trim", "values",
]);
const VALUE_IMPORT = /^\s*import\s+(?!type\s)(?:([^;]*?)\s+from\s+)?["']([^"']+)["'];?/gm;
const NARRATIVE_ACCESS = /\bnarrative\??\.([A-Za-z_][A-Za-z0-9_]*)/g;

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function resolveImport(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;
  for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const candidate = `${base}${suffix}`;
    try {
      statSync(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function valueImports(path: string): Map<string, string> {
  const text = read(path);
  const out = new Map<string, string>();
  for (const [, names, specifier] of text.matchAll(VALUE_IMPORT)) {
    const clause = (names ?? "").trim();
    if (clause.startsWith("{") && clause.slice(1, -1).split(",").filter((part) => part.trim()).every((part) => part.trim().startsWith("type "))) continue;
    const resolved = resolveImport(specifier, path);
    if (resolved) out.set(clause, resolved);
  }
  return out;
}

/** Components rendered by TerminalPremiumView with `rows={clientRows}`. */
function terminalRowConsumers(): string[] {
  const view = read(TERMINAL_VIEW);
  const names = new Set<string>();
  for (const [, name] of view.matchAll(/<([A-Z][A-Za-z0-9]*)\b[^>]*?\brows=\{clientRows\}/g)) names.add(name);
  const roots: string[] = [];
  for (const [clause, path] of valueImports(TERMINAL_VIEW)) {
    for (const name of names) {
      if (new RegExp(`\\b${name}\\b`).test(clause)) roots.push(path);
    }
  }
  return [...new Set(roots)];
}

function reachable(roots: string[]): string[] {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const next = stack.pop();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    stack.push(...valueImports(next).values());
  }
  return [...seen];
}

function narrativeReads(paths: string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of paths) {
    const text = read(path);
    if (!text.includes("narrative")) continue;
    for (const [, key] of text.matchAll(NARRATIVE_ACCESS)) {
      if (NON_FIELD_MEMBERS.has(key)) continue;
      found.set(key, [...(found.get(key) ?? []), path.replace(`${SRC}/`, "")]);
    }
  }
  return found;
}

const roots = terminalRowConsumers();
const graph = reachable(roots);
const reads = narrativeReads(graph);
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
