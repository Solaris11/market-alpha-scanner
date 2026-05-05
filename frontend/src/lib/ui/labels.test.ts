import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decisionLabel, humanizeLabel, normalizedToken } from "./labels";

describe("UI label formatting", () => {
  it("renders machine case labels as human-readable copy", () => {
    assert.equal(humanizeLabel("WAIT_PULLBACK"), "Wait Pullback");
    assert.equal(humanizeLabel("RISK_OFF"), "Risk Off");
    assert.equal(humanizeLabel("LOW_CONFIDENCE_DATA"), "Low Confidence Data");
    assert.equal(humanizeLabel("HIGH_CONFIDENCE"), "High Confidence");
    assert.equal(humanizeLabel("BUY_ZONE_HIT"), "Entry Zone Hit");
    assert.equal(humanizeLabel("TAKE_PROFIT_HIT"), "Target Context Hit");
  });

  it("uses final decision labels that do not expose conflicting internal BUY labels", () => {
    assert.equal(decisionLabel("AVOID"), "Avoid");
    assert.equal(decisionLabel("WAIT_PULLBACK"), "Wait Pullback");
    assert.equal(decisionLabel("ENTER"), "Research Setup");
    assert.equal(decisionLabel("BUY"), "Research Setup");
    assert.equal(humanizeLabel("BUY_ZONE"), "Entry Zone");
  });

  it("normalizes tokens without changing internal enum compatibility", () => {
    assert.equal(normalizedToken("wait pullback"), "WAIT_PULLBACK");
    assert.equal(normalizedToken("risk-off"), "RISK_OFF");
  });
});
