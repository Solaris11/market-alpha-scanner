import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import { rowHasStaleDataSafety, STALE_DATA_ACTION_REASON, type ScanSafetyState } from "@/lib/stale-data-safety";
import type { BestTradeResult } from "@/lib/trading/conviction";
import type { RankingRow } from "@/lib/types";
import { cleanText } from "@/lib/ui/formatters";

export type DailyActionTone = "buy" | "wait" | "stay-out";

export type DailyAction = {
  action: "BUY" | "DATA_STALE" | "WAIT" | "WAIT_PULLBACK" | "STAY_OUT";
  label: string;
  reason: string;
  symbol: string | null;
  tone: DailyActionTone;
};

export type DailyActionInput = {
  best: BestTradeResult;
  fallbackRow?: RankingRow | null;
  marketRegime: MarketRegime | null;
  scanSafety?: ScanSafetyState | null;
};

export function getDailyAction({ best, fallbackRow, marketRegime, scanSafety }: DailyActionInput): DailyAction {
  const row = best?.row ?? fallbackRow ?? null;
  if (scanSafety?.active || (row && rowHasStaleDataSafety(row))) {
    return {
      action: "DATA_STALE",
      label: "NO TRADE TODAY",
      reason: "Data is outdated. No action recommended.",
      symbol: null,
      tone: "wait",
    };
  }

  const regime = normalizeToken(marketRegime?.label);
  if (regime === "OVERHEATED" || regime.includes("OVERHEATED")) {
    return {
      action: "WAIT",
      label: "NO TRADE TODAY",
      reason: "Market is overheated. Wait for pullback.",
      symbol: null,
      tone: "wait",
    };
  }

  if (regime === "RISK_OFF" || regime === "BEAR" || regime.includes("RISK_OFF") || regime.includes("BEAR")) {
    return {
      action: "WAIT",
      label: "NO TRADE TODAY",
      reason: "Market regime is defensive. Wait for stronger confirmation.",
      symbol: null,
      tone: "wait",
    };
  }

  if (!row) return stayOutAction();

  const symbol = cleanText(row.symbol, "").toUpperCase();
  if (!symbol) return stayOutAction();

  const decision = normalizeDecision(row);
  if (decision === "BUY") {
    return {
      action: "BUY",
      label: `RESEARCH SIGNAL ${symbol}`,
      reason: "Strong setup with acceptable risk for research.",
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

export function dailyActionAllowsTrade(action: DailyAction): boolean {
  return action.action === "BUY";
}

export function dailyActionBlocksTradeUi(action: DailyAction): boolean {
  return !dailyActionAllowsTrade(action);
}

export function noTradeActionCopy(action: DailyAction): { reason: string; title: string } {
  if (action.action === "DATA_STALE") {
    return {
      title: "No Trade Today",
      reason: "Data is outdated. No action recommended.",
    };
  }
  if (action.action === "WAIT_PULLBACK") {
    return {
      title: "No active trade recommended",
      reason: action.reason || "Monitor for entry after a cleaner pullback.",
    };
  }
  if (action.action === "STAY_OUT") {
    return {
      title: "No Trade Today",
      reason: action.reason || "No high-quality setups right now.",
    };
  }
  return {
    title: "No Trade Today",
    reason: action.reason || STALE_DATA_ACTION_REASON,
  };
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
