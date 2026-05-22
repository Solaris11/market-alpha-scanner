import type { RankingRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export type MarketMemoryOutcomePoint = {
  horizon: string;
  returnPct: number | null;
};

export type MarketMemoryCandidate = {
  decision: string | null;
  eventSignature?: string | null;
  finalScore: number | null;
  liquidityBucket?: string | null;
  macroEventRegimeSignature?: string | null;
  macroPressureBucket?: string | null;
  marketRegime: string | null;
  outcomes: MarketMemoryOutcomePoint[];
  scoreBucket: string | null;
  sector: string | null;
  setupType: string | null;
  signalTimestamp: string;
  symbol: string;
  volatilityBucket?: string | null;
  drawdownBucket?: string | null;
};

export type MarketMemoryAnalog = MarketMemoryCandidate & {
  reasonCodes: string[];
  similarityScore: number;
};

export type EvidenceMaturityTier = "high" | "moderate" | "limited" | "unavailable";

export type EvidenceMaturity = {
  explanation: string;
  label: string;
  sampleSize: number;
  tier: EvidenceMaturityTier;
};

export type MarketMemoryOutcomeSummary = {
  averageReturn: number | null;
  downsideRisk: number | null;
  horizon: string;
  medianReturn: number | null;
  winRate: number | null;
};

export type MarketMemoryFreshness = {
  ageMinutes: number | null;
  generatedAt: string;
  label: string;
  sourceLatestAt: string | null;
  status: "fresh" | "aging" | "stale" | "unknown";
};

export type MarketMemoryConfidence = {
  drivers: string[];
  label: string;
  score: number;
};

export type MarketMemoryInsight = {
  invalidationConditions: string[];
  supportingEvidence: string[];
  whatDiffers: string[];
  whatIsSimilar: string[];
  whyItMatters: string;
};

export type MarketMemorySummary = {
  analogs: MarketMemoryAnalog[];
  available: boolean;
  confidence?: MarketMemoryConfidence;
  evidence: EvidenceMaturity;
  freshness?: MarketMemoryFreshness;
  generatedAt?: string;
  insight?: MarketMemoryInsight;
  narrative: string[];
  outcome: MarketMemoryOutcomeSummary | null;
  warnings?: string[];
};

const OUTCOME_HORIZON_PRIORITY = ["10D", "5D", "3D", "2D", "1D"];

export function scoreBucket(value: unknown): string | null {
  const score = finiteNumber(value);
  if (score === null) return null;
  if (score >= 85) return "85+";
  if (score >= 75) return "75-84";
  if (score >= 65) return "65-74";
  if (score >= 55) return "55-64";
  return "<55";
}

export function buildCurrentMemoryCandidate(row: RankingRow): MarketMemoryCandidate {
  return {
    decision: textOrNull(row.final_decision ?? row.action),
    drawdownBucket: drawdownBucket(firstNumeric(rawField(row, "max_drawdown"), rawField(row, "avg_max_drawdown"), rawField(row, "max_drawdown_after_signal"))),
    eventSignature: textOrNull(rawField(row, "verified_event_signature")),
    finalScore: finiteNumber(row.final_score),
    liquidityBucket: liquidityBucket(firstNumeric(rawField(row, "liquidity_pressure"), rawField(row, "liquidity_pressure_adjustment"), rawField(row, "avg_dollar_volume"))),
    macroEventRegimeSignature: textOrNull(rawField(row, "macro_event_regime_signature")),
    macroPressureBucket: pressureBucket(firstNumeric(rawField(row, "macro_pressure_score"), rawField(row, "macro_context_adjustment_total"), rawField(row, "macro_alignment_score"))),
    marketRegime: textOrNull(row.market_regime),
    outcomes: [],
    scoreBucket: scoreBucket(row.final_score),
    sector: textOrNull(row.sector),
    setupType: textOrNull(row.setup_type),
    signalTimestamp: textOrNull(row.last_updated_utc ?? row.last_updated) ?? new Date(0).toISOString(),
    symbol: row.symbol.toUpperCase(),
    volatilityBucket: pressureBucket(firstNumeric(rawField(row, "volatility_pressure"), rawField(row, "atr_pct"), rawField(row, "annualized_volatility"))),
  };
}

export function similarityReasons(current: MarketMemoryCandidate, candidate: MarketMemoryCandidate): string[] {
  const reasons: string[] = [];
  if (sameText(current.setupType, candidate.setupType)) reasons.push("same_setup_type");
  if (sameText(current.marketRegime, candidate.marketRegime)) reasons.push("similar_regime");
  if (sameText(current.sector, candidate.sector)) reasons.push("same_sector");
  if (sameText(current.scoreBucket, candidate.scoreBucket)) reasons.push("similar_score_range");
  if (sameText(current.decision, candidate.decision)) reasons.push("same_decision_state");
  if (sameText(current.eventSignature ?? null, candidate.eventSignature ?? null)) reasons.push("similar_event_context");
  if (sameText(current.macroEventRegimeSignature ?? null, candidate.macroEventRegimeSignature ?? null)) reasons.push("similar_macro_event_regime");
  if (sameText(current.volatilityBucket ?? null, candidate.volatilityBucket ?? null)) reasons.push("similar_volatility_state");
  if (sameText(current.macroPressureBucket ?? null, candidate.macroPressureBucket ?? null)) reasons.push("similar_macro_pressure");
  if (sameText(current.liquidityBucket ?? null, candidate.liquidityBucket ?? null)) reasons.push("similar_liquidity_state");
  if (sameText(current.drawdownBucket ?? null, candidate.drawdownBucket ?? null)) reasons.push("similar_drawdown_profile");
  if (current.symbol === candidate.symbol) reasons.push("same_symbol_memory");
  return reasons;
}

export function marketMemorySimilarity(current: MarketMemoryCandidate, candidate: MarketMemoryCandidate): number {
  let score = 0;
  if (sameText(current.setupType, candidate.setupType)) score += 32;
  if (sameText(current.marketRegime, candidate.marketRegime)) score += 22;
  if (sameText(current.sector, candidate.sector)) score += 16;
  if (sameText(current.scoreBucket, candidate.scoreBucket)) score += 14;
  if (sameText(current.decision, candidate.decision)) score += 8;
  if (sameText(current.eventSignature ?? null, candidate.eventSignature ?? null)) score += 7;
  if (sameText(current.macroEventRegimeSignature ?? null, candidate.macroEventRegimeSignature ?? null)) score += 8;
  if (sameText(current.volatilityBucket ?? null, candidate.volatilityBucket ?? null)) score += 6;
  if (sameText(current.macroPressureBucket ?? null, candidate.macroPressureBucket ?? null)) score += 6;
  if (sameText(current.liquidityBucket ?? null, candidate.liquidityBucket ?? null)) score += 4;
  if (sameText(current.drawdownBucket ?? null, candidate.drawdownBucket ?? null)) score += 4;
  if (current.symbol === candidate.symbol) score += 8;

  if (current.finalScore !== null && candidate.finalScore !== null) {
    score += Math.max(0, 12 - Math.abs(current.finalScore - candidate.finalScore) * 0.8);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function evidenceMaturity(sampleSize: number): EvidenceMaturity {
  if (sampleSize >= 100) {
    return {
      explanation: `High evidence confidence based on ${sampleSize} comparable historical setups. Treat it as context, not a prediction.`,
      label: "High evidence confidence",
      sampleSize,
      tier: "high",
    };
  }
  if (sampleSize >= 30) {
    return {
      explanation: `Moderate evidence confidence based on ${sampleSize} comparable historical setups. Outcomes can still vary by regime.`,
      label: "Moderate evidence confidence",
      sampleSize,
      tier: "moderate",
    };
  }
  if (sampleSize > 0) {
    return {
      explanation: `Limited historical evidence: only ${sampleSize} comparable setup${sampleSize === 1 ? "" : "s"} found so far.`,
      label: "Limited historical evidence",
      sampleSize,
      tier: "limited",
    };
  }
  return {
    explanation: "Market memory is still building. Similar historical setups are not available yet.",
    label: "No comparable memory yet",
    sampleSize,
    tier: "unavailable",
  };
}

export function buildMarketMemorySummary(row: RankingRow, candidates: MarketMemoryCandidate[], options: { generatedAt?: string; maxAnalogs?: number } = {}): MarketMemorySummary {
  const current = buildCurrentMemoryCandidate(row);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const matchedAnalogs = candidates
    .filter((candidate) => candidate.symbol && candidate.signalTimestamp)
    .filter((candidate) => candidate.symbol !== current.symbol || candidate.signalTimestamp !== current.signalTimestamp)
    .map((candidate) => ({
      ...candidate,
      reasonCodes: similarityReasons(current, candidate),
      similarityScore: marketMemorySimilarity(current, candidate),
    }))
    .filter((candidate) => candidate.similarityScore >= 35)
    .sort((left, right) => right.similarityScore - left.similarityScore || String(right.signalTimestamp).localeCompare(String(left.signalTimestamp)));
  const analogs = matchedAnalogs.slice(0, options.maxAnalogs ?? 24);

  const evidence = evidenceMaturity(matchedAnalogs.length);
  const outcome = matchedAnalogs.length ? summarizeOutcomes(matchedAnalogs) : null;
  const freshness = memoryFreshness(generatedAt, current.signalTimestamp);
  const confidence = memoryConfidence(evidence, analogs, outcome);
  const warnings = memoryWarnings(evidence, freshness, outcome);
  return {
    analogs,
    available: matchedAnalogs.length > 0,
    confidence,
    evidence,
    freshness,
    generatedAt,
    insight: memoryInsight(current, analogs, evidence, outcome),
    narrative: buildNarrative(current, matchedAnalogs, outcome),
    outcome,
    warnings,
  };
}

export function summarizeOutcomes(analogs: MarketMemoryAnalog[]): MarketMemoryOutcomeSummary | null {
  const selected = selectOutcomeSeries(analogs);
  if (!selected) return null;
  const sorted = [...selected.values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const midpoint = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
  return {
    averageReturn: total / sorted.length,
    downsideRisk: sorted[0] ?? null,
    horizon: selected.horizon,
    medianReturn: median,
    winRate: sorted.filter((value) => value > 0).length / sorted.length,
  };
}

function selectOutcomeSeries(analogs: MarketMemoryAnalog[]): { horizon: string; values: number[] } | null {
  for (const horizon of OUTCOME_HORIZON_PRIORITY) {
    const values = analogs
      .flatMap((analog) => analog.outcomes)
      .filter((outcome) => outcome.horizon.toUpperCase() === horizon)
      .map((outcome) => outcome.returnPct)
      .filter((value): value is number => value !== null);
    if (values.length >= 3) return { horizon, values };
  }
  return null;
}

function buildNarrative(current: MarketMemoryCandidate, analogs: MarketMemoryAnalog[], outcome: MarketMemoryOutcomeSummary | null): string[] {
  if (!analogs.length) return ["No comparable historical setup cluster is available yet."];
  const top = analogs[0];
  const setup = current.setupType ? humanizeLabel(current.setupType) : "current setup";
  const regime = current.marketRegime ? ` during ${humanizeLabel(current.marketRegime).toLowerCase()} conditions` : "";
  const lines = [`This ${setup.toLowerCase()} resembles ${analogs.length} comparable historical setup${analogs.length === 1 ? "" : "s"}${regime}.`];
  if (outcome) {
    lines.push(`Historically similar setups had a ${formatMemoryPercent(outcome.winRate)} positive-rate over ${outcome.horizon}, with median forward return of ${formatMemoryReturn(outcome.medianReturn)}.`);
  }
  lines.push(`Closest analog: ${top.symbol} on ${formatMemoryDate(top.signalTimestamp)} (${decisionLabel(top.decision)} / ${top.similarityScore}% similarity).`);
  return lines;
}

export function memoryReasonLabel(code: string): string {
  if (code === "same_setup_type") return "same setup";
  if (code === "similar_regime") return "similar regime";
  if (code === "same_sector") return "same sector";
  if (code === "similar_score_range") return "similar score";
  if (code === "same_decision_state") return "same decision state";
  if (code === "similar_event_context") return "similar event context";
  if (code === "similar_macro_event_regime") return "similar macro/event regime";
  if (code === "similar_volatility_state") return "similar volatility state";
  if (code === "similar_macro_pressure") return "similar macro pressure";
  if (code === "similar_liquidity_state") return "similar liquidity state";
  if (code === "similar_drawdown_profile") return "similar drawdown profile";
  if (code === "same_symbol_memory") return "same symbol memory";
  return humanizeLabel(code);
}

export function formatMemoryReturn(value: number | null): string {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

export function formatMemoryPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value * 100)}%`;
}

export function formatMemoryDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC", year: "numeric" }).format(timestamp);
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return null;
  return text;
}

function rawField(row: RankingRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function firstNumeric(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pressureBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 75) return "high_pressure";
  if (value >= 50) return "elevated_pressure";
  if (value >= 25) return "moderate_pressure";
  return "low_pressure";
}

function liquidityBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 1_000_000_000) return "deep_liquidity";
  if (value >= 100_000_000) return "good_liquidity";
  return pressureBucket(value);
}

function drawdownBucket(value: number | null): string | null {
  if (value === null) return null;
  const magnitude = Math.abs(value);
  if (magnitude >= 0.2 || magnitude >= 20) return "deep_drawdown";
  if (magnitude >= 0.1 || magnitude >= 10) return "moderate_drawdown";
  if (magnitude > 0) return "shallow_drawdown";
  return null;
}

function memoryFreshness(generatedAt: string, sourceLatestAt: string | null): MarketMemoryFreshness {
  const generated = Date.parse(generatedAt);
  const source = sourceLatestAt ? Date.parse(sourceLatestAt) : Number.NaN;
  if (!Number.isFinite(generated) || !Number.isFinite(source)) {
    return {
      ageMinutes: null,
      generatedAt,
      label: "Freshness unknown",
      sourceLatestAt,
      status: "unknown",
    };
  }
  const ageMinutes = Math.max(0, Math.round((generated - source) / 60_000));
  if (ageMinutes <= 90) return { ageMinutes, generatedAt, label: "Fresh memory packet", sourceLatestAt, status: "fresh" };
  if (ageMinutes <= 24 * 60) return { ageMinutes, generatedAt, label: "Aging memory packet", sourceLatestAt, status: "aging" };
  return { ageMinutes, generatedAt, label: "Stale memory packet", sourceLatestAt, status: "stale" };
}

function memoryConfidence(evidence: EvidenceMaturity, analogs: MarketMemoryAnalog[], outcome: MarketMemoryOutcomeSummary | null): MarketMemoryConfidence {
  const topSimilarity = analogs[0]?.similarityScore ?? 0;
  const evidenceScore = evidence.tier === "high" ? 88 : evidence.tier === "moderate" ? 68 : evidence.tier === "limited" ? 38 : 12;
  const outcomeScore = outcome ? 12 : 0;
  const score = Math.max(0, Math.min(100, Math.round(evidenceScore * 0.55 + topSimilarity * 0.33 + outcomeScore)));
  return {
    drivers: [
      `${evidence.sampleSize} comparable setups`,
      analogs[0] ? `${analogs[0].similarityScore}% closest similarity` : "no closest analog",
      outcome ? `${outcome.horizon} outcome evidence available` : "outcome evidence limited",
    ],
    label: score >= 75 ? "High memory confidence" : score >= 55 ? "Moderate memory confidence" : score >= 30 ? "Limited memory confidence" : "Memory confidence unavailable",
    score,
  };
}

function memoryWarnings(evidence: EvidenceMaturity, freshness: MarketMemoryFreshness, outcome: MarketMemoryOutcomeSummary | null): string[] {
  const warnings: string[] = [];
  if (evidence.tier === "limited" || evidence.tier === "unavailable") warnings.push(evidence.explanation);
  if (freshness.status === "stale") warnings.push("This memory packet is stale and should be treated as historical context only.");
  if (!outcome) warnings.push("Forward outcome evidence is not deep enough for this analog cluster yet.");
  return warnings;
}

function memoryInsight(current: MarketMemoryCandidate, analogs: MarketMemoryAnalog[], evidence: EvidenceMaturity, outcome: MarketMemoryOutcomeSummary | null): MarketMemoryInsight {
  const top = analogs[0] ?? null;
  const similar = top?.reasonCodes.slice(0, 5).map(memoryReasonLabel) ?? [];
  const differs = differenceLabels(current, top).slice(0, 4);
  return {
    invalidationConditions: [
      "Current market regime diverges from the analog cluster.",
      "Volatility or liquidity pressure moves into a different bucket.",
      "Evidence freshness becomes stale or comparable sample depth falls below the stated threshold.",
    ],
    supportingEvidence: [
      evidence.explanation,
      top ? `Closest analog is ${top.symbol} at ${top.similarityScore}% similarity.` : "No closest analog is available yet.",
      outcome ? `${outcome.horizon} historical outcome summary is available.` : "Outcome evidence is still limited.",
    ],
    whatDiffers: differs.length ? differs : ["No validated differentiator is available yet."],
    whatIsSimilar: similar.length ? similar : ["No validated similarity driver is available yet."],
    whyItMatters: top
      ? "Memory context helps compare today's setup against prior environments while preserving uncertainty."
      : "The absence of analog depth is itself a risk signal for relying on historical comparison.",
  };
}

function differenceLabels(current: MarketMemoryCandidate, top: MarketMemoryAnalog | null): string[] {
  if (!top) return [];
  const labels: string[] = [];
  if (!sameText(current.setupType, top.setupType)) labels.push("setup type differs");
  if (!sameText(current.marketRegime, top.marketRegime)) labels.push("market regime differs");
  if (!sameText(current.sector, top.sector)) labels.push("sector differs");
  if (!sameText(current.volatilityBucket ?? null, top.volatilityBucket ?? null)) labels.push("volatility state differs");
  if (!sameText(current.macroPressureBucket ?? null, top.macroPressureBucket ?? null)) labels.push("macro pressure differs");
  if (!sameText(current.liquidityBucket ?? null, top.liquidityBucket ?? null)) labels.push("liquidity state differs");
  return labels;
}

function sameText(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  return left.trim().toUpperCase().replaceAll("_", " ") === right.trim().toUpperCase().replaceAll("_", " ");
}
