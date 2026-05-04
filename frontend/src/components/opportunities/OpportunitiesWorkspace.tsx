"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import { DataHealthIndicator } from "@/components/data-health-indicator";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { WatchlistButton } from "@/components/watchlist-controls";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type DecisionFilter = "ALL" | "ENTER" | "WAIT_PULLBACK" | "WATCH" | "AVOID" | "EXIT";
type SortKey = "SCORE_DESC" | "CONVICTION_DESC" | "SYMBOL_ASC" | "PRICE_DESC" | "DECISION_PRIORITY";
type TabKey = "BEST" | "WATCHLIST" | "FULL";

const DECISION_OPTIONS: DecisionFilter[] = ["ALL", "ENTER", "WAIT_PULLBACK", "WATCH", "AVOID", "EXIT"];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "SCORE_DESC", label: "Score descending" },
  { value: "CONVICTION_DESC", label: "Conviction descending" },
  { value: "SYMBOL_ASC", label: "Symbol A-Z" },
  { value: "PRICE_DESC", label: "Price" },
  { value: "DECISION_PRIORITY", label: "Decision priority" },
];

export function OpportunitiesWorkspace({ best, marketCondition, rows }: { best: OpportunityViewModel | null; marketCondition: string | null; rows: OpportunityViewModel[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("BEST");
  const [assetTypeFilter, setAssetTypeFilter] = useState("ALL");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("ALL");
  const [entryStatusFilter, setEntryStatusFilter] = useState("ALL");
  const [minConviction, setMinConviction] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [qualityFilter, setQualityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("SCORE_DESC");
  const { watchlistSet } = useLocalWatchlist();

  const options = useMemo(() => {
    return {
      assetTypes: uniqueValues(rows.map((row) => row.assetType)),
      entryStatuses: uniqueValues(rows.map((row) => row.entryStatus)),
      qualities: uniqueValues(rows.map((row) => row.recommendationQualityLabel)),
      sectors: uniqueValues(rows.map((row) => row.sector)),
    };
  }, [rows]);

  const tabCounts = useMemo(() => {
    return {
      BEST: rows.filter(isBestSetup).length,
      WATCHLIST: rows.filter((row) => watchlistSet.has(row.symbol)).length,
      FULL: rows.length,
    };
  }, [rows, watchlistSet]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => tabMatches(row, activeTab, watchlistSet))
      .filter((row) => !showWatchlistOnly || watchlistSet.has(row.symbol))
      .filter((row) => {
        if (!query) return true;
        return row.symbol.toLowerCase().includes(query) || cleanText(row.company_name, "").toLowerCase().includes(query);
      })
      .filter((row) => decisionFilter === "ALL" || decision(row) === decisionFilter)
      .filter((row) => assetTypeFilter === "ALL" || cleanText(row.assetType, "") === assetTypeFilter)
      .filter((row) => sectorFilter === "ALL" || cleanText(row.sector, "") === sectorFilter)
      .filter((row) => entryStatusFilter === "ALL" || cleanText(row.entryStatus, "") === entryStatusFilter)
      .filter((row) => qualityFilter === "ALL" || cleanText(row.recommendationQualityLabel, "") === qualityFilter)
      .filter((row) => (row.final_score ?? 0) >= minScore)
      .filter((row) => row.conviction >= minConviction)
      .sort((left, right) => compareRows(left, right, sortKey));
  }, [activeTab, assetTypeFilter, decisionFilter, entryStatusFilter, minConviction, minScore, qualityFilter, rows, search, sectorFilter, showWatchlistOnly, sortKey, watchlistSet]);

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <BestTradeNowOpportunityCard best={best} marketCondition={marketCondition} />

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Opportunities" title="Scanner Universe" meta={`Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} symbols`} />
        <div className="mt-5 grid min-w-0 gap-2 sm:grid-cols-3">
          <TabButton active={activeTab === "BEST"} count={tabCounts.BEST} label="Best Setups" onClick={() => setActiveTab("BEST")} />
          <TabButton active={activeTab === "WATCHLIST"} count={tabCounts.WATCHLIST} label="Watchlist" onClick={() => setActiveTab("WATCHLIST")} />
          <TabButton active={activeTab === "FULL"} count={tabCounts.FULL} label="Full Universe" onClick={() => setActiveTab("FULL")} />
        </div>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(150px,1fr))]">
          <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Search
            <input
              className="mt-1 h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50"
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Symbol or company"
              type="search"
              value={search}
            />
          </label>
          <Select label="Decision" onChange={(value) => setDecisionFilter(value as DecisionFilter)} value={decisionFilter}>
            {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{option === "ALL" ? "All decisions" : option}</option>)}
          </Select>
          <Select label="Asset Type" onChange={setAssetTypeFilter} value={assetTypeFilter}>
            <option value="ALL">All asset types</option>
            {options.assetTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select label="Sector" onChange={setSectorFilter} value={sectorFilter}>
            <option value="ALL">All sectors</option>
            {options.sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </Select>
          <NumberInput label="Min Score" max={100} onChange={setMinScore} value={minScore} />
          <NumberInput label="Min Conviction" max={100} onChange={setMinConviction} value={minConviction} />
          <Select label="Entry Status" onChange={setEntryStatusFilter} value={entryStatusFilter}>
            <option value="ALL">Any entry status</option>
            {options.entryStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select label="Quality" onChange={setQualityFilter} value={qualityFilter}>
            <option value="ALL">Any quality</option>
            {options.qualities.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select label="Sort" onChange={(value) => setSortKey(value as SortKey)} value={sortKey}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <label className="flex min-w-0 items-center gap-3 self-end rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 sm:h-10">
            <input checked={showWatchlistOnly} className="h-4 w-4 accent-amber-300" onChange={(event) => setShowWatchlistOnly(event.currentTarget.checked)} type="checkbox" />
            Show only Watchlist
          </label>
        </div>
      </GlassPanel>

      <OpportunitySection
        empty={activeTab === "WATCHLIST" ? "No watchlist symbols match the current search and filters." : activeTab === "FULL" ? "No symbols match the current search and filters." : "No setups match the current search and filters."}
        rows={filtered}
        title={tabTitle(activeTab)}
      />
    </div>
  );
}

function BestTradeNowOpportunityCard({ best, marketCondition }: { best: OpportunityViewModel | null; marketCondition: string | null }) {
  if (!best) {
    return (
      <GlassPanel className="overflow-hidden p-6 md:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Top Setup</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">No research setup right now</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Market conditions: {cleanText(marketCondition, "not favorable").toUpperCase()} - wait for pullbacks or stronger confirmation.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="overflow-hidden p-6 shadow-[0_0_90px_rgba(34,211,238,0.12)] md:p-8">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Top Setup</div>
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="min-w-0 font-mono text-4xl font-black tracking-tight text-slate-50 sm:text-5xl md:text-6xl">{best.symbol}</h2>
            <DecisionBadge className="px-4 py-2 text-sm sm:px-5 sm:text-base" value={best.final_decision} />
            <DataHealthIndicator freshness={best.dataFreshness} />
          </div>
          <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(best.company_name || best.sector, "Scanner signal")}</div>
          <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-100">{cleanText(best.decision_reason, "Decision reason is not available yet.")}</p>
          <p className="mt-3 text-sm font-semibold text-cyan-200">This is the highest-conviction research setup in the current market.</p>
          <div className="mt-5 flex min-w-0 flex-wrap gap-3">
            <Link className="w-full rounded-full bg-cyan-300 px-5 py-2.5 text-center text-sm font-bold text-slate-950 transition-all duration-200 hover:bg-cyan-200 sm:w-auto" href={`/symbol/${best.symbol}`}>
              View Research Plan
            </Link>
            <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              Conviction <span className="font-mono font-semibold text-slate-50">{best.conviction}</span>/100
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <HeroMetric label="Conviction" value={`${best.conviction} ${best.confidenceLabel}`} />
          <HeroMetric label="Score" value={formatNumber(best.final_score, 0)} />
          <HeroMetric label="Entry" value={best.entryZoneLabel ?? formatMoney(best.suggested_entry)} />
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
    <GlassPanel className="p-4 sm:p-5">
      <SectionTitle eyebrow="Symbol Browser" title={title} meta={`${rows.length.toLocaleString()} symbols`} />
      <div className="mt-4">
        <OpportunityGrid empty={empty} rows={rows} />
      </div>
    </GlassPanel>
  );
}

function OpportunityGrid({ empty, rows }: { empty: string; rows: OpportunityViewModel[] }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">{empty}</div>;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => <OpportunityCard key={row.symbol} row={row} />)}
    </div>
  );
}

function OpportunityCard({ row }: { row: OpportunityViewModel }) {
  return (
    <article className="w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/[0.07]">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-2xl font-black text-slate-50 sm:text-3xl">{row.symbol}</div>
          <div className="mt-1 text-xs text-slate-400">{cleanText(row.company_name || row.sector, "Signal")}</div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <WatchlistButton showLabel={false} symbol={row.symbol} />
          <DecisionBadge className="px-3 py-1.5 sm:px-4" value={row.final_decision} />
        </div>
      </div>
      <div className="mt-3">
        <DataHealthIndicator compact freshness={row.dataFreshness} />
      </div>
      <div className="mt-4 text-sm leading-6 text-slate-300">{cleanText(row.decision_reason, "Decision reason is not available yet.")}</div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <CardMetric label="Price" value={formatMoney(row.price)} />
        <CardMetric label="Decision" value={cleanText(row.final_decision, "WATCH")} />
        <CardMetric label="Conviction" value={`${row.conviction} ${row.confidenceLabel}`} />
        <CardMetric label="Score" value={formatNumber(row.final_score, 0)} />
        <CardMetric label="Entry / Correction" value={row.entryZoneLabel ?? formatMoney(row.suggested_entry)} />
        <CardMetric label="Quality" value={cleanText(row.recommendationQualityLabel, "N/A")} />
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs text-slate-500">{cleanText(row.assetType, "Asset")} {row.sector ? `- ${row.sector}` : ""}</div>
        <Link className="w-full rounded-full bg-cyan-300 px-4 py-2 text-center text-xs font-bold text-slate-950 transition-all duration-200 hover:bg-cyan-200 sm:w-auto" href={`/symbol/${row.symbol}`}>
          View Trade Plan
        </Link>
      </div>
    </article>
  );
}

function HeroMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "reward" | "risk" }) {
  const color = tone === "reward" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-slate-50";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-mono text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function NumberInput({ label, max, onChange, value }: { label: string; max: number; onChange: (value: number) => void; value: number }) {
  return (
    <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
      <input
        className="mt-1 h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50"
        max={max}
        min={0}
        onChange={(event) => onChange(clampNumber(Number(event.currentTarget.value), 0, max))}
        type="number"
        value={value}
      />
    </label>
  );
}

function Select({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
      <select className="mt-1 h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {children}
      </select>
    </label>
  );
}

function TabButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      className={`min-w-0 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${active ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-50" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/30 hover:bg-white/[0.07]"}`}
      onClick={onClick}
      type="button"
    >
      <div className="text-sm font-bold">{label}</div>
      <div className="mt-1 font-mono text-xs text-slate-400">{count.toLocaleString()} symbols</div>
    </button>
  );
}

function uniqueValues(values: Array<string | null>): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value, "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function tabMatches(row: OpportunityViewModel, tab: TabKey, watchlistSet: Set<string>) {
  if (tab === "FULL") return true;
  if (tab === "WATCHLIST") return watchlistSet.has(row.symbol);
  return isBestSetup(row);
}

function isBestSetup(row: OpportunityViewModel) {
  const value = decision(row);
  return value === "ENTER" || value === "WAIT_PULLBACK" || (value === "WATCH" && row.conviction >= 70);
}

function tabTitle(tab: TabKey) {
  if (tab === "FULL") return "Full Universe";
  if (tab === "WATCHLIST") return "Watchlist";
  return "Best Setups";
}

function decision(row: OpportunityViewModel) {
  return cleanText(row.final_decision, "WATCH").toUpperCase();
}

function compareRows(left: OpportunityViewModel, right: OpportunityViewModel, sortKey: SortKey) {
  if (sortKey === "SYMBOL_ASC") return left.symbol.localeCompare(right.symbol);
  if (sortKey === "CONVICTION_DESC") return right.conviction - left.conviction || left.symbol.localeCompare(right.symbol);
  if (sortKey === "PRICE_DESC") return numericDesc(left.price, right.price) || left.symbol.localeCompare(right.symbol);
  if (sortKey === "DECISION_PRIORITY") return decisionPriority(left) - decisionPriority(right) || right.conviction - left.conviction || left.symbol.localeCompare(right.symbol);
  return numericDesc(left.final_score, right.final_score) || right.conviction - left.conviction || left.symbol.localeCompare(right.symbol);
}

function decisionPriority(row: OpportunityViewModel) {
  const value = decision(row);
  if (value === "ENTER") return 0;
  if (value === "WAIT_PULLBACK") return 1;
  if (value === "WATCH") return 2;
  if (value === "EXIT") return 3;
  if (value === "AVOID") return 4;
  return 5;
}

function numericDesc(left: number | null, right: number | null) {
  const leftValue = left ?? Number.NEGATIVE_INFINITY;
  const rightValue = right ?? Number.NEGATIVE_INFINITY;
  return rightValue - leftValue;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
