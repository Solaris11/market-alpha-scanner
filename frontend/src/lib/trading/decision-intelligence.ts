import type { RankingRow } from "@/lib/types";

export type DecisionIntelligence = {
  confidence: number;
  decision: string;
  regime: string;
  regime_impact: string;
  readiness_score: number;
  risks: string[];
  setup_reasons: string[];
  setup_strength: number;
  setup_type: string;
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
  NEAR_AVWAP_OR_MA: "Price is near a tracked pullback context",
  SETUP_BREAKOUT: "Breakout setup rules are active",
  SETUP_CONTINUATION: "Continuation setup rules are active",
  SETUP_PULLBACK: "Pullback setup rules are active",
  TREND_INTACT: "Trend remains intact",
};

const REASON_NEGATIVE_COPY: Record<string, string> = {
  LOW_SCORE: "Composite score is not strong enough",
  MACRO_MISMATCH: "Market context is not aligned",
  MIXED_SETUP: "Setup structure is mixed",
  BREAKOUT_REJECTED_EXTENDED: "Breakout context is extended",
  DATA_QUALITY_SETUP_RISK: "Setup quality is limited by data confidence",
  HIGH_VOLATILITY_SETUP: "Setup risk is affected by volatility",
  MIXED_SETUP_AVOIDED: "Setup structure is not clean enough",
  POOR_RISK_REWARD_SETUP: "Setup risk/reward context is not favorable",
  SETUP_ATR_ABOVE_THRESHOLD: "ATR is above the setup threshold",
  SETUP_AVOID: "Setup rules are blocking this context",
  SETUP_MOMENTUM_BELOW_THRESHOLD: "Momentum is below the setup threshold",
  SETUP_REJECTED_EXTENDED: "Setup is extended in this scan",
  SETUP_RISK_REWARD_BELOW_THRESHOLD: "Risk/reward is below the setup threshold",
  SETUP_STRENGTH_BELOW_THRESHOLD: "Setup strength is below the threshold",
  SETUP_TREND_BELOW_THRESHOLD: "Trend is below the setup threshold",
  SETUP_VOLUME_BELOW_THRESHOLD: "Volume is below the setup threshold",
  WEAK_VOLUME_FOR_BREAKOUT: "Breakout setup lacks volume confirmation",
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
  BREAKOUT_REJECTED_EXTENDED: "Wait for breakout context to reset instead of chasing extension.",
  DATA_QUALITY_SETUP_RISK: "Wait for cleaner scanner data before relying on this setup context.",
  HIGH_VOLATILITY_SETUP: "Wait for ranges to stabilize before treating setup risk as cleaner.",
  MIXED_SETUP_AVOIDED: "Wait for a clearer pullback, breakout, or continuation pattern.",
  POOR_RISK_REWARD_SETUP: "Monitor for a cleaner balance between risk and potential reward.",
  SETUP_ATR_ABOVE_THRESHOLD: "Wait for ATR to cool below the setup threshold.",
  SETUP_AVOID: "Wait for setup structure to improve on a later scan.",
  SETUP_MOMENTUM_BELOW_THRESHOLD: "Monitor for stronger momentum confirmation.",
  SETUP_REJECTED_EXTENDED: "Wait for price to reset closer to support or AVWAP context.",
  SETUP_RISK_REWARD_BELOW_THRESHOLD: "Monitor for better risk/reward context.",
  SETUP_STRENGTH_BELOW_THRESHOLD: "Wait for setup strength to improve.",
  SETUP_TREND_BELOW_THRESHOLD: "Monitor for trend structure to improve.",
  SETUP_VOLUME_BELOW_THRESHOLD: "Wait for stronger volume confirmation.",
  WEAK_VOLUME_FOR_BREAKOUT: "Wait for volume expansion before treating breakout structure as cleaner.",
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
  const setupCodes = reasonCodes(rawField(row, "setup_reason_codes"));
  const confidence = confidenceValue(row, factors, vetoes);
  const dataQuality = factorValue(factors, "data_quality") ?? numeric(rawField(row, "data_quality_score")) ?? 75;
  const setup_type = setupType(row);
  const setup_strength = setupStrength(row, setup_type, factors);
  const readiness_score = readinessScore({ confidence, dataQuality, decision, setupStrength: setup_strength, setupType: setup_type, vetoes });
  const positives = positiveReasons(factors, uniqueCodes([...reasonCodesList, ...setupCodes]));
  const negatives = negativeReasons(factors, uniqueCodes([...reasonCodesList, ...setupCodes]), vetoes);
  const risks = riskReasons(vetoes, dataQuality);
  const what_to_watch = watchConditions({ factors, reasonCodesList: uniqueCodes([...reasonCodesList, ...setupCodes]), setupType: setup_type, vetoes });
  const regime = normalizedRegime(row);
  const regime_impact = regimeImpact(row, regime);
  const setup_reasons = setupReasonCopy(setup_type, setupCodes);

  return {
    confidence,
    decision,
    regime,
    regime_impact,
    readiness_score,
    risks,
    setup_reasons,
    setup_strength,
    setup_type,
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

function setupReasonCopy(setupType: string, setupCodes: string[]): string[] {
  const setupLabel = setupLabelForType(setupType);
  const fromCodes = setupCodes
    .map((code) => REASON_POSITIVE_COPY[code] ?? REASON_NEGATIVE_COPY[code])
    .filter((item): item is string => Boolean(item));
  return ensureNonEmpty(uniqueText([`Setup type: ${setupLabel}`, ...fromCodes]).slice(0, 4), `Setup type: ${setupLabel}`);
}

function watchConditions({ factors, reasonCodesList, setupType, vetoes }: { factors: DecisionFactor[]; reasonCodesList: string[]; setupType: string; vetoes: string[] }): string[] {
  const fromVetoes = uniqueCodes([...vetoes, ...reasonCodesList])
    .map((code) => WATCH_COPY[code])
    .filter((item): item is string => Boolean(item));
  const fromSetup = setupType === "PULLBACK"
    ? ["Monitor whether price stays near pullback support while trend remains intact."]
    : setupType === "BREAKOUT"
      ? ["Wait for clean volume confirmation and avoid extended breakout context."]
      : setupType === "CONTINUATION"
        ? ["Monitor for trend and momentum to remain aligned without volatility expanding."]
        : ["Wait for a clearer setup classification before elevating this signal."];
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
    uniqueText([...fromVetoes, ...fromSetup, ...fromFactors]).slice(0, 4),
    "Monitor fresh scanner data, confirmation quality, and risk context before treating this setup as cleaner.",
  );
}

function readinessScore({ confidence, dataQuality, decision, setupStrength, setupType, vetoes }: { confidence: number; dataQuality: number; decision: string; setupStrength: number; setupType: string; vetoes: string[] }): number {
  let score = confidence;
  if (!vetoes.length && confidence >= 70 && dataQuality >= 70) score += 6;
  score = (score * 0.72) + (setupStrength * 0.28);
  score -= Math.min(55, vetoes.length * 18);
  if (vetoes.some((code) => SEVERE_VETOES.has(code))) score -= 14;
  if (setupType === "AVOID") score -= 22;
  if (dataQuality < 70) score -= (70 - dataQuality) * 0.45;
  if (confidence < 50) score -= 8;
  if (decision === "AVOID" || decision === "EXIT") score -= 10;
  if (decision === "WAIT_PULLBACK") score -= 4;
  return Math.round(clampScore(score));
}

function setupType(row: RankingRow): string {
  const raw = normalizeCode(String(rawField(row, "setup_type") ?? ""));
  if (raw === "PULLBACK" || raw === "BREAKOUT" || raw === "CONTINUATION" || raw === "AVOID") return raw;
  if (raw.includes("PULLBACK") || raw.includes("AVWAP")) return "PULLBACK";
  if (raw.includes("BREAKOUT")) return "BREAKOUT";
  if (raw.includes("CONTINUATION") || raw.includes("TREND")) return "CONTINUATION";
  return "AVOID";
}

function setupStrength(row: RankingRow, setupTypeValue: string, factors: DecisionFactor[]): number {
  const explicit = numeric(rawField(row, "setup_strength"));
  if (explicit !== null) return Math.round(clampScore(explicit));
  const trend = factorValue(factors, "trend") ?? 50;
  const momentum = factorValue(factors, "momentum") ?? 50;
  const volume = factorValue(factors, "volume") ?? 50;
  const risk = factorValue(factors, "risk") ?? 50;
  const structure = factorValue(factors, "breakout") ?? 50;
  if (setupTypeValue === "PULLBACK") return Math.round(clampScore(trend * 0.35 + risk * 0.30 + momentum * 0.20 + volume * 0.15));
  if (setupTypeValue === "BREAKOUT") return Math.round(clampScore(structure * 0.32 + volume * 0.28 + momentum * 0.24 + risk * 0.16));
  if (setupTypeValue === "CONTINUATION") return Math.round(clampScore(trend * 0.35 + momentum * 0.30 + risk * 0.20 + volume * 0.15));
  return Math.round(clampScore(Math.min(trend, risk, momentum)));
}

function setupLabelForType(setupTypeValue: string): string {
  if (setupTypeValue === "PULLBACK") return "Pullback";
  if (setupTypeValue === "BREAKOUT") return "Breakout";
  if (setupTypeValue === "CONTINUATION") return "Continuation";
  return "Avoid";
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
