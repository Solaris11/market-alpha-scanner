import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decisionLabel, humanizeLabel, humanizeQuantText, normalizedToken, readableText } from "./labels";

describe("UI label formatting", () => {
  it("renders machine case labels as human-readable copy", () => {
    assert.equal(humanizeLabel("WAIT_PULLBACK"), "Wait Pullback");
    assert.equal(humanizeLabel("RISK_OFF"), "Risk Off");
    assert.equal(humanizeLabel("LOW_CONFIDENCE_DATA"), "Low Confidence Data");
    assert.equal(humanizeLabel("HIGH_CONFIDENCE"), "High Confidence");
    assert.equal(humanizeLabel("NO_TRADE"), "No Trade");
    assert.equal(humanizeLabel("BOND_PROXY"), "Bond Proxy");
    assert.equal(humanizeLabel("COMMODITY_PROXY"), "Commodity Proxy");
    assert.equal(humanizeLabel("CRYPTO_PROXY"), "Crypto Proxy");
    assert.equal(humanizeLabel("FX_PROXY"), "FX Proxy");
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

  it("replaces embedded diagnostic codes in user-facing prose", () => {
    assert.equal(readableText("Entry blocked by veto: OVERHEATED_MARKET"), "Entry blocked by veto: Overheated Market");
    assert.equal(readableText("LOW_CONFIDENCE_DATA requires confirmation"), "Low Confidence Data requires confirmation");
  });

  it("humanizes calibration jargon for simple mode", () => {
    assert.equal(
      humanizeQuantText("80+ score bucket underperforms 70-79 with low sample size and weak edge"),
      "80+ score range is weaker than expected 70-79 with early/low evidence and weak historical advantage",
    );
    assert.equal(humanizeQuantText("expectancy is mixed for score_bucket"), "expected historical return is mixed for Score Range");
    assert.equal(humanizeQuantText("sectorOn 5D has low sample size"), "Sector on 5D has early/low evidence");
  });
});
