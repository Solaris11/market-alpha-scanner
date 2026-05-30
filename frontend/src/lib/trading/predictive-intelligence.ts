import { clamp, cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { LiveIntelligenceSystem } from "./live-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { RegimeShiftSystem } from "./regime-shift-intelligence";

export type PredictionConfidenceBand = "high" | "low" | "medium";
export type PredictionHorizon = "1-3 sessions" | "1-2 weeks" | "2-6 weeks" | "event-dependent";
export type PredictedMarketRegime =
  | "risk_off"
  | "risk_on"
  | "rotation"
  | "sector_leadership_shift"
  | "trend_continuation"
  | "trend_exhaustion";
export type ExpectedVolatilityBand = "elevated" | "high" | "low" | "moderate";
export type ForecastRiskProfile = "balanced" | "controlled" | "elevated" | "fragile";
export type PredictionSource = "history" | "live" | "portfolio" | "regime" | "scanner" | "watchlist";

export type PredictionEvidence = {
  detail: string;
  label: string;
  source: PredictionSource;
  value: string;
};

export type HistoricalValidation = {
  available: boolean;
  confidenceScore: number;
  detail: string;
  label: string;
  sampleSize: number;
};

export type PredictionUncertainty = {
  drivers: string[];
  label: string;
  score: number;
};

export type MarketRegimeForecast = {
  confidenceBand: PredictionConfidenceBand;
  confidenceScore: number;
  evidence: PredictionEvidence[];
  forecast: PredictedMarketRegime;
  historicalValidation: HistoricalValidation;
  likelyPath: string;
  monitorNext: string[];
  timeHorizon: PredictionHorizon;
  uncertainty: PredictionUncertainty;
};

export type OpportunityForecast = {
  confidenceBand: PredictionConfidenceBand;
  confidenceScore: number;
  evidence: PredictionEvidence[];
  expectedVolatility: ExpectedVolatilityBand;
  historicalValidation: HistoricalValidation;
  invalidation: string;
  likelyPath: string;
  opportunityQualityScore: number;
  priceContext: {
    entry: number | null;
    price: number | null;
    stop: number | null;
    target: number | null;
  };
  researchActionState: string;
  riskProfile: ForecastRiskProfile;
  symbol: string;
  timeHorizon: PredictionHorizon;
  uncertainty: PredictionUncertainty;
  userInterestScore: number;
};

export type PredictiveAlertRanking = {
  confidenceBand: PredictionConfidenceBand;
  evidence: PredictionEvidence[];
  historicalRelevanceScore: number;
  importanceScore: number;
  marketContextScore: number;
  nextAction: string;
  rank: number;
  source: "opportunity" | "portfolio" | "regime";
  symbol: string | null;
  title: string;
  uncertainty: PredictionUncertainty;
  userInterestScore: number;
  whatChanged: string;
  whyItMatters: string;
};

export type PortfolioForecast = {
  confidenceBand: PredictionConfidenceBand;
  confidenceScore: number;
  evidence: PredictionEvidence[];
  exposureChangeSummary: string;
  historicalValidation: HistoricalValidation;
  limitedReason: string | null;
  potentialStressEvents: string[];
  riskForecastScore: number;
  scenarioOutcomes: Array<{
    label: string;
    likelyPressure: string;
    score: number;
  }>;
  status: "limited" | "operational";
  uncertainty: PredictionUncertainty;
};

export type PredictiveConfidenceFramework = {
  confidenceBand: PredictionConfidenceBand;
  evidenceCount: number;
  historicalValidationScore: number;
  overallConfidenceScore: number;
  trustBoundary: string[];
  uncertaintyScore: number;
};

export type PredictiveIntelligenceCertification = {
  blockers: string[];
  finalVerdict: string;
  noFabricatedCertainty: boolean;
  overallStatus: "not_ready" | "ready";
};

export type PredictiveIntelligenceSystem = {
  certification: PredictiveIntelligenceCertification;
  confidenceFramework: PredictiveConfidenceFramework;
  generatedAt: string;
  marketRegimeForecast: MarketRegimeForecast;
  opportunityForecasts: OpportunityForecast[];
  portfolioForecast: PortfolioForecast;
  predictiveAlerts: PredictiveAlertRanking[];
  proofBoundary: string;
};

export type PredictiveIntelligenceInput = {
  generatedAt?: string;
  liveSystem?: LiveIntelligenceSystem | null;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  regimeSystem: RegimeShiftSystem;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
};

type WeightedScore = readonly [number | null, number];

const TRUST_BOUNDARY = [
  "Predictive Intelligence is probabilistic research context, not financial advice.",
  "Forecasts describe likely pressure and monitoring priorities; they do not guarantee outcomes.",
  "Every forecast remains bounded by scanner, regime, portfolio, live, and historical evidence currently available.",
];

export function buildPredictiveIntelligenceSystem(input: PredictiveIntelligenceInput): PredictiveIntelligenceSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const watchlistSet = new Set((input.watchlistSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const marketRegimeForecast = buildMarketRegimeForecast(input.regimeSystem, input.liveSystem ?? null);
  const opportunityForecasts = buildOpportunityForecasts(input.rows, input.regimeSystem, watchlistSet);
  const portfolioForecast = buildPortfolioForecast(input.portfolioSystem ?? null);
  const predictiveAlerts = buildPredictiveAlerts({
    liveSystem: input.liveSystem ?? null,
    marketRegimeForecast,
    opportunityForecasts,
    portfolioForecast,
    regimeSystem: input.regimeSystem,
  });
  const confidenceFramework = buildConfidenceFramework(marketRegimeForecast, opportunityForecasts, portfolioForecast, predictiveAlerts);
  const certification = certificationFor(input.rows, marketRegimeForecast, opportunityForecasts, portfolioForecast, predictiveAlerts, confidenceFramework);

  return {
    certification,
    confidenceFramework,
    generatedAt,
    marketRegimeForecast,
    opportunityForecasts,
    portfolioForecast,
    predictiveAlerts,
    proofBoundary: TRUST_BOUNDARY.join(" "),
  };
}

function buildMarketRegimeForecast(regime: RegimeShiftSystem, liveSystem: LiveIntelligenceSystem | null): MarketRegimeForecast {
  const rotation = regime.sectorLeadership.rotationScore;
  const riskOffPressure = weightedAverage([
    [100 - regime.riskAppetiteScore, 0.28],
    [100 - regime.breadthHealthScore, 0.22],
    [regime.volatilityPressure, 0.20],
    [regime.liquidityPressure, 0.18],
    [liveSystem?.regimeShiftScore ?? null, 0.12],
  ], 50);
  const continuationPressure = weightedAverage([
    [regime.riskAppetiteScore, 0.30],
    [regime.breadthHealthScore, 0.24],
    [regime.momentumPersistenceScore, 0.24],
    [100 - regime.transitionRiskScore, 0.12],
    [100 - regime.volatilityPressure, 0.10],
  ], 50);
  const exhaustionPressure = weightedAverage([
    [regime.transitionRiskScore, 0.28],
    [100 - regime.momentumPersistenceScore, 0.24],
    [regime.volatilityPressure, 0.22],
    [regime.liquidityPressure, 0.14],
    [100 - regime.breadthHealthScore, 0.12],
  ], 50);
  const forecast = marketRegimeFor({
    continuationPressure,
    exhaustionPressure,
    riskAppetite: regime.riskAppetiteScore,
    riskOffPressure,
    rotation,
    transitionRisk: regime.transitionRiskScore,
  });
  const confidenceScore = Math.round(clamp(weightedAverage([
    [Math.max(continuationPressure, riskOffPressure, exhaustionPressure), 0.28],
    [Math.abs(regime.riskAppetiteScore - 50) + 50, 0.18],
    [Math.abs(regime.breadthHealthScore - 50) + 50, 0.16],
    [Math.abs(rotation - 50) + 50, 0.14],
    [100 - Math.min(75, regime.transitionRiskScore * 0.5), 0.10],
    [liveSystem?.status === "connected" ? 72 : liveSystem ? 60 : 52, 0.14],
  ], 55)));
  const uncertaintyScore = Math.round(clamp(weightedAverage([
    [regime.transitionRiskScore, 0.34],
    [regime.volatilityPressure, 0.24],
    [regime.liquidityPressure, 0.20],
    [liveSystem?.regimeShiftScore ?? null, 0.12],
    [100 - confidenceScore, 0.10],
  ], 45)));
  const evidenceItems = [
    predictionEvidence("Regime", regime.currentMarketState, regime.stateExplanation, "regime"),
    predictionEvidence("Risk appetite", `${regime.riskAppetiteScore}/100`, "Higher values support risk-on or trend continuation forecasts.", "regime"),
    predictionEvidence("Breadth", `${regime.breadthHealthScore}/100`, "Breadth strength changes the confidence of continuation versus deterioration.", "regime"),
    predictionEvidence("Sector rotation", `${rotation}/100`, regime.sectorLeadership.detail, "regime"),
    predictionEvidence("Live pressure", liveSystem ? `${liveSystem.regimeShiftScore}/100` : "Limited", liveSystem?.liveSummary ?? "Live stream evidence was not supplied.", "live"),
  ];

  return {
    confidenceBand: confidenceBand(confidenceScore),
    confidenceScore,
    evidence: evidenceItems,
    forecast,
    historicalValidation: {
      available: regime.driftTimeline.length > 0,
      confidenceScore: Math.round(clamp(48 + regime.driftTimeline.length * 7)),
      detail: regime.driftTimeline.length
        ? `Uses ${regime.driftTimeline.length} deterministic drift components from the latest scanner and market-state packet.`
        : "Historical drift timeline is limited in the current packet.",
      label: regime.driftTimeline.length ? "Regime drift components available" : "Limited regime drift validation",
      sampleSize: regime.driftTimeline.length,
    },
    likelyPath: regimeLikelyPath(forecast, regime),
    monitorNext: uniqueStrings([...regime.whatToMonitor, ...(liveSystem?.alerts.map((alert) => alert.title) ?? [])]).slice(0, 6),
    timeHorizon: forecast === "rotation" || forecast === "sector_leadership_shift" ? "1-2 weeks" : "1-3 sessions",
    uncertainty: {
      drivers: uncertaintyDrivers([
        [regime.transitionRiskScore >= 65, "transition risk is elevated"],
        [regime.volatilityPressure >= 65, "volatility pressure can change the forecast quickly"],
        [regime.liquidityPressure >= 65, "liquidity pressure can weaken follow-through"],
        [rotation >= 65, "sector leadership is rotating"],
        [liveSystem === null, "live stream evidence is not included in this packet"],
      ]),
      label: uncertaintyLabel(uncertaintyScore),
      score: uncertaintyScore,
    },
  };
}

function buildOpportunityForecasts(rows: OpportunityViewModel[], regime: RegimeShiftSystem, watchlistSet: Set<string>): OpportunityForecast[] {
  return rows
    .map((row) => opportunityForecastFor(row, regime, watchlistSet.has(row.symbol.toUpperCase())))
    .sort((left, right) => right.opportunityQualityScore - left.opportunityQualityScore || right.confidenceScore - left.confidenceScore || left.symbol.localeCompare(right.symbol))
    .slice(0, 12);
}

function opportunityForecastFor(row: OpportunityViewModel, regime: RegimeShiftSystem, inWatchlist: boolean): OpportunityForecast {
  const score = scoreValue(row.final_score, row.conviction);
  const macro = scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score, row.macroAdjustment === null ? 50 : clamp(50 + row.macroAdjustment * 5));
  const volatility = scoreValue(row.raw.volatility_pressure ?? row.raw.atr_percentile, row.fragility);
  const liquidity = scoreValue(row.raw.liquidity_pressure, 45);
  const reliability = scoreValue(row.raw.score_reliability ?? row.raw.confidence_reliability, row.evidence?.score ?? 55);
  const historicalSample = Math.max(0, Math.trunc(scoreValue(row.raw.historical_sample_size ?? row.raw.market_memory_sample_size ?? row.raw.forward_return_sample_size, 0)));
  const eventPenalty = clamp(row.eventRisk * 0.16);
  const fragilityPenalty = clamp(row.fragility * 0.18);
  const volatilityPenalty = clamp(volatility * 0.08);
  const opportunityQualityScore = Math.round(clamp(weightedAverage([
    [score, 0.26],
    [row.conviction, 0.22],
    [macro, 0.14],
    [regime.riskAppetiteScore, 0.10],
    [reliability, 0.12],
    [100 - row.fragility, 0.10],
    [inWatchlist ? 70 : 50, 0.06],
  ], 50) - eventPenalty - fragilityPenalty - volatilityPenalty));
  const confidenceScore = Math.round(clamp(weightedAverage([
    [reliability, 0.30],
    [row.evidence?.score ?? null, 0.20],
    [historicalSample ? clamp(42 + Math.log10(historicalSample + 1) * 18) : null, 0.16],
    [100 - row.fragility, 0.14],
    [100 - row.eventRisk, 0.12],
    [inWatchlist ? 68 : 55, 0.08],
  ], 52)));
  const uncertaintyScore = Math.round(clamp(weightedAverage([
    [row.fragility, 0.24],
    [row.eventRisk, 0.22],
    [volatility, 0.22],
    [liquidity, 0.14],
    [100 - confidenceScore, 0.18],
  ], 45)));
  const riskProfile = riskProfileFor(uncertaintyScore, row.fragility, row.eventRisk);
  const expectedVolatility = volatilityBand(Math.max(volatility, row.fragility, row.eventRisk));
  const timeHorizon = opportunityHorizon(row, expectedVolatility);
  const researchActionState = researchActionStateFor(row, opportunityQualityScore);

  return {
    confidenceBand: confidenceBand(confidenceScore),
    confidenceScore,
    evidence: opportunityEvidence(row, macro, reliability, inWatchlist),
    expectedVolatility,
    historicalValidation: {
      available: historicalSample > 0,
      confidenceScore: Math.round(clamp(historicalSample ? 44 + Math.log10(historicalSample + 1) * 17 : 36)),
      detail: historicalSample
        ? `${historicalSample} source rows or analog observations are referenced by scanner evidence fields.`
        : "No verified historical sample count is present for this symbol in the current packet.",
      label: historicalSample ? "Historical sample evidence present" : "Limited historical validation",
      sampleSize: historicalSample,
    },
    invalidation: invalidationFor(row, regime),
    likelyPath: opportunityLikelyPath(row, opportunityQualityScore, riskProfile, expectedVolatility),
    opportunityQualityScore,
    priceContext: {
      entry: row.suggested_entry,
      price: row.price,
      stop: row.stop_loss,
      target: row.target,
    },
    researchActionState,
    riskProfile,
    symbol: row.symbol,
    timeHorizon,
    uncertainty: {
      drivers: uncertaintyDrivers([
        [row.fragility >= 65, "setup fragility is elevated"],
        [row.eventRisk >= 65, "verified event pressure can alter the setup"],
        [volatility >= 65, "expected volatility is elevated"],
        [liquidity >= 65, "liquidity pressure can widen execution risk"],
        [historicalSample === 0, "historical validation sample is limited"],
      ]),
      label: uncertaintyLabel(uncertaintyScore),
      score: uncertaintyScore,
    },
    userInterestScore: inWatchlist ? 82 : 45,
  };
}

function buildPortfolioForecast(portfolio: PortfolioIntelligenceSystem | null): PortfolioForecast {
  if (!portfolio || portfolio.openPositionCount === 0) {
    return {
      confidenceBand: "low",
      confidenceScore: 35,
      evidence: [predictionEvidence("Portfolio positions", "Limited", "No open portfolio positions were supplied to the predictive engine.", "portfolio")],
      exposureChangeSummary: "Portfolio forecasting is limited until open paper/research positions are available.",
      historicalValidation: {
        available: false,
        confidenceScore: 25,
        detail: "No open positions were available for scenario or exposure validation.",
        label: "Limited portfolio validation",
        sampleSize: 0,
      },
      limitedReason: "No open paper/research positions available for authenticated portfolio forecasting.",
      potentialStressEvents: ["Add paper/research positions to enable exposure, stress, and scenario forecasting."],
      riskForecastScore: 50,
      scenarioOutcomes: [],
      status: "limited",
      uncertainty: {
      drivers: ["open position evidence is missing"],
        label: "High uncertainty",
        score: 74,
      },
    };
  }

  const riskForecastScore = Math.round(clamp(weightedAverage([
    [portfolio.fragilityScore, 0.22],
    [portfolio.concentrationScore, 0.18],
    [portfolio.scenarioVulnerabilityScore, 0.18],
    [portfolio.liquidityRiskScore, 0.14],
    [portfolio.shockExposureScore, 0.14],
    [portfolio.eventConcentrationScore, 0.08],
    [100 - portfolio.macroAlignmentScore, 0.06],
  ], 50)));
  const confidenceScore = Math.round(clamp(weightedAverage([
    [portfolio.openPositionCount >= 2 ? 72 : 58, 0.20],
    [portfolio.rollingCorrelationConfidenceScore, 0.20],
    [portfolio.scenarioStress.length ? 72 : 54, 0.20],
    [portfolio.positionContexts.length ? 70 : 42, 0.18],
    [100 - Math.min(80, portfolio.hiddenCorrelationWarning ? 20 : 0), 0.10],
    [portfolio.exposureBuckets.length ? 66 : 45, 0.12],
  ], 55)));
  const uncertaintyScore = Math.round(clamp(weightedAverage([
    [riskForecastScore, 0.28],
    [portfolio.hiddenCorrelationWarning ? 72 : 42, 0.18],
    [100 - portfolio.rollingCorrelationConfidenceScore, 0.18],
    [portfolio.scenarioVulnerabilityScore, 0.18],
    [100 - confidenceScore, 0.18],
  ], 45)));
  const topBuckets = portfolio.exposureBuckets.slice(0, 3);
  const scenarioOutcomes = portfolio.scenarioStress.slice(0, 5).map((scenario) => ({
    label: scenario.scenarioLabel,
    likelyPressure: scenario.summary,
    score: scenario.weightedVulnerabilityScore,
  }));

  return {
    confidenceBand: confidenceBand(confidenceScore),
    confidenceScore,
    evidence: [
      predictionEvidence("Open positions", `${portfolio.openPositionCount}`, "Forecast uses authenticated paper/research position exposure only.", "portfolio"),
      predictionEvidence("Concentration", `${portfolio.concentrationScore}/100`, "Higher concentration increases stress-event sensitivity.", "portfolio"),
      predictionEvidence("Scenario vulnerability", `${portfolio.scenarioVulnerabilityScore}/100`, "Scenario pressure is derived from deterministic portfolio stress rules.", "portfolio"),
      predictionEvidence("Correlation confidence", `${portfolio.rollingCorrelationConfidenceScore}/100`, portfolio.hiddenCorrelationWarning ?? "Rolling/factor correlation evidence is available where supplied.", "portfolio"),
    ],
    exposureChangeSummary: topBuckets.length
      ? `Top exposure pressure: ${topBuckets.map((bucket) => `${bucket.label} ${bucket.percent}%`).join(", ")}.`
      : "Exposure buckets are limited in the current packet.",
    historicalValidation: {
      available: portfolio.rollingCorrelationPairs.length > 0 || portfolio.scenarioStress.length > 0,
      confidenceScore: Math.round(clamp((portfolio.rollingCorrelationPairs.length ? 58 : 42) + portfolio.scenarioStress.length * 4)),
      detail: portfolio.rollingCorrelationPairs.length
        ? `${portfolio.rollingCorrelationPairs.length} rolling correlation pairs plus ${portfolio.scenarioStress.length} scenario stress rows are available.`
        : `${portfolio.scenarioStress.length} scenario stress rows are available; rolling correlation history is limited.`,
      label: portfolio.rollingCorrelationPairs.length ? "Correlation and stress validation present" : "Scenario-only validation",
      sampleSize: portfolio.rollingCorrelationPairs.length + portfolio.scenarioStress.length,
    },
    limitedReason: null,
    potentialStressEvents: portfolio.stressProofSummary.length
      ? portfolio.stressProofSummary.slice(0, 5)
      : ["Monitor concentration, liquidity, fragility, and macro exposure changes."],
    riskForecastScore,
    scenarioOutcomes,
    status: "operational",
    uncertainty: {
      drivers: uncertaintyDrivers([
        [portfolio.concentrationScore >= 65, "concentration is elevated"],
        [portfolio.scenarioVulnerabilityScore >= 65, "scenario vulnerability is elevated"],
        [portfolio.liquidityRiskScore >= 65, "liquidity risk can amplify stress outcomes"],
        [Boolean(portfolio.hiddenCorrelationWarning), "hidden correlation warning is active"],
        [portfolio.rollingCorrelationPairs.length === 0, "rolling correlation history is limited"],
      ]),
      label: uncertaintyLabel(uncertaintyScore),
      score: uncertaintyScore,
    },
  };
}

function buildPredictiveAlerts(input: {
  liveSystem: LiveIntelligenceSystem | null;
  marketRegimeForecast: MarketRegimeForecast;
  opportunityForecasts: OpportunityForecast[];
  portfolioForecast: PortfolioForecast;
  regimeSystem: RegimeShiftSystem;
}): PredictiveAlertRanking[] {
  const alerts: Omit<PredictiveAlertRanking, "rank">[] = [];
  alerts.push({
    confidenceBand: input.marketRegimeForecast.confidenceBand,
    evidence: input.marketRegimeForecast.evidence.slice(0, 3),
    historicalRelevanceScore: input.marketRegimeForecast.historicalValidation.confidenceScore,
    importanceScore: Math.round(clamp(input.regimeSystem.transitionRiskScore * 0.36 + input.marketRegimeForecast.confidenceScore * 0.32 + input.marketRegimeForecast.uncertainty.score * 0.32)),
    marketContextScore: input.regimeSystem.transitionRiskScore,
    nextAction: "Review market regime, sector leadership, and volatility monitors before increasing exposure.",
    source: "regime",
    symbol: null,
    title: `Regime forecast: ${humanForecast(input.marketRegimeForecast.forecast)}`,
    uncertainty: input.marketRegimeForecast.uncertainty,
    userInterestScore: 50,
    whatChanged: input.regimeSystem.terminalSummary,
    whyItMatters: "Regime forecasts determine whether scanner opportunities should be treated as continuation, rotation, or risk-control research.",
  });

  for (const forecast of input.opportunityForecasts.slice(0, 8)) {
    alerts.push({
      confidenceBand: forecast.confidenceBand,
      evidence: forecast.evidence.slice(0, 3),
      historicalRelevanceScore: forecast.historicalValidation.confidenceScore,
      importanceScore: Math.round(clamp(forecast.opportunityQualityScore * 0.38 + forecast.confidenceScore * 0.24 + forecast.userInterestScore * 0.18 + (100 - forecast.uncertainty.score) * 0.20)),
      marketContextScore: forecast.confidenceScore,
      nextAction: `${forecast.symbol}: inspect source-backed setup evidence, invalidation, and risk controls before deciding whether it stays in the research queue.`,
      source: "opportunity",
      symbol: forecast.symbol,
      title: `${forecast.symbol} predictive opportunity watch`,
      uncertainty: forecast.uncertainty,
      userInterestScore: forecast.userInterestScore,
      whatChanged: forecast.likelyPath,
      whyItMatters: `${forecast.symbol} has ${forecast.researchActionState.toLowerCase()} context with ${forecast.expectedVolatility} expected volatility and ${forecast.riskProfile} risk.`,
    });
  }

  if (input.portfolioForecast.status === "operational") {
    alerts.push({
      confidenceBand: input.portfolioForecast.confidenceBand,
      evidence: input.portfolioForecast.evidence,
      historicalRelevanceScore: input.portfolioForecast.historicalValidation.confidenceScore,
      importanceScore: Math.round(clamp(input.portfolioForecast.riskForecastScore * 0.52 + input.portfolioForecast.confidenceScore * 0.24 + input.portfolioForecast.uncertainty.score * 0.24)),
      marketContextScore: input.portfolioForecast.riskForecastScore,
      nextAction: "Review exposure buckets and scenario stress before adding similar positions.",
      source: "portfolio",
      symbol: null,
      title: "Portfolio stress forecast",
      uncertainty: input.portfolioForecast.uncertainty,
      userInterestScore: 76,
      whatChanged: input.portfolioForecast.exposureChangeSummary,
      whyItMatters: "Portfolio forecast converts open paper/research exposure into stress-event monitoring priorities.",
    });
  }

  for (const liveAlert of input.liveSystem?.alerts.slice(0, 4) ?? []) {
    const uncertainty = {
      drivers: liveAlert.reasonCodes.length ? liveAlert.reasonCodes : ["live alert source is scanner-derived"],
      label: uncertaintyLabel(100 - liveAlert.score),
      score: Math.round(clamp(100 - liveAlert.score)),
    };
    alerts.push({
      confidenceBand: confidenceBand(liveAlert.score),
      evidence: [predictionEvidence("Live alert", `${liveAlert.score}/100`, liveAlert.detail, "live")],
      historicalRelevanceScore: liveAlert.score,
      importanceScore: Math.round(clamp(liveAlert.score)),
      marketContextScore: liveAlert.score,
      nextAction: "Treat the live alert as a monitoring priority and verify supporting symbol or regime evidence.",
      source: "regime",
      symbol: null,
      title: liveAlert.title,
      uncertainty,
      userInterestScore: 52,
      whatChanged: liveAlert.detail,
      whyItMatters: "Live alerts can reprioritize forecast monitoring when scanner-derived pressure changes quickly.",
    });
  }

  return alerts
    .sort((left, right) => right.importanceScore - left.importanceScore || right.historicalRelevanceScore - left.historicalRelevanceScore)
    .slice(0, 12)
    .map((alert, index) => ({ ...alert, rank: index + 1 }));
}

function buildConfidenceFramework(
  marketRegimeForecast: MarketRegimeForecast,
  opportunityForecasts: OpportunityForecast[],
  portfolioForecast: PortfolioForecast,
  predictiveAlerts: PredictiveAlertRanking[],
): PredictiveConfidenceFramework {
  const evidenceCount = marketRegimeForecast.evidence.length
    + opportunityForecasts.reduce((total, forecast) => total + forecast.evidence.length, 0)
    + portfolioForecast.evidence.length
    + predictiveAlerts.reduce((total, alert) => total + alert.evidence.length, 0);
  const historicalValidationScore = Math.round(clamp(average([
    marketRegimeForecast.historicalValidation.confidenceScore,
    portfolioForecast.historicalValidation.confidenceScore,
    ...opportunityForecasts.map((forecast) => forecast.historicalValidation.confidenceScore),
  ], 45)));
  const uncertaintyScore = Math.round(clamp(average([
    marketRegimeForecast.uncertainty.score,
    portfolioForecast.uncertainty.score,
    ...opportunityForecasts.map((forecast) => forecast.uncertainty.score),
  ], 55)));
  const overallConfidenceScore = Math.round(clamp(weightedAverage([
    [marketRegimeForecast.confidenceScore, 0.22],
    [average(opportunityForecasts.map((forecast) => forecast.confidenceScore), 45), 0.26],
    [portfolioForecast.confidenceScore, 0.16],
    [historicalValidationScore, 0.18],
    [evidenceCount >= 30 ? 72 : evidenceCount >= 16 ? 62 : 48, 0.10],
    [100 - uncertaintyScore, 0.08],
  ], 50)));
  return {
    confidenceBand: confidenceBand(overallConfidenceScore),
    evidenceCount,
    historicalValidationScore,
    overallConfidenceScore,
    trustBoundary: TRUST_BOUNDARY,
    uncertaintyScore,
  };
}

function certificationFor(
  rows: OpportunityViewModel[],
  marketRegimeForecast: MarketRegimeForecast,
  opportunityForecasts: OpportunityForecast[],
  portfolioForecast: PortfolioForecast,
  predictiveAlerts: PredictiveAlertRanking[],
  confidenceFramework: PredictiveConfidenceFramework,
): PredictiveIntelligenceCertification {
  const blockers: string[] = [];
  if (!rows.length) blockers.push("Scanner rows unavailable.");
  if (!opportunityForecasts.length) blockers.push("Predictive opportunity forecasts unavailable.");
  if (!predictiveAlerts.length) blockers.push("Predictive alert ranking unavailable.");
  if (marketRegimeForecast.confidenceScore < 30) blockers.push("Market regime forecast confidence is too low for certification.");
  if (portfolioForecast.status !== "operational") blockers.push("Portfolio forecast is limited because no authenticated portfolio positions were supplied.");
  if (confidenceFramework.evidenceCount < 10) blockers.push("Prediction evidence count is too low for certification.");
  return {
    blockers,
    finalVerdict: blockers.length ? "TRADEVETO PREDICTIVE INTELLIGENCE ENGINE NOT ACCOMPLISHED" : "TRADEVETO PREDICTIVE INTELLIGENCE ENGINE ACCOMPLISHED",
    noFabricatedCertainty: true,
    overallStatus: blockers.length ? "not_ready" : "ready",
  };
}

function marketRegimeFor(input: {
  continuationPressure: number;
  exhaustionPressure: number;
  riskAppetite: number;
  riskOffPressure: number;
  rotation: number;
  transitionRisk: number;
}): PredictedMarketRegime {
  if (input.riskOffPressure >= 68 && input.riskAppetite <= 45) return "risk_off";
  if (input.rotation >= 72 && input.transitionRisk >= 58) return "sector_leadership_shift";
  if (input.rotation >= 64) return "rotation";
  if (input.exhaustionPressure >= 66 && input.transitionRisk >= 62) return "trend_exhaustion";
  if (input.continuationPressure >= 64 && input.riskAppetite >= 58) return "trend_continuation";
  if (input.riskAppetite >= 62) return "risk_on";
  return input.riskOffPressure > input.continuationPressure ? "risk_off" : "rotation";
}

function regimeLikelyPath(forecast: PredictedMarketRegime, regime: RegimeShiftSystem): string {
  switch (forecast) {
    case "risk_on":
      return "Risk appetite and breadth are supportive enough for opportunity quality to matter more than defensive filtering, while transition risk still needs monitoring.";
    case "risk_off":
      return "Defensive pressure is likely to keep risk controls, liquidity, and volatility filters ahead of aggressive opportunity selection.";
    case "rotation":
      return `Sector rotation remains the primary path; leadership is concentrated in ${regime.sectorLeadership.leadingSectors.slice(0, 3).join(", ") || "the strongest scanner sectors"}.`;
    case "sector_leadership_shift":
      return "Leadership shift pressure is high enough that prior winners may need confirmation before continuation assumptions are trusted.";
    case "trend_continuation":
      return "The current trend can continue if breadth, momentum persistence, and liquidity do not deteriorate in the next scanner packets.";
    case "trend_exhaustion":
      return "The next likely market pressure is trend exhaustion unless volatility, breadth, and liquidity stabilize.";
  }
}

function opportunityEvidence(row: OpportunityViewModel, macroScore: number, reliability: number, inWatchlist: boolean): PredictionEvidence[] {
  return [
    predictionEvidence("Opportunity score", `${scoreValue(row.final_score, row.conviction)}/100`, cleanText(row.decision_reason, "Scanner decision reason is limited."), "scanner"),
    predictionEvidence("Conviction", `${row.conviction}/100`, `${row.confidenceLabel} confidence label with ${row.structuralLabel.toLowerCase()}.`, "scanner"),
    predictionEvidence("Macro alignment", `${Math.round(macroScore)}/100`, row.macroLabel, "regime"),
    predictionEvidence("Data reliability", `${Math.round(reliability)}/100`, row.evidence ? `${row.evidence.label}: ${row.evidence.reasons.slice(0, 2).join(" ")}` : "Evidence maturity is inferred from available scanner fields.", "history"),
    predictionEvidence("User interest", inWatchlist ? "Watchlist" : "Not watchlisted", inWatchlist ? "Symbol is in the authenticated watchlist." : "No authenticated watchlist signal is present.", "watchlist"),
  ];
}

function opportunityLikelyPath(row: OpportunityViewModel, qualityScore: number, riskProfile: ForecastRiskProfile, volatility: ExpectedVolatilityBand): string {
  if (qualityScore >= 72 && riskProfile === "controlled") {
    return `${row.symbol} has a constructive probabilistic path if price remains near its entry context and scanner confidence persists.`;
  }
  if (qualityScore >= 62 && volatility !== "high") {
    return `${row.symbol} is more likely to remain a monitored setup than a high-conviction continuation until confirmation improves.`;
  }
  if (riskProfile === "fragile" || volatility === "high") {
    return `${row.symbol} needs risk confirmation first because volatility, event pressure, or fragility can dominate the setup.`;
  }
  return `${row.symbol} remains a research candidate with mixed forecast quality and should be compared against stronger scanner alternatives.`;
}

function invalidationFor(row: OpportunityViewModel, regime: RegimeShiftSystem): string {
  const stop = row.stop_loss === null ? null : `below ${row.stop_loss.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const structural = row.fragility >= 70 ? "fragility remains elevated" : "scanner confidence deteriorates";
  const regimeBreak = regime.driftDirection === "deteriorating" || regime.driftDirection === "unstable_transition"
    ? "or the regime drift continues deteriorating"
    : "or breadth and liquidity weaken";
  return stop ? `Forecast weakens if price breaks ${stop}, ${structural}, ${regimeBreak}.` : `Forecast weakens if ${structural}, ${regimeBreak}, or support cannot be verified.`;
}

function researchActionStateFor(row: OpportunityViewModel, qualityScore: number): string {
  const existing = cleanText(row.final_decision, "").toUpperCase();
  if (/AVOID|EXIT/.test(existing)) return "AVOID / RISK CONTROL";
  if (qualityScore >= 75) return "HIGH-PRIORITY WATCH";
  if (qualityScore >= 62) return "WATCH";
  if (/PULLBACK/.test(existing)) return "WAIT FOR PULLBACK";
  return "RESEARCH ONLY";
}

function opportunityHorizon(row: OpportunityViewModel, volatility: ExpectedVolatilityBand): PredictionHorizon {
  const setup = cleanText(row.raw.setup_type, "").toUpperCase();
  if (row.eventRisk >= 70 || volatility === "high") return "event-dependent";
  if (/INTRADAY|BREAKOUT|SHOCK/.test(setup)) return "1-3 sessions";
  if (/SWING|CONTINUATION|MOMENTUM/.test(setup)) return "1-2 weeks";
  return "2-6 weeks";
}

function riskProfileFor(uncertaintyScore: number, fragility: number, eventRisk: number): ForecastRiskProfile {
  const score = Math.max(uncertaintyScore, fragility, eventRisk);
  if (score >= 76) return "fragile";
  if (score >= 62) return "elevated";
  if (score >= 42) return "balanced";
  return "controlled";
}

function volatilityBand(score: number): ExpectedVolatilityBand {
  if (score >= 78) return "high";
  if (score >= 62) return "elevated";
  if (score >= 38) return "moderate";
  return "low";
}

function confidenceBand(score: number): PredictionConfidenceBand {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function uncertaintyLabel(score: number): string {
  if (score >= 70) return "High uncertainty";
  if (score >= 46) return "Moderate uncertainty";
  return "Controlled uncertainty";
}

function predictionEvidence(label: string, value: string, detail: string, source: PredictionSource): PredictionEvidence {
  return { detail, label, source, value };
}

function uncertaintyDrivers(items: Array<readonly [boolean, string]>): string[] {
  const drivers = items.filter(([active]) => active).map(([, label]) => label);
  return drivers.length ? drivers : ["uncertainty is bounded by available source-backed evidence"];
}

function scoreValue(value: unknown, fallback: number): number {
  return clamp(finiteNumber(value) ?? fallback);
}

function average(values: number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function weightedAverage(values: WeightedScore[], fallback: number): number {
  let total = 0;
  let weightTotal = 0;
  for (const [value, weight] of values) {
    if (value === null || !Number.isFinite(value) || weight <= 0) continue;
    total += value * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? total / weightTotal : fallback;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function humanForecast(value: PredictedMarketRegime): string {
  return value.replace(/_/g, " ");
}
