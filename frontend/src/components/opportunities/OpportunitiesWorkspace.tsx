"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type DecisionFilter = "ALL" | "ENTER" | "WAIT" | "WATCH" | "AVOID";

export function OpportunitiesWorkspace({ best, marketCondition, rows }: { best: OpportunityViewModel | null; marketCondition: string | null; rows: OpportunityViewModel[] }) {
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [minScore, setMinScore] = useState(0);

  const sectors = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => cleanText(row.sector, "")).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const filtered = useMemo(() => {
    return rows
      .filter((row) => decisionMatches(decision(row), decisionFilter))
      .filter((row) => sectorFilter === "ALL" || cleanText(row.sector, "") === sectorFilter)
      .filter((row) => (row.final_score ?? 0) >= minScore)
      .sort((left, right) => right.conviction - left.conviction || left.symbol.localeCompare(right.symbol));
  }, [decisionFilter, minScore, rows, sectorFilter]);

  const actionable = filtered.filter((row) => decision(row) === "ENTER");
  const watchlist = filtered.filter((row) => decision(row) === "WAIT_PULLBACK" || decision(row) === "WATCH");
  const avoid = filtered.filter((row) => decision(row) === "AVOID" || decision(row) === "EXIT");

  return (
    <div className="space-y-5">
      <BestTradeNowOpportunityCard best={best} marketCondition={marketCondition} />

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

      <OpportunitySection empty="No actionable setups. Monitor WATCH candidates." rows={actionable} title="Best Setup Right Now" />
      <OpportunitySection empty="No watchlist candidates in the current filter." rows={watchlist} title="Watchlist Candidates" />

      <details className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.22em] text-slate-400">Avoid / Overextended</summary>
        <div className="mt-4">
          <OpportunityGrid empty="No blocked setups in the current filter." rows={avoid} />
        </div>
      </details>
    </div>
  );
}

function BestTradeNowOpportunityCard({ best, marketCondition }: { best: OpportunityViewModel | null; marketCondition: string | null }) {
  if (!best) {
    return (
      <GlassPanel className="overflow-hidden p-6 md:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Best Trade Now</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">No trade recommended right now</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Market conditions: {cleanText(marketCondition, "not favorable").toUpperCase()} - wait for pullbacks or stronger confirmation.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="overflow-hidden p-6 shadow-[0_0_90px_rgba(34,211,238,0.12)] md:p-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Best Trade Now</div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-5xl font-black tracking-tight text-slate-50 md:text-6xl">{best.symbol}</h2>
            <DecisionBadge className="px-5 py-2 text-base" value={best.final_decision} />
          </div>
          <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(best.company_name || best.sector, "Scanner signal")}</div>
          <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-100">{cleanText(best.decision_reason, "Decision reason is not available yet.")}</p>
          <p className="mt-3 text-sm font-semibold text-cyan-200">This is the highest-conviction setup in the current market.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition-all duration-200 hover:bg-cyan-200" href={`/symbol/${best.symbol}`}>
              View Trade Plan
            </Link>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              Conviction <span className="font-mono font-semibold text-slate-50">{best.conviction}</span>/100
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <HeroMetric label="Conviction" value={`${best.conviction} ${best.confidenceLabel}`} />
          <HeroMetric label="Score" value={formatNumber(best.final_score, 0)} />
          <HeroMetric label="Entry" value={formatMoney(best.suggested_entry)} />
          <HeroMetric label="Stop" value={formatMoney(best.stop_loss)} tone="risk" />
          <HeroMetric label="Target" value={formatMoney(best.target)} tone="reward" />
          <HeroMetric label="Price" value={formatMoney(best.price)} />
        </div>
      </div>
    </GlassPanel>
  );
}

function OpportunitySection({ empty, rows, title }: { empty: string; rows: OpportunityViewModel[]; title: string }) {
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Signal Group" title={title} meta={`${rows.length.toLocaleString()} names`} />
      <div className="mt-4">
        <OpportunityGrid empty={empty} rows={rows} />
      </div>
    </GlassPanel>
  );
}

function OpportunityGrid({ empty, rows }: { empty: string; rows: OpportunityViewModel[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">{empty}</div>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => <OpportunityCard key={row.symbol} row={row} />)}
    </div>
  );
}

function OpportunityCard({ row }: { row: OpportunityViewModel }) {
  return (
    <Link className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.07]" href={`/symbol/${row.symbol}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-3xl font-black text-slate-50">{row.symbol}</div>
          <div className="mt-1 truncate text-xs text-slate-400">{cleanText(row.company_name || row.sector, "Signal")}</div>
        </div>
        <DecisionBadge className="shrink-0 px-4 py-1.5" value={row.final_decision} />
      </div>
      <div className="mt-4 text-sm leading-6 text-slate-300">{cleanText(row.decision_reason, "Decision reason is not available yet.")}</div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <CardMetric label="Conviction" value={`${row.conviction} ${row.confidenceLabel}`} />
        <CardMetric label="Score" value={formatNumber(row.final_score, 0)} />
        <CardMetric label="Price" value={formatMoney(row.price)} />
        <CardMetric label="Entry" value={formatMoney(row.suggested_entry)} />
      </div>
    </Link>
  );
}

function HeroMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "reward" | "risk" }) {
  const color = tone === "reward" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-slate-50";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 truncate font-mono text-lg font-bold ${color}`}>{value}</div>
    </div>
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

function decision(row: OpportunityViewModel) {
  return cleanText(row.final_decision, "WATCH").toUpperCase();
}
