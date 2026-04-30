import "server-only";

import type { QueryResultRow } from "pg";
import { normalizeWatchlistSymbol } from "@/lib/watchlist-storage";
import { dbQuery } from "./db";

type WatchlistRow = QueryResultRow & {
  symbol: string;
};

export async function readUserWatchlist(userId: string): Promise<string[]> {
  const result = await dbQuery<WatchlistRow>(
    `
      SELECT symbol
      FROM user_watchlist
      WHERE user_id = $1
      ORDER BY symbol
    `,
    [userId],
  );
  return normalizeWatchlistSymbols(result.rows.map((row) => row.symbol));
}

export async function addUserWatchlistSymbols(userId: string, symbols: string[]): Promise<string[]> {
  const normalized = normalizeWatchlistSymbols(symbols);
  for (const symbol of normalized) {
    await dbQuery(
      `
        INSERT INTO user_watchlist (user_id, symbol, created_at)
        VALUES ($1, $2, now())
        ON CONFLICT (user_id, symbol) DO NOTHING
      `,
      [userId, symbol],
    );
  }
  return readUserWatchlist(userId);
}

export async function removeUserWatchlistSymbol(userId: string, symbol: string): Promise<string[]> {
  const normalized = normalizeWatchlistSymbol(symbol);
  if (normalized) {
    await dbQuery("DELETE FROM user_watchlist WHERE user_id = $1 AND symbol = $2", [userId, normalized]);
  }
  return readUserWatchlist(userId);
}

export function normalizeWatchlistSymbols(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeWatchlistSymbol(String(value ?? ""))).filter(Boolean))).sort();
}
