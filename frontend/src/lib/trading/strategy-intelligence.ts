import type { CsvRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";

export type StrategyFamily =
  | "asymmetric_reversal"
  | "defensive_rotation"
  | "event_driven_continuation"
  | "high_fragility_momentum"
  | "macro_aligned_continuation"
  | "momentum_breakout"
  | "post_earnings_continuation"
  | "pullback_continuation"
  | "shock_continuation"
  | "volatility_compression_breakout";

export type StrategyEvidenceMaturity = "early" | "developing" | "mature";
export type StrategyInsightTone = "info" | "positive" | "warning";
export type StrategyMatrixAxis = "event_signature" | "market_regime" | "sector" | "setup_type";

export type StrategyPerformanceRow = {
  alphaConfidence: number;
  alphaPersistenceLabel: string;
  alphaScore: number;
  averageDrawdownPct: number | null;
  averageReturnPct: number | null;
  baselineReturnPct: number | null;
  capitalEfficiencyScore: number;
  continuationProbabilityPct: number | null;
  downsideRiskScore: number;
  edgeDecayScore: number;
  edgeDurabilityScore: number;
  eventSensitivity: string;
  evidenceMaturity: StrategyEvidenceMaturity;
  family: StrategyFamily;
  label: string;
  liquiditySensitivity: string;
  medianReturnPct: number | null;
  opportunityEfficiencyScore: number;
  primaryHorizon: string;
  regimeSensitivity: string;
  reversalProbabilityPct: number | null;
  riskAdjustedReturn: number | null;
  sampleCount: number;
  strategyQualityScore: number;
  summary: string;
  winRatePct: number | null;
  worstReturnPct: number | null;
};

export type StrategyMatrixRow = {
  alphaScore: number;
  axis: StrategyMatrixAxis;
  evidenceMaturity: StrategyEvidenceMaturity;
  family: StrategyFamily;
  label: string;
  sampleCount: number;
  strategyQualityScore: number;
  value: string;
};

export type AlphaCluster = {
  detail: string;
  evidenceLabel: string;
  score: number;
  strategyFamily: StrategyFamily;
  title: string;
  tone: StrategyInsightTone;
};

export type StrategyCurrentOpportunity = {
  alphaScore: number;
  evidenceLabel: string;
  family: StrategyFamily;
  keyReason: string;
  keyRisk: string;
  opportunityEfficiencyScore: number;
  price: number | null;
  profileFitLabel: string;
  strategyQualityScore: number;
  symbol: string;
};

export type StrategyIntelligenceSystem = {
  alphaClusters: AlphaCluster[];
  baselineReturnPct: number | null;
  bestStrategies: StrategyPerformanceRow[];
  currentOpportunities: StrategyCurrentOpportunity[];
  deterioratingStrategies: StrategyPerformanceRow[];
  generatedAt: string;
  limitations: string[];
  observationCount: number;
  operatorBriefing: string[];
  primaryHorizon: string;
  strategyMatrix: StrategyMatrixRow[];
  terminalInsights: AlphaCluster[];
};

export type StrategyIntelligenceInput = {
  forwardRows?: CsvRow[];
  generatedAt?: string;
  opportunities?: OpportunityViewModel[];
  personalizationProfile?: UserPersonalizationProfile | null;
};

type ForwardObservation = {
  drawdownPct: number | null;
  eventSignature: string;
  family: StrategyFamily;
  finalScore: number | null;
  fragilityScore: number | null;
  horizon: string;
  liquidityPressure: number | null;
  macroAlignmentScore: number | null;
  marketRegime: string;
  returnPct: number;
  sector: string;
  setupType: string;
  symbol: string;
  volatilityPressure: number | null;
};

const STRATEGY_LABELS: Record<StrategyFamily, string> = {
  asymmetric_reversal: "Skewed Reversal",
  defensive_rotation: "Defensive Rotation",
  event_driven_continuation: "Event-Backed Follow-Through",
  high_fragility_momentum: "Risky Momentum",
  macro_aligned_continuation: "Market-Supported Follow-Through",
  momentum_breakout: "Momentum Breakout",
  post_earnings_continuation: "Post-Earnings Follow-Through",
  pullback_continuation: "Pullback Follow-Through",
  shock_continuation: "Large-Move Follow-Through",
  volatility_compression_breakout: "Quiet-to-Active Breakout",
};

const PRIMARY_HORIZONS = ["10D", "5D", "3D", "2D", "1D", "20D", "60D"];
const MIN_DEVELOPING_SAMPLE = 30;
const MIN_MATURE_SAMPLE = 100;

export function buildStrategyIntelligenceSystem(input: StrategyIntelligenceInput): StrategyIntelligenceSystem {
  const observations = (input.forwardRows ?? []).map(observationFromRow).filter((row): row is ForwardObservation => row !== null);
  const primaryHorizon = primaryHorizonFor(observations);
  const horizonRows = observations.filter((row) => row.horizon === primaryHorizon);
  const baselineReturnPct = meanOrNull(horizonRows.map((row) => row.returnPct));
  const performanceRows = strategyPerformanceRows(horizonRows, baselineReturnPct, primaryHorizon);
  const bestStrategies = performanceRows
    .filter((row) => row.sampleCount >= 3)
    .sort((left, right) => right.strategyQualityScore - left.strategyQualityScore || right.alphaScore - left.alphaScore)
    .slice(0, 6);
  const deterioratingStrategies = performanceRows
    .filter((row) => row.sampleCount >= 3 && (row.edgeDecayScore >= 55 || (row.averageReturnPct ?? 0) < (baselineReturnPct ?? 0) - 0.25))
    .sort((left, right) => right.edgeDecayScore - left.edgeDecayScore || left.alphaScore - right.alphaScore)
    .slice(0, 5);
  const strategyMatrix = strategyMatrixRows(horizonRows, baselineReturnPct, primaryHorizon);
  const currentOpportunities = currentOpportunityRows(input.opportunities ?? [], performanceRows, input.personalizationProfile ?? null);
  const alphaClusters = alphaClustersFor(bestStrategies, strategyMatrix);
  const terminalInsights = terminalInsightsFor(bestStrategies, deterioratingStrategies, currentOpportunities);
  const observationCount = horizonRows.length;

  return {
    alphaClusters,
    baselineReturnPct,
    bestStrategies,
    currentOpportunities,
    deterioratingStrategies,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    limitations: limitationsFor(observationCount),
    observationCount,
    operatorBriefing: operatorBriefingFor({ baselineReturnPct, bestStrategies, deterioratingStrategies, observationCount, primaryHorizon }),
    primaryHorizon,
    strategyMatrix,
    terminalInsights,
  };
}

export function strategyFamilyLabel(family: StrategyFamily): string {
  return STRATEGY_LABELS[family];
}

export function strategyEvidenceLabel(value: StrategyEvidenceMaturity): string {
  if (value === "mature") return "Mature evidence";
  if (value === "developing") return "Developing evidence";
  return "Early evidence";
}

function observationFromRow(row: CsvRow): ForwardObservation | null {
  const returnPct = percentValue(row.return_pct ?? row.forward_return ?? row.return);
  if (returnPct === null) return null;
  const setupType = normalizedGroup(row.setup_type, "UNKNOWN");
  const eventSignature = normalizedGroup(row.verified_event_signature ?? row.macro_event_regime_signature ?? row.event_context_label, "UNKNOWN");
  const marketRegime = normalizedGroup(row.market_regime ?? row.macro_context_label ?? row.regime, "UNKNOWN");
  const sector = normalizedGroup(row.sector ?? row.asset_type, "UNKNOWN");
  const fragilityScore = scoreValue(row.fragility_score ?? row.risk_score ?? row.event_risk_score);
  const macroAlignmentScore = scoreValue(row.macro_alignment_score ?? row.macro_score);
  const volatilityPressure = scoreValue(row.volatility_pressure);
  const liquidityPressure = scoreValue(row.liquidity_pressure);
  const finalScore = scoreValue(row.final_score_adjusted ?? row.macro_adjusted_score ?? row.final_score ?? row.score);
  return {
    drawdownPct: percentValue(row.max_drawdown_after_signal ?? row.max_drawdown ?? row.drawdown),
    eventSignature,
    family: classifyObservationFamily({ eventSignature, finalScore, fragilityScore, macroAlignmentScore, marketRegime, returnPct, sector, setupType, volatilityPressure }),
    finalScore,
    fragilityScore,
    horizon: normalizedHorizon(row.horizon),
    liquidityPressure,
    macroAlignmentScore,
    marketRegime,
    returnPct,
    sector,
    setupType,
    symbol: normalizedGroup(row.symbol, "UNKNOWN"),
    volatilityPressure,
  };
}

function classifyObservationFamily(input: {
  eventSignature: string;
  finalScore: number | null;
  fragilityScore: number | null;
  macroAlignmentScore: number | null;
  marketRegime: string;
  returnPct: number;
  sector: string;
  setupType: string;
  volatilityPressure: number | null;
}): StrategyFamily {
  const setup = input.setupType;
  const event = input.eventSignature;
  const regime = input.marketRegime;
  const sector = input.sector;
  if (/EARN|GUIDANCE|REVENUE|EPS|BILLING|PROFIT|LOSS/.test(event)) return "post_earnings_continuation";
  if (/SHOCK|GAP|EXPLOSION/.test(setup) || Math.abs(input.returnPct) >= 5) return "shock_continuation";
  if (/PULLBACK|RECLAIM|RETEST/.test(setup)) return "pullback_continuation";
  if (/VOLATILITY|COMPRESSION|SQUEEZE/.test(setup)) return "volatility_compression_breakout";
  if (/REVERSAL|MEAN_REVERSION|OVERSOLD/.test(setup)) return "asymmetric_reversal";
  if (/EVENT|CATALYST|PRODUCT|REGULATORY|M&A|MERGER|ACQUISITION|FED|CPI|NFP|OIL|WAR|SANCTION/.test(event)) return "event_driven_continuation";
  if ((input.fragilityScore ?? 0) >= 70 && /MOMENTUM|BREAKOUT|CONTINUATION|TREND/.test(setup)) return "high_fragility_momentum";
  if ((input.macroAlignmentScore ?? 50) >= 66 || /RISK_ON|EXPANSION|LIQUIDITY_SUPPORTIVE|MACRO_ALIGNED/.test(regime)) return "macro_aligned_continuation";
  if (/DEFENSIVE|ROTATION/.test(regime) || /ENERGY|UTILITIES|HEALTH|GOLD|BOND|TREASURY|STAPLES/.test(sector)) return "defensive_rotation";
  if (/BREAKOUT|MOMENTUM|CONTINUATION|TREND/.test(setup) || (input.finalScore ?? 0) >= 72) return "momentum_breakout";
  if ((input.volatilityPressure ?? 0) >= 70) return "high_fragility_momentum";
  return "momentum_breakout";
}

function strategyPerformanceRows(observations: ForwardObservation[], baselineReturnPct: number | null, primaryHorizon: string): StrategyPerformanceRow[] {
  const buckets = groupBy(observations, (row) => row.family);
  return (Object.keys(STRATEGY_LABELS) as StrategyFamily[]).map((family) => {
    const rows = buckets.get(family) ?? [];
    return performanceRowFor(family, rows, baselineReturnPct, primaryHorizon);
  });
}

function performanceRowFor(family: StrategyFamily, rows: ForwardObservation[], baselineReturnPct: number | null, primaryHorizon: string): StrategyPerformanceRow {
  const returns = rows.map((row) => row.returnPct);
  const drawdowns = rows.map((row) => row.drawdownPct).filter(isFiniteNumber).map((value) => Math.abs(value));
  const averageReturnPct = meanOrNull(returns);
  const medianReturnPct = medianOrNull(returns);
  const winRatePct = rows.length ? (returns.filter((value) => value > 0).length / rows.length) * 100 : null;
  const continuationProbabilityPct = rows.length ? (returns.filter((value) => value > 1).length / rows.length) * 100 : null;
  const reversalProbabilityPct = rows.length ? (returns.filter((value) => value < -1).length / rows.length) * 100 : null;
  const worstReturnPct = returns.length ? Math.min(...returns) : null;
  const averageDrawdownPct = meanOrNull(drawdowns);
  const riskAdjustedReturn = averageReturnPct === null ? null : averageReturnPct / Math.max(1, averageDrawdownPct ?? Math.abs(worstReturnPct ?? 1));
  const evidenceMaturity = evidenceMaturityFor(rows.length);
  const alphaScore = alphaScoreFor({ averageDrawdownPct, averageReturnPct, baselineReturnPct, evidenceMaturity, sampleCount: rows.length, winRatePct });
  const alphaConfidence = confidenceFor(rows.length, alphaScore, averageReturnPct, baselineReturnPct);
  const edgeDurabilityScore = durabilityScoreFor({ averageDrawdownPct, averageReturnPct, rows, winRatePct });
  const edgeDecayScore = decayScoreFor({ averageDrawdownPct, averageReturnPct, baselineReturnPct, family, rows, winRatePct });
  const opportunityEfficiencyScore = efficiencyScoreFor({ averageDrawdownPct, averageReturnPct, continuationProbabilityPct, reversalProbabilityPct });
  const downsideRiskScore = downsideRiskFor({ averageDrawdownPct, reversalProbabilityPct, worstReturnPct });
  const capitalEfficiencyScore = capitalEfficiencyFor({ alphaScore, downsideRiskScore, edgeDurabilityScore, opportunityEfficiencyScore });
  const strategyQualityScore = Math.round(clamp(alphaScore * 0.28 + edgeDurabilityScore * 0.24 + opportunityEfficiencyScore * 0.20 + capitalEfficiencyScore * 0.18 + alphaConfidence * 0.10 - Math.max(0, downsideRiskScore - 68) * 0.18));

  return {
    alphaConfidence,
    alphaPersistenceLabel: persistenceLabel(alphaScore, edgeDurabilityScore, edgeDecayScore, evidenceMaturity),
    alphaScore,
    averageDrawdownPct,
    averageReturnPct,
    baselineReturnPct,
    capitalEfficiencyScore,
    continuationProbabilityPct,
    downsideRiskScore,
    edgeDecayScore,
    edgeDurabilityScore,
    eventSensitivity: sensitivityLabel(eventSensitivityScore(rows), "Event-sensitive", "Event context moderate", "Low event sensitivity"),
    evidenceMaturity,
    family,
    label: strategyFamilyLabel(family),
    liquiditySensitivity: sensitivityLabel(liquiditySensitivityScore(rows), "Liquidity-sensitive", "Liquidity sensitivity moderate", "Low liquidity sensitivity"),
    medianReturnPct,
    opportunityEfficiencyScore,
    primaryHorizon,
    regimeSensitivity: sensitivityLabel(regimeSensitivityScore(rows), "Regime-sensitive", "Regime context moderate", "Low regime sensitivity"),
    reversalProbabilityPct,
    riskAdjustedReturn,
    sampleCount: rows.length,
    strategyQualityScore,
    summary: strategySummary({ alphaScore, averageReturnPct, baselineReturnPct, edgeDecayScore, evidenceMaturity, family, sampleCount: rows.length }),
    winRatePct,
    worstReturnPct,
  };
}

function strategyMatrixRows(observations: ForwardObservation[], baselineReturnPct: number | null, primaryHorizon: string): StrategyMatrixRow[] {
  const axes: Array<{ axis: StrategyMatrixAxis; valueFor: (row: ForwardObservation) => string }> = [
    { axis: "setup_type", valueFor: (row) => row.setupType },
    { axis: "market_regime", valueFor: (row) => row.marketRegime },
    { axis: "sector", valueFor: (row) => row.sector },
    { axis: "event_signature", valueFor: (row) => row.eventSignature },
  ];
  return axes.flatMap(({ axis, valueFor }) => {
    const buckets = groupBy(observations.filter((row) => valueFor(row) !== "UNKNOWN"), (row) => `${row.family}::${valueFor(row)}`);
    return Array.from(buckets.entries()).map(([key, rows]) => {
      const [familyValue, rawValue] = key.split("::");
      const family = isStrategyFamily(familyValue) ? familyValue : "momentum_breakout";
      const performance = performanceRowFor(family, rows, baselineReturnPct, primaryHorizon);
      return {
        alphaScore: performance.alphaScore,
        axis,
        evidenceMaturity: performance.evidenceMaturity,
        family,
        label: `${strategyFamilyLabel(family)} / ${humanizeLabel(rawValue ?? "Unknown")}`,
        sampleCount: rows.length,
        strategyQualityScore: performance.strategyQualityScore,
        value: rawValue ?? "UNKNOWN",
      };
    });
  })
    .filter((row) => row.sampleCount >= 3)
    .sort((left, right) => right.strategyQualityScore - left.strategyQualityScore || right.sampleCount - left.sampleCount)
    .slice(0, 36);
}

function currentOpportunityRows(
  opportunities: OpportunityViewModel[],
  performanceRows: StrategyPerformanceRow[],
  personalizationProfile: UserPersonalizationProfile | null,
): StrategyCurrentOpportunity[] {
  const performanceByFamily = new Map(performanceRows.map((row) => [row.family, row]));
  return opportunities
    .map((row) => {
      const family = classifyOpportunityFamily(row);
      const performance = performanceByFamily.get(family) ?? performanceRowFor(family, [], null, "UNKNOWN");
      const opportunityEfficiencyScore = Math.round(clamp(performance.opportunityEfficiencyScore * 0.42 + row.conviction * 0.20 + (row.final_score ?? 50) * 0.18 + (100 - row.fragility) * 0.12 + (row.shockPattern?.opportunityScore ?? 50) * 0.08));
      const strategyQualityScore = Math.round(clamp(performance.strategyQualityScore * 0.46 + opportunityEfficiencyScore * 0.28 + (row.shockPattern?.reliabilityScore ?? 50) * 0.10 + (row.narrative?.narrativeDrift.momentumScore ?? 50) * 0.08 + profileFitScore(row, personalizationProfile) * 0.08));
      return {
        alphaScore: performance.alphaScore,
        evidenceLabel: `${strategyEvidenceLabel(performance.evidenceMaturity)} / ${performance.sampleCount.toLocaleString()} samples`,
        family,
        keyReason: currentOpportunityReason(row, performance),
        keyRisk: currentOpportunityRisk(row, performance),
        opportunityEfficiencyScore,
        price: row.price,
        profileFitLabel: profileFitLabel(row, personalizationProfile),
        strategyQualityScore,
        symbol: row.symbol,
      };
    })
    .filter((row) => row.strategyQualityScore >= 38)
    .sort((left, right) => right.strategyQualityScore - left.strategyQualityScore || right.opportunityEfficiencyScore - left.opportunityEfficiencyScore)
    .slice(0, 10);
}

function classifyOpportunityFamily(row: OpportunityViewModel): StrategyFamily {
  const setupType = normalizedGroup(row.raw.setup_type, "UNKNOWN");
  const eventSignature = normalizedGroup(row.raw.verified_event_signature ?? row.raw.macro_event_regime_signature ?? row.eventLabel, "UNKNOWN");
  const marketRegime = normalizedGroup(row.raw.market_regime ?? row.raw.macro_context_label ?? row.macroLabel, "UNKNOWN");
  const sector = normalizedGroup(row.sector ?? row.assetType, "UNKNOWN");
  const returnPct = percentValue(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0;
  if (row.shockPattern?.upsideShockScore && row.shockPattern.upsideShockScore >= 70) return "shock_continuation";
  return classifyObservationFamily({
    eventSignature,
    finalScore: row.final_score,
    fragilityScore: row.fragility,
    macroAlignmentScore: scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score),
    marketRegime,
    returnPct,
    sector,
    setupType,
    volatilityPressure: scoreValue(row.raw.volatility_pressure),
  });
}

function alphaClustersFor(bestStrategies: StrategyPerformanceRow[], matrixRows: StrategyMatrixRow[]): AlphaCluster[] {
  const clusters: AlphaCluster[] = bestStrategies.slice(0, 4).map((row) => ({
    detail: `${row.label} shows ${row.alphaPersistenceLabel.toLowerCase()} on ${row.primaryHorizon}. Use it as historical research, not as a prediction.`,
    evidenceLabel: `${formatPct(row.averageReturnPct)} avg vs ${formatPct(row.baselineReturnPct)} baseline, ${row.sampleCount} samples`,
    score: row.alphaScore,
    strategyFamily: row.family,
    title: `${row.label} edge cluster`,
    tone: row.alphaScore >= 62 ? "positive" : row.edgeDecayScore >= 58 ? "warning" : "info",
  }));
  const matrixLeader = matrixRows.find((row) => row.axis === "market_regime" && row.strategyQualityScore >= 58);
  if (matrixLeader) {
    clusters.push({
      detail: `${matrixLeader.label} is the strongest market-state group currently visible. Keep sample size and market changes in view before drawing conclusions.`,
      evidenceLabel: `${matrixLeader.sampleCount} comparable observations`,
      score: matrixLeader.strategyQualityScore,
      strategyFamily: matrixLeader.family,
      title: "Market-state strategy edge",
      tone: "info",
    });
  }
  return clusters.slice(0, 5);
}

function terminalInsightsFor(
  bestStrategies: StrategyPerformanceRow[],
  deterioratingStrategies: StrategyPerformanceRow[],
  currentOpportunities: StrategyCurrentOpportunity[],
): AlphaCluster[] {
  const insights: AlphaCluster[] = [];
  const best = bestStrategies[0];
  if (best) {
    insights.push({
      detail: `${best.label} is the strongest strategy family in the latest completed evidence window. Use this to focus research, not to bypass risk controls.`,
      evidenceLabel: `${best.strategyQualityScore}/100 quality, ${best.sampleCount} samples`,
      score: best.strategyQualityScore,
      strategyFamily: best.family,
      title: "Strongest strategy family",
      tone: best.strategyQualityScore >= 65 ? "positive" : "info",
    });
  }
  const weak = deterioratingStrategies[0];
  if (weak) {
    insights.push({
      detail: `${weak.label} has been weakening or trailing the baseline. TradeVeto should keep late-entry and fragility warnings visible for similar setups.`,
      evidenceLabel: `${weak.edgeDecayScore}/100 decay pressure`,
      score: weak.edgeDecayScore,
      strategyFamily: weak.family,
      title: "Weakening strategy watch",
      tone: "warning",
    });
  }
  const current = currentOpportunities[0];
  if (current) {
    insights.push({
      detail: `${current.symbol} is the strongest current strategy-fit candidate in Strategy Lab. It remains research context and still follows TradeVeto's main risk guardrails.`,
      evidenceLabel: `${current.strategyQualityScore}/100 current strategy quality`,
      score: current.strategyQualityScore,
      strategyFamily: current.family,
      title: "Current strategy candidate",
      tone: current.strategyQualityScore >= 65 ? "positive" : "info",
    });
  }
  return insights.slice(0, 4);
}

function alphaScoreFor(input: {
  averageDrawdownPct: number | null;
  averageReturnPct: number | null;
  baselineReturnPct: number | null;
  evidenceMaturity: StrategyEvidenceMaturity;
  sampleCount: number;
  winRatePct: number | null;
}): number {
  if (input.averageReturnPct === null) return 35;
  const baseline = input.baselineReturnPct ?? 0;
  const excess = input.averageReturnPct - baseline;
  const evidenceBonus = input.evidenceMaturity === "mature" ? 16 : input.evidenceMaturity === "developing" ? 9 : 2;
  const winBonus = ((input.winRatePct ?? 50) - 50) * 0.42;
  const drawdownPenalty = Math.min(18, Math.max(0, (input.averageDrawdownPct ?? 0) - 4) * 1.8);
  return Math.round(clamp(50 + excess * 8 + winBonus + evidenceBonus - drawdownPenalty));
}

function confidenceFor(sampleCount: number, alphaScore: number, averageReturnPct: number | null, baselineReturnPct: number | null): number {
  const sampleScore = sampleCount >= MIN_MATURE_SAMPLE ? 78 : sampleCount >= MIN_DEVELOPING_SAMPLE ? 62 : Math.min(45, 24 + sampleCount * 1.6);
  const signalScore = averageReturnPct === null || baselineReturnPct === null ? 42 : clamp(50 + Math.abs(averageReturnPct - baselineReturnPct) * 7);
  return Math.round(clamp(sampleScore * 0.62 + signalScore * 0.24 + alphaScore * 0.14));
}

function durabilityScoreFor(input: {
  averageDrawdownPct: number | null;
  averageReturnPct: number | null;
  rows: ForwardObservation[];
  winRatePct: number | null;
}): number {
  if (!input.rows.length || input.averageReturnPct === null) return 36;
  const scoreStability = 100 - Math.min(45, standardDeviation(input.rows.map((row) => row.returnPct)) * 3.5);
  const drawdownScore = 100 - Math.min(55, (input.averageDrawdownPct ?? 4) * 7);
  return Math.round(clamp((input.winRatePct ?? 50) * 0.34 + scoreStability * 0.30 + drawdownScore * 0.24 + clamp(50 + input.averageReturnPct * 5) * 0.12));
}

function decayScoreFor(input: {
  averageDrawdownPct: number | null;
  averageReturnPct: number | null;
  baselineReturnPct: number | null;
  family: StrategyFamily;
  rows: ForwardObservation[];
  winRatePct: number | null;
}): number {
  if (!input.rows.length) return 62;
  const baseline = input.baselineReturnPct ?? 0;
  const underperformance = Math.max(0, baseline - (input.averageReturnPct ?? baseline)) * 9;
  const fragility = average(input.rows.map((row) => row.fragilityScore ?? 50), 50);
  const volatility = average(input.rows.map((row) => row.volatilityPressure ?? 50), 50);
  const drawdown = Math.min(26, (input.averageDrawdownPct ?? 0) * 4);
  const highFragilityFamilyPenalty = input.family === "high_fragility_momentum" ? 14 : 0;
  const weakWinPenalty = Math.max(0, 50 - (input.winRatePct ?? 50)) * 0.7;
  return Math.round(clamp(underperformance + fragility * 0.18 + volatility * 0.14 + drawdown + highFragilityFamilyPenalty + weakWinPenalty));
}

function efficiencyScoreFor(input: {
  averageDrawdownPct: number | null;
  averageReturnPct: number | null;
  continuationProbabilityPct: number | null;
  reversalProbabilityPct: number | null;
}): number {
  if (input.averageReturnPct === null) return 38;
  const reward = clamp(50 + input.averageReturnPct * 7);
  const continuation = input.continuationProbabilityPct ?? 50;
  const reversalPenalty = Math.max(0, (input.reversalProbabilityPct ?? 0) - 35) * 0.7;
  const drawdownPenalty = Math.min(20, (input.averageDrawdownPct ?? 0) * 2.5);
  return Math.round(clamp(reward * 0.38 + continuation * 0.36 + (100 - reversalPenalty * 2) * 0.14 + (100 - drawdownPenalty * 3) * 0.12));
}

function downsideRiskFor(input: {
  averageDrawdownPct: number | null;
  reversalProbabilityPct: number | null;
  worstReturnPct: number | null;
}): number {
  const worst = Math.abs(Math.min(0, input.worstReturnPct ?? 0));
  const drawdown = input.averageDrawdownPct ?? 3;
  const reversal = input.reversalProbabilityPct ?? 35;
  return Math.round(clamp(worst * 4 + drawdown * 5 + reversal * 0.35));
}

function capitalEfficiencyFor(input: {
  alphaScore: number;
  downsideRiskScore: number;
  edgeDurabilityScore: number;
  opportunityEfficiencyScore: number;
}): number {
  return Math.round(clamp(input.opportunityEfficiencyScore * 0.35 + input.edgeDurabilityScore * 0.28 + input.alphaScore * 0.24 - Math.max(0, input.downsideRiskScore - 55) * 0.35 + 8));
}

function regimeSensitivityScore(rows: ForwardObservation[]): number {
  const values = uniqueValues(rows.map((row) => row.marketRegime));
  const macroSpread = standardDeviation(rows.map((row) => row.macroAlignmentScore ?? 50));
  return Math.round(clamp(values.length * 12 + macroSpread * 2.4));
}

function liquiditySensitivityScore(rows: ForwardObservation[]): number {
  return Math.round(clamp(standardDeviation(rows.map((row) => row.liquidityPressure ?? 50)) * 3 + average(rows.map((row) => row.liquidityPressure ?? 50), 50) * 0.35));
}

function eventSensitivityScore(rows: ForwardObservation[]): number {
  const eventRows = rows.filter((row) => row.eventSignature !== "UNKNOWN").length;
  return rows.length ? Math.round(clamp((eventRows / rows.length) * 100)) : 0;
}

function persistenceLabel(alphaScore: number, durabilityScore: number, decayScore: number, evidenceMaturity: StrategyEvidenceMaturity): string {
  if (evidenceMaturity === "early") return "Early evidence";
  if (alphaScore >= 68 && durabilityScore >= 64 && decayScore < 45) return "Historically strong follow-through";
  if (alphaScore >= 58 && decayScore < 58) return "Developing follow-through";
  if (decayScore >= 65) return "Follow-through is weakening";
  return "Mixed follow-through";
}

function sensitivityLabel(score: number, high: string, medium: string, low: string): string {
  if (score >= 68) return high;
  if (score >= 42) return medium;
  return low;
}

function strategySummary(input: {
  alphaScore: number;
  averageReturnPct: number | null;
  baselineReturnPct: number | null;
  edgeDecayScore: number;
  evidenceMaturity: StrategyEvidenceMaturity;
  family: StrategyFamily;
  sampleCount: number;
}): string {
  if (!input.sampleCount) return `${strategyFamilyLabel(input.family)} does not yet have enough completed later-outcome evidence in the selected window.`;
  const delta = input.averageReturnPct !== null && input.baselineReturnPct !== null ? input.averageReturnPct - input.baselineReturnPct : null;
  if (input.edgeDecayScore >= 65) {
    return `${strategyFamilyLabel(input.family)} has been weakening. Past outcomes are below the desired durability threshold, so late-entry and fragility warnings should remain visible.`;
  }
  return `${strategyFamilyLabel(input.family)} has ${strategyEvidenceLabel(input.evidenceMaturity).toLowerCase()} with ${formatPct(delta)} return above baseline. This is historical strategy context, not trading advice.`;
}

function currentOpportunityReason(row: OpportunityViewModel, performance: StrategyPerformanceRow): string {
  const parts = [
    `${strategyFamilyLabel(performance.family)} strategy fit`,
    `${performance.alphaPersistenceLabel.toLowerCase()}`,
  ];
  if (row.shockPattern && row.shockPattern.opportunityScore >= 65) parts.push("historically similar setups produced larger-than-normal moves");
  if ((row.final_score ?? 0) >= 70) parts.push("scanner quality is above average");
  return parts.join("; ");
}

function currentOpportunityRisk(row: OpportunityViewModel, performance: StrategyPerformanceRow): string {
  if (row.fragility >= 70) return "The setup is fragile; do not treat strategy fit as a main TradeVeto signal.";
  if (performance.edgeDecayScore >= 60) return "This strategy has been weakening; wait for confirmation or a cleaner entry.";
  if ((row.shockPattern?.chaseRiskScore ?? 0) >= 70) return "Large-move history shows elevated late-entry risk.";
  return "Risk still has uncertainty; check entry timing and broader market context before acting.";
}

function profileFitScore(row: OpportunityViewModel, profile: UserPersonalizationProfile | null): number {
  if (!profile) return 55;
  const risk = cleanText(profile.preferredRiskLevel, "medium").toLowerCase();
  if (risk === "high") return 60 + Math.min(20, (row.shockPattern?.upsideShockScore ?? row.conviction) * 0.18);
  if (risk === "low") return Math.round(clamp(76 - row.fragility * 0.35 + (100 - (row.shockPattern?.downsideRiskScore ?? 50)) * 0.16));
  return Math.round(clamp(58 + row.conviction * 0.16 - row.fragility * 0.10));
}

function profileFitLabel(row: OpportunityViewModel, profile: UserPersonalizationProfile | null): string {
  if (!profile) return "General strategy fit";
  const personality = humanizeLabel(profile.personality);
  const fit = profileFitScore(row, profile);
  if (fit >= 70) return `${personality} fit`;
  if (fit <= 45) return `${personality} conflict`;
  return `${personality} mixed`;
}

function operatorBriefingFor(input: {
  baselineReturnPct: number | null;
  bestStrategies: StrategyPerformanceRow[];
  deterioratingStrategies: StrategyPerformanceRow[];
  observationCount: number;
  primaryHorizon: string;
}): string[] {
  const best = input.bestStrategies[0];
  const deteriorating = input.deterioratingStrategies[0];
  return [
    `Strategy Lab is using ${input.observationCount.toLocaleString()} completed ${input.primaryHorizon} later-outcome records with ${formatPct(input.baselineReturnPct)} baseline return.`,
    best ? `${best.label} is the current strongest strategy family at ${best.strategyQualityScore}/100 quality and ${best.alphaScore}/100 edge score.` : "No strategy family has enough completed evidence to rank confidently yet.",
    deteriorating ? `${deteriorating.label} is weakening with ${deteriorating.edgeDecayScore}/100 decay pressure.` : "No clear weakening strategy group is visible in the current window.",
    "The engine is research-only. It compares completed outcomes and does not allocate capital, promise returns, or override core risk decisions.",
  ];
}

function limitationsFor(observationCount: number): string[] {
  const limitations = [
    "Strategy metrics come from completed later-outcome evidence and current scanner context; they are not a full brute-force backtest.",
    "Capital efficiency and strategy persistence are bounded research scores, not profit guarantees.",
    "Current opportunity rankings remain subordinate to core WAIT / AVOID / NO TRADE guardrails.",
  ];
  if (observationCount < MIN_DEVELOPING_SAMPLE) limitations.unshift("Evidence is early; strategy conclusions should be treated as directional research context only.");
  return limitations;
}

function primaryHorizonFor(rows: ForwardObservation[]): string {
  for (const horizon of PRIMARY_HORIZONS) {
    if (rows.filter((row) => row.horizon === horizon).length >= MIN_DEVELOPING_SAMPLE) return horizon;
  }
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.horizon, (counts.get(row.horizon) ?? 0) + 1);
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "UNKNOWN";
}

function evidenceMaturityFor(count: number): StrategyEvidenceMaturity {
  if (count >= MIN_MATURE_SAMPLE) return "mature";
  if (count >= MIN_DEVELOPING_SAMPLE) return "developing";
  return "early";
}

function normalizedGroup(value: unknown, fallback: string): string {
  const text = cleanText(value, "").trim();
  if (!text || ["-", "N/A", "NULL", "NONE", "UNDEFINED"].includes(text.toUpperCase())) return fallback;
  return text.toUpperCase().replace(/\s+/g, "_");
}

function normalizedHorizon(value: unknown): string {
  const text = normalizedGroup(value, "UNKNOWN");
  if (/^\d+$/.test(text)) return `${text}D`;
  return text;
}

function scoreValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return clamp(parsed);
}

function percentValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function formatPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  return buckets;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value !== "UNKNOWN")));
}

function meanOrNull(values: number[]): number | null {
  return values.length ? mean(values) : null;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function average(values: number[], fallback: number): number {
  return values.length ? mean(values) : fallback;
}

function medianOrNull(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function isStrategyFamily(value: string | undefined): value is StrategyFamily {
  return Boolean(value && value in STRATEGY_LABELS);
}
