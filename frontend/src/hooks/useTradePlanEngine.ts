"use client";

import { useMemo, useState } from "react";
import { useRiskProfile, type RiskProfileActions } from "@/hooks/useRiskProfile";
import { buildCorrectionMap, correctionMidpoint, formatCorrectionZone } from "@/lib/trading/correction-map";
import { evaluateRisk, type RiskEvaluation, type RiskPortfolioPosition, type UserRiskProfile } from "@/lib/trading/risk-veto";
import { buildSignalTradeLevels } from "@/lib/trading/signal-lifecycle";
import { rowHasStaleDataSafety, STALE_DATA_ACTION_REASON } from "@/lib/stale-data-safety";
import type { RankingRow } from "@/lib/types";
import { cleanText, formatMoney, formatNumber, normalizeNumeric } from "@/lib/ui/formatters";

const TRADE_READY_DISTANCE_THRESHOLD = 0.02;
const EMPTY_PORTFOLIO: RiskPortfolioPosition[] = [];

export type TradePlanEngineState = {
  accountEquity: number;
  currentPrice: number | null;
  entryPrice: number | null;
  entryStatus: string;
  finalDecision: string;
  riskPercent: number;
  stopLoss: number | null;
  targetPrice: number | null;
};

export type TradePlanEngineMetrics = {
  entryDistancePct: number | null;
  maxRiskAmount: number;
  positionSize: number;
  potentialReward: number | null;
  riskPerShare: number | null;
  riskRewardRatio: number | null;
};

export type TradePlanEngineValidity = {
  isBlocked: boolean;
  isCalculable: boolean;
  isOverextended: boolean;
  isTradeValid: boolean;
  message: string;
};

export type TradePlanEngine = {
  copilotText: string;
  metrics: TradePlanEngineMetrics;
  riskEvaluation: RiskEvaluation;
  riskProfile: UserRiskProfile;
  riskProfileActions: RiskProfileActions;
  setters: {
    setAccountEquity: (value: number) => void;
    setRiskPercent: (value: number) => void;
  };
  state: TradePlanEngineState;
  validity: TradePlanEngineValidity;
};

export function useTradePlanEngine(row: RankingRow, portfolio: RiskPortfolioPosition[] = EMPTY_PORTFOLIO): TradePlanEngine {
  const [accountEquity, setAccountEquityState] = useState(10000);
  const [riskPercent, setRiskPercentState] = useState(2);
  const { actions: riskProfileActions, profile: riskProfile } = useRiskProfile();

  const levels = useMemo(() => buildSignalTradeLevels(row), [row]);
  const state = useMemo<TradePlanEngineState>(() => {
    const hasEntrySource = cleanText(row.suggested_entry ?? row.buy_zone ?? row.entry_zone, "") !== "";
    return {
      accountEquity,
      currentPrice: normalizeNumeric(row.price),
      entryPrice: hasEntrySource ? levels.entry : null,
      entryStatus: cleanText(row.entry_status, "").toUpperCase(),
      finalDecision: cleanText(row.final_decision, "WATCH").toUpperCase(),
      riskPercent,
      stopLoss: levels.stop,
      targetPrice: levels.target,
    };
  }, [accountEquity, levels.entry, levels.stop, levels.target, riskPercent, row.buy_zone, row.entry_status, row.entry_zone, row.final_decision, row.price, row.suggested_entry]);

  const metrics = useMemo<TradePlanEngineMetrics>(() => {
    const maxRiskAmount = safeNonNegative(state.accountEquity) * (safeNonNegative(state.riskPercent) / 100);
    const entryDistancePct = state.currentPrice !== null && state.entryPrice !== null && state.entryPrice > 0 ? (state.currentPrice - state.entryPrice) / state.entryPrice : null;
    const riskPerShare = state.entryPrice !== null && state.stopLoss !== null ? state.entryPrice - state.stopLoss : null;
    const rewardPerShare = state.entryPrice !== null && state.targetPrice !== null ? state.targetPrice - state.entryPrice : null;
    const validRisk = riskPerShare !== null && Number.isFinite(riskPerShare) && riskPerShare > 0;
    const validReward = rewardPerShare !== null && Number.isFinite(rewardPerShare) && rewardPerShare > 0;
    const positionSize = validRisk ? Math.max(0, Math.floor(maxRiskAmount / riskPerShare)) : 0;
    return {
      entryDistancePct,
      maxRiskAmount,
      positionSize,
      potentialReward: validReward ? positionSize * rewardPerShare : null,
      riskPerShare: validRisk ? riskPerShare : null,
      riskRewardRatio: validRisk && validReward ? rewardPerShare / riskPerShare : null,
    };
  }, [state.accountEquity, state.currentPrice, state.entryPrice, state.riskPercent, state.stopLoss, state.targetPrice]);

  const validity = useMemo<TradePlanEngineValidity>(() => {
    const isStaleBlocked = rowHasStaleDataSafety(row);
    const isSystemBlocked = state.finalDecision === "AVOID" || state.finalDecision === "EXIT";
    const isOverextended = state.entryStatus.includes("OVEREXTENDED");
    const hasValidLevels = state.entryPrice !== null && state.stopLoss !== null && state.targetPrice !== null && state.stopLoss < state.entryPrice && state.targetPrice > state.entryPrice;
    const isTradeValid =
      state.finalDecision === "ENTER" ||
      (state.finalDecision === "WAIT_PULLBACK" && metrics.entryDistancePct !== null && metrics.entryDistancePct <= TRADE_READY_DISTANCE_THRESHOLD);

    if (isStaleBlocked) return { isBlocked: true, isCalculable: false, isOverextended, isTradeValid: false, message: cleanText(row.stale_data_safety_reason, STALE_DATA_ACTION_REASON) };
    if (!hasValidLevels) return { isBlocked: isSystemBlocked, isCalculable: false, isOverextended, isTradeValid: false, message: "No clear research setup." };
    if (metrics.positionSize <= 0) return { isBlocked: isSystemBlocked, isCalculable: false, isOverextended, isTradeValid, message: "No clear research setup." };
    if (state.finalDecision === "AVOID") return { isBlocked: true, isCalculable: true, isOverextended, isTradeValid: false, message: "System decision blocks execution for this setup." };
    if (state.finalDecision === "EXIT") return { isBlocked: true, isCalculable: true, isOverextended, isTradeValid: false, message: "System decision blocks execution for this setup." };
    if (isOverextended) return { isBlocked: false, isCalculable: false, isOverextended: true, isTradeValid: false, message: "Wait for correction before treating this setup as cleaner." };
    if (!isTradeValid) return { isBlocked: false, isCalculable: false, isOverextended, isTradeValid: false, message: "No clear research setup." };
    return { isBlocked: false, isCalculable: true, isOverextended, isTradeValid, message: "Research setup is clear." };
  }, [metrics.entryDistancePct, metrics.positionSize, row, state.entryPrice, state.entryStatus, state.finalDecision, state.stopLoss, state.targetPrice]);

  const riskEvaluation = useMemo<RiskEvaluation>(() => evaluateRisk({
    accountEquity: state.accountEquity,
    atrPct: row.atr_pct,
    currentPrice: state.currentPrice,
    entryPrice: state.entryPrice,
    maxRiskAmount: metrics.maxRiskAmount,
    positionSize: metrics.positionSize,
    riskPercent: state.riskPercent,
    sector: row.sector,
    symbol: row.symbol,
    volatilityPct: row.annualized_volatility ?? row.volatility,
  }, portfolio, riskProfile), [
    metrics.maxRiskAmount,
    metrics.positionSize,
    portfolio,
    riskProfile,
    row.annualized_volatility,
    row.atr_pct,
    row.sector,
    row.symbol,
    row.volatility,
    state.accountEquity,
    state.currentPrice,
    state.entryPrice,
    state.riskPercent,
  ]);

  const copilotText = useMemo(() => buildDirective(row, state, metrics, validity, riskEvaluation), [metrics, riskEvaluation, row, state, validity]);

  return {
    copilotText,
    metrics,
    riskEvaluation,
    riskProfile,
    riskProfileActions,
    setters: {
      setAccountEquity: (value: number) => setAccountEquityState(safeNonNegative(value)),
      setRiskPercent: (value: number) => setRiskPercentState(safeNonNegative(value)),
    },
    state,
    validity,
  };
}

function buildDirective(row: RankingRow, state: TradePlanEngineState, metrics: TradePlanEngineMetrics, validity: TradePlanEngineValidity, riskEvaluation: RiskEvaluation): string {
  if (rowHasStaleDataSafety(row)) return cleanText(row.stale_data_safety_reason, STALE_DATA_ACTION_REASON);

  if (state.finalDecision === "AVOID") return avoidDirective(row, state, validity, metrics);
  if (state.finalDecision === "EXIT") return `Exit or invalidation state is active.\nTrend invalidation triggered.${hypotheticalLine(metrics)}`;

  if (riskEvaluation.status === "VETO") {
    const vetoReason = state.riskPercent > 3
      ? `Risk of ${formatNumber(state.riskPercent, 1)}% exceeds safe limit.`
      : riskEvaluation.reasons[0] ?? "This setup violates your risk rules.";
    return ["Risk gate:", vetoReason, "Execution context remains locked to prevent emotional decisions."].join("\n");
  }

  if (riskEvaluation.status === "WARNING") {
    return ["Warning:", "This setup increases portfolio risk.", ...riskEvaluation.reasons.map((reason) => `- ${reason}`)].join("\n");
  }

  if (state.finalDecision === "ENTER" && validity.isCalculable && state.entryPrice !== null && state.targetPrice !== null && metrics.riskRewardRatio !== null && metrics.potentialReward !== null) {
    return [
      `Research entry context: ${formatMoney(state.entryPrice)}.`,
      `Sizing simulation: ${metrics.positionSize} shares.`,
      `Risk context: ${formatMoney(metrics.maxRiskAmount)}.`,
      `Target context: ${formatMoney(state.targetPrice)} (${metrics.riskRewardRatio.toFixed(1)}R).`,
    ].join("\n");
  }

  if (state.finalDecision === "WAIT_PULLBACK") {
    return waitPullbackDirective(row, state, validity);
  }

  return validity.message;
}

function waitPullbackDirective(row: RankingRow, state: TradePlanEngineState, validity: TradePlanEngineValidity): string {
  return [
    "Decision context: WAIT_PULLBACK",
    "",
    setupRiskLine(row, validity),
    "Treating this as ready now increases risk.",
    "",
    pullbackInstruction(row, state),
  ].join("\n");
}

function avoidDirective(row: RankingRow, state: TradePlanEngineState, validity: TradePlanEngineValidity, metrics: TradePlanEngineMetrics): string {
  return [
    "Decision context: AVOID",
    "",
    setupRiskLine(row, validity),
    "Treating this as ready now increases risk.",
    "",
    pullbackInstruction(row, state),
    hypotheticalLine(metrics),
  ].filter(Boolean).join("\n");
}

function setupRiskLine(row: RankingRow, validity: TradePlanEngineValidity): string {
  const reason = cleanText(row.decision_reason ?? row.quality_reason ?? row.trade_quality_note, "");
  if (validity.isOverextended || reason.toUpperCase().includes("EXTENDED")) return "This setup is overextended.";
  if (reason) return reason.endsWith(".") ? reason : `${reason}.`;
  return "This setup does not meet entry-quality rules.";
}

function pullbackInstruction(row: RankingRow, state: TradePlanEngineState): string {
  const correction = buildCorrectionMap(row);
  const correctionPrice = correctionMidpoint(correction);
  if (correctionPrice !== null) return `Wait for pullback near ${formatCorrectionZone(correction)} before treating the setup as cleaner.`;
  if (state.entryPrice !== null) return `Wait for pullback near ${formatMoney(state.entryPrice)} before treating the setup as cleaner.`;
  return "Wait for a confirmed pullback before treating the setup as cleaner.";
}

function hypotheticalLine(metrics: TradePlanEngineMetrics): string {
  if (metrics.positionSize <= 0 || metrics.riskPerShare === null) return "";
  const riskAmount = metrics.positionSize * metrics.riskPerShare;
  return `\nHypothetical sizing context: ${metrics.positionSize} shares, risk context ${formatMoney(riskAmount)}.`;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
