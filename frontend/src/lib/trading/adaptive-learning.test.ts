import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdaptiveLearningSystem,
  calibrationGroupsFromForwardRows,
  type AdaptiveCalibrationRow,
} from "./adaptive-learning";

function calibrationRow(overrides: Partial<AdaptiveCalibrationRow>): AdaptiveCalibrationRow {
  return {
    avgDrawdownPct: -3,
    avgLossPct: 2,
    avgReturnPct: 1,
    avgWinPct: 3,
    count: 120,
    expectancyPct: 1,
    groupType: "setup_type",
    groupValue: "PULLBACK",
    horizon: "5D",
    lowConfidence: false,
    medianReturnPct: 0.8,
    sampleSize: "HIGH",
    winRatePct: 56,
    worstReturnPct: -8,
    ...overrides,
  };
}

test("adaptive learning detects confidence calibration drift without auto-tuning", () => {
  const system = buildAdaptiveLearningSystem({
    calibrationGroups: {
      decision: [
        calibrationRow({ expectancyPct: -0.9, groupType: "decision", groupValue: "ENTER" }),
        calibrationRow({ expectancyPct: -0.2, groupType: "decision", groupValue: "WAIT", worstReturnPct: -11 }),
      ],
      score_bucket: [
        calibrationRow({ expectancyPct: 2.2, groupType: "score_bucket", groupValue: "60-69" }),
        calibrationRow({ expectancyPct: 1.8, groupType: "score_bucket", groupValue: "70-79" }),
        calibrationRow({ expectancyPct: -0.6, groupType: "score_bucket", groupValue: "80-89" }),
        calibrationRow({ expectancyPct: -1.1, groupType: "score_bucket", groupValue: "90-100" }),
      ],
      setup_type: [
        calibrationRow({ expectancyPct: 2.4, groupType: "setup_type", groupValue: "PULLBACK_CONTINUATION" }),
        calibrationRow({ expectancyPct: -1.2, groupType: "setup_type", groupValue: "EXTENDED_BREAKOUT" }),
      ],
    },
    generatedAt: "2026-05-09T00:00:00.000Z",
    observationCount: 640,
  });

  assert.equal(system.evidenceTier, "mature");
  assert.ok(system.modelDriftWarnings.some((warning) => warning.title.includes("Score calibration drift")));
  assert.ok(system.adaptiveWeighting.every((item) => item.status === "review_only"));
  assert.ok(system.adaptiveWeighting.every((item) => Math.abs(item.suggestedAdjustment) <= item.maxAdjustment));
  assert.ok(system.confidenceReliabilityScore < 80);
  assert.doesNotMatch(system.operatorBriefing.join(" "), /auto[- ]?modified|buy now|guaranteed/i);
});

test("adaptive learning derives setup, regime, event, and shock cohorts from forward rows", () => {
  const forwardRows = Array.from({ length: 36 }, (_, index) => ({
    asset_type: "equity",
    final_decision: index % 3 === 0 ? "WAIT" : "WATCH",
    final_score: index % 2 === 0 ? 82 : 68,
    forward_return: index % 4 === 0 ? -0.018 : 0.026,
    horizon: "5D",
    market_regime: "risk_on_expansion",
    max_drawdown_after_signal: -0.035,
    setup_type: "momentum_breakout",
    symbol: index % 2 === 0 ? "AMD" : "MU",
    verified_event_signature: "earnings_momentum",
  }));
  const groups = calibrationGroupsFromForwardRows(forwardRows);
  const system = buildAdaptiveLearningSystem({
    forwardRows,
    generatedAt: "2026-05-09T00:00:00.000Z",
  });

  assert.ok(groups.setup_type?.some((row) => row.groupValue === "MOMENTUM_BREAKOUT"));
  assert.ok(groups.market_regime?.some((row) => row.groupValue === "RISK_ON_EXPANSION"));
  assert.ok(groups.event_signature?.some((row) => row.groupValue === "EARNINGS_MOMENTUM"));
  assert.ok(system.setupLearning.some((row) => row.groupValue.includes("Momentum")));
  assert.ok(system.shockLearning.length >= 1);
  assert.ok(system.eventImpactLearning.length >= 1);
});

test("adaptive learning stays conservative when evidence is early", () => {
  const system = buildAdaptiveLearningSystem({
    calibrationGroups: {
      setup_type: [calibrationRow({ count: 8, lowConfidence: true, sampleSize: "LOW" })],
    },
    observationCount: 8,
  });

  assert.equal(system.evidenceTier, "early");
  assert.equal(system.learningTrend, "insufficient_evidence");
  assert.ok(system.adaptiveWeighting.every((item) => item.status === "insufficient_evidence"));
  assert.ok(system.modelDriftWarnings.some((warning) => warning.title.includes("Evidence maturity")));
});

