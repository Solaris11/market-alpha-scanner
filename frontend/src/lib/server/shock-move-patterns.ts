import "server-only";

import { dbQuery } from "@/lib/server/db";
import { shockPatternFromDbRow, type ShockMovePattern, type ShockMoveWindow } from "@/lib/trading/shock-move";
import type { QueryResultRow } from "pg";

type ShockMovePatternRow = QueryResultRow & {
  symbol: string;
};

export async function getShockMovePattern(symbol: string, lookbackWindow: ShockMoveWindow = "1y"): Promise<ShockMovePattern | null> {
  const map = await getShockMovePatternMap([symbol], lookbackWindow);
  return map.get(symbol.trim().toUpperCase()) ?? null;
}

export async function getShockMovePatternMap(symbols: string[], lookbackWindow: ShockMoveWindow = "1y"): Promise<Map<string, ShockMovePattern>> {
  const cleaned = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
  if (!cleaned.length) return new Map();

  try {
    const result = await dbQuery<ShockMovePatternRow>(
      `
        SELECT
          symbol,
          lookback_window,
          upside_shock_count,
          downside_shock_count,
          largest_upside_1d,
          largest_downside_1d,
          median_upside_shock,
          median_downside_shock,
          average_followthrough_1d,
          average_followthrough_5d,
          average_reversal_5d,
          chase_success_rate,
          pullback_success_rate,
          reliability_score,
          opportunity_score,
          downside_risk_score,
          upside_shock_score,
          two_sided_volatility_score,
          current_similarity_score,
          asymmetry_score,
          chase_risk_score,
          opportunity_state,
          chase_risk_label,
          research_entry_zone,
          do_not_chase_zone,
          invalidation_zone,
          historical_exit_zone,
          average_profit_potential,
          average_drawdown_after_entry,
          common_preconditions,
          common_failure_conditions,
          latest_event,
          shock_events,
          metrics,
          last_updated
        FROM shock_move_patterns
        WHERE lookback_window = $1
          AND symbol = ANY($2::text[])
      `,
      [lookbackWindow, cleaned],
    );
    return new Map(
      result.rows
        .map((row) => shockPatternFromDbRow(row))
        .filter((pattern): pattern is ShockMovePattern => pattern !== null)
        .map((pattern) => [pattern.symbol, pattern]),
    );
  } catch (error) {
    if (error instanceof Error && /shock_move_patterns|relation .* does not exist/i.test(error.message)) return new Map();
    throw error;
  }
}
