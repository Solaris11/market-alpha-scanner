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
    const reason = scanSafety?.reason ?? cleanText(row?.stale_data_safety_reason, STALE_DATA_ACTION_REASON);
    return {
      action: "DATA_STALE",
      label: "Decision Paused",
      reason,
      symbol: null,
      tone: "wait",
    };
  }

  const regime = normalizeToken(marketRegime?.label);
  if (regime === "OVERHEATED" || regime.includes("OVERHEATED")) {
    return {
      action: "WAIT",
      label: "Wait for a Cleaner Setup",
      reason: "Market is extended, so TradeVeto is protecting entry quality. Watch for a calmer pullback or stronger confirmation.",
      symbol: null,
      tone: "wait",
    };
  }

  if (regime === "RISK_OFF" || regime === "BEAR" || regime.includes("RISK_OFF") || regime.includes("BEAR")) {
    return {
      action: "WAIT",
      label: "Wait for Confirmation",
      reason: "Market tone is defensive, so new exposure needs stronger confirmation before it becomes a clean research setup.",
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
      label: `Research Setup ${symbol}`,
      reason: "The setup is strong enough to review, with risk still visible.",
      symbol,
      tone: "buy",
    };
  }

  if (decision === "WAIT_PULLBACK") {
    return {
      action: "WAIT_PULLBACK",
      label: `Wait for Pullback ${symbol}`,
      reason: "The setup is interesting, but price needs a calmer pullback first.",
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
      title: "Decision Paused",
      reason: action.reason || STALE_DATA_ACTION_REASON,
    };
  }
  if (action.action === "WAIT_PULLBACK") {
    return {
      title: "Wait for Pullback",
      reason: action.reason || "Monitor for a cleaner pullback and confirmation.",
    };
  }
  if (action.action === "STAY_OUT") {
    return {
      title: "Stay Patient",
      reason: action.reason || "No high-quality setup is ready yet.",
    };
  }
  return {
    title: "Stay Patient",
    reason: action.reason || STALE_DATA_ACTION_REASON,
  };
}

function stayOutAction(symbol: string | null = null): DailyAction {
  return {
    action: "STAY_OUT",
    label: "Stay Patient",
    reason: "No high-quality setup is ready yet. Keep monitoring for cleaner confirmation.",
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
