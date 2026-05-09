import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMoveEvent } from "./shock-move";
import { buildSignalTradeLevels } from "./signal-lifecycle";
import { cleanText, finiteNumber, firstNumber, formatMoney } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type ExecutionState =
  | "avoid_chase"
  | "breakout_confirmed"
  | "confirmation_needed"
  | "early_opportunity"
  | "extended_entry"
  | "trigger_approaching"
  | "wait_for_pullback";

export type ExecutionTone = "caution" | "neutral" | "positive" | "risk";

export type ExecutionScore = {
  label: string;
  score: number;
  tone: ExecutionTone;
};

export type ExecutionEntryType =
  | "breakout_confirmation"
  | "early_momentum"
  | "post_gap_chase"
  | "pullback_entry"
  | "retest_entry"
  | "volatility_compression_breakout";

export type ExecutionEvidenceMaturity = "Developing Evidence" | "High Confidence Evidence" | "Limited Evidence" | "Mature Evidence";

export type ExecutionOutcomeMetric = {
  averageMaePct: number | null;
  averageMfePct: number | null;
  continuationRate: number | null;
  entryType: ExecutionEntryType;
  failedBreakoutRate: number | null;
  invalidationHitRate: number | null;
  label: string;
  reliabilityLabel: ExecutionEvidenceMaturity;
  reversalRate: number | null;
  rewardRiskEstimate: number | null;
  sampleSize: number;
  score: number;
  summary: string;
  upsideCapturePct: number | null;
};

export type ExecutionCalibrationReport = {
  bestValidatedEntryType: ExecutionOutcomeMetric | null;
  calibrationSummary: string;
  currentEntryType: ExecutionEntryType;
  currentEntryTypeLabel: string;
  currentEntryTypeMetrics: ExecutionOutcomeMetric | null;
  evidenceMaturity: ExecutionEvidenceMaturity;
  outcomeMetrics: ExecutionOutcomeMetric[];
  scoreAdjustment: number;
  timingProofReport: string[];
  validationSampleSize: number;
  weakestEntryType: ExecutionOutcomeMetric | null;
};

export type ExecutionZoneContext = {
  doNotChaseZone: string;
  historicalEntryZone: string;
  historicalExitZone: string;
  invalidationZone: string;
  researchEntryZone: string;
};

export type ExecutionIntelligence = {
  breakoutQuality: ExecutionScore;
  calibration: ExecutionCalibrationReport;
  chaseRisk: ExecutionScore;
  compactLabels: string[];
  confirmationQuality: ExecutionScore;
  executionState: ExecutionState;
  executionStateLabel: string;
  historicalExecutionContext: string[];
  keyReasons: string[];
  keyRisks: string[];
  pullbackQuality: ExecutionScore;
  entryQuality: ExecutionScore;
  summary: string;
  symbol: string;
  timingQualityScore: number;
  volatilityExecutionRisk: ExecutionScore;
  whatToConfirm: string[];
  zones: ExecutionZoneContext;
};

export type ExecutionTimingSystem = {
  averageChaseRisk: number;
  averageEntryQuality: number;
  averageTimingQuality: number;
  calibrationSummary: string;
  avoidChase: ExecutionIntelligence[];
  breakoutConfirmed: ExecutionIntelligence[];
  confirmationNeeded: ExecutionIntelligence[];
  generatedAt: string;
  limitations: string[];
  pullbackCandidates: ExecutionIntelligence[];
  rows: ExecutionIntelligence[];
  systemSummary: string;
  topTimingQuality: ExecutionIntelligence[];
};

type ExecutionInputs = {
  atrPressure: number;
  decision: string;
  entryDistancePct: number | null;
  entryStatus: string;
  macroAlignment: number;
  relativeVolume: number | null;
  riskReward: number | null;
  setupType: string;
  staleData: boolean;
  volatilityPressure: number;
};

export function buildExecutionTimingSystem(rows: OpportunityViewModel[], generatedAt = new Date().toISOString()): ExecutionTimingSystem {
  const models = rows.map(buildExecutionIntelligence);
  const averageEntryQuality = Math.round(average(models.map((model) => model.entryQuality.score), 50));
  const averageChaseRisk = Math.round(average(models.map((model) => model.chaseRisk.score), 50));
  const averageTimingQuality = Math.round(average(models.map((model) => model.timingQualityScore), 50));
  const calibratedModels = models.filter((model) => model.calibration.validationSampleSize > 0);
  const topTimingQuality = [...models].sort((left, right) => right.timingQualityScore - left.timingQualityScore).slice(0, 5);
  const avoidChase = models.filter((model) => model.executionState === "avoid_chase" || model.executionState === "extended_entry").sort((left, right) => right.chaseRisk.score - left.chaseRisk.score).slice(0, 5);
  const pullbackCandidates = models.filter((model) => model.executionState === "wait_for_pullback" || model.pullbackQuality.score >= 66).sort((left, right) => right.pullbackQuality.score - left.pullbackQuality.score).slice(0, 5);
  const breakoutConfirmed = models.filter((model) => model.executionState === "breakout_confirmed" || model.breakoutQuality.score >= 70).sort((left, right) => right.breakoutQuality.score - left.breakoutQuality.score).slice(0, 5);
  const confirmationNeeded = models.filter((model) => model.executionState === "confirmation_needed").sort((left, right) => right.confirmationQuality.score - left.confirmationQuality.score).slice(0, 5);

  return {
    averageChaseRisk,
    averageEntryQuality,
    averageTimingQuality,
    calibrationSummary: calibrationSummaryForSystem(calibratedModels, models.length),
    avoidChase,
    breakoutConfirmed,
    confirmationNeeded,
    generatedAt,
    limitations: [
      "Execution Intelligence separates timing quality from the core scanner decision; it does not place or recommend real orders.",
      "Entry, pullback, breakout, and chase labels are deterministic estimates from scanner, volatility, shock, and level context.",
      "Execution outcome calibration uses completed historical shock/retest/continuation samples when available; limited samples are labelled instead of overstated.",
      "Historical execution context is probabilistic and sample-size dependent; it is not a guarantee of future behavior.",
    ],
    pullbackCandidates,
    rows: models.sort((left, right) => right.timingQualityScore - left.timingQualityScore),
    systemSummary: systemSummary({ averageChaseRisk, averageEntryQuality, averageTimingQuality, count: models.length }),
    topTimingQuality,
  };
}

export function buildExecutionIntelligence(row: OpportunityViewModel): ExecutionIntelligence {
  const input = executionInputs(row);
  const calibration = buildExecutionCalibration(row, input);
  const entryQualityScore = calibratedEntryQuality(entryQuality(row, input), calibration);
  const pullbackQualityScore = pullbackQuality(row, input);
  const breakoutQualityScore = breakoutQuality(row, input);
  const confirmationQualityScore = confirmationQuality(row, input);
  const chaseRiskScore = calibratedChaseRisk(chaseRisk(row, input), calibration, input);
  const volatilityExecutionRiskScore = volatilityExecutionRisk(row, input);
  const timingQualityScore = Math.round(clamp(weightedAverage([
    [entryQualityScore, 0.28],
    [confirmationQualityScore, 0.20],
    [setupBlendScore(input.setupType, pullbackQualityScore, breakoutQualityScore), 0.18],
    [100 - chaseRiskScore, 0.22],
    [100 - volatilityExecutionRiskScore, 0.12],
  ], 50)));
  const executionState = executionStateFor({
    breakoutQualityScore,
    chaseRiskScore,
    confirmationQualityScore,
    entryQualityScore,
    input,
    pullbackQualityScore,
    timingQualityScore,
    volatilityExecutionRiskScore,
  });
  const zones = zoneContext(row);
  const keyReasons = reasonLines(row, input, {
    breakoutQualityScore,
    confirmationQualityScore,
    entryQualityScore,
    pullbackQualityScore,
    timingQualityScore,
  });
  const keyRisks = riskLines(row, input, { chaseRiskScore, volatilityExecutionRiskScore });
  const historicalExecutionContext = historicalExecutionContextFor(row);
  const whatToConfirm = confirmationLines(row, input, executionState);
  const executionStateLabel = stateLabel(executionState);

  return {
    breakoutQuality: scoreLabel(breakoutQualityScore, "Breakout quality", false),
    calibration,
    chaseRisk: scoreLabel(chaseRiskScore, "Chase risk", true),
    compactLabels: compactLabelsFor({ chaseRiskScore, executionState, entryQualityScore, timingQualityScore, volatilityExecutionRiskScore }),
    confirmationQuality: scoreLabel(confirmationQualityScore, "Confirmation quality", false),
    entryQuality: scoreLabel(entryQualityScore, "Entry quality", false),
    executionState,
    executionStateLabel,
    historicalExecutionContext,
    keyReasons,
    keyRisks,
    pullbackQuality: scoreLabel(pullbackQualityScore, "Pullback quality", false),
    summary: summaryFor(row, executionStateLabel, timingQualityScore, chaseRiskScore, entryQualityScore),
    symbol: row.symbol,
    timingQualityScore,
    volatilityExecutionRisk: scoreLabel(volatilityExecutionRiskScore, "Volatility execution risk", true),
    whatToConfirm,
    zones,
  };
}

export function compactExecutionLabels(row: OpportunityViewModel): string[] {
  return buildExecutionIntelligence(row).compactLabels;
}

function buildExecutionCalibration(row: OpportunityViewModel, input: ExecutionInputs): ExecutionCalibrationReport {
  const events = (row.shockPattern?.shockEvents ?? []).filter((event) => event.return5d !== null || event.maxFavorableExcursion5d !== null || event.maxAdverseExcursion5d !== null);
  const currentEntryType = currentEntryTypeFor(row, input);
  const invalidationThresholdPct = invalidationThresholdFor(row);
  const outcomeMetrics = ENTRY_TYPES.map((entryType) => outcomeMetricFor(entryType, events.filter((event) => entryTypeMatches(entryType, event)), invalidationThresholdPct));
  const metricsWithSamples = outcomeMetrics.filter((metric) => metric.sampleSize > 0);
  const bestValidatedEntryType = bestMetric(metricsWithSamples);
  const weakestEntryType = weakestMetric(metricsWithSamples);
  const currentEntryTypeMetrics = outcomeMetrics.find((metric) => metric.entryType === currentEntryType) ?? null;
  const validationSampleSize = events.length;
  const evidenceMaturity = evidenceMaturityFor(validationSampleSize);
  const scoreAdjustment = currentEntryTypeMetrics && currentEntryTypeMetrics.sampleSize >= 3
    ? Math.round(clamp((currentEntryTypeMetrics.score - 50) * 0.18, -8, 8))
    : 0;
  const timingProof = row.shockPattern?.timingValidation;
  const timingProofReport = [
    currentEntryTypeMetrics?.summary ?? "Current entry-type proof is still building.",
    bestValidatedEntryType ? `${bestValidatedEntryType.label} has the strongest historical execution profile in the available sample.` : "No entry type has enough completed outcome evidence yet.",
    weakestEntryType && weakestEntryType.entryType !== bestValidatedEntryType?.entryType ? `${weakestEntryType.label} has the weakest historical execution profile in the available sample.` : null,
    timingProof?.summary ?? null,
  ].filter((line): line is string => Boolean(line)).slice(0, 4);

  return {
    bestValidatedEntryType,
    calibrationSummary: calibrationSummaryFor(currentEntryType, currentEntryTypeMetrics, validationSampleSize, scoreAdjustment),
    currentEntryType,
    currentEntryTypeLabel: entryTypeLabel(currentEntryType),
    currentEntryTypeMetrics,
    evidenceMaturity,
    outcomeMetrics,
    scoreAdjustment,
    timingProofReport,
    validationSampleSize,
    weakestEntryType,
  };
}

function calibratedEntryQuality(baseScore: number, calibration: ExecutionCalibrationReport): number {
  return Math.round(clamp(baseScore + calibration.scoreAdjustment));
}

function calibratedChaseRisk(baseScore: number, calibration: ExecutionCalibrationReport, input: ExecutionInputs): number {
  const postGap = calibration.outcomeMetrics.find((metric) => metric.entryType === "post_gap_chase");
  if (!postGap || postGap.sampleSize < 3) return Math.round(clamp(baseScore));
  const chaseLike = calibration.currentEntryType === "post_gap_chase" || input.entryStatus.includes("chase") || input.entryStatus.includes("extended");
  if (!chaseLike) return Math.round(clamp(baseScore));
  const continuation = postGap.continuationRate ?? 0.5;
  const invalidation = postGap.invalidationHitRate ?? 0;
  const failed = postGap.failedBreakoutRate ?? 0;
  const adjustment = clamp((0.52 - continuation) * 22 + invalidation * 12 + failed * 10, -6, 10);
  return Math.round(clamp(baseScore + adjustment));
}

const ENTRY_TYPES: ExecutionEntryType[] = [
  "pullback_entry",
  "breakout_confirmation",
  "early_momentum",
  "post_gap_chase",
  "retest_entry",
  "volatility_compression_breakout",
];

function outcomeMetricFor(entryType: ExecutionEntryType, events: ShockMoveEvent[], invalidationThresholdPct: number): ExecutionOutcomeMetric {
  const completed = events.filter((event) => event.return5d !== null || event.maxFavorableExcursion5d !== null || event.maxAdverseExcursion5d !== null);
  const mfe = completed.map((event) => event.maxFavorableExcursion5d).filter(isFiniteNumber);
  const mae = completed.map((event) => event.maxAdverseExcursion5d).filter(isFiniteNumber);
  const returns5d = completed.map((event) => event.return5d).filter(isFiniteNumber);
  const continuationRate = rate(returns5d.map((value) => value > 0));
  const reversalRate = rate(returns5d.map((value) => value < 0));
  const failedBreakoutRate = rate(completed.map((event) => event.return1d > 0 && (event.return5d ?? 0) <= 0));
  const invalidationHitRate = rate(completed.map((event) => {
    const adverse = event.maxAdverseExcursion5d;
    return adverse !== null && adverse <= -invalidationThresholdPct;
  }));
  const averageMfePct = meanOrNull(mfe);
  const averageMaePct = meanOrNull(mae);
  const rewardRiskEstimate = averageMfePct !== null && averageMaePct !== null && Math.abs(averageMaePct) > 0.1 ? round(averageMfePct / Math.abs(averageMaePct), 2) : null;
  const score = outcomeScore({
    averageMaePct,
    averageMfePct,
    continuationRate,
    failedBreakoutRate,
    invalidationHitRate,
    rewardRiskEstimate,
    sampleSize: completed.length,
  });
  return {
    averageMaePct: roundOrNull(averageMaePct, 2),
    averageMfePct: roundOrNull(averageMfePct, 2),
    continuationRate: roundRatioOrNull(continuationRate),
    entryType,
    failedBreakoutRate: roundRatioOrNull(failedBreakoutRate),
    invalidationHitRate: roundRatioOrNull(invalidationHitRate),
    label: entryTypeLabel(entryType),
    reliabilityLabel: evidenceMaturityFor(completed.length),
    reversalRate: roundRatioOrNull(reversalRate),
    rewardRiskEstimate,
    sampleSize: completed.length,
    score,
    summary: metricSummary(entryType, completed.length, continuationRate, averageMfePct, averageMaePct, invalidationHitRate, score),
    upsideCapturePct: roundOrNull(averageMfePct, 2),
  };
}

function entryTypeMatches(entryType: ExecutionEntryType, event: ShockMoveEvent): boolean {
  const pre = event.preconditions;
  const gap = Math.abs(pre.gapPercent ?? event.gapPercent ?? 0);
  const volume = pre.volumeSpikeRatio ?? event.volumeSpikeRatio ?? 1;
  const closeVsMa20 = pre.closeVsMa20Pct ?? 0;
  const closeVsMa50 = pre.closeVsMa50Pct ?? 0;
  const priorFive = pre.priorFiveDayReturnPct ?? 0;
  const compression = pre.compressionPercentile ?? 0;
  const zScore = Math.abs(pre.returnZScore ?? event.returnZScore ?? 0);
  if (entryType === "post_gap_chase") return gap >= 3 || event.return1d >= 8 || volume >= 2.2;
  if (entryType === "volatility_compression_breakout") return compression >= 35 && closeVsMa20 >= -0.5 && event.return1d > 0;
  if (entryType === "breakout_confirmation") return closeVsMa20 >= 0 && closeVsMa50 >= -1 && volume >= 1.15 && event.return1d > 0;
  if (entryType === "early_momentum") return priorFive >= -1.5 && priorFive <= 8 && zScore <= 1.8 && event.return1d > 0;
  if (entryType === "pullback_entry") return closeVsMa20 >= -4 && closeVsMa20 <= 1.5 && closeVsMa50 >= -3 && priorFive <= 3;
  return Math.abs(closeVsMa20) <= 1.5 || Math.abs(closeVsMa50) <= 1.5;
}

function currentEntryTypeFor(row: OpportunityViewModel, input: ExecutionInputs): ExecutionEntryType {
  const status = input.entryStatus;
  if (status.includes("chase") || status.includes("extended") || status.includes("gap")) return "post_gap_chase";
  if (/PULLBACK|CORRECTION|DIP/.test(input.setupType) || input.decision === "WAIT_PULLBACK") return "pullback_entry";
  if (/RETEST|RECLAIM/.test(input.setupType)) return "retest_entry";
  const compression = finiteNumber(row.raw.compression_percentile ?? row.raw.volatility_compression_percentile);
  if ((compression ?? 0) >= 35 || /COMPRESSION|SQUEEZE/.test(input.setupType)) return "volatility_compression_breakout";
  if (/BREAKOUT|CONTINUATION|EXPANSION/.test(input.setupType)) return "breakout_confirmation";
  return "early_momentum";
}

function invalidationThresholdFor(row: OpportunityViewModel): number {
  const price = row.price ?? firstNumber(row.raw.price);
  const stop = row.stop_loss ?? firstNumber(row.raw.stop_loss ?? row.raw.invalidation_level);
  if (price !== null && stop !== null && price > 0) return clamp(Math.abs((price - stop) / price) * 100, 3, 12);
  return 6;
}

function outcomeScore(input: {
  averageMaePct: number | null;
  averageMfePct: number | null;
  continuationRate: number | null;
  failedBreakoutRate: number | null;
  invalidationHitRate: number | null;
  rewardRiskEstimate: number | null;
  sampleSize: number;
}): number {
  const sample = sampleScore(input.sampleSize);
  const continuation = (input.continuationRate ?? 0.5) * 100;
  const failed = (input.failedBreakoutRate ?? 0.35) * 100;
  const invalidation = (input.invalidationHitRate ?? 0.25) * 100;
  const rewardRisk = input.rewardRiskEstimate === null ? 50 : clamp(input.rewardRiskEstimate * 32);
  const mfe = input.averageMfePct === null ? 45 : clamp(input.averageMfePct * 8);
  const maePenalty = input.averageMaePct === null ? 20 : clamp(Math.abs(input.averageMaePct) * 5);
  return Math.round(clamp(continuation * 0.28 + rewardRisk * 0.22 + mfe * 0.14 + sample * 0.14 + (100 - failed) * 0.11 + (100 - invalidation) * 0.11 - maePenalty * 0.18));
}

function calibrationSummaryFor(entryType: ExecutionEntryType, metric: ExecutionOutcomeMetric | null, validationSampleSize: number, scoreAdjustment: number): string {
  if (!metric || metric.sampleSize === 0) {
    return `${entryTypeLabel(entryType)} calibration is still building. Execution scoring is using live scanner, volatility, and level context first.`;
  }
  const direction = scoreAdjustment > 0 ? "supports" : scoreAdjustment < 0 ? "penalizes" : "does not materially adjust";
  return `${entryTypeLabel(entryType)} has ${metric.reliabilityLabel.toLowerCase()} from ${metric.sampleSize}/${validationSampleSize} comparable outcomes and ${direction} the entry-quality score within bounded guardrails.`;
}

function calibrationSummaryForSystem(models: ExecutionIntelligence[], totalCount: number): string {
  if (!models.length) return `Execution calibration reviewed ${totalCount} symbols, but historical outcome proof is still building.`;
  const sampleCount = models.reduce((total, model) => total + model.calibration.validationSampleSize, 0);
  const avgAdjustment = average(models.map((model) => model.calibration.scoreAdjustment), 0);
  const best = models.map((model) => model.calibration.bestValidatedEntryType).filter((metric): metric is ExecutionOutcomeMetric => metric !== null).sort((left, right) => right.score - left.score)[0] ?? null;
  const bestText = best ? `${best.label} currently has the strongest execution evidence` : "No single entry type dominates yet";
  return `Execution calibration reviewed ${sampleCount} historical outcomes across ${models.length}/${totalCount} symbols. ${bestText}; average score adjustment is ${avgAdjustment >= 0 ? "+" : ""}${avgAdjustment.toFixed(1)} points.`;
}

function metricSummary(entryType: ExecutionEntryType, sampleSize: number, continuationRate: number | null, averageMfePct: number | null, averageMaePct: number | null, invalidationHitRate: number | null, score: number): string {
  if (!sampleSize) return `${entryTypeLabel(entryType)} has no completed comparable outcome sample yet.`;
  const continuation = continuationRate === null ? "continuation unavailable" : `${Math.round(continuationRate * 100)}% continuation`;
  const mfe = averageMfePct === null ? "MFE unavailable" : `${formatSignedPercent(averageMfePct)} avg MFE`;
  const mae = averageMaePct === null ? "MAE unavailable" : `${formatSignedPercent(averageMaePct)} avg MAE`;
  const invalidation = invalidationHitRate === null ? "invalidation hit unavailable" : `${Math.round(invalidationHitRate * 100)}% invalidation-hit context`;
  return `${entryTypeLabel(entryType)} scored ${score}/100 from ${sampleSize} outcomes: ${continuation}, ${mfe}, ${mae}, ${invalidation}.`;
}

function entryTypeLabel(entryType: ExecutionEntryType): string {
  const labels: Record<ExecutionEntryType, string> = {
    breakout_confirmation: "Breakout Confirmation",
    early_momentum: "Early Momentum",
    post_gap_chase: "Post-Gap Chase",
    pullback_entry: "Pullback Entry",
    retest_entry: "Retest Entry",
    volatility_compression_breakout: "Volatility Compression Breakout",
  };
  return labels[entryType];
}

function bestMetric(metrics: ExecutionOutcomeMetric[]): ExecutionOutcomeMetric | null {
  return metrics.filter((metric) => metric.sampleSize >= 2).sort((left, right) => right.score - left.score)[0] ?? null;
}

function weakestMetric(metrics: ExecutionOutcomeMetric[]): ExecutionOutcomeMetric | null {
  return metrics.filter((metric) => metric.sampleSize >= 2).sort((left, right) => left.score - right.score)[0] ?? null;
}

function evidenceMaturityFor(sampleSize: number): ExecutionEvidenceMaturity {
  if (sampleSize >= 24) return "High Confidence Evidence";
  if (sampleSize >= 12) return "Mature Evidence";
  if (sampleSize >= 5) return "Developing Evidence";
  return "Limited Evidence";
}

function sampleScore(count: number): number {
  if (count >= 24) return 100;
  if (count >= 12) return 82;
  if (count >= 5) return 58;
  if (count >= 2) return 34;
  return 12;
}

function executionInputs(row: OpportunityViewModel): ExecutionInputs {
  return {
    atrPressure: atrPressure(row),
    decision: cleanText(row.final_decision, "").toUpperCase(),
    entryDistancePct: entryDistancePct(row),
    entryStatus: cleanText(row.entryStatus ?? row.raw.entry_status, "").toLowerCase(),
    macroAlignment: scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score, macroScoreFromLabel(row.macroLabel)),
    relativeVolume: finiteNumber(row.raw.relative_volume ?? row.raw.volume_ratio ?? row.raw.volume_spike_ratio),
    riskReward: finiteNumber(row.raw.risk_reward ?? row.raw.reward_risk_ratio ?? row.raw.conservative_risk_reward),
    setupType: cleanText(row.raw.setup_type ?? row.raw.setup, "").toUpperCase(),
    staleData: row.dataFreshness.status === "stale" || Boolean(row.raw.stale_data) || cleanText(row.raw.data_freshness_status, "").toLowerCase().includes("stale"),
    volatilityPressure: scoreValue(row.raw.volatility_pressure ?? row.raw.atr_percentile, row.fragility),
  };
}

function entryQuality(row: OpportunityViewModel, input: ExecutionInputs): number {
  const distance = input.entryDistancePct ?? 4;
  const status = input.entryStatus;
  const riskRewardScore = input.riskReward === null ? 52 : clamp(34 + input.riskReward * 18);
  let score = 88 - distance * 7.2 - Math.max(0, input.volatilityPressure - 58) * 0.22 - Math.max(0, row.fragility - 62) * 0.18;
  if (status.includes("near") || status.includes("trigger") || status.includes("entry")) score += 8;
  if (status.includes("confirmed") || input.decision === "ENTER") score += 5;
  if (status.includes("extended") || status.includes("chase") || status.includes("overextended")) score -= 22;
  if (input.decision === "AVOID" || input.decision === "EXIT") score -= 8;
  if (input.staleData) score -= 12;
  score = score * 0.78 + riskRewardScore * 0.22;
  return Math.round(clamp(score));
}

function pullbackQuality(row: OpportunityViewModel, input: ExecutionInputs): number {
  const pullbackSetup = /PULLBACK|RETEST|RECLAIM|CORRECTION|DIP/.test(input.setupType);
  const distance = input.entryDistancePct ?? 4;
  const shockPullback = row.shockPattern?.pullbackSuccessRate ?? null;
  const correctionConfidence = cleanText(row.raw.correction_confidence, "").toLowerCase();
  let score = weightedAverage([
    [100 - Math.abs(distance - 1.6) * 10, 0.26],
    [100 - row.fragility, 0.16],
    [input.macroAlignment, 0.14],
    [shockPullback, 0.20],
    [input.decision === "WAIT_PULLBACK" ? 68 : 52, 0.12],
    [input.relativeVolume === null ? null : clamp(45 + (input.relativeVolume - 0.85) * 22), 0.12],
  ], pullbackSetup ? 62 : 50);
  if (pullbackSetup) score += 8;
  if (correctionConfidence.includes("high")) score += 6;
  if (input.entryStatus.includes("extended") || input.entryStatus.includes("chase")) score -= 10;
  return Math.round(clamp(score));
}

function breakoutQuality(row: OpportunityViewModel, input: ExecutionInputs): number {
  const breakoutSetup = /BREAKOUT|MOMENTUM|CONTINUATION|EXPANSION|SQUEEZE/.test(input.setupType);
  const volumeConfirmation = input.relativeVolume === null ? 54 : clamp(44 + (input.relativeVolume - 1) * 24);
  const trendQuality = average([row.conviction, scoreValue(row.final_score, 50), scoreValue(row.raw.technical_score ?? row.raw.setup_score, row.final_score ?? 50)], 50);
  let score = weightedAverage([
    [trendQuality, 0.32],
    [volumeConfirmation, 0.20],
    [input.macroAlignment, 0.16],
    [100 - input.volatilityPressure, 0.12],
    [row.shockPattern?.currentSimilarityScore, 0.10],
    [row.shockPattern?.upsideShockScore, 0.10],
  ], trendQuality);
  if (breakoutSetup) score += 6;
  if (input.entryStatus.includes("confirmed")) score += 7;
  if (input.entryStatus.includes("extended") || (input.entryDistancePct ?? 0) >= 6) score -= 12;
  return Math.round(clamp(score));
}

function confirmationQuality(row: OpportunityViewModel, input: ExecutionInputs): number {
  const volume = input.relativeVolume === null ? 52 : clamp(40 + input.relativeVolume * 28);
  const dataQuality = input.staleData ? 28 : 68;
  const decision = input.decision === "ENTER" ? 72 : input.decision === "WATCH" ? 58 : input.decision === "WAIT_PULLBACK" ? 52 : 42;
  const scoreChange = finiteNumber(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const drift = scoreChange === null ? 52 : clamp(52 + scoreChange * 7);
  return Math.round(clamp(weightedAverage([
    [volume, 0.22],
    [row.conviction, 0.23],
    [input.macroAlignment, 0.16],
    [dataQuality, 0.16],
    [decision, 0.15],
    [drift, 0.08],
  ], 50)));
}

function chaseRisk(row: OpportunityViewModel, input: ExecutionInputs): number {
  const distance = input.entryDistancePct ?? 4;
  const oneDay = Math.abs(percentReturn(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0);
  const fiveDay = Math.abs(percentReturn(row.raw.return_5d) ?? oneDay);
  const rsi = finiteNumber(row.raw.rsi);
  const rsiHeat = rsi === null ? 50 : clamp((rsi - 45) * 2.1);
  let score = weightedAverage([
    [clamp(distance * 9.5), 0.26],
    [row.shockPattern?.chaseRiskScore, 0.22],
    [clamp(oneDay * 8 + fiveDay * 3.8), 0.15],
    [input.volatilityPressure, 0.14],
    [row.fragility, 0.12],
    [rsiHeat, 0.07],
    [input.relativeVolume === null ? null : clamp(34 + input.relativeVolume * 20), 0.04],
  ], 50);
  if (input.entryStatus.includes("extended") || input.entryStatus.includes("chase") || input.entryStatus.includes("overextended")) score += 18;
  if (input.entryStatus.includes("near") || input.entryStatus.includes("pullback")) score -= 8;
  return Math.round(clamp(score));
}

function volatilityExecutionRisk(row: OpportunityViewModel, input: ExecutionInputs): number {
  return Math.round(clamp(weightedAverage([
    [input.volatilityPressure, 0.32],
    [input.atrPressure, 0.24],
    [row.fragility, 0.18],
    [row.shockPattern?.twoSidedVolatilityScore, 0.16],
    [row.eventRisk, 0.10],
  ], input.volatilityPressure)));
}

function executionStateFor(input: {
  breakoutQualityScore: number;
  chaseRiskScore: number;
  confirmationQualityScore: number;
  entryQualityScore: number;
  input: ExecutionInputs;
  pullbackQualityScore: number;
  timingQualityScore: number;
  volatilityExecutionRiskScore: number;
}): ExecutionState {
  if (input.input.staleData) return "confirmation_needed";
  if (input.chaseRiskScore >= 82 || (input.chaseRiskScore >= 74 && input.volatilityExecutionRiskScore >= 68)) return "avoid_chase";
  if (input.entryQualityScore < 42 && (input.input.entryDistancePct ?? 0) >= 6) return "extended_entry";
  if (input.pullbackQualityScore >= 68 && input.confirmationQualityScore < 64) return "wait_for_pullback";
  if (input.confirmationQualityScore < 52 || input.input.staleData) return "confirmation_needed";
  if (input.breakoutQualityScore >= 72 && input.confirmationQualityScore >= 64 && input.chaseRiskScore < 64) return "breakout_confirmed";
  if (input.entryQualityScore >= 72 && input.timingQualityScore >= 68 && input.chaseRiskScore < 55) return "early_opportunity";
  if (input.entryQualityScore >= 58 && input.confirmationQualityScore >= 58) return "trigger_approaching";
  return "confirmation_needed";
}

function zoneContext(row: OpportunityViewModel): ExecutionZoneContext {
  const levels = buildSignalTradeLevels(row.raw);
  return {
    doNotChaseZone: row.shockPattern?.doNotChaseZone ?? doNotChaseZone(row, levels.entryHigh ?? levels.entry),
    historicalEntryZone: row.shockPattern?.researchEntryZone ?? row.entryZoneLabel ?? formatMoney(levels.entry),
    historicalExitZone: row.shockPattern?.historicalExitZone ?? formatMoney(levels.target),
    invalidationZone: row.shockPattern?.invalidationZone ?? formatMoney(levels.stop),
    researchEntryZone: row.entryZoneLabel ?? row.shockPattern?.researchEntryZone ?? formatMoney(levels.entry),
  };
}

function reasonLines(row: OpportunityViewModel, input: ExecutionInputs, scores: {
  breakoutQualityScore: number;
  confirmationQualityScore: number;
  entryQualityScore: number;
  pullbackQualityScore: number;
  timingQualityScore: number;
}): string[] {
  const lines: string[] = [];
  if (scores.entryQualityScore >= 68) lines.push("Current price is close enough to the research entry context for cleaner timing analysis.");
  if (scores.pullbackQualityScore >= 68) lines.push("Pullback structure is the cleaner execution path in the current context.");
  if (scores.breakoutQualityScore >= 70) lines.push("Breakout evidence is supported by trend, volume, or shock-memory context.");
  if (scores.confirmationQualityScore >= 66) lines.push("Confirmation evidence is above the current universe baseline.");
  if (row.shockPattern && row.shockPattern.pullbackSuccessRate !== null) lines.push(`Historical shock memory shows ${Math.round(row.shockPattern.pullbackSuccessRate)}% pullback-success context after comparable shocks.`);
  if (input.macroAlignment >= 64) lines.push("Macro or sector context is not fighting the timing layer.");
  if (scores.timingQualityScore >= 70) lines.push("Timing quality is above the current execution threshold.");
  return lines.slice(0, 4);
}

function riskLines(row: OpportunityViewModel, input: ExecutionInputs, scores: { chaseRiskScore: number; volatilityExecutionRiskScore: number }): string[] {
  const lines: string[] = [];
  if (scores.chaseRiskScore >= 68) lines.push("Chase risk is elevated; cleaner execution likely requires pullback or confirmation.");
  if (scores.volatilityExecutionRiskScore >= 66) lines.push("Volatility is unstable enough to reduce clean execution quality.");
  if ((input.entryDistancePct ?? 0) >= 5) lines.push("Price is extended from the preferred research entry context.");
  const chaseSuccessRate = row.shockPattern?.chaseSuccessRate ?? null;
  if (chaseSuccessRate !== null && chaseSuccessRate < 45) lines.push(`Historical chase success is limited at ${Math.round(chaseSuccessRate)}% in comparable shock samples.`);
  if (row.fragility >= 70) lines.push("Structural fragility is elevated, so timing errors can matter more.");
  if (input.staleData) lines.push("Data freshness requires confirmation before execution context is trusted.");
  return lines.slice(0, 4);
}

function historicalExecutionContextFor(row: OpportunityViewModel): string[] {
  const pattern = row.shockPattern;
  if (!pattern) {
    return [
      "Historical execution context is limited for this symbol.",
      "Use current entry distance, confirmation quality, and volatility stability as the primary timing evidence.",
    ];
  }
  const lines = [
    pattern.pullbackSuccessRate === null ? "Pullback success sample is still limited." : `Comparable shocks historically favored pullback entries ${Math.round(pattern.pullbackSuccessRate)}% of the time.`,
    pattern.chaseSuccessRate === null ? "Chase success sample is still limited." : `Chasing comparable shocks worked ${Math.round(pattern.chaseSuccessRate)}% of the time, so chase risk remains visible.`,
    pattern.timingValidation?.summary ?? null,
    `Historical entry context: ${pattern.researchEntryZone}.`,
    `Historical exit context: ${pattern.historicalExitZone}.`,
  ].filter((line): line is string => Boolean(line));
  return lines.slice(0, 5);
}

function confirmationLines(row: OpportunityViewModel, input: ExecutionInputs, state: ExecutionState): string[] {
  const lines: string[] = [];
  if (state === "wait_for_pullback" || state === "extended_entry" || state === "avoid_chase") {
    lines.push(`Watch whether price returns toward ${zoneContext(row).researchEntryZone}.`);
  }
  if (input.relativeVolume === null || input.relativeVolume < 1.15) lines.push("Look for relative-volume confirmation rather than isolated price movement.");
  if (input.macroAlignment < 58) lines.push("Macro or sector context should stop deteriorating before timing quality improves.");
  if (input.volatilityPressure >= 62) lines.push("Volatility compression or stabilization would improve execution quality.");
  if (row.fragility >= 64) lines.push("Fragility should stop rising before treating the setup as cleaner.");
  if (!lines.length) lines.push("Monitor whether confirmation remains intact without price extending into chase context.");
  return lines.slice(0, 4);
}

function summaryFor(row: OpportunityViewModel, stateLabelValue: string, timingQualityScore: number, chaseRiskScore: number, entryQualityScore: number): string {
  return `${row.symbol} execution state is ${stateLabelValue.toLowerCase()}. Timing quality is ${timingQualityScore}/100, entry quality ${entryQualityScore}/100, and chase risk ${chaseRiskScore}/100. This is timing research, not a trade instruction.`;
}

function systemSummary(input: { averageChaseRisk: number; averageEntryQuality: number; averageTimingQuality: number; count: number }): string {
  return `Execution Intelligence reviewed ${input.count} symbols. Average timing quality is ${input.averageTimingQuality}/100, entry quality ${input.averageEntryQuality}/100, and chase risk ${input.averageChaseRisk}/100. The layer separates setup quality from execution quality.`;
}

function scoreLabel(score: number, label: string, inverse: boolean): ExecutionScore {
  const rounded = Math.round(clamp(score));
  const good = inverse ? rounded <= 42 : rounded >= 68;
  const risk = inverse ? rounded >= 70 : rounded < 45;
  return {
    label,
    score: rounded,
    tone: good ? "positive" : risk ? "risk" : rounded >= 55 ? "neutral" : "caution",
  };
}

function compactLabelsFor(input: {
  chaseRiskScore: number;
  executionState: ExecutionState;
  entryQualityScore: number;
  timingQualityScore: number;
  volatilityExecutionRiskScore: number;
}): string[] {
  const labels: string[] = [stateLabel(input.executionState)];
  if (input.timingQualityScore >= 72) labels.push("Clean Timing");
  if (input.entryQualityScore >= 70) labels.push("High Entry Quality");
  if (input.chaseRiskScore >= 70) labels.push("Chase Risk Elevated");
  if (input.volatilityExecutionRiskScore >= 70) labels.push("Volatility Unstable");
  return [...new Set(labels)].slice(0, 4);
}

function stateLabel(state: ExecutionState): string {
  const labels: Record<ExecutionState, string> = {
    avoid_chase: "Avoid Chase",
    breakout_confirmed: "Breakout Confirmed",
    confirmation_needed: "Confirmation Needed",
    early_opportunity: "Early Opportunity",
    extended_entry: "Extended Entry",
    trigger_approaching: "Trigger Approaching",
    wait_for_pullback: "Wait For Pullback",
  };
  return labels[state];
}

function setupBlendScore(setupType: string, pullbackQualityScore: number, breakoutQualityScore: number): number {
  if (/PULLBACK|RETEST|RECLAIM|CORRECTION|DIP/.test(setupType)) return pullbackQualityScore;
  if (/BREAKOUT|MOMENTUM|CONTINUATION|EXPANSION|SQUEEZE/.test(setupType)) return breakoutQualityScore;
  return average([pullbackQualityScore, breakoutQualityScore], 50);
}

function entryDistancePct(row: OpportunityViewModel): number | null {
  const explicit = finiteNumber(row.raw.entry_distance_pct ?? row.raw.distance_from_entry_pct ?? row.raw.correction_distance_pct);
  if (explicit !== null) return Math.abs(explicit <= 1 ? explicit * 100 : explicit);
  const levels = buildSignalTradeLevels(row.raw);
  const price = row.price ?? firstNumber(row.raw.price);
  const entryLow = levels.entryLow ?? levels.entry;
  const entryHigh = levels.entryHigh ?? levels.entry;
  if (price === null || entryLow === null || entryHigh === null || price <= 0) return null;
  if (price >= entryLow && price <= entryHigh) return 0;
  const reference = price > entryHigh ? entryHigh : entryLow;
  return Math.abs((price - reference) / price) * 100;
}

function doNotChaseZone(row: OpportunityViewModel, entry: number | null): string {
  if (entry === null) return "Do-not-chase zone unavailable";
  const atrPct = atrPercent(row);
  const buffer = Math.max(0.025, atrPct === null ? 0.04 : atrPct * 1.15);
  return `Above ${formatMoney(entry * (1 + buffer))}`;
}

function atrPressure(row: OpportunityViewModel): number {
  const atrPct = atrPercent(row);
  if (atrPct === null) return scoreValue(row.raw.atr_percentile, row.fragility);
  return Math.round(clamp(atrPct * 650));
}

function atrPercent(row: OpportunityViewModel): number | null {
  const raw = finiteNumber(row.raw.atr_pct ?? row.raw.atr_percent);
  if (raw === null) return null;
  return raw > 1 ? raw / 100 : raw;
}

function percentReturn(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value);
  return Math.round(clamp(parsed ?? fallback));
}

function macroScoreFromLabel(label: string): number {
  const normalized = humanizeLabel(label).toLowerCase();
  if (normalized.includes("aligned") || normalized.includes("tailwind") || normalized.includes("support")) return 68;
  if (normalized.includes("conflict") || normalized.includes("headwind")) return 36;
  return 52;
}

function average(values: number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function weightedAverage(values: Array<[number | null | undefined, number]>, fallback: number): number {
  let numerator = 0;
  let denominator = 0;
  for (const [value, weight] of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : fallback;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function meanOrNull(values: number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function rate(values: boolean[]): number | null {
  if (!values.length) return null;
  return values.filter(Boolean).length / values.length;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundOrNull(value: number | null, digits: number): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value, digits);
}

function roundRatioOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value, 3);
}

function formatSignedPercent(value: number): string {
  const rounded = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${value >= 0 ? "+" : ""}${rounded}%`;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
