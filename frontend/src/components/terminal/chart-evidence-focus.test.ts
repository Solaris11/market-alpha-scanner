import assert from "node:assert/strict";
import { test } from "node:test";
import { EVIDENCE_DIMENSIONS, evidenceFocusPlan } from "./chart-evidence-focus";

test("every dimension has a plan with a caption", () => {
  for (const dim of EVIDENCE_DIMENSIONS) {
    const plan = evidenceFocusPlan(dim);
    assert.ok(plan.caption.length > 0, `${dim} needs a caption`);
    assert.equal(typeof plan.volume, "boolean");
    assert.equal(typeof plan.evidence, "boolean");
    assert.ok(Array.isArray(plan.indicators));
  }
});

test("volume focus shows volume and nothing else", () => {
  const p = evidenceFocusPlan("volume");
  assert.equal(p.volume, true);
  assert.equal(p.evidence, false);
  assert.deepEqual(p.indicators, []);
});

test("trend and structure focus the persisted evidence overlay", () => {
  assert.equal(evidenceFocusPlan("trend").evidence, true);
  assert.equal(evidenceFocusPlan("structure").evidence, true);
  assert.equal(evidenceFocusPlan("trend").volume, false);
});

test("momentum focus turns on RSI and MACD, not the level overlays", () => {
  const p = evidenceFocusPlan("momentum");
  assert.equal(p.volume, false);
  assert.equal(p.evidence, false);
  assert.deepEqual(p.indicators, ["rsi14", "macd"]);
});
