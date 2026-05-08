import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app", "globals.css");

describe("global text wrapping policy", () => {
  test("does not allow action labels to split inside words", () => {
    const css = readFileSync(cssPath, "utf8");
    assert.match(css, /:where\(a, button, input, select, span\)\s*{[\s\S]*?overflow-wrap:\s*normal;[\s\S]*?word-break:\s*normal;/);
    assert.doesNotMatch(css, /:where\([^)]*\bbutton\b[^)]*\)\s*{[\s\S]*?overflow-wrap:\s*anywhere;/);
    assert.doesNotMatch(css, /:where\([^)]*\ba\b[^)]*\)\s*{[\s\S]*?overflow-wrap:\s*anywhere;/);
  });
});
