"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import { DataHealthIndicator } from "@/components/data-health-indicator";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { confidenceTone } from "@/lib/trading/confidence";
import type { ScannerScalar } from "@/lib/types";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { WatchlistButton } from "@/components/watchlist-controls";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { MiniPriceContextChart } from "@/components/terminal/MiniPriceContextChart";
import type { ChartCandle } from "@/components/terminal/SymbolChart";
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

export function OpportunitiesWorkspace({ best, bestPriceSeries, marketCondition, rows }: { best: OpportunityViewModel | null; bestPriceSeries: Record<string, ScannerScalar>[]; marketCondition: string | null; rows: OpportunityViewModel[] }) {
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
      <BestTradeNowOpportunityCard best={best} highestScored={highestScoredSetups(rows)} marketCondition={marketCondition} priceSeries={bestPriceSeries} />

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

function BestTradeNowOpportunityCard({ best, highestScored, marketCondition, priceSeries }: { best: OpportunityViewModel | null; highestScored: OpportunityViewModel[]; marketCondition: string | null; priceSeries: Record<string, ScannerScalar>[] }) {
  if (!best) {
    return (
      <GlassPanel className="overflow-hidden p-5 md:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Top Setup</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">No research setup right now</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Market conditions: {cleanText(marketCondition, "not favorable").toUpperCase()} - wait for pullbacks or stronger confirmation.
        </p>
        <HighestScoredSetups rows={highestScored} />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="overflow-hidden p-5 shadow-[0_0_90px_rgba(34,211,238,0.12)] md:p-6">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
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
          <HighestScoredSetups rows={highestScored} />
        </div>

        <TopSetupIntelligencePanel best={best} candles={rowsToCandles(priceSeries)} />
      </div>
    </GlassPanel>
  );
}

function TopSetupIntelligencePanel({ best, candles }: { best: OpportunityViewModel; candles: ChartCandle[] }) {
  const row = best.raw;
  const reasons = reasonList(row.decision_reason_codes ?? best.decision_reason);
  const vetoes = reasonList(row.vetoes ?? row.veto_reason ?? row.decision_reason_codes);
  const factors = factorRows(row);
  return (
    <aside className="space-y-3">
      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">Why this setup</summary>
        <div className="mt-3 grid gap-3">
          <InsightList title="Decision reasons" items={reasons.length ? reasons : [cleanText(best.decision_reason, "Scanner score, risk filters, and data quality define this research state.")]} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <InsightList title="Positive factors" items={topFactors(factors, true)} />
            <InsightList title="Negative factors" items={topFactors(factors, false)} />
          </div>
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">What to watch</summary>
        <InsightList className="mt-3" title="Improvement conditions" items={whatToWatch(vetoes)} />
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">Setup health</summary>
        <div className="mt-3 space-y-2">
          {["Trend", "Momentum", "Volume", "Risk"].map((label) => {
            const value = setupHealthValue(row, label);
            return <HealthBar key={label} label={label} value={value} />;
          })}
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">Mini price context</summary>
        <div className="mt-3">
          <MiniPriceContextChart candles={candles} entryContext={best.entryZoneLabel ?? formatMoney(best.suggested_entry)} height={260} symbol={best.symbol} />
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">Risk snapshot</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <HeroMetric label="ATR" value={formatNumber(row.atr)} />
          <HeroMetric label="Stop distance" value={stopDistance(best)} tone="risk" />
          <HeroMetric label="Volatility" value={percentLike(row.volatility ?? row.volatility_pct)} />
          <HeroMetric label="Risk state" value={cleanText(row.trade_quality ?? row.risk_reward_label, "Context only")} />
        </div>
      </details>
    </aside>
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

function HighestScoredSetups({ rows }: { rows: OpportunityViewModel[] }) {
  const displayRows = rows.slice(0, 5);
  if (!displayRows.length) return null;
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Highest-Scored Setups</div>
          <p className="mt-1 text-xs text-slate-500">Research setups, not recommendations.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
        {displayRows.map((row) => <HighestScoredSetupCard key={row.symbol} row={row} />)}
      </div>
    </div>
  );
}

function HighestScoredSetupCard({ row }: { row: OpportunityViewModel }) {
  const tone = confidenceTone(row.conviction);
  return (
    <Link
      className={`min-w-0 rounded-xl border bg-white/[0.04] p-3 transition-all duration-200 hover:border-cyan-300/40 hover:bg-white/[0.07] ${tone.borderClass}`}
      href={`/symbol/${row.symbol}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-lg font-black text-slate-50">{row.symbol}</div>
        <DecisionBadge className="px-2 py-1 text-[10px]" value={row.final_decision} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <MiniCardMetric label="Score" value={formatNumber(row.final_score, 0)} />
        <MiniCardMetric label="Ready" value={`${row.conviction}`} />
      </div>
      <div className={`mt-2 text-[10px] font-black uppercase tracking-[0.1em] ${tone.textClass}`}>{tone.label}</div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">{firstReason(row.raw.decision_reason_codes ?? row.decision_reason)}</div>
    </Link>
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
          View Research Plan
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

function MiniCardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950/45 px-2 py-1">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="truncate font-mono text-[12px] font-semibold text-slate-100">{value}</div>
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

function InsightList({ className = "", items, title }: { className?: string; items: string[]; title: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-slate-950/35 p-3 ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const color = value >= 65 ? "bg-emerald-300" : value < 40 ? "bg-rose-300" : "bg-amber-300";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-100">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function rowsToCandles(rows: Record<string, ScannerScalar>[]): ChartCandle[] {
  return rows
    .map((row) => {
      const time = textValue(row.date ?? row.datetime ?? row.timestamp_utc ?? row.time);
      const open = numeric(row.open ?? row.Open);
      const high = numeric(row.high ?? row.High);
      const low = numeric(row.low ?? row.Low);
      const close = numeric(row.close ?? row.Close);
      if (!time || open === null || high === null || low === null || close === null) return null;
      return { close, high, low, open, time };
    })
    .filter((candle): candle is ChartCandle => Boolean(candle));
}

function factorRows(row: OpportunityViewModel["raw"]): Array<{ label: string; value: number }> {
  return [
    { label: "Trend", value: numeric(row.trend_score ?? row.technical_score) ?? 50 },
    { label: "Momentum", value: numeric(row.momentum_score ?? row.technical_score) ?? 50 },
    { label: "Volume", value: numeric(row.volume_score ?? row.relative_volume_score) ?? 50 },
    { label: "Risk", value: Math.max(0, 100 - (numeric(row.risk_penalty) ?? 0) * 5) },
    { label: "Macro", value: numeric(row.macro_score) ?? 50 },
    { label: "Data quality", value: numeric(row.data_quality_score) ?? (row.stale_data ? 35 : 75) },
  ];
}

function highestScoredSetups(rows: OpportunityViewModel[]): OpportunityViewModel[] {
  return [...rows]
    .sort((left, right) => (right.final_score ?? 0) - (left.final_score ?? 0) || right.conviction - left.conviction)
    .slice(0, 5);
}

function firstReason(value: unknown): string {
  return reasonList(value)[0] ?? "Scanner score, confidence, and risk filters define this research state.";
}

function topFactors(factors: Array<{ label: string; value: number }>, positive: boolean): string[] {
  const sorted = [...factors].sort((a, b) => positive ? b.value - a.value : a.value - b.value).slice(0, 3);
  return sorted.map((factor) => `${factor.label}: ${Math.round(factor.value)} (${factor.value >= 65 ? "supportive" : factor.value < 40 ? "weak" : "mixed"})`);
}

function whatToWatch(vetoes: string[]): string[] {
  const mapped: string[] = [];
  for (const veto of vetoes) {
    const key = veto.toUpperCase().replace(/\s+/g, "_");
    if (key.includes("STALE")) mapped.push("Wait for scanner freshness to return to OK.");
    else if (key.includes("VOLATILITY")) mapped.push("Watch for volatility to cool and ranges to stabilize.");
    else if (key.includes("VOLUME")) mapped.push("Watch for stronger volume confirmation.");
    else if (key.includes("RISK_REWARD")) mapped.push("Watch for a cleaner risk/reward structure.");
    else if (key.includes("MACRO")) mapped.push("Watch for market regime alignment.");
    else if (key.includes("CONFIDENCE")) mapped.push("Watch for confidence to improve on later scans.");
  }
  if (mapped.length) return mapped;
  return [
    "Watch confidence and score behavior on the next scan.",
    "Watch whether current price moves closer to the entry context.",
    "Use the daily action and risk filters as the source of truth.",
  ];
}

function reasonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(cleanReason).filter(Boolean).slice(0, 6);
  const text = String(value ?? "").trim();
  if (!text || text === "[object Object]") return [];
  return text.split(/[,|;]/).map(cleanReason).filter(Boolean).slice(0, 6);
}

function setupHealthValue(row: OpportunityViewModel["raw"], label: string): number {
  if (label === "Trend") return numeric(row.trend_score ?? row.technical_score) ?? 50;
  if (label === "Momentum") return numeric(row.momentum_score ?? row.technical_score) ?? 50;
  if (label === "Volume") return numeric(row.volume_score ?? row.relative_volume_score) ?? 50;
  return Math.max(0, 100 - (numeric(row.risk_penalty) ?? 0) * 5);
}

function stopDistance(best: OpportunityViewModel): string {
  if (best.price === null || best.stop_loss === null || best.price <= 0) return "N/A";
  return `${Math.abs(((best.price - best.stop_loss) / best.price) * 100).toFixed(1)}%`;
}

function percentLike(value: unknown): string {
  const parsed = numeric(value);
  if (parsed === null) return "N/A";
  const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${percent.toFixed(1)}%`;
}

function cleanReason(value: string): string {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function textValue(value: ScannerScalar) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
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
