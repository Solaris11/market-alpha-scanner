import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, firstNumber, formatMoney, formatPercent } from "@/lib/ui/formatters";
import { readableText } from "@/lib/ui/labels";
import { buildCorrectionMap, correctionMidpoint, formatCorrectionZone } from "./correction-map";
import { calculateTradeRisk } from "./risk-calculator";

export type CopilotInput = {
  accountBalance: number;
  riskPct: number;
  signal: RankingRow;
};

export type CopilotRecommendation = {
  accountEquity: number;
  maxRiskAmount: number;
  recommendationText: string;
  positionSize: number;
  riskPercent: number;
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
  const correction = buildCorrectionMap(signal);
  const correctionPrice = correctionMidpoint(correction);
  const risk = calculateTradeRisk({ accountSize: input.accountBalance, riskPct: input.riskPct, entryPrice: entry, stopPrice: stop, targetPrice: target });
  const warnings: string[] = [];

  if (!entry || !stop || !target) warnings.push("Entry, stop, or target is missing; sizing is approximate.");
  if (risk.violatesRisk) warnings.push("Trade sizing violates the selected risk profile or has invalid risk.");
  if (decision === "AVOID" || decision === "EXIT") warnings.push("System decision blocks new aggressive entries.");

  const reason = readableText(signal.decision_reason ?? signal.quality_reason, "");
  const directive =
    decision === "ENTER"
      ? `Enter around $${entry ? entry.toFixed(2) : "N/A"}. Risk is $${risk.maxLoss.toFixed(2)} to target $${target ? target.toFixed(2) : "N/A"} (${risk.riskRewardRatio.toFixed(2)}R). Position size: ${risk.quantity} shares.`
      : decision === "WAIT_PULLBACK"
        ? correctionPrice !== null
          ? `Do not chase here. ${triggerDirective(correction.triggerPrice, correction.triggerAlreadyReached)} Better entry zone is ${formatCorrectionZone(correction)}.`
          : `Wait for pullback near $${entry ? entry.toFixed(2) : "N/A"} before entering. Current price is extended.`
        : decision === "AVOID" || decision === "EXIT"
          ? "Do not enter. This setup lacks edge or has poor risk/reward."
          : `Monitor ${signal.symbol}. No immediate entry is cleared.`;

  return {
    accountEquity: input.accountBalance,
    maxRiskAmount: risk.maxLoss,
    recommendationText: `${directive} Account equity: $${input.accountBalance.toLocaleString()}. Risk profile: ${input.riskPct}%. Max risk amount: $${risk.maxLoss.toFixed(2)}. Potential reward: $${risk.potentialProfit.toFixed(2)}.${reason ? ` Reason: ${reason}.` : ""} Simulation only. Not financial advice.`,
    positionSize: risk.quantity,
    riskPercent: input.riskPct,
    suggestedQty: risk.quantity,
    maxRisk: risk.maxLoss,
    potentialReward: risk.potentialProfit,
    riskRewardRatio: risk.riskRewardRatio,
    warnings,
  };
}

function triggerDirective(price: number | null, alreadyReached: boolean): string {
  if (price === null) return "Correction trigger is not available yet.";
  return alreadyReached ? `Correction trigger was already reached at ${formatMoney(price)}; correction risk is elevated.` : `If price extends above ${formatMoney(price)}, correction risk increases.`;
}

export function buildWhyThisTrade(row: RankingRow) {
  const reasons: string[] = [];
  if ((finiteNumber(row.final_score) ?? 0) >= 75) reasons.push("Trend strength is above the scanner threshold");
  if ((finiteNumber(row.technical_score) ?? finiteNumber(row.final_score) ?? 0) >= 70) reasons.push("Momentum and technical structure are constructive");
  if ((finiteNumber(row.macro_score) ?? 50) >= 65 || cleanText(row.market_regime, "")) reasons.push(`Macro alignment: ${cleanText(row.market_regime, "supportive enough to monitor")}`);
  if ((finiteNumber(row.risk_reward) ?? 0) >= 2) reasons.push("Risk/reward is favorable enough to consider");
  if (cleanText(row.decision_reason, "")) reasons.push(readableText(row.decision_reason));
  return reasons.length ? reasons.slice(0, 4) : ["No strong positive setup drivers are available yet"];
}

export function buildWhyNotNow(row: RankingRow) {
  const decision = cleanText(row.final_decision, "").toUpperCase();
  const entry = cleanText(row.entry_status, "").toUpperCase();
  const quality = cleanText(row.recommendation_quality, "").toUpperCase();
  const reasons: string[] = [];
  if (decision === "WAIT_PULLBACK") reasons.push("Wait for a cleaner entry near the suggested zone");
  if (decision === "AVOID") reasons.push("Poor risk/reward or low edge blocks entry");
  if (decision === "EXIT") reasons.push("Exit or invalidation signal is active");
  if (entry.includes("OVEREXTENDED")) reasons.push("Price is overextended");
  if (entry.includes("STOP RISK")) reasons.push("Price is too close to invalidation");
  if (quality === "LOW_EDGE" || quality === "AVOID") reasons.push("Historical or quality edge is not strong enough");
  if ((finiteNumber(row.risk_reward) ?? 99) < 1.5) reasons.push("Risk/reward is not attractive enough");
  const distance = finiteNumber(row.entry_distance_pct);
  if (distance !== null && distance > 0.02) reasons.push(`Entry zone is still ${formatPercent(distance)} away`);
  return reasons.length ? reasons : ["No major blocker detected"];
}
