import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { BestTradeResult } from "@/lib/trading/conviction";
import type { RankingRow } from "@/lib/types";
import { cleanText } from "@/lib/ui/formatters";

export type DailyActionTone = "buy" | "wait" | "stay-out";

export type DailyAction = {
  action: "BUY" | "WAIT" | "WAIT_PULLBACK" | "STAY_OUT";
  label: string;
  reason: string;
  symbol: string | null;
  tone: DailyActionTone;
};

export type DailyActionInput = {
  best: BestTradeResult;
  fallbackRow?: RankingRow | null;
  marketRegime: MarketRegime | null;
};

export function getDailyAction({ best, fallbackRow, marketRegime }: DailyActionInput): DailyAction {
  const regime = normalizeToken(marketRegime?.label);
  if (regime === "OVERHEATED" || regime.includes("OVERHEATED")) {
    return {
      action: "WAIT",
      label: "WAIT",
      reason: "Market is overheated. Wait for pullback.",
      symbol: null,
      tone: "wait",
    };
  }

  const row = best?.row ?? fallbackRow ?? null;
  if (!row) return stayOutAction();

  const symbol = cleanText(row.symbol, "").toUpperCase();
  if (!symbol) return stayOutAction();

  const decision = normalizeDecision(row);
  if (decision === "BUY") {
    return {
      action: "BUY",
      label: `BUY ${symbol}`,
      reason: "Strong setup with acceptable risk.",
      symbol,
      tone: "buy",
    };
  }

  if (decision === "WAIT_PULLBACK") {
    return {
      action: "WAIT_PULLBACK",
      label: `WAIT FOR PULLBACK ${symbol}`,
      reason: "Strong setup but price is extended.",
      symbol,
      tone: "wait",
    };
  }

  return stayOutAction(symbol);
}

function stayOutAction(symbol: string | null = null): DailyAction {
  return {
    action: "STAY_OUT",
    label: "STAY OUT",
    reason: "No high-quality setups right now.",
    symbol,
    tone: "stay-out",
  };
}

function normalizeDecision(row: RankingRow): "BUY" | "WAIT_PULLBACK" | "AVOID" | "OTHER" {
  const finalDecision = normalizeToken(row.final_decision);
  if (finalDecision === "ENTER" || finalDecision === "BUY" || finalDecision === "STRONG_BUY") return "BUY";
  if (finalDecision === "WAIT_PULLBACK") return "WAIT_PULLBACK";
  if (finalDecision === "AVOID" || finalDecision === "EXIT") return "AVOID";
  if (finalDecision) return "OTHER";

  const action = normalizeToken(row.action);
  if (action === "BUY" || action === "STRONG_BUY") return "BUY";
  if (action === "WAIT_PULLBACK") return "WAIT_PULLBACK";
  if (action === "AVOID" || action === "SELL" || action === "STRONG_SELL") return "AVOID";

  return "OTHER";
}

function normalizeToken(value: unknown): string {
  return cleanText(value, "").toUpperCase().replace(/[\s-]+/g, "_");
}
