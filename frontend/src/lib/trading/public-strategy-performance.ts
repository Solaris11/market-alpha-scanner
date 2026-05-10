import type {
  SimulatedAiPortfolioSystem,
  SimulatedPortfolioClosedTrade,
  SimulatedPortfolioEquityPoint,
  SimulatedPortfolioMode,
  SimulatedPortfolioModeResult,
} from "./simulated-ai-portfolio";
import type { StrategyFamily, StrategyIntelligenceSystem, StrategyPerformanceRow } from "./strategy-intelligence";
import { strategyFamilyLabel } from "./strategy-intelligence";

export type PublicStrategyEvidenceLabel =
  | "Limited Evidence"
  | "Developing Evidence"
  | "Mature Evidence"
  | "High Confidence Evidence";

export type PublicStrategyOutcomeLabel = "Worked" | "Failed" | "Mixed";

export type PublicStrategyProofMode = {
  averageHoldDays: number | null;
  benchmarkDeltaPct: number | null;
  benchmarkReturnPct: number | null;
  closedTradeCount: number;
  description: string;
  evidenceLabel: PublicStrategyEvidenceLabel;
  equityCurve: SimulatedPortfolioEquityPoint[];
  label: string;
  maxDrawdownPct: number | null;
  mode: SimulatedPortfolioMode;
  riskPolicy: string;
  simulatedReturnPct: number | null;
  strategyQualityScore: number;
  summary: string;
  trustScore: number;
  volatilityPct: number | null;
  winRatePct: number | null;
};

export type PublicStrategyReplayTrade = {
  allocationPct: number;
  entryDate: string;
  eventReason: string;
  exitDate: string;
  horizonDays: number;
  id: string;
  macroReason: string;
  mode: SimulatedPortfolioMode;
  modeLabel: string;
  modeScore: number;
  outcomeLabel: PublicStrategyOutcomeLabel;
  realizedPnl: number;
  realizedReturnPct: number;
  riskRewardReason: string;
  strategyFamily: StrategyFamily;
  strategyLabel: string;
  symbol: string;
  whyEntered: string[];
  whyExited: string[];
  whyWorkedOrFailed: string;
};

export type PublicStrategyExplanation = {
  alphaScore: number;
  averageReturnPct: number | null;
  evidenceLabel: PublicStrategyEvidenceLabel;
  maxDrawdownPct: number | null;
  qualityScore: number;
  sampleCount: number;
  summary: string;
  title: string;
  tone: "positive" | "neutral" | "caution";
  winRatePct: number | null;
};

export type PublicStrategyPerformanceSystem = {
  generatedAt: string;
  headline: {
    benchmarkDeltaPct: number | null;
    bestModeLabel: string;
    bestTrustScore: number;
    maxDrawdownPct: number | null;
    replayTradeCount: number;
    simulatedReturnPct: number | null;
  };
  limitations: string[];
  modes: PublicStrategyProofMode[];
  primaryHorizon: string;
  replayTrades: PublicStrategyReplayTrade[];
  simulationOnly: true;
  status: "limited" | "ready";
  strategyExplanations: PublicStrategyExplanation[];
  summary: string;
  transparencyNotes: string[];
};

const MODE_ORDER: SimulatedPortfolioMode[] = ["conservative", "balanced", "aggressive"];
const MAX_PUBLIC_REPLAY_TRADES = 16;

export function buildPublicStrategyPerformanceSystem(input: {
  portfolioSystem: SimulatedAiPortfolioSystem;
  strategySystem?: StrategyIntelligenceSystem | null;
}): PublicStrategyPerformanceSystem {
  const modes = MODE_ORDER.map((mode) => publicModeFromResult(input.portfolioSystem.modes[mode]));
  const replayTrades = publicReplayTradesFrom(input.portfolioSystem.modes);
  const strategyExplanations = publicStrategyExplanationsFrom(input.strategySystem);
  const bestMode = [...modes].sort((left, right) => {
    const leftReturn = left.simulatedReturnPct ?? Number.NEGATIVE_INFINITY;
    const rightReturn = right.simulatedReturnPct ?? Number.NEGATIVE_INFINITY;
    return right.trustScore - left.trustScore || rightReturn - leftReturn;
  })[0] ?? modes[0];
  const status = modes.some((mode) => mode.closedTradeCount >= 10) ? "ready" : "limited";

  return {
    generatedAt: input.portfolioSystem.generatedAt,
    headline: {
      benchmarkDeltaPct: bestMode?.benchmarkDeltaPct ?? null,
      bestModeLabel: bestMode?.label ?? "Limited",
      bestTrustScore: bestMode?.trustScore ?? 0,
      maxDrawdownPct: bestMode?.maxDrawdownPct ?? null,
      replayTradeCount: replayTrades.length,
      simulatedReturnPct: bestMode?.simulatedReturnPct ?? null,
    },
    limitations: [
      "Public performance is simulated research only. It is not real-money execution and not financial advice.",
      "Closed trades come from completed forward-return evidence. Future market behavior can differ.",
      "Benchmark comparison uses the same completed evidence horizon as a simple baseline, not a full investable index backtest.",
      "Winning and losing examples are both shown so drawdowns, false positives, and failed trades stay visible.",
      "Current premium opportunities and open model positions are intentionally not published on this public page.",
    ],
    modes,
    primaryHorizon: input.portfolioSystem.primaryHorizon,
    replayTrades,
    simulationOnly: true,
    status,
    strategyExplanations,
    summary: publicText(summaryFor({ bestMode, replayTrades, status })),
    transparencyNotes: [
      "Simulation only",
      "Benchmark comparison included",
      "Drawdown visible",
      "Failed trades included",
      "No current premium trade list",
    ],
  };
}

function publicModeFromResult(result: SimulatedPortfolioModeResult): PublicStrategyProofMode {
  const stats = result.stats;
  const benchmarkDeltaPct = stats.simulatedReturnPct !== null && stats.benchmarkReturnPct !== null
    ? round1(stats.simulatedReturnPct - stats.benchmarkReturnPct)
    : null;
  const evidenceLabel = evidenceLabelFor(stats.closedTradeCount);
  const trustScore = trustScoreFor({
    benchmarkDeltaPct,
    closedTradeCount: stats.closedTradeCount,
    maxDrawdownPct: stats.maxDrawdownPct,
    strategyQualityScore: stats.strategyQualityScore,
  });

  return {
    averageHoldDays: nullableRound1(stats.averageHoldDays),
    benchmarkDeltaPct,
    benchmarkReturnPct: nullableRound1(stats.benchmarkReturnPct),
    closedTradeCount: stats.closedTradeCount,
    description: publicText(result.config.description),
    evidenceLabel,
    equityCurve: result.equityCurve,
    label: result.config.label,
    maxDrawdownPct: nullableRound1(stats.maxDrawdownPct),
    mode: result.mode,
    riskPolicy: publicText(result.config.riskPolicy),
    simulatedReturnPct: nullableRound1(stats.simulatedReturnPct),
    strategyQualityScore: stats.strategyQualityScore,
    summary: publicText(publicSummaryForMode(result, benchmarkDeltaPct, evidenceLabel)),
    trustScore,
    volatilityPct: nullableRound1(stats.volatilityPct),
    winRatePct: nullableRound1(stats.winRatePct),
  };
}

function publicReplayTradesFrom(modes: Record<SimulatedPortfolioMode, SimulatedPortfolioModeResult>): PublicStrategyReplayTrade[] {
  const candidates: PublicStrategyReplayTrade[] = MODE_ORDER.flatMap((mode) => {
    const result = modes[mode];
    return result.closedTrades.map((trade) => publicTradeFrom(trade, mode, result.config.label));
  });
  const selected = new Map<string, PublicStrategyReplayTrade>();
  for (const trade of [...candidates].sort(compareReplayTrades).slice(0, 10)) selected.set(trade.id, trade);
  for (const trade of [...candidates].sort((left, right) => right.realizedReturnPct - left.realizedReturnPct).slice(0, 4)) selected.set(trade.id, trade);
  for (const trade of [...candidates].sort((left, right) => left.realizedReturnPct - right.realizedReturnPct).slice(0, 4)) selected.set(trade.id, trade);
  return [...selected.values()].sort(compareReplayTrades).slice(0, MAX_PUBLIC_REPLAY_TRADES);
}

function publicTradeFrom(trade: SimulatedPortfolioClosedTrade, mode: SimulatedPortfolioMode, modeLabel: string): PublicStrategyReplayTrade {
  const outcomeLabel = outcomeLabelFor(trade.realizedReturnPct);
  return {
    allocationPct: trade.allocationPct,
    entryDate: trade.entryDate,
    eventReason: publicText(trade.eventReason),
    exitDate: trade.exitDate,
    horizonDays: trade.horizonDays,
    id: `${mode}:${trade.id}`,
    macroReason: publicText(trade.macroReason),
    mode,
    modeLabel,
    modeScore: trade.modeScore,
    outcomeLabel,
    realizedPnl: trade.realizedPnl,
    realizedReturnPct: trade.realizedReturnPct,
    riskRewardReason: publicText(trade.riskRewardReason),
    strategyFamily: trade.strategyFamily,
    strategyLabel: strategyFamilyLabel(trade.strategyFamily),
    symbol: trade.symbol,
    whyEntered: trade.entryReasons.map(publicText),
    whyExited: trade.exitReasons.map(publicText),
    whyWorkedOrFailed: publicText(workedOrFailedExplanation(trade, outcomeLabel)),
  };
}

function publicStrategyExplanationsFrom(strategySystem: StrategyIntelligenceSystem | null | undefined): PublicStrategyExplanation[] {
  if (!strategySystem) return [];
  const rows = [...strategySystem.bestStrategies, ...strategySystem.deterioratingStrategies];
  const deduped = new Map<StrategyFamily, StrategyPerformanceRow>();
  for (const row of rows) {
    const existing = deduped.get(row.family);
    if (!existing || row.sampleCount > existing.sampleCount || row.strategyQualityScore > existing.strategyQualityScore) {
      deduped.set(row.family, row);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => right.strategyQualityScore - left.strategyQualityScore || right.alphaScore - left.alphaScore)
    .slice(0, 6)
    .map((row) => ({
      alphaScore: row.alphaScore,
      averageReturnPct: nullableRound1(row.averageReturnPct),
      evidenceLabel: evidenceLabelFor(row.sampleCount),
      maxDrawdownPct: nullableRound1(row.averageDrawdownPct),
      qualityScore: row.strategyQualityScore,
      sampleCount: row.sampleCount,
      summary: publicText(row.summary),
      title: publicText(row.label),
      tone: row.strategyQualityScore >= 68 && row.alphaScore >= 55 ? "positive" : row.downsideRiskScore >= 65 || row.edgeDecayScore >= 65 ? "caution" : "neutral",
      winRatePct: nullableRound1(row.winRatePct),
    }));
}

function summaryFor(input: {
  bestMode: PublicStrategyProofMode | undefined;
  replayTrades: PublicStrategyReplayTrade[];
  status: "limited" | "ready";
}): string {
  if (input.status === "limited" || !input.bestMode) {
    return "Public strategy proof is waiting for more completed forward-return evidence. The page still shows the methodology and available replay samples without filling gaps with synthetic results.";
  }
  const benchmarkText = input.bestMode.benchmarkDeltaPct === null
    ? "benchmark comparison is limited"
    : `${formatSignedPct(input.bestMode.benchmarkDeltaPct)} versus the completed-evidence benchmark`;
  return `${input.bestMode.label} currently has the strongest public proof profile: ${formatSignedPct(input.bestMode.simulatedReturnPct)} simulated return, ${benchmarkText}, and ${formatPct(input.bestMode.maxDrawdownPct)} max drawdown across ${input.bestMode.closedTradeCount.toLocaleString()} closed simulated trades. Replay history includes ${input.replayTrades.length} public examples, including failures.`;
}

function publicSummaryForMode(
  result: SimulatedPortfolioModeResult,
  benchmarkDeltaPct: number | null,
  evidenceLabel: PublicStrategyEvidenceLabel,
): string {
  const benchmarkText = benchmarkDeltaPct === null ? "benchmark comparison is limited" : `${formatSignedPct(benchmarkDeltaPct)} versus the benchmark sample`;
  if (!result.stats.closedTradeCount) {
    return `${result.config.label} does not yet have enough closed simulated evidence for a public proof claim.`;
  }
  return `${result.config.label} used ${result.stats.closedTradeCount.toLocaleString()} closed simulated trades from completed evidence. Return was ${formatSignedPct(result.stats.simulatedReturnPct)}, ${benchmarkText}, with ${evidenceLabel.toLowerCase()}.`;
}

function workedOrFailedExplanation(trade: SimulatedPortfolioClosedTrade, outcomeLabel: PublicStrategyOutcomeLabel): string {
  const family = strategyFamilyLabel(trade.strategyFamily).toLowerCase();
  if (outcomeLabel === "Worked") {
    return `This historical ${family} sample worked because the completed evidence window closed positive. TradeVeto shows it with the original macro, event, and risk/reward context so the result can be replayed instead of treated as a black box.`;
  }
  if (outcomeLabel === "Failed") {
    return `This historical ${family} sample failed or reversed during the completed evidence window. It stays in the public replay so users can see drawdowns and false positives, not only the winners.`;
  }
  return `This historical ${family} sample was mixed. The replay keeps it visible because flat or unclear outcomes matter for trust and calibration.`;
}

function outcomeLabelFor(returnPct: number): PublicStrategyOutcomeLabel {
  if (returnPct >= 0.25) return "Worked";
  if (returnPct <= -0.25) return "Failed";
  return "Mixed";
}

function evidenceLabelFor(sampleCount: number): PublicStrategyEvidenceLabel {
  if (sampleCount >= 100) return "High Confidence Evidence";
  if (sampleCount >= 50) return "Mature Evidence";
  if (sampleCount >= 15) return "Developing Evidence";
  return "Limited Evidence";
}

function trustScoreFor(input: {
  benchmarkDeltaPct: number | null;
  closedTradeCount: number;
  maxDrawdownPct: number | null;
  strategyQualityScore: number;
}): number {
  const sampleScore = Math.min(22, Math.log10(Math.max(1, input.closedTradeCount)) * 11);
  const benchmarkScore = input.benchmarkDeltaPct === null ? 0 : Math.max(-10, Math.min(14, input.benchmarkDeltaPct * 1.15));
  const drawdownPenalty = Math.min(22, (input.maxDrawdownPct ?? 0) * 0.75);
  return Math.round(clamp(36 + sampleScore + input.strategyQualityScore * 0.28 + benchmarkScore - drawdownPenalty));
}

function compareReplayTrades(left: PublicStrategyReplayTrade, right: PublicStrategyReplayTrade): number {
  const leftTime = Date.parse(left.entryDate);
  const rightTime = Date.parse(right.entryDate);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
  return Math.abs(right.realizedReturnPct) - Math.abs(left.realizedReturnPct);
}

function nullableRound1(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return round1(value);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatSignedPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function publicText(value: string): string {
  return value
    .replace(/\bguaranteed\b/gi, "certain")
    .replace(/\bsure profit\b/gi, "certain profit")
    .replace(/\bfree money\b/gi, "risk-free claim")
    .replace(/\bbuy now\b/gi, "act now")
    .replace(/\bsell now\b/gi, "exit now")
    .replace(/\bmust buy\b/gi, "must act")
    .replace(/\bmust sell\b/gi, "must exit");
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
