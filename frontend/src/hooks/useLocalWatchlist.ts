"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { normalizeWatchlistSymbol, readWatchlistStorage, WATCHLIST_EVENT, writeWatchlistStorage } from "@/lib/watchlist-storage";

type WatchlistResponse = {
  authenticated?: boolean;
  error?: string;
  symbols?: unknown;
};

export function useLocalWatchlist() {
  const { authenticated, loading, user } = useCurrentUser();
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

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    async function syncAuthenticatedWatchlist() {
      if (!authenticated || !user) {
        setWatchlist(readWatchlistStorage());
        return;
      }

      const localSymbols = readWatchlistStorage();
      try {
        const response = await csrfFetch("/api/user/watchlist", {
          body: JSON.stringify({ symbols: localSymbols }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as WatchlistResponse | null;
        if (!response.ok) throw new Error(payload?.error ?? "Failed to sync watchlist.");
        const symbols = symbolsFromPayload(payload);
        writeWatchlistStorage(symbols);
        if (!cancelled) setWatchlist(symbols);
      } catch {
        if (!cancelled) setWatchlist(localSymbols);
      }
    }

    void syncAuthenticatedWatchlist();
    return () => {
      cancelled = true;
    };
  }, [authenticated, loading, user]);

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);

  function add(symbol: string) {
    const cleaned = normalizeWatchlistSymbol(symbol);
    if (!cleaned) return;
    const next = cleanSymbols([...watchlist, ...readWatchlistStorage(), cleaned]);
    applyLocalSymbols(next);
    if (authenticated) {
      void saveAuthenticatedSymbols([cleaned], next);
    }
  }

  function remove(symbol: string) {
    const cleaned = normalizeWatchlistSymbol(symbol);
    const next = cleanSymbols([...watchlist, ...readWatchlistStorage()].filter((item) => item !== cleaned));
    applyLocalSymbols(next);
    if (authenticated) {
      void removeAuthenticatedSymbol(cleaned, next);
    }
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

  function applyLocalSymbols(symbols: string[]) {
    const cleaned = cleanSymbols(symbols);
    writeWatchlistStorage(cleaned);
    setWatchlist(cleaned);
  }

  async function saveAuthenticatedSymbols(symbols: string[], fallback: string[]) {
    try {
      const response = await csrfFetch("/api/user/watchlist", {
        body: JSON.stringify({ symbols }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as WatchlistResponse | null;
      if (!response.ok) throw new Error(payload?.error ?? "Failed to save watchlist.");
      applyLocalSymbols(symbolsFromPayload(payload));
    } catch {
      applyLocalSymbols(fallback);
    }
  }

  async function removeAuthenticatedSymbol(symbol: string, fallback: string[]) {
    try {
      const response = await csrfFetch(`/api/user/watchlist/${encodeURIComponent(symbol)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as WatchlistResponse | null;
      if (!response.ok) throw new Error(payload?.error ?? "Failed to remove watchlist symbol.");
      applyLocalSymbols(symbolsFromPayload(payload));
    } catch {
      applyLocalSymbols(fallback);
    }
  }

  return { add, isWatched, remove, toggle, watchlist, watchlistSet };
}

function symbolsFromPayload(payload: WatchlistResponse | null): string[] {
  if (!payload || !Array.isArray(payload.symbols)) return [];
  return cleanSymbols(payload.symbols.map((item) => String(item ?? "")));
}

function cleanSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map(normalizeWatchlistSymbol).filter(Boolean))).sort();
}
