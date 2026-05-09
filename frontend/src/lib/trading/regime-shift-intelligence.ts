import { buildInstitutionalPressureSystem } from "./institutional-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { buildMacroRegimeSummary } from "./macro-regime";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";

export type RealTimeMarketState =
  | "AI Narrative Weakening"
  | "Breadth Deterioration"
  | "Defensive Rotation"
  | "Fragile Momentum"
  | "Liquidity Tightening"
  | "Mixed Transition"
  | "Risk Appetite Deterioration"
  | "Risk-On Expansion"
  | "Sector Rotation"
  | "Volatility Expansion";

export type RegimeDriftDirection = "deteriorating" | "improving" | "stable" | "unstable_transition";
export type RegimeAlertSeverity = "critical" | "info" | "warning";

export type RegimeShiftComponentKey =
  | "breadth_health"
  | "exchange_health"
  | "liquidity_state"
  | "momentum_persistence"
  | "risk_appetite"
  | "sector_leadership"
  | "volatility_pressure";

export type RegimeShiftComponent = {
  detail: string;
  inverse: boolean;
  key: RegimeShiftComponentKey;
  label: string;
  score: number;
  state: string;
};

export type RegimeShiftAlert = {
  detail: string;
  reasonCodes: string[];
  score: number;
  severity: RegimeAlertSeverity;
  title: string;
};

export type RegimeDriftTimelineItem = {
  detail: string;
  direction: RegimeDriftDirection;
  label: string;
  metricLabel: string;
  score: number;
};

export type SectorLeadershipState = {
  aiMomentumScore: number;
  defensiveLeadershipScore: number;
  detail: string;
  growthLeadershipScore: number;
  leadingSectors: string[];
  rotationScore: number;
  weakeningSectors: string[];
};

export type RegimeShiftSystem = {
  alerts: RegimeShiftAlert[];
  breadthHealthScore: number;
  components: RegimeShiftComponent[];
  currentMarketState: RealTimeMarketState;
  driftDirection: RegimeDriftDirection;
  driftScore: number;
  driftTimeline: RegimeDriftTimelineItem[];
  exchangeHealthScore: number;
  generatedAt: string;
  liquidityPressure: number;
  limitations: string[];
  llmBoundary: string;
  macroRegime: string;
  momentumPersistenceScore: number;
  riskAppetiteScore: number;
  sectorLeadership: SectorLeadershipState;
  stateExplanation: string;
  terminalSummary: string;
  transitionRiskScore: number;
  volatilityPressure: number;
  whatToMonitor: string[];
};

export type RegimeShiftBuildInput = {
  generatedAt?: string;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

type RegimeMetrics = {
  breadthHealthScore: number;
  exchangeHealthScore: number;
  liquidityPressure: number;
  momentumPersistenceScore: number;
  riskAppetiteScore: number;
  volatilityPressure: number;
};

type SectorAggregate = {
  count: number;
  scoreTotal: number;
};

export function buildRegimeShiftSystem(input: RegimeShiftBuildInput): RegimeShiftSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  if (!input.rows.length) return emptySystem(generatedAt);

  const macroSummary = buildMacroRegimeSummary(input.rows.map((row) => row.raw));
  const institutional = buildInstitutionalPressureSystem(input.rows);
  const metrics = buildRegimeMetrics(input.rows, macroSummary, institutional.netMarketPressureScore);
  const sectorLeadership = buildSectorLeadership(input.rows);
  const transitionRiskScore = transitionRiskFor(input.rows, input.workflowEvolution ?? null, metrics, sectorLeadership);
  const driftScore = driftScoreFor(input.rows, input.workflowEvolution ?? null, metrics, transitionRiskScore);
  const driftDirection = driftDirectionFor(driftScore, transitionRiskScore);
  const currentMarketState = classifyMarketState(metrics, sectorLeadership, transitionRiskScore, average(input.rows.map((row) => row.fragility), 50));
  const alerts = alertsFor(metrics, sectorLeadership, transitionRiskScore);
  const components = componentsFor(metrics, sectorLeadership);
  const driftTimeline = driftTimelineFor(metrics, sectorLeadership, driftDirection, input.workflowEvolution ?? null);
  const stateExplanation = stateExplanationFor(currentMarketState, metrics, sectorLeadership, transitionRiskScore);

  return {
    alerts,
    breadthHealthScore: metrics.breadthHealthScore,
    components,
    currentMarketState,
    driftDirection,
    driftScore,
    driftTimeline,
    exchangeHealthScore: metrics.exchangeHealthScore,
    generatedAt,
    liquidityPressure: metrics.liquidityPressure,
    limitations: [
      "Regime Shift Intelligence is a deterministic market-state layer; it does not predict exact prices or future macro events.",
      "The engine uses scanner, macro proxy, workflow, sector, volatility, liquidity, and breadth fields available in the latest data packet.",
      "LLM explanations may summarize these outputs, but they must not invent transitions, events, probabilities, or override deterministic state.",
    ],
    llmBoundary: "LLM may explain why deterministic state changed and what to monitor next; it may not invent macro transitions, unsupported events, or direct action claims.",
    macroRegime: macroSummary.macroRegime,
    momentumPersistenceScore: metrics.momentumPersistenceScore,
    riskAppetiteScore: metrics.riskAppetiteScore,
    sectorLeadership,
    stateExplanation,
    terminalSummary: `${currentMarketState}: risk appetite ${metrics.riskAppetiteScore}/100, breadth ${metrics.breadthHealthScore}/100, volatility pressure ${metrics.volatilityPressure}/100, liquidity pressure ${metrics.liquidityPressure}/100, and transition risk ${transitionRiskScore}/100. This is market-state context, not a trade instruction.`,
    transitionRiskScore,
    volatilityPressure: metrics.volatilityPressure,
    whatToMonitor: monitorListFor(metrics, sectorLeadership, transitionRiskScore),
  };
}

function emptySystem(generatedAt: string): RegimeShiftSystem {
  return {
    alerts: [],
    breadthHealthScore: 50,
    components: [],
    currentMarketState: "Mixed Transition",
    driftDirection: "stable",
    driftScore: 50,
    driftTimeline: [],
    exchangeHealthScore: 50,
    generatedAt,
    liquidityPressure: 50,
    limitations: ["Regime state appears after scanner rows are available."],
    llmBoundary: "No LLM market-state explanation should run without deterministic market-state inputs.",
    macroRegime: "Mixed",
    momentumPersistenceScore: 50,
    riskAppetiteScore: 50,
    sectorLeadership: {
      aiMomentumScore: 50,
      defensiveLeadershipScore: 50,
      detail: "Sector leadership requires scanner rows.",
      growthLeadershipScore: 50,
      leadingSectors: [],
      rotationScore: 50,
      weakeningSectors: [],
    },
    stateExplanation: "Market-state detection is waiting for scanner rows.",
    terminalSummary: "Market-state detection is waiting for scanner rows.",
    transitionRiskScore: 50,
    volatilityPressure: 50,
    whatToMonitor: ["Scanner rows and macro proxy coverage."],
  };
}

function buildRegimeMetrics(
  rows: OpportunityViewModel[],
  macroSummary: ReturnType<typeof buildMacroRegimeSummary>,
  netMarketPressureScore: number,
): RegimeMetrics {
  const macroAlignment = average(rows.map((row) => scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score, 50)), 50);
  const exchangeHealth = average(rows.map((row) => scoreValue(row.raw.exchange_health_score, macroAlignment)), macroAlignment);
  const riskOn = average(rows.map((row) => scoreValue(row.raw.risk_on_score, macroSummary.riskOnScore)), macroSummary.riskOnScore);
  const volatility = average(rows.map((row) => scoreValue(row.raw.volatility_pressure ?? row.raw.atr_percentile, row.fragility)), macroSummary.volatilityPressure);
  const liquidity = average(rows.map((row) => scoreValue(row.raw.liquidity_pressure, macroSummary.liquidityPressure)), macroSummary.liquidityPressure);
  const nonAvoidShare = ratio(rows, (row) => !/AVOID|EXIT/.test(cleanText(row.final_decision, "").toUpperCase()));
  const constructiveScoreShare = ratio(rows, (row) => scoreValue(row.final_score, row.conviction) >= 58);
  const convictionShare = ratio(rows, (row) => row.conviction >= 60);
  const breadthExplicit = averageKnown(rows.map((row) => numberField(row.raw.breadth_score ?? row.raw.market_breadth_score)));
  const breadthHealthScore = Math.round(clamp(weightedAverage([
    [breadthExplicit, 0.24],
    [nonAvoidShare * 100, 0.22],
    [constructiveScoreShare * 100, 0.22],
    [convictionShare * 100, 0.18],
    [netMarketPressureScore, 0.14],
  ], 50)));
  const momentumPersistenceScore = momentumPersistence(rows);
  const riskAppetiteScore = Math.round(clamp(weightedAverage([
    [macroSummary.riskOnScore, 0.26],
    [riskOn, 0.22],
    [macroAlignment, 0.16],
    [netMarketPressureScore, 0.14],
    [breadthHealthScore, 0.12],
    [100 - volatility, 0.10],
  ], 50)));
  const volatilityBase = Math.max(macroSummary.volatilityPressure, volatility);
  const liquidityBase = Math.max(macroSummary.liquidityPressure, liquidity);

  return {
    breadthHealthScore,
    exchangeHealthScore: Math.round(clamp(exchangeHealth)),
    liquidityPressure: Math.round(clamp(weightedAverage([[liquidityBase, 0.58], [liquidity, 0.30], [100 - macroAlignment, 0.12]], 50))),
    momentumPersistenceScore,
    riskAppetiteScore,
    volatilityPressure: Math.round(clamp(weightedAverage([[volatilityBase, 0.58], [volatility, 0.30], [average(rows.map((row) => returnHeat(row)), 35), 0.12]], 50))),
  };
}

function momentumPersistence(rows: OpportunityViewModel[]): number {
  const positiveChangeShare = ratio(rows, (row) => {
    const change = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
    return change !== null && change > 0;
  });
  const scoreChange = averageKnown(rows.map((row) => numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change)));
  const returnMomentum = average(rows.map((row) => clamp(50 + (percentReturn(row.raw.return_5d) ?? percentReturn(row.raw.return_1d) ?? 0) * 5)), 50);
  const convictionShare = ratio(rows, (row) => row.conviction >= 64);
  return Math.round(clamp(weightedAverage([
    [positiveChangeShare * 100, 0.26],
    [scoreChange === null ? null : clamp(50 + scoreChange * 6), 0.22],
    [returnMomentum, 0.20],
    [convictionShare * 100, 0.18],
    [100 - average(rows.map((row) => row.fragility), 50), 0.14],
  ], 50)));
}

function buildSectorLeadership(rows: OpportunityViewModel[]): SectorLeadershipState {
  const sectorMap = new Map<string, SectorAggregate>();
  for (const row of rows) {
    const sector = normalizedSector(row);
    const score = scoreValue(row.raw.sector_alignment_score ?? row.final_score, row.conviction);
    const current = sectorMap.get(sector) ?? { count: 0, scoreTotal: 0 };
    current.count += 1;
    current.scoreTotal += score;
    sectorMap.set(sector, current);
  }
  const sectorScores = [...sectorMap.entries()]
    .map(([sector, aggregate]) => ({ score: Math.round(aggregate.scoreTotal / aggregate.count), sector }))
    .sort((left, right) => right.score - left.score);
  const leadingSectors = sectorScores.filter((item) => item.score >= 58).slice(0, 4).map((item) => item.sector);
  const weakeningSectors = sectorScores.filter((item) => item.score <= 45).sort((left, right) => left.score - right.score).slice(0, 4).map((item) => item.sector);
  const defensiveLeadershipScore = groupScore(rows, isDefensiveExposure, 48);
  const growthLeadershipScore = groupScore(rows, isGrowthExposure, 50);
  const aiMomentumScore = groupScore(rows, isAiExposure, 50);
  const narrativeWeakening = average(rows.filter(isAiExposure).map((row) => narrativeWeakeningScore(row)), 45);
  const rotationScore = Math.round(clamp(50 + (defensiveLeadershipScore - growthLeadershipScore) * 0.9 + Math.max(0, 55 - aiMomentumScore) * 0.35));
  const aiScore = Math.round(clamp(aiMomentumScore - Math.max(0, narrativeWeakening - 55) * 0.20));

  return {
    aiMomentumScore: aiScore,
    defensiveLeadershipScore: Math.round(clamp(defensiveLeadershipScore)),
    detail: sectorScores.length
      ? `Leadership is led by ${leadingSectors[0] ?? "mixed sectors"} while ${weakeningSectors[0] ?? "no sector"} is the clearest weakening group.`
      : "Sector leadership is mixed because scanner sector coverage is limited.",
    growthLeadershipScore: Math.round(clamp(growthLeadershipScore)),
    leadingSectors,
    rotationScore,
    weakeningSectors,
  };
}

function classifyMarketState(metrics: RegimeMetrics, sector: SectorLeadershipState, transitionRiskScore: number, averageFragility: number): RealTimeMarketState {
  if (metrics.volatilityPressure >= 72) return "Volatility Expansion";
  if (metrics.liquidityPressure >= 72) return "Liquidity Tightening";
  if (metrics.riskAppetiteScore <= 38 && metrics.breadthHealthScore <= 46) return "Risk Appetite Deterioration";
  if (metrics.breadthHealthScore <= 40 && metrics.momentumPersistenceScore <= 45) return "Breadth Deterioration";
  if (sector.aiMomentumScore <= 42 && sector.growthLeadershipScore <= 48) return "AI Narrative Weakening";
  if (sector.defensiveLeadershipScore >= 62 && sector.growthLeadershipScore <= 50) return "Defensive Rotation";
  if (sector.rotationScore >= 70) return "Sector Rotation";
  if (metrics.momentumPersistenceScore >= 62 && (averageFragility >= 62 || metrics.volatilityPressure >= 62 || transitionRiskScore >= 64)) return "Fragile Momentum";
  if (metrics.riskAppetiteScore >= 66 && metrics.breadthHealthScore >= 58 && metrics.volatilityPressure <= 56 && metrics.liquidityPressure <= 58) return "Risk-On Expansion";
  return "Mixed Transition";
}

function transitionRiskFor(
  rows: OpportunityViewModel[],
  workflow: WorkflowEvolutionSummary | null,
  metrics: RegimeMetrics,
  sector: SectorLeadershipState,
): number {
  const deteriorationPressure = (workflow?.deterioratingSetups.length ?? 0) * 4.5;
  const transitionScore = weightedAverage([
    [metrics.volatilityPressure, 0.22],
    [metrics.liquidityPressure, 0.19],
    [100 - metrics.riskAppetiteScore, 0.18],
    [100 - metrics.breadthHealthScore, 0.16],
    [sector.rotationScore, 0.11],
    [average(rows.map((row) => row.fragility), 50), 0.14],
  ], 50);
  return Math.round(clamp(transitionScore + deteriorationPressure));
}

function driftScoreFor(
  rows: OpportunityViewModel[],
  workflow: WorkflowEvolutionSummary | null,
  metrics: RegimeMetrics,
  transitionRiskScore: number,
): number {
  const scoreChange = averageKnown(rows.map((row) => numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change)));
  const workflowImprovement = (workflow?.improvingSetups.length ?? 0) * 4 + (workflow?.triggerMonitors.length ?? 0) * 2;
  const workflowDeterioration = (workflow?.deterioratingSetups.length ?? 0) * 5;
  const scoreDelta = scoreChange === null ? 0 : scoreChange * 4;
  const breadthPressure = (metrics.breadthHealthScore - 50) * 0.20;
  const riskPressure = (metrics.riskAppetiteScore - 50) * 0.18 - Math.max(0, transitionRiskScore - 60) * 0.22;
  return Math.round(clamp(50 + scoreDelta + workflowImprovement - workflowDeterioration + breadthPressure + riskPressure));
}

function driftDirectionFor(driftScore: number, transitionRiskScore: number): RegimeDriftDirection {
  if (transitionRiskScore >= 72) return "unstable_transition";
  if (driftScore >= 58) return "improving";
  if (driftScore <= 42) return "deteriorating";
  return "stable";
}

function alertsFor(metrics: RegimeMetrics, sector: SectorLeadershipState, transitionRiskScore: number): RegimeShiftAlert[] {
  const alerts: RegimeShiftAlert[] = [];
  if (metrics.volatilityPressure >= 68) alerts.push(alert("Volatility expansion pressure", "Volatility pressure is elevated enough to make continuation less durable.", metrics.volatilityPressure, metrics.volatilityPressure >= 80 ? "critical" : "warning", ["VOLATILITY_EXPANSION"]));
  if (metrics.liquidityPressure >= 68) alerts.push(alert("Liquidity deterioration", "Liquidity pressure is elevated; broad setups may need stronger confirmation.", metrics.liquidityPressure, metrics.liquidityPressure >= 80 ? "critical" : "warning", ["LIQUIDITY_TIGHTENING"]));
  if (metrics.breadthHealthScore <= 44) alerts.push(alert("Breadth deterioration", "Constructive participation is limited across the current scan universe.", 100 - metrics.breadthHealthScore, "warning", ["BREADTH_DETERIORATION"]));
  if (metrics.riskAppetiteScore <= 42) alerts.push(alert("Risk appetite weakening", "Risk appetite is not broadly confirming aggressive exposure.", 100 - metrics.riskAppetiteScore, "warning", ["RISK_APPETITE_WEAKENING"]));
  if (sector.rotationScore >= 68) alerts.push(alert("Sector leadership rotation", "Sector leadership appears to be rotating; compare defensive groups with growth leadership before elevating setups.", sector.rotationScore, "warning", ["SECTOR_ROTATION"]));
  if (sector.aiMomentumScore <= 42) alerts.push(alert("AI / growth narrative weakening", "AI or growth-linked leadership is weakening relative to the current universe.", 100 - sector.aiMomentumScore, "warning", ["AI_NARRATIVE_WEAKENING"]));
  if (transitionRiskScore >= 70) alerts.push(alert("Regime transition risk", "Multiple pressure signals point to an unstable market-state transition.", transitionRiskScore, transitionRiskScore >= 82 ? "critical" : "warning", ["REGIME_TRANSITION_RISK"]));
  if (metrics.momentumPersistenceScore <= 38) alerts.push(alert("Momentum persistence weakening", "Momentum breadth is weak enough to reduce follow-through quality.", 100 - metrics.momentumPersistenceScore, "warning", ["MOMENTUM_COLLAPSE"]));
  if (alerts.length) return alerts.sort((left, right) => right.score - left.score).slice(0, 6);
  return [alert("No major regime-shift alert", "Current market-state pressure is mixed or contained. Continue monitoring breadth, volatility, and liquidity changes.", 50, "info", ["REGIME_MONITORING"])];
}

function componentsFor(metrics: RegimeMetrics, sector: SectorLeadershipState): RegimeShiftComponent[] {
  return [
    component("risk_appetite", "Risk Appetite", metrics.riskAppetiteScore, false, labelFor(metrics.riskAppetiteScore, "Supportive", "Mixed", "Weak"), "Measures whether the latest tape is rewarding risk assets."),
    component("volatility_pressure", "Volatility Pressure", metrics.volatilityPressure, true, pressureLabel(metrics.volatilityPressure), "Elevated volatility pressure increases regime instability and follow-through risk."),
    component("liquidity_state", "Liquidity State", metrics.liquidityPressure, true, pressureLabel(metrics.liquidityPressure), "Liquidity pressure estimates whether the backdrop is supportive or tightening."),
    component("breadth_health", "Breadth Health", metrics.breadthHealthScore, false, labelFor(metrics.breadthHealthScore, "Broad", "Mixed", "Narrow"), "Breadth health estimates whether opportunity participation is broad enough to trust."),
    component("exchange_health", "Exchange Health", metrics.exchangeHealthScore, false, labelFor(metrics.exchangeHealthScore, "Supportive", "Mixed", "Weak"), "Exchange health checks whether the listing environment supports symbol-level setups."),
    component("momentum_persistence", "Momentum Breadth", metrics.momentumPersistenceScore, false, labelFor(metrics.momentumPersistenceScore, "Persistent", "Mixed", "Fading"), "Momentum persistence tracks whether setup quality and returns are broadly improving."),
    component("sector_leadership", "Sector Rotation", sector.rotationScore, true, pressureLabel(sector.rotationScore), sector.detail),
  ];
}

function driftTimelineFor(
  metrics: RegimeMetrics,
  sector: SectorLeadershipState,
  driftDirection: RegimeDriftDirection,
  workflow: WorkflowEvolutionSummary | null,
): RegimeDriftTimelineItem[] {
  const items: RegimeDriftTimelineItem[] = [
    timelineItem("Risk appetite", metrics.riskAppetiteScore, directionFromScore(metrics.riskAppetiteScore), `${metrics.riskAppetiteScore}/100`, "Risk appetite is derived from macro proxies, exchange health, and current universe participation."),
    timelineItem("Volatility pressure", metrics.volatilityPressure, inverseDirectionFromPressure(metrics.volatilityPressure), `${metrics.volatilityPressure}/100`, "Volatility pressure tracks range expansion and fragility pressure."),
    timelineItem("Liquidity pressure", metrics.liquidityPressure, inverseDirectionFromPressure(metrics.liquidityPressure), `${metrics.liquidityPressure}/100`, "Liquidity pressure tracks whether the backdrop is becoming less supportive."),
    timelineItem("Breadth health", metrics.breadthHealthScore, directionFromScore(metrics.breadthHealthScore), `${metrics.breadthHealthScore}/100`, "Breadth health tracks how many scanner rows remain constructive instead of isolated."),
    timelineItem("Sector leadership", sector.rotationScore, inverseDirectionFromPressure(sector.rotationScore), `${sector.rotationScore}/100 rotation`, sector.detail),
    timelineItem("Market-state drift", metrics.momentumPersistenceScore, driftDirection, `${metrics.momentumPersistenceScore}/100 momentum`, "Market-state drift combines latest momentum, workflow changes, and pressure signals."),
  ];
  if (workflow?.lastSeenAt) {
    items.push(timelineItem("User revisit baseline", 50, "stable", "recorded", `Workflow comparison uses the last recorded visit at ${workflow.lastSeenAt}.`));
  }
  return items;
}

function monitorListFor(metrics: RegimeMetrics, sector: SectorLeadershipState, transitionRiskScore: number): string[] {
  const items: string[] = [];
  if (metrics.volatilityPressure >= 60) items.push("Watch whether volatility pressure expands further or begins to compress.");
  if (metrics.liquidityPressure >= 60) items.push("Monitor liquidity proxies and rate-sensitive pressure before treating continuation as durable.");
  if (metrics.breadthHealthScore <= 50) items.push("Watch for broader participation, not only isolated leadership.");
  if (metrics.riskAppetiteScore <= 50) items.push("Monitor whether risk appetite recovers across QQQ/SPY-style proxies and high-beta leadership.");
  if (sector.rotationScore >= 60) items.push("Compare defensive leadership with growth and AI-linked leadership for rotation confirmation.");
  if (transitionRiskScore >= 64) items.push("Treat regime transition warnings as context that can reduce timing quality.");
  if (!items.length) items.push("Continue monitoring breadth, volatility, liquidity, and sector leadership for early drift.");
  return items.slice(0, 5);
}

function stateExplanationFor(state: RealTimeMarketState, metrics: RegimeMetrics, sector: SectorLeadershipState, transitionRiskScore: number): string {
  return `${state} is selected from deterministic pressure scores: risk appetite ${metrics.riskAppetiteScore}/100, breadth ${metrics.breadthHealthScore}/100, volatility ${metrics.volatilityPressure}/100, liquidity ${metrics.liquidityPressure}/100, sector rotation ${sector.rotationScore}/100, and transition risk ${transitionRiskScore}/100.`;
}

function alert(title: string, detail: string, score: number, severity: RegimeAlertSeverity, reasonCodes: string[]): RegimeShiftAlert {
  return { detail, reasonCodes, score: Math.round(clamp(score)), severity, title };
}

function component(key: RegimeShiftComponentKey, label: string, score: number, inverse: boolean, state: string, detail: string): RegimeShiftComponent {
  return { detail, inverse, key, label, score: Math.round(clamp(score)), state };
}

function timelineItem(label: string, score: number, direction: RegimeDriftDirection, metricLabel: string, detail: string): RegimeDriftTimelineItem {
  return { detail, direction, label, metricLabel, score: Math.round(clamp(score)) };
}

function directionFromScore(score: number): RegimeDriftDirection {
  if (score >= 62) return "improving";
  if (score <= 42) return "deteriorating";
  return "stable";
}

function inverseDirectionFromPressure(score: number): RegimeDriftDirection {
  if (score >= 68) return "deteriorating";
  if (score <= 42) return "improving";
  return "stable";
}

function labelFor(score: number, high: string, mid: string, low: string): string {
  if (score >= 65) return high;
  if (score <= 42) return low;
  return mid;
}

function pressureLabel(score: number): string {
  if (score >= 70) return "Elevated";
  if (score <= 42) return "Contained";
  return "Mixed";
}

function normalizedSector(row: OpportunityViewModel): string {
  const sector = cleanText(row.sector ?? row.raw.sector ?? row.assetType, "Unknown").trim();
  return sector ? sector.replace(/_/g, " ") : "Unknown";
}

function isDefensiveExposure(row: OpportunityViewModel): boolean {
  return /health|utility|utilities|staples|consumer defensive|gold|bond|treasury|defensive|gld|tlt|ief/i.test(`${row.sector ?? ""} ${row.assetType ?? ""} ${row.symbol}`);
}

function isGrowthExposure(row: OpportunityViewModel): boolean {
  return /technology|software|semiconductor|communication|consumer cyclical|consumer discretionary|crypto|internet|cloud|ai|nvda|amd|mu|tsm|asml|avgo|crwd|ddog|qqq|ibit|btc/i.test(`${row.sector ?? ""} ${row.assetType ?? ""} ${row.symbol}`);
}

function isAiExposure(row: OpportunityViewModel): boolean {
  return /semiconductor|software|technology|ai|cloud|nvda|amd|mu|tsm|asml|avgo|crwd|ddog/i.test(`${row.sector ?? ""} ${row.assetType ?? ""} ${row.symbol}`);
}

function groupScore(rows: OpportunityViewModel[], predicate: (row: OpportunityViewModel) => boolean, fallback: number): number {
  const matched = rows.filter(predicate);
  if (!matched.length) return fallback;
  return average(matched.map((row) => scoreValue(row.raw.sector_alignment_score ?? row.raw.macro_alignment_score ?? row.final_score, row.conviction)), fallback);
}

function narrativeWeakeningScore(row: OpportunityViewModel): number {
  const drift = row.narrative?.narrativeDrift;
  if (!drift) return row.fragility >= 65 ? 58 : 45;
  if (drift.label === "deteriorating" || drift.label === "transitioning") return 75;
  if (drift.label === "strengthening") return 25;
  return 50;
}

function returnHeat(row: OpportunityViewModel): number {
  const oneDay = Math.abs(percentReturn(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0);
  const fiveDay = Math.abs(percentReturn(row.raw.return_5d) ?? oneDay);
  return clamp(oneDay * 7 + fiveDay * 3);
}

function ratio(rows: OpportunityViewModel[], predicate: (row: OpportunityViewModel) => boolean): number {
  if (!rows.length) return 0;
  return rows.filter(predicate).length / rows.length;
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = numberField(value);
  return parsed === null ? clamp(fallback) : clamp(parsed);
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

function averageKnown(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
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
