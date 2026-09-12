import assert from "node:assert/strict";
import { test } from "node:test";
import type { RankingRow } from "@/lib/types";
import { buildSignalEvidenceLevels } from "./signal-lifecycle";

const base = (over: Partial<RankingRow>): RankingRow => ({ symbol: "AAA", ...over }) as RankingRow;

test("extracts persisted AVWAP/SuperTrend evidence levels", () => {
  const e = buildSignalEvidenceLevels(base({ avwap_ytd: 100, avwap_swing: 110, supertrend_line: 95 }));
  assert.equal(e.avwapYtd, 100);
  assert.equal(e.avwapSwing, 110);
  assert.equal(e.supertrend, 95);
});

test("avwapYtd falls back to the generic avwap field when avwap_ytd is absent", () => {
  const e = buildSignalEvidenceLevels(base({ avwap: 123 }));
  assert.equal(e.avwapYtd, 123);
  assert.equal(e.avwapSwing, null);
  assert.equal(e.supertrend, null);
});

test("returns null for missing/unparseable evidence, so nothing draws", () => {
  const e = buildSignalEvidenceLevels(base({}));
  assert.equal(e.avwapYtd, null);
  assert.equal(e.avwapSwing, null);
  assert.equal(e.supertrend, null);
});

test("coerces string-numeric payload values (index-signature fields)", () => {
  const e = buildSignalEvidenceLevels(base({ avwap_swing: "108.5", supertrend_line: "99.25" }));
  assert.equal(e.avwapSwing, 108.5);
  assert.equal(e.supertrend, 99.25);
});
