import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test-only. The client-reachable module graph of /terminal's row consumers:
 * every component TerminalPremiumView renders with `rows={clientRows}`, plus
 * everything they value-import, transitively. The projection tests
 * (terminal-*-projection.test.ts) walk this graph so that a new row consumer,
 * or a new field read anywhere it can reach, fails a test instead of arriving
 * undefined in production. Same approach as raw-field-allowlist.test.ts,
 * scoped to one page.
 */

export const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TERMINAL_VIEW = join(SRC, "components", "terminal", "TerminalPremiumView.tsx");

export const NON_FIELD_MEMBERS = new Set([
  "concat", "endsWith", "entries", "every", "exec", "filter", "find", "flags", "forEach", "includes", "indexOf",
  "join", "keys", "lastIndex", "length", "map", "match", "push", "reduce", "replace", "slice", "some", "sort",
  "source", "split", "startsWith", "test", "toLowerCase", "toString", "toUpperCase", "trim", "values",
]);

const VALUE_IMPORT = /^\s*import\s+(?!type\s)(?:([^;]*?)\s+from\s+)?["']([^"']+)["'];?/gm;

export function read(path: string): string {
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

export function valueImports(path: string): Map<string, string> {
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
export function terminalRowConsumers(): string[] {
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

export function reachable(roots: string[]): string[] {
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

/**
 * Every `<receiver>?.field` (and `<receiver>?.field?.sub`) read in the graph,
 * keyed by field, with the files that read it. `receivers` are the variable
 * names the object travels under (e.g. shockPattern and its aliases).
 */
export function fieldReads(paths: string[], receivers: string[]): { fields: Map<string, string[]>; subFields: Map<string, Set<string>> } {
  const access = new RegExp(`\\b(?:${receivers.join("|")})\\??\\.([A-Za-z_][A-Za-z0-9_]*)(?:\\??\\.([A-Za-z_][A-Za-z0-9_]*))?`, "g");
  const fields = new Map<string, string[]>();
  const subFields = new Map<string, Set<string>>();
  for (const path of paths) {
    const text = read(path);
    for (const [, key, sub] of text.matchAll(access)) {
      if (NON_FIELD_MEMBERS.has(key)) continue;
      fields.set(key, [...(fields.get(key) ?? []), path.replace(`${SRC}/`, "")]);
      if (sub && !NON_FIELD_MEMBERS.has(sub)) subFields.set(key, new Set([...(subFields.get(key) ?? []), sub]));
    }
  }
  return { fields, subFields };
}
