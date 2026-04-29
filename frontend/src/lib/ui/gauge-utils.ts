import { clamp } from "./formatters";

export function technicalLabel(score: number) {
  if (score <= 20) return "Strong Sell";
  if (score <= 40) return "Sell";
  if (score <= 60) return "Hold / Wait";
  if (score <= 80) return "Buy";
  return "Strong Buy";
}

export function gaugePercent(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : 0;
}

export function decisionGaugePercent(finalDecision: unknown, quality: unknown, score: unknown) {
  const decision = String(finalDecision ?? "").toUpperCase();
  const parsedScore = typeof score === "number" ? score : Number(score);
  if (decision === "ENTER") return Math.max(78, gaugePercent(parsedScore));
  if (decision === "WAIT_PULLBACK") return 62;
  if (decision === "WATCH") return 48;
  if (decision === "AVOID") return 18;
  if (decision === "EXIT") return 8;
  if (String(quality ?? "").toUpperCase() === "TRADE_READY") return 68;
  return gaugePercent(parsedScore);
}
