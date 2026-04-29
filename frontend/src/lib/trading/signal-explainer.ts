import type { RankingRow } from "@/lib/types";
import { firstNumber } from "@/lib/ui/formatters";
import { calculateTradeRisk } from "./risk-calculator";

export type CopilotInput = {
  accountBalance: number;
  riskPct: number;
  signal: RankingRow;
};

export type CopilotRecommendation = {
  recommendationText: string;
  suggestedQty: number;
  maxRisk: number;
  potentialReward: number;
  riskRewardRatio: number;
  warnings: string[];
};

export function buildCopilotRecommendation(input: CopilotInput): CopilotRecommendation {
  const signal = input.signal;
  const decision = String(signal.final_decision ?? "").toUpperCase();
  const entry = firstNumber(signal.suggested_entry ?? signal.buy_zone ?? signal.entry_zone ?? signal.price) ?? 0;
  const stop = firstNumber(signal.stop_loss ?? signal.invalidation_level) ?? 0;
  const target = firstNumber(signal.conservative_target ?? signal.take_profit_zone ?? signal.take_profit_high) ?? 0;
  const risk = calculateTradeRisk({ accountSize: input.accountBalance, riskPct: input.riskPct, entryPrice: entry, stopPrice: stop, targetPrice: target });
  const warnings: string[] = [];

  if (!entry || !stop || !target) warnings.push("Entry, stop, or target is missing; sizing is approximate.");
  if (risk.violatesRisk) warnings.push("Trade sizing violates the selected risk profile or has invalid risk.");
  if (decision === "AVOID" || decision === "EXIT") warnings.push("System decision blocks new aggressive entries.");

  const prefix =
    decision === "ENTER"
      ? `For a $${input.accountBalance.toLocaleString()} account and ${input.riskPct}% risk profile, consider ${signal.symbol} near ${entry.toFixed(2)} with quantity ${risk.quantity}.`
      : decision === "WAIT_PULLBACK"
        ? `${signal.symbol} is not an immediate entry. Wait for the suggested entry area near ${entry ? entry.toFixed(2) : "the scanner zone"}.`
        : `${signal.symbol} is currently ${decision || "not cleared"} by the system. Do not force an entry from this signal.`;

  return {
    recommendationText: `${prefix} Stop ${stop ? stop.toFixed(2) : "N/A"}, target ${target ? target.toFixed(2) : "N/A"}. Max risk: $${risk.maxLoss.toFixed(2)}. Simulation only. Not financial advice.`,
    suggestedQty: risk.quantity,
    maxRisk: risk.maxLoss,
    potentialReward: risk.potentialProfit,
    riskRewardRatio: risk.riskRewardRatio,
    warnings,
  };
}
