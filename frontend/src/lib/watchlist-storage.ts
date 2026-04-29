export const WATCHLIST_STORAGE_KEY = "market_alpha_watchlist";
export const WATCHLIST_EVENT = "market-alpha-watchlist-change";

const LEGACY_WATCHLIST_STORAGE_KEY = "market-alpha-scanner-watchlist";
const LEGACY_WATCHLIST_EVENT = "market-alpha-scanner-watchlist-change";

export function normalizeWatchlistSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

export function readWatchlistStorage() {
  if (typeof window === "undefined") return [];
  const symbols = [...readKey(WATCHLIST_STORAGE_KEY), ...readKey(LEGACY_WATCHLIST_STORAGE_KEY)];
  return cleanSymbols(symbols);
}

export function writeWatchlistStorage(symbols: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = cleanSymbols(symbols);
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(cleaned));
  window.localStorage.setItem(LEGACY_WATCHLIST_STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
  window.dispatchEvent(new Event(LEGACY_WATCHLIST_EVENT));
}

function readKey(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeWatchlistSymbol(String(item)));
  } catch {
    return [];
  }
}

function cleanSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map(normalizeWatchlistSymbol).filter(Boolean))).sort();
}
