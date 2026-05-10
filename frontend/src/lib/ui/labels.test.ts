import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decisionLabel, humanizeInsightText, humanizeLabel, humanizeQuantText, normalizedToken, readableText } from "./labels";

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
    assert.equal(decisionLabel("AVOID"), "Risk Review");
    assert.equal(decisionLabel("WAIT_PULLBACK"), "Wait for Pullback");
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

  it("simplifies intelligence language without changing safety meaning", () => {
    assert.equal(
      humanizeInsightText("shock-pattern support visible with macro pressure and deterministic packet context"),
      "historically similar setups produced strong upside moves with market pressure and latest TradeVeto data context",
    );
    assert.equal(
      humanizeInsightText("Risk remains probabilistic; this is not a core buy signal."),
      "risk still has uncertainty; this is not a main TradeVeto signal.",
    );
    assert.equal(
      humanizeInsightText("System decision blocks new aggressive entries because the market is overheated."),
      "TradeVeto is keeping this in research mode until conditions improve because the market is extended.",
    );
    assert.equal(
      humanizeInsightText("Upside shock score improved, but chase risk and invalidation context are still elevated."),
      "large upside move score improved, but risk of entering late and what would break the setup are still elevated.",
    );
    assert.equal(
      humanizeInsightText("Asymmetric opportunity depends on volatility compression breakout and source confidence."),
      "favorable upside/downside setup depends on quiet-to-active breakout and source strength.",
    );
  });
});
