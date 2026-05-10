import type { PaperPositionRow } from "@/lib/paper-data";
import { clamp, cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ScenarioImpact, ScenarioIntelligenceSystem } from "./scenario-intelligence";

export type PortfolioExposureType = "event" | "liquidity" | "macro" | "sector" | "shock" | "theme" | "volatility";
export type PortfolioRiskTone = "good" | "neutral" | "risk" | "warn";

export type PortfolioPositionContext = {
  asymmetryScore: number;
  eventRiskScore: number;
  fragilityScore: number;
  liquidityRiskScore: number;
  macroAlignmentScore: number;
  opportunity: OpportunityViewModel | null;
  position: PaperPositionRow;
  positionValue: number;
  riskAmount: number;
  sector: string;
  shockExposureScore: number;
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
  type: "correlation" | "event" | "fragility" | "liquidity" | "macro" | "shock";
};

export type PortfolioPriceHistoryPoint = {
  close: number;
  date: string;
};

export type PortfolioRollingCorrelationPair = {
  combinedWeightPct: number;
  confidenceScore: number;
  correlation: number;
  covariance: number;
  left: string;
  observationCount: number;
  right: string;
  windowDays: number;
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
  liquidityRiskScore: number;
  macroAlignmentScore: number;
  scenarioVulnerabilityScore: number;
  sector: string;
  shockExposureScore: number;
  symbol: string;
  theme: string;
  tone: PortfolioRiskTone;
  weightPct: number;
};

export type PortfolioHedgeOffsetContext = {
  label: string;
  reason: string;
  score: number;
  symbols: string[];
  tone: PortfolioRiskTone;
};

export type PortfolioIntelligenceSystem = {
  accountValue: number | null;
  asymmetryScore: number;
  concentrationScore: number;
  correlationClusters: PortfolioCorrelationCluster[];
  diversificationQualityScore: number;
  eventConcentrationScore: number;
  exposureBuckets: PortfolioExposureBucket[];
  fragilityScore: number;
  generatedAt: string;
  hedgeOffsetContexts: PortfolioHedgeOffsetContext[];
  heatmap: PortfolioHeatmapCell[];
  hiddenCorrelationWarning: string | null;
  limitations: string[];
  liquidityRiskScore: number;
  macroAlignmentScore: number;
  openPositionCount: number;
  openRiskAmount: number;
  portfolioQualityLabel: string;
  portfolioQualityScore: number;
  positionContexts: PortfolioPositionContext[];
  rollingCorrelationConfidenceScore: number;
  rollingCorrelationPairs: PortfolioRollingCorrelationPair[];
  scenarioVulnerabilityScore: number;
  scenarioStress: PortfolioScenarioStress[];
  shockExposureScore: number;
  stressProofSummary: string[];
  summary: string;
  totalExposureValue: number;
};

export type PortfolioIntelligenceInput = {
  accountValue?: number | null;
  generatedAt?: string;
  opportunities: OpportunityViewModel[];
  priceHistories?: Record<string, PortfolioPriceHistoryPoint[]>;
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
  const eventBuckets = eventExposureBuckets(positionContexts);
  const liquidityBuckets = liquidityExposureBuckets(positionContexts);
  const shockBuckets = shockExposureBuckets(positionContexts);
  const concentrationScore = concentrationScoreFor(positionContexts, sectorBuckets);
  const diversificationQualityScore = Math.round(clamp(100 - concentrationScore));
  const fragilityScore = Math.round(weightedAverage(positionContexts, (context) => context.fragilityScore, 0) + Math.min(14, concentrationScore * 0.16));
  const asymmetryScore = Math.round(weightedAverage(positionContexts, (context) => context.asymmetryScore, 50));
  const macroAlignmentScore = Math.round(weightedAverage(positionContexts, (context) => context.macroAlignmentScore, 50));
  const eventConcentrationScore = Math.round(eventConcentrationScoreFor(positionContexts, eventBuckets));
  const liquidityRiskScore = Math.round(weightedAverage(positionContexts, (context) => context.liquidityRiskScore, 45));
  const shockExposureScore = Math.round(weightedAverage(positionContexts, (context) => context.shockExposureScore, 45));
  const scenarioStress = scenarioStressFor(positionContexts, input.scenarioSystem ?? null);
  const rollingCorrelationPairs = rollingCorrelationPairsFor(positionContexts, input.priceHistories ?? {});
  const rollingCorrelationConfidenceScore = Math.round(correlationConfidenceFor(rollingCorrelationPairs, positionContexts.length));
  const scenarioVulnerabilityScore = scenarioStress.length
    ? Math.round(Math.max(...scenarioStress.map((stress) => stress.weightedVulnerabilityScore)))
    : Math.round(weightedAverage(positionContexts, (context) => highestScenarioVulnerability(context.symbol, input.scenarioSystem ?? null), 50));
  const portfolioQualityScore = Math.round(clamp(
    diversificationQualityScore * 0.21
    + (100 - fragilityScore) * 0.20
    + asymmetryScore * 0.15
    + macroAlignmentScore * 0.18
    + (100 - scenarioVulnerabilityScore) * 0.10
    + (100 - liquidityRiskScore) * 0.08
    + (100 - eventConcentrationScore) * 0.04
    + (100 - shockExposureScore) * 0.04,
  ));
  const heatmap = portfolioHeatmap(positionContexts, input.scenarioSystem ?? null);
  const correlationClusters = correlationClustersFor(positionContexts, sectorBuckets, themeBuckets, scenarioStress, rollingCorrelationPairs);
  const hedgeOffsetContexts = hedgeOffsetContextsFor(positionContexts, scenarioStress);
  const hiddenCorrelationWarning = hiddenCorrelationWarningFor(correlationClusters, positionContexts);
  const stressProofSummary = stressProofSummaryFor(positionContexts, scenarioStress, hedgeOffsetContexts, liquidityRiskScore, shockExposureScore);

  return {
    accountValue,
    asymmetryScore,
    concentrationScore: Math.round(concentrationScore),
    correlationClusters,
    diversificationQualityScore,
    eventConcentrationScore,
    exposureBuckets: [...sectorBuckets, ...themeBuckets, ...macroBuckets, ...volatilityBuckets, ...eventBuckets, ...liquidityBuckets, ...shockBuckets],
    fragilityScore: Math.round(clamp(fragilityScore)),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    hedgeOffsetContexts,
    heatmap,
    hiddenCorrelationWarning,
    limitations: [
      "Portfolio Intelligence evaluates paper/open exposure structure; it is not broker execution or financial advice.",
      rollingCorrelationPairs.length
        ? "Rolling correlation uses available daily close history where supplied; missing symbols fall back to factor and scenario relationships."
        : "Rolling price history was not supplied, so correlation falls back to sector, theme, macro, fragility, and scenario relationships.",
      "Scenario stress uses deterministic stress outputs and should be read as pressure context, not a price forecast.",
      "Manual portfolio inputs, when used, are what-if research inputs and do not place broker or paper orders.",
    ],
    liquidityRiskScore,
    macroAlignmentScore,
    openPositionCount: positionContexts.length,
    openRiskAmount,
    portfolioQualityLabel: portfolioQualityLabel(portfolioQualityScore, fragilityScore, concentrationScore),
    portfolioQualityScore,
    positionContexts,
    rollingCorrelationConfidenceScore,
    rollingCorrelationPairs,
    scenarioVulnerabilityScore,
    scenarioStress,
    shockExposureScore,
    stressProofSummary,
    summary: portfolioSummary(positionContexts, portfolioQualityScore, concentrationScore, fragilityScore, scenarioStress, hiddenCorrelationWarning),
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
  const liquidityRiskScore = score(opportunity?.raw.liquidity_pressure ?? opportunity?.raw.liquidity_pressure_score ?? opportunity?.raw.liquidity_stress, 45);
  const volatilityScore = score(opportunity?.raw.volatility_pressure ?? opportunity?.shockPattern?.twoSidedVolatilityScore ?? opportunity?.fragility, 45);
  const shockExposureScore = score(maxKnown([
    opportunity?.shockPattern?.downsideRiskScore,
    opportunity?.shockPattern?.twoSidedVolatilityScore,
    opportunity?.shockPattern?.upsideShockScore,
  ]), 45);
  return {
    asymmetryScore,
    eventRiskScore,
    fragilityScore,
    liquidityRiskScore,
    macroAlignmentScore,
    opportunity,
    position,
    positionValue: positionValueAmount,
    riskAmount,
    sector,
    shockExposureScore,
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

function eventExposureBuckets(contexts: PortfolioPositionContext[]): PortfolioExposureBucket[] {
  return exposureBucketsFromClassifier(contexts, "event", (context) => {
    if (context.eventRiskScore >= 70) return "Elevated Event Pressure";
    if (context.eventRiskScore <= 35) return "Event Risk Contained";
    return "Event Risk Mixed";
  }, (bucketContexts, percent) => clamp(percent * 0.55 + weightedAverage(bucketContexts, (context) => context.eventRiskScore, 40) * 0.45));
}

function liquidityExposureBuckets(contexts: PortfolioPositionContext[]): PortfolioExposureBucket[] {
  return exposureBucketsFromClassifier(contexts, "liquidity", (context) => {
    if (context.liquidityRiskScore >= 70) return "Liquidity Pressure Elevated";
    if (context.liquidityRiskScore <= 36) return "Liquidity Supportive";
    return "Liquidity Mixed";
  }, (bucketContexts, percent) => clamp(percent * 0.48 + weightedAverage(bucketContexts, (context) => context.liquidityRiskScore, 45) * 0.52));
}

function shockExposureBuckets(contexts: PortfolioPositionContext[]): PortfolioExposureBucket[] {
  return exposureBucketsFromClassifier(contexts, "shock", (context) => {
    if (context.shockExposureScore >= 72) return "High Shock Exposure";
    if (context.shockExposureScore <= 42) return "Low Shock Exposure";
    return "Mixed Shock Exposure";
  }, (bucketContexts, percent) => clamp(percent * 0.46 + weightedAverage(bucketContexts, (context) => context.shockExposureScore, 45) * 0.54));
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
    const combinedRisk = context.fragilityScore * 0.30 + context.weightPct * 0.22 + scenarioVulnerabilityScore * 0.22 + (100 - context.macroAlignmentScore) * 0.08 + context.liquidityRiskScore * 0.09 + context.shockExposureScore * 0.09;
    return {
      asymmetryScore: context.asymmetryScore,
      fragilityScore: context.fragilityScore,
      liquidityRiskScore: context.liquidityRiskScore,
      macroAlignmentScore: context.macroAlignmentScore,
      scenarioVulnerabilityScore,
      sector: context.sector,
      shockExposureScore: context.shockExposureScore,
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
  rollingCorrelationPairs: PortfolioRollingCorrelationPair[],
): PortfolioCorrelationCluster[] {
  const clusters: PortfolioCorrelationCluster[] = [];
  for (const pair of rollingCorrelationPairs.filter((item) => item.correlation >= 0.72 && item.confidenceScore >= 55).slice(0, 4)) {
    const score = clamp(pair.correlation * 70 + pair.combinedWeightPct * 0.34 + pair.confidenceScore * 0.12);
    clusters.push({
      label: `${pair.left}/${pair.right} rolling correlation`,
      reason: `${pair.left} and ${pair.right} show ${pair.correlation.toFixed(2)} rolling correlation over ${pair.observationCount} return observations. This is statistical overlap, not just sector similarity.`,
      score: Math.round(score),
      symbols: [pair.left, pair.right],
      tone: riskTone(score),
      type: "correlation",
    });
  }
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
  const liquiditySensitive = contexts.filter((context) => context.liquidityRiskScore >= 68);
  const liquidityWeight = liquiditySensitive.reduce((sum, context) => sum + context.weightPct, 0);
  if (liquiditySensitive.length >= 2 || liquidityWeight >= 40) {
    clusters.push({
      label: "Liquidity pressure stack",
      reason: `${Math.round(liquidityWeight)}% of open exposure has elevated liquidity pressure, so market-wide tightening can amplify drawdown risk.`,
      score: Math.round(clamp(liquidityWeight * 0.60 + weightedAverage(liquiditySensitive, (context) => context.liquidityRiskScore, 70) * 0.40)),
      symbols: liquiditySensitive.map((context) => context.symbol),
      tone: "warn",
      type: "liquidity",
    });
  }
  const shockSensitive = contexts.filter((context) => context.shockExposureScore >= 70);
  const shockWeight = shockSensitive.reduce((sum, context) => sum + context.weightPct, 0);
  if (shockSensitive.length >= 2 || shockWeight >= 42) {
    clusters.push({
      label: "Shock exposure stack",
      reason: `${Math.round(shockWeight)}% of open exposure has elevated historical shock or two-sided volatility exposure.`,
      score: Math.round(clamp(shockWeight * 0.58 + weightedAverage(shockSensitive, (context) => context.shockExposureScore, 70) * 0.42)),
      symbols: shockSensitive.map((context) => context.symbol),
      tone: "warn",
      type: "shock",
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

function rollingCorrelationPairsFor(
  contexts: PortfolioPositionContext[],
  priceHistories: Record<string, PortfolioPriceHistoryPoint[]>,
): PortfolioRollingCorrelationPair[] {
  if (contexts.length < 2) return [];
  const symbols = contexts.map((context) => context.symbol);
  const returnsBySymbol = new Map<string, Map<string, number>>();
  for (const symbol of symbols) {
    const points = priceHistories[symbol] ?? priceHistories[symbol.toLowerCase()] ?? [];
    const returns = returnSeries(points);
    if (returns.size >= 20) returnsBySymbol.set(symbol, returns);
  }
  const pairs: PortfolioRollingCorrelationPair[] = [];
  for (let leftIndex = 0; leftIndex < symbols.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < symbols.length; rightIndex += 1) {
      const left = symbols[leftIndex];
      const right = symbols[rightIndex];
      if (!left || !right) continue;
      const leftReturns = returnsBySymbol.get(left);
      const rightReturns = returnsBySymbol.get(right);
      if (!leftReturns || !rightReturns) continue;
      const aligned = alignedReturnPairs(leftReturns, rightReturns, 90);
      if (aligned.length < 20) continue;
      const selected = aligned.slice(-60);
      const leftValues = selected.map((pair) => pair[0]);
      const rightValues = selected.map((pair) => pair[1]);
      const correlation = pearson(leftValues, rightValues);
      if (correlation === null) continue;
      const leftContext = contexts.find((context) => context.symbol === left);
      const rightContext = contexts.find((context) => context.symbol === right);
      const combinedWeightPct = Math.round((leftContext?.weightPct ?? 0) + (rightContext?.weightPct ?? 0));
      pairs.push({
        combinedWeightPct,
        confidenceScore: Math.round(correlationObservationConfidence(selected.length)),
        correlation: round(correlation, 3),
        covariance: round(covariance(leftValues, rightValues), 6),
        left,
        observationCount: selected.length,
        right,
        windowDays: 60,
      });
    }
  }
  return pairs.sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation)).slice(0, 12);
}

function returnSeries(points: PortfolioPriceHistoryPoint[]): Map<string, number> {
  const sorted = points
    .map((point) => ({ close: positiveNumber(point.close), date: point.date }))
    .filter((point): point is { close: number; date: string } => point.close !== null && Boolean(point.date))
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  const returns = new Map<string, number>();
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current || previous.close <= 0) continue;
    returns.set(dayKey(current.date), (current.close - previous.close) / previous.close);
  }
  return returns;
}

function alignedReturnPairs(left: Map<string, number>, right: Map<string, number>, maxPoints: number): Array<[number, number]> {
  const dates = [...left.keys()].filter((date) => right.has(date)).sort();
  return dates.slice(-maxPoints).map((date) => [left.get(date) ?? 0, right.get(date) ?? 0]);
}

function pearson(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = arithmeticMean(left);
  const rightMean = arithmeticMean(right);
  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean;
    const rightDelta = (right[index] ?? 0) - rightMean;
    numerator += leftDelta * rightDelta;
    leftDenominator += leftDelta ** 2;
    rightDenominator += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftDenominator * rightDenominator);
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function covariance(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = arithmeticMean(left);
  const rightMean = arithmeticMean(right);
  return left.reduce((sum, value, index) => sum + (value - leftMean) * ((right[index] ?? 0) - rightMean), 0) / (left.length - 1);
}

function arithmeticMean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function correlationObservationConfidence(count: number): number {
  if (count >= 60) return 86;
  if (count >= 45) return 72;
  if (count >= 30) return 56;
  if (count >= 20) return 38;
  return 18;
}

function correlationConfidenceFor(pairs: PortfolioRollingCorrelationPair[], positionCount: number): number {
  if (positionCount < 2) return 0;
  const possiblePairs = (positionCount * (positionCount - 1)) / 2;
  const coverage = Math.min(100, (pairs.length / Math.max(1, possiblePairs)) * 100);
  const observationQuality = pairs.length ? pairs.reduce((sum, pair) => sum + pair.confidenceScore, 0) / pairs.length : 0;
  return clamp(coverage * 0.45 + observationQuality * 0.55);
}

function dayKey(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value.slice(0, 10);
  return new Date(timestamp).toISOString().slice(0, 10);
}

function hedgeOffsetContextsFor(contexts: PortfolioPositionContext[], scenarioStress: PortfolioScenarioStress[]): PortfolioHedgeOffsetContext[] {
  const offsets: PortfolioHedgeOffsetContext[] = [];
  const growth = contexts.filter((context) => context.theme === "Growth / AI");
  const defensive = contexts.filter((context) => context.theme === "Defensive / Hedge" || context.theme === "Defensive / Quality");
  const energy = contexts.filter((context) => context.theme === "Commodity / Energy");
  const broadIndex = contexts.filter((context) => context.theme === "Broad Index");
  const growthWeight = growth.reduce((sum, context) => sum + context.weightPct, 0);
  const defensiveWeight = defensive.reduce((sum, context) => sum + context.weightPct, 0);
  const energyWeight = energy.reduce((sum, context) => sum + context.weightPct, 0);
  const broadIndexWeight = broadIndex.reduce((sum, context) => sum + context.weightPct, 0);

  if (growthWeight >= 35 && defensiveWeight >= 10) {
    offsets.push({
      label: "Defensive offset",
      reason: `${Math.round(defensiveWeight)}% defensive or hedge exposure partially offsets ${Math.round(growthWeight)}% growth/AI concentration under risk-off scenarios.`,
      score: Math.round(clamp(defensiveWeight * 1.4 + 35)),
      symbols: defensive.map((context) => context.symbol),
      tone: "good",
    });
  }
  if (energyWeight >= 12 && scenarioStress.some((stress) => stress.scenarioKey === "oil_breakout")) {
    offsets.push({
      label: "Commodity offset",
      reason: `${Math.round(energyWeight)}% commodity/energy exposure may behave differently during oil shock scenarios, based on deterministic sector stress mapping.`,
      score: Math.round(clamp(energyWeight * 1.2 + 38)),
      symbols: energy.map((context) => context.symbol),
      tone: "neutral",
    });
  }
  if (broadIndexWeight >= 20 && contexts.length >= 3) {
    offsets.push({
      label: "Broad index ballast",
      reason: `${Math.round(broadIndexWeight)}% broad-index exposure reduces single-name idiosyncratic concentration, but it does not hedge broad risk-off pressure.`,
      score: Math.round(clamp(broadIndexWeight + 35)),
      symbols: broadIndex.map((context) => context.symbol),
      tone: "neutral",
    });
  }
  return offsets.sort((left, right) => right.score - left.score).slice(0, 3);
}

function hiddenCorrelationWarningFor(clusters: PortfolioCorrelationCluster[], contexts: PortfolioPositionContext[]): string | null {
  const severe = clusters.find((cluster) => cluster.score >= 72);
  if (severe) return `${severe.label}: ${severe.symbols.join(", ")} may behave like one combined exposure under stress.`;
  const growthWeight = contexts.filter((context) => context.theme === "Growth / AI").reduce((sum, context) => sum + context.weightPct, 0);
  if (growthWeight >= 55) return `${Math.round(growthWeight)}% of exposure sits in Growth / AI, creating hidden factor correlation even when symbols differ.`;
  return null;
}

function eventConcentrationScoreFor(contexts: PortfolioPositionContext[], eventBuckets: PortfolioExposureBucket[]): number {
  if (!contexts.length) return 0;
  const eventRisk = weightedAverage(contexts, (context) => context.eventRiskScore, 35);
  const elevatedEventBucket = eventBuckets.find((bucket) => bucket.label === "Elevated Event Pressure");
  const elevatedWeight = elevatedEventBucket?.percent ?? 0;
  return clamp(eventRisk * 0.62 + elevatedWeight * 0.38);
}

function stressProofSummaryFor(
  contexts: PortfolioPositionContext[],
  scenarioStress: PortfolioScenarioStress[],
  offsets: PortfolioHedgeOffsetContext[],
  liquidityRiskScore: number,
  shockExposureScore: number,
): string[] {
  if (!contexts.length) return ["Add manual or paper positions to generate portfolio stress proof."];
  const lines: string[] = [];
  const topStress = scenarioStress[0];
  if (topStress) {
    lines.push(`${topStress.scenarioLabel} is the highest modeled stress at ${topStress.weightedVulnerabilityScore}/100 weighted vulnerability.`);
  }
  if (liquidityRiskScore >= 62) lines.push(`Liquidity pressure is elevated at ${Math.round(liquidityRiskScore)}/100 across weighted exposure.`);
  if (shockExposureScore >= 62) lines.push(`Shock exposure is elevated at ${Math.round(shockExposureScore)}/100, so sudden move risk is not isolated to one symbol.`);
  if (offsets.length) lines.push(`${offsets[0].label}: ${offsets[0].reason}`);
  if (!lines.length) lines.push("No severe scenario concentration is currently flagged; stress estimates remain bounded and evidence-based.");
  return lines.slice(0, 4);
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
  hiddenCorrelationWarning: string | null,
): string {
  if (!contexts.length) return "No open paper positions are available for portfolio intelligence yet.";
  const dominant = contexts[0];
  const stress = scenarioStress[0];
  const concentrationText = concentrationScore >= 62 ? "concentration is elevated" : concentrationScore >= 38 ? "concentration is moderate" : "concentration is controlled";
  const fragilityText = fragilityScore >= 66 ? "fragility is stacked" : fragilityScore >= 48 ? "fragility is mixed" : "fragility is contained";
  const stressText = stress ? `${stress.scenarioLabel} is the highest modeled scenario pressure` : "scenario stress will improve as current scanner context expands";
  const hiddenText = hiddenCorrelationWarning ? ` Hidden correlation: ${hiddenCorrelationWarning}` : "";
  return `Portfolio quality is ${qualityScore}/100; ${concentrationText}, ${fragilityText}, and ${dominant.symbol} is the largest open exposure. ${stressText}.${hiddenText}`;
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

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function maxKnown(values: unknown[]): number | null {
  const parsed = values
    .map((value) => scoreOrNull(value))
    .filter((value): value is number => value !== null);
  return parsed.length ? Math.max(...parsed) : null;
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
