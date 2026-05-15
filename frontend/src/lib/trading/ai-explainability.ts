import { freshnessFromTimestamp, type DataFreshness } from "@/lib/data-health";
import type { RankingRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";
import { buildDecisionFactors, buildDecisionIntelligence, type DecisionFactor } from "./decision-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";

export type ExplainabilityTone = "constructive" | "caution" | "risk" | "neutral" | "intelligence";

export type ExplainabilityPillar = {
  detail: string;
  label: string;
  tone: ExplainabilityTone;
  value: string;
};

export type ScoreExplainability = {
  dataSupport: string[];
  increasedBy: string[];
  label: string;
  summary: string;
  tone: ExplainabilityTone;
  value: number | null;
  weakenedBy: string[];
};

export type ConfidenceExplainability = {
  contradictionCount: number;
  evidenceQuality: string;
  freshness: string;
  level: string;
  macroAlignment: string;
  summary: string;
  tone: ExplainabilityTone;
  uncertainty: string;
  value: number;
  whyChanged: string;
};

export type ContradictionInsight = {
  detail: string;
  evidence: string[];
  severity: "high" | "medium" | "low";
  title: string;
};

export type TrustBadge = {
  detail: string;
  label: string;
  tone: ExplainabilityTone;
};

export type AIExplainabilityModel = {
  beginnerSummary: string;
  confidence: ConfidenceExplainability;
  contradictions: ContradictionInsight[];
  copilotQuestions: string[];
  mentalModel: string;
  pillars: ExplainabilityPillar[];
  score: ScoreExplainability;
  trustBadges: TrustBadge[];
  whatToMonitor: string[];
};

type ExplainabilitySource = {
  evidenceLabel: string;
  evidenceScore: number | null;
  evidenceTier: string | null;
  freshness: DataFreshness;
  row: RankingRow;
  symbol: string;
};

const MENTAL_MODEL = "TradeVeto does not predict the future. It organizes market intelligence, risk pressure, evidence quality, and freshness so you can monitor the right context.";

export function buildAIExplainabilityFromSignal(row: RankingRow): AIExplainabilityModel {
  const source: ExplainabilitySource = {
    evidenceLabel: evidenceLabelFromRow(row),
    evidenceScore: evidenceScoreFromRow(row),
    evidenceTier: stringOrNull(row.evidence_maturity),
    freshness: freshnessFromTimestamp(stringOrNull(row.last_updated ?? row.last_updated_utc)),
    row,
    symbol: row.symbol.toUpperCase(),
  };
  return buildModel(source);
}

export function buildAIExplainabilityFromOpportunity(opportunity: OpportunityViewModel): AIExplainabilityModel {
  const source: ExplainabilitySource = {
    evidenceLabel: opportunity.evidence?.label ?? evidenceLabelFromRow(opportunity.raw),
    evidenceScore: opportunity.evidence?.score ?? evidenceScoreFromRow(opportunity.raw),
    evidenceTier: opportunity.evidence?.tier ?? stringOrNull(opportunity.raw.evidence_maturity),
    freshness: opportunity.dataFreshness,
    row: opportunity.raw,
    symbol: opportunity.symbol,
  };
  return buildModel(source);
}

function buildModel(source: ExplainabilitySource): AIExplainabilityModel {
  const intelligence = buildDecisionIntelligence(source.row);
  const factors = buildDecisionFactors(source.row);
  const factorMap = new Map(factors.map((factor) => [factor.key, factor.value]));
  const score = numeric(rawField(source.row, "final_score")) ?? numeric(rawField(source.row, "final_score_adjusted")) ?? null;
  const contradictions = buildContradictions(source, factorMap, score, intelligence.confidence);
  const scoreModel = buildScoreExplainability(source, factors, score, intelligence);
  const confidence = buildConfidenceExplainability(source, factorMap, contradictions, intelligence.confidence);
  const trustBadges = buildTrustBadges(source, factorMap, contradictions);
  const whatToMonitor = uniqueText([
    ...intelligence.what_to_watch,
    ...contradictions.map((item) => item.detail),
    "Whether the next fresh scanner packet confirms or weakens this view.",
  ]).slice(0, 4);
  const pillars: ExplainabilityPillar[] = [
    {
      detail: scoreModel.summary,
      label: "Score",
      tone: scoreModel.tone,
      value: score === null ? "N/A" : `${Math.round(score)}`,
    },
    {
      detail: confidence.uncertainty,
      label: "Confidence",
      tone: confidence.tone,
      value: confidence.level,
    },
    {
      detail: `${contradictions.length} active contradiction${contradictions.length === 1 ? "" : "s"} from real factor checks.`,
      label: "Contradictions",
      tone: contradictions.length ? "caution" : "constructive",
      value: contradictions.length ? `${contradictions.length}` : "Clear",
    },
    {
      detail: source.freshness.message,
      label: "Freshness",
      tone: source.freshness.status === "fresh" ? "constructive" : source.freshness.status === "stale" ? "risk" : "caution",
      value: source.freshness.label,
    },
  ];

  return {
    beginnerSummary: beginnerSummary(source.symbol, score, confidence, contradictions),
    confidence,
    contradictions,
    copilotQuestions: [
      `Why did ${source.symbol} appear?`,
      `What increased risk for ${source.symbol}?`,
      `What is contradicting ${source.symbol}?`,
      `What needs confirmation for ${source.symbol}?`,
      `Is macro helping ${source.symbol}?`,
    ],
    mentalModel: MENTAL_MODEL,
    pillars,
    score: scoreModel,
    trustBadges,
    whatToMonitor,
  };
}

function buildScoreExplainability(
  source: ExplainabilitySource,
  factors: DecisionFactor[],
  score: number | null,
  intelligence: ReturnType<typeof buildDecisionIntelligence>,
): ScoreExplainability {
  const positiveFactors = [...factors]
    .filter((factor) => factor.value >= 65)
    .sort((left, right) => right.value - left.value)
    .map((factor) => `${factor.label}: ${Math.round(factor.value)}/100`);
  const weakFactors = [...factors]
    .filter((factor) => factor.value < 50)
    .sort((left, right) => left.value - right.value)
    .map((factor) => `${factor.label}: ${Math.round(factor.value)}/100`);
  const increasedBy = uniqueText([...positiveFactors, ...intelligence.why.positives]).slice(0, 4);
  const weakenedBy = uniqueText([
    ...weakFactors,
    ...intelligence.why.negatives,
    source.evidenceScore !== null && source.evidenceScore < 45 ? `Evidence quality is limited: ${source.evidenceLabel}` : null,
    source.freshness.status === "stale" ? "Signal freshness is stale" : null,
  ]).slice(0, 4);
  const summary = score === null
    ? "No complete score is available for this packet yet."
    : score >= 70
      ? "The score is elevated because several scored factors are aligned, but it still needs risk and evidence checks."
      : score >= 50
        ? "The score is mixed; there is enough context to monitor, but confirmation and risk quality still matter."
        : "The score is weak or blocked because one or more risk, evidence, or setup factors are not clean.";
  return {
    dataSupport: uniqueText([
      source.evidenceLabel,
      source.freshness.message,
      `${factors.length} scored factor${factors.length === 1 ? "" : "s"} available`,
      `Decision state: ${humanizeLabel(intelligence.decision)}`,
    ]).slice(0, 4),
    increasedBy: increasedBy.length ? increasedBy : ["No strong positive factor is dominant yet."],
    label: scoreLabel(score),
    summary,
    tone: scoreTone(score),
    value: score,
    weakenedBy: weakenedBy.length ? weakenedBy : ["No major weakening factor surfaced in the available diagnostics."],
  };
}

function buildConfidenceExplainability(
  source: ExplainabilitySource,
  factorMap: Map<string, number>,
  contradictions: ContradictionInsight[],
  confidence: number,
): ConfidenceExplainability {
  const dataQuality = factorMap.get("data_quality") ?? source.evidenceScore ?? null;
  const macro = factorMap.get("macro") ?? numeric(rawField(source.row, "macro_alignment_score")) ?? numeric(rawField(source.row, "macro_score"));
  const uncertainty = uncertaintyLabel(source, dataQuality, contradictions);
  const whyChanged = source.freshness.status === "stale"
    ? "Confidence weakens when the scanner packet is stale and needs a fresh scan confirmation."
    : contradictions.length
      ? "Confidence is moderated by contradictions between score, risk, macro, evidence, or freshness."
      : "Confidence comes from the latest scored factors, evidence quality, and freshness checks.";
  return {
    contradictionCount: contradictions.length,
    evidenceQuality: dataQuality === null ? source.evidenceLabel : `${source.evidenceLabel} (${Math.round(dataQuality)}/100)`,
    freshness: source.freshness.message,
    level: confidenceLabel(confidence),
    macroAlignment: macro === null ? "Macro support not scored" : macro >= 65 ? "Macro support is aligned" : macro < 45 ? "Macro support is weak" : "Macro support is mixed",
    summary: `${confidenceLabel(confidence)} confidence based on evidence quality, freshness, macro alignment, and contradiction checks.`,
    tone: confidenceToneFor(confidence, contradictions, source),
    uncertainty,
    value: confidence,
    whyChanged,
  };
}

function buildContradictions(
  source: ExplainabilitySource,
  factorMap: Map<string, number>,
  score: number | null,
  confidence: number,
): ContradictionInsight[] {
  const row = source.row;
  const contradictions: ContradictionInsight[] = [];
  const evidenceLimited = isLimitedEvidence(source);
  const momentum = factorMap.get("momentum") ?? numeric(rawField(row, "momentum_score"));
  const macro = factorMap.get("macro") ?? numeric(rawField(row, "macro_alignment_score")) ?? numeric(rawField(row, "macro_score"));
  const risk = factorMap.get("risk");
  const trend = factorMap.get("trend") ?? numeric(rawField(row, "trend_score")) ?? numeric(rawField(row, "technical_score"));
  const volatilityPressure = numeric(rawField(row, "volatility_pressure")) ?? numeric(rawField(row, "event_shock_pressure_score"));
  const breadth = numeric(rawField(row, "breadth_score")) ?? numeric(rawField(row, "market_breadth_score"));
  const eventRisk = numeric(rawField(row, "event_risk_score")) ?? numeric(rawField(row, "verified_event_pressure_score"));

  if ((score ?? 0) >= 65 && evidenceLimited) {
    contradictions.push({
      detail: "The score is attention-worthy, but historical evidence is still limited. Treat this as context to monitor, not proof.",
      evidence: [`Score ${scoreText(score)}`, source.evidenceLabel],
      severity: "high",
      title: "High score, limited evidence",
    });
  }
  if ((momentum ?? 0) >= 70 && (breadth ?? 100) < 45) {
    contradictions.push({
      detail: "Momentum is constructive while market breadth is weak, so the move may not be broadly supported.",
      evidence: [`Momentum ${scoreText(momentum)}`, `Breadth ${scoreText(breadth)}`],
      severity: "medium",
      title: "Momentum vs weak breadth",
    });
  }
  if ((score ?? 0) >= 60 && (macro ?? 100) < 45) {
    contradictions.push({
      detail: "The setup has attention value, but macro support is not aligned enough to raise confidence.",
      evidence: [`Score ${scoreText(score)}`, `Macro ${scoreText(macro)}`],
      severity: "medium",
      title: "Setup vs weak macro support",
    });
  }
  if ((trend ?? 0) >= 68 && (volatilityPressure ?? 0) >= 70) {
    contradictions.push({
      detail: "Trend is visible, but volatility pressure is elevated. Confirmation and entry quality matter more.",
      evidence: [`Trend ${scoreText(trend)}`, `Volatility pressure ${scoreText(volatilityPressure)}`],
      severity: "high",
      title: "Trend vs elevated volatility",
    });
  }
  if ((risk ?? 100) < 45 && (score ?? 0) >= 60) {
    contradictions.push({
      detail: "The score is not enough by itself because risk context is not clean.",
      evidence: [`Risk factor ${scoreText(risk)}`, `Score ${scoreText(score)}`],
      severity: "high",
      title: "Score vs risk pressure",
    });
  }
  if ((eventRisk ?? 0) >= 70) {
    contradictions.push({
      detail: "Verified event pressure is elevated, so the signal needs fresh confirmation after the event context settles.",
      evidence: [`Event risk ${scoreText(eventRisk)}`],
      severity: "medium",
      title: "Event pressure elevated",
    });
  }
  if (confidence >= 65 && source.freshness.status === "stale") {
    contradictions.push({
      detail: "Confidence was strong, but the packet is stale. A fresh scan should confirm the same view.",
      evidence: [`Confidence ${confidence}`, source.freshness.message],
      severity: "medium",
      title: "Confidence vs stale data",
    });
  }
  return contradictions.slice(0, 6);
}

function buildTrustBadges(source: ExplainabilitySource, factorMap: Map<string, number>, contradictions: ContradictionInsight[]): TrustBadge[] {
  const macro = factorMap.get("macro") ?? numeric(rawField(source.row, "macro_alignment_score")) ?? numeric(rawField(source.row, "macro_score"));
  const badges: TrustBadge[] = [
    {
      detail: source.freshness.message,
      label: source.freshness.status === "fresh" ? "Fresh packet" : source.freshness.status === "stale" ? "Needs refresh" : "Freshness limited",
      tone: source.freshness.status === "fresh" ? "constructive" : source.freshness.status === "stale" ? "risk" : "caution",
    },
    {
      detail: source.evidenceLabel,
      label: isLimitedEvidence(source) ? "Evidence limited" : "Evidence available",
      tone: isLimitedEvidence(source) ? "caution" : "constructive",
    },
    {
      detail: macro === null ? "Macro alignment is not available in this packet." : `Macro alignment ${Math.round(macro)}/100.`,
      label: macro === null ? "Macro unavailable" : macro >= 65 ? "Macro aligned" : macro < 45 ? "Macro weak" : "Macro mixed",
      tone: macro === null ? "neutral" : macro >= 65 ? "constructive" : macro < 45 ? "risk" : "caution",
    },
  ];
  if (contradictions.length) {
    badges.push({
      detail: `${contradictions.length} contradiction${contradictions.length === 1 ? "" : "s"} surfaced from real scored factors.`,
      label: "Contradictions visible",
      tone: "caution",
    });
  }
  return badges;
}

function beginnerSummary(symbol: string, score: number | null, confidence: ConfidenceExplainability, contradictions: ContradictionInsight[]): string {
  const scorePart = score === null ? "does not have a complete score yet" : `has a ${Math.round(score)}/100 attention score`;
  const contradictionPart = contradictions.length ? `with ${contradictions.length} contradiction check${contradictions.length === 1 ? "" : "s"} to review` : "with no major contradiction surfaced";
  return `${symbol} ${scorePart}. Confidence is ${confidence.level.toLowerCase()} ${contradictionPart}. This is research context, not a prediction or instruction.`;
}

function evidenceLabelFromRow(row: RankingRow): string {
  const label = stringOrNull(row.evidence_maturity) ?? stringOrNull(row.evidence_label);
  if (label) return humanizeLabel(label);
  const samples = numeric(row.evidence_sample_size ?? row.historical_sample_size ?? row.forward_return_sample_size);
  if (samples !== null) return `${Math.round(samples)} evidence sample${Math.round(samples) === 1 ? "" : "s"}`;
  return "Evidence still building";
}

function evidenceScoreFromRow(row: RankingRow): number | null {
  const direct = numeric(row.score_reliability ?? row.confidence_reliability ?? row.analog_quality_score ?? row.outcome_coverage);
  if (direct !== null) return clamp(direct);
  const samples = numeric(row.evidence_sample_size ?? row.historical_sample_size ?? row.forward_return_sample_size);
  if (samples === null) return null;
  return clamp((samples / 50) * 100);
}

function isLimitedEvidence(source: ExplainabilitySource): boolean {
  const tier = source.evidenceTier?.toLowerCase() ?? "";
  if (tier.includes("limited") || tier.includes("low")) return true;
  if (source.evidenceScore !== null && source.evidenceScore < 45) return true;
  return /\b(limited|low|unavailable|missing|insufficient|building)\b/i.test(source.evidenceLabel);
}

function uncertaintyLabel(source: ExplainabilitySource, dataQuality: number | null, contradictions: ContradictionInsight[]): string {
  if (contradictions.some((item) => item.severity === "high")) return "High uncertainty from conflicting score, risk, evidence, or volatility signals.";
  if (source.freshness.status === "stale") return "Moderate uncertainty because the packet needs a fresh scan.";
  if (isLimitedEvidence(source)) return "Moderate uncertainty because evidence is still building.";
  if (dataQuality !== null && dataQuality < 55) return "Moderate uncertainty because data quality is weaker than preferred.";
  if (contradictions.length) return "Some uncertainty remains because at least one factor conflicts with the main score.";
  return "Uncertainty is contained in the available packet, but future conditions can still change.";
}

function confidenceToneFor(confidence: number, contradictions: ContradictionInsight[], source: ExplainabilitySource): ExplainabilityTone {
  if (contradictions.some((item) => item.severity === "high") || source.freshness.status === "stale") return "risk";
  if (confidence >= 70 && !contradictions.length) return "constructive";
  if (confidence < 45) return "risk";
  if (contradictions.length || confidence < 60) return "caution";
  return "intelligence";
}

function confidenceLabel(value: number): string {
  if (value >= 75) return "High";
  if (value >= 60) return "Moderate";
  if (value >= 45) return "Low";
  return "Very low";
}

function scoreLabel(value: number | null): string {
  if (value === null) return "No score yet";
  if (value >= 75) return "High attention";
  if (value >= 60) return "Watch closely";
  if (value >= 45) return "Mixed";
  return "Weak or blocked";
}

function scoreTone(value: number | null): ExplainabilityTone {
  if (value === null) return "neutral";
  if (value >= 70) return "constructive";
  if (value >= 50) return "caution";
  return "risk";
}

function scoreText(value: number | null | undefined): string {
  return value === null || value === undefined ? "N/A" : `${Math.round(value)}/100`;
}

function rawField(row: RankingRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = finiteNumber(String(value ?? "").replace(/[%,$]/g, "").trim());
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "-"].includes(text.toLowerCase())) return null;
  return text;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = humanizeInsightText(value, "").trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
}
