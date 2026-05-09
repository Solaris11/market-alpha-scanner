import assert from "node:assert/strict";
import test from "node:test";
import { buildScoreCalibrationSystem, type CalibrationAxisDirection, type ScoreCalibrationBucketInput } from "./score-calibration";

function bucket(overrides: Partial<ScoreCalibrationBucketInput>): ScoreCalibrationBucketInput {
  return {
    adverseRatePct: 20,
    avgDrawdownPct: -1,
    avgReturnPct: 0,
    avgSignal: 50,
    axisId: "final_score",
    axisLabel: "Final score",
    bucketLabel: "50-59",
    bucketOrder: 3,
    count: 100,
    direction: "higher_better",
    horizon: "5D",
    largeGainRatePct: 5,
    medianReturnPct: 0,
    outcomeStdDevPct: 4,
    volatilityRatePct: 30,
    winRatePct: 50,
    worstReturnPct: -8,
    ...overrides,
  };
}

test("score calibration rewards monotonic final-score buckets with completed outcomes", () => {
  const system = buildScoreCalibrationSystem({
    bucketRows: [
      bucket({ avgReturnPct: -1.2, bucketLabel: "50-59", bucketOrder: 3, count: 250, largeGainRatePct: 2, winRatePct: 42 }),
      bucket({ avgReturnPct: 0.4, bucketLabel: "60-69", bucketOrder: 4, count: 260, largeGainRatePct: 4, winRatePct: 51 }),
      bucket({ avgReturnPct: 1.1, bucketLabel: "70-79", bucketOrder: 5, count: 270, largeGainRatePct: 7, winRatePct: 57 }),
      bucket({ avgReturnPct: 2.4, bucketLabel: "80-89", bucketOrder: 6, count: 280, largeGainRatePct: 10, winRatePct: 64 }),
    ],
    generatedAt: "2026-05-09T12:00:00.000Z",
  });

  const finalScore = system.axes.find((axis) => axis.axisId === "final_score");
  assert.ok(finalScore);
  assert.equal(finalScore.monotonicityScore, 100);
  assert.ok(finalScore.calibrationConfidence >= 60);
  assert.match(system.summary, /review|measurement/i);
});

test("score calibration flags non-monotonic final-score evidence as review-only", () => {
  const system = buildScoreCalibrationSystem({
    bucketRows: [
      bucket({ avgReturnPct: 1.8, bucketLabel: "50-59", bucketOrder: 3, count: 160, winRatePct: 58 }),
      bucket({ avgReturnPct: 0.7, bucketLabel: "60-69", bucketOrder: 4, count: 170, winRatePct: 52 }),
      bucket({ avgReturnPct: -0.5, bucketLabel: "70-79", bucketOrder: 5, count: 180, winRatePct: 46 }),
      bucket({ avgReturnPct: -1.1, bucketLabel: "80-89", bucketOrder: 6, count: 190, winRatePct: 41 }),
    ],
  });

  const finalScore = system.axes.find((axis) => axis.axisId === "final_score");
  assert.ok(finalScore);
  assert.ok(finalScore.monotonicityScore < 65);
  assert.ok(system.operatorFindings.some((finding) => finding.title.includes("Final score calibration")));
});

test("higher-risk axes measure adverse outcome monotonicity instead of return monotonicity", () => {
  const riskBucket = (bucketOrder: number, adverseRatePct: number): ScoreCalibrationBucketInput => bucket({
    adverseRatePct,
    avgReturnPct: 0.5,
    axisId: "fragility",
    axisLabel: "Fragility",
    bucketLabel: `${bucketOrder}`,
    bucketOrder,
    direction: "higher_risk" as CalibrationAxisDirection,
  });
  const system = buildScoreCalibrationSystem({
    bucketRows: [
      riskBucket(1, 8),
      riskBucket(2, 14),
      riskBucket(3, 27),
      riskBucket(4, 41),
    ],
  });

  const fragility = system.axes.find((axis) => axis.axisId === "fragility");
  assert.ok(fragility);
  assert.equal(fragility.monotonicityScore, 100);
  assert.ok(system.operatorFindings.some((finding) => finding.title.includes("Fragility")));
});

test("calibration anomalies summarize missed winners, avoided losers, and over-conservative cases", () => {
  const system = buildScoreCalibrationSystem({
    anomalies: [
      { anomalyType: "missed_winner", decision: "WAIT", drawdownPct: -1, finalScore: 52, horizon: "5D", reason: "Large gain after low score.", returnPct: 9.2, signalDate: "2026-05-08", symbol: "AMD" },
      { anomalyType: "overly_conservative", decision: "AVOID", drawdownPct: -0.4, finalScore: 48, horizon: "5D", reason: "Avoided setup advanced.", returnPct: 6.1, signalDate: "2026-05-08", symbol: "MU" },
      { anomalyType: "avoided_loser", decision: "WAIT", drawdownPct: -7.5, finalScore: 44, horizon: "5D", reason: "WAIT avoided downside.", returnPct: -4.2, signalDate: "2026-05-08", symbol: "TSM" },
    ],
    bucketRows: [bucket({ avgReturnPct: 0.5, bucketOrder: 4, count: 120 })],
  });

  const missedWinner = system.anomalySummaries.find((summary) => summary.type === "missed_winner");
  const avoidedLoser = system.anomalySummaries.find((summary) => summary.type === "avoided_loser");
  assert.equal(missedWinner?.count, 1);
  assert.equal(avoidedLoser?.count, 1);
  assert.equal(avoidedLoser?.severity, "positive");
});
