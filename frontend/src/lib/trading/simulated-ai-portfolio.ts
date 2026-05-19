import type { CsvRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { StrategyFamily, StrategyIntelligenceSystem, StrategyPerformanceRow } from "./strategy-intelligence";
import { strategyFamilyLabel } from "./strategy-intelligence";

export type SimulatedPortfolioMode = "aggressive" | "balanced" | "conservative";

export type SimulatedPortfolioModeConfig = {
  baseAllocationPct: number;
  description: string;
  label: string;
  maxAllocationPct: number;
  maxCurrentPositions: number;
  maxFragilityScore: number;
  minModeScore: number;
  riskPolicy: string;
};

export type SimulatedPortfolioEquityPoint = {
  benchmarkValue: number;
  label: string;
  tradeIndex: number;
  value: number;
};

export type SimulatedPortfolioTone = "good" | "neutral" | "risk" | "warn";

export type SimulatedPortfolioTradeLearning = {
  adjustment: string;
  lesson: string;
  outcomeLabel: string;
  review: "contained" | "deteriorated" | "failed" | "improved";
  tone: SimulatedPortfolioTone;
};

export type SimulatedPortfolioClosedTrade = {
  allocationPct: number;
  capitalAfter: number;
  capitalBefore: number;
  confidenceAtEntry: number;
  confidenceAtExit: number;
  drawdownPct: number | null;
  entryDate: string;
  entryPrice: number | null;
  entryReasons: string[];
  eventReason: string;
  exitDate: string;
  exitPrice: number | null;
  exitReasons: string[];
  horizonDays: number;
  id: string;
  investedAmount: number;
  learning: SimulatedPortfolioTradeLearning;
  macroReason: string;
  modeScore: number;
  positionUnits: number | null;
  realizedPnl: number;
  realizedReturnPct: number;
  riskRewardReason: string;
  riskState: string;
  sector: string;
  strategyFamily: StrategyFamily;
  symbol: string;
};

export type SimulatedPortfolioOpenPosition = {
  allocationPct: number;
  confidenceAtEntry: number;
  currentPrice: number | null;
  entryMarkPrice: number | null;
  entryReasons: string[];
  eventReason: string;
  exitPlan: string;
  investedAmount: number;
  macroReason: string;
  modeScore: number;
  positionUnits: number | null;
  riskRewardReason: string;
  riskState: string;
  sector: string;
  strategyFamily: StrategyFamily;
  symbol: string;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

export type SimulatedPortfolioStats = {
  averageHoldDays: number | null;
  benchmarkReturnPct: number | null;
  cashPct: number;
  closedTradeCount: number;
  maxDrawdownPct: number | null;
  realizedPnl: number;
  simulatedReturnPct: number | null;
  startingCapital: number;
  strategyQualityScore: number;
  totalCurrentAllocationPct: number;
  unrealizedPnl: number;
  volatilityPct: number | null;
  winRatePct: number | null;
};

export type SimulatedPortfolioCapitalScenario = {
  cashAmount: number;
  deployedAmount: number;
  label: string;
  latestEquity: number;
  realizedPnl: number;
  startingCapital: number;
};

export type SimulatedPortfolioExposureBucket = {
  allocationPct: number;
  label: string;
  pnl: number;
  returnPct: number | null;
  symbolCount: number;
  tone: SimulatedPortfolioTone;
  type: "sector" | "strategy" | "risk";
};

export type SimulatedPortfolioLearningTimelinePoint = {
  allocationPct: number;
  confidenceScore: number;
  date: string;
  label: string;
  riskScore: number;
  summary: string;
  tone: SimulatedPortfolioTone;
};

export type SimulatedPortfolioReviewItem = {
  detail: string;
  label: string;
  symbol: string | null;
  tone: SimulatedPortfolioTone;
  value: string;
};

export type SimulatedPortfolioDecisionReview = {
  bestDecision: SimulatedPortfolioReviewItem;
  missedOpportunity: SimulatedPortfolioReviewItem;
  patienceWin: SimulatedPortfolioReviewItem;
  strongestExit: SimulatedPortfolioReviewItem;
  unnecessaryRisk: SimulatedPortfolioReviewItem;
  weakestDecision: SimulatedPortfolioReviewItem;
  weakestExit: SimulatedPortfolioReviewItem;
};

export type SimulatedPortfolioRiskMapCell = {
  detail: string;
  label: string;
  tone: SimulatedPortfolioTone;
  value: number | null;
};

export type SimulatedPortfolioLearningSystem = {
  adjustmentSummary: string;
  allocationTrend: number[];
  confidenceTrend: number[];
  decisionReview: SimulatedPortfolioDecisionReview;
  exposureBuckets: SimulatedPortfolioExposureBucket[];
  heatmap: SimulatedPortfolioRiskMapCell[];
  learningTimeline: SimulatedPortfolioLearningTimelinePoint[];
  lessons: string[];
  portfolioStories: string[];
  riskTrend: number[];
};

export type SimulatedPortfolioModeResult = {
  capitalScenarios: SimulatedPortfolioCapitalScenario[];
  closedTrades: SimulatedPortfolioClosedTrade[];
  config: SimulatedPortfolioModeConfig;
  equityCurve: SimulatedPortfolioEquityPoint[];
  learning: SimulatedPortfolioLearningSystem;
  mode: SimulatedPortfolioMode;
  openPositions: SimulatedPortfolioOpenPosition[];
  stats: SimulatedPortfolioStats;
  summary: string;
};

export type SimulatedAiPortfolioSystem = {
  generatedAt: string;
  limitations: string[];
  modes: Record<SimulatedPortfolioMode, SimulatedPortfolioModeResult>;
  primaryHorizon: string;
  simulationOnly: true;
  startingCapital: number;
};

export type SimulatedAiPortfolioInput = {
  forwardRows?: CsvRow[];
  generatedAt?: string;
  opportunities?: OpportunityViewModel[];
  startingCapital?: number;
  strategySystem?: StrategyIntelligenceSystem | null;
};

type ModeConfigInternal = SimulatedPortfolioModeConfig & {
  mode: SimulatedPortfolioMode;
  shockWeight: number;
  strategyWeight: number;
};

type SimulationObservation = {
  dateLabel: string;
  drawdownPct: number | null;
  entryPrice: number | null;
  eventRiskScore: number | null;
  eventSignature: string;
  family: StrategyFamily;
  finalScore: number | null;
  fragilityScore: number | null;
  horizon: string;
  horizonDays: number;
  liquidityPressure: number | null;
  macroAlignmentScore: number | null;
  marketRegime: string;
  returnPct: number;
  riskReward: number | null;
  sector: string;
  setupType: string;
  shockScore: number | null;
  symbol: string;
  timeMs: number | null;
  volatilityPressure: number | null;
};

const STARTING_CAPITAL = 100_000;
const MAX_HISTORICAL_TRADES_PER_MODE = 220;
const MAX_CLOSED_TRADES_IN_PAYLOAD = 36;

const MODE_CONFIGS: Record<SimulatedPortfolioMode, ModeConfigInternal> = {
  conservative: {
    baseAllocationPct: 9,
    description: "Lower turnover, lower fragility, macro-aware entries. This sleeve prefers cleaner evidence and smaller simulated allocation.",
    label: "Conservative",
    maxAllocationPct: 15,
    maxCurrentPositions: 4,
    maxFragilityScore: 62,
    minModeScore: 61,
    mode: "conservative",
    riskPolicy: "Prioritizes evidence, drawdown control, macro alignment, and lower chase risk.",
    shockWeight: 0.06,
    strategyWeight: 0.15,
  },
  balanced: {
    baseAllocationPct: 11,
    description: "Blends opportunity quality with risk control. This sleeve can hold momentum names when fragility and macro pressure are still manageable.",
    label: "Balanced",
    maxAllocationPct: 18,
    maxCurrentPositions: 5,
    maxFragilityScore: 74,
    minModeScore: 55,
    mode: "balanced",
    riskPolicy: "Balances strategy quality, macro context, reward/risk, and fragility.",
    shockWeight: 0.11,
    strategyWeight: 0.17,
  },
  aggressive: {
    baseAllocationPct: 12,
    description: "Higher-volatility research sleeve. This mode allows stronger shock and momentum exposure, but caps position size when fragility is extreme.",
    label: "Aggressive",
    maxAllocationPct: 22,
    maxCurrentPositions: 6,
    maxFragilityScore: 88,
    minModeScore: 49,
    mode: "aggressive",
    riskPolicy: "Accepts higher volatility for stronger upside and shock evidence, while preserving chase-risk warnings.",
    shockWeight: 0.20,
    strategyWeight: 0.16,
  },
};

export function buildSimulatedAiPortfolioSystem(input: SimulatedAiPortfolioInput): SimulatedAiPortfolioSystem {
  const startingCapital = positiveNumber(input.startingCapital) ?? STARTING_CAPITAL;
  const observations = dedupeObservations((input.forwardRows ?? []).map((row, index) => observationFromRow(row, index)).filter((row): row is SimulationObservation => row !== null));
  const primaryHorizon = primaryHorizonFor(observations);
  const horizonObservations = observations.filter((row) => row.horizon === primaryHorizon);
  const benchmarkReturnPct = meanOrNull(horizonObservations.map((row) => row.returnPct));
  const performanceByFamily = new Map((input.strategySystem?.bestStrategies ?? []).map((row) => [row.family, row]));
  for (const row of input.strategySystem?.deterioratingStrategies ?? []) {
    if (!performanceByFamily.has(row.family)) performanceByFamily.set(row.family, row);
  }

  const modes = Object.fromEntries((Object.keys(MODE_CONFIGS) as SimulatedPortfolioMode[]).map((mode) => {
    const config = MODE_CONFIGS[mode];
    const result = buildModeResult({
      benchmarkReturnPct,
      config,
      observations: horizonObservations,
      opportunities: input.opportunities ?? [],
      performanceByFamily,
      startingCapital,
    });
    return [mode, result];
  })) as Record<SimulatedPortfolioMode, SimulatedPortfolioModeResult>;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    limitations: [
      "Strategy Labs is simulation and research only. It does not place broker or paper orders.",
      "Closed-trade performance is computed from completed outcome history, not LLM-generated numbers.",
      "Current model positions are a scanner snapshot; unrealized PnL starts at the current mark and updates only when the simulation is refreshed.",
      "Benchmark comparison uses the same completed evidence horizon as a simple baseline, not a full investable index backtest.",
    ],
    modes,
    primaryHorizon,
    simulationOnly: true,
    startingCapital,
  };
}

function buildModeResult(input: {
  benchmarkReturnPct: number | null;
  config: ModeConfigInternal;
  observations: SimulationObservation[];
  opportunities: OpportunityViewModel[];
  performanceByFamily: Map<StrategyFamily, StrategyPerformanceRow>;
  startingCapital: number;
}): SimulatedPortfolioModeResult {
  const rankedObservations = input.observations
    .map((row) => ({ row, score: modeScoreForObservation(row, input.config, input.performanceByFamily.get(row.family)) }))
    .filter(({ row, score }) => score >= input.config.minModeScore && qualityGate(row, input.config))
    .sort((left, right) => {
      const leftTime = left.row.timeMs ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.row.timeMs ?? Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return right.score - left.score;
    })
    .slice(-MAX_HISTORICAL_TRADES_PER_MODE);

  const simulation = simulateClosedTrades(rankedObservations, input.config, input.benchmarkReturnPct, input.startingCapital);
  const openPositions = currentOpenPositions(input.opportunities, input.config, input.performanceByFamily, input.startingCapital);
  const stats = statsFor({
    benchmarkReturnPct: simulation.benchmarkReturnPct,
    closedTrades: simulation.closedTrades,
    equityCurve: simulation.equityCurve,
    openPositions,
    startingCapital: input.startingCapital,
  });
  const learning = learningSystemFor({
    closedTrades: simulation.closedTrades,
    config: input.config,
    openPositions,
    stats,
  });

  return {
    capitalScenarios: capitalScenariosFor(stats),
    closedTrades: simulation.closedTrades.slice(-MAX_CLOSED_TRADES_IN_PAYLOAD).reverse(),
    config: publicConfig(input.config),
    equityCurve: simulation.equityCurve,
    learning,
    mode: input.config.mode,
    openPositions,
    stats,
    summary: modeSummary(input.config, stats, input.observations.length),
  };
}

function simulateClosedTrades(
  ranked: Array<{ row: SimulationObservation; score: number }>,
  config: ModeConfigInternal,
  benchmarkReturnPct: number | null,
  startingCapital: number,
): {
  benchmarkReturnPct: number | null;
  closedTrades: SimulatedPortfolioClosedTrade[];
  equityCurve: SimulatedPortfolioEquityPoint[];
} {
  let capital = startingCapital;
  let benchmarkCapital = startingCapital;
  const closedTrades: SimulatedPortfolioClosedTrade[] = [];
  const equityCurve: SimulatedPortfolioEquityPoint[] = [{ benchmarkValue: benchmarkCapital, label: "Start", tradeIndex: 0, value: capital }];

  ranked.forEach(({ row, score }, index) => {
    const capitalBefore = capital;
    const allocationPct = allocationPctFor(score, row.fragilityScore, config);
    const investedAmount = capital * (allocationPct / 100);
    const realizedPnl = investedAmount * (row.returnPct / 100);
    const entryPrice = row.entryPrice;
    const exitPrice = entryPrice === null ? null : entryPrice * (1 + row.returnPct / 100);
    const positionUnits = entryPrice === null || entryPrice <= 0 ? null : investedAmount / entryPrice;
    capital += realizedPnl;
    const capitalAfter = capital;
    if (benchmarkReturnPct !== null) {
      benchmarkCapital += benchmarkCapital * (allocationPct / 100) * (benchmarkReturnPct / 100);
    }
    const confidenceAtEntry = confidenceAtEntryFor(score, row, config);
    const confidenceAtExit = confidenceAtExitFor(confidenceAtEntry, row);

    closedTrades.push({
      allocationPct,
      capitalAfter,
      capitalBefore,
      confidenceAtEntry,
      confidenceAtExit,
      drawdownPct: row.drawdownPct,
      entryDate: row.dateLabel,
      entryPrice,
      entryReasons: entryReasonsForObservation(row, score, config),
      eventReason: eventReasonFor(row),
      exitDate: exitDateFor(row),
      exitPrice,
      exitReasons: exitReasonsForObservation(row),
      horizonDays: row.horizonDays,
      id: `${config.mode}:${row.symbol}:${row.dateLabel}:${index}`,
      investedAmount,
      learning: learningForTrade(row, score, config),
      macroReason: macroReasonFor(row),
      modeScore: Math.round(score),
      positionUnits,
      realizedPnl,
      realizedReturnPct: row.returnPct,
      riskRewardReason: riskRewardReasonFor(row),
      riskState: riskStateFor(row, config),
      sector: row.sector,
      strategyFamily: row.family,
      symbol: row.symbol,
    });

    equityCurve.push({
      benchmarkValue: benchmarkCapital,
      label: row.dateLabel,
      tradeIndex: index + 1,
      value: capital,
    });
  });

  return {
    benchmarkReturnPct: benchmarkReturnPct === null ? null : ((benchmarkCapital / startingCapital) - 1) * 100,
    closedTrades,
    equityCurve,
  };
}

function currentOpenPositions(
  opportunities: OpportunityViewModel[],
  config: ModeConfigInternal,
  performanceByFamily: Map<StrategyFamily, StrategyPerformanceRow>,
  startingCapital: number,
): SimulatedPortfolioOpenPosition[] {
  return opportunities
    .map((row) => {
      const family = familyForOpportunity(row);
      const score = modeScoreForOpportunity(row, config, performanceByFamily.get(family));
      return { family, row, score };
    })
    .filter(({ row, score }) => score >= config.minModeScore && currentQualityGate(row, config))
    .sort((left, right) => right.score - left.score || left.row.symbol.localeCompare(right.row.symbol))
    .slice(0, config.maxCurrentPositions)
    .map(({ family, row, score }) => {
      const allocationPct = allocationPctFor(score, row.fragility, config);
      const entryMarkPrice = positiveNumber(row.price);
      const currentPrice = positiveNumber(row.price);
      const investedAmount = startingCapital * (allocationPct / 100);
      const positionUnits = entryMarkPrice === null || entryMarkPrice <= 0 ? null : investedAmount / entryMarkPrice;
      return {
        allocationPct,
        confidenceAtEntry: confidenceAtEntryForOpportunity(row, score, config),
        currentPrice,
        entryMarkPrice,
        entryReasons: entryReasonsForOpportunity(row, score, config, family),
        eventReason: row.eventLabel || "No verified event pressure is driving the model allocation.",
        exitPlan: exitPlanForOpportunity(row),
        investedAmount,
        macroReason: row.macroLabel || "Macro context is mixed.",
        modeScore: Math.round(score),
        positionUnits,
        riskRewardReason: opportunityRiskRewardReason(row),
        riskState: riskStateForOpportunity(row, config),
        sector: normalizedGroup(row.sector ?? row.assetType, "UNKNOWN"),
        strategyFamily: family,
        symbol: row.symbol,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
      };
    });
}

function statsFor(input: {
  benchmarkReturnPct: number | null;
  closedTrades: SimulatedPortfolioClosedTrade[];
  equityCurve: SimulatedPortfolioEquityPoint[];
  openPositions: SimulatedPortfolioOpenPosition[];
  startingCapital: number;
}): SimulatedPortfolioStats {
  const latest = input.equityCurve[input.equityCurve.length - 1]?.value ?? input.startingCapital;
  const realizedPnl = latest - input.startingCapital;
  const returns = input.closedTrades.map((trade) => trade.realizedReturnPct);
  const winRatePct = returns.length ? (returns.filter((value) => value > 0).length / returns.length) * 100 : null;
  const averageHoldDays = meanOrNull(input.closedTrades.map((trade) => trade.horizonDays));
  const volatilityPct = standardDeviationOrNull(returns);
  const maxDrawdownPct = maxDrawdownPctFor(input.equityCurve);
  const simulatedReturnPct = input.startingCapital > 0 ? ((latest / input.startingCapital) - 1) * 100 : null;
  const totalCurrentAllocationPct = input.openPositions.reduce((total, position) => total + position.allocationPct, 0);
  const drawdownPenalty = maxDrawdownPct ?? 0;
  const benchmarkDelta = simulatedReturnPct !== null && input.benchmarkReturnPct !== null ? simulatedReturnPct - input.benchmarkReturnPct : 0;
  const strategyQualityScore = Math.round(clamp(
    46
    + (winRatePct === null ? 0 : (winRatePct - 50) * 0.35)
    + benchmarkDelta * 1.8
    - drawdownPenalty * 1.1
    + Math.min(14, Math.log10(Math.max(1, input.closedTrades.length)) * 8),
  ));

  return {
    averageHoldDays,
    benchmarkReturnPct: input.benchmarkReturnPct,
    cashPct: Math.max(0, 100 - totalCurrentAllocationPct),
    closedTradeCount: input.closedTrades.length,
    maxDrawdownPct,
    realizedPnl,
    simulatedReturnPct,
    startingCapital: input.startingCapital,
    strategyQualityScore,
    totalCurrentAllocationPct,
    unrealizedPnl: input.openPositions.reduce((total, position) => total + position.unrealizedPnl, 0),
    volatilityPct,
    winRatePct,
  };
}

function learningSystemFor(input: {
  closedTrades: SimulatedPortfolioClosedTrade[];
  config: ModeConfigInternal;
  openPositions: SimulatedPortfolioOpenPosition[];
  stats: SimulatedPortfolioStats;
}): SimulatedPortfolioLearningSystem {
  const exposureBuckets = exposureBucketsFor(input.closedTrades, input.openPositions);
  const decisionReview = decisionReviewFor(input.closedTrades, input.openPositions, input.config);
  const learningTimeline = learningTimelineFor(input.closedTrades);
  const confidenceTrend = learningTimeline.map((point) => point.confidenceScore);
  const riskTrend = learningTimeline.map((point) => point.riskScore);
  const allocationTrend = learningTimeline.map((point) => point.allocationPct);
  const heatmap = riskMapFor(input.closedTrades, input.openPositions, input.stats);
  const lessons = lessonsFor(input.closedTrades, input.openPositions, input.stats, input.config);
  const portfolioStories = portfolioStoriesFor(input.closedTrades, input.openPositions, input.stats, input.config);

  return {
    adjustmentSummary: adjustmentSummaryFor(input.closedTrades, input.openPositions, input.stats, input.config),
    allocationTrend,
    confidenceTrend,
    decisionReview,
    exposureBuckets,
    heatmap,
    learningTimeline,
    lessons,
    portfolioStories,
    riskTrend,
  };
}

function capitalScenariosFor(stats: SimulatedPortfolioStats): SimulatedPortfolioCapitalScenario[] {
  return [10_000, 50_000, 100_000].map((startingCapital) => {
    const realizedPnl = stats.simulatedReturnPct === null ? 0 : startingCapital * (stats.simulatedReturnPct / 100);
    const deployedAmount = startingCapital * (stats.totalCurrentAllocationPct / 100);
    return {
      cashAmount: Math.max(0, startingCapital - deployedAmount),
      deployedAmount,
      label: `$${Math.round(startingCapital / 1000)}k model`,
      latestEquity: startingCapital + realizedPnl,
      realizedPnl,
      startingCapital,
    };
  });
}

function confidenceAtEntryFor(score: number, row: SimulationObservation, config: ModeConfigInternal): number {
  const fragilityControl = 100 - (row.fragilityScore ?? 50);
  const macroScore = row.macroAlignmentScore ?? 50;
  const evidenceBonus = config.mode === "conservative" ? 6 : config.mode === "balanced" ? 3 : 0;
  return Math.round(clamp(score * 0.62 + fragilityControl * 0.18 + macroScore * 0.16 + evidenceBonus));
}

function confidenceAtEntryForOpportunity(row: OpportunityViewModel, score: number, config: ModeConfigInternal): number {
  const fragilityControl = 100 - row.fragility;
  const macroScore = scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score) ?? 50;
  const evidenceScore = row.evidence?.confidenceReliability ?? row.evidence?.analogQualityScore ?? 50;
  const evidenceBonus = config.mode === "conservative" ? 5 : config.mode === "balanced" ? 3 : 0;
  return Math.round(clamp(score * 0.58 + fragilityControl * 0.17 + macroScore * 0.14 + evidenceScore * 0.08 + evidenceBonus));
}

function confidenceAtExitFor(entryConfidence: number, row: SimulationObservation): number {
  const drawdownPenalty = row.drawdownPct === null ? 0 : Math.abs(row.drawdownPct) * 1.7;
  const volatilityPenalty = Math.max(0, (row.volatilityPressure ?? 50) - 68) * 0.14;
  const outcomeShift = row.returnPct * 2.8;
  return Math.round(clamp(entryConfidence + outcomeShift - drawdownPenalty - volatilityPenalty));
}

function riskStateFor(row: SimulationObservation, config: ModeConfigInternal): string {
  const fragility = row.fragilityScore ?? 50;
  const volatility = row.volatilityPressure ?? 45;
  const liquidity = row.liquidityPressure ?? 45;
  if (fragility > config.maxFragilityScore + 10 || volatility >= 82 || liquidity >= 82) return "Elevated risk";
  if (fragility > config.maxFragilityScore || volatility >= 68 || liquidity >= 68) return "Watch pressure";
  return "Controlled risk";
}

function riskStateForOpportunity(row: OpportunityViewModel, config: ModeConfigInternal): string {
  const volatility = scoreValue(row.raw.volatility_pressure) ?? row.fragility;
  const liquidity = scoreValue(row.raw.liquidity_pressure) ?? 45;
  if (row.fragility > config.maxFragilityScore + 10 || volatility >= 82 || liquidity >= 82) return "Elevated risk";
  if (row.fragility > config.maxFragilityScore || volatility >= 68 || liquidity >= 68) return "Watch pressure";
  return "Controlled risk";
}

function learningForTrade(row: SimulationObservation, score: number, config: ModeConfigInternal): SimulatedPortfolioTradeLearning {
  const drawdown = Math.abs(row.drawdownPct ?? 0);
  if (row.returnPct > 2 && drawdown <= 4 && (row.macroAlignmentScore ?? 50) >= 60) {
    return {
      adjustment: "Keep weighting clean macro-aligned entries when drawdown stays contained.",
      lesson: `${strategyFamilyLabel(row.family)} worked because outcome strength appeared without meaningful adverse pressure.`,
      outcomeLabel: "Clean follow-through",
      review: "improved",
      tone: "good",
    };
  }
  if (row.returnPct > 0 && drawdown > 6) {
    return {
      adjustment: "Require better entry patience for similar setups before increasing allocation.",
      lesson: "The sample ended positive, but adverse movement made the path fragile.",
      outcomeLabel: "Reward with stress",
      review: "contained",
      tone: "warn",
    };
  }
  if (row.returnPct <= 0 && (row.macroAlignmentScore ?? 50) <= 45) {
    return {
      adjustment: "Reduce future exposure when macro support is weak at entry.",
      lesson: "The failed sample aligned with weak macro context and lower confirmation quality.",
      outcomeLabel: "Macro conflict",
      review: "failed",
      tone: "risk",
    };
  }
  if (row.returnPct <= 0 && (row.fragilityScore ?? 50) > config.maxFragilityScore) {
    return {
      adjustment: "Tighten the fragility cap for comparable momentum entries.",
      lesson: "The trade entered with more fragility than this sleeve should normally tolerate.",
      outcomeLabel: "Fragility too high",
      review: "deteriorated",
      tone: "risk",
    };
  }
  if (score >= config.minModeScore + 12 && row.returnPct > 0) {
    return {
      adjustment: "Preserve the score gate; it captured useful completed evidence in this sample.",
      lesson: "The entry met the mode threshold and produced positive follow-through.",
      outcomeLabel: "Threshold worked",
      review: "improved",
      tone: "good",
    };
  }
  return {
    adjustment: "Keep this pattern in observation mode until evidence quality improves.",
    lesson: "The result was mixed enough that the strategy should not become more aggressive.",
    outcomeLabel: "Mixed evidence",
    review: "contained",
    tone: "neutral",
  };
}

function exposureBucketsFor(
  closedTrades: SimulatedPortfolioClosedTrade[],
  openPositions: SimulatedPortfolioOpenPosition[],
): SimulatedPortfolioExposureBucket[] {
  const sectorBuckets = bucketClosedTrades(closedTrades, "sector", (trade) => humanLabel(trade.sector));
  const strategyBuckets = bucketClosedTrades(closedTrades, "strategy", (trade) => strategyFamilyLabel(trade.strategyFamily));
  const riskBuckets = bucketOpenPositions(openPositions);
  return [...sectorBuckets.slice(0, 5), ...strategyBuckets.slice(0, 5), ...riskBuckets.slice(0, 4)];
}

function bucketClosedTrades(
  trades: SimulatedPortfolioClosedTrade[],
  type: "sector" | "strategy",
  labelFor: (trade: SimulatedPortfolioClosedTrade) => string,
): SimulatedPortfolioExposureBucket[] {
  const buckets = new Map<string, { invested: number; pnl: number; symbols: Set<string> }>();
  for (const trade of trades) {
    const label = labelFor(trade);
    const existing = buckets.get(label) ?? { invested: 0, pnl: 0, symbols: new Set<string>() };
    existing.invested += trade.investedAmount;
    existing.pnl += trade.realizedPnl;
    existing.symbols.add(trade.symbol);
    buckets.set(label, existing);
  }
  const totalInvested = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.invested, 0);
  return Array.from(buckets.entries())
    .map(([label, bucket]) => {
      const returnPct = bucket.invested > 0 ? (bucket.pnl / bucket.invested) * 100 : null;
      const tone: SimulatedPortfolioTone = returnPct === null ? "neutral" : returnPct >= 1 ? "good" : returnPct < 0 ? "risk" : "warn";
      return {
        allocationPct: totalInvested > 0 ? (bucket.invested / totalInvested) * 100 : 0,
        label,
        pnl: bucket.pnl,
        returnPct,
        symbolCount: bucket.symbols.size,
        tone,
        type,
      };
    })
    .sort((left, right) => Math.abs(right.pnl) - Math.abs(left.pnl) || right.allocationPct - left.allocationPct);
}

function bucketOpenPositions(openPositions: SimulatedPortfolioOpenPosition[]): SimulatedPortfolioExposureBucket[] {
  const buckets = new Map<string, { allocationPct: number; symbols: Set<string> }>();
  for (const position of openPositions) {
    const existing = buckets.get(position.riskState) ?? { allocationPct: 0, symbols: new Set<string>() };
    existing.allocationPct += position.allocationPct;
    existing.symbols.add(position.symbol);
    buckets.set(position.riskState, existing);
  }
  return Array.from(buckets.entries())
    .map(([label, bucket]) => ({
      allocationPct: bucket.allocationPct,
      label,
      pnl: 0,
      returnPct: null,
      symbolCount: bucket.symbols.size,
      tone: label.includes("Elevated") ? "risk" as const : label.includes("Watch") ? "warn" as const : "good" as const,
      type: "risk" as const,
    }))
    .sort((left, right) => right.allocationPct - left.allocationPct);
}

function decisionReviewFor(
  closedTrades: SimulatedPortfolioClosedTrade[],
  openPositions: SimulatedPortfolioOpenPosition[],
  config: ModeConfigInternal,
): SimulatedPortfolioDecisionReview {
  const best = maxBy(closedTrades, (trade) => trade.realizedReturnPct);
  const worst = minBy(closedTrades, (trade) => trade.realizedReturnPct);
  const unnecessaryRisk = maxBy(closedTrades, (trade) => riskPenaltyForTrade(trade));
  const strongestExit = maxBy(closedTrades, (trade) => trade.confidenceAtExit - trade.confidenceAtEntry);
  const weakestExit = minBy(closedTrades, (trade) => trade.confidenceAtExit - trade.confidenceAtEntry);
  const patience = closedTrades
    .filter((trade) => trade.learning.tone === "good" && trade.allocationPct <= config.baseAllocationPct + 2)
    .sort((left, right) => right.realizedReturnPct - left.realizedReturnPct)[0] ?? best;
  const missed = openPositions
    .slice()
    .sort((left, right) => right.confidenceAtEntry - left.confidenceAtEntry || left.allocationPct - right.allocationPct)[0] ?? null;

  return {
    bestDecision: reviewItemFromTrade("Strongest decision", best, "Highest completed simulated return.", "good"),
    missedOpportunity: missed
      ? {
          detail: `${missed.symbol} clears the current ${config.label} gate but remains bounded at ${missed.allocationPct.toFixed(1)}% allocation because risk controls still apply.`,
          label: "Best current candidate",
          symbol: missed.symbol,
          tone: missed.riskState.includes("Elevated") ? "warn" : "good",
          value: `${missed.confidenceAtEntry}/100`,
        }
      : limitedReviewItem("Best current candidate", "No current model position clears this sleeve's gate."),
    patienceWin: reviewItemFromTrade("Patience win", patience, "Lower allocation still captured follow-through.", "good"),
    strongestExit: reviewItemFromTrade("Best exit review", strongestExit, "Confidence improved across the completed window.", "good"),
    unnecessaryRisk: reviewItemFromTrade("Unnecessary risk", unnecessaryRisk, "Largest adverse pressure relative to outcome.", "warn"),
    weakestDecision: reviewItemFromTrade("Weakest decision", worst, "Lowest completed simulated return.", "risk"),
    weakestExit: reviewItemFromTrade("Worst exit review", weakestExit, "Confidence deteriorated across the completed window.", "risk"),
  };
}

function learningTimelineFor(closedTrades: SimulatedPortfolioClosedTrade[]): SimulatedPortfolioLearningTimelinePoint[] {
  if (!closedTrades.length) return [];
  const ordered = closedTrades.slice().sort((left, right) => Date.parse(left.exitDate) - Date.parse(right.exitDate));
  const step = Math.max(1, Math.floor(ordered.length / 8));
  return ordered
    .filter((_, index) => index % step === 0 || index === ordered.length - 1)
    .slice(-9)
    .map((trade) => ({
      allocationPct: trade.allocationPct,
      confidenceScore: trade.confidenceAtExit,
      date: trade.exitDate,
      label: `${trade.symbol} ${trade.learning.outcomeLabel}`,
      riskScore: riskScoreForTrade(trade),
      summary: `${trade.learning.lesson} ${trade.learning.adjustment}`,
      tone: trade.learning.tone,
    }));
}

function riskMapFor(
  closedTrades: SimulatedPortfolioClosedTrade[],
  openPositions: SimulatedPortfolioOpenPosition[],
  stats: SimulatedPortfolioStats,
): SimulatedPortfolioRiskMapCell[] {
  const avgEntryConfidence = meanOrNull(closedTrades.map((trade) => trade.confidenceAtEntry));
  const avgExitConfidence = meanOrNull(closedTrades.map((trade) => trade.confidenceAtExit));
  const elevatedOpenAllocation = openPositions
    .filter((position) => position.riskState !== "Controlled risk")
    .reduce((sum, position) => sum + position.allocationPct, 0);
  const lossRate = closedTrades.length ? (closedTrades.filter((trade) => trade.realizedReturnPct < 0).length / closedTrades.length) * 100 : null;
  const learningImprovement = avgEntryConfidence === null || avgExitConfidence === null ? null : clamp(50 + (avgExitConfidence - avgEntryConfidence));
  return [
    {
      detail: "Average simulated confidence at entry.",
      label: "Entry confidence",
      tone: toneForScore(avgEntryConfidence),
      value: avgEntryConfidence,
    },
    {
      detail: "Average simulated confidence after completed evidence window.",
      label: "Exit confidence",
      tone: toneForScore(avgExitConfidence),
      value: avgExitConfidence,
    },
    {
      detail: "Quality score derived from return, drawdown, benchmark delta, and evidence count.",
      label: "Strategy quality",
      tone: toneForScore(stats.strategyQualityScore),
      value: stats.strategyQualityScore,
    },
    {
      detail: "Open model allocation in non-controlled risk states.",
      label: "Open pressure",
      tone: elevatedOpenAllocation >= 35 ? "risk" : elevatedOpenAllocation >= 15 ? "warn" : "good",
      value: elevatedOpenAllocation,
    },
    {
      detail: "Completed simulated trades with negative return.",
      label: "Failure rate",
      tone: lossRate === null ? "neutral" : lossRate >= 45 ? "risk" : lossRate >= 28 ? "warn" : "good",
      value: lossRate,
    },
    {
      detail: "Confidence change from entry to exit across completed evidence.",
      label: "Learning drift",
      tone: toneForScore(learningImprovement),
      value: learningImprovement,
    },
  ];
}

function lessonsFor(
  closedTrades: SimulatedPortfolioClosedTrade[],
  openPositions: SimulatedPortfolioOpenPosition[],
  stats: SimulatedPortfolioStats,
  config: ModeConfigInternal,
): string[] {
  if (!closedTrades.length) {
    return [
      `${config.label} mode needs completed qualifying trades before the learning engine can revise behavior.`,
      "Current model candidates remain bounded by scanner quality, fragility, and macro alignment.",
      "No simulated real-money or broker activity is performed.",
    ];
  }
  const worst = minBy(closedTrades, (trade) => trade.realizedReturnPct);
  const best = maxBy(closedTrades, (trade) => trade.realizedReturnPct);
  const elevatedOpen = openPositions.filter((position) => position.riskState !== "Controlled risk");
  const benchmarkDelta = stats.simulatedReturnPct !== null && stats.benchmarkReturnPct !== null ? stats.simulatedReturnPct - stats.benchmarkReturnPct : null;
  const lessons = [
    best ? `${best.symbol} shows the strongest completed behavior: ${best.learning.adjustment}` : null,
    worst ? `${worst.symbol} shows the weakest completed behavior: ${worst.learning.adjustment}` : null,
    benchmarkDelta === null
      ? "Benchmark comparison remains limited for this evidence window."
      : benchmarkDelta >= 0
        ? `The sleeve outpaced its completed-evidence benchmark by ${formatPct(benchmarkDelta)}, so the gate remains valid but still simulated.`
        : `The sleeve trailed its completed-evidence benchmark by ${formatPct(benchmarkDelta)}, so future entries should demand cleaner confirmation.`,
    (stats.maxDrawdownPct ?? 0) >= 8
      ? "Drawdown pressure is high enough that future allocations should be reduced in similar volatility regimes."
      : "Drawdown stayed contained enough that risk controls did not need to become more restrictive.",
    elevatedOpen.length
      ? `${elevatedOpen.length} current model position(s) carry watch/elevated pressure, so the lab keeps cash available.`
      : "Current model positions are not concentrated in elevated risk states.",
  ].filter((item): item is string => item !== null);
  return lessons.slice(0, 6);
}

function portfolioStoriesFor(
  closedTrades: SimulatedPortfolioClosedTrade[],
  openPositions: SimulatedPortfolioOpenPosition[],
  stats: SimulatedPortfolioStats,
  config: ModeConfigInternal,
): string[] {
  const deployed = openPositions.reduce((sum, position) => sum + position.allocationPct, 0);
  const dominantSector = dominantOpenSector(openPositions);
  return [
    `${config.label} mode reviewed ${closedTrades.length.toLocaleString()} completed simulated trade(s) and currently deploys ${deployed.toFixed(1)}% of model capital.`,
    dominantSector === null
      ? "No dominant current sector exposure is visible in this sleeve."
      : `${dominantSector.label} is the largest current model exposure at ${dominantSector.allocationPct.toFixed(1)}% of simulated capital.`,
    stats.simulatedReturnPct === null
      ? "Return evidence is not yet mature enough for a meaningful portfolio story."
      : `Capital evolved from ${formatMoney(stats.startingCapital)} to ${formatMoney(stats.startingCapital + stats.realizedPnl)} across the completed evidence window.`,
  ];
}

function adjustmentSummaryFor(
  closedTrades: SimulatedPortfolioClosedTrade[],
  openPositions: SimulatedPortfolioOpenPosition[],
  stats: SimulatedPortfolioStats,
  config: ModeConfigInternal,
): string {
  if (!closedTrades.length) {
    return `${config.label} mode is waiting for completed evidence before revising future behavior. Current candidates remain observation-only.`;
  }
  if ((stats.maxDrawdownPct ?? 0) >= 10) {
    return `${config.label} mode is reducing future aggression in comparable volatility regimes because drawdown pressure exceeded the risk comfort zone.`;
  }
  if ((stats.winRatePct ?? 0) >= 58 && (stats.simulatedReturnPct ?? 0) > (stats.benchmarkReturnPct ?? -100)) {
    return `${config.label} mode keeps its current gate because completed evidence shows useful follow-through with controlled risk.`;
  }
  if (openPositions.some((position) => position.riskState === "Elevated risk")) {
    return `${config.label} mode is preserving a larger cash buffer because current candidates include elevated risk states.`;
  }
  return `${config.label} mode remains balanced: it preserves the score gate, keeps allocation bounded, and waits for stronger evidence before increasing exposure.`;
}

function reviewItemFromTrade(
  label: string,
  trade: SimulatedPortfolioClosedTrade | null,
  fallbackDetail: string,
  fallbackTone: SimulatedPortfolioTone,
): SimulatedPortfolioReviewItem {
  if (!trade) return limitedReviewItem(label, "No completed trade is available for this review slot.");
  return {
    detail: `${fallbackDetail} ${trade.learning.lesson} ${trade.learning.adjustment}`,
    label,
    symbol: trade.symbol,
    tone: trade.learning.tone === "neutral" ? fallbackTone : trade.learning.tone,
    value: formatPct(trade.realizedReturnPct),
  };
}

function limitedReviewItem(label: string, detail: string): SimulatedPortfolioReviewItem {
  return {
    detail,
    label,
    symbol: null,
    tone: "neutral",
    value: "Limited",
  };
}

function riskPenaltyForTrade(trade: SimulatedPortfolioClosedTrade): number {
  const drawdown = Math.abs(trade.drawdownPct ?? 0);
  const lossPenalty = trade.realizedReturnPct < 0 ? Math.abs(trade.realizedReturnPct) * 3 : 0;
  return drawdown * 2 + lossPenalty + trade.allocationPct * 0.35;
}

function riskScoreForTrade(trade: SimulatedPortfolioClosedTrade): number {
  const drawdown = Math.abs(trade.drawdownPct ?? 0);
  const lossPenalty = trade.realizedReturnPct < 0 ? Math.abs(trade.realizedReturnPct) * 2 : 0;
  return Math.round(clamp(35 + drawdown * 4 + lossPenalty + Math.max(0, trade.allocationPct - 12) * 1.2));
}

function toneForScore(score: number | null): SimulatedPortfolioTone {
  if (score === null || !Number.isFinite(score)) return "neutral";
  if (score >= 70) return "good";
  if (score >= 52) return "warn";
  return "risk";
}

function dominantOpenSector(openPositions: SimulatedPortfolioOpenPosition[]): { allocationPct: number; label: string } | null {
  const sectors = new Map<string, number>();
  for (const position of openPositions) {
    const label = humanLabel(position.sector);
    sectors.set(label, (sectors.get(label) ?? 0) + position.allocationPct);
  }
  return Array.from(sectors.entries())
    .map(([label, allocationPct]) => ({ allocationPct, label }))
    .sort((left, right) => right.allocationPct - left.allocationPct)[0] ?? null;
}

function maxBy<T>(values: T[], selector: (value: T) => number): T | null {
  let best: T | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const score = selector(value);
    if (!Number.isFinite(score) || score <= bestScore) continue;
    best = value;
    bestScore = score;
  }
  return best;
}

function minBy<T>(values: T[], selector: (value: T) => number): T | null {
  let best: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const score = selector(value);
    if (!Number.isFinite(score) || score >= bestScore) continue;
    best = value;
    bestScore = score;
  }
  return best;
}

function observationFromRow(row: CsvRow, index: number): SimulationObservation | null {
  const returnPct = percentValue(row.return_pct ?? row.forward_return ?? row.return);
  if (returnPct === null) return null;
  const symbol = normalizedGroup(row.symbol, "");
  if (!symbol) return null;
  const setupType = normalizedGroup(row.setup_type, "UNKNOWN");
  const eventSignature = normalizedGroup(row.verified_event_signature ?? row.macro_event_regime_signature ?? row.event_context_label, "UNKNOWN");
  const marketRegime = normalizedGroup(row.market_regime ?? row.macro_context_label ?? row.regime, "UNKNOWN");
  const sector = normalizedGroup(row.sector ?? row.asset_type, "UNKNOWN");
  const finalScore = scoreValue(row.final_score_adjusted ?? row.macro_adjusted_score ?? row.final_score ?? row.score);
  const fragilityScore = scoreValue(row.fragility_score ?? row.fragility ?? row.risk_score ?? row.event_risk_score);
  const macroAlignmentScore = scoreValue(row.macro_alignment_score ?? row.macro_score);
  const volatilityPressure = scoreValue(row.volatility_pressure);
  const liquidityPressure = scoreValue(row.liquidity_pressure);
  const riskReward = positiveNumber(row.risk_reward ?? row.reward_risk_score ?? row.asymmetry_ratio);
  const shockScore = scoreValue(row.upside_shock_score ?? row.shock_score ?? row.opportunity_score ?? row.asymmetry_score);
  const eventRiskScore = scoreValue(row.event_risk_score ?? row.verified_event_pressure_score);
  const horizon = normalizedHorizon(row.horizon);
  const horizonDays = horizonDaysFor(horizon);
  const timeMs = timeMsFor(row.signal_timestamp ?? row.timestamp_utc ?? row.created_at ?? row.scan_date ?? row.date ?? row.last_updated ?? row.last_updated_utc);
  const dateLabel = dateLabelFor(timeMs, index);
  const family = classifyFamily({ eventSignature, finalScore, fragilityScore, macroAlignmentScore, marketRegime, returnPct, sector, setupType, volatilityPressure });
  return {
    dateLabel,
    drawdownPct: percentValue(row.max_drawdown_after_signal ?? row.max_drawdown ?? row.drawdown),
    entryPrice: positiveNumber(row.entry_price ?? row.price ?? row.close),
    eventRiskScore,
    eventSignature,
    family,
    finalScore,
    fragilityScore,
    horizon,
    horizonDays,
    liquidityPressure,
    macroAlignmentScore,
    marketRegime,
    returnPct,
    riskReward,
    sector,
    setupType,
    shockScore,
    symbol,
    timeMs,
    volatilityPressure,
  };
}

function dedupeObservations(rows: SimulationObservation[]): SimulationObservation[] {
  const seen = new Set<string>();
  const deduped: SimulationObservation[] = [];
  for (const row of rows) {
    const key = `${row.symbol}:${row.dateLabel}:${row.horizon}:${row.setupType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function modeScoreForObservation(row: SimulationObservation, config: ModeConfigInternal, performance?: StrategyPerformanceRow): number {
  const finalScore = row.finalScore ?? 50;
  const macroScore = row.macroAlignmentScore ?? 50;
  const fragilityControl = 100 - (row.fragilityScore ?? 50);
  const strategyScore = performance?.strategyQualityScore ?? 50;
  const rewardScore = rewardScoreFor(row.riskReward, row.shockScore);
  const evidenceScore = performance ? Math.min(88, 42 + Math.log10(Math.max(1, performance.sampleCount)) * 18) : 45;
  const liquidityPenalty = Math.max(0, (row.liquidityPressure ?? 45) - 68) * 0.16;
  const volatilityPenalty = config.mode === "aggressive" ? Math.max(0, (row.volatilityPressure ?? 45) - 88) * 0.10 : Math.max(0, (row.volatilityPressure ?? 45) - 70) * 0.22;
  const fragilityPenalty = Math.max(0, (row.fragilityScore ?? 50) - config.maxFragilityScore) * (config.mode === "aggressive" ? 0.18 : 0.42);

  if (config.mode === "conservative") {
    return clamp(finalScore * 0.28 + macroScore * 0.20 + fragilityControl * 0.25 + strategyScore * config.strategyWeight + evidenceScore * 0.08 + rewardScore * config.shockWeight - liquidityPenalty - volatilityPenalty - fragilityPenalty);
  }
  if (config.mode === "balanced") {
    return clamp(finalScore * 0.27 + macroScore * 0.16 + fragilityControl * 0.18 + strategyScore * config.strategyWeight + evidenceScore * 0.07 + rewardScore * 0.15 + (row.shockScore ?? 50) * config.shockWeight - liquidityPenalty - volatilityPenalty - fragilityPenalty);
  }
  return clamp(finalScore * 0.20 + macroScore * 0.12 + fragilityControl * 0.12 + strategyScore * config.strategyWeight + rewardScore * 0.20 + (row.shockScore ?? 50) * config.shockWeight + evidenceScore * 0.04 - liquidityPenalty - volatilityPenalty - fragilityPenalty);
}

function modeScoreForOpportunity(row: OpportunityViewModel, config: ModeConfigInternal, performance?: StrategyPerformanceRow): number {
  const finalScore = row.final_score ?? 50;
  const macroScore = scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score) ?? (row.macroLabel.toLowerCase().includes("aligned") ? 68 : 50);
  const fragilityControl = 100 - row.fragility;
  const strategyScore = performance?.strategyQualityScore ?? 50;
  const shockScore = row.shockPattern?.upsideShockScore ?? row.shockPattern?.opportunityScore ?? 50;
  const rewardScore = rewardScoreFor(positiveNumber(row.raw.risk_reward), shockScore);
  const evidenceScore = row.evidence?.confidenceReliability ?? row.evidence?.analogQualityScore ?? 50;
  const chasePenalty = Math.max(0, (row.shockPattern?.chaseRiskScore ?? 45) - 70) * (config.mode === "aggressive" ? 0.16 : 0.36);
  const fragilityPenalty = Math.max(0, row.fragility - config.maxFragilityScore) * (config.mode === "aggressive" ? 0.20 : 0.50);

  if (config.mode === "conservative") {
    return clamp(finalScore * 0.30 + macroScore * 0.18 + fragilityControl * 0.25 + strategyScore * config.strategyWeight + evidenceScore * 0.08 + rewardScore * config.shockWeight - chasePenalty - fragilityPenalty);
  }
  if (config.mode === "balanced") {
    return clamp(finalScore * 0.27 + macroScore * 0.16 + fragilityControl * 0.17 + strategyScore * config.strategyWeight + evidenceScore * 0.07 + rewardScore * 0.14 + shockScore * config.shockWeight - chasePenalty - fragilityPenalty);
  }
  return clamp(finalScore * 0.20 + macroScore * 0.12 + fragilityControl * 0.10 + strategyScore * config.strategyWeight + rewardScore * 0.19 + shockScore * config.shockWeight + evidenceScore * 0.04 - chasePenalty - fragilityPenalty);
}

function qualityGate(row: SimulationObservation, config: ModeConfigInternal): boolean {
  if (!row.symbol || row.symbol === "UNKNOWN") return false;
  if (row.finalScore !== null && row.finalScore < 28) return false;
  if (row.fragilityScore !== null && row.fragilityScore > config.maxFragilityScore + 16) return false;
  if (row.liquidityPressure !== null && row.liquidityPressure >= 92) return false;
  if (row.volatilityPressure !== null && config.mode !== "aggressive" && row.volatilityPressure >= 92) return false;
  return true;
}

function currentQualityGate(row: OpportunityViewModel, config: ModeConfigInternal): boolean {
  if (!row.symbol || row.symbol === "N/A") return false;
  if ((row.final_score ?? 0) < 28) return false;
  if (row.fragility > config.maxFragilityScore + 16) return false;
  const liquidityPressure = scoreValue(row.raw.liquidity_pressure);
  if (liquidityPressure !== null && liquidityPressure >= 92) return false;
  return true;
}

function allocationPctFor(score: number, fragilityScore: number | null, config: ModeConfigInternal): number {
  const fragility = fragilityScore ?? 50;
  const scoreBonus = Math.max(0, score - config.minModeScore) * 0.18;
  const fragilityReduction = Math.max(0, fragility - config.maxFragilityScore) * 0.08;
  return round1(clamp(config.baseAllocationPct + scoreBonus - fragilityReduction, 4, config.maxAllocationPct));
}

function familyForOpportunity(row: OpportunityViewModel): StrategyFamily {
  const returnPct = percentValue(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0;
  return classifyFamily({
    eventSignature: normalizedGroup(row.raw.verified_event_signature ?? row.raw.macro_event_regime_signature ?? row.eventLabel, "UNKNOWN"),
    finalScore: row.final_score,
    fragilityScore: row.fragility,
    macroAlignmentScore: scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score),
    marketRegime: normalizedGroup(row.raw.market_regime ?? row.raw.macro_context_label ?? row.macroLabel, "UNKNOWN"),
    returnPct,
    sector: normalizedGroup(row.sector ?? row.assetType, "UNKNOWN"),
    setupType: normalizedGroup(row.raw.setup_type, "UNKNOWN"),
    volatilityPressure: scoreValue(row.raw.volatility_pressure),
  });
}

function classifyFamily(input: {
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

function entryReasonsForObservation(row: SimulationObservation, score: number, config: ModeConfigInternal): string[] {
  const reasons = [`${config.label} mode score ${Math.round(score)}/100 met the simulated entry threshold.`];
  reasons.push(`${strategyFamilyLabel(row.family)} matched completed historical evidence.`);
  if ((row.finalScore ?? 0) >= 68) reasons.push("Scanner score was strong at the time of the simulated entry.");
  if ((row.macroAlignmentScore ?? 50) >= 62) reasons.push("Macro context was supportive enough for this mode.");
  if ((row.fragilityScore ?? 50) <= config.maxFragilityScore) reasons.push("Fragility stayed within this mode's risk cap.");
  if ((row.shockScore ?? 0) >= 68) reasons.push("Shock/asymmetry evidence supported the setup.");
  return reasons.slice(0, 5);
}

function entryReasonsForOpportunity(row: OpportunityViewModel, score: number, config: ModeConfigInternal, family: StrategyFamily): string[] {
  const reasons = [`${config.label} model allocation score is ${Math.round(score)}/100.`];
  reasons.push(`${strategyFamilyLabel(family)} is the current strategy fit.`);
  if ((row.final_score ?? 0) >= 68) reasons.push("Current scanner quality is above the model threshold.");
  if (row.fragility <= config.maxFragilityScore) reasons.push("Fragility is acceptable for this mode.");
  if ((row.shockPattern?.opportunityScore ?? 0) >= 68) reasons.push("Historical shock behavior supports monitoring this symbol.");
  if (row.entryZoneLabel) reasons.push(`Research entry context: ${row.entryZoneLabel}.`);
  return reasons.slice(0, 5);
}

function exitReasonsForObservation(row: SimulationObservation): string[] {
  const reasons = [`Simulated exit occurred after the completed ${row.horizon} evidence window.`];
  if (row.returnPct > 0) reasons.push("Forward outcome was positive in the historical sample.");
  if (row.returnPct <= 0) reasons.push("Forward outcome failed or reversed in the historical sample.");
  if (row.drawdownPct !== null && Math.abs(row.drawdownPct) >= 5) reasons.push("Drawdown tracking flagged meaningful adverse movement before or during the window.");
  return reasons;
}

function exitPlanForOpportunity(row: OpportunityViewModel): string {
  if ((row.shockPattern?.chaseRiskScore ?? 0) >= 70) return "Avoid chasing extension; wait for pullback or confirmation before this model would increase exposure.";
  if (row.stop_loss !== null) return `Invalidation area is near ${formatMoney(row.stop_loss)}. The model exits if structure breaks that area.`;
  if (row.target !== null) return `Historical exit context is near ${formatMoney(row.target)} if follow-through appears.`;
  return "Exit is governed by deterioration in entry quality, macro context, or fragility.";
}

function macroReasonFor(row: SimulationObservation): string {
  const score = row.macroAlignmentScore;
  if (score === null) return "Macro context was limited in this historical sample.";
  if (score >= 66) return "Macro alignment was supportive at the simulated entry.";
  if (score <= 42) return "Macro alignment was a headwind at the simulated entry.";
  return "Macro context was mixed at the simulated entry.";
}

function eventReasonFor(row: SimulationObservation): string {
  if (row.eventSignature === "UNKNOWN") return "No verified event signature was attached to this sample.";
  const risk = row.eventRiskScore;
  if (risk !== null && risk >= 65) return `${humanLabel(row.eventSignature)} carried elevated event pressure.`;
  return `${humanLabel(row.eventSignature)} was the verified event context attached to this sample.`;
}

function riskRewardReasonFor(row: SimulationObservation): string {
  if (row.riskReward !== null && row.riskReward >= 2) return "Reward/risk evidence was favorable enough for the simulated entry.";
  if ((row.fragilityScore ?? 0) >= 70) return "Reward/risk needed extra caution because fragility was elevated.";
  return "Reward/risk was treated as research context, not a guaranteed payoff.";
}

function opportunityRiskRewardReason(row: OpportunityViewModel): string {
  const rr = positiveNumber(row.raw.risk_reward);
  if (rr !== null && rr >= 2) return "Research reward/risk is favorable, subject to entry quality.";
  if ((row.shockPattern?.chaseRiskScore ?? 0) >= 70) return "Upside potential exists, but chase risk is elevated.";
  if (row.fragility >= 70) return "Fragility is high; position quality depends on confirmation and tighter risk control.";
  return "Reward/risk is mixed and depends on pullback quality or confirmation.";
}

function modeSummary(config: ModeConfigInternal, stats: SimulatedPortfolioStats, observationCount: number): string {
  if (!stats.closedTradeCount) {
    return `${config.label} mode does not yet have enough qualifying completed evidence in the selected history. It will show model positions only when current scanner quality clears the risk gate.`;
  }
  const relative = stats.benchmarkReturnPct !== null && stats.simulatedReturnPct !== null
    ? stats.simulatedReturnPct - stats.benchmarkReturnPct
    : null;
  const relativeText = relative === null ? "benchmark comparison is limited" : `${formatPct(relative)} versus the completed-evidence benchmark`;
  return `${config.label} simulation used ${stats.closedTradeCount.toLocaleString()} qualifying completed trades from ${observationCount.toLocaleString()} available observations. Return was ${formatPct(stats.simulatedReturnPct)} and ${relativeText}. Read this as proof context, not a recommendation.`;
}

function rewardScoreFor(riskReward: number | null, shockScore: number | null): number {
  const rrScore = riskReward === null ? 50 : clamp(42 + riskReward * 13, 25, 86);
  return clamp(rrScore * 0.62 + (shockScore ?? 50) * 0.38);
}

function publicConfig(config: ModeConfigInternal): SimulatedPortfolioModeConfig {
  return {
    baseAllocationPct: config.baseAllocationPct,
    description: config.description,
    label: config.label,
    maxAllocationPct: config.maxAllocationPct,
    maxCurrentPositions: config.maxCurrentPositions,
    maxFragilityScore: config.maxFragilityScore,
    minModeScore: config.minModeScore,
    riskPolicy: config.riskPolicy,
  };
}

function primaryHorizonFor(rows: SimulationObservation[]): string {
  const preferred = ["10D", "5D", "3D", "2D", "1D", "20D", "60D"];
  for (const horizon of preferred) {
    if (rows.filter((row) => row.horizon === horizon).length >= 20) return horizon;
  }
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.horizon, (counts.get(row.horizon) ?? 0) + 1);
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "UNKNOWN";
}

function maxDrawdownPctFor(points: SimulatedPortfolioEquityPoint[]): number | null {
  if (points.length < 2) return null;
  let peak = points[0]?.value ?? 0;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.value > peak) peak = point.value;
    if (peak <= 0) continue;
    const drawdown = ((peak - point.value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
}

function meanOrNull(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function standardDeviationOrNull(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalizedGroup(value: unknown, fallback: string): string {
  const text = cleanText(value, "").trim();
  if (!text || ["-", "N/A", "NULL", "NONE", "UNDEFINED"].includes(text.toUpperCase())) return fallback;
  return text.toUpperCase().replace(/\s+/g, "_");
}

function humanLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizedHorizon(value: unknown): string {
  const text = normalizedGroup(value, "UNKNOWN");
  if (/^\d+$/.test(text)) return `${text}D`;
  return text;
}

function horizonDaysFor(horizon: string): number {
  const match = horizon.match(/^(\d+)D$/);
  if (!match) return 5;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function timeMsFor(value: unknown): number | null {
  const text = cleanText(value, "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateLabelFor(timeMs: number | null, index: number): string {
  if (timeMs === null) return `Sample ${index + 1}`;
  return new Date(timeMs).toISOString().slice(0, 10);
}

function exitDateFor(row: SimulationObservation): string {
  if (row.timeMs === null) return `${row.dateLabel} + ${row.horizonDays}D`;
  const date = new Date(row.timeMs);
  date.setUTCDate(date.getUTCDate() + row.horizonDays);
  return date.toISOString().slice(0, 10);
}

function scoreValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return clamp(parsed);
}

function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function percentValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 2, style: "currency" });
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
