import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { ShockMovePattern } from "@/lib/trading/shock-move";
import type { RankingRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";

export type EvidenceMaturityLabel = "Developing Evidence" | "High Confidence Evidence" | "Limited Evidence" | "Mature Evidence";
export type EvidenceMaturityTier = "developing" | "high" | "limited" | "mature";

export type EvidenceMaturityModel = {
  analogQualityScore: number;
  calibrationDrift: number;
  confidenceConfidence: number;
  confidenceReliability: number;
  evidenceConsistency: number;
  evidenceSampleSize: number;
  historicalDepthDays: number;
  label: EvidenceMaturityLabel;
  limitations: string[];
  outcomeCoverage: number;
  reasons: string[];
  score: number;
  setupReliabilityHistory: number;
  tier: EvidenceMaturityTier;
};

export type EvidenceMaturityInput = {
  analogQualityScore?: number | null;
  calibrationDrift?: number | null;
  confidenceConfidence?: number | null;
  confidenceReliability?: number | null;
  evidenceConsistency?: number | null;
  evidenceSampleSize?: number | null;
  eventSimilarityScore?: number | null;
  historicalDepthDays?: number | null;
  outcomeCoverage?: number | null;
  regimeSimilarityScore?: number | null;
  setupReliabilityHistory?: number | null;
};

export function buildEvidenceMaturity(input: EvidenceMaturityInput): EvidenceMaturityModel {
  const evidenceSampleSize = Math.max(0, Math.round(input.evidenceSampleSize ?? 0));
  const historicalDepthDays = Math.max(0, Math.round(input.historicalDepthDays ?? 0));
  const analogQualityScore = bounded(input.analogQualityScore ?? 0);
  const confidenceReliability = bounded(input.confidenceReliability ?? 0);
  const evidenceConsistency = bounded(input.evidenceConsistency ?? confidenceReliability);
  const calibrationDrift = bounded(input.calibrationDrift ?? Math.max(0, 100 - confidenceReliability));
  const confidenceConfidence = bounded(input.confidenceConfidence ?? weightedAverage([[confidenceReliability, 0.55], [evidenceConsistency, 0.45]], 0));
  const outcomeCoverage = bounded(input.outcomeCoverage ?? 0);
  const regimeSimilarityScore = bounded(input.regimeSimilarityScore ?? 0);
  const eventSimilarityScore = bounded(input.eventSimilarityScore ?? 0);

  const sampleScore = sampleDepthScore(evidenceSampleSize);
  const calendarScore = calendarDepthScore(historicalDepthDays);
  const contextSimilarityScore = Math.max(analogQualityScore, weightedAverage([
    [regimeSimilarityScore, 0.55],
    [eventSimilarityScore, 0.45],
  ], 0));
  const score = Math.round(bounded(weightedAverage([
    [sampleScore, 0.28],
    [calendarScore, 0.24],
    [outcomeCoverage, 0.20],
    [contextSimilarityScore, 0.16],
    [confidenceReliability, 0.08],
    [evidenceConsistency, 0.04],
  ], 0)));
  const driftPenalty = Math.round(Math.max(0, calibrationDrift - 55) * 0.16);
  const adjustedScore = Math.round(bounded(score - driftPenalty));

  const tier = tierFor(adjustedScore, evidenceSampleSize, historicalDepthDays, outcomeCoverage);
  const label = labelFor(tier);

  return {
    analogQualityScore: Math.round(analogQualityScore),
    calibrationDrift: Math.round(calibrationDrift),
    confidenceConfidence: Math.round(confidenceConfidence),
    confidenceReliability: Math.round(confidenceReliability),
    evidenceConsistency: Math.round(evidenceConsistency),
    evidenceSampleSize,
    historicalDepthDays,
    label,
    limitations: limitationsFor({ calibrationDrift, evidenceSampleSize, historicalDepthDays, outcomeCoverage, tier }),
    outcomeCoverage: Math.round(outcomeCoverage),
    reasons: reasonsFor({ analogQualityScore, calibrationDrift, confidenceReliability, evidenceConsistency, evidenceSampleSize, historicalDepthDays, outcomeCoverage, score: adjustedScore }),
    score: adjustedScore,
    setupReliabilityHistory: Math.round(input.setupReliabilityHistory ?? confidenceReliability),
    tier,
  };
}

export function buildEvidenceMaturityFromSignal(
  row: RankingRow,
  context: { marketMemory?: MarketMemorySummary | null; shockPattern?: ShockMovePattern | null } = {},
): EvidenceMaturityModel {
  const memory = context.marketMemory ?? null;
  const shock = context.shockPattern ?? null;
  const explicitSample = firstFinite([
    row.evidence_sample_size,
    row.historical_sample_size,
    row.forward_return_sample_size,
    row.market_memory_sample_size,
    memory?.evidence.sampleSize,
  ]);
  // shockEventCount, not shockEvents.length: on /terminal the array is stripped
  // and the length would silently contribute 0, halving the sample.
  const shockSample = shock ? shock.upsideShockCount + shock.downsideShockCount + shock.shockEventCount : null;
  const evidenceSampleSize = explicitSample ?? shockSample ?? 0;
  const historicalDepthDays = firstFinite([
    row.historical_depth_days,
    row.signal_history_days,
    row.calendar_depth_days,
    shock ? shockDepthDays(shock) : null,
  ]) ?? 0;
  const analogQualityScore = firstFinite([
    row.analog_quality_score,
    row.current_similarity_score,
    shock?.currentSimilarityScore,
    memoryAnalogQuality(memory),
  ]);
  const confidenceReliability = firstFinite([
    row.confidence_reliability,
    row.confidence_confidence,
    row.calibration_reliability,
    row.score_reliability,
    row.reliability_score,
    shock?.reliabilityScore,
  ]);
  const outcomeCoverage = firstFinite([
    percentish(row.outcome_coverage),
    percentish(row.forward_return_coverage),
    shockOutcomeCoverage(shock),
    memoryOutcomeCoverage(memory),
  ]);

  return buildEvidenceMaturity({
    analogQualityScore,
    calibrationDrift: firstFinite([row.calibration_drift, row.calibration_drift_score]),
    confidenceConfidence: firstFinite([row.confidence_confidence, row.confidence_confidence_score]),
    confidenceReliability,
    evidenceConsistency: firstFinite([row.evidence_consistency, row.outcome_consistency]),
    evidenceSampleSize,
    eventSimilarityScore: firstFinite([row.event_similarity_score, row.event_context_available ? 58 : null]),
    historicalDepthDays,
    outcomeCoverage,
    regimeSimilarityScore: firstFinite([row.regime_similarity_score, row.macro_alignment_score]),
    setupReliabilityHistory: firstFinite([row.setup_reliability_history, row.setup_reliability_score, shock?.reliabilityScore]),
  });
}

export function evidenceMaturityTone(tier: EvidenceMaturityTier): "default" | "good" | "warn" {
  if (tier === "high" || tier === "mature") return "good";
  if (tier === "developing") return "default";
  return "warn";
}

function sampleDepthScore(sampleSize: number): number {
  if (sampleSize >= 250) return 100;
  if (sampleSize >= 100) return 86;
  if (sampleSize >= 50) return 68;
  if (sampleSize >= 20) return 45;
  if (sampleSize > 0) return 22;
  return 0;
}

function calendarDepthScore(days: number): number {
  if (days >= 90) return 100;
  if (days >= 60) return 82;
  if (days >= 30) return 62;
  if (days >= 14) return 38;
  if (days > 0) return 18;
  return 0;
}

function tierFor(score: number, sampleSize: number, depthDays: number, outcomeCoverage: number): EvidenceMaturityTier {
  if (score >= 86 && sampleSize >= 250 && depthDays >= 90 && outcomeCoverage >= 70) return "high";
  if (score >= 72 && sampleSize >= 100 && depthDays >= 30 && outcomeCoverage >= 45) return "mature";
  if (score >= 45 && sampleSize >= 20 && depthDays >= 10) return "developing";
  return "limited";
}

function labelFor(tier: EvidenceMaturityTier): EvidenceMaturityLabel {
  if (tier === "high") return "High Confidence Evidence";
  if (tier === "mature") return "Mature Evidence";
  if (tier === "developing") return "Developing Evidence";
  return "Limited Evidence";
}

function reasonsFor(input: {
  analogQualityScore: number;
  calibrationDrift: number;
  confidenceReliability: number;
  evidenceConsistency: number;
  evidenceSampleSize: number;
  historicalDepthDays: number;
  outcomeCoverage: number;
  score: number;
}): string[] {
  const reasons: string[] = [];
  reasons.push(`${input.evidenceSampleSize.toLocaleString()} comparable or linked observations`);
  reasons.push(`${input.historicalDepthDays.toLocaleString()} calendar days of available context`);
  if (input.outcomeCoverage >= 70) reasons.push("forward outcome coverage is strong");
  else if (input.outcomeCoverage >= 40) reasons.push("forward outcome coverage is developing");
  else reasons.push("forward outcome coverage is still limited");
  if (input.calibrationDrift >= 65) reasons.push("calibration drift is elevated, so confidence should be discounted");
  if (input.analogQualityScore >= 70) reasons.push("analog quality is strong enough to support contextual comparisons");
  if (input.evidenceConsistency >= 70) reasons.push("evidence is consistent across completed outcomes");
  if (input.confidenceReliability >= 70) reasons.push("confidence reliability is supported by completed outcome evidence");
  reasons.push(`evidence strength score ${Math.round(input.score)}/100`);
  return reasons.slice(0, 5);
}

function limitationsFor(input: { calibrationDrift: number; evidenceSampleSize: number; historicalDepthDays: number; outcomeCoverage: number; tier: EvidenceMaturityTier }): string[] {
  const limitations: string[] = [];
  if (input.historicalDepthDays < 30) limitations.push("calendar depth is still below a full 30-day evidence window");
  if (input.evidenceSampleSize < 100) limitations.push("sample size is not yet mature enough for strong calibration claims");
  if (input.outcomeCoverage < 45) limitations.push("later outcomes are incomplete for part of the evidence set");
  if (input.calibrationDrift >= 65) limitations.push("recent calibration drift requires extra caution before trusting this score");
  if (input.tier === "limited") limitations.push("treat this as early context, not proof of edge");
  return limitations;
}

function shockDepthDays(pattern: ShockMovePattern): number | null {
  // Precomputed on the server so it survives the /terminal strip; the array is
  // still the source when a caller built the pattern in-process.
  if (pattern.shockEventSpanDays !== null && pattern.shockEventSpanDays !== undefined) return pattern.shockEventSpanDays;
  const timestamps = (pattern.shockEvents ?? []).map((event) => Date.parse(event.eventDate)).filter(Number.isFinite);
  if (!timestamps.length) return null;
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return Math.max(1, Math.round((max - min) / 86_400_000) + 1);
}

function shockOutcomeCoverage(pattern: ShockMovePattern | null): number | null {
  if (!pattern || !pattern.shockEventCount) return null;
  return (pattern.shockCompletedEventCount / pattern.shockEventCount) * 100;
}

function memoryAnalogQuality(memory: MarketMemorySummary | null): number | null {
  if (!memory?.analogs.length) return null;
  const averageSimilarity = mean(memory.analogs.map((analog) => analog.similarityScore));
  return averageSimilarity;
}

function memoryOutcomeCoverage(memory: MarketMemorySummary | null): number | null {
  if (!memory?.analogs.length) return null;
  const withOutcomes = memory.analogs.filter((analog) => analog.outcomes.some((outcome) => outcome.returnPct !== null)).length;
  return (withOutcomes / memory.analogs.length) * 100;
}

function percentish(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  if (Math.abs(parsed) <= 1) return parsed * 100;
  return parsed;
}

function firstFinite(values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function bounded(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function weightedAverage(values: Array<[number | null, number]>, fallback: number): number {
  let weight = 0;
  let total = 0;
  for (const [value, itemWeight] of values) {
    if (value === null || !Number.isFinite(value)) continue;
    total += value * itemWeight;
    weight += itemWeight;
  }
  return weight > 0 ? total / weight : fallback;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
