import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChartAlertRulePayload } from "@/components/terminal/chart-workflow-alerts";

describe("chart professional alert workflow", () => {
  it("builds a stable server-evaluated price alert payload from chart context", () => {
    const payload = buildChartAlertRulePayload({
      idSuffix: "phase-23-5 manual",
      request: {
        riskReason: "User drew a price level from chart context.",
        sourceReason: "Created from /symbol/AMD chart price context.",
        threshold: 250.123456,
        type: "price_above",
      },
      symbol: " amd ",
    });

    assert.equal(payload.id, "chart_amd_price_above_phase_23_5_manual");
    assert.equal(payload.symbol, "AMD");
    assert.equal(payload.type, "price_above");
    assert.equal(payload.threshold, 250.1235);
    assert.deepEqual(payload.channels, ["telegram"]);
    assert.equal(payload.scope, "symbol");
    assert.equal(payload.source, "user");
  });

  it("clamps score alert thresholds to the server-supported scanner score range", () => {
    const high = buildChartAlertRulePayload({
      idSuffix: "high",
      request: {
        riskReason: "Scanner score condition.",
        sourceReason: "Created from /symbol/NVDA chart score context.",
        threshold: 104.7,
        type: "score_above",
      },
      symbol: "NVDA",
    });
    const low = buildChartAlertRulePayload({
      idSuffix: "low",
      request: {
        riskReason: "Scanner score condition.",
        sourceReason: "Created from /symbol/NVDA chart score context.",
        threshold: -8,
        type: "score_below",
      },
      symbol: "NVDA",
    });

    assert.equal(high.threshold, 100);
    assert.equal(low.threshold, 0);
  });

  it("redacts unsupported markup from drawing alert source text", () => {
    const payload = buildChartAlertRulePayload({
      idSuffix: "drawing-alert",
      request: {
        riskReason: "Horizontal drawing <script> level is user research context.",
        sourceReason: "Created from selected drawing <b>Breakout</b>.",
        threshold: 99.5,
        type: "price_below",
      },
      symbol: "$bad symbol!",
    });

    assert.equal(payload.symbol, "BADSYMBOL");
    assert.equal(payload.risk_reason.includes("<"), false);
    assert.equal(payload.source_reason.includes(">"), false);
    assert.equal(payload.type, "price_below");
  });

  it("rejects non-finite thresholds instead of creating fake alert state", () => {
    assert.throws(() => buildChartAlertRulePayload({
      request: {
        riskReason: "Invalid threshold.",
        sourceReason: "Invalid threshold.",
        threshold: Number.NaN,
        type: "price_above",
      },
      symbol: "AMD",
    }), /finite/);
  });
});
