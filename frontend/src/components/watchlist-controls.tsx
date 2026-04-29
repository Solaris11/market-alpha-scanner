"use client";

import Link from "next/link";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import { normalizeWatchlistSymbol } from "@/lib/watchlist-storage";

export function WatchlistButton({ className = "", showLabel = true, symbol }: { className?: string; showLabel?: boolean; symbol: string }) {
  const cleaned = normalizeWatchlistSymbol(symbol);
  const { isWatched, toggle } = useLocalWatchlist();
  const saved = isWatched(cleaned);
  const label = saved ? "Remove from Watchlist" : "Add to Watchlist";

  return (
    <button
      aria-label={label}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-all duration-200 ${
        saved
          ? "border-amber-300/50 bg-amber-300/15 text-amber-100 hover:bg-amber-300/20"
          : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-amber-300/40 hover:bg-white/[0.07] hover:text-amber-100"
      } ${className}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(cleaned);
      }}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="text-sm leading-none">{saved ? "★" : "☆"}</span>
      {showLabel ? <span>{saved ? "Watchlist" : "Add to Watchlist"}</span> : null}
    </button>
  );
}

export function WatchlistPanel() {
  const { remove, watchlist } = useLocalWatchlist();

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Watchlist</div>
        <div className="font-mono text-[11px] text-slate-500">{watchlist.length}</div>
      </div>
      <div className="mt-2 divide-y divide-white/10 text-xs">
        {watchlist.length ? (
          watchlist.map((symbol) => (
            <div className="flex items-center justify-between gap-2 py-2" key={symbol}>
              <Link className="font-mono font-semibold text-cyan-200 hover:text-cyan-100" href={`/symbol/${symbol}`}>
                {symbol}
              </Link>
              <button className="text-[11px] text-slate-500 hover:text-rose-200" onClick={() => remove(symbol)} type="button">
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="py-2 text-slate-500">Add symbols with the star button.</div>
        )}
      </div>
    </section>
  );
}
