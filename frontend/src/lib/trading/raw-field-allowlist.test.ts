import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { CLIENT_READABLE_RAW_FIELDS, CLIENT_READABLE_RAW_FIELD_SET, PROVIDER_DEBUG_RAW_FIELDS, stripProviderDebugFields } from "./raw-field-allowlist";
import { stripRawFields, type OpportunityViewModel } from "./opportunity-view-model";

/**
 * The allowlist is a contract, not a snapshot.
 *
 * stripRawFields removes every raw field outside the allowlist before rows are
 * serialised to the browser. If someone adds a `row.raw.something_new` read to
 * code that runs on the client and does not add the field here, that field
 * arrives undefined in production and whatever it drove quietly degrades.
 *
 * So this test re-derives the inventory from source on every run -- walking the
 * import graph out of every "use client" module the same way the allowlist was
 * generated -- and fails if anything is missing.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const NON_FIELD_MEMBERS = new Set([
  "concat", "endsWith", "entries", "every", "filter", "find", "forEach", "includes",
  "indexOf", "join", "keys", "length", "map", "match", "push", "reduce", "replace",
  "slice", "some", "sort", "split", "startsWith", "toLowerCase", "toString",
  "toUpperCase", "trim", "values",
]);

const VALUE_IMPORT = /^\s*import\s+(?!type\s)(?:([^;]*?)\s+from\s+)?["']([^"']+)["'];?/gm;
const DOT_ACCESS = /\braw\??\.([A-Za-z_][A-Za-z0-9_]*)/g;
const INDEX_ACCESS = /\braw\??\[\s*["']([^"']+)["']\s*\]/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

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

function valueImports(path: string): string[] {
  const text = read(path);
  const out: string[] = [];
  for (const [, names, specifier] of text.matchAll(VALUE_IMPORT)) {
    const clause = (names ?? "").trim();
    // `import type { A, B }` is erased; so is `import { type A, type B }`.
    if (clause.startsWith("{") && clause.slice(1, -1).split(",").filter((part) => part.trim()).every((part) => part.trim().startsWith("type "))) continue;
    const resolved = resolveImport(specifier, path);
    if (resolved) out.push(resolved);
  }
  return out;
}

function clientReachableModules(): string[] {
  const all = sourceFiles(SRC);
  const roots = all.filter((path) => read(path).trimStart().startsWith('"use client"'));
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const next = stack.pop();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    stack.push(...valueImports(next));
  }
  return [...seen];
}

function rawFieldReads(paths: string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of paths) {
    const text = read(path);
    if (!text.includes(".raw") && !text.includes("raw[")) continue;
    const keys = new Set<string>();
    for (const [, key] of text.matchAll(DOT_ACCESS)) keys.add(key);
    for (const [, key] of text.matchAll(INDEX_ACCESS)) keys.add(key);
    for (const key of keys) {
      if (NON_FIELD_MEMBERS.has(key)) continue;
      found.set(key, [...(found.get(key) ?? []), path.replace(`${SRC}/`, "")]);
    }
  }
  return found;
}

const reachable = clientReachableModules();
const reads = rawFieldReads(reachable);

describe("raw field allowlist", () => {
  test("the inventory is derived from a real graph, not an empty one", () => {
    assert.ok(reachable.length > 100, `expected a large client graph, walked ${reachable.length} modules`);
    assert.ok(reads.size > 50, `expected many raw reads, found ${reads.size}`);
  });

  // The guard. A new client-side raw read without an allowlist entry fails here.
  test("every raw field the client reads is on the allowlist", () => {
    const missing = [...reads.entries()]
      .filter(([key]) => !CLIENT_READABLE_RAW_FIELD_SET.has(key))
      .map(([key, files]) => `${key}  (read in ${files.slice(0, 2).join(", ")})`);
    assert.deepEqual(
      missing,
      [],
      `these raw fields are read by client-reachable code but would be stripped before it sees them:\n  ${missing.join("\n  ")}\n` +
        "Add them to CLIENT_READABLE_RAW_FIELDS.",
    );
  });

  test("the allowlist has no duplicates and stays sorted", () => {
    assert.equal(new Set(CLIENT_READABLE_RAW_FIELDS).size, CLIENT_READABLE_RAW_FIELDS.length);
    assert.deepEqual([...CLIENT_READABLE_RAW_FIELDS], [...CLIENT_READABLE_RAW_FIELDS].sort());
  });

  // Reporting only: carrying a field nobody reads yet is wasteful but harmless,
  // and can be legitimate while a feature is being built.
  test("reports allowlist entries no client code reads any more", () => {
    const unread = CLIENT_READABLE_RAW_FIELDS.filter((key) => !reads.has(key));
    if (unread.length) console.log(`[raw allowlist] ${unread.length} entries no longer read on the client: ${unread.join(", ")}`);
    assert.ok(true);
  });
});

describe("stripRawFields", () => {
  const row = {
    raw: {
      alpaca_request_id: "aaaa,bbbb,cccc",
      final_score: 68,
      price: 118,
      provider_error: "rate limited",
      provider_latency_ms: 412,
      data_provider_primary: "yfinance",
      symbol: "AMD",
      verified_event_recent_events: [{ source_url: "https://example.test", title: "x" }],
    },
    symbol: "AMD",
  } as unknown as OpportunityViewModel;

  test("keeps what the client reads", () => {
    const [stripped] = stripRawFields([row]);
    for (const key of ["final_score", "price"]) {
      assert.equal((stripped.raw as Record<string, unknown>)[key], (row.raw as Record<string, unknown>)[key], `${key} must survive`);
    }
  });

  test("drops raw.symbol, because the client reads row.symbol instead", () => {
    // Worth pinning: this looks like an identity field that must survive, but
    // no client-reachable module reads it off raw -- the view model carries
    // symbol at the top level. The allowlist is derived, so it reflects that.
    assert.equal(CLIENT_READABLE_RAW_FIELD_SET.has("symbol"), false);
    const [stripped] = stripRawFields([row]);
    assert.equal("symbol" in (stripped.raw as Record<string, unknown>), false);
    assert.equal(stripped.symbol, "AMD", "the row's own symbol is untouched");
  });

  test("drops provider plumbing and the unread event blob", () => {
    const [stripped] = stripRawFields([row]);
    for (const key of ["alpaca_request_id", "provider_error", "provider_latency_ms", "data_provider_primary", "verified_event_recent_events"]) {
      assert.equal(key in (stripped.raw as Record<string, unknown>), false, `${key} must not reach the client`);
    }
  });

  test("leaves every other part of the row alone and does not mutate the input", () => {
    const before = JSON.stringify(row);
    const [stripped] = stripRawFields([row]);
    assert.equal(JSON.stringify(row), before, "the source row must not be mutated");
    const { raw: _strippedRaw, ...strippedRest } = stripped;
    const { raw: _originalRaw, ...originalRest } = row;
    assert.deepEqual(strippedRest, originalRest);
  });

  test("passes through a row with no raw record", () => {
    const bare = { symbol: "NVDA" } as unknown as OpportunityViewModel;
    assert.deepEqual(stripRawFields([bare]), [bare]);
  });
});

describe("stripProviderDebugFields", () => {
  const scannerRow = {
    alpaca_request_id: "aaaa,bbbb",
    data_provider_primary: "yfinance",
    data_timestamp: "2026-09-02T00:00:00Z",
    final_score: 71,
    price: 118,
    provider_error: "rate limited",
    provider_latency_ms: 412,
    symbol: "AMD",
    verified_event_recent_events: [{ source_url: "https://example.test" }],
  } as Record<string, unknown>;

  test("removes every provider field and keeps the rest", () => {
    const stripped = stripProviderDebugFields(scannerRow);
    for (const field of PROVIDER_DEBUG_RAW_FIELDS) {
      assert.equal(field in stripped, false, `${field} must not reach the client`);
    }
    assert.equal(stripped.symbol, "AMD");
    assert.equal(stripped.final_score, 71);
    assert.equal(stripped.price, 118);
  });

  test("does not mutate the row the server still uses", () => {
    const before = JSON.stringify(scannerRow);
    stripProviderDebugFields(scannerRow);
    assert.equal(JSON.stringify(scannerRow), before);
  });

  test("returns the same object when there is nothing to remove", () => {
    const clean = { price: 1, symbol: "NVDA" } as Record<string, unknown>;
    assert.equal(stripProviderDebugFields(clean), clean);
    assert.equal(stripProviderDebugFields(null), null);
  });

  test("no provider field is also on the client allowlist", () => {
    const overlap = PROVIDER_DEBUG_RAW_FIELDS.filter((field) => CLIENT_READABLE_RAW_FIELD_SET.has(field));
    assert.deepEqual(overlap, [], "a field cannot be both required by the client and provider-only");
  });
});
