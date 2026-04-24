"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const WATCHLIST_STORAGE_KEY = "market-alpha-scanner-watchlist";
const WATCHLIST_EVENT = "market-alpha-scanner-watchlist-change";

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function readWatchlist() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => normalizeSymbol(String(item))).filter(Boolean))).sort();
  } catch {
    return [];
  }
}

function writeWatchlist(symbols: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).sort();
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

function useLocalWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    function refresh() {
      setWatchlist(readWatchlist());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(WATCHLIST_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(WATCHLIST_EVENT, refresh);
    };
  }, []);

  function add(symbol: string) {
    const cleaned = normalizeSymbol(symbol);
    if (!cleaned) return;
    writeWatchlist([...readWatchlist(), cleaned]);
    setWatchlist(readWatchlist());
  }

  function remove(symbol: string) {
    const cleaned = normalizeSymbol(symbol);
    writeWatchlist(readWatchlist().filter((item) => item !== cleaned));
    setWatchlist(readWatchlist());
  }

  return { watchlist, add, remove };
}

export function WatchlistButton({ symbol }: { symbol: string }) {
  const cleaned = normalizeSymbol(symbol);
  const { watchlist, add, remove } = useLocalWatchlist();
  const saved = watchlist.includes(cleaned);

  return (
    <button
      className={`mt-3 rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
        saved
          ? "border-rose-400/35 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15"
          : "border-sky-400/40 bg-sky-400/10 text-sky-100 hover:bg-sky-400/15"
      }`}
      onClick={() => (saved ? remove(cleaned) : add(cleaned))}
      type="button"
    >
      {saved ? "Remove from Watchlist" : "Add to Watchlist"}
    </button>
  );
}

export function WatchlistPanel() {
  const { watchlist, remove } = useLocalWatchlist();

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Watchlist</div>
        <div className="font-mono text-[11px] text-slate-500">{watchlist.length}</div>
      </div>
      <div className="mt-2 divide-y divide-slate-800 text-xs">
        {watchlist.length ? (
          watchlist.map((symbol) => (
            <div className="flex items-center justify-between gap-2 py-2" key={symbol}>
              <Link className="font-mono font-semibold text-sky-200 hover:text-sky-100" href={`/symbol/${symbol}`}>
                {symbol}
              </Link>
              <button className="text-[11px] text-slate-500 hover:text-rose-200" onClick={() => remove(symbol)} type="button">
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="py-2 text-slate-500">Add symbols from detail pages.</div>
        )}
      </div>
    </section>
  );
}
