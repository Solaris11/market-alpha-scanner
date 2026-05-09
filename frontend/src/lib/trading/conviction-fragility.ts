import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import { buildDecisionFactors, buildDecisionIntelligence, reasonCodes } from "@/lib/trading/decision-intelligence";
import type { MacroExchangeContext } from "@/lib/trading/macro-regime";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type ConvictionTier = "high" | "moderate" | "weak";
export type FragilityTier = "low" | "moderate" | "high";
export type DecayStage = "fresh" | "maturing" | "extended" | "decaying" | "unknown";
export type DriftDirection = "rising" | "stable" | "weakening" | "unavailable";
export type PressureDirection = "tailwind" | "mixed" | "pressure";

export type ScoreLabel = {
  label: string;
  score: number;
  tier: ConvictionTier | FragilityTier;
};

export type SetupDecay = {
  explanation: string;
  label: string;
  stage: DecayStage;
};

export type ConfidenceDrift = {
  delta: number | null;
  direction: DriftDirection;
  explanation: string;
  label: string;
  latestScore: number | null;
  observationCount: number;
};

export type InvalidationAssessment = {
  conditions: string[];
  label: string;
  proximityPct: number | null;
  riskScore: number;
  structuralIntegrity: number;
};

export type PressureContribution = {
  direction: PressureDirection;
  explanation: string;
  key: string;
  label: string;
  score: number;
};

export type HistoricalFragilityContext = {
  available: boolean;
  lines: string[];
  riskScore: number;
};

export type ConvictionFragilityModel = {
  conviction: ScoreLabel;
  decay: SetupDecay;
  drift: ConfidenceDrift;
  fragility: ScoreLabel;
  historicalFragility: HistoricalFragilityContext;
  invalidation: InvalidationAssessment;
  netPressureScore: number;
  pressure: PressureContribution[];
  structuralLabel: string;
  summary: string;
};

export type ConvictionFragilityInput = {
  history?: SignalHistoryPoint[];
  macroContext?: MacroExchangeContext;
  marketMemory?: MarketMemorySummary;
};

type FactorMap = Record<string, number | undefined>;

const HIGH_RISK_CODES = new Set([
  "BEAR_MARKET",
  "DATA_STALE",
  "EXTREME_VOLATILITY",
  "HIGH_VOLATILITY",
  "LOW_CONFIDENCE_DATA",
  "MACRO_MISMATCH",
  "OVEREXTENDED_ENTRY",
  "POOR_RISK_REWARD",
  "PROVIDER_ERROR",
  "RISK_OFF_MARKET",
  "STALE_DATA",
  "STOP_RISK",
  "WEAK_VOLUME",
  "WEAK_VOLUME_CONFIRMATION",
]);

export function buildConvictionFragilityModel(row: RankingRow, input: ConvictionFragilityInput = {}): ConvictionFragilityModel {
  const intelligence = buildDecisionIntelligence(row);
  const factors = toFactorMap(buildDecisionFactors(row));
  const codes = diagnosticCodes(row);
  const drift = confidenceDrift(input.history ?? [], row);
  const historicalFragility = historicalContext(input.marketMemory);
  const invalidation = invalidationAssessment(row, factors, codes);
  const pressure = pressureContributions(row, factors, input.marketMemory, input.macroContext);
  const netPressureScore = Math.round(average(pressure.map((item) => item.score), 50));
  const convictionScore = convictionScoreFor({ factors, historicalFragility, intelligence, drift, netPressureScore, row, codes });
  const fragilityScore = fragilityScoreFor({ factors, historicalFragility, invalidation, intelligence, drift, row, codes, macroContext: input.macroContext });
  const decay = setupDecay(row, input.history ?? [], drift, codes, fragilityScore);
  const conviction = convictionLabel(convictionScore);
  const fragility = fragilityLabel(fragilityScore);
  const structuralLabel = structuralState(convictionScore, fragilityScore, decay.stage);

  return {
    conviction,
    decay,
    drift,
    fragility,
    historicalFragility,
    invalidation,
    netPressureScore,
    pressure,
    structuralLabel,
    summary: summaryLine({ conviction, decay, drift, fragility, structuralLabel }),
  };
}

export function convictionLabel(score: number): ScoreLabel {
  if (score >= 75) return { label: "High conviction", score: Math.round(clamp(score)), tier: "high" };
  if (score >= 55) return { label: "Moderate conviction", score: Math.round(clamp(score)), tier: "moderate" };
  return { label: "Weak conviction", score: Math.round(clamp(score)), tier: "weak" };
}

export function fragilityLabel(score: number): ScoreLabel {
  if (score >= 70) return { label: "High fragility", score: Math.round(clamp(score)), tier: "high" };
  if (score >= 42) return { label: "Moderate fragility", score: Math.round(clamp(score)), tier: "moderate" };
  return { label: "Low fragility", score: Math.round(clamp(score)), tier: "low" };
}

function convictionScoreFor({
  codes,
  drift,
  factors,
  historicalFragility,
  intelligence,
  netPressureScore,
  row,
}: {
  codes: string[];
  drift: ConfidenceDrift;
  factors: FactorMap;
  historicalFragility: HistoricalFragilityContext;
  intelligence: ReturnType<typeof buildDecisionIntelligence>;
  netPressureScore: number;
  row: RankingRow;
}): number {
  const evidenceStack = average([
    intelligence.confidence,
    intelligence.readiness_score,
    intelligence.setup_strength,
    average([factors.trend, factors.momentum, factors.volume, factors.risk, factors.macro, factors.data_quality], 50),
  ], 50);
  const memorySupport = 100 - historicalFragility.riskScore;
  const driftSupport = drift.direction === "rising" ? 72 : drift.direction === "weakening" ? 36 : drift.direction === "stable" ? 58 : 50;
  let score = evidenceStack * 0.58 + netPressureScore * 0.16 + memorySupport * 0.14 + driftSupport * 0.12;
  score = score * 0.94 + eventContribution(row) * 0.06;
  score -= codes.filter((code) => HIGH_RISK_CODES.has(code)).length * 4;
  if (normalizedDecision(row) === "AVOID" || normalizedDecision(row) === "EXIT") score -= 12;
  if (normalizedDecision(row) === "ENTER" && intelligence.readiness_score >= 70) score += 4;
  return Math.round(clamp(score));
}

function fragilityScoreFor({
  codes,
  drift,
  factors,
  historicalFragility,
  invalidation,
  intelligence,
  macroContext,
  row,
}: {
  codes: string[];
  drift: ConfidenceDrift;
  factors: FactorMap;
  historicalFragility: HistoricalFragilityContext;
  invalidation: InvalidationAssessment;
  intelligence: ReturnType<typeof buildDecisionIntelligence>;
  macroContext?: MacroExchangeContext;
  row: RankingRow;
}): number {
  const riskPressure = 100 - (factors.risk ?? 50);
  const macroFactorPressure = 100 - (factors.macro ?? 50);
  const dataPressure = 100 - (factors.data_quality ?? 60);
  const volatilityPressure = volatilityRisk(row, factors);
  const vetoPressure = Math.min(34, codes.filter((code) => HIGH_RISK_CODES.has(code)).length * 8);
  const driftPressure = drift.direction === "weakening" ? 16 : drift.direction === "rising" ? -8 : 0;
  const setupPressure = intelligence.setup_type === "AVOID" ? 16 : intelligence.setup_strength < 45 ? 10 : 0;
  const memoryPressure = historicalFragility.riskScore * 0.55;
  const macroContextPressure = macroContext ? macroContext.macroPressureScore * 0.10 + macroContext.volatilityPressure * 0.08 + macroContext.liquidityPressure * 0.07 : 0;
  const eventPressure = eventRisk(row) * 0.09 + Math.max(0, finiteNumber(row.event_fragility_adjustment) ?? 0) * 2.2;
  const raw =
    riskPressure * 0.20 +
    volatilityPressure * 0.17 +
    macroFactorPressure * 0.14 +
    dataPressure * 0.10 +
    invalidation.riskScore * 0.18 +
    memoryPressure * 0.11 +
    macroContextPressure +
    eventPressure +
    vetoPressure +
    driftPressure +
    setupPressure;
  return Math.round(clamp(raw));
}

function setupDecay(row: RankingRow, history: SignalHistoryPoint[], drift: ConfidenceDrift, codes: string[], fragilityScore: number): SetupDecay {
  const entryDistance = finiteNumber(row.entry_distance_pct);
  const overextended = codes.includes("OVEREXTENDED_ENTRY") || codes.includes("SETUP_REJECTED_EXTENDED") || codes.includes("BREAKOUT_REJECTED_EXTENDED");
  const observationCount = history.length;
  if (overextended || (entryDistance !== null && Math.abs(entryDistance) >= 6)) {
    return {
      explanation: "Setup is extended relative to the available entry context. Treat the edge as more chase-sensitive.",
      label: "Extended setup",
      stage: "extended",
    };
  }
  if (drift.direction === "weakening" && (drift.delta ?? 0) <= -4) {
    return {
      explanation: "Confidence has weakened across recent observations, so the setup is decaying rather than strengthening.",
      label: "Decaying setup",
      stage: "decaying",
    };
  }
  if (fragilityScore >= 72 && normalizedDecision(row) !== "ENTER") {
    return {
      explanation: "Fragility is elevated while decision quality is not fully aligned. The setup should prove stability before being treated as cleaner.",
      label: "Decaying setup",
      stage: "decaying",
    };
  }
  if (observationCount >= 20) {
    return {
      explanation: "The setup has persisted across many observations. Persistence is useful, but late-stage follow-through should be monitored.",
      label: "Maturing setup",
      stage: "maturing",
    };
  }
  if (observationCount > 0) {
    return {
      explanation: "The setup is still early in the visible history window. Freshness improves context, but evidence remains limited.",
      label: "Fresh setup",
      stage: "fresh",
    };
  }
  return {
    explanation: "Setup age is unavailable because no symbol history points were provided.",
    label: "Decay unavailable",
    stage: "unknown",
  };
}

function confidenceDrift(history: SignalHistoryPoint[], row: RankingRow): ConfidenceDrift {
  const scores = history
    .map((point) => point.final_score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const latestScore = finiteNumber(row.confidence_score ?? row.final_score) ?? scores.at(-1) ?? null;
  if (scores.length < 2) {
    return {
      delta: null,
      direction: "unavailable",
      explanation: "Confidence drift needs at least two comparable history points.",
      label: "Drift unavailable",
      latestScore,
      observationCount: scores.length,
    };
  }
  const recent = scores.slice(-8);
  const delta = recent.at(-1)! - recent[0];
  const direction: DriftDirection = delta >= 3 ? "rising" : delta <= -3 ? "weakening" : "stable";
  const label = direction === "rising" ? "Confidence rising" : direction === "weakening" ? "Confidence weakening" : "Confidence stable";
  const explanation = direction === "rising"
    ? `Confidence improved by ${delta.toFixed(1)} points across the recent visible history window.`
    : direction === "weakening"
      ? `Confidence weakened by ${Math.abs(delta).toFixed(1)} points across the recent visible history window.`
      : "Confidence is broadly stable across the recent visible history window.";
  return {
    delta,
    direction,
    explanation,
    label,
    latestScore,
    observationCount: scores.length,
  };
}

function invalidationAssessment(row: RankingRow, factors: FactorMap, codes: string[]): InvalidationAssessment {
  const price = finiteNumber(row.price);
  const invalidation = firstNumeric(row.stop_loss, row.invalidation_level, row.recent_swing_low, row.swing_low, row.support_level, row.support);
  const proximityPct = price !== null && invalidation !== null && price > 0 ? Math.abs((price - invalidation) / price) * 100 : null;
  let riskScore = 40;
  if (proximityPct !== null) {
    if (proximityPct <= 2) riskScore += 28;
    else if (proximityPct <= 5) riskScore += 16;
    else if (proximityPct >= 14) riskScore -= 8;
  }
  riskScore += Math.max(0, 55 - (factors.risk ?? 55)) * 0.38;
  riskScore += Math.max(0, 55 - (factors.macro ?? 55)) * 0.20;
  riskScore += codes.includes("STOP_RISK") ? 18 : 0;
  riskScore += codes.includes("POOR_RISK_REWARD") ? 14 : 0;
  riskScore = clamp(riskScore);
  const structuralIntegrity = Math.round(clamp(100 - riskScore));
  return {
    conditions: invalidationConditions({ codes, factors, proximityPct, row }),
    label: riskScore >= 70 ? "Invalidation risk elevated" : riskScore >= 45 ? "Invalidation risk moderate" : "Invalidation risk contained",
    proximityPct,
    riskScore: Math.round(riskScore),
    structuralIntegrity,
  };
}

function pressureContributions(row: RankingRow, factors: FactorMap, memory?: MarketMemorySummary, macroContext?: MacroExchangeContext): PressureContribution[] {
  if (macroContext) {
    return [
      contribution("macro", "Macro Alignment", macroContext.macroAlignmentScore, macroContext.regimeExplanation),
      contribution("exchange", "Exchange Health", macroContext.exchangeHealthScore, `${macroContext.exchangeContextLabel}.`),
      contribution("sector", "Sector / Theme", macroContext.sectorAlignmentScore, macroContext.themeContext),
      contribution("liquidity", "Liquidity", 100 - macroContext.liquidityPressure, "Liquidity pressure lowers this contribution when the backdrop is tightening."),
      contribution("volatility", "Volatility", 100 - macroContext.volatilityPressure, "Volatility pressure lowers this contribution when ranges are expanding."),
      contribution("event", "Verified Events", eventContribution(row), eventContributionExplanation(row)),
      contribution("memory", "Market Memory", memoryContribution(memory), "Historical analogs contribute only probabilistic context, not certainty."),
    ];
  }
  return [
    contribution("macro", "Macro Pressure", factors.macro ?? 50, "Macro alignment is derived from scanner regime and macro factor context."),
    contribution("sector", "Sector Momentum", sectorScore(row, factors), "Sector context uses available scanner sector and setup strength data."),
    contribution("risk", "Risk / Reward", factors.risk ?? 50, "Risk contribution reflects risk/reward, veto, and penalty context."),
    contribution("volatility", "Volatility Risk", 100 - volatilityRisk(row, factors), "Higher volatility pressure reduces this contribution score."),
    contribution("event", "Verified Events", eventContribution(row), eventContributionExplanation(row)),
    contribution("data", "Data Quality", factors.data_quality ?? 60, "Data quality supports conviction when scanner freshness and provider context are clean."),
    contribution("memory", "Market Memory", memoryContribution(memory), "Historical analogs contribute only probabilistic context, not certainty."),
  ];
}

function historicalContext(memory?: MarketMemorySummary): HistoricalFragilityContext {
  if (!memory?.available || !memory.outcome) {
    return {
      available: false,
      lines: ["Historical fragility context is limited until comparable analog outcomes are available."],
      riskScore: 50,
    };
  }
  const winRate = memory.outcome.winRate ?? 0.5;
  const median = memory.outcome.medianReturn ?? 0;
  const downside = memory.outcome.downsideRisk ?? 0;
  let riskScore = 45;
  if (winRate < 0.45) riskScore += 18;
  if (winRate >= 0.58) riskScore -= 10;
  if (median < 0) riskScore += 10;
  if (median > 0.01) riskScore -= 5;
  if (downside <= -0.08) riskScore += 18;
  else if (downside <= -0.04) riskScore += 9;
  riskScore = clamp(riskScore);
  const lines = [
    `Comparable historical setups: ${memory.evidence.sampleSize}. Evidence tier: ${memory.evidence.label.toLowerCase()}.`,
    `Over ${memory.outcome.horizon}, similar setups had ${formatRate(winRate)} positive-rate and ${formatReturn(median)} median forward return.`,
    downside < 0 ? `Worst comparable analog was ${formatReturn(downside)}, so downside tails remain part of the context.` : "Comparable analog downside tails were muted in the selected horizon.",
  ];
  return {
    available: true,
    lines,
    riskScore: Math.round(riskScore),
  };
}

function memoryContribution(memory?: MarketMemorySummary): number {
  if (!memory?.available || !memory.outcome) return 50;
  const winRate = memory.outcome.winRate ?? 0.5;
  const median = memory.outcome.medianReturn ?? 0;
  const downside = memory.outcome.downsideRisk ?? 0;
  return clamp(48 + (winRate - 0.5) * 70 + median * 250 + Math.max(-18, downside * 120));
}

function eventRisk(row: RankingRow): number {
  return finiteNumber(row.event_risk_score) ?? 50;
}

function eventContribution(row: RankingRow): number {
  if (!booleanish(field(row, "event_context_available"))) return 50;
  const risk = eventRisk(row);
  const conviction = finiteNumber(row.event_conviction_adjustment) ?? 0;
  const fragility = finiteNumber(row.event_fragility_adjustment) ?? 0;
  return clamp(100 - risk + conviction * 4 - fragility * 2.5);
}

function eventContributionExplanation(row: RankingRow): string {
  const summary = cleanText(row.event_context_summary, "");
  if (summary) return summary;
  if (!booleanish(field(row, "event_context_available"))) return "Verified event context is limited until trusted feed data is available.";
  return "Verified event context contributes probabilistic pressure and catalyst context, not certainty.";
}

function volatilityRisk(row: RankingRow, factors: FactorMap): number {
  const factorPressure = 100 - (factors.volatility ?? 50);
  const atrPct = percentish(row.atr_pct ?? row.atr_percent ?? row.annualized_volatility ?? row.volatility ?? row.volatility_pct);
  const atrPressure = atrPct === null ? 45 : atrPct >= 8 ? 82 : atrPct >= 5 ? 66 : atrPct >= 3 ? 52 : 34;
  return clamp(factorPressure * 0.45 + atrPressure * 0.55);
}

function diagnosticCodes(row: RankingRow): string[] {
  return uniqueCodes([
    ...reasonCodes(field(row, "vetoes")),
    ...reasonCodes(field(row, "veto_reason")),
    ...reasonCodes(field(row, "decision_reason_codes")),
    ...reasonCodes(field(row, "event_context_reason_codes")),
    ...reasonCodes(field(row, "setup_reason_codes")),
  ]);
}

function invalidationConditions({
  codes,
  factors,
  proximityPct,
  row,
}: {
  codes: string[];
  factors: FactorMap;
  proximityPct: number | null;
  row: RankingRow;
}): string[] {
  const conditions: string[] = [];
  if (proximityPct !== null && proximityPct <= 5) conditions.push("Price is close to the available invalidation or support context.");
  if ((factors.risk ?? 60) < 50 || codes.includes("POOR_RISK_REWARD")) conditions.push("Risk/reward context needs to improve before structure looks cleaner.");
  if ((factors.macro ?? 60) < 50 || codes.includes("MACRO_MISMATCH")) conditions.push("Market context is not fully aligned with the setup.");
  if (codes.includes("OVEREXTENDED_ENTRY")) conditions.push("Entry context is extended; a reset toward support would reduce chase risk.");
  if (codes.includes("HIGH_VOLATILITY") || codes.includes("EXTREME_VOLATILITY")) conditions.push("Volatility needs to stabilize for structural integrity to improve.");
  if (codes.includes("EVENT_RISK_ELEVATED") || codes.includes("EVENT_FRAGILITY_PRESSURE")) conditions.push("Verified event pressure should settle before the setup is treated as structurally cleaner.");
  if (conditions.length) return uniqueText(conditions).slice(0, 4);
  const stop = firstNumeric(row.stop_loss, row.invalidation_level);
  if (stop !== null) conditions.push(`Available invalidation context is near ${formatPrice(stop)}.`);
  conditions.push("Watch for trend, momentum, and risk context to remain aligned on fresh scanner updates.");
  return conditions.slice(0, 4);
}

function structuralState(convictionScore: number, fragilityScore: number, decayStage: DecayStage): string {
  if (decayStage === "decaying") return "Decaying Setup";
  if (convictionScore >= 72 && fragilityScore >= 62) return "Strong but Fragile";
  if (convictionScore >= 72 && fragilityScore < 42) return "Stable High Conviction";
  if (fragilityScore >= 72) return "Elevated Fragility";
  if (decayStage === "extended") return "Extended / Chase Sensitive";
  if (convictionScore >= 55) return "Moderate Conviction";
  return "Weak Structure";
}

function summaryLine({
  conviction,
  decay,
  drift,
  fragility,
  structuralLabel,
}: {
  conviction: ScoreLabel;
  decay: SetupDecay;
  drift: ConfidenceDrift;
  fragility: ScoreLabel;
  structuralLabel: string;
}): string {
  const driftClause = drift.direction === "unavailable" ? "confidence drift is not established yet" : drift.label.toLowerCase();
  return `${structuralLabel}: ${conviction.label.toLowerCase()} with ${fragility.label.toLowerCase()}; ${driftClause}; ${decay.label.toLowerCase()}.`;
}

function contribution(key: string, label: string, score: number, explanation: string): PressureContribution {
  const bounded = Math.round(clamp(score));
  const direction: PressureDirection = bounded >= 65 ? "tailwind" : bounded < 45 ? "pressure" : "mixed";
  return { direction, explanation, key, label, score: bounded };
}

function sectorScore(row: RankingRow, factors: FactorMap): number {
  const setupStrength = finiteNumber(row.setup_strength);
  const sectorText = cleanText(row.sector, "");
  const base = average([setupStrength, factors.trend, factors.momentum], 50);
  if (!sectorText) return base;
  return clamp(base + (sectorText.toLowerCase().includes("unknown") ? -4 : 2));
}

function toFactorMap(factors: ReturnType<typeof buildDecisionFactors>): FactorMap {
  const mapped: FactorMap = {};
  for (const factorItem of factors) mapped[factorItem.key] = factorItem.value;
  return mapped;
}

function normalizedDecision(row: RankingRow): string {
  return cleanText(row.final_decision ?? row.action, "WATCH").toUpperCase().replace(/[\s-]+/g, "_");
}

function firstNumeric(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function percentish(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numbers.length) return fallback;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function field(row: RankingRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function booleanish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y"].includes(String(value ?? "").trim().toLowerCase());
}

function uniqueCodes(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean)));
}

function uniqueText(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatRate(value: number): string {
  return `${Math.round(clamp(value * 100))}%`;
}

function formatReturn(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(value >= 100 ? 2 : 3)}`;
}

export function compactStructuralLabel(model: ConvictionFragilityModel): string {
  if (model.structuralLabel === "Stable High Conviction") return "Stable Trend";
  if (model.structuralLabel === "Strong but Fragile") return "Strong but Fragile";
  if (model.decay.stage === "decaying") return "Decaying Setup";
  if (model.fragility.tier === "high") return "Elevated Fragility";
  if (model.conviction.tier === "high") return "High Conviction";
  return model.structuralLabel;
}

export function pressureTone(direction: PressureDirection): string {
  if (direction === "tailwind") return "Tailwind";
  if (direction === "pressure") return "Pressure";
  return "Mixed";
}

export function decayStageLabel(stage: DecayStage): string {
  if (stage === "fresh") return "Fresh";
  if (stage === "maturing") return "Maturing";
  if (stage === "extended") return "Extended";
  if (stage === "decaying") return "Decaying";
  return "Unknown";
}

export function humanPressureLabel(key: string): string {
  return humanizeLabel(key);
}
