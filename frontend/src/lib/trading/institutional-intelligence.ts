import type { OpportunityViewModel } from "./opportunity-view-model";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type InstitutionalPressureKey =
  | "breadth_strength"
  | "crowding_risk"
  | "earnings_fragility"
  | "exchange_health"
  | "liquidity_pressure"
  | "macro_pressure"
  | "narrative_momentum"
  | "risk_appetite"
  | "sector_momentum"
  | "volatility_pressure";

export type PressureTrend = "improving" | "stable" | "deteriorating" | "transitioning";
export type DangerSeverity = "info" | "warning" | "critical";

export type MarketPressureComponent = {
  contribution: number;
  explanation: string;
  key: InstitutionalPressureKey;
  label: string;
  score: number;
};

export type InstitutionalDangerAlert = {
  explanation: string;
  label: string;
  severity: DangerSeverity;
};

export type InstitutionalIntelligence = {
  accumulationLikelihood: string;
  asymmetryQuality: string;
  asymmetryScore: number;
  compactLabels: string[];
  crowdingRiskScore: number;
  dangerAlerts: InstitutionalDangerAlert[];
  extensionSeverity: number;
  institutionalFragility: number;
  institutionalQualityLabel: string;
  institutionalQualityScore: number;
  liquidityContext: string;
  marketPressureLabel: string;
  narrativeMomentumLabel: string;
  netMarketPressureScore: number;
  negativeForces: MarketPressureComponent[];
  positionQualityLabel: string;
  positionQualityScore: number;
  positioningQualityLabel: string;
  positiveForces: MarketPressureComponent[];
  pressureComponents: MarketPressureComponent[];
  pressureTrend: PressureTrend;
  regimeTransitionLabel: string;
  regimeTransitionRisk: number;
  signalQualityScore: number;
  summary: string;
  symbol: string;
  timeframeConflictLabel: string;
  timeframeConflictScore: number;
};

export type InstitutionalPressureSystem = {
  averageAsymmetryScore: number;
  averageCrowdingRisk: number;
  averageInstitutionalQuality: number;
  dangerSymbols: InstitutionalIntelligence[];
  highAsymmetry: InstitutionalIntelligence[];
  highCrowding: InstitutionalIntelligence[];
  institutionalLeaders: InstitutionalIntelligence[];
  marketPressureLabel: string;
  netMarketPressureScore: number;
  pressureSummary: string;
  rows: InstitutionalIntelligence[];
};

type ScoreInput = {
  breadthStrength: number;
  crowdingRisk: number;
  earningsFragility: number;
  exchangeHealth: number;
  liquidityPressure: number;
  macroAlignment: number;
  narrativeMomentum: number;
  riskAppetite: number;
  sectorMomentum: number;
  volatilityPressure: number;
};

export function buildInstitutionalPressureSystem(rows: OpportunityViewModel[]): InstitutionalPressureSystem {
  const models = rows.map(buildInstitutionalIntelligence).sort((left, right) => right.institutionalQualityScore - left.institutionalQualityScore);
  const netMarketPressureScore = Math.round(average(models.map((model) => model.netMarketPressureScore), 50));
  const averageInstitutionalQuality = Math.round(average(models.map((model) => model.institutionalQualityScore), 50));
  const averageAsymmetryScore = Math.round(average(models.map((model) => model.asymmetryScore), 50));
  const averageCrowdingRisk = Math.round(average(models.map((model) => model.crowdingRiskScore), 50));
  const highCrowding = models.filter((model) => model.crowdingRiskScore >= 70).sort((left, right) => right.crowdingRiskScore - left.crowdingRiskScore).slice(0, 5);
  const highAsymmetry = models.filter((model) => model.asymmetryScore >= 62).sort((left, right) => right.asymmetryScore - left.asymmetryScore).slice(0, 5);
  const institutionalLeaders = models.filter((model) => model.institutionalQualityScore >= 62).slice(0, 5);
  const dangerSymbols = models
    .filter((model) => model.dangerAlerts.length > 0)
    .sort((left, right) => alertSeverityScore(right) - alertSeverityScore(left))
    .slice(0, 5);

  return {
    averageAsymmetryScore,
    averageCrowdingRisk,
    averageInstitutionalQuality,
    dangerSymbols,
    highAsymmetry,
    highCrowding,
    institutionalLeaders,
    marketPressureLabel: pressureLabel(netMarketPressureScore),
    netMarketPressureScore,
    pressureSummary: systemSummary({ averageAsymmetryScore, averageCrowdingRisk, averageInstitutionalQuality, netMarketPressureScore }),
    rows: models,
  };
}

export function buildInstitutionalIntelligence(row: OpportunityViewModel): InstitutionalIntelligence {
  const inputs = scoreInputs(row);
  const crowdingRiskScore = crowdingRisk(row, inputs);
  const extensionSeverity = extensionScore(row);
  const asymmetryScore = asymmetryScoreFor(row, inputs, crowdingRiskScore);
  const signalQualityScore = signalQuality(row);
  const institutionalQualityScore = institutionalQuality(row, inputs, crowdingRiskScore, asymmetryScore);
  const institutionalFragility = Math.round(clamp(average([row.fragility, crowdingRiskScore, inputs.volatilityPressure, inputs.liquidityPressure, 100 - inputs.macroAlignment], 50)));
  const positionQualityScore = positionQuality(row, inputs, crowdingRiskScore, asymmetryScore, institutionalQualityScore);
  const regimeTransitionRisk = regimeTransitionRiskFor(row, inputs);
  const timeframeConflictScore = timeframeConflictFor(row, inputs);
  const pressureComponents = pressureComponentsFor(inputs, crowdingRiskScore);
  const netMarketPressureScore = Math.round(weightedAverage(pressureComponents.map((component) => [component.score, pressureWeight(component.key)]), 50));
  const dangerAlerts = dangerAlertsFor({ crowdingRiskScore, extensionSeverity, inputs, institutionalFragility, positionQualityScore, regimeTransitionRisk, row });
  const compactLabels = compactLabelsFor({
    asymmetryScore,
    crowdingRiskScore,
    dangerAlerts,
    institutionalQualityScore,
    inputs,
    positionQualityScore,
    regimeTransitionRisk,
  });

  return {
    accumulationLikelihood: accumulationLikelihood(institutionalQualityScore, crowdingRiskScore),
    asymmetryQuality: qualityLabel(asymmetryScore, "Strong asymmetry", "Balanced asymmetry", "Weak asymmetry"),
    asymmetryScore,
    compactLabels,
    crowdingRiskScore,
    dangerAlerts,
    extensionSeverity,
    institutionalFragility,
    institutionalQualityLabel: qualityLabel(institutionalQualityScore, "High institutional quality", "Institutional quality mixed", "Low institutional quality"),
    institutionalQualityScore,
    liquidityContext: liquidityContext(inputs.liquidityPressure, row),
    marketPressureLabel: pressureLabel(netMarketPressureScore),
    narrativeMomentumLabel: qualityLabel(inputs.narrativeMomentum, "Narrative momentum improving", "Narrative momentum mixed", "Narrative momentum weak"),
    negativeForces: pressureComponents.filter((component) => component.contribution < -8).sort((left, right) => left.contribution - right.contribution).slice(0, 4),
    netMarketPressureScore,
    positionQualityLabel: qualityLabel(positionQualityScore, "High-quality position", "Position quality mixed", "Weak position quality"),
    positionQualityScore,
    positioningQualityLabel: positioningLabel(crowdingRiskScore, extensionSeverity),
    positiveForces: pressureComponents.filter((component) => component.contribution > 8).sort((left, right) => right.contribution - left.contribution).slice(0, 4),
    pressureComponents,
    pressureTrend: pressureTrendFor(row, netMarketPressureScore, regimeTransitionRisk),
    regimeTransitionLabel: qualityLabel(100 - regimeTransitionRisk, "Regime stable", "Regime transition possible", "Regime transition risk"),
    regimeTransitionRisk,
    signalQualityScore,
    summary: summaryFor({ asymmetryScore, crowdingRiskScore, institutionalQualityScore, netMarketPressureScore, positionQualityScore, row }),
    symbol: row.symbol,
    timeframeConflictLabel: qualityLabel(100 - timeframeConflictScore, "Timeframes aligned", "Timeframe evidence mixed", "Timeframe conflict"),
    timeframeConflictScore,
  };
}

export function compactInstitutionalLabels(row: OpportunityViewModel): string[] {
  return buildInstitutionalIntelligence(row).compactLabels;
}

function scoreInputs(row: OpportunityViewModel): ScoreInput {
  const raw = row.raw;
  const macroAlignment = scoreValue(raw.macro_alignment_score ?? raw.macro_score, macroScoreFromLabel(row.macroLabel));
  const exchangeHealth = scoreValue(raw.exchange_health_score, macroAlignment);
  const sectorMomentum = scoreValue(raw.sector_alignment_score ?? raw.sector_score, macroAlignment);
  const macroPressure = scoreValue(raw.macro_pressure_score, 100 - macroAlignment);
  const liquidityPressure = scoreValue(raw.liquidity_pressure, macroPressure);
  const volatilityPressure = scoreValue(raw.volatility_pressure ?? raw.atr_percentile, Math.max(row.fragility, 100 - macroAlignment));
  const breadthStrength = scoreValue(raw.breadth_score ?? raw.market_breadth_score, sectorMomentum);
  const riskAppetite = scoreValue(raw.risk_on_score, 100 - macroPressure);
  const eventRisk = scoreValue(raw.event_risk_score ?? raw.verified_event_pressure_score, row.eventRisk);
  const earningsFragility = eventMentions(row, ["earnings", "guidance", "eps", "revenue", "filing", "sec"]) ? eventRisk : Math.round(eventRisk * 0.7);
  const narrativeMomentum = narrativeMomentumFor(row);
  return {
    breadthStrength,
    crowdingRisk: 50,
    earningsFragility,
    exchangeHealth,
    liquidityPressure,
    macroAlignment,
    narrativeMomentum,
    riskAppetite,
    sectorMomentum,
    volatilityPressure,
  };
}

function pressureComponentsFor(input: ScoreInput, crowdingRiskScore: number): MarketPressureComponent[] {
  return [
    component("macro_pressure", "Macro Pressure", input.macroAlignment, "Macro alignment reflects broad market, liquidity, and regime support."),
    component("sector_momentum", "Sector Momentum", input.sectorMomentum, "Sector and theme participation help distinguish broad support from isolated moves."),
    component("exchange_health", "Exchange Health", input.exchangeHealth, "Exchange proxy health estimates whether the listing environment is supportive."),
    component("liquidity_pressure", "Liquidity Context", 100 - input.liquidityPressure, "Lower liquidity pressure is more supportive for position quality."),
    component("volatility_pressure", "Volatility Context", 100 - input.volatilityPressure, "Lower volatility pressure reduces structural fragility."),
    component("crowding_risk", "Crowding Risk", 100 - crowdingRiskScore, "Lower crowding means the setup is less chase-prone."),
    component("earnings_fragility", "Event Fragility", 100 - input.earningsFragility, "Lower verified event or earnings fragility improves setup durability."),
    component("narrative_momentum", "Narrative Momentum", input.narrativeMomentum, "Narrative momentum tracks whether the setup story is strengthening or fading."),
    component("breadth_strength", "Breadth Strength", input.breadthStrength, "Breadth strength estimates whether participation is broad enough to support continuation."),
    component("risk_appetite", "Risk Appetite", input.riskAppetite, "Risk appetite estimates whether the market is rewarding risk assets."),
  ];
}

function component(key: InstitutionalPressureKey, label: string, score: number, explanation: string): MarketPressureComponent {
  const bounded = Math.round(clamp(score));
  return {
    contribution: Math.round(bounded - 50),
    explanation,
    key,
    label,
    score: bounded,
  };
}

function crowdingRisk(row: OpportunityViewModel, input: ScoreInput): number {
  const shockChase = row.shockPattern?.chaseRiskScore ?? null;
  const volumeHeat = volumeHeatScore(row);
  const extension = extensionScore(row);
  const returnHeat = returnHeatScore(row);
  return Math.round(clamp(weightedAverage([
    [extension, 0.30],
    [row.fragility, 0.20],
    [input.volatilityPressure, 0.16],
    [returnHeat, 0.12],
    [volumeHeat, 0.10],
    [shockChase, 0.12],
  ], 50)));
}

function extensionScore(row: OpportunityViewModel): number {
  const entryDistance = Math.abs(numberField(row.raw.entry_distance_pct) ?? numberField(row.raw.distance_from_entry_pct) ?? 0);
  const oneDay = Math.abs(percentReturn(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0);
  const fiveDay = Math.abs(percentReturn(row.raw.return_5d) ?? oneDay);
  const rsi = numberField(row.raw.rsi);
  const rsiHeat = rsi === null ? 50 : clamp((rsi - 45) * 2.2);
  return Math.round(clamp(entryDistance * 6.5 + oneDay * 4.5 + fiveDay * 2.3 + rsiHeat * 0.25));
}

function asymmetryScoreFor(row: OpportunityViewModel, input: ScoreInput, crowdingRiskScore: number): number {
  const shockAsymmetry = row.shockPattern?.asymmetryScore ?? null;
  const upsideShock = row.shockPattern?.upsideShockScore ?? null;
  const downsideRisk = row.shockPattern?.downsideRiskScore ?? null;
  const rewardRisk = rewardRiskScore(row);
  const entryQuality = entryQualityScore(row);
  const downsideContainment = downsideRisk === null ? 100 - row.fragility : 100 - downsideRisk;
  const macroSupport = average([input.macroAlignment, input.sectorMomentum, input.exchangeHealth], 50);
  return Math.round(clamp(weightedAverage([
    [shockAsymmetry, 0.24],
    [upsideShock, 0.16],
    [rewardRisk, 0.20],
    [entryQuality, 0.14],
    [downsideContainment, 0.16],
    [macroSupport, 0.10],
  ], 50) - Math.max(0, crowdingRiskScore - 72) * 0.18));
}

function institutionalQuality(row: OpportunityViewModel, input: ScoreInput, crowdingRiskScore: number, asymmetryScore: number): number {
  const liquidityQuality = liquidityQualityScore(row, input);
  const trendPersistence = average([scoreValue(row.final_score, 50), row.conviction], 50);
  const volatilityQuality = 100 - Math.max(0, input.volatilityPressure - 45) * 1.1;
  const eventQuality = 100 - input.earningsFragility * 0.55;
  const macroSector = average([input.macroAlignment, input.exchangeHealth, input.sectorMomentum, input.breadthStrength], 50);
  return Math.round(clamp(weightedAverage([
    [liquidityQuality, 0.18],
    [macroSector, 0.22],
    [trendPersistence, 0.20],
    [volatilityQuality, 0.12],
    [eventQuality, 0.10],
    [asymmetryScore, 0.10],
    [100 - crowdingRiskScore, 0.08],
  ], 50)));
}

function positionQuality(row: OpportunityViewModel, input: ScoreInput, crowdingRiskScore: number, asymmetryScore: number, institutionalQualityScore: number): number {
  const entryQuality = entryQualityScore(row);
  const downsideContainment = 100 - downsideRisk(row, input);
  return Math.round(clamp(weightedAverage([
    [entryQuality, 0.22],
    [asymmetryScore, 0.20],
    [institutionalQualityScore, 0.20],
    [100 - crowdingRiskScore, 0.18],
    [downsideContainment, 0.14],
    [100 - row.fragility, 0.06],
  ], 50)));
}

function signalQuality(row: OpportunityViewModel): number {
  const technical = scoreValue(row.raw.technical_score ?? row.raw.setup_score ?? row.raw.base_score, row.final_score ?? 50);
  return Math.round(clamp(average([technical, row.conviction, scoreValue(row.final_score, 50)], 50)));
}

function regimeTransitionRiskFor(row: OpportunityViewModel, input: ScoreInput): number {
  const narrativeDeterioration = row.narrative?.narrativeDrift.deteriorationScore ?? 50;
  const macroPressure = scoreValue(row.raw.macro_pressure_score, 100 - input.macroAlignment);
  const scoreChange = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const changeRisk = scoreChange === null ? 50 : clamp(50 - scoreChange * 8);
  return Math.round(clamp(weightedAverage([
    [input.volatilityPressure, 0.25],
    [input.liquidityPressure, 0.20],
    [macroPressure, 0.20],
    [narrativeDeterioration, 0.18],
    [changeRisk, 0.17],
  ], 50)));
}

function timeframeConflictFor(row: OpportunityViewModel, input: ScoreInput): number {
  const shortTerm = clamp(50 + (percentReturn(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0) * 6 + (numberField(row.raw.relative_volume) ?? 1) * 4);
  const mediumTerm = average([row.conviction, scoreValue(row.final_score, 50), input.sectorMomentum], 50);
  const longTerm = average([input.macroAlignment, input.riskAppetite, scoreValue(row.raw.trend_score_200d ?? row.raw.long_term_trend_score, mediumTerm)], 50);
  const spread = Math.max(shortTerm, mediumTerm, longTerm) - Math.min(shortTerm, mediumTerm, longTerm);
  return Math.round(clamp(spread * 2.2));
}

function dangerAlertsFor({
  crowdingRiskScore,
  extensionSeverity,
  inputs,
  institutionalFragility,
  positionQualityScore,
  regimeTransitionRisk,
  row,
}: {
  crowdingRiskScore: number;
  extensionSeverity: number;
  inputs: ScoreInput;
  institutionalFragility: number;
  positionQualityScore: number;
  regimeTransitionRisk: number;
  row: OpportunityViewModel;
}): InstitutionalDangerAlert[] {
  const alerts: InstitutionalDangerAlert[] = [];
  if (crowdingRiskScore >= 74) alerts.push({ explanation: "Momentum and entry distance suggest the setup may be crowded or chase-prone.", label: "Elevated Crowding", severity: crowdingRiskScore >= 84 ? "critical" : "warning" });
  if (extensionSeverity >= 76) alerts.push({ explanation: "Recent extension reduces position quality even if the signal still looks strong.", label: "Euphoric Extension", severity: extensionSeverity >= 88 ? "critical" : "warning" });
  if (inputs.volatilityPressure >= 72) alerts.push({ explanation: "Volatility pressure is high enough to increase two-sided risk.", label: "Volatility Instability", severity: inputs.volatilityPressure >= 84 ? "critical" : "warning" });
  if (inputs.liquidityPressure >= 72) alerts.push({ explanation: "Liquidity pressure can weaken follow-through quality.", label: "Liquidity Deterioration", severity: inputs.liquidityPressure >= 84 ? "critical" : "warning" });
  if (regimeTransitionRisk >= 72) alerts.push({ explanation: "Market structure shows enough transition risk to reduce confidence in continuation.", label: "Regime Transition Risk", severity: regimeTransitionRisk >= 84 ? "critical" : "warning" });
  if (inputs.earningsFragility >= 72) alerts.push({ explanation: "Verified event or earnings sensitivity is elevated.", label: "Event Fragility", severity: inputs.earningsFragility >= 84 ? "critical" : "warning" });
  if (positionQualityScore < 42 && row.conviction >= 62) alerts.push({ explanation: "The signal is stronger than the position quality, so the setup may be late or poorly asymmetric.", label: "Signal Better Than Position", severity: "warning" });
  if (institutionalFragility >= 78) alerts.push({ explanation: "Crowding, volatility, or macro pressure makes institutional-style durability fragile.", label: "Institutional Fragility", severity: institutionalFragility >= 88 ? "critical" : "warning" });
  return alerts.slice(0, 5);
}

function compactLabelsFor({
  asymmetryScore,
  crowdingRiskScore,
  dangerAlerts,
  institutionalQualityScore,
  inputs,
  positionQualityScore,
  regimeTransitionRisk,
}: {
  asymmetryScore: number;
  crowdingRiskScore: number;
  dangerAlerts: InstitutionalDangerAlert[];
  institutionalQualityScore: number;
  inputs: ScoreInput;
  positionQualityScore: number;
  regimeTransitionRisk: number;
}): string[] {
  const labels: string[] = [];
  if (institutionalQualityScore >= 72) labels.push("High Institutional Quality");
  if (asymmetryScore >= 70) labels.push("Strong Asymmetry");
  if (positionQualityScore >= 70) labels.push("High-Quality Position");
  if (inputs.liquidityPressure <= 42) labels.push("Liquidity Supported");
  if (inputs.narrativeMomentum >= 68) labels.push("Narrative Momentum Improving");
  if (crowdingRiskScore >= 70) labels.push("Elevated Crowding");
  if (regimeTransitionRisk >= 70) labels.push("Regime Transition Risk");
  if (dangerAlerts.length > 0) labels.push("Danger Alert");
  return labels.slice(0, 4);
}

function summaryFor({
  asymmetryScore,
  crowdingRiskScore,
  institutionalQualityScore,
  netMarketPressureScore,
  positionQualityScore,
  row,
}: {
  asymmetryScore: number;
  crowdingRiskScore: number;
  institutionalQualityScore: number;
  netMarketPressureScore: number;
  positionQualityScore: number;
  row: OpportunityViewModel;
}): string {
  const signalVsPosition = positionQualityScore + 8 < signalQuality(row)
    ? "Signal quality is stronger than position quality, so timing and chase risk matter."
    : "Signal quality and position quality are broadly aligned.";
  return `${row.symbol} shows ${pressureLabel(netMarketPressureScore).toLowerCase()} with ${qualityLabel(institutionalQualityScore, "high institutional quality", "mixed institutional quality", "low institutional quality").toLowerCase()}. Asymmetry is ${asymmetryScore}/100 and crowding risk is ${crowdingRiskScore}/100. ${signalVsPosition}`;
}

function systemSummary(input: { averageAsymmetryScore: number; averageCrowdingRisk: number; averageInstitutionalQuality: number; netMarketPressureScore: number }): string {
  return `Latest universe pressure is ${pressureLabel(input.netMarketPressureScore).toLowerCase()}. Average institutional quality is ${input.averageInstitutionalQuality}/100, asymmetry ${input.averageAsymmetryScore}/100, and crowding risk ${input.averageCrowdingRisk}/100. This is market-structure context, not a trade instruction.`;
}

function pressureTrendFor(row: OpportunityViewModel, netPressure: number, transitionRisk: number): PressureTrend {
  const change = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  if (transitionRisk >= 72) return "transitioning";
  if (change !== null && change >= 2.5 && netPressure >= 55) return "improving";
  if (change !== null && change <= -2.5) return "deteriorating";
  const drift = row.narrative?.narrativeDrift.label;
  if (drift === "strengthening") return "improving";
  if (drift === "deteriorating") return "deteriorating";
  if (drift === "transitioning") return "transitioning";
  return "stable";
}

function liquidityContext(liquidityPressure: number, row: OpportunityViewModel): string {
  if (liquidityPressure <= 40) return `${row.symbol} appears liquidity-supported in the available proxy set.`;
  if (liquidityPressure >= 70) return `${row.symbol} faces elevated liquidity pressure, which can reduce follow-through quality.`;
  return `${row.symbol} has mixed liquidity context; price structure should be interpreted with normal caution.`;
}

function positioningLabel(crowdingRiskScore: number, extensionSeverity: number): string {
  if (crowdingRiskScore >= 74 || extensionSeverity >= 78) return "Crowded / chase-prone";
  if (crowdingRiskScore <= 42 && extensionSeverity <= 46) return "Early or balanced positioning";
  return "Positioning quality mixed";
}

function accumulationLikelihood(score: number, crowding: number): string {
  if (score >= 74 && crowding < 62) return "Institutional accumulation characteristics present";
  if (score >= 58) return "Some institutional-quality characteristics present";
  return "Institutional-quality evidence is limited";
}

function pressureLabel(score: number): string {
  if (score >= 74) return "Strong Supportive Pressure";
  if (score >= 62) return "Supportive Pressure";
  if (score >= 48) return "Mixed Pressure";
  if (score >= 35) return "Hostile / Mixed Pressure";
  return "Hostile Pressure";
}

function qualityLabel(score: number, high: string, medium: string, low: string): string {
  if (score >= 68) return high;
  if (score >= 48) return medium;
  return low;
}

function liquidityQualityScore(row: OpportunityViewModel, input: ScoreInput): number {
  const rawVolume = numberField(row.raw.volume ?? row.raw.avg_volume ?? row.raw.average_volume);
  const volumeScore = rawVolume === null ? 55 : clamp(20 + Math.log10(Math.max(1, rawVolume)) * 10);
  const relativeVolume = numberField(row.raw.relative_volume ?? row.raw.volume_ratio);
  const relativeVolumeScore = relativeVolume === null ? 55 : clamp(50 + (relativeVolume - 1) * 18);
  return Math.round(clamp(weightedAverage([[volumeScore, 0.34], [relativeVolumeScore, 0.22], [100 - input.liquidityPressure, 0.30], [100 - input.volatilityPressure, 0.14]], 55)));
}

function entryQualityScore(row: OpportunityViewModel): number {
  const entryDistance = Math.abs(numberField(row.raw.entry_distance_pct ?? row.raw.distance_from_entry_pct) ?? 4);
  const status = cleanText(row.entryStatus ?? row.raw.entry_status, "").toLowerCase();
  let base = clamp(86 - entryDistance * 7.5);
  if (status.includes("near") || status.includes("entry") || status.includes("watch")) base += 8;
  if (status.includes("extended") || status.includes("chase")) base -= 18;
  return Math.round(clamp(base));
}

function downsideRisk(row: OpportunityViewModel, input: ScoreInput): number {
  const patternDownside = row.shockPattern?.downsideRiskScore ?? null;
  return Math.round(clamp(weightedAverage([
    [patternDownside, 0.26],
    [row.fragility, 0.22],
    [input.volatilityPressure, 0.18],
    [input.liquidityPressure, 0.14],
    [100 - input.macroAlignment, 0.12],
    [extensionScore(row), 0.08],
  ], 50)));
}

function rewardRiskScore(row: OpportunityViewModel): number {
  const direct = numberField(row.raw.risk_reward ?? row.raw.reward_risk_ratio);
  if (direct !== null) return Math.round(clamp(35 + direct * 18));
  const price = row.price;
  const stop = row.stop_loss;
  const target = row.target;
  if (price !== null && stop !== null && target !== null && price > stop && target > price) {
    const ratio = (target - price) / Math.max(0.01, price - stop);
    return Math.round(clamp(35 + ratio * 18));
  }
  return 50;
}

function volumeHeatScore(row: OpportunityViewModel): number {
  const relativeVolume = numberField(row.raw.relative_volume ?? row.raw.volume_ratio ?? row.raw.volume_spike_ratio);
  if (relativeVolume === null) return 50;
  return Math.round(clamp(35 + relativeVolume * 18));
}

function returnHeatScore(row: OpportunityViewModel): number {
  const oneDay = Math.abs(percentReturn(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0);
  const fiveDay = Math.abs(percentReturn(row.raw.return_5d) ?? oneDay);
  return Math.round(clamp(oneDay * 8 + fiveDay * 4));
}

function narrativeMomentumFor(row: OpportunityViewModel): number {
  if (row.narrative) {
    return Math.round(clamp(row.narrative.narrativeDrift.momentumScore - row.narrative.narrativeDrift.deteriorationScore * 0.18));
  }
  const scoreChange = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const eventConviction = numberField(row.raw.event_conviction_adjustment);
  const fallback = 50 + (scoreChange ?? 0) * 6 + (eventConviction ?? 0) * 5;
  return Math.round(clamp(fallback));
}

function eventMentions(row: OpportunityViewModel, needles: string[]): boolean {
  const haystack = [
    row.eventLabel,
    row.raw.event_context_label,
    row.raw.event_context_summary,
    row.raw.event_context_reason_codes,
    row.raw.verified_event_titles,
  ].map((value) => cleanText(value, "").toLowerCase()).join(" ");
  return needles.some((needle) => haystack.includes(needle));
}

function macroScoreFromLabel(label: string): number {
  const normalized = label.toLowerCase();
  if (normalized.includes("aligned")) return 68;
  if (normalized.includes("conflict")) return 36;
  return 52;
}

function pressureWeight(key: InstitutionalPressureKey): number {
  const weights: Record<InstitutionalPressureKey, number> = {
    breadth_strength: 0.10,
    crowding_risk: 0.10,
    earnings_fragility: 0.07,
    exchange_health: 0.12,
    liquidity_pressure: 0.12,
    macro_pressure: 0.14,
    narrative_momentum: 0.09,
    risk_appetite: 0.09,
    sector_momentum: 0.12,
    volatility_pressure: 0.05,
  };
  return weights[key];
}

function alertSeverityScore(model: InstitutionalIntelligence): number {
  return model.dangerAlerts.reduce((total, alert) => total + (alert.severity === "critical" ? 3 : alert.severity === "warning" ? 2 : 1), 0);
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = numberField(value);
  return Math.round(clamp(parsed ?? fallback));
}

function numberField(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function percentReturn(value: unknown): number | null {
  const parsed = numberField(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
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

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function institutionalOpportunityState(model: InstitutionalIntelligence): string {
  if (model.dangerAlerts.some((alert) => alert.severity === "critical")) return "Danger Alert";
  if (model.positionQualityScore >= 72 && model.asymmetryScore >= 68) return "Asymmetric Institutional Setup";
  if (model.institutionalQualityScore >= 72) return "High Institutional Quality";
  if (model.crowdingRiskScore >= 72) return "Elevated Crowding";
  if (model.regimeTransitionRisk >= 72) return "Regime Transition Risk";
  return humanizeLabel(model.marketPressureLabel);
}
