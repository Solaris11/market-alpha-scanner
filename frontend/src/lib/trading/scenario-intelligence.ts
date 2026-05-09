import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { OpportunityViewModel } from "./opportunity-view-model";

export type ScenarioCategory = "event" | "liquidity" | "macro" | "regime" | "sector" | "volatility";
export type ScenarioSeverity = "moderate" | "severe" | "stress";
export type ScenarioState = "fragile" | "high_vulnerability" | "resilient" | "watch";
export type ScenarioTone = "info" | "positive" | "warning";

export type ScenarioDefinition = {
  category: ScenarioCategory;
  description: string;
  eventRiskDelta: number;
  key: ScenarioKey;
  label: string;
  liquidityDelta: number;
  macroDelta: number;
  sectorTilt: "broad_risk_off" | "defensive" | "energy_positive" | "growth_negative" | "none";
  severity: ScenarioSeverity;
  volatilityDelta: number;
};

export type ScenarioKey =
  | "ai_narrative_weakening"
  | "cpi_hotter_than_expected"
  | "defensive_rotation"
  | "earnings_miss"
  | "fed_hawkish_shift"
  | "oil_breakout"
  | "qqq_down_3"
  | "spy_risk_off"
  | "vix_spike"
  | "yields_surge";

export type ScenarioImpact = {
  continuationPressureScore: number;
  downsideVulnerabilityScore: number;
  keyDrivers: string[];
  resilienceScore: number;
  riskExplanation: string;
  scenario: ScenarioDefinition;
  state: ScenarioState;
  stressedConvictionScore: number;
  stressedFragilityScore: number;
};

export type SymbolScenarioProfile = {
  averageResilienceScore: number;
  highestRiskScenario: ScenarioImpact;
  impactSummary: string;
  impacts: ScenarioImpact[];
  macroVulnerabilityScore: number;
  mostResilientScenario: ScenarioImpact;
  row: OpportunityViewModel;
  setupResilienceLabel: string;
  shockSurvivabilityScore: number;
  symbol: string;
  worstCaseVulnerabilityScore: number;
};

export type ScenarioSummary = {
  averageResilienceScore: number;
  averageVulnerabilityScore: number;
  impactedSymbols: string[];
  scenario: ScenarioDefinition;
  summary: string;
  tone: ScenarioTone;
};

export type ScenarioInsight = {
  detail: string;
  evidenceLabel: string;
  scenarioKey: ScenarioKey;
  title: string;
  tone: ScenarioTone;
};

export type ScenarioIntelligenceSystem = {
  generatedAt: string;
  limitations: string[];
  mostResilient: SymbolScenarioProfile[];
  mostVulnerable: SymbolScenarioProfile[];
  portfolioStressScore: number;
  scenarioSummaries: ScenarioSummary[];
  scenarios: ScenarioDefinition[];
  symbolProfiles: SymbolScenarioProfile[];
  terminalInsights: ScenarioInsight[];
};

export type ScenarioIntelligenceInput = {
  generatedAt?: string;
  rows: OpportunityViewModel[];
  scenarios?: ScenarioDefinition[];
};

type ScenarioInputScores = {
  assetType: string;
  betaSensitivity: number;
  conviction: number;
  earningsSensitivity: number;
  eventRisk: number;
  exchangeHealth: number;
  fragility: number;
  liquidityPressure: number;
  macroAlignment: number;
  sector: string;
  sectorAlignment: number;
  shockDownsideRisk: number;
  shockOpportunity: number;
  volatilityPressure: number;
};

const DEFAULT_SCENARIOS: ScenarioDefinition[] = [
  {
    category: "macro",
    description: "Nasdaq-led risk assets weaken sharply. Growth and high-beta setups receive heavier stress.",
    eventRiskDelta: 4,
    key: "qqq_down_3",
    label: "QQQ -3% risk shock",
    liquidityDelta: 8,
    macroDelta: -12,
    sectorTilt: "growth_negative",
    severity: "severe",
    volatilityDelta: 16,
  },
  {
    category: "regime",
    description: "Broad SPY risk-off session with weaker exchange health and lower risk appetite.",
    eventRiskDelta: 3,
    key: "spy_risk_off",
    label: "SPY risk-off tape",
    liquidityDelta: 10,
    macroDelta: -10,
    sectorTilt: "broad_risk_off",
    severity: "severe",
    volatilityDelta: 12,
  },
  {
    category: "volatility",
    description: "Volatility expands quickly. Extended, high-fragility, and shock-prone setups are penalized.",
    eventRiskDelta: 2,
    key: "vix_spike",
    label: "VIX spike",
    liquidityDelta: 8,
    macroDelta: -7,
    sectorTilt: "broad_risk_off",
    severity: "stress",
    volatilityDelta: 24,
  },
  {
    category: "liquidity",
    description: "Rates/yields surge and pressure long-duration growth setups.",
    eventRiskDelta: 5,
    key: "yields_surge",
    label: "Yields surge",
    liquidityDelta: 14,
    macroDelta: -9,
    sectorTilt: "growth_negative",
    severity: "severe",
    volatilityDelta: 10,
  },
  {
    category: "sector",
    description: "Oil breaks out. Energy-linked names may receive support while broad inflation pressure rises.",
    eventRiskDelta: 4,
    key: "oil_breakout",
    label: "Oil breakout",
    liquidityDelta: 5,
    macroDelta: -4,
    sectorTilt: "energy_positive",
    severity: "moderate",
    volatilityDelta: 8,
  },
  {
    category: "sector",
    description: "AI leadership weakens. Semiconductor, software, and high-growth narrative setups are stressed.",
    eventRiskDelta: 5,
    key: "ai_narrative_weakening",
    label: "AI narrative weakening",
    liquidityDelta: 5,
    macroDelta: -6,
    sectorTilt: "growth_negative",
    severity: "severe",
    volatilityDelta: 12,
  },
  {
    category: "macro",
    description: "Fed communication turns hawkish. Liquidity support weakens and risk appetite compresses.",
    eventRiskDelta: 7,
    key: "fed_hawkish_shift",
    label: "Fed hawkish shift",
    liquidityDelta: 16,
    macroDelta: -11,
    sectorTilt: "growth_negative",
    severity: "stress",
    volatilityDelta: 14,
  },
  {
    category: "macro",
    description: "Inflation comes in hotter than expected. Volatility and liquidity pressure rise together.",
    eventRiskDelta: 8,
    key: "cpi_hotter_than_expected",
    label: "Hot CPI surprise",
    liquidityDelta: 15,
    macroDelta: -12,
    sectorTilt: "growth_negative",
    severity: "stress",
    volatilityDelta: 16,
  },
  {
    category: "event",
    description: "Earnings or guidance disappoints. Event-sensitive setups receive direct fragility stress.",
    eventRiskDelta: 22,
    key: "earnings_miss",
    label: "Earnings miss",
    liquidityDelta: 4,
    macroDelta: -4,
    sectorTilt: "none",
    severity: "stress",
    volatilityDelta: 18,
  },
  {
    category: "regime",
    description: "Market rotates toward defensive exposure. High-beta continuation setups lose relative support.",
    eventRiskDelta: 2,
    key: "defensive_rotation",
    label: "Defensive rotation",
    liquidityDelta: 7,
    macroDelta: -8,
    sectorTilt: "defensive",
    severity: "moderate",
    volatilityDelta: 9,
  },
];

export function buildScenarioIntelligenceSystem(input: ScenarioIntelligenceInput): ScenarioIntelligenceSystem {
  const scenarios = input.scenarios ?? DEFAULT_SCENARIOS;
  const symbolProfiles = input.rows
    .map((row) => buildSymbolScenarioProfile(row, scenarios))
    .sort((left, right) => right.worstCaseVulnerabilityScore - left.worstCaseVulnerabilityScore || left.averageResilienceScore - right.averageResilienceScore);
  const mostVulnerable = symbolProfiles.slice(0, 6);
  const mostResilient = [...symbolProfiles]
    .sort((left, right) => right.averageResilienceScore - left.averageResilienceScore || left.worstCaseVulnerabilityScore - right.worstCaseVulnerabilityScore)
    .slice(0, 6);
  const scenarioSummaries = scenarios.map((scenario) => scenarioSummaryFor(scenario, symbolProfiles));
  const portfolioStressScore = Math.round(clamp(average(symbolProfiles.map((profile) => profile.worstCaseVulnerabilityScore), 50)));
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    limitations: [
      "Scenario Intelligence is a stress framework, not an exact price forecast.",
      "Scenario outputs are deterministic estimates from current scanner, macro, fragility, event, and shock context.",
      "LLM summaries, when added, must explain these structured outputs and must not invent probabilities or scenarios.",
    ],
    mostResilient,
    mostVulnerable,
    portfolioStressScore,
    scenarioSummaries,
    scenarios,
    symbolProfiles,
    terminalInsights: terminalInsightsFor(scenarioSummaries, mostVulnerable, mostResilient),
  };
}

export function scenarioStateLabel(state: ScenarioState): string {
  if (state === "high_vulnerability") return "High Vulnerability";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function buildSymbolScenarioProfile(row: OpportunityViewModel, scenarios: ScenarioDefinition[]): SymbolScenarioProfile {
  const scores = inputScores(row);
  const impacts = scenarios.map((scenario) => scenarioImpactFor(row, scores, scenario)).sort((left, right) => right.downsideVulnerabilityScore - left.downsideVulnerabilityScore);
  const highestRiskScenario = impacts[0];
  const mostResilientScenario = [...impacts].sort((left, right) => right.resilienceScore - left.resilienceScore)[0] ?? highestRiskScenario;
  const averageResilienceScore = Math.round(average(impacts.map((impact) => impact.resilienceScore), 50));
  const worstCaseVulnerabilityScore = Math.round(Math.max(0, ...impacts.map((impact) => impact.downsideVulnerabilityScore)));
  const macroVulnerabilityScore = Math.round(average(impacts.filter((impact) => impact.scenario.category === "macro" || impact.scenario.category === "regime").map((impact) => impact.downsideVulnerabilityScore), worstCaseVulnerabilityScore));
  const shockSurvivabilityScore = Math.round(clamp(100 - average(impacts.filter((impact) => impact.scenario.category === "volatility" || impact.scenario.category === "event").map((impact) => impact.downsideVulnerabilityScore), worstCaseVulnerabilityScore) + scores.shockOpportunity * 0.12));
  return {
    averageResilienceScore,
    highestRiskScenario,
    impactSummary: impactSummary(row, highestRiskScenario, averageResilienceScore),
    impacts,
    macroVulnerabilityScore,
    mostResilientScenario,
    row,
    setupResilienceLabel: resilienceLabel(averageResilienceScore, worstCaseVulnerabilityScore),
    shockSurvivabilityScore,
    symbol: row.symbol,
    worstCaseVulnerabilityScore,
  };
}

function scenarioImpactFor(row: OpportunityViewModel, scores: ScenarioInputScores, scenario: ScenarioDefinition): ScenarioImpact {
  const sectorStress = sectorStressFor(scores, scenario);
  const betaStress = scores.betaSensitivity * severityMultiplier(scenario) * 0.24;
  const macroStress = Math.max(0, -scenario.macroDelta) * ((100 - scores.macroAlignment) / 100) * 1.6;
  const volatilityStress = scenario.volatilityDelta * (0.45 + scores.volatilityPressure / 180 + scores.fragility / 220);
  const liquidityStress = scenario.liquidityDelta * (0.55 + scores.liquidityPressure / 190);
  const eventStress = scenario.eventRiskDelta * (0.45 + scores.earningsSensitivity / 170 + scores.eventRisk / 230);
  const shockStress = scores.shockDownsideRisk * (scenario.category === "event" || scenario.category === "volatility" ? 0.16 : 0.08);
  const supportOffset = supportOffsetFor(scores, scenario);
  const stress = clamp(sectorStress + betaStress + macroStress + volatilityStress + liquidityStress + eventStress + shockStress - supportOffset, 0, 100);
  const stressedFragilityScore = Math.round(clamp(scores.fragility + stress * 0.55 + scenario.volatilityDelta * 0.16));
  const convictionLoss = stress * 0.42 + Math.max(0, -scenario.macroDelta) * 0.55 + sectorStress * 0.20;
  const stressedConvictionScore = Math.round(clamp(scores.conviction - convictionLoss + supportOffset * 0.35));
  const downsideVulnerabilityScore = Math.round(clamp(stress * 0.74 + stressedFragilityScore * 0.20 + scores.shockDownsideRisk * 0.12));
  const continuationPressureScore = Math.round(clamp(100 - stressedConvictionScore + downsideVulnerabilityScore * 0.34));
  const resilienceScore = Math.round(clamp(100 - downsideVulnerabilityScore + scores.exchangeHealth * 0.08 + scores.sectorAlignment * 0.08));
  const state = stateFor(resilienceScore, downsideVulnerabilityScore);

  return {
    continuationPressureScore,
    downsideVulnerabilityScore,
    keyDrivers: keyDriversFor(scores, scenario, row),
    resilienceScore,
    riskExplanation: riskExplanationFor(row, scenario, state),
    scenario,
    state,
    stressedConvictionScore,
    stressedFragilityScore,
  };
}

function inputScores(row: OpportunityViewModel): ScenarioInputScores {
  const raw = row.raw;
  const sector = cleanText(row.sector ?? raw.sector, "Unknown");
  const assetType = cleanText(row.assetType ?? raw.asset_type, "Unknown");
  const return1d = Math.abs(percentValue(raw.return_1d ?? raw.price_change_pct) ?? 0);
  return {
    assetType,
    betaSensitivity: betaSensitivityFor(sector, assetType, row.symbol, return1d),
    conviction: row.conviction,
    earningsSensitivity: eventMentions(row, ["earnings", "guidance", "eps", "revenue"]) ? 82 : row.eventRisk,
    eventRisk: scoreValue(raw.event_risk_score ?? raw.verified_event_pressure_score) ?? row.eventRisk,
    exchangeHealth: scoreValue(raw.exchange_health_score) ?? scoreFromLabel(row.macroLabel, 55),
    fragility: row.fragility,
    liquidityPressure: scoreValue(raw.liquidity_pressure) ?? 50,
    macroAlignment: scoreValue(raw.macro_alignment_score ?? raw.macro_score) ?? scoreFromLabel(row.macroLabel, 55),
    sector,
    sectorAlignment: scoreValue(raw.sector_alignment_score) ?? 55,
    shockDownsideRisk: row.shockPattern?.downsideRiskScore ?? 50,
    shockOpportunity: row.shockPattern?.opportunityScore ?? 50,
    volatilityPressure: scoreValue(raw.volatility_pressure) ?? row.fragility,
  };
}

function sectorStressFor(scores: ScenarioInputScores, scenario: ScenarioDefinition): number {
  const sector = scores.sector.toLowerCase();
  const symbolText = `${scores.assetType} ${sector}`.toLowerCase();
  const isGrowth = /(semiconductor|software|technology|internet|ai|crypto|growth|communication)/i.test(symbolText);
  const isEnergy = /(energy|oil|gas|commodity)/i.test(symbolText);
  const isDefensive = /(utility|utilities|staples|health|healthcare|gold|bond|treasury|defensive)/i.test(symbolText);
  if (scenario.sectorTilt === "growth_negative" && isGrowth) return 18;
  if (scenario.sectorTilt === "broad_risk_off" && isGrowth) return 12;
  if (scenario.sectorTilt === "energy_positive" && isEnergy) return -14;
  if (scenario.sectorTilt === "energy_positive" && isGrowth) return 5;
  if (scenario.sectorTilt === "defensive" && isDefensive) return -10;
  if (scenario.sectorTilt === "defensive" && isGrowth) return 10;
  return scenario.sectorTilt === "broad_risk_off" ? 7 : 0;
}

function supportOffsetFor(scores: ScenarioInputScores, scenario: ScenarioDefinition): number {
  const sector = scores.sector.toLowerCase();
  const isEnergy = /(energy|oil|gas|commodity)/i.test(sector);
  const isDefensive = /(utility|utilities|staples|health|healthcare|gold|bond|treasury|defensive)/i.test(`${scores.assetType} ${sector}`);
  let support = 0;
  if (scenario.sectorTilt === "energy_positive" && isEnergy) support += 20;
  if (scenario.sectorTilt === "defensive" && isDefensive) support += 16;
  if (scores.macroAlignment >= 72) support += 6;
  if (scores.fragility <= 42) support += 6;
  return support;
}

function keyDriversFor(scores: ScenarioInputScores, scenario: ScenarioDefinition, row: OpportunityViewModel): string[] {
  const drivers: string[] = [];
  if (scenario.volatilityDelta >= 14) drivers.push("volatility expansion stress");
  if (scenario.liquidityDelta >= 12) drivers.push("liquidity pressure");
  if (scenario.macroDelta <= -10) drivers.push("macro alignment shock");
  if (scenario.category === "event") drivers.push("event sensitivity");
  if (sectorStressFor(scores, scenario) > 8) drivers.push(`${cleanText(row.sector, "sector")} exposure`);
  if (scores.fragility >= 68) drivers.push("elevated existing fragility");
  if (scores.shockDownsideRisk >= 68) drivers.push("historical downside shock risk");
  if (!drivers.length) drivers.push("bounded stress estimate from current scanner context");
  return drivers.slice(0, 4);
}

function riskExplanationFor(row: OpportunityViewModel, scenario: ScenarioDefinition, state: ScenarioState): string {
  if (state === "resilient") {
    return `${row.symbol} appears comparatively resilient under ${scenario.label}, but this is a stress estimate rather than a forecast.`;
  }
  if (state === "high_vulnerability") {
    return `${row.symbol} is highly vulnerable under ${scenario.label}; continuation quality would likely require confirmation before risk exposure is considered.`;
  }
  if (state === "fragile") {
    return `${row.symbol} becomes fragile under ${scenario.label}; volatility, liquidity, or event pressure can weaken the setup.`;
  }
  return `${row.symbol} should be watched under ${scenario.label}; the setup is not broken by the scenario, but resilience is mixed.`;
}

function impactSummary(row: OpportunityViewModel, highestRisk: ScenarioImpact, averageResilienceScore: number): string {
  return `${row.symbol} scenario resilience is ${averageResilienceScore}/100. Highest modeled vulnerability is ${highestRisk.scenario.label}, driven by ${highestRisk.keyDrivers.join(", ")}.`;
}

function scenarioSummaryFor(scenario: ScenarioDefinition, profiles: SymbolScenarioProfile[]): ScenarioSummary {
  const impacts = profiles.map((profile) => profile.impacts.find((impact) => impact.scenario.key === scenario.key)).filter((impact): impact is ScenarioImpact => Boolean(impact));
  const averageResilienceScore = Math.round(average(impacts.map((impact) => impact.resilienceScore), 50));
  const averageVulnerabilityScore = Math.round(average(impacts.map((impact) => impact.downsideVulnerabilityScore), 50));
  const impactedSymbols = impacts
    .filter((impact) => impact.downsideVulnerabilityScore >= 66)
    .sort((left, right) => right.downsideVulnerabilityScore - left.downsideVulnerabilityScore)
    .slice(0, 5)
    .map((impact) => profiles.find((profile) => profile.impacts.includes(impact))?.symbol ?? "UNKNOWN")
    .filter((symbol) => symbol !== "UNKNOWN");
  const tone: ScenarioTone = averageVulnerabilityScore >= 68 ? "warning" : averageResilienceScore >= 62 ? "positive" : "info";
  return {
    averageResilienceScore,
    averageVulnerabilityScore,
    impactedSymbols,
    scenario,
    summary: `${scenario.label} produces ${averageVulnerabilityScore}/100 average vulnerability across the current opportunity set.`,
    tone,
  };
}

function terminalInsightsFor(summaries: ScenarioSummary[], vulnerable: SymbolScenarioProfile[], resilient: SymbolScenarioProfile[]): ScenarioInsight[] {
  const insights: ScenarioInsight[] = [];
  const highestScenario = [...summaries].sort((left, right) => right.averageVulnerabilityScore - left.averageVulnerabilityScore)[0];
  if (highestScenario) {
    insights.push({
      detail: highestScenario.summary,
      evidenceLabel: `${highestScenario.averageVulnerabilityScore}/100 average vulnerability`,
      scenarioKey: highestScenario.scenario.key,
      title: "Dominant stress scenario",
      tone: highestScenario.tone,
    });
  }
  const mostVulnerable = vulnerable[0];
  if (mostVulnerable) {
    insights.push({
      detail: mostVulnerable.impactSummary,
      evidenceLabel: `${mostVulnerable.worstCaseVulnerabilityScore}/100 worst-case vulnerability`,
      scenarioKey: mostVulnerable.highestRiskScenario.scenario.key,
      title: `${mostVulnerable.symbol} stress watch`,
      tone: "warning",
    });
  }
  const mostResilient = resilient[0];
  if (mostResilient) {
    insights.push({
      detail: `${mostResilient.symbol} has the strongest average scenario resilience in the current opportunity set.`,
      evidenceLabel: `${mostResilient.averageResilienceScore}/100 average resilience`,
      scenarioKey: mostResilient.mostResilientScenario.scenario.key,
      title: "Resilience leader",
      tone: "positive",
    });
  }
  return insights.slice(0, 4);
}

function stateFor(resilienceScore: number, vulnerabilityScore: number): ScenarioState {
  if (vulnerabilityScore >= 76) return "high_vulnerability";
  if (vulnerabilityScore >= 62 || resilienceScore < 42) return "fragile";
  if (resilienceScore >= 65 && vulnerabilityScore < 50) return "resilient";
  return "watch";
}

function resilienceLabel(resilienceScore: number, vulnerabilityScore: number): string {
  if (vulnerabilityScore >= 76) return "High scenario vulnerability";
  if (resilienceScore >= 66) return "Scenario resilient";
  if (resilienceScore >= 48) return "Mixed scenario resilience";
  return "Fragile under stress";
}

function severityMultiplier(scenario: ScenarioDefinition): number {
  if (scenario.severity === "stress") return 1.2;
  if (scenario.severity === "severe") return 1;
  return 0.78;
}

function betaSensitivityFor(sector: string, assetType: string, symbol: string, return1d: number): number {
  const text = `${symbol} ${sector} ${assetType}`.toLowerCase();
  let score = 45 + Math.min(18, return1d * 2.2);
  if (/(semiconductor|software|technology|crypto|bitcoin|growth|ai)/i.test(text)) score += 18;
  if (/(spy|dia|staples|utilities|health|gold|treasury|bond)/i.test(text)) score -= 12;
  if (/(uso|oil|energy|oxy)/i.test(text)) score += 4;
  return Math.round(clamp(score));
}

function eventMentions(row: OpportunityViewModel, tokens: string[]): boolean {
  const text = [
    row.eventLabel,
    row.raw.event_context_label,
    row.raw.event_context_summary,
    row.raw.verified_event_signature,
    row.raw.macro_event_regime_signature,
  ].map((value) => cleanText(value, "")).join(" ").toLowerCase();
  return tokens.some((token) => text.includes(token));
}

function scoreFromLabel(label: string, fallback: number): number {
  const text = label.toLowerCase();
  if (text.includes("aligned") || text.includes("tailwind") || text.includes("support")) return 70;
  if (text.includes("conflict") || text.includes("headwind")) return 38;
  return fallback;
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

function average(values: number[], fallback: number): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
