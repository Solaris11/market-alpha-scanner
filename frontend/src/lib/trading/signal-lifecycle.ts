import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, firstNumber } from "@/lib/ui/formatters";

export type SignalLifecycleState = "ACTIVE" | "EXPIRED" | "INVALIDATED";

export type SignalLifecycle = {
  state: SignalLifecycleState;
  reason: string;
  entryDistancePct: number | null;
};

export type SignalTradeLevels = {
  entry: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  target: number | null;
};

export const SIGNAL_EXPIRY_DISTANCE_PCT = 0.05;

export function buildSignalTradeLevels(row: RankingRow): SignalTradeLevels {
  const entryRange = numericRange(row.suggested_entry ?? row.buy_zone ?? row.entry_zone);
  const entry = entryRange.midpoint ?? firstNumber(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price);
  const entryLow = entryRange.low ?? entry;
  const entryHigh = entryRange.high ?? entry;

  return {
    entry,
    entryLow,
    entryHigh,
    stop: firstNumber(row.stop_loss ?? row.invalidation_level),
    target: firstNumber(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price),
  };
}

export function computeSignalLifecycle(
  row: RankingRow,
  levels: SignalTradeLevels = buildSignalTradeLevels(row),
  threshold = SIGNAL_EXPIRY_DISTANCE_PCT,
): SignalLifecycle {
  const entryDistancePct = signalEntryDistancePct(row, levels);
  if (entryDistancePct !== null && entryDistancePct > threshold) {
    return {
      entryDistancePct,
      reason: "price moved too far from entry",
      state: "EXPIRED",
    };
  }

  const invalidationReason = trendInvalidationReason(row, levels);
  if (invalidationReason) {
    return {
      entryDistancePct,
      reason: invalidationReason,
      state: "INVALIDATED",
    };
  }

  return {
    entryDistancePct,
    reason: "current price remains inside the active signal window",
    state: "ACTIVE",
  };
}

function signalEntryDistancePct(row: RankingRow, levels: SignalTradeLevels) {
  const explicit = finiteNumber(row.entry_distance_pct);
  if (explicit !== null) return Math.max(0, explicit > 1 ? explicit / 100 : explicit);

  const price = finiteNumber(row.price);
  const entryReference = levels.entryHigh ?? levels.entry;
  if (price === null || entryReference === null || price <= 0 || entryReference <= 0) return null;
  return Math.max(0, (price - entryReference) / price);
}

function trendInvalidationReason(row: RankingRow, levels: SignalTradeLevels) {
  const decision = cleanText(row.final_decision, "").toUpperCase();
  const action = cleanText(row.action, "").toUpperCase();
  if (decision === "EXIT" || action === "SELL" || action === "STRONG SELL") return "exit or sell signal is active";

  const price = finiteNumber(row.price);
  if (price !== null && levels.stop !== null && price <= levels.stop) return "price is below the stop level";

  const entryStatus = cleanText(row.entry_status, "").toUpperCase();
  if (entryStatus.includes("STOP") || entryStatus.includes("INVALID")) return "entry status indicates trend invalidation";

  const marketStructure = cleanText(row.market_structure, "").toUpperCase();
  if (marketStructure.includes("BROKEN") || marketStructure.includes("BREAKDOWN") || marketStructure.includes("INVALID")) {
    return "market structure is invalidated";
  }

  return null;
}

function numericRange(value: unknown) {
  const text = cleanText(value, "");
  if (!text) return { high: null, low: null, midpoint: null };
  const matches = text
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)
    ?.map((match) => Number(match))
    .filter(Number.isFinite);
  if (!matches?.length) return { high: null, low: null, midpoint: null };
  const low = Math.min(...matches);
  const high = Math.max(...matches);
  return {
    high,
    low,
    midpoint: (low + high) / 2,
  };
}
