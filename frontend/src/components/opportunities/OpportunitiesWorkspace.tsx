"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import {
  computeConviction,
  decision,
  selectBestTradeNow,
  shortReason,
  tradeLevels,
  type EdgeLookup,
} from "@/lib/trading/conviction";
import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { BestTradeNowCard } from "@/components/terminal/BestTradeNowCard";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type DecisionFilter = "ALL" | "ENTER" | "WAIT" | "WATCH" | "AVOID";

export function OpportunitiesWorkspace({ edges, regime, rows }: { edges: EdgeLookup; regime: MarketRegime; rows: RankingRow[] }) {
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [minScore, setMinScore] = useState(0);

  const sectors = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => cleanText(row.sector, "")).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const best = useMemo(() => selectBestTradeNow(rows, edges), [edges, rows]);
  const filtered = useMemo(() => {
    return rows
      .filter((row) => decisionMatches(decision(row), decisionFilter))
      .filter((row) => sectorFilter === "ALL" || cleanText(row.sector, "") === sectorFilter)
      .filter((row) => (finiteNumber(row.final_score) ?? 0) >= minScore)
      .sort((left, right) => computeConviction(right, edges[right.symbol.toUpperCase()]).score - computeConviction(left, edges[left.symbol.toUpperCase()]).score);
  }, [decisionFilter, edges, minScore, rows, sectorFilter]);

  const actionable = filtered.filter((row) => decision(row) === "ENTER");
  const watchlist = filtered.filter((row) => decision(row) === "WAIT_PULLBACK" || decision(row) === "WATCH");
  const avoid = filtered.filter((row) => decision(row) === "AVOID" || decision(row) === "EXIT");

  return (
    <div className="space-y-5">
      <BestTradeNowCard best={best} edges={edges} regime={regime} />

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Opportunities" title="Decision-First Signal List" meta={`${filtered.length.toLocaleString()} shown`} />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Decision
            <select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none" value={decisionFilter} onChange={(event) => setDecisionFilter(event.currentTarget.value as DecisionFilter)}>
              <option value="ALL">All decisions</option>
              <option value="ENTER">ENTER</option>
              <option value="WAIT">WAIT</option>
              <option value="WATCH">WATCH</option>
              <option value="AVOID">AVOID</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Sector
            <select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none" value={sectorFilter} onChange={(event) => setSectorFilter(event.currentTarget.value)}>
              <option value="ALL">All sectors</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Min Score
            <input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-sm normal-case tracking-normal text-slate-100 outline-none" min={0} max={100} type="number" value={minScore} onChange={(event) => setMinScore(Number(event.currentTarget.value) || 0)} />
          </label>
        </div>
      </GlassPanel>

      <OpportunitySection empty="No actionable setups. Monitor WATCH candidates." rows={actionable} title="Best Setup Right Now" edges={edges} />
      <OpportunitySection empty="No watchlist candidates in the current filter." rows={watchlist} title="Watchlist Candidates" edges={edges} />

      <details className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.22em] text-slate-400">Avoid / Overextended</summary>
        <div className="mt-4">
          <OpportunityGrid empty="No blocked setups in the current filter." rows={avoid} edges={edges} />
        </div>
      </details>
    </div>
  );
}

function OpportunitySection({ edges, empty, rows, title }: { edges: EdgeLookup; empty: string; rows: RankingRow[]; title: string }) {
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Signal Group" title={title} meta={`${rows.length.toLocaleString()} names`} />
      <div className="mt-4">
        <OpportunityGrid empty={empty} rows={rows} edges={edges} />
      </div>
    </GlassPanel>
  );
}

function OpportunityGrid({ edges, empty, rows }: { edges: EdgeLookup; empty: string; rows: RankingRow[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">{empty}</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => <OpportunityCard edge={edges[row.symbol.toUpperCase()]} key={row.symbol} row={row} />)}
    </div>
  );
}

function OpportunityCard({ edge, row }: { edge?: EdgeLookup[string]; row: RankingRow }) {
  const conviction = computeConviction(row, edge);
  const levels = tradeLevels(row);
  return (
    <Link className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.07]" href={`/symbol/${row.symbol}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-3xl font-black text-slate-50">{row.symbol}</div>
          <div className="mt-1 truncate text-xs text-slate-400">{cleanText(row.company_name || row.sector, "Signal")}</div>
        </div>
        <DecisionBadge className="shrink-0 px-4 py-1.5" value={row.final_decision} />
      </div>
      <div className="mt-4 text-sm leading-6 text-slate-300">{shortReason(row)}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <CardMetric label="Conviction" value={`${conviction.score} ${conviction.label}`} />
        <CardMetric label="Score" value={formatNumber(row.final_score, 0)} />
        <CardMetric label="Price" value={formatMoney(row.price)} />
        <CardMetric label="Entry" value={formatMoney(levels.entry)} />
      </div>
    </Link>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function decisionMatches(value: string, filter: DecisionFilter) {
  if (filter === "ALL") return true;
  if (filter === "WAIT") return value === "WAIT_PULLBACK";
  if (filter === "AVOID") return value === "AVOID" || value === "EXIT";
  return value === filter;
}
