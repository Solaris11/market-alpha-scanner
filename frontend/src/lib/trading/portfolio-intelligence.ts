import type { PaperPositionRow } from "@/lib/paper-data";
import { clamp, cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ScenarioImpact, ScenarioIntelligenceSystem } from "./scenario-intelligence";

export type PortfolioExposureType = "macro" | "sector" | "theme" | "volatility";
export type PortfolioRiskTone = "good" | "neutral" | "risk" | "warn";

export type PortfolioPositionContext = {
  asymmetryScore: number;
  eventRiskScore: number;
  fragilityScore: number;
  macroAlignmentScore: number;
  opportunity: OpportunityViewModel | null;
  position: PaperPositionRow;
  positionValue: number;
  riskAmount: number;
  sector: string;
  symbol: string;
  theme: string;
  volatilityScore: number;
  weightPct: number;
};

export type PortfolioExposureBucket = {
  label: string;
  percent: number;
  riskScore: number;
  symbols: string[];
  tone: PortfolioRiskTone;
  type: PortfolioExposureType;
  value: number;
};

export type PortfolioCorrelationCluster = {
  label: string;
  reason: string;
  score: number;
  symbols: string[];
  tone: PortfolioRiskTone;
  type: "correlation" | "event" | "fragility" | "macro";
};

export type PortfolioScenarioStress = {
  impactedSymbols: string[];
  scenarioKey: string;
  scenarioLabel: string;
  summary: string;
  tone: PortfolioRiskTone;
  weightedResilienceScore: number;
  weightedVulnerabilityScore: number;
};

export type PortfolioHeatmapCell = {
  asymmetryScore: number;
  fragilityScore: number;
  macroAlignmentScore: number;
  scenarioVulnerabilityScore: number;
  sector: string;
  symbol: string;
  theme: string;
  tone: PortfolioRiskTone;
  weightPct: number;
};

export type PortfolioIntelligenceSystem = {
  accountValue: number | null;
  asymmetryScore: number;
  concentrationScore: number;
  correlationClusters: PortfolioCorrelationCluster[];
  diversificationQualityScore: number;
  exposureBuckets: PortfolioExposureBucket[];
  fragilityScore: number;
  generatedAt: string;
  heatmap: PortfolioHeatmapCell[];
  limitations: string[];
  macroAlignmentScore: number;
  openPositionCount: number;
  openRiskAmount: number;
  portfolioQualityLabel: string;
  portfolioQualityScore: number;
  positionContexts: PortfolioPositionContext[];
  scenarioStress: PortfolioScenarioStress[];
  summary: string;
  totalExposureValue: number;
};

export type PortfolioIntelligenceInput = {
  accountValue?: number | null;
  generatedAt?: string;
  opportunities: OpportunityViewModel[];
  positions: PaperPositionRow[];
  scenarioSystem?: ScenarioIntelligenceSystem | null;
};

type ExposureAccumulator = {
  contexts: PortfolioPositionContext[];
  value: number;
};

export function buildPortfolioIntelligenceSystem(input: PortfolioIntelligenceInput): PortfolioIntelligenceSystem {
  const opportunityMap = new Map(input.opportunities.map((row) => [row.symbol.toUpperCase(), row]));
  const openPositions = input.positions.filter((position) => position.status.toUpperCase() === "OPEN");
  const totalExposureValue = openPositions.reduce((total, position) => total + positionValue(position), 0);
  const positionContexts = openPositions
    .map((position) => buildPositionContext(position, opportunityMap.get(position.symbol.toUpperCase()) ?? null, totalExposureValue))
    .sort((left, right) => right.positionValue - left.positionValue || left.symbol.localeCompare(right.symbol));
  const accountValue = positiveNumber(input.accountValue) ?? null;
  const openRiskAmount = positionContexts.reduce((total, context) => total + context.riskAmount, 0);
  const sectorBuckets = exposureBuckets(positionContexts, "sector");
  const themeBuckets = exposureBuckets(positionContexts, "theme");
  const macroBuckets = macroExposureBuckets(positionContexts);
  const volatilityBuckets = volatilityExposureBuckets(positionContexts);
  const concentrationScore = concentrationScoreFor(positionContexts, sectorBuckets);
  const diversificationQualityScore = Math.round(clamp(100 - concentrationScore));
  const fragilityScore = Math.round(weightedAverage(positionContexts, (context) => context.fragilityScore, 0) + Math.min(14, concentrationScore * 0.16));
  const asymmetryScore = Math.round(weightedAverage(positionContexts, (context) => context.asymmetryScore, 50));
  const macroAlignmentScore = Math.round(weightedAverage(positionContexts, (context) => context.macroAlignmentScore, 50));
  const scenarioStress = scenarioStressFor(positionContexts, input.scenarioSystem ?? null);
  const scenarioPenalty = scenarioStress.length ? Math.max(...scenarioStress.map((stress) => stress.weightedVulnerabilityScore)) * 0.14 : 7;
  const portfolioQualityScore = Math.round(clamp(
    diversificationQualityScore * 0.25
    + (100 - fragilityScore) * 0.25
    + asymmetryScore * 0.18
    + macroAlignmentScore * 0.22
    + (100 - scenarioPenalty) * 0.10,
  ));
  const heatmap = portfolioHeatmap(positionContexts, input.scenarioSystem ?? null);
  const correlationClusters = correlationClustersFor(positionContexts, sectorBuckets, themeBuckets, scenarioStress);

  return {
    accountValue,
    asymmetryScore,
    concentrationScore: Math.round(concentrationScore),
    correlationClusters,
    diversificationQualityScore,
    exposureBuckets: [...sectorBuckets, ...themeBuckets, ...macroBuckets, ...volatilityBuckets],
    fragilityScore: Math.round(clamp(fragilityScore)),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    heatmap,
    limitations: [
      "Portfolio Intelligence evaluates paper/open exposure structure; it is not broker execution or financial advice.",
      "Correlation is approximated from sector, theme, macro, fragility, and scenario similarity rather than tick-level covariance.",
      "Scenario stress uses Phase 7.13 deterministic stress outputs and should be read as pressure context, not a price forecast.",
    ],
    macroAlignmentScore,
    openPositionCount: positionContexts.length,
    openRiskAmount,
    portfolioQualityLabel: portfolioQualityLabel(portfolioQualityScore, fragilityScore, concentrationScore),
    portfolioQualityScore,
    positionContexts,
    scenarioStress,
    summary: portfolioSummary(positionContexts, portfolioQualityScore, concentrationScore, fragilityScore, scenarioStress),
    totalExposureValue,
  };
}

function buildPositionContext(position: PaperPositionRow, opportunity: OpportunityViewModel | null, totalExposureValue: number): PortfolioPositionContext {
  const sector = cleanText(opportunity?.sector, "Unknown");
  const positionValueAmount = positionValue(position);
  const riskAmount = positionRisk(position);
  const fragilityScore = score(opportunity?.fragility, 50);
  const asymmetryScore = score(opportunity?.shockPattern?.asymmetryScore ?? opportunity?.shockPattern?.opportunityScore ?? (opportunity ? opportunity.conviction - opportunity.fragility + 50 : null), 50);
  const macroAlignmentScore = macroScore(opportunity);
  const eventRiskScore = score(opportunity?.eventRisk, 35);
  const volatilityScore = score(opportunity?.raw.volatility_pressure ?? opportunity?.shockPattern?.twoSidedVolatilityScore ?? opportunity?.fragility, 45);
  return {
    asymmetryScore,
    eventRiskScore,
    fragilityScore,
    macroAlignmentScore,
    opportunity,
    position,
    positionValue: positionValueAmount,
    riskAmount,
    sector,
    symbol: position.symbol.toUpperCase(),
    theme: themeFor(position.symbol, sector, opportunity?.assetType),
    volatilityScore,
    weightPct: totalExposureValue > 0 ? (positionValueAmount / totalExposureValue) * 100 : 0,
  };
}

function exposureBuckets(contexts: PortfolioPositionContext[], field: "sector" | "theme"): PortfolioExposureBucket[] {
  const total = contexts.reduce((sum, context) => sum + context.positionValue, 0);
  const accumulators = new Map<string, ExposureAccumulator>();
  for (const context of contexts) {
    const label = field === "sector" ? context.sector : context.theme;
    const existing = accumulators.get(label) ?? { contexts: [], value: 0 };
    existing.contexts.push(context);
    existing.value += context.positionValue;
    accumulators.set(label, existing);
  }
  return [...accumulators.entries()]
    .map(([label, accumulator]) => {
      const percent = total > 0 ? (accumulator.value / total) * 100 : 0;
      const fragility = weightedAverage(accumulator.contexts, (context) => context.fragilityScore, 50);
      const riskScore = clamp(percent * 0.72 + fragility * 0.28);
      return {
        label,
        percent: Math.round(percent),
        riskScore: Math.round(riskScore),
        symbols: accumulator.contexts.map((context) => context.symbol),
        tone: riskTone(riskScore),
        type: field,
        value: accumulator.value,
      };
    })
    .sort((left, right) => right.percent - left.percent || left.label.localeCompare(right.label));
}

function macroExposureBuckets(contexts: PortfolioPositionContext[]): PortfolioExposureBucket[] {
  return exposureBucketsFromClassifier(contexts, "macro", (context) => {
    if (context.macroAlignmentScore >= 66) return "Macro Tailwind";
    if (context.macroAlignmentScore <= 42) return "Macro Headwind";
    return "Macro Mixed";
  }, (bucketContexts, percent) => clamp(percent * 0.62 + (100 - weightedAverage(bucketContexts, (context) => context.macroAlignmentScore, 50)) * 0.38));
}

function volatilityExposureBuckets(contexts: PortfolioPositionContext[]): PortfolioExposureBucket[] {
  return exposureBucketsFromClassifier(contexts, "volatility", (context) => {
    if (context.volatilityScore >= 70 || context.fragilityScore >= 72) return "High Volatility / Fragility";
    if (context.volatilityScore <= 38 && context.fragilityScore <= 45) return "Lower Volatility";
    return "Moderate Volatility";
  }, (bucketContexts, percent) => clamp(percent * 0.58 + weightedAverage(bucketContexts, (context) => Math.max(context.volatilityScore, context.fragilityScore), 45) * 0.42));
}

function exposureBucketsFromClassifier(
  contexts: PortfolioPositionContext[],
  type: PortfolioExposureType,
  classify: (context: PortfolioPositionContext) => string,
  risk: (contexts: PortfolioPositionContext[], percent: number) => number,
): PortfolioExposureBucket[] {
  const total = contexts.reduce((sum, context) => sum + context.positionValue, 0);
  const accumulators = new Map<string, ExposureAccumulator>();
  for (const context of contexts) {
    const label = classify(context);
    const existing = accumulators.get(label) ?? { contexts: [], value: 0 };
    existing.contexts.push(context);
    existing.value += context.positionValue;
    accumulators.set(label, existing);
  }
  return [...accumulators.entries()]
    .map(([label, accumulator]) => {
      const percent = total > 0 ? (accumulator.value / total) * 100 : 0;
      const riskScore = risk(accumulator.contexts, percent);
      return {
        label,
        percent: Math.round(percent),
        riskScore: Math.round(riskScore),
        symbols: accumulator.contexts.map((context) => context.symbol),
        tone: riskTone(riskScore),
        type,
        value: accumulator.value,
      };
    })
    .sort((left, right) => right.percent - left.percent || left.label.localeCompare(right.label));
}

function scenarioStressFor(contexts: PortfolioPositionContext[], scenarioSystem: ScenarioIntelligenceSystem | null): PortfolioScenarioStress[] {
  if (!scenarioSystem || !contexts.length) return [];
  return scenarioSystem.scenarios.map((scenario) => {
    const impacts = contexts
      .map((context) => {
        const impact = scenarioImpactFor(context.symbol, scenario.key, scenarioSystem);
        return impact ? { context, impact } : null;
      })
      .filter((item): item is { context: PortfolioPositionContext; impact: ScenarioImpact } => Boolean(item));
    const weightedVulnerabilityScore = Math.round(weightedAverage(impacts.map((item) => ({ value: item.context.positionValue, metric: item.impact.downsideVulnerabilityScore })), 50));
    const weightedResilienceScore = Math.round(weightedAverage(impacts.map((item) => ({ value: item.context.positionValue, metric: item.impact.resilienceScore })), 50));
    const impactedSymbols = impacts
      .filter((item) => item.impact.downsideVulnerabilityScore >= 62)
      .sort((left, right) => right.impact.downsideVulnerabilityScore - left.impact.downsideVulnerabilityScore)
      .slice(0, 4)
      .map((item) => item.context.symbol);
    return {
      impactedSymbols,
      scenarioKey: scenario.key,
      scenarioLabel: scenario.label,
      summary: `${scenario.label} creates ${weightedVulnerabilityScore}/100 weighted vulnerability across current open paper exposure.`,
      tone: riskTone(weightedVulnerabilityScore),
      weightedResilienceScore,
      weightedVulnerabilityScore,
    };
  }).sort((left, right) => right.weightedVulnerabilityScore - left.weightedVulnerabilityScore);
}

function portfolioHeatmap(contexts: PortfolioPositionContext[], scenarioSystem: ScenarioIntelligenceSystem | null): PortfolioHeatmapCell[] {
  return contexts.map((context) => {
    const scenarioVulnerabilityScore = highestScenarioVulnerability(context.symbol, scenarioSystem);
    const combinedRisk = context.fragilityScore * 0.36 + context.weightPct * 0.28 + scenarioVulnerabilityScore * 0.26 + (100 - context.macroAlignmentScore) * 0.10;
    return {
      asymmetryScore: context.asymmetryScore,
      fragilityScore: context.fragilityScore,
      macroAlignmentScore: context.macroAlignmentScore,
      scenarioVulnerabilityScore,
      sector: context.sector,
      symbol: context.symbol,
      theme: context.theme,
      tone: riskTone(combinedRisk),
      weightPct: Math.round(context.weightPct),
    };
  }).sort((left, right) => riskToneRank(right.tone) - riskToneRank(left.tone) || right.weightPct - left.weightPct);
}

function correlationClustersFor(
  contexts: PortfolioPositionContext[],
  sectorBuckets: PortfolioExposureBucket[],
  themeBuckets: PortfolioExposureBucket[],
  scenarioStress: PortfolioScenarioStress[],
): PortfolioCorrelationCluster[] {
  const clusters: PortfolioCorrelationCluster[] = [];
  for (const bucket of [...sectorBuckets, ...themeBuckets]) {
    if (bucket.percent >= 45 && bucket.symbols.length >= 2) {
      clusters.push({
        label: `${bucket.label} concentration`,
        reason: `${bucket.percent}% of open exposure sits in ${bucket.label}, so these positions can amplify each other.`,
        score: bucket.riskScore,
        symbols: bucket.symbols,
        tone: riskTone(bucket.riskScore),
        type: "correlation",
      });
    }
  }
  const fragile = contexts.filter((context) => context.fragilityScore >= 68);
  const fragileWeight = fragile.reduce((sum, context) => sum + context.weightPct, 0);
  if (fragile.length >= 2 || fragileWeight >= 38) {
    clusters.push({
      label: "Correlated fragility",
      reason: `${Math.round(fragileWeight)}% of open exposure has elevated fragility, increasing portfolio-level vulnerability under stress.`,
      score: Math.round(clamp(fragileWeight * 0.72 + weightedAverage(fragile, (context) => context.fragilityScore, 70) * 0.28)),
      symbols: fragile.map((context) => context.symbol),
      tone: "warn",
      type: "fragility",
    });
  }
  const eventSensitive = contexts.filter((context) => context.eventRiskScore >= 68);
  if (eventSensitive.length >= 2) {
    clusters.push({
      label: "Event concentration",
      reason: "Multiple open positions carry elevated event pressure, so single-event surprises can stack risk.",
      score: Math.round(weightedAverage(eventSensitive, (context) => context.eventRiskScore, 70)),
      symbols: eventSensitive.map((context) => context.symbol),
      tone: "warn",
      type: "event",
    });
  }
  const highestStress = scenarioStress[0];
  if (highestStress && highestStress.weightedVulnerabilityScore >= 62 && highestStress.impactedSymbols.length) {
    clusters.push({
      label: highestStress.scenarioLabel,
      reason: highestStress.summary,
      score: highestStress.weightedVulnerabilityScore,
      symbols: highestStress.impactedSymbols,
      tone: highestStress.tone,
      type: "macro",
    });
  }
  return clusters.sort((left, right) => right.score - left.score).slice(0, 6);
}

function concentrationScoreFor(contexts: PortfolioPositionContext[], sectorBuckets: PortfolioExposureBucket[]): number {
  if (!contexts.length) return 0;
  const maxPositionWeight = Math.max(...contexts.map((context) => context.weightPct));
  const maxSectorWeight = sectorBuckets.length ? Math.max(...sectorBuckets.map((bucket) => bucket.percent)) : 0;
  const positionPenalty = Math.max(0, maxPositionWeight - 20) * 1.12;
  const sectorPenalty = Math.max(0, maxSectorWeight - 35) * 0.95;
  const countPenalty = contexts.length <= 2 ? 16 : contexts.length <= 4 ? 7 : 0;
  return clamp(positionPenalty + sectorPenalty + countPenalty);
}

function portfolioSummary(
  contexts: PortfolioPositionContext[],
  qualityScore: number,
  concentrationScore: number,
  fragilityScore: number,
  scenarioStress: PortfolioScenarioStress[],
): string {
  if (!contexts.length) return "No open paper positions are available for portfolio intelligence yet.";
  const dominant = contexts[0];
  const stress = scenarioStress[0];
  const concentrationText = concentrationScore >= 62 ? "concentration is elevated" : concentrationScore >= 38 ? "concentration is moderate" : "concentration is controlled";
  const fragilityText = fragilityScore >= 66 ? "fragility is stacked" : fragilityScore >= 48 ? "fragility is mixed" : "fragility is contained";
  const stressText = stress ? `${stress.scenarioLabel} is the highest modeled scenario pressure` : "scenario stress will improve as current scanner context expands";
  return `Portfolio quality is ${qualityScore}/100; ${concentrationText}, ${fragilityText}, and ${dominant.symbol} is the largest open exposure. ${stressText}.`;
}

function portfolioQualityLabel(qualityScore: number, fragilityScore: number, concentrationScore: number): string {
  if (qualityScore >= 76 && fragilityScore < 52 && concentrationScore < 45) return "Resilient portfolio structure";
  if (qualityScore >= 62) return "Balanced portfolio structure";
  if (fragilityScore >= 70 || concentrationScore >= 68) return "Concentrated fragile exposure";
  return "Portfolio needs stronger diversification";
}

function scenarioImpactFor(symbol: string, scenarioKey: string, scenarioSystem: ScenarioIntelligenceSystem): ScenarioImpact | null {
  const profile = scenarioSystem.symbolProfiles.find((item) => item.symbol === symbol.toUpperCase());
  return profile?.impacts.find((impact) => impact.scenario.key === scenarioKey) ?? null;
}

function highestScenarioVulnerability(symbol: string, scenarioSystem: ScenarioIntelligenceSystem | null): number {
  if (!scenarioSystem) return 50;
  const profile = scenarioSystem.symbolProfiles.find((item) => item.symbol === symbol.toUpperCase());
  return profile?.worstCaseVulnerabilityScore ?? 50;
}

function positionValue(position: PaperPositionRow): number {
  const price = positiveNumber(position.current_price) ?? positiveNumber(position.entry_price) ?? 0;
  const quantity = positiveNumber(position.quantity) ?? 0;
  return price * quantity;
}

function positionRisk(position: PaperPositionRow): number {
  const entry = positiveNumber(position.entry_price);
  const stop = positiveNumber(position.stop_loss);
  const quantity = positiveNumber(position.quantity);
  if (entry === null || stop === null || quantity === null || entry <= stop) return 0;
  return (entry - stop) * quantity;
}

function macroScore(opportunity: OpportunityViewModel | null): number {
  if (!opportunity) return 50;
  const explicit = scoreOrNull(opportunity.raw.macro_alignment_score ?? opportunity.raw.macro_score);
  if (explicit !== null) return explicit;
  const label = opportunity.macroLabel.toLowerCase();
  if (label.includes("aligned") || label.includes("tailwind") || label.includes("support")) return 70;
  if (label.includes("conflict") || label.includes("headwind")) return 38;
  return 55;
}

function themeFor(symbol: string, sector: string, assetType: string | null | undefined): string {
  const text = `${symbol} ${sector} ${assetType ?? ""}`.toLowerCase();
  if (/(semiconductor|software|technology|internet|ai|growth|cloud|cyber)/i.test(text)) return "Growth / AI";
  if (/(gold|gld|miner|treasury|bond|tlt)/i.test(text)) return "Defensive / Hedge";
  if (/(energy|oil|gas|commodity|uso|oxy)/i.test(text)) return "Commodity / Energy";
  if (/(spy|qqq|dia|iwm|index)/i.test(text)) return "Broad Index";
  if (/(crypto|bitcoin|btc|ibit)/i.test(text)) return "Crypto / Risk Asset";
  if (/(utility|staples|health|healthcare|defensive)/i.test(text)) return "Defensive / Quality";
  return "Mixed / Other";
}

function riskTone(scoreValue: number): PortfolioRiskTone {
  if (scoreValue >= 72) return "risk";
  if (scoreValue >= 55) return "warn";
  if (scoreValue <= 34) return "good";
  return "neutral";
}

function riskToneRank(tone: PortfolioRiskTone): number {
  if (tone === "risk") return 4;
  if (tone === "warn") return 3;
  if (tone === "neutral") return 2;
  return 1;
}

function score(value: unknown, fallback: number): number {
  return scoreOrNull(value) ?? fallback;
}

function scoreOrNull(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return clamp(parsed);
}

function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function weightedAverage(contexts: PortfolioPositionContext[], metric: (context: PortfolioPositionContext) => number, fallback: number): number;
function weightedAverage(values: Array<{ metric: number; value: number }>, fallback: number): number;
function weightedAverage(
  contextsOrValues: PortfolioPositionContext[] | Array<{ metric: number; value: number }>,
  metricOrFallback: ((context: PortfolioPositionContext) => number) | number,
  fallback?: number,
): number {
  if (typeof metricOrFallback === "number") {
    const values = contextsOrValues as Array<{ metric: number; value: number }>;
    const totalValue = values.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    if (totalValue <= 0) return metricOrFallback;
    return values.reduce((sum, item) => sum + Math.max(0, item.value) * item.metric, 0) / totalValue;
  }
  const contexts = contextsOrValues as PortfolioPositionContext[];
  const metric = metricOrFallback;
  const defaultValue = fallback ?? 0;
  const totalValue = contexts.reduce((sum, context) => sum + Math.max(0, context.positionValue), 0);
  if (totalValue <= 0) return defaultValue;
  return contexts.reduce((sum, context) => sum + Math.max(0, context.positionValue) * metric(context), 0) / totalValue;
}
