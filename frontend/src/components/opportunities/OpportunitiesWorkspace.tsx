"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import { DataHealthIndicator } from "@/components/data-health-indicator";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { confidenceTone } from "@/lib/trading/confidence";
import { buildDecisionFactors, buildDecisionIntelligence, type DecisionFactor } from "@/lib/trading/decision-intelligence";
import type { ScannerScalar } from "@/lib/types";
import { cleanText, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel, readableText } from "@/lib/ui/labels";
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
  const [setupFilter, setSetupFilter] = useState("ALL");
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("SCORE_DESC");
  const { watchlistSet } = useLocalWatchlist();

  const options = useMemo(() => {
    return {
      assetTypes: uniqueValues(rows.map((row) => row.assetType)),
      entryStatuses: uniqueValues(rows.map((row) => row.entryStatus)),
      qualities: uniqueValues(rows.map((row) => row.recommendationQualityLabel)),
      sectors: uniqueValues(rows.map((row) => row.sector)),
      setups: uniqueValues(rows.map((row) => setupType(row))),
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
      .filter((row) => setupFilter === "ALL" || setupType(row) === setupFilter)
      .filter((row) => entryStatusFilter === "ALL" || cleanText(row.entryStatus, "") === entryStatusFilter)
      .filter((row) => qualityFilter === "ALL" || cleanText(row.recommendationQualityLabel, "") === qualityFilter)
      .filter((row) => (row.final_score ?? 0) >= minScore)
      .filter((row) => row.conviction >= minConviction)
      .sort((left, right) => compareRows(left, right, sortKey));
  }, [activeTab, assetTypeFilter, decisionFilter, entryStatusFilter, minConviction, minScore, qualityFilter, rows, search, sectorFilter, setupFilter, showWatchlistOnly, sortKey, watchlistSet]);
  const activeFilterCount = [
    activeTab !== "BEST",
    assetTypeFilter !== "ALL",
    decisionFilter !== "ALL",
    entryStatusFilter !== "ALL",
    minConviction > 0,
    minScore > 0,
    qualityFilter !== "ALL",
    Boolean(search.trim()),
    sectorFilter !== "ALL",
    setupFilter !== "ALL",
    showWatchlistOnly,
  ].filter(Boolean).length;

  function resetFilters() {
    setActiveTab("BEST");
    setAssetTypeFilter("ALL");
    setDecisionFilter("ALL");
    setEntryStatusFilter("ALL");
    setMinConviction(0);
    setMinScore(0);
    setQualityFilter("ALL");
    setSearch("");
    setSectorFilter("ALL");
    setSetupFilter("ALL");
    setShowWatchlistOnly(false);
    setSortKey("SCORE_DESC");
  }

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <BestTradeNowOpportunityCard best={best} highestScored={highestScoredSetups(rows)} marketCondition={marketCondition} priceSeries={bestPriceSeries} rows={rows} />
      <OpportunityDeskMap marketCondition={marketCondition} rows={rows} />
      <SetupDistribution rows={rows} />

      <GlassPanel className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle eyebrow="Opportunities" title="Scanner Universe" meta={`Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} symbols`} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-cyan-300/15 bg-cyan-400/5 px-3 py-1.5">
              {activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : "No extra filters"}
            </span>
            <button
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!activeFilterCount && sortKey === "SCORE_DESC"}
              onClick={resetFilters}
              type="button"
            >
              Reset Filters
            </button>
          </div>
        </div>
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
            {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{option === "ALL" ? "All decisions" : decisionLabel(option)}</option>)}
          </Select>
          <Select label="Asset Type" onChange={setAssetTypeFilter} value={assetTypeFilter}>
            <option value="ALL">All asset types</option>
            {options.assetTypes.map((item) => <option key={item} value={item}>{humanizeLabel(item)}</option>)}
          </Select>
          <Select label="Sector" onChange={setSectorFilter} value={sectorFilter}>
            <option value="ALL">All sectors</option>
            {options.sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
          </Select>
          <Select label="Setup" onChange={setSetupFilter} value={setupFilter}>
            <option value="ALL">All setups</option>
            {options.setups.map((setup) => <option key={setup} value={setup}>{setupLabel(setup)}</option>)}
          </Select>
          <NumberInput label="Min Score" max={100} onChange={setMinScore} value={minScore} />
          <NumberInput label="Min Conviction" max={100} onChange={setMinConviction} value={minConviction} />
          <Select label="Entry Status" onChange={setEntryStatusFilter} value={entryStatusFilter}>
            <option value="ALL">Any entry status</option>
            {options.entryStatuses.map((item) => <option key={item} value={item}>{humanizeLabel(item)}</option>)}
          </Select>
          <Select label="Quality" onChange={setQualityFilter} value={qualityFilter}>
            <option value="ALL">Any quality</option>
            {options.qualities.map((item) => <option key={item} value={item}>{humanizeLabel(item)}</option>)}
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

function OpportunityDeskMap({ marketCondition, rows }: { marketCondition: string | null; rows: OpportunityViewModel[] }) {
  const pulse = setupPulse(rows);
  const setupCounts = countBy(rows, (row) => setupLabel(setupType(row)));
  const assetCounts = countBy(rows, (row) => humanizeLabel(row.assetType, "Unknown"));
  const riskBlocked = rows.filter((row) => decision(row) === "AVOID" || hasVetoes(row.raw.vetoes)).length;
  const fallbackCount = rows.filter((row) => Boolean(row.raw.data_provider_fallback_used)).length;
  const staleCount = rows.filter((row) => Boolean(row.raw.stale_data) || String(row.raw.data_freshness_status ?? "").toLowerCase().includes("stale")).length;
  const improving = [...rows]
    .map((row) => ({ change: numeric(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change), row }))
    .filter((item): item is { change: number; row: OpportunityViewModel } => item.change !== null)
    .sort((left, right) => right.change - left.change)
    .slice(0, 4);
  const topRows = improving.length ? improving : highestScoredSetups(rows).slice(0, 4).map((row) => ({ change: null, row }));

  return (
    <GlassPanel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle eyebrow="Opportunity Map" title="Desktop Intelligence Board" meta="data-backed latest scan context" />
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">{cleanText(marketCondition, "Neutral")}</div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <CompactPulseCard title="Setup Distribution" value={compactMapLabel(setupCounts)} detail={pulse.breadthDetail} />
          <CompactPulseCard title="Asset Coverage" value={compactMapLabel(assetCounts)} detail="Shows where the latest scan has research context, not recommendations." />
          <CompactPulseCard title="Risk Filter Summary" value={`${riskBlocked} blocked`} detail="Avoid and vetoed rows remain visible so risk context is not hidden." />
          <CompactPulseCard title="Data Quality" value={`${fallbackCount} fallback · ${staleCount} stale`} detail="Provider fallback and stale flags reduce confidence in the scanner payload." />
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Top movement / highest score</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {topRows.map((item) => (
              <Link className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.07]" href={`/symbol/${item.row.symbol}`} key={item.row.symbol}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-base font-black text-slate-50">{item.row.symbol}</div>
                  <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">{decisionLabel(item.row.final_decision)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.change === null ? `Score ${formatNumber(item.row.final_score, 0)}` : `${item.change > 0 ? "+" : ""}${item.change.toFixed(1)} change`} · {item.row.conviction} readiness
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function BestTradeNowOpportunityCard({
  best,
  highestScored,
  marketCondition,
  priceSeries,
  rows,
}: {
  best: OpportunityViewModel | null;
  highestScored: OpportunityViewModel[];
  marketCondition: string | null;
  priceSeries: Record<string, ScannerScalar>[];
  rows: OpportunityViewModel[];
}) {
  if (!best) {
    return (
      <GlassPanel className="overflow-hidden p-5 md:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Top Setup</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">No research setup right now</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Market conditions: {cleanText(marketCondition, "not favorable").toUpperCase()} - wait for pullbacks or stronger confirmation.
        </p>
        <HighestScoredSetups rows={highestScored} />
        <OpportunityHeroIntelligence marketCondition={marketCondition} rows={rows} />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="overflow-hidden p-5 shadow-[0_0_90px_rgba(34,211,238,0.12)] md:p-6">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Top Setup</div>
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
            <Link className="min-w-0 font-mono text-4xl font-black tracking-tight text-slate-50 transition hover:text-cyan-100 sm:text-5xl md:text-6xl" href={`/symbol/${best.symbol}`}>{best.symbol}</Link>
            <DecisionBadge className="px-4 py-2 text-sm sm:px-5 sm:text-base" value={best.final_decision} />
            <DataHealthIndicator freshness={best.dataFreshness} />
          </div>
          <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(best.company_name || best.sector, "Scanner signal")}</div>
          <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-100">{readableText(best.decision_reason, "Decision reason is not available yet.")}</p>
          <p className="mt-3 text-sm font-semibold text-cyan-200">This is the highest-conviction research setup in the current market.</p>
          <div className="mt-5 flex min-w-0 flex-wrap gap-3">
            <div className="font-mono text-sm font-bold text-cyan-100">
              Tap or click {best.symbol} for symbol detail
            </div>
            <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              Conviction <span className="font-mono font-semibold text-slate-50">{best.conviction}</span>/100
            </div>
          </div>
          <HighestScoredSetups rows={highestScored} />
          <OpportunityHeroIntelligence marketCondition={marketCondition} rows={rows} />
        </div>

        <TopSetupIntelligencePanel best={best} candles={rowsToCandles(priceSeries)} />
      </div>
    </GlassPanel>
  );
}

function TopSetupIntelligencePanel({ best, candles }: { best: OpportunityViewModel; candles: ChartCandle[] }) {
  const row = best.raw;
  const intelligence = buildDecisionIntelligence(row);
  const factors = buildDecisionFactors(row);
  const readinessTone = confidenceTone(intelligence.readiness_score);
  return (
    <aside className="space-y-3">
      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Why this setup</summary>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <InsightList title="Positive factors" items={intelligence.why.positives} />
            <InsightList title="Negative factors" items={intelligence.why.negatives} />
          </div>
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">What to watch</summary>
        <InsightList className="mt-3" title="Improvement conditions" items={intelligence.what_to_watch} />
      </details>

      <details className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Regime impact</summary>
        <p className="mt-3 text-xs leading-5 text-slate-300">{intelligence.regime_impact}</p>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Setup profile</summary>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-950/35 p-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Setup</div>
            <div className="mt-1 text-sm font-bold text-slate-100">{setupLabel(intelligence.setup_type)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Strength</div>
            <div className={`mt-1 font-mono text-lg font-black ${readinessTone.textClass}`}>{intelligence.setup_strength}</div>
          </div>
        </div>
        <InsightList className="mt-3" title="Setup reasons" items={intelligence.setup_reasons} />
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Readiness</summary>
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Research readiness</div>
            <div className={`font-mono text-lg font-black ${readinessTone.textClass}`}>{intelligence.readiness_score}</div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div className={`h-full rounded-full ${readinessTone.barClass}`} style={{ width: `${Math.max(4, Math.min(100, intelligence.readiness_score))}%` }} />
          </div>
          <div className="mt-2 text-[11px] leading-5 text-slate-500">Research only. Not financial advice.</div>
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Setup health</summary>
        <div className="mt-3 space-y-2">
          {setupHealthRows(factors).map((factor) => <HealthBar key={factor.key} label={factor.label} value={factor.value} />)}
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Mini price context</summary>
        <div className="mt-3">
          <MiniPriceContextChart candles={candles} entryContext={best.entryZoneLabel ?? formatMoney(best.suggested_entry)} height={260} symbol={best.symbol} />
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Risk snapshot</summary>
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

function SetupDistribution({ rows }: { rows: OpportunityViewModel[] }) {
  const groups = setupGroups(rows);
  return (
    <GlassPanel className="p-4 sm:p-5">
      <SectionTitle eyebrow="Setup Groups" title="Setup-Aware Scanner View" meta="Research grouping, not recommendations" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={group.setup}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{setupLabel(group.setup)}</div>
                <div className="mt-2 font-mono text-2xl font-black text-slate-50">{group.count}</div>
              </div>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">{formatNumber(group.avgStrength, 0)} strength</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{group.reason}</p>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function OpportunityHeroIntelligence({ marketCondition, rows }: { marketCondition: string | null; rows: OpportunityViewModel[] }) {
  const pulse = setupPulse(rows);
  const topImproving = [...rows]
    .map((row) => ({ change: numeric(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change), row }))
    .filter((item): item is { change: number; row: OpportunityViewModel } => item.change !== null)
    .sort((left, right) => right.change - left.change)
    .slice(0, 3);
  const riskBlocked = rows.filter((row) => decision(row) === "AVOID" || hasVetoes(row.raw.vetoes)).length;
  const highReadiness = rows.filter((row) => row.conviction >= 70).length;
  const fallbackCount = rows.filter((row) => Boolean(row.raw.data_provider_fallback_used)).length;

  return (
    <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Opportunity Pulse</div>
          <p className="mt-1 text-xs text-slate-500">Compact context for the visible desktop setup area.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[10px] font-semibold text-slate-300">{cleanText(marketCondition, "Neutral")}</div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-5">
        <CompactPulseCard title="Readiness Heatmap" value={`${highReadiness} high readiness`} detail={`${pulse.confidence}. Confidence is not a prediction.`} />
        <CompactPulseCard title="Regime Alignment" value={cleanText(marketCondition, "Neutral")} detail={pulse.breadthDetail} />
        <CompactPulseCard title="Risk Filters" value={`${riskBlocked} blocked`} detail="Blocked rows are preserved as context so the scanner does not force activity." />
        <CompactPulseCard title="Data Quality" value={`${fallbackCount} fallbacks`} detail={pulse.scannerDetail} />
        <CompactPulseCard title="Setup Focus" value={pulse.breadth} detail="Use setup groups to compare research context before opening symbol detail." />
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Top improving symbols</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {topImproving.length ? topImproving.map((item) => (
            <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${item.row.symbol}`} key={item.row.symbol}>
              <div className="font-mono text-sm font-black text-slate-50">{item.row.symbol}</div>
              <div className="mt-1 text-xs text-slate-400">{item.change > 0 ? "+" : ""}{item.change.toFixed(1)} change · {decisionLabel(item.row.final_decision)}</div>
            </Link>
          )) : rows.slice(0, 3).map((row) => (
            <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${row.symbol}`} key={row.symbol}>
              <div className="font-mono text-sm font-black text-slate-50">{row.symbol}</div>
              <div className="mt-1 text-xs text-slate-400">{decisionLabel(row.final_decision)} · {row.conviction} readiness</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function HighestScoredSetups({ rows }: { rows: OpportunityViewModel[] }) {
  const displayRows = rows.slice(0, 5);
  if (!displayRows.length) return null;
  const pulse = setupPulse(rows);
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
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <CompactPulseCard title="Setup Momentum" value={pulse.momentum} detail={pulse.momentumDetail} />
        <CompactPulseCard title="Market Breadth Pulse" value={pulse.breadth} detail={pulse.breadthDetail} />
        <CompactPulseCard title="Confidence Distribution" value={pulse.confidence} detail={pulse.confidenceDetail} />
        <CompactPulseCard title="Scanner Pulse" value={pulse.scanner} detail={pulse.scannerDetail} />
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
      <div className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">{firstReason(row)}</div>
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
  const router = useRouter();
  const href = `/symbol/${row.symbol}`;
  const openDetail = () => router.push(href);
  return (
    <article
      className="w-full min-w-0 max-w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
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
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link className="relative z-10 inline-flex min-h-9 items-center font-mono text-2xl font-black text-slate-50 transition hover:text-cyan-100 sm:text-3xl" href={href} onClick={(event) => event.stopPropagation()}>{row.symbol}</Link>
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
      <div className="mt-4 text-sm leading-6 text-slate-300">{readableText(row.decision_reason, "Decision reason is not available yet.")}</div>
      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <CardMetric label="Price" value={formatMoney(row.price)} />
        <CardMetric label="Decision" value={decisionLabel(row.final_decision)} />
        <CardMetric label="Conviction" value={`${row.conviction} ${row.confidenceLabel}`} />
        <CardMetric label="Score" value={formatNumber(row.final_score, 0)} />
        <CardMetric label="Entry / Correction" value={row.entryZoneLabel ?? formatMoney(row.suggested_entry)} />
        <CardMetric label="Quality" value={humanizeLabel(row.recommendationQualityLabel)} />
      </div>
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs text-slate-500">{cleanText(row.assetType, "Asset")} {row.sector ? `- ${row.sector}` : ""}</div>
        <div className="text-xs font-semibold text-cyan-200 opacity-90">Tap for symbol detail</div>
      </div>
    </article>
  );
}

function CompactPulseCard({ detail, title, value }: { detail: string; title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-1 break-words font-mono text-sm font-black leading-5 text-slate-50">{value}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{detail}</div>
    </div>
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

function highestScoredSetups(rows: OpportunityViewModel[]): OpportunityViewModel[] {
  return [...rows]
    .sort((left, right) => (right.final_score ?? 0) - (left.final_score ?? 0) || right.conviction - left.conviction)
    .slice(0, 5);
}

function firstReason(row: OpportunityViewModel): string {
  return buildDecisionIntelligence(row.raw).why.positives[0] ?? "Scanner confidence and risk filters define this research state.";
}

function setupGroups(rows: OpportunityViewModel[]): Array<{ avgStrength: number; count: number; reason: string; setup: string }> {
  const order = ["PULLBACK", "BREAKOUT", "CONTINUATION", "AVOID"];
  return order.map((setup) => {
    const matching = rows.filter((row) => setupType(row) === setup);
    const strengths = matching.map((row) => numeric(row.raw.setup_strength)).filter((value): value is number => value !== null);
    const avgStrength = strengths.length ? strengths.reduce((total, value) => total + value, 0) / strengths.length : 0;
    return {
      avgStrength,
      count: matching.length,
      reason: setupGroupReason(setup),
      setup,
    };
  });
}

function setupPulse(rows: OpportunityViewModel[]): {
  breadth: string;
  breadthDetail: string;
  confidence: string;
  confidenceDetail: string;
  momentum: string;
  momentumDetail: string;
  scanner: string;
  scannerDetail: string;
} {
  const setupCounts = countBy(rows, (row) => setupLabel(setupType(row)));
  const decisionCounts = countBy(rows, (row) => decisionLabel(row.final_decision));
  const highestSetup = topCount(setupCounts) ?? "Mixed";
  const highestDecision = topCount(decisionCounts) ?? "Watch";
  const high = rows.filter((row) => row.conviction >= 70).length;
  const medium = rows.filter((row) => row.conviction >= 50 && row.conviction < 70).length;
  const low = Math.max(0, rows.length - high - medium);
  const fallbackCount = rows.filter((row) => Boolean(row.raw.data_provider_fallback_used)).length;
  const staleCount = rows.filter((row) => Boolean(row.raw.stale_data) || String(row.raw.data_freshness_status ?? "").toLowerCase().includes("stale")).length;
  const topMomentum = [...rows]
    .sort((left, right) => (numeric(right.raw.score_change) ?? 0) - (numeric(left.raw.score_change) ?? 0))
    .find((row) => numeric(row.raw.score_change) !== null);
  const currentRegime = humanizeLabel(rows[0]?.raw.market_regime ?? rows[0]?.raw.regime ?? "Neutral");

  return {
    breadth: `${highestSetup} / ${highestDecision}`,
    breadthDetail: `${rows.length.toLocaleString()} symbols grouped by setup and final decision.`,
    confidence: `${high} high · ${medium} medium · ${low} low`,
    confidenceDetail: "Confidence reflects scanner strength and data quality, not a prediction.",
    momentum: topMomentum ? `${topMomentum.symbol} improving` : "Stable scan",
    momentumDetail: topMomentum ? `Largest available score change: ${formatNumber(numeric(topMomentum.raw.score_change), 1)}.` : "No score-change feed is available in this view yet.",
    scanner: `${fallbackCount} fallback · ${staleCount} stale`,
    scannerDetail: `Current regime: ${currentRegime}. CSV fallback remains disabled in production.`,
  };
}

function hasVetoes(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  const text = String(value ?? "").trim();
  return Boolean(text && !["[]", "nan", "none", "null"].includes(text.toLowerCase()));
}

function countBy(rows: OpportunityViewModel[], keyFor: (row: OpportunityViewModel) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function topCount(counts: Map<string, number>): string | null {
  let selected: string | null = null;
  let selectedCount = -1;
  for (const [key, count] of counts) {
    if (count > selectedCount) {
      selected = key;
      selectedCount = count;
    }
  }
  return selected;
}

function compactMapLabel(counts: Map<string, number>): string {
  const pairs = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2);
  if (!pairs.length) return "No data";
  return pairs.map(([label, count]) => `${label} ${count}`).join(" · ");
}

function setupType(row: OpportunityViewModel): string {
  const raw = cleanText(row.raw.setup_type, "AVOID").toUpperCase().replace(/[\s-]+/g, "_");
  if (raw === "PULLBACK" || raw.includes("PULLBACK") || raw.includes("AVWAP")) return "PULLBACK";
  if (raw === "BREAKOUT" || raw.includes("BREAKOUT")) return "BREAKOUT";
  if (raw === "CONTINUATION" || raw.includes("CONTINUATION") || raw.includes("TREND")) return "CONTINUATION";
  return "AVOID";
}

function setupLabel(value: string): string {
  if (value === "PULLBACK") return "Pullback";
  if (value === "BREAKOUT") return "Breakout";
  if (value === "CONTINUATION") return "Continuation";
  return "Avoid";
}

function setupGroupReason(value: string): string {
  if (value === "PULLBACK") return "Trend is being monitored for cleaner pullback context.";
  if (value === "BREAKOUT") return "Breakout candidates require volume and non-extended structure.";
  if (value === "CONTINUATION") return "Continuation candidates require trend and momentum alignment.";
  return "Avoid group is blocked by setup quality, risk, or data constraints.";
}

function setupHealthRows(factors: DecisionFactor[]): DecisionFactor[] {
  const wanted = new Set(["trend", "momentum", "volume", "risk"]);
  return factors.filter((factor) => wanted.has(factor.key));
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
