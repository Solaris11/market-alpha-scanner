import "server-only";

import type { QueryResultRow } from "pg";
import { normalizeWatchlistSymbol } from "@/lib/watchlist-storage";
import { dbQuery } from "./db";

type WatchlistRow = QueryResultRow & {
  symbol: string;
};

type WatchlistCacheEntry = {
  expiresAtMs: number;
  symbols: string[];
};

const WATCHLIST_CACHE_TTL_MS = 30_000;
const WATCHLIST_CACHE_MAX = 1_000;

const watchlistCache = new Map<string, WatchlistCacheEntry>();

export async function readUserWatchlist(userId: string): Promise<string[]> {
  const cached = readCachedWatchlist(userId);
  if (cached) return [...cached];

  const result = await dbQuery<WatchlistRow>(
    `
      SELECT symbol
      FROM user_watchlist
      WHERE user_id = $1
      ORDER BY symbol
    `,
    [userId],
  );
  const symbols = normalizeWatchlistSymbols(result.rows.map((row) => row.symbol));
  writeCachedWatchlist(userId, symbols);
  return symbols;
}

export async function addUserWatchlistSymbols(userId: string, symbols: string[]): Promise<string[]> {
  const normalized = normalizeWatchlistSymbols(symbols);
  if (normalized.length) {
    await dbQuery(
      `
        INSERT INTO user_watchlist (user_id, symbol, created_at)
        SELECT $1, symbol, now()
        FROM unnest($2::text[]) AS symbol
        ON CONFLICT (user_id, symbol) DO NOTHING
      `,
      [userId, normalized],
    );
  }
  invalidateUserWatchlist(userId);
  return readUserWatchlist(userId);
}

export async function removeUserWatchlistSymbol(userId: string, symbol: string): Promise<string[]> {
  const normalized = normalizeWatchlistSymbol(symbol);
  if (normalized) {
    await dbQuery("DELETE FROM user_watchlist WHERE user_id = $1 AND symbol = $2", [userId, normalized]);
  }
  invalidateUserWatchlist(userId);
  return readUserWatchlist(userId);
}

export function normalizeWatchlistSymbols(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeWatchlistSymbol(String(value ?? ""))).filter(Boolean))).sort();
}

function readCachedWatchlist(userId: string): string[] | null {
  const cached = watchlistCache.get(userId);
  if (!cached) return null;
  if (cached.expiresAtMs <= Date.now()) {
    watchlistCache.delete(userId);
    return null;
  }
  return cached.symbols;
}

function writeCachedWatchlist(userId: string, symbols: string[]): void {
  trimWatchlistCache();
  watchlistCache.set(userId, {
    expiresAtMs: Date.now() + WATCHLIST_CACHE_TTL_MS,
    symbols: [...symbols],
  });
}

function invalidateUserWatchlist(userId: string): void {
  watchlistCache.delete(userId);
}

function trimWatchlistCache(): void {
  if (watchlistCache.size < WATCHLIST_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, value] of watchlistCache) {
    if (value.expiresAtMs <= now) watchlistCache.delete(key);
  }
  while (watchlistCache.size >= WATCHLIST_CACHE_MAX) {
    const firstKey = watchlistCache.keys().next().value;
    if (typeof firstKey !== "string") return;
    watchlistCache.delete(firstKey);
  }
}
