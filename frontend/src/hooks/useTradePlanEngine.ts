"use client";

import { useMemo, useState } from "react";
import { buildCorrectionMap, correctionMidpoint, formatCorrectionZone } from "@/lib/trading/correction-map";
import { buildSignalTradeLevels } from "@/lib/trading/signal-lifecycle";
import type { RankingRow } from "@/lib/types";
import { cleanText, formatMoney, normalizeNumeric } from "@/lib/ui/formatters";

const TRADE_READY_DISTANCE_THRESHOLD = 0.02;

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
  setters: {
    setAccountEquity: (value: number) => void;
    setRiskPercent: (value: number) => void;
  };
  state: TradePlanEngineState;
  validity: TradePlanEngineValidity;
};

export function useTradePlanEngine(row: RankingRow): TradePlanEngine {
  const [accountEquity, setAccountEquityState] = useState(10000);
  const [riskPercent, setRiskPercentState] = useState(2);

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
    const isSystemBlocked = state.finalDecision === "AVOID" || state.finalDecision === "EXIT";
    const isOverextended = state.entryStatus.includes("OVEREXTENDED");
    const hasValidLevels = state.entryPrice !== null && state.stopLoss !== null && state.targetPrice !== null && state.stopLoss < state.entryPrice && state.targetPrice > state.entryPrice;
    const isTradeValid =
      state.finalDecision === "ENTER" ||
      (state.finalDecision === "WAIT_PULLBACK" && metrics.entryDistancePct !== null && metrics.entryDistancePct <= TRADE_READY_DISTANCE_THRESHOLD);

    if (!hasValidLevels) return { isBlocked: isSystemBlocked, isCalculable: false, isOverextended, isTradeValid: false, message: "No valid trade setup." };
    if (metrics.positionSize <= 0) return { isBlocked: isSystemBlocked, isCalculable: false, isOverextended, isTradeValid, message: "No valid trade setup." };
    if (state.finalDecision === "AVOID") return { isBlocked: true, isCalculable: true, isOverextended, isTradeValid: false, message: "This trade is not recommended based on current conditions." };
    if (state.finalDecision === "EXIT") return { isBlocked: true, isCalculable: true, isOverextended, isTradeValid: false, message: "This trade is not recommended based on current conditions." };
    if (isOverextended) return { isBlocked: false, isCalculable: false, isOverextended: true, isTradeValid: false, message: "Wait for correction before entering." };
    if (!isTradeValid) return { isBlocked: false, isCalculable: false, isOverextended, isTradeValid: false, message: "No valid trade setup." };
    return { isBlocked: false, isCalculable: true, isOverextended, isTradeValid, message: "Trade setup valid." };
  }, [metrics.entryDistancePct, metrics.positionSize, state.entryPrice, state.entryStatus, state.finalDecision, state.stopLoss, state.targetPrice]);

  const copilotText = useMemo(() => buildDirective(row, state, metrics, validity), [metrics, row, state, validity]);

  return {
    copilotText,
    metrics,
    setters: {
      setAccountEquity: (value: number) => setAccountEquityState(safeNonNegative(value)),
      setRiskPercent: (value: number) => setRiskPercentState(safeNonNegative(value)),
    },
    state,
    validity,
  };
}

function buildDirective(row: RankingRow, state: TradePlanEngineState, metrics: TradePlanEngineMetrics, validity: TradePlanEngineValidity): string {
  if (state.finalDecision === "ENTER" && validity.isCalculable && state.entryPrice !== null && state.targetPrice !== null && metrics.riskRewardRatio !== null && metrics.potentialReward !== null) {
    return [
      `Enter near ${formatMoney(state.entryPrice)}.`,
      `Position size: ${metrics.positionSize} shares.`,
      `Risk: ${formatMoney(metrics.maxRiskAmount)}.`,
      `Target: ${formatMoney(state.targetPrice)} (${metrics.riskRewardRatio.toFixed(1)}R).`,
    ].join("\n");
  }

  if (state.finalDecision === "WAIT_PULLBACK") {
    const correction = buildCorrectionMap(row);
    const correctionPrice = correctionMidpoint(correction);
    if (validity.isOverextended && correctionPrice !== null) {
      return [`Wait for pullback near ${formatCorrectionZone(correction)}.`, "Entering now increases risk."].join("\n");
    }
    return [`Do not enter now.`, `Wait for pullback near ${formatMoney(state.entryPrice)}.`, "Current price is extended."].join("\n");
  }

  if (state.finalDecision === "AVOID") return `Avoid this trade.\nRisk/reward is unfavorable.${hypotheticalLine(metrics)}`;
  if (state.finalDecision === "EXIT") return `Exit position.\nTrend invalidation triggered.${hypotheticalLine(metrics)}`;
  return validity.message;
}

function hypotheticalLine(metrics: TradePlanEngineMetrics): string {
  if (metrics.positionSize <= 0 || metrics.riskPerShare === null) return "";
  const riskAmount = metrics.positionSize * metrics.riskPerShare;
  return `\nIf you were to trade this, position size would be ${metrics.positionSize} shares, risking ${formatMoney(riskAmount)}.`;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
