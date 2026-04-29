"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeWatchlistSymbol, readWatchlistStorage, WATCHLIST_EVENT, writeWatchlistStorage } from "@/lib/watchlist-storage";

export function useLocalWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    function refresh() {
      setWatchlist(readWatchlistStorage());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(WATCHLIST_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(WATCHLIST_EVENT, refresh);
    };
  }, []);

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);

  function add(symbol: string) {
    const cleaned = normalizeWatchlistSymbol(symbol);
    if (!cleaned) return;
    const next = Array.from(new Set([...readWatchlistStorage(), cleaned])).sort();
    writeWatchlistStorage(next);
    setWatchlist(readWatchlistStorage());
  }

  function remove(symbol: string) {
    const cleaned = normalizeWatchlistSymbol(symbol);
    writeWatchlistStorage(readWatchlistStorage().filter((item) => item !== cleaned));
    setWatchlist(readWatchlistStorage());
  }

  function toggle(symbol: string) {
    const cleaned = normalizeWatchlistSymbol(symbol);
    if (!cleaned) return;
    if (readWatchlistStorage().includes(cleaned)) remove(cleaned);
    else add(cleaned);
  }

  function isWatched(symbol: string) {
    return watchlistSet.has(normalizeWatchlistSymbol(symbol));
  }

  return { add, isWatched, remove, toggle, watchlist, watchlistSet };
}
