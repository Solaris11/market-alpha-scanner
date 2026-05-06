"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { readableText } from "@/lib/ui/labels";
import { WatchlistButton } from "@/components/watchlist-controls";
import { DecisionBadge } from "./DecisionBadge";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function MyWatchlistWidget({ rows }: { rows: OpportunityViewModel[] }) {
  const { watchlist } = useLocalWatchlist();
  const rowLookup = useMemo(() => new Map(rows.map((row) => [row.symbol, row])), [rows]);
  const watchedItems = useMemo(() => watchlist.slice(0, 8).map((symbol) => ({ row: rowLookup.get(symbol) ?? null, symbol })), [rowLookup, watchlist]);

  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="My Watchlist" title="Tracked Symbols" meta={`${watchlist.length.toLocaleString()} saved`} />
      <div className="mt-4 space-y-3">
        {watchedItems.length ? (
          watchedItems.map((item) => (item.row ? <WatchlistRow key={item.symbol} row={item.row} /> : <MissingWatchlistRow key={item.symbol} symbol={item.symbol} />))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
            Add symbols with the star button to track them here.
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function WatchlistRow({ row }: { row: OpportunityViewModel }) {
  const router = useRouter();
  const href = `/symbol/${row.symbol}`;
  const openDetail = () => router.push(href);
  return (
    <div
      className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="font-mono text-lg font-black text-slate-50 hover:text-cyan-100" href={href} onClick={(event) => event.stopPropagation()}>
            {row.symbol}
          </Link>
          <div className="truncate text-xs text-slate-500">{cleanText(row.company_name || row.sector, "Signal")}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <WatchlistButton showLabel={false} symbol={row.symbol} />
          <DecisionBadge value={row.final_decision} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MiniMetric label="Price" value={formatMoney(row.price)} />
        <MiniMetric label="Conviction" value={`${formatNumber(row.conviction, 0)} ${row.confidenceLabel}`} />
        <MiniMetric label="Entry / Correction" value={row.entryZoneLabel ?? formatMoney(row.suggested_entry)} />
        <MiniMetric label="Reason" value={readableText(row.decision_reason, "N/A")} />
      </div>
    </div>
  );
}

function MissingWatchlistRow({ symbol }: { symbol: string }) {
  const router = useRouter();
  const href = `/symbol/${symbol}`;
  return (
    <div
      className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.07]"
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <Link className="font-mono font-black text-slate-50 hover:text-cyan-100" href={href} onClick={(event) => event.stopPropagation()}>
        {symbol}
      </Link>
      <WatchlistButton showLabel={false} symbol={symbol} />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/40 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-slate-100">{value}</div>
    </div>
  );
}
