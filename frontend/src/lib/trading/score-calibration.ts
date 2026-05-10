export type CalibrationAxisDirection = "higher_better" | "higher_risk";
export type CalibrationReliabilityLabel = "Developing Calibration" | "Early Calibration" | "Insufficient Evidence" | "Reliable Calibration";
export type CalibrationSeverity = "info" | "positive" | "warning";

export type ScoreCalibrationBucketInput = {
  adverseRatePct: number | null;
  avgDrawdownPct: number | null;
  avgReturnPct: number | null;
  avgSignal: number | null;
  bucketLabel: string;
  bucketOrder: number;
  count: number;
  direction: CalibrationAxisDirection;
  horizon: string;
  largeGainRatePct: number | null;
  medianReturnPct: number | null;
  outcomeStdDevPct: number | null;
  volatilityRatePct: number | null;
  winRatePct: number | null;
  worstReturnPct: number | null;
  axisId: string;
  axisLabel: string;
};

export type ScoreCalibrationBucket = ScoreCalibrationBucketInput & {
  outcomeConsistency: number;
  sampleSize: "HIGH" | "LOW" | "MEDIUM";
};

export type ScoreCalibrationAxis = {
  axisId: string;
  axisLabel: string;
  bucketCount: number;
  buckets: ScoreCalibrationBucket[];
  calibrationConfidence: number;
  calibrationDrift: number;
  confidenceConfidence: number;
  direction: CalibrationAxisDirection;
  falseNegativeRate: number | null;
  falsePositiveRate: number | null;
  horizon: string;
  interpretation: string;
  monotonicityScore: number;
  observationCount: number;
  outcomeConsistency: number;
  reliabilityLabel: CalibrationReliabilityLabel;
  setupReliabilityHistory: number;
};

export type ScoreCalibrationAnomalyType = "avoided_loser" | "false_negative" | "false_positive" | "missed_winner" | "overly_aggressive" | "overly_conservative";

export type ScoreCalibrationAnomaly = {
  anomalyType: ScoreCalibrationAnomalyType;
  decision: string;
  drawdownPct: number | null;
  finalScore: number | null;
  horizon: string;
  reason: string;
  returnPct: number;
  signalDate: string | null;
  symbol: string;
};

export type ScoreCalibrationAnomalySummary = {
  count: number;
  examples: ScoreCalibrationAnomaly[];
  label: string;
  severity: CalibrationSeverity;
  type: ScoreCalibrationAnomalyType;
};

export type ScoreCalibrationFinding = {
  detail: string;
  evidence: string;
  severity: CalibrationSeverity;
  title: string;
};

export type ScoreCalibrationSystem = {
  axes: ScoreCalibrationAxis[];
  calibrationConfidence: number;
  calibrationDrift: number;
  confidenceConfidence: number;
  generatedAt: string;
  observationCount: number;
  operatorFindings: ScoreCalibrationFinding[];
  outcomeConsistency: number;
  reliabilityLabel: CalibrationReliabilityLabel;
  summary: string;
  anomalySummaries: ScoreCalibrationAnomalySummary[];
};

export function buildScoreCalibrationSystem(input: {
  anomalies?: ScoreCalibrationAnomaly[];
  bucketRows: ScoreCalibrationBucketInput[];
  generatedAt?: string;
  primaryHorizon?: string;
}): ScoreCalibrationSystem {
  const primaryHorizon = input.primaryHorizon ?? primaryHorizonFor(input.bucketRows);
  const axes = axisSummaries(input.bucketRows, primaryHorizon);
  const observationCount = uniqueObservationCount(axes);
  const calibrationConfidence = Math.round(weightedAverage(axes.map((axis) => [axis.calibrationConfidence, axis.observationCount]), 0));
  const calibrationDrift = Math.round(weightedAverage(axes.map((axis) => [axis.calibrationDrift, axis.observationCount]), 0));
  const confidenceConfidence = Math.round(weightedAverage(axes.map((axis) => [axis.confidenceConfidence, axis.observationCount]), 0));
  const outcomeConsistency = Math.round(weightedAverage(axes.map((axis) => [axis.outcomeConsistency, axis.observationCount]), 0));
  const anomalySummaries = summarizeAnomalies(input.anomalies ?? []);
  const reliabilityLabel = reliabilityFor(calibrationConfidence, observationCount);
  const operatorFindings = findingsFor({ anomalySummaries, axes, calibrationConfidence, outcomeConsistency, reliabilityLabel });

  return {
    axes,
    calibrationConfidence,
    calibrationDrift,
    confidenceConfidence,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    observationCount,
    operatorFindings,
    outcomeConsistency,
    reliabilityLabel,
    summary: `${reliabilityLabel}: ${calibrationConfidence}/100 calibration confidence from ${observationCount.toLocaleString()} ${primaryHorizon} outcome observations. Drift is ${calibrationDrift}/100, so calibration remains measurement, not auto-tuning.`,
    anomalySummaries,
  };
}

function axisSummaries(rows: ScoreCalibrationBucketInput[], primaryHorizon: string): ScoreCalibrationAxis[] {
  const preferred = rows.filter((row) => row.horizon === primaryHorizon);
  const source = preferred.length ? preferred : rows;
  const groups = new Map<string, ScoreCalibrationBucketInput[]>();
  for (const row of source) {
    const key = `${row.axisId}::${row.horizon}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.values())
    .map((bucketRows) => axisSummary(bucketRows))
    .sort((left, right) => right.calibrationConfidence - left.calibrationConfidence || left.axisLabel.localeCompare(right.axisLabel));
}

function axisSummary(rows: ScoreCalibrationBucketInput[]): ScoreCalibrationAxis {
  const sortedRows = [...rows].sort((left, right) => left.bucketOrder - right.bucketOrder);
  const buckets = sortedRows.map((row) => ({
    ...row,
    outcomeConsistency: consistencyFor(row.outcomeStdDevPct),
    sampleSize: sampleSizeFor(row.count),
  }));
  const first = buckets[0];
  const observationCount = buckets.reduce((sum, row) => sum + row.count, 0);
  const monotonicityScore = monotonicityFor(buckets, first?.direction ?? "higher_better");
  const outcomeConsistency = Math.round(weightedAverage(buckets.map((bucket) => [bucket.outcomeConsistency, bucket.count]), 0));
  const falsePositiveRate = falsePositiveRateFor(buckets, first?.direction ?? "higher_better");
  const falseNegativeRate = falseNegativeRateFor(buckets, first?.direction ?? "higher_better");
  const sampleScore = sampleScoreFor(observationCount);
  const bucketCoverage = Math.min(100, buckets.filter((bucket) => bucket.count >= 30).length * 18);
  const calibrationConfidence = Math.round(clamp(sampleScore * 0.42 + monotonicityScore * 0.30 + outcomeConsistency * 0.20 + bucketCoverage * 0.08));
  const calibrationDrift = Math.round(calibrationDriftFor({ falseNegativeRate, falsePositiveRate, monotonicityScore, outcomeConsistency }));
  const confidenceConfidence = Math.round(clamp(calibrationConfidence * 0.64 + bucketCoverage * 0.18 + sampleScore * 0.18 - Math.max(0, calibrationDrift - 60) * 0.18));
  const setupReliabilityHistory = Math.round(clamp(monotonicityScore * 0.45 + outcomeConsistency * 0.35 + sampleScore * 0.20));
  const reliabilityLabel = reliabilityFor(calibrationConfidence, observationCount);

  return {
    axisId: first?.axisId ?? "unknown",
    axisLabel: first?.axisLabel ?? "Unknown",
    bucketCount: buckets.length,
    buckets,
    calibrationConfidence,
    calibrationDrift,
    confidenceConfidence,
    direction: first?.direction ?? "higher_better",
    falseNegativeRate,
    falsePositiveRate,
    horizon: first?.horizon ?? "UNKNOWN",
    interpretation: interpretationFor({
      axisLabel: first?.axisLabel ?? "Unknown",
      calibrationConfidence,
      direction: first?.direction ?? "higher_better",
      falseNegativeRate,
      falsePositiveRate,
      monotonicityScore,
      observationCount,
      outcomeConsistency,
    }),
    monotonicityScore,
    observationCount,
    outcomeConsistency,
    reliabilityLabel,
    setupReliabilityHistory,
  };
}

function calibrationDriftFor(input: {
  falseNegativeRate: number | null;
  falsePositiveRate: number | null;
  monotonicityScore: number;
  outcomeConsistency: number;
}): number {
  const falsePositivePressure = input.falsePositiveRate ?? 50;
  const falseNegativePressure = input.falseNegativeRate ?? 50;
  const monotonicityBreak = 100 - input.monotonicityScore;
  const consistencyBreak = 100 - input.outcomeConsistency;
  return clamp(falsePositivePressure * 0.24 + falseNegativePressure * 0.18 + monotonicityBreak * 0.36 + consistencyBreak * 0.22);
}

function monotonicityFor(buckets: ScoreCalibrationBucket[], direction: CalibrationAxisDirection): number {
  const values = buckets
    .filter((bucket) => bucket.count >= 10)
    .map((bucket) => direction === "higher_better" ? bucket.avgReturnPct : bucket.adverseRatePct)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length < 2) return 0;
  let comparisons = 0;
  let aligned = 0;
  for (let index = 1; index < values.length; index += 1) {
    comparisons += 1;
    if (values[index] >= values[index - 1] - 0.25) aligned += 1;
  }
  return comparisons > 0 ? Math.round((aligned / comparisons) * 100) : 0;
}

function falsePositiveRateFor(buckets: ScoreCalibrationBucket[], direction: CalibrationAxisDirection): number | null {
  const selected = topBuckets(buckets);
  if (!selected.length) return null;
  if (direction === "higher_risk") return weightedAverage(selected.map((bucket) => [100 - (bucket.adverseRatePct ?? 0), bucket.count]), null);
  return weightedAverage(selected.map((bucket) => [Math.max(100 - (bucket.winRatePct ?? 0), bucket.adverseRatePct ?? 0), bucket.count]), null);
}

function falseNegativeRateFor(buckets: ScoreCalibrationBucket[], direction: CalibrationAxisDirection): number | null {
  const selected = bottomBuckets(buckets);
  if (!selected.length) return null;
  if (direction === "higher_risk") return weightedAverage(selected.map((bucket) => [bucket.adverseRatePct ?? 0, bucket.count]), null);
  return weightedAverage(selected.map((bucket) => [bucket.largeGainRatePct ?? 0, bucket.count]), null);
}

function topBuckets(buckets: ScoreCalibrationBucket[]): ScoreCalibrationBucket[] {
  const maxOrder = Math.max(...buckets.map((bucket) => bucket.bucketOrder));
  return buckets.filter((bucket) => bucket.bucketOrder >= maxOrder - 1 && bucket.count >= 10);
}

function bottomBuckets(buckets: ScoreCalibrationBucket[]): ScoreCalibrationBucket[] {
  const minOrder = Math.min(...buckets.map((bucket) => bucket.bucketOrder));
  return buckets.filter((bucket) => bucket.bucketOrder <= minOrder + 1 && bucket.count >= 10);
}

function summarizeAnomalies(anomalies: ScoreCalibrationAnomaly[]): ScoreCalibrationAnomalySummary[] {
  const byType = new Map<ScoreCalibrationAnomalyType, ScoreCalibrationAnomaly[]>();
  for (const anomaly of anomalies) {
    byType.set(anomaly.anomalyType, [...(byType.get(anomaly.anomalyType) ?? []), anomaly]);
  }
  return ANOMALY_ORDER.map((type) => {
    const rows = byType.get(type) ?? [];
    return {
      count: rows.length,
      examples: rows.slice(0, 6),
      label: anomalyLabel(type),
      severity: anomalySeverity(type),
      type,
    };
  });
}

function findingsFor(input: {
  anomalySummaries: ScoreCalibrationAnomalySummary[];
  axes: ScoreCalibrationAxis[];
  calibrationConfidence: number;
  outcomeConsistency: number;
  reliabilityLabel: CalibrationReliabilityLabel;
}): ScoreCalibrationFinding[] {
  const findings: ScoreCalibrationFinding[] = [];
  const finalScore = input.axes.find((axis) => axis.axisId === "final_score");
  const fragility = input.axes.find((axis) => axis.axisId === "fragility");
  const conservative = input.anomalySummaries.find((summary) => summary.type === "overly_conservative");
  const avoidedLosers = input.anomalySummaries.find((summary) => summary.type === "avoided_loser");

  if (finalScore && finalScore.monotonicityScore < 65) {
    findings.push({
      detail: "Higher final-score buckets are not cleanly outperforming lower buckets yet. Treat threshold changes as premature.",
      evidence: `${finalScore.monotonicityScore}/100 monotonicity on ${finalScore.horizon}`,
      severity: "warning",
      title: "Final score calibration is not mature",
    });
  }
  if (fragility && fragility.monotonicityScore >= 70) {
    findings.push({
      detail: "Higher fragility/risk-pressure buckets are more consistently associated with adverse outcomes.",
      evidence: `${fragility.monotonicityScore}/100 risk monotonicity`,
      severity: "positive",
      title: "Fragility is directionally useful",
    });
  }
  if ((conservative?.count ?? 0) > (avoidedLosers?.count ?? 0)) {
    findings.push({
      detail: "The system has more observed WAIT/AVOID winners than avoided losers in the anomaly sample. This may indicate over-conservatism for current windows.",
      evidence: `${conservative?.count ?? 0} overly conservative vs ${avoidedLosers?.count ?? 0} avoided losers`,
      severity: "warning",
      title: "Conservative bias needs review",
    });
  }
  if (input.calibrationConfidence < 70) {
    findings.push({
      detail: "Forward evidence is usable for diagnostics, but not enough for aggressive scoring changes.",
      evidence: `${input.reliabilityLabel}, consistency ${input.outcomeConsistency}/100`,
      severity: "info",
      title: "Keep calibration in review-only mode",
    });
  }
  const drifted = input.axes.find((axis) => axis.calibrationDrift >= 65);
  if (drifted) {
    findings.push({
      detail: "Recent bucket behavior is noisy enough that score confidence should be discounted before any threshold change.",
      evidence: `${drifted.axisLabel} drift ${drifted.calibrationDrift}/100`,
      severity: "warning",
      title: "Calibration drift needs monitoring",
    });
  }
  if (!findings.length) {
    findings.push({
      detail: "No dominant calibration warning is strong enough to justify scoring changes yet.",
      evidence: `${input.calibrationConfidence}/100 calibration confidence`,
      severity: "info",
      title: "Calibration stable, still review-only",
    });
  }
  return findings.slice(0, 5);
}

function interpretationFor(input: {
  axisLabel: string;
  calibrationConfidence: number;
  direction: CalibrationAxisDirection;
  falseNegativeRate: number | null;
  falsePositiveRate: number | null;
  monotonicityScore: number;
  observationCount: number;
  outcomeConsistency: number;
}): string {
  const directionText = input.direction === "higher_better" ? "higher buckets should show better forward outcomes" : "higher buckets should show more adverse/risk outcomes";
  const falsePositive = input.falsePositiveRate === null ? "n/a" : `${input.falsePositiveRate.toFixed(1)}%`;
  const falseNegative = input.falseNegativeRate === null ? "n/a" : `${input.falseNegativeRate.toFixed(1)}%`;
  return `${input.axisLabel}: ${directionText}. Monotonicity ${input.monotonicityScore}/100, consistency ${input.outcomeConsistency}/100, false-positive ${falsePositive}, false-negative ${falseNegative}, sample ${input.observationCount.toLocaleString()}.`;
}

function primaryHorizonFor(rows: ScoreCalibrationBucketInput[]): string {
  const preferred = ["5D", "10D", "3D", "2D", "1D"];
  for (const horizon of preferred) {
    if (rows.some((row) => row.horizon === horizon)) return horizon;
  }
  return rows[0]?.horizon ?? "UNKNOWN";
}

function uniqueObservationCount(axes: ScoreCalibrationAxis[]): number {
  return axes.reduce((max, axis) => Math.max(max, axis.observationCount), 0);
}

function consistencyFor(stdDevPct: number | null): number {
  if (stdDevPct === null || !Number.isFinite(stdDevPct)) return 35;
  return Math.round(clamp(100 - Math.min(85, Math.abs(stdDevPct) * 8)));
}

function sampleScoreFor(count: number): number {
  if (count >= 5_000) return 100;
  if (count >= 1_000) return 82;
  if (count >= 300) return 64;
  if (count >= 100) return 45;
  if (count >= 30) return 26;
  return 10;
}

function sampleSizeFor(count: number): "HIGH" | "LOW" | "MEDIUM" {
  if (count >= 100) return "HIGH";
  if (count >= 30) return "MEDIUM";
  return "LOW";
}

function reliabilityFor(confidence: number, count: number): CalibrationReliabilityLabel {
  if (confidence >= 82 && count >= 1_000) return "Reliable Calibration";
  if (confidence >= 62 && count >= 300) return "Developing Calibration";
  if (confidence >= 35 && count >= 30) return "Early Calibration";
  return "Insufficient Evidence";
}

function anomalyLabel(type: ScoreCalibrationAnomalyType): string {
  if (type === "false_positive") return "False positives";
  if (type === "false_negative") return "False negatives";
  if (type === "overly_conservative") return "Overly conservative";
  if (type === "overly_aggressive") return "Overly aggressive";
  if (type === "missed_winner") return "Missed winners";
  return "Avoided losers";
}

function anomalySeverity(type: ScoreCalibrationAnomalyType): CalibrationSeverity {
  if (type === "avoided_loser") return "positive";
  if (type === "overly_conservative" || type === "overly_aggressive" || type === "false_positive") return "warning";
  return "info";
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function weightedAverage(values: Array<[number | null, number]>, fallback: number): number;
function weightedAverage(values: Array<[number | null, number]>, fallback: null): number | null;
function weightedAverage(values: Array<[number | null, number]>, fallback: number | null): number | null {
  let total = 0;
  let weight = 0;
  for (const [value, itemWeight] of values) {
    if (value === null || !Number.isFinite(value) || itemWeight <= 0) continue;
    total += value * itemWeight;
    weight += itemWeight;
  }
  if (weight <= 0) return fallback;
  return total / weight;
}

const ANOMALY_ORDER: ScoreCalibrationAnomalyType[] = [
  "false_positive",
  "false_negative",
  "overly_conservative",
  "overly_aggressive",
  "missed_winner",
  "avoided_loser",
];
