import type { RankingRow } from "@/lib/types";

export type DecisionIntelligence = {
  confidence: number;
  decision: string;
  regime: string;
  regime_impact: string;
  readiness_score: number;
  risks: string[];
  what_to_watch: string[];
  why: {
    negatives: string[];
    positives: string[];
  };
};

export type DecisionFactor = {
  key: string;
  label: string;
  value: number;
};

const POSITIVE_FACTOR_COPY: Record<string, string> = {
  breakout: "Structure is improving",
  data_quality: "Data quality is strong",
  fundamental: "Fundamental context is supportive",
  macro: "Market context is aligned",
  momentum: "Momentum is constructive",
  news: "News context is not a blocker",
  recommendation_quality: "Recommendation quality is supportive",
  risk: "Risk context is cleaner",
  trend: "Trend structure is constructive",
  volatility: "Volatility profile is manageable",
  volume: "Volume confirmation is constructive",
};

const NEGATIVE_FACTOR_COPY: Record<string, string> = {
  breakout: "Structure is not confirmed yet",
  data_quality: "Data quality is weaker",
  fundamental: "Fundamental context is mixed",
  macro: "Market context is not aligned",
  momentum: "Momentum is not confirmed",
  news: "News context is mixed",
  recommendation_quality: "Recommendation quality is weaker",
  risk: "Risk context is not clean",
  trend: "Trend structure is not strong enough",
  volatility: "Volatility needs to stabilize",
  volume: "Volume confirmation is weak",
};

const REASON_POSITIVE_COPY: Record<string, string> = {
  BREAKOUT_SETUP: "Structure is being tracked as a breakout-style setup",
  HIGH_SCORE: "Composite score is elevated",
  MACRO_ALIGNED: "Market context is aligned enough to monitor",
  MOMENTUM_CONFIRMED: "Momentum confirmation is present",
  PULLBACK_SETUP: "Pullback structure is part of the setup context",
  RISK_REWARD_ACCEPTABLE: "Risk/reward context is acceptable",
  TREND_CONFIRMED: "Trend confirmation is present",
  TREND_CONTINUATION_SETUP: "Trend-continuation structure is present",
  VOLUME_CONFIRMED: "Volume confirmation is present",
};

const REASON_NEGATIVE_COPY: Record<string, string> = {
  LOW_SCORE: "Composite score is not strong enough",
  MACRO_MISMATCH: "Market context is not aligned",
  MIXED_SETUP: "Setup structure is mixed",
};

const VETO_NEGATIVE_COPY: Record<string, string> = {
  DATA_STALE: "Scanner data is stale",
  EXTREME_VOLATILITY: "Volatility is extremely elevated",
  HIGH_VOLATILITY: "Volatility is elevated",
  LOW_CONFIDENCE_DATA: "Data confidence is low",
  MACRO_MISMATCH: "Market context is not aligned",
  MISSING_PRICE_HISTORY: "Price history is incomplete",
  OVEREXTENDED_ENTRY: "Entry context is extended",
  OVERHEATED_MARKET: "Market conditions are overheated",
  POOR_RISK_REWARD: "Risk/reward context is not favorable",
  PROVIDER_ERROR: "Market data provider returned an error",
  BEAR_MARKET: "Bear regime is active",
  RISK_OFF_MARKET: "Market regime is risk-off",
  STALE_DATA: "Scanner data is stale",
  STOP_RISK: "Price is too close to invalidation context",
  WEAK_VOLUME: "Volume confirmation is weak",
  WEAK_VOLUME_CONFIRMATION: "Volume confirmation is weak",
};

const WATCH_COPY: Record<string, string> = {
  DATA_STALE: "Wait for a fresh scanner run before relying on this context.",
  EXTREME_VOLATILITY: "Wait for volatility to stabilize before treating the setup as cleaner.",
  HIGH_VOLATILITY: "Wait for volatility to stabilize and ranges to become more orderly.",
  LOW_CONFIDENCE_DATA: "Wait for stronger data confirmation from the scanner.",
  MACRO_MISMATCH: "Wait for market context and symbol behavior to align.",
  MISSING_PRICE_HISTORY: "Wait until enough price history is available for reliable scoring.",
  OVEREXTENDED_ENTRY: "Wait for a pullback toward support or AVWAP context.",
  OVERHEATED_MARKET: "Wait for overheated market conditions to cool.",
  POOR_RISK_REWARD: "Monitor for a cleaner balance between risk and potential reward.",
  PROVIDER_ERROR: "Wait for provider coverage to recover or confirm with the next scan.",
  BEAR_MARKET: "Wait for market structure to stabilize before elevating breakout-style setups.",
  RISK_OFF_MARKET: "Wait for the market regime to improve before elevating this setup.",
  STALE_DATA: "Wait for a fresh scanner run before relying on this context.",
  STOP_RISK: "Monitor for price to move away from invalidation context.",
  WEAK_VOLUME: "Wait for volume expansion before treating confirmation as stronger.",
  WEAK_VOLUME_CONFIRMATION: "Wait for volume expansion before treating confirmation as stronger.",
};

const SEVERE_VETOES = new Set(["BEAR_MARKET", "EXTREME_VOLATILITY", "MISSING_PRICE_HISTORY", "PROVIDER_ERROR", "RISK_OFF_MARKET", "STALE_DATA", "DATA_STALE"]);

export function buildDecisionIntelligence(row: RankingRow): DecisionIntelligence {
  const decision = normalizedDecision(row);
  const factors = buildDecisionFactors(row);
  const vetoes = uniqueCodes([
    ...reasonCodes(rawField(row, "vetoes")),
    ...reasonCodes(rawField(row, "veto_reason")),
  ]);
  const reasonCodesList = uniqueCodes([
    ...reasonCodes(rawField(row, "decision_reason_codes")),
    ...vetoes,
  ]);
  const confidence = confidenceValue(row, factors, vetoes);
  const dataQuality = factorValue(factors, "data_quality") ?? numeric(rawField(row, "data_quality_score")) ?? 75;
  const readiness_score = readinessScore({ confidence, dataQuality, decision, vetoes });
  const positives = positiveReasons(factors, reasonCodesList);
  const negatives = negativeReasons(factors, reasonCodesList, vetoes);
  const risks = riskReasons(vetoes, dataQuality);
  const what_to_watch = watchConditions({ factors, reasonCodesList, vetoes });
  const regime = normalizedRegime(row);
  const regime_impact = regimeImpact(row, regime);

  return {
    confidence,
    decision,
    regime,
    regime_impact,
    readiness_score,
    risks,
    what_to_watch,
    why: {
      negatives: ensureNonEmpty(negatives, "No major negative diagnostic was flagged."),
      positives: ensureNonEmpty(positives, "Scanner diagnostics are available for this setup."),
    },
  };
}

function normalizedRegime(row: RankingRow): string {
  const regime = normalizeCode(String(rawField(row, "market_regime") ?? ""));
  return regime || "NEUTRAL";
}

function regimeImpact(row: RankingRow, regime: string): string {
  const explicit = String(rawField(row, "regime_impact") ?? "").trim();
  if (explicit) return explicit;
  if (regime === "OVERHEATED") return "Overheated market: scanner is reducing breakout signals and increasing risk filters.";
  if (regime === "RISK_OFF") return "Risk-off market: scanner requires stronger confirmation and is filtering weaker setups.";
  if (regime === "BEAR") return "Bear regime: scanner is disabling breakout-style buy intent and emphasizing risk controls.";
  if (regime === "BULL") return "Bull regime: scanner allows constructive momentum and structure to count, while risk gates remain active.";
  return "Neutral regime: scanner is using balanced scoring and standard risk filters.";
}

export function buildDecisionFactors(row: RankingRow): DecisionFactor[] {
  const structured = structuredFactorScores(row);
  const riskPenalty = numeric(rawField(row, "risk_penalty")) ?? 0;
  const riskReward = numeric(rawField(row, "risk_reward"));
  const riskRewardComponent = riskReward === null ? 50 : clampScore(riskReward * 35);
  const fallbackRisk = clampScore(100 - riskPenalty * 5 + (riskRewardComponent - 50) * 0.25);
  const stale = booleanish(rawField(row, "stale_data")) || booleanish(rawField(row, "low_confidence_data"));

  return [
    factor("trend", "Trend", structured.trend ?? numeric(rawField(row, "trend_score")) ?? numeric(rawField(row, "technical_score")) ?? numeric(rawField(row, "final_score")) ?? 50),
    factor("momentum", "Momentum", structured.momentum ?? numeric(rawField(row, "momentum_score")) ?? numeric(rawField(row, "technical_score")) ?? 50),
    factor("volume", "Volume", structured.volume ?? numeric(rawField(row, "volume_score")) ?? numeric(rawField(row, "relative_volume_score")) ?? 50),
    factor("risk", "Risk", structured.risk ?? fallbackRisk),
    factor("volatility", "Volatility", structured.volatility ?? 50),
    factor("breakout", "Structure", structured.breakout ?? numeric(rawField(row, "breakout_score")) ?? 50),
    factor("macro", "Macro", structured.macro ?? numeric(rawField(row, "macro_score")) ?? 50),
    factor("data_quality", "Data Quality", structured.data_quality ?? numeric(rawField(row, "data_quality_score")) ?? (stale ? 35 : 75)),
  ];
}

export function reasonCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeCode(String(item))).filter(Boolean);
  if (value && typeof value === "object") return [];
  const text = String(value ?? "").trim();
  if (!text || text === "[object Object]") return [];
  const parsed = parseJsonArray(text);
  if (parsed) return parsed.map((item) => normalizeCode(String(item))).filter(Boolean);
  return text.split(/[,|;]/).map(normalizeCode).filter(Boolean);
}

function positiveReasons(factors: DecisionFactor[], codes: string[]): string[] {
  const fromCodes = codes
    .map((code) => REASON_POSITIVE_COPY[code])
    .filter((item): item is string => Boolean(item));
  const fromFactors = [...factors]
    .filter((item) => item.value >= 70)
    .sort((left, right) => right.value - left.value)
    .map((item) => POSITIVE_FACTOR_COPY[item.key] ?? `${item.label} is constructive`);
  return uniqueText([...fromCodes, ...fromFactors]).slice(0, 3);
}

function negativeReasons(factors: DecisionFactor[], codes: string[], vetoes: string[]): string[] {
  const fromVetoes = vetoes
    .map((code) => VETO_NEGATIVE_COPY[code])
    .filter((item): item is string => Boolean(item));
  const fromCodes = codes
    .map((code) => REASON_NEGATIVE_COPY[code])
    .filter((item): item is string => Boolean(item));
  const fromFactors = [...factors]
    .filter((item) => item.value < 45)
    .sort((left, right) => left.value - right.value)
    .map((item) => NEGATIVE_FACTOR_COPY[item.key] ?? `${item.label} is weak`);
  return uniqueText([...fromVetoes, ...fromCodes, ...fromFactors]).slice(0, 3);
}

function riskReasons(vetoes: string[], dataQuality: number): string[] {
  const risks = vetoes
    .map((code) => VETO_NEGATIVE_COPY[code])
    .filter((item): item is string => Boolean(item));
  if (dataQuality < 70) risks.push("Data quality is below the preferred threshold");
  return ensureNonEmpty(uniqueText(risks).slice(0, 3), "No hard risk veto is active in the available diagnostics.");
}

function watchConditions({ factors, reasonCodesList, vetoes }: { factors: DecisionFactor[]; reasonCodesList: string[]; vetoes: string[] }): string[] {
  const fromVetoes = uniqueCodes([...vetoes, ...reasonCodesList])
    .map((code) => WATCH_COPY[code])
    .filter((item): item is string => Boolean(item));
  const weakFactors = [...factors].filter((item) => item.value < 60).sort((left, right) => left.value - right.value);
  const fromFactors = weakFactors.map((item) => {
    if (item.key === "trend") return "Monitor for stronger trend confirmation.";
    if (item.key === "momentum") return "Monitor for momentum to improve on later scans.";
    if (item.key === "volume") return "Wait for volume expansion before treating confirmation as stronger.";
    if (item.key === "risk") return "Monitor for cleaner risk context.";
    if (item.key === "volatility") return "Wait for volatility to stabilize.";
    if (item.key === "macro") return "Wait for market context and symbol behavior to align.";
    if (item.key === "data_quality") return "Wait for stronger data confirmation from the scanner.";
    return `Monitor ${item.label.toLowerCase()} for cleaner confirmation.`;
  });
  return ensureNonEmpty(
    uniqueText([...fromVetoes, ...fromFactors]).slice(0, 4),
    "Monitor fresh scanner data, confirmation quality, and risk context before treating this setup as cleaner.",
  );
}

function readinessScore({ confidence, dataQuality, decision, vetoes }: { confidence: number; dataQuality: number; decision: string; vetoes: string[] }): number {
  let score = confidence;
  if (!vetoes.length && confidence >= 70 && dataQuality >= 70) score += 6;
  score -= Math.min(55, vetoes.length * 18);
  if (vetoes.some((code) => SEVERE_VETOES.has(code))) score -= 14;
  if (dataQuality < 70) score -= (70 - dataQuality) * 0.45;
  if (confidence < 50) score -= 8;
  if (decision === "AVOID" || decision === "EXIT") score -= 10;
  if (decision === "WAIT_PULLBACK") score -= 4;
  return Math.round(clampScore(score));
}

function confidenceValue(row: RankingRow, factors: DecisionFactor[], vetoes: string[]): number {
  const explicit = numeric(rawField(row, "confidence_score"));
  if (explicit !== null) return Math.round(clampScore(explicit));
  let score = 45;
  score += above(factorValue(factors, "trend"), 70, 10);
  score += above(factorValue(factors, "momentum"), 65, 8);
  score += above(factorValue(factors, "macro"), 60, 8);
  score += above(factorValue(factors, "volume"), 60, 6);
  score += above(factorValue(factors, "risk"), 70, 8);
  score += above(factorValue(factors, "data_quality"), 85, 10);
  score += above(numeric(rawField(row, "risk_reward")), 1.5, 5);
  score -= vetoes.reduce((total, code) => total + vetoPenalty(code), 0);
  return Math.round(clampScore(score));
}

function structuredFactorScores(row: RankingRow): Record<string, number | undefined> {
  const raw = rawField(row, "factor_scores");
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : parseJsonRecord(raw);
  if (!record) return {};
  const result: Record<string, number | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    const parsed = numeric(value);
    if (parsed !== null) result[normalizeCode(key).toLowerCase()] = clampScore(parsed);
  }
  return result;
}

function factor(key: string, label: string, value: number): DecisionFactor {
  return { key, label, value: clampScore(value) };
}

function factorValue(factors: DecisionFactor[], key: string): number | null {
  return factors.find((factorItem) => factorItem.key === key)?.value ?? null;
}

function rawField(row: RankingRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function normalizedDecision(row: RankingRow): string {
  return normalizeCode(String(row.final_decision ?? row.action ?? "WATCH")) || "WATCH";
}

function normalizeCode(value: string): string {
  return value.trim().replace(/[\s-]+/g, "_").replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[%,$]/g, "").trim();
  if (!text || text === "[object Object]") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(normalized);
}

function above(value: number | null, threshold: number, weight: number): number {
  if (value === null || value <= threshold) return 0;
  return Math.min(weight, ((value - threshold) / Math.max(1, 100 - threshold)) * weight);
}

function vetoPenalty(code: string): number {
  if (code === "STALE_DATA" || code === "DATA_STALE") return 25;
  if (code === "PROVIDER_ERROR") return 30;
  if (code === "EXTREME_VOLATILITY") return 22;
  if (code === "STOP_RISK" || code === "RISK_OFF_MARKET") return 18;
  if (code === "POOR_RISK_REWARD") return 15;
  if (code === "HIGH_VOLATILITY" || code === "LOW_CONFIDENCE_DATA") return 12;
  if (code === "OVEREXTENDED_ENTRY") return 10;
  if (code === "OVERHEATED_MARKET") return 8;
  return 0;
}

function parseJsonArray(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  const text = String(value ?? "").trim();
  if (!text || !text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function uniqueCodes(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeCode).filter(Boolean)));
}

function uniqueText(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function ensureNonEmpty(values: string[], fallback: string): string[] {
  return values.length ? values : [fallback];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
