import {
  buildInstitutionalIntelligence,
  buildInstitutionalPressureSystem,
  type InstitutionalIntelligence,
  type InstitutionalPressureSystem,
} from "./institutional-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export type DynamicMarketState =
  | "Asymmetric Opportunity Window"
  | "Broad Risk Compression"
  | "Defensive Rotation"
  | "Fragile Momentum"
  | "High Fragility Environment"
  | "Liquidity Tightening"
  | "Mixed Decision Tape"
  | "Risk-On Expansion"
  | "Volatility Expansion";

export type MetaOpportunityCategory =
  | "Asymmetric Opportunity"
  | "Core Opportunity"
  | "Event-Driven Opportunity"
  | "Institutional Quality"
  | "Momentum Continuation"
  | "Pullback Opportunity"
  | "Risk-Tolerant Opportunity"
  | "Shock Opportunity";

export type AttentionPriority = "critical" | "high" | "low" | "medium";

export type MetaOpportunityPriority = {
  attentionPriority: AttentionPriority;
  category: MetaOpportunityCategory;
  decision: string;
  decisionQualityScore: number;
  keyReasons: string[];
  keyRisks: string[];
  metaOpportunityScore: number;
  metaRiskScore: number;
  opportunityQualityScore: number;
  state: string;
  symbol: string;
  timingQualityScore: number;
  urgencyScore: number;
};

export type MetaOpportunityGroup = {
  category: MetaOpportunityCategory;
  description: string;
  opportunities: MetaOpportunityPriority[];
};

export type MetaIntelligenceConflict = {
  detail: string;
  severity: "info" | "warning";
  symbol: string;
  title: string;
};

export type MetaIntelligenceTimelineSignal = {
  detail: string;
  signalType: "danger" | "improvement" | "transition" | "trigger";
  symbol: string;
};

export type TradeVetoOperatingSystem = {
  attentionQueue: MetaOpportunityPriority[];
  conflicts: MetaIntelligenceConflict[];
  dangerQueue: MetaOpportunityPriority[];
  decisionQualityAverage: number;
  executiveBriefing: string[];
  generatedAt: string;
  institutionalSystem: InstitutionalPressureSystem;
  marketState: DynamicMarketState;
  marketStateReason: string;
  metaOpportunityAverage: number;
  metaRiskAverage: number;
  opportunityHierarchy: MetaOpportunityGroup[];
  personalizedBriefing: string[];
  priorityQueue: MetaOpportunityPriority[];
  summary: string;
  timelineSignals: MetaIntelligenceTimelineSignal[];
};

export type MetaIntelligenceBuildInput = {
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

type RowMetaInput = {
  institutional: InstitutionalIntelligence;
  row: OpportunityViewModel;
  workflowUrgency: number;
};

export function buildTradeVetoOperatingSystem(input: MetaIntelligenceBuildInput): TradeVetoOperatingSystem {
  const institutionalSystem = buildInstitutionalPressureSystem(input.rows);
  const institutionalBySymbol = new Map(institutionalSystem.rows.map((model) => [model.symbol, model]));
  const priorities = input.rows
    .map((row) => buildMetaOpportunity({
      institutional: institutionalBySymbol.get(row.symbol) ?? buildInstitutionalIntelligence(row),
      row,
      workflowUrgency: workflowUrgencyFor(row.symbol, input.workflowEvolution ?? null),
    }))
    .sort(comparePriority);

  const priorityQueue = priorities.slice(0, 8);
  const attentionQueue = priorities
    .filter((item) => item.attentionPriority === "critical" || item.attentionPriority === "high")
    .slice(0, 8);
  const dangerQueue = priorities
    .filter((item) => item.metaRiskScore >= 70 || item.keyRisks.some((risk) => /crowding|fragility|liquidity|volatility|regime/i.test(risk)))
    .sort((left, right) => right.metaRiskScore - left.metaRiskScore || right.urgencyScore - left.urgencyScore)
    .slice(0, 6);
  const marketState = classifyMarketState(input.rows, institutionalSystem);
  const executiveBriefing = executiveBriefingFor({ dangerQueue, institutionalSystem, marketState, priorityQueue });
  const personalizedBriefing = personalizedBriefingFor({ personalizationProfile: input.personalizationProfile ?? null, priorityQueue });
  const timelineSignals = timelineSignalsFor(input.workflowEvolution ?? null, priorityQueue);
  const conflicts = conflictsFor(priorityQueue);
  const metaOpportunityAverage = Math.round(average(priorities.map((item) => item.metaOpportunityScore), 50));
  const metaRiskAverage = Math.round(average(priorities.map((item) => item.metaRiskScore), 50));
  const decisionQualityAverage = Math.round(average(priorities.map((item) => item.decisionQualityScore), 50));

  return {
    attentionQueue,
    conflicts,
    dangerQueue,
    decisionQualityAverage,
    executiveBriefing,
    generatedAt: new Date().toISOString(),
    institutionalSystem,
    marketState,
    marketStateReason: marketStateReason(marketState, institutionalSystem, input.rows),
    metaOpportunityAverage,
    metaRiskAverage,
    opportunityHierarchy: opportunityHierarchy(priorities),
    personalizedBriefing,
    priorityQueue,
    summary: summaryFor({ decisionQualityAverage, marketState, metaOpportunityAverage, metaRiskAverage, priorityQueue }),
    timelineSignals,
  };
}

function buildMetaOpportunity(input: RowMetaInput): MetaOpportunityPriority {
  const { institutional, row } = input;
  const timingQualityScore = timingQuality(row, input.workflowUrgency);
  const opportunityQualityScore = opportunityQuality(row, institutional, timingQualityScore);
  const metaRiskScore = metaRisk(row, institutional);
  const decisionQualityScore = decisionQuality(row, institutional, opportunityQualityScore, timingQualityScore, metaRiskScore);
  const urgencyScore = urgency(row, institutional, input.workflowUrgency, metaRiskScore);
  const metaOpportunityScore = Math.round(clamp(opportunityQualityScore * 0.36 + decisionQualityScore * 0.30 + urgencyScore * 0.16 + institutional.asymmetryScore * 0.10 - metaRiskScore * 0.08));
  const category = categoryFor(row, institutional, opportunityQualityScore);
  const attentionPriority = attentionPriorityFor(metaOpportunityScore, metaRiskScore, urgencyScore);

  return {
    attentionPriority,
    category,
    decision: decisionLabel(row.final_decision),
    decisionQualityScore,
    keyReasons: keyReasons(row, institutional, category),
    keyRisks: keyRisks(row, institutional, metaRiskScore),
    metaOpportunityScore,
    metaRiskScore,
    opportunityQualityScore,
    state: stateFor({ category, institutional, metaOpportunityScore, metaRiskScore, row, timingQualityScore }),
    symbol: row.symbol,
    timingQualityScore,
    urgencyScore,
  };
}

function decisionQuality(row: OpportunityViewModel, institutional: InstitutionalIntelligence, opportunityQualityScore: number, timingQualityScore: number, riskScore: number): number {
  const profileFit = row.final_decision?.toUpperCase() === "AVOID" ? 38 : row.final_decision?.toUpperCase() === "WAIT_PULLBACK" ? 58 : 62;
  return Math.round(clamp(
    row.conviction * 0.16 +
    institutional.positionQualityScore * 0.20 +
    institutional.asymmetryScore * 0.14 +
    institutional.institutionalQualityScore * 0.16 +
    opportunityQualityScore * 0.14 +
    timingQualityScore * 0.12 +
    profileFit * 0.08 -
    Math.max(0, riskScore - 66) * 0.20,
  ));
}

function timingQuality(row: OpportunityViewModel, workflowUrgency: number): number {
  const entryDistance = Math.abs(numberField(row.raw.entry_distance_pct ?? row.raw.distance_from_entry_pct) ?? 4);
  const return1d = Math.abs(percentReturn(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0);
  const status = cleanText(row.entryStatus ?? row.raw.entry_status, "").toLowerCase();
  let score = 82 - entryDistance * 7 - return1d * 3;
  if (status.includes("near") || status.includes("watch") || status.includes("entry")) score += 8;
  if (status.includes("extended") || status.includes("chase")) score -= 18;
  score += workflowUrgency * 0.08;
  return Math.round(clamp(score));
}

function opportunityQuality(row: OpportunityViewModel, institutional: InstitutionalIntelligence, timingQualityScore: number): number {
  const shock = row.shockPattern;
  const shockOpportunity = shock ? average([shock.opportunityScore, shock.upsideShockScore, shock.reliabilityScore], 50) : null;
  const narrativeMomentum = row.narrative?.narrativeDrift.momentumScore ?? null;
  return Math.round(clamp(weightedAverage([
    [row.final_score ?? null, 0.18],
    [row.conviction, 0.16],
    [institutional.institutionalQualityScore, 0.18],
    [institutional.asymmetryScore, 0.16],
    [institutional.netMarketPressureScore, 0.10],
    [timingQualityScore, 0.10],
    [shockOpportunity, 0.08],
    [narrativeMomentum, 0.04],
  ], 50)));
}

function metaRisk(row: OpportunityViewModel, institutional: InstitutionalIntelligence): number {
  const shockDownside = row.shockPattern?.downsideRiskScore ?? null;
  const eventRisk = numberField(row.raw.event_risk_score ?? row.raw.verified_event_pressure_score) ?? row.eventRisk;
  const volatilityPressure = numberField(row.raw.volatility_pressure);
  const liquidityPressure = numberField(row.raw.liquidity_pressure);
  return Math.round(clamp(weightedAverage([
    [row.fragility, 0.20],
    [institutional.crowdingRiskScore, 0.20],
    [institutional.institutionalFragility, 0.16],
    [eventRisk, 0.14],
    [shockDownside, 0.12],
    [volatilityPressure, 0.09],
    [liquidityPressure, 0.09],
  ], 50)));
}

function urgency(row: OpportunityViewModel, institutional: InstitutionalIntelligence, workflowUrgency: number, riskScore: number): number {
  const eventRisk = numberField(row.raw.event_risk_score ?? row.raw.verified_event_pressure_score) ?? row.eventRisk;
  const shockPressure = row.shockPattern ? average([row.shockPattern.currentSimilarityScore, row.shockPattern.opportunityScore, row.shockPattern.twoSidedVolatilityScore], 50) : null;
  const transitionRisk = institutional.regimeTransitionRisk;
  const scoreChange = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const changeUrgency = scoreChange === null ? 50 : clamp(50 + Math.abs(scoreChange) * 8);
  return Math.round(clamp(weightedAverage([
    [workflowUrgency, 0.24],
    [eventRisk, 0.16],
    [shockPressure, 0.18],
    [transitionRisk, 0.16],
    [changeUrgency, 0.14],
    [riskScore, 0.12],
  ], 50)));
}

function categoryFor(row: OpportunityViewModel, institutional: InstitutionalIntelligence, opportunityQualityScore: number): MetaOpportunityCategory {
  const setup = cleanText(row.raw.setup_type, "").toUpperCase();
  const decision = cleanText(row.final_decision, "").toUpperCase();
  if (row.shockPattern && row.shockPattern.upsideShockScore >= 70) return "Shock Opportunity";
  if (institutional.asymmetryScore >= 70) return "Asymmetric Opportunity";
  if (institutional.institutionalQualityScore >= 72) return "Institutional Quality";
  if (row.eventRisk >= 70 || cleanText(row.eventLabel, "").toLowerCase().includes("event")) return "Event-Driven Opportunity";
  if (setup.includes("PULLBACK")) return "Pullback Opportunity";
  if (setup.includes("CONTINUATION") || setup.includes("BREAKOUT") || setup.includes("MOMENTUM")) return "Momentum Continuation";
  if (decision === "ENTER" || opportunityQualityScore >= 68) return "Core Opportunity";
  return "Risk-Tolerant Opportunity";
}

function attentionPriorityFor(opportunity: number, risk: number, urgencyScore: number): AttentionPriority {
  if (urgencyScore >= 78 || (risk >= 78 && opportunity >= 55)) return "critical";
  if (opportunity >= 70 || risk >= 70 || urgencyScore >= 68) return "high";
  if (opportunity >= 55 || urgencyScore >= 55) return "medium";
  return "low";
}

function stateFor(input: {
  category: MetaOpportunityCategory;
  institutional: InstitutionalIntelligence;
  metaOpportunityScore: number;
  metaRiskScore: number;
  row: OpportunityViewModel;
  timingQualityScore: number;
}): string {
  if (input.metaRiskScore >= 78 && input.institutional.crowdingRiskScore >= 72) return "Danger / avoid chase";
  if (input.metaOpportunityScore >= 72 && input.timingQualityScore >= 62) return "High-priority research";
  if (input.category === "Shock Opportunity") return "High-volatility watch";
  if (input.timingQualityScore < 42) return "Poor timing quality";
  if (input.metaRiskScore >= 70) return "High-risk attention";
  return input.category;
}

function keyReasons(row: OpportunityViewModel, institutional: InstitutionalIntelligence, category: MetaOpportunityCategory): string[] {
  const reasons: string[] = [];
  reasons.push(`${category} based on unified scanner, macro, shock, and pressure context.`);
  if (institutional.institutionalQualityScore >= 65) reasons.push("Institutional-quality characteristics are above the current universe baseline.");
  if (institutional.asymmetryScore >= 65) reasons.push("Asymmetry is favorable relative to measured downside context.");
  if (row.shockPattern && row.shockPattern.opportunityScore >= 65) reasons.push("Shock pattern memory supports elevated high-volatility attention.");
  if (row.narrative?.narrativeDrift.label === "strengthening") reasons.push("Narrative momentum is strengthening in the cached reasoning layer.");
  if (row.conviction >= 70) reasons.push("Conviction is high enough to keep the setup in the review queue.");
  return reasons.slice(0, 4);
}

function keyRisks(row: OpportunityViewModel, institutional: InstitutionalIntelligence, riskScore: number): string[] {
  const risks: string[] = [];
  if (riskScore >= 70) risks.push("Meta risk is elevated; this should be treated as research context, not an action instruction.");
  if (institutional.crowdingRiskScore >= 68) risks.push("Crowding or chase risk can reduce position quality.");
  if (row.fragility >= 68) risks.push("Fragility is elevated enough to require clean invalidation awareness.");
  if (row.eventRisk >= 70) risks.push("Verified event pressure increases two-sided risk.");
  if (institutional.regimeTransitionRisk >= 70) risks.push("Regime transition risk can make continuation less durable.");
  return risks.length ? risks.slice(0, 4) : ["No dominant risk is confirmed, but evidence remains probabilistic."];
}

function classifyMarketState(rows: OpportunityViewModel[], institutionalSystem: InstitutionalPressureSystem): DynamicMarketState {
  const avgFragility = average(rows.map((row) => row.fragility), 50);
  const avgConviction = average(rows.map((row) => row.conviction), 50);
  const avgVolatility = average(rows.map((row) => numberField(row.raw.volatility_pressure) ?? 50), 50);
  const avgLiquidity = average(rows.map((row) => numberField(row.raw.liquidity_pressure) ?? 50), 50);
  const avgRiskOn = average(rows.map((row) => numberField(row.raw.risk_on_score) ?? 50), 50);
  const defensiveScore = defensiveRotationScore(rows);

  if (avgVolatility >= 72) return "Volatility Expansion";
  if (avgLiquidity >= 72) return "Liquidity Tightening";
  if (avgFragility >= 72 && institutionalSystem.averageCrowdingRisk >= 68) return "High Fragility Environment";
  if (avgConviction >= 66 && avgFragility >= 62) return "Fragile Momentum";
  if (institutionalSystem.averageAsymmetryScore >= 64 && institutionalSystem.netMarketPressureScore >= 56) return "Asymmetric Opportunity Window";
  if (avgRiskOn >= 66 && institutionalSystem.netMarketPressureScore >= 60) return "Risk-On Expansion";
  if (defensiveScore >= 65) return "Defensive Rotation";
  if (avgVolatility <= 42 && avgLiquidity <= 48 && avgConviction < 58) return "Broad Risk Compression";
  return "Mixed Decision Tape";
}

function marketStateReason(state: DynamicMarketState, institutionalSystem: InstitutionalPressureSystem, rows: OpportunityViewModel[]): string {
  const fragility = Math.round(average(rows.map((row) => row.fragility), 50));
  return `${state}: pressure ${institutionalSystem.netMarketPressureScore}/100, average institutional quality ${institutionalSystem.averageInstitutionalQuality}/100, asymmetry ${institutionalSystem.averageAsymmetryScore}/100, crowding ${institutionalSystem.averageCrowdingRisk}/100, fragility ${fragility}/100.`;
}

function opportunityHierarchy(priorities: MetaOpportunityPriority[]): MetaOpportunityGroup[] {
  const descriptions: Record<MetaOpportunityCategory, string> = {
    "Asymmetric Opportunity": "Setups where upside context is stronger than measured downside context.",
    "Core Opportunity": "Highest decision-quality candidates without forcing a trade instruction.",
    "Event-Driven Opportunity": "Symbols where verified event pressure materially affects attention.",
    "Institutional Quality": "Setups with stronger liquidity, pressure, and position-quality characteristics.",
    "Momentum Continuation": "Continuation or breakout candidates with supporting evidence.",
    "Pullback Opportunity": "Candidates where timing quality is more dependent on entry discipline.",
    "Risk-Tolerant Opportunity": "Speculative candidates that still deserve bounded review.",
    "Shock Opportunity": "High-volatility candidates supported by shock memory and current similarity.",
  };
  const categories: MetaOpportunityCategory[] = [
    "Core Opportunity",
    "Asymmetric Opportunity",
    "Shock Opportunity",
    "Pullback Opportunity",
    "Momentum Continuation",
    "Institutional Quality",
    "Event-Driven Opportunity",
    "Risk-Tolerant Opportunity",
  ];
  return categories
    .map((category) => ({
      category,
      description: descriptions[category],
      opportunities: priorities.filter((item) => item.category === category).slice(0, 5),
    }))
    .filter((group) => group.opportunities.length > 0)
    .slice(0, 6);
}

function executiveBriefingFor(input: {
  dangerQueue: MetaOpportunityPriority[];
  institutionalSystem: InstitutionalPressureSystem;
  marketState: DynamicMarketState;
  priorityQueue: MetaOpportunityPriority[];
}): string[] {
  const top = input.priorityQueue[0];
  const brief: string[] = [
    `${input.marketState} is the current meta state; ${input.institutionalSystem.pressureSummary}`,
  ];
  if (top) brief.push(`${top.symbol} is the top attention candidate with ${top.metaOpportunityScore}/100 meta opportunity and ${top.metaRiskScore}/100 meta risk.`);
  if (input.dangerQueue[0]) brief.push(`${input.dangerQueue[0].symbol} carries the highest immediate danger context; review crowding, fragility, or regime risk before treating it as attractive.`);
  if (input.institutionalSystem.highAsymmetry[0]) brief.push(`${input.institutionalSystem.highAsymmetry[0].symbol} currently leads asymmetry context among visible symbols.`);
  return brief.slice(0, 4);
}

function personalizedBriefingFor(input: {
  personalizationProfile: UserPersonalizationProfile | null;
  priorityQueue: MetaOpportunityPriority[];
}): string[] {
  if (!input.personalizationProfile) {
    return ["Personalized briefing will sharpen after the user risk profile and behavior memory are available."];
  }
  const profile = input.personalizationProfile;
  const aligned = input.priorityQueue.filter((item) => profileAligned(item, profile)).slice(0, 3);
  const lines = [
    `${profile.label} profile: ranking emphasizes ${profile.preferredRiskLevel} risk and ${profile.preferredRewardLevel} reward preferences.`,
  ];
  if (aligned[0]) lines.push(`${aligned[0].symbol} best matches this profile among current high-priority candidates.`);
  if (profile.volatilityTolerance < 50) lines.push("Lower volatility tolerance means shock and crowding candidates should stay secondary unless timing quality improves.");
  if (profile.asymmetryPreference >= 65) lines.push("Asymmetry preference increases attention on setups with favorable upside/downside structure.");
  return lines.slice(0, 4);
}

function timelineSignalsFor(workflow: WorkflowEvolutionSummary | null, priorityQueue: MetaOpportunityPriority[]): MetaIntelligenceTimelineSignal[] {
  const workflowSignals: MetaIntelligenceTimelineSignal[] = [];
  for (const item of workflow?.improvingSetups ?? []) {
    workflowSignals.push({ detail: item.detail, signalType: "improvement", symbol: item.symbol });
  }
  for (const item of workflow?.deterioratingSetups ?? []) {
    workflowSignals.push({ detail: item.detail, signalType: "danger", symbol: item.symbol });
  }
  for (const item of workflow?.triggerMonitors ?? []) {
    workflowSignals.push({ detail: item.reason, signalType: "trigger", symbol: item.symbol });
  }
  const prioritySignals = priorityQueue
    .filter((item) => item.urgencyScore >= 70)
    .map((item): MetaIntelligenceTimelineSignal => ({
      detail: `${item.symbol} has elevated attention urgency from the meta orchestrator.`,
      signalType: item.metaRiskScore >= 70 ? "danger" : "transition",
      symbol: item.symbol,
    }));
  return [...workflowSignals, ...prioritySignals].slice(0, 8);
}

function conflictsFor(priorityQueue: MetaOpportunityPriority[]): MetaIntelligenceConflict[] {
  return priorityQueue
    .filter((item) => item.metaOpportunityScore >= 62 && item.metaRiskScore >= 68)
    .map((item) => ({
      detail: `${item.symbol} has attractive opportunity context but elevated risk. The system should explain both sides instead of forcing an action.`,
      severity: item.metaRiskScore >= 78 ? "warning" as const : "info" as const,
      symbol: item.symbol,
      title: "Opportunity and risk conflict",
    }))
    .slice(0, 6);
}

function summaryFor(input: {
  decisionQualityAverage: number;
  marketState: DynamicMarketState;
  metaOpportunityAverage: number;
  metaRiskAverage: number;
  priorityQueue: MetaOpportunityPriority[];
}): string {
  const leader = input.priorityQueue[0]?.symbol ?? "No single symbol";
  return `${input.marketState}: ${leader} currently leads attention. Average meta opportunity is ${input.metaOpportunityAverage}/100, decision quality ${input.decisionQualityAverage}/100, and meta risk ${input.metaRiskAverage}/100. This is an intelligence briefing, not financial advice.`;
}

function workflowUrgencyFor(symbol: string, workflow: WorkflowEvolutionSummary | null): number {
  if (!workflow) return 50;
  const normalized = symbol.toUpperCase();
  let score = 45;
  if (workflow.improvingSetups.some((item) => item.symbol === normalized)) score += 16;
  if (workflow.triggerMonitors.some((item) => item.symbol === normalized)) score += 18;
  if (workflow.watchlistEvolution.some((item) => item.symbol === normalized)) score += 12;
  if (workflow.deterioratingSetups.some((item) => item.symbol === normalized)) score += 14;
  return clamp(score);
}

function profileAligned(item: MetaOpportunityPriority, profile: UserPersonalizationProfile): boolean {
  if (profile.preferredRiskLevel === "low" && item.metaRiskScore > 58) return false;
  if (profile.preferredRiskLevel === "high" && item.metaOpportunityScore >= 58) return true;
  if (profile.preferredRewardLevel === "high" && item.opportunityQualityScore >= 64) return true;
  return item.decisionQualityScore >= 60;
}

function defensiveRotationScore(rows: OpportunityViewModel[]): number {
  const defensiveRows = rows.filter((row) => /healthcare|utilities|staples|gold|defensive/i.test(`${row.sector ?? ""} ${row.symbol}`));
  if (!defensiveRows.length) return 45;
  return average(defensiveRows.map((row) => row.final_score ?? row.conviction), 45);
}

function comparePriority(left: MetaOpportunityPriority, right: MetaOpportunityPriority): number {
  return attentionRankScore(right) - attentionRankScore(left);
}

function attentionRankScore(item: MetaOpportunityPriority): number {
  return item.metaOpportunityScore * 0.48 + item.decisionQualityScore * 0.22 + item.urgencyScore * 0.18 - item.metaRiskScore * 0.12;
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

export function metaOpportunityLabel(item: MetaOpportunityPriority): string {
  if (item.attentionPriority === "critical") return "Critical Attention";
  if (item.metaOpportunityScore >= 72) return "High Priority";
  if (item.decisionQualityScore >= 68) return "High Decision Quality";
  if (item.metaRiskScore >= 70) return "Risk First Review";
  return humanizeLabel(item.category);
}
