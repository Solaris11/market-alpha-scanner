import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceMaturity, buildEvidenceMaturityFromSignal } from "./evidence-maturity";
import type { ShockMovePattern } from "./shock-move";

function shockPattern(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 72,
    averageDrawdownAfterEntry: "-4.2% average 5D adverse excursion after shocks",
    averageFollowthrough1d: 1.2,
    averageFollowthrough5d: 3.4,
    averageProfitPotential: "+9.8% average 5D favorable excursion after shocks",
    averageReversal5d: -1.5,
    chaseRiskLabel: "Chase risk elevated",
    chaseRiskScore: 54,
    chaseSuccessRate: 46,
    commonFailureConditions: ["volatility expansion weakened follow-through"],
    commonPreconditions: ["volatility compression before expansion"],
    currentSimilarityScore: 74,
    downsideRiskScore: 48,
    downsideShockCount: 16,
    doNotChaseZone: "$118+",
    historicalExitZone: "$124-$130",
    invalidationZone: "$96",
    largestDownside1d: -12.4,
    largestUpside1d: 18.6,
    lastUpdated: "2026-05-09T12:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -7.1,
    medianUpsideShock: 9.2,
    opportunityScore: 76,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 62,
    reliabilityScore: 71,
    researchEntryZone: "$102-$105",
    shockCompletedEventCount: 2,
    shockEventCount: 2,
    shockEventSpanDays: null,
    shockEvents: [
      { atrNormalizedMove: 2.4, eventDate: "2025-01-02", gapPercent: 1.2, maxAdverseExcursion5d: -3.1, maxFavorableExcursion5d: 8.2, moveType: "upside", outcomeStatus: "complete", preconditions: defaultPreconditions(), return1d: 8.4, return2d: 2.2, return3d: 3.1, return5d: 5.4, return10d: 7.8, returnZScore: 2.6, volumeSpikeRatio: 1.9 },
      { atrNormalizedMove: 2.1, eventDate: "2026-01-02", gapPercent: 0.8, maxAdverseExcursion5d: -4.4, maxFavorableExcursion5d: 7.1, moveType: "upside", outcomeStatus: "partial", preconditions: defaultPreconditions(), return1d: 6.2, return2d: 1.1, return3d: 2.4, return5d: null, return10d: null, returnZScore: 2.2, volumeSpikeRatio: 1.7 },
    ],
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 34,
    upsideShockScore: 80,
    ...overrides,
  };
}

function defaultPreconditions() {
  return {
    atrPercent: 3.1,
    closeVsMa20Pct: 4.2,
    closeVsMa50Pct: 8.4,
    compressionPercentile: 22,
    gapPercent: 1.1,
    ma20TrendPct: 1.4,
    priorFiveDayReturnPct: 3.2,
    realizedVolatility10d: 2.8,
    returnZScore: 2.4,
    volumeSpikeRatio: 1.8,
  };
}

test("evidence maturity requires calendar depth and outcome coverage for high confidence", () => {
  const mature = buildEvidenceMaturity({
    analogQualityScore: 82,
    confidenceReliability: 78,
    evidenceSampleSize: 320,
    historicalDepthDays: 110,
    outcomeCoverage: 76,
    regimeSimilarityScore: 74,
  });

  assert.equal(mature.label, "High Confidence Evidence");
  assert.equal(mature.tier, "high");
  assert.ok(mature.score >= 86);
  assert.ok(mature.evidenceConsistency >= 70);
  assert.ok(mature.confidenceConfidence >= 70);

  const shallow = buildEvidenceMaturity({
    analogQualityScore: 92,
    confidenceReliability: 86,
    evidenceSampleSize: 320,
    historicalDepthDays: 16,
    outcomeCoverage: 82,
  });

  assert.notEqual(shallow.label, "High Confidence Evidence");
  assert.ok(shallow.limitations.some((item) => item.includes("calendar depth")));
});

test("evidence maturity discounts elevated calibration drift", () => {
  const evidence = buildEvidenceMaturity({
    analogQualityScore: 82,
    calibrationDrift: 82,
    confidenceReliability: 78,
    evidenceConsistency: 74,
    evidenceSampleSize: 320,
    historicalDepthDays: 110,
    outcomeCoverage: 76,
  });

  assert.ok(evidence.calibrationDrift >= 80);
  assert.ok(evidence.limitations.some((item) => item.includes("calibration drift")));
  assert.ok(evidence.reasons.some((item) => item.includes("discounted")));
});

test("signal evidence falls back to shock samples and exposes limited outcomes honestly", () => {
  const evidence = buildEvidenceMaturityFromSignal({
    event_context_available: true,
    final_score: 78,
    macro_alignment_score: 70,
    symbol: "AMD",
  }, { shockPattern: shockPattern() });

  assert.ok(evidence.evidenceSampleSize >= 50);
  assert.ok(evidence.historicalDepthDays >= 300);
  assert.ok(evidence.reasons.some((item) => item.includes("observations")));
  assert.doesNotMatch(evidence.reasons.join(" "), /guaranteed|prediction|buy now/i);
});

test("explicit evidence fields override fallbacks and classify developing evidence", () => {
  const evidence = buildEvidenceMaturityFromSignal({
    analog_quality_score: 61,
    confidence_reliability: 52,
    evidence_sample_size: 44,
    historical_depth_days: 22,
    outcome_coverage: 0.48,
    symbol: "TSM",
  });

  assert.equal(evidence.label, "Developing Evidence");
  assert.equal(evidence.evidenceSampleSize, 44);
  assert.equal(evidence.outcomeCoverage, 48);
});
