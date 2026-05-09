import type { CsvRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type AdaptiveCalibrationGroupType = "asset_type" | "decision" | "event_signature" | "market_regime" | "score_bucket" | "setup_type";
export type AdaptiveEvidenceTier = "early" | "developing" | "mature";
export type AdaptiveLearningTrend = "degrading" | "improving" | "insufficient_evidence" | "stable";
export type AdaptiveSeverity = "info" | "positive" | "warning";

export type AdaptiveCalibrationRow = {
  avgDrawdownPct: number | null;
  avgLossPct: number | null;
  avgReturnPct: number | null;
  avgWinPct: number | null;
  count: number;
  expectancyPct: number | null;
  groupType: AdaptiveCalibrationGroupType;
  groupValue: string;
  horizon: string;
  lowConfidence: boolean;
  medianReturnPct: number | null;
  sampleSize: "LOW" | "MEDIUM" | "HIGH";
  winRatePct: number | null;
  worstReturnPct: number | null;
};

export type AdaptiveLearningInsight = {
  detail: string;
  evidenceLabel: string;
  severity: AdaptiveSeverity;
  source: "calibration" | "events" | "regime" | "recommendations" | "shock" | "setup";
  title: string;
};

export type AdaptiveWeightAdjustment = {
  direction: "decrease" | "hold" | "increase";
  factor: string;
  maxAdjustment: number;
  reason: string;
  status: "insufficient_evidence" | "review_only";
  suggestedAdjustment: number;
};

export type AdaptiveLearningCohort = {
  averageReturnPct: number | null;
  count: number;
  detail: string;
  expectancyPct: number | null;
  groupValue: string;
  horizon: string;
  reliabilityScore: number;
  sampleSize: "LOW" | "MEDIUM" | "HIGH";
  winRatePct: number | null;
};

export type AdaptiveRecommendationQuality = {
  avoidQualityScore: number;
  enterQualityScore: number;
  summary: string;
  waitQualityScore: number;
};

export type AdaptiveLearningSystem = {
  adaptiveWeighting: AdaptiveWeightAdjustment[];
  calibrationDriftScore: number;
  confidenceReliabilityScore: number;
  evidenceTier: AdaptiveEvidenceTier;
  eventImpactLearning: AdaptiveLearningInsight[];
  generatedAt: string;
  learningTrend: AdaptiveLearningTrend;
  modelDriftWarnings: AdaptiveLearningInsight[];
  observationCount: number;
  operatorBriefing: string[];
  recommendationQuality: AdaptiveRecommendationQuality;
  regimeLearning: AdaptiveLearningCohort[];
  setupLearning: AdaptiveLearningCohort[];
  shockLearning: AdaptiveLearningInsight[];
  userFacingInsights: AdaptiveLearningInsight[];
};

export type AdaptiveLearningInput = {
  calibrationGroups?: Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>>;
  forwardRows?: CsvRow[];
  generatedAt?: string;
  observationCount?: number;
};

type ForwardObservation = {
  assetType: string;
  decision: string;
  drawdownPct: number | null;
  eventSignature: string;
  finalScore: number | null;
  horizon: string;
  marketRegime: string;
  returnPct: number;
  setupType: string;
};

const PRIMARY_HORIZONS = ["10D", "5D", "3D", "2D", "1D", "20D", "60D"];
const MIN_ADAPTIVE_SAMPLE = 30;
const MAX_WEIGHT_ADJUSTMENT = 4;

export function buildAdaptiveLearningSystem(input: AdaptiveLearningInput): AdaptiveLearningSystem {
  const derivedGroups = input.forwardRows?.length ? calibrationGroupsFromForwardRows(input.forwardRows) : {};
  const groups = mergeGroups(derivedGroups, input.calibrationGroups ?? {});
  const allRows = Object.values(groups).flat();
  const observationCount = input.observationCount ?? inferObservationCount(input.forwardRows, allRows);
  const evidenceTier = evidenceTierFor(observationCount, allRows);
  const primaryHorizon = primaryHorizonFor(allRows);
  const setupLearning = learningCohorts(groups.setup_type ?? [], primaryHorizon, "setup");
  const regimeLearning = learningCohorts(groups.market_regime ?? [], primaryHorizon, "regime");
  const driftWarnings = modelDriftWarnings(groups, primaryHorizon, evidenceTier);
  const shockLearning = shockLearningInsights(groups.setup_type ?? [], primaryHorizon);
  const eventImpactLearning = eventLearningInsights(groups.event_signature ?? [], primaryHorizon);
  const recommendationQuality = recommendationQualityFor(groups.decision ?? [], primaryHorizon);
  const adaptiveWeighting = adaptiveWeightingFor({ evidenceTier, groups, recommendationQuality, setupLearning });
  const calibrationDriftScore = driftScoreFor(driftWarnings, groups.score_bucket ?? [], primaryHorizon);
  const confidenceReliabilityScore = confidenceReliabilityFor({ calibrationDriftScore, evidenceTier, groups, observationCount });
  const learningTrend = learningTrendFor({ calibrationDriftScore, confidenceReliabilityScore, evidenceTier, recommendationQuality });
  const userFacingInsights = userInsightsFor({ eventImpactLearning, recommendationQuality, regimeLearning, setupLearning, shockLearning, warnings: driftWarnings });
  const operatorBriefing = operatorBriefingFor({ adaptiveWeighting, calibrationDriftScore, confidenceReliabilityScore, evidenceTier, learningTrend, observationCount, primaryHorizon });

  return {
    adaptiveWeighting,
    calibrationDriftScore,
    confidenceReliabilityScore,
    evidenceTier,
    eventImpactLearning,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    learningTrend,
    modelDriftWarnings: driftWarnings,
    observationCount,
    operatorBriefing,
    recommendationQuality,
    regimeLearning,
    setupLearning,
    shockLearning,
    userFacingInsights,
  };
}

export function calibrationGroupsFromForwardRows(rows: CsvRow[]): Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>> {
  const observations = rows.map(forwardObservationFromRow).filter((row): row is ForwardObservation => row !== null);
  return {
    asset_type: groupObservations(observations, "asset_type", (row) => row.assetType),
    decision: groupObservations(observations, "decision", (row) => row.decision),
    event_signature: groupObservations(observations.filter((row) => row.eventSignature !== "UNKNOWN"), "event_signature", (row) => row.eventSignature),
    market_regime: groupObservations(observations, "market_regime", (row) => row.marketRegime),
    score_bucket: groupObservations(observations, "score_bucket", (row) => scoreBucket(row.finalScore)),
    setup_type: groupObservations(observations, "setup_type", (row) => row.setupType),
  };
}

function mergeGroups(
  derived: Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>>,
  explicit: Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>>,
): Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>> {
  return {
    asset_type: explicit.asset_type ?? derived.asset_type ?? [],
    decision: explicit.decision ?? derived.decision ?? [],
    event_signature: explicit.event_signature ?? derived.event_signature ?? [],
    market_regime: explicit.market_regime ?? derived.market_regime ?? [],
    score_bucket: explicit.score_bucket ?? derived.score_bucket ?? [],
    setup_type: explicit.setup_type ?? derived.setup_type ?? [],
  };
}

function forwardObservationFromRow(row: CsvRow): ForwardObservation | null {
  const returnPct = percentValue(row.return_pct ?? row.forward_return ?? row.return);
  if (returnPct === null) return null;
  return {
    assetType: normalizedGroup(row.asset_type, "UNKNOWN"),
    decision: normalizedGroup(row.final_decision ?? row.action ?? row.decision, "UNKNOWN"),
    drawdownPct: percentValue(row.max_drawdown_after_signal ?? row.max_drawdown ?? row.drawdown),
    eventSignature: normalizedGroup(row.verified_event_signature ?? row.macro_event_regime_signature ?? row.event_context_label, "UNKNOWN"),
    finalScore: finiteNumber(row.final_score_adjusted ?? row.macro_adjusted_score ?? row.final_score ?? row.score),
    horizon: normalizedHorizon(row.horizon),
    marketRegime: normalizedGroup(row.market_regime ?? row.macro_context_label ?? row.regime, "UNKNOWN"),
    returnPct,
    setupType: normalizedGroup(row.setup_type, "UNKNOWN"),
  };
}

function groupObservations(
  observations: ForwardObservation[],
  groupType: AdaptiveCalibrationGroupType,
  groupValueFor: (row: ForwardObservation) => string,
): AdaptiveCalibrationRow[] {
  const buckets = new Map<string, ForwardObservation[]>();
  for (const row of observations) {
    const key = `${row.horizon}::${groupValueFor(row)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const [horizon, groupValue] = key.split("::");
      const returns = bucket.map((row) => row.returnPct);
      const wins = returns.filter((value) => value > 0);
      const losses = returns.filter((value) => value <= 0);
      const avgWin = meanOrNull(wins);
      const avgLoss = losses.length ? Math.abs(mean(losses)) : null;
      const winRate = bucket.length ? (wins.length / bucket.length) * 100 : null;
      const lossRate = bucket.length ? (losses.length / bucket.length) : 0;
      const expectancy = winRate === null ? null : (winRate / 100) * (avgWin ?? 0) - lossRate * (avgLoss ?? 0);
      const count = bucket.length;
      return {
        avgDrawdownPct: meanOrNull(bucket.map((row) => row.drawdownPct).filter(isFiniteNumber)),
        avgLossPct: avgLoss,
        avgReturnPct: meanOrNull(returns),
        avgWinPct: avgWin,
        count,
        expectancyPct: expectancy,
        groupType,
        groupValue: groupValue ?? "UNKNOWN",
        horizon: horizon ?? "UNKNOWN",
        lowConfidence: count < MIN_ADAPTIVE_SAMPLE,
        medianReturnPct: medianOrNull(returns),
        sampleSize: sampleSizeLabel(count),
        winRatePct: winRate,
        worstReturnPct: returns.length ? Math.min(...returns) : null,
      };
    })
    .sort(compareCalibrationRows)
    .slice(0, 220);
}

function learningCohorts(rows: AdaptiveCalibrationRow[], primaryHorizon: string, source: "regime" | "setup"): AdaptiveLearningCohort[] {
  const filtered = rows
    .filter((row) => row.horizon === primaryHorizon && row.groupValue !== "UNKNOWN")
    .sort((left, right) => reliabilityForRow(right) - reliabilityForRow(left))
    .slice(0, 8);
  return filtered.map((row) => ({
    averageReturnPct: row.avgReturnPct,
    count: row.count,
    detail: cohortDetail(row, source),
    expectancyPct: row.expectancyPct,
    groupValue: humanizeLabel(row.groupValue),
    horizon: row.horizon,
    reliabilityScore: reliabilityForRow(row),
    sampleSize: row.sampleSize,
    winRatePct: row.winRatePct,
  }));
}

function modelDriftWarnings(
  groups: Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>>,
  primaryHorizon: string,
  evidenceTier: AdaptiveEvidenceTier,
): AdaptiveLearningInsight[] {
  const warnings: AdaptiveLearningInsight[] = [];
  const scoreRows = (groups.score_bucket ?? []).filter((row) => row.horizon === primaryHorizon);
  const highScore = weightedMetric(scoreRows.filter((row) => /80|90/.test(row.groupValue)), "expectancyPct");
  const midScore = weightedMetric(scoreRows.filter((row) => /60|70/.test(row.groupValue)), "expectancyPct");
  if (highScore !== null && midScore !== null && midScore > highScore + 1) {
    warnings.push({
      detail: `Mid-score buckets are ahead of higher-score buckets on ${primaryHorizon}. Confidence should be treated as potentially over-optimistic until more evidence confirms the shape.`,
      evidenceLabel: `${formatPct(midScore)} mid vs ${formatPct(highScore)} high expectancy`,
      severity: "warning",
      source: "calibration",
      title: "Score calibration drift detected",
    });
  }

  const decisionRows = (groups.decision ?? []).filter((row) => row.horizon === primaryHorizon);
  const enterRows = decisionRows.filter((row) => /ENTER|BUY|STRONG_BUY/i.test(row.groupValue));
  const enterExpectancy = weightedMetric(enterRows, "expectancyPct");
  const enterCount = enterRows.reduce((sum, row) => sum + row.count, 0);
  if (enterCount >= MIN_ADAPTIVE_SAMPLE && enterExpectancy !== null && enterExpectancy < -0.5) {
    warnings.push({
      detail: `Research-setup outcomes are negative on ${primaryHorizon}. Ranking should keep conservative guardrails active until follow-through improves.`,
      evidenceLabel: `${formatPct(enterExpectancy)} expectancy across ${enterCount} observations`,
      severity: "warning",
      source: "recommendations",
      title: "Recommendation quality weakened",
    });
  }

  if (evidenceTier === "early") {
    warnings.push({
      detail: "Outcome windows are still early. Adaptive learning can summarize evidence but should not tune production weights from this sample.",
      evidenceLabel: "Early evidence",
      severity: "info",
      source: "calibration",
      title: "Evidence maturity still limited",
    });
  }
  return warnings.slice(0, 5);
}

function shockLearningInsights(rows: AdaptiveCalibrationRow[], primaryHorizon: string): AdaptiveLearningInsight[] {
  const shockRows = rows.filter((row) => row.horizon === primaryHorizon && /SHOCK|MOMENTUM|BREAKOUT|VOLATILITY|CONTINUATION/i.test(row.groupValue));
  const best = [...shockRows].filter((row) => row.count >= MIN_ADAPTIVE_SAMPLE).sort((left, right) => Number(right.expectancyPct ?? -Infinity) - Number(left.expectancyPct ?? -Infinity))[0];
  const worst = [...shockRows].filter((row) => row.count >= MIN_ADAPTIVE_SAMPLE).sort((left, right) => Number(left.expectancyPct ?? Infinity) - Number(right.expectancyPct ?? Infinity))[0];
  const insights: AdaptiveLearningInsight[] = [];
  if (best) {
    insights.push({
      detail: `${humanizeLabel(best.groupValue)} has the strongest completed shock-adjacent outcome evidence on ${best.horizon}. Treat this as historical context, not a prediction.`,
      evidenceLabel: `${formatPct(best.expectancyPct)} expectancy, ${best.count} samples`,
      severity: best.expectancyPct !== null && best.expectancyPct > 0 ? "positive" : "info",
      source: "shock",
      title: "Shock pattern learning",
    });
  }
  if (worst && worst !== best && worst.expectancyPct !== null && worst.expectancyPct < 0) {
    insights.push({
      detail: `${humanizeLabel(worst.groupValue)} recently showed weaker follow-through. Shock radar should keep chase-risk warnings visible for similar setups.`,
      evidenceLabel: `${formatPct(worst.expectancyPct)} expectancy, ${worst.count} samples`,
      severity: "warning",
      source: "shock",
      title: "Shock follow-through weakened",
    });
  }
  return insights;
}

function eventLearningInsights(rows: AdaptiveCalibrationRow[], primaryHorizon: string): AdaptiveLearningInsight[] {
  return rows
    .filter((row) => row.horizon === primaryHorizon && row.count >= MIN_ADAPTIVE_SAMPLE)
    .sort((left, right) => Math.abs(Number(right.expectancyPct ?? 0)) - Math.abs(Number(left.expectancyPct ?? 0)))
    .slice(0, 3)
    .map((row) => ({
      detail: `${humanizeLabel(row.groupValue)} has enough completed outcome evidence to monitor as an event-impact cohort. The system should keep event language tied to verified inputs.`,
      evidenceLabel: `${formatPct(row.expectancyPct)} expectancy, ${row.count} samples`,
      severity: row.expectancyPct !== null && row.expectancyPct < 0 ? "warning" : "info",
      source: "events",
      title: "Event impact learning",
    }));
}

function recommendationQualityFor(rows: AdaptiveCalibrationRow[], primaryHorizon: string): AdaptiveRecommendationQuality {
  const horizonRows = rows.filter((row) => row.horizon === primaryHorizon);
  const enterRows = horizonRows.filter((row) => /ENTER|BUY|STRONG_BUY/i.test(row.groupValue));
  const waitRows = horizonRows.filter((row) => /WAIT|WATCH|HOLD|WAIT_PULLBACK/i.test(row.groupValue));
  const avoidRows = horizonRows.filter((row) => /AVOID|EXIT|NO_TRADE/i.test(row.groupValue));
  const enterQualityScore = qualityFromExpectation(weightedMetric(enterRows, "expectancyPct"), weightedMetric(enterRows, "winRatePct"), enterRows.reduce((sum, row) => sum + row.count, 0));
  const waitQualityScore = avoidanceQuality(waitRows);
  const avoidQualityScore = avoidanceQuality(avoidRows);
  const summary = `Recommendation quality is measured from completed ${primaryHorizon} forward windows. ENTER quality ${enterQualityScore}/100, WAIT quality ${waitQualityScore}/100, AVOID quality ${avoidQualityScore}/100.`;
  return { avoidQualityScore, enterQualityScore, summary, waitQualityScore };
}

function adaptiveWeightingFor(input: {
  evidenceTier: AdaptiveEvidenceTier;
  groups: Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>>;
  recommendationQuality: AdaptiveRecommendationQuality;
  setupLearning: AdaptiveLearningCohort[];
}): AdaptiveWeightAdjustment[] {
  const enoughEvidence = input.evidenceTier !== "early";
  const adjustments: AdaptiveWeightAdjustment[] = [];
  const topSetup = input.setupLearning[0];
  const weakSetup = [...input.setupLearning].reverse().find((row) => row.expectancyPct !== null && row.expectancyPct < 0);
  adjustments.push({
    direction: enoughEvidence && topSetup && topSetup.reliabilityScore >= 62 ? "increase" : "hold",
    factor: "setup_quality_weight",
    maxAdjustment: MAX_WEIGHT_ADJUSTMENT,
    reason: topSetup ? `${topSetup.groupValue} has the strongest current setup evidence, but any change must stay bounded and reversible.` : "Setup evidence is not mature enough for weighting changes.",
    status: enoughEvidence ? "review_only" : "insufficient_evidence",
    suggestedAdjustment: enoughEvidence && topSetup && topSetup.reliabilityScore >= 62 ? 2 : 0,
  });
  adjustments.push({
    direction: enoughEvidence && input.recommendationQuality.enterQualityScore < 45 ? "decrease" : "hold",
    factor: "research_signal_aggression",
    maxAdjustment: MAX_WEIGHT_ADJUSTMENT,
    reason: input.recommendationQuality.enterQualityScore < 45 ? "Completed research-signal outcomes are weaker than desired; reduce aggression only after operator review." : "Research-signal outcomes do not require a bounded aggression change.",
    status: enoughEvidence ? "review_only" : "insufficient_evidence",
    suggestedAdjustment: enoughEvidence && input.recommendationQuality.enterQualityScore < 45 ? -2 : 0,
  });
  adjustments.push({
    direction: enoughEvidence && weakSetup ? "increase" : "hold",
    factor: "fragility_penalty_weight",
    maxAdjustment: MAX_WEIGHT_ADJUSTMENT,
    reason: weakSetup ? `${weakSetup.groupValue} has weak outcome evidence; a small fragility penalty increase can be reviewed.` : "No high-evidence weak setup cohort requires extra fragility penalty.",
    status: enoughEvidence ? "review_only" : "insufficient_evidence",
    suggestedAdjustment: enoughEvidence && weakSetup ? 2 : 0,
  });
  return adjustments;
}

function userInsightsFor(input: {
  eventImpactLearning: AdaptiveLearningInsight[];
  recommendationQuality: AdaptiveRecommendationQuality;
  regimeLearning: AdaptiveLearningCohort[];
  setupLearning: AdaptiveLearningCohort[];
  shockLearning: AdaptiveLearningInsight[];
  warnings: AdaptiveLearningInsight[];
}): AdaptiveLearningInsight[] {
  const insights: AdaptiveLearningInsight[] = [];
  const bestSetup = input.setupLearning[0];
  const bestRegime = input.regimeLearning[0];
  if (bestSetup) {
    insights.push({
      detail: `${bestSetup.groupValue} currently has the strongest completed setup evidence in the learning window. This should inform research priority, not force action.`,
      evidenceLabel: `${formatPct(bestSetup.expectancyPct)} expectancy, ${bestSetup.count} samples`,
      severity: bestSetup.expectancyPct !== null && bestSetup.expectancyPct > 0 ? "positive" : "info",
      source: "setup",
      title: "Setup learning",
    });
  }
  if (bestRegime) {
    insights.push({
      detail: `${bestRegime.groupValue} is the strongest regime cohort currently visible in completed outcomes.`,
      evidenceLabel: `${formatPct(bestRegime.expectancyPct)} expectancy, ${bestRegime.count} samples`,
      severity: "info",
      source: "regime",
      title: "Regime learning",
    });
  }
  insights.push(...input.shockLearning.slice(0, 1), ...input.eventImpactLearning.slice(0, 1));
  if (input.recommendationQuality.waitQualityScore >= 62) {
    insights.push({
      detail: "WAIT/avoidance decisions are showing measurable risk-control value in completed windows.",
      evidenceLabel: `${input.recommendationQuality.waitQualityScore}/100 WAIT quality`,
      severity: "positive",
      source: "recommendations",
      title: "Risk-first learning",
    });
  }
  return [...input.warnings.filter((warning) => warning.severity === "warning").slice(0, 1), ...insights].slice(0, 5);
}

function operatorBriefingFor(input: {
  adaptiveWeighting: AdaptiveWeightAdjustment[];
  calibrationDriftScore: number;
  confidenceReliabilityScore: number;
  evidenceTier: AdaptiveEvidenceTier;
  learningTrend: AdaptiveLearningTrend;
  observationCount: number;
  primaryHorizon: string;
}): string[] {
  const reviewCount = input.adaptiveWeighting.filter((item) => item.status === "review_only" && item.suggestedAdjustment !== 0).length;
  return [
    `Adaptive learning is ${input.learningTrend} with ${input.evidenceTier} evidence across ${input.observationCount.toLocaleString()} completed observations.`,
    `Primary learning horizon is ${input.primaryHorizon}; calibration drift is ${input.calibrationDriftScore}/100 and confidence reliability is ${input.confidenceReliabilityScore}/100.`,
    `${reviewCount} bounded weighting proposal${reviewCount === 1 ? "" : "s"} require operator review. No production scoring is self-modified.`,
  ];
}

function confidenceReliabilityFor(input: {
  calibrationDriftScore: number;
  evidenceTier: AdaptiveEvidenceTier;
  groups: Partial<Record<AdaptiveCalibrationGroupType, AdaptiveCalibrationRow[]>>;
  observationCount: number;
}): number {
  const evidenceScore = input.evidenceTier === "mature" ? 82 : input.evidenceTier === "developing" ? 66 : 42;
  const scoreRows = input.groups.score_bucket ?? [];
  const highEvidenceShare = scoreRows.length ? scoreRows.filter((row) => row.sampleSize !== "LOW").length / scoreRows.length : 0;
  return Math.round(clamp(evidenceScore * 0.46 + (100 - input.calibrationDriftScore) * 0.36 + highEvidenceShare * 100 * 0.18));
}

function driftScoreFor(warnings: AdaptiveLearningInsight[], scoreRows: AdaptiveCalibrationRow[], primaryHorizon: string): number {
  const scorePenalty = warnings.filter((warning) => warning.severity === "warning").length * 22;
  const horizonRows = scoreRows.filter((row) => row.horizon === primaryHorizon && row.expectancyPct !== null);
  const monotonicPenalty = monotonicityPenalty(horizonRows);
  return Math.round(clamp(scorePenalty + monotonicPenalty));
}

function learningTrendFor(input: {
  calibrationDriftScore: number;
  confidenceReliabilityScore: number;
  evidenceTier: AdaptiveEvidenceTier;
  recommendationQuality: AdaptiveRecommendationQuality;
}): AdaptiveLearningTrend {
  if (input.evidenceTier === "early") return "insufficient_evidence";
  if (input.calibrationDriftScore >= 55 || input.recommendationQuality.enterQualityScore < 42) return "degrading";
  if (input.confidenceReliabilityScore >= 70 && input.recommendationQuality.enterQualityScore >= 58) return "improving";
  return "stable";
}

function primaryHorizonFor(rows: AdaptiveCalibrationRow[]): string {
  for (const horizon of PRIMARY_HORIZONS) {
    if (rows.some((row) => row.horizon === horizon && row.count >= MIN_ADAPTIVE_SAMPLE)) return horizon;
  }
  return rows[0]?.horizon ?? "UNKNOWN";
}

function evidenceTierFor(observationCount: number, rows: AdaptiveCalibrationRow[]): AdaptiveEvidenceTier {
  if (observationCount >= 500 || rows.some((row) => row.sampleSize === "HIGH")) return "mature";
  if (observationCount >= 100 || rows.some((row) => row.sampleSize === "MEDIUM")) return "developing";
  return "early";
}

function inferObservationCount(forwardRows: CsvRow[] | undefined, rows: AdaptiveCalibrationRow[]): number {
  if (forwardRows?.length) return forwardRows.filter((row) => percentValue(row.return_pct ?? row.forward_return ?? row.return) !== null).length;
  return Math.max(0, ...rows.map((row) => row.count));
}

function cohortDetail(row: AdaptiveCalibrationRow, source: "regime" | "setup"): string {
  const subject = source === "setup" ? "setup type" : "regime";
  return `${humanizeLabel(row.groupValue)} ${subject} has ${row.count} completed ${row.horizon} observations with ${formatPct(row.expectancyPct)} expectancy and ${formatPct(row.winRatePct)} win rate.`;
}

function reliabilityForRow(row: AdaptiveCalibrationRow): number {
  const sample = row.sampleSize === "HIGH" ? 30 : row.sampleSize === "MEDIUM" ? 18 : 4;
  const expectancy = clamp(50 + (row.expectancyPct ?? 0) * 5, 0, 40);
  const drawdownPenalty = Math.min(22, Math.abs(Math.min(0, row.worstReturnPct ?? 0)) * 0.8);
  return Math.round(clamp(sample + expectancy - drawdownPenalty + 25));
}

function qualityFromExpectation(expectancyPct: number | null, winRatePct: number | null, count: number): number {
  if (count < MIN_ADAPTIVE_SAMPLE || expectancyPct === null) return 42;
  return Math.round(clamp(50 + expectancyPct * 6 + ((winRatePct ?? 50) - 50) * 0.45 + Math.min(14, count / 18)));
}

function avoidanceQuality(rows: AdaptiveCalibrationRow[]): number {
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const expectancy = weightedMetric(rows, "expectancyPct");
  const worst = rows.map((row) => row.worstReturnPct).filter(isFiniteNumber);
  if (count < MIN_ADAPTIVE_SAMPLE || expectancy === null) return 42;
  const downsideEvidence = worst.length ? Math.min(20, Math.abs(Math.min(...worst)) * 0.7) : 6;
  return Math.round(clamp(52 - expectancy * 5 + downsideEvidence + Math.min(12, count / 25)));
}

function weightedMetric(rows: AdaptiveCalibrationRow[], key: "expectancyPct" | "winRatePct"): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const row of rows) {
    const value = row[key];
    if (value === null || !Number.isFinite(value)) continue;
    numerator += value * row.count;
    denominator += row.count;
  }
  return denominator > 0 ? numerator / denominator : null;
}

function monotonicityPenalty(rows: AdaptiveCalibrationRow[]): number {
  const scored = rows
    .map((row) => ({ bucket: scoreBucketMidpoint(row.groupValue), expectancy: row.expectancyPct }))
    .filter((row): row is { bucket: number; expectancy: number } => row.bucket !== null && row.expectancy !== null)
    .sort((left, right) => left.bucket - right.bucket);
  if (scored.length < 3) return 0;
  let inversions = 0;
  for (let index = 1; index < scored.length; index += 1) {
    if (scored[index].expectancy + 0.25 < scored[index - 1].expectancy) inversions += 1;
  }
  return Math.min(34, inversions * 11);
}

function scoreBucketMidpoint(value: string): number | null {
  const match = value.match(/(\d+)\D+(\d+)/);
  if (!match) return null;
  return (Number(match[1]) + Number(match[2])) / 2;
}

function scoreBucket(value: number | null): string {
  if (value === null) return "UNKNOWN";
  if (value < 40) return "0-39";
  if (value < 50) return "40-49";
  if (value < 60) return "50-59";
  if (value < 70) return "60-69";
  if (value < 80) return "70-79";
  if (value < 90) return "80-89";
  return "90-100";
}

function sampleSizeLabel(count: number): "LOW" | "MEDIUM" | "HIGH" {
  if (count < MIN_ADAPTIVE_SAMPLE) return "LOW";
  if (count <= 100) return "MEDIUM";
  return "HIGH";
}

function normalizedGroup(value: unknown, fallback: string): string {
  const text = cleanText(value, "").trim();
  if (!text || ["-", "N/A", "NULL", "NONE", "UNDEFINED"].includes(text.toUpperCase())) return fallback;
  return text.toUpperCase();
}

function normalizedHorizon(value: unknown): string {
  const text = normalizedGroup(value, "UNKNOWN");
  if (/^\d+$/.test(text)) return `${text}D`;
  return text;
}

function percentValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function compareCalibrationRows(left: AdaptiveCalibrationRow, right: AdaptiveCalibrationRow): number {
  return horizonRank(left.horizon) - horizonRank(right.horizon) || right.count - left.count || left.groupValue.localeCompare(right.groupValue);
}

function horizonRank(horizon: string): number {
  const match = horizon.match(/(\d+)/);
  return match ? Number(match[1]) : 999;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function meanOrNull(values: number[]): number | null {
  return values.length ? mean(values) : null;
}

function medianOrNull(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function formatPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function adaptiveTrendLabel(value: AdaptiveLearningTrend): string {
  if (value === "insufficient_evidence") return "Evidence still maturing";
  return humanizeLabel(value);
}

export function adaptiveLearningStatusTone(value: AdaptiveLearningTrend): "bad" | "default" | "good" | "warn" {
  if (value === "improving") return "good";
  if (value === "degrading") return "warn";
  if (value === "insufficient_evidence") return "default";
  return "default";
}

export function adaptiveInsightLabel(insight: AdaptiveLearningInsight): string {
  return `${insight.title}: ${insight.evidenceLabel}`;
}
