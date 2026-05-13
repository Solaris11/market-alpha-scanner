"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Eye, ShieldAlert, Target, Zap } from "lucide-react";
import { PremiumEChart } from "@/components/charts/PremiumEChart";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import { DataHealthIndicator } from "@/components/data-health-indicator";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { RiskTolerantOpportunityRadar } from "@/components/opportunities/RiskTolerantOpportunityRadar";
import { ShockMoveRadar } from "@/components/opportunities/ShockMoveRadar";
import { AdaptiveLearningInsightPanel } from "@/components/terminal/AdaptiveLearningInsightPanel";
import { ExecutionIntelligencePanel } from "@/components/terminal/ExecutionIntelligencePanel";
import { ScenarioIntelligencePanel } from "@/components/terminal/ScenarioIntelligencePanel";
import { StrategyIntelligencePanel } from "@/components/terminal/StrategyIntelligencePanel";
import { WorkflowEvolutionPanel } from "@/components/terminal/WorkflowEvolutionPanel";
import { InstitutionalIntelligencePanel } from "@/components/terminal/InstitutionalIntelligencePanel";
import { IntradayRegimeDriftPanel } from "@/components/terminal/IntradayRegimeDriftPanel";
import { MetaIntelligenceOperatingSystemPanel } from "@/components/terminal/MetaIntelligenceOperatingSystemPanel";
import type { AdaptiveLearningSystem } from "@/lib/trading/adaptive-learning";
import type { ScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import type { StrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";
import { type UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { confidenceTone } from "@/lib/trading/confidence";
import { buildDecisionFactors, buildDecisionIntelligence, type DecisionFactor } from "@/lib/trading/decision-intelligence";
import { buildExecutionIntelligence, type ExecutionIntelligence, type ExecutionTone } from "@/lib/trading/execution-intelligence";
import { compactInstitutionalLabels } from "@/lib/trading/institutional-intelligence";
import { buildOpportunityActionability, type OpportunityActionability } from "@/lib/trading/opportunity-actionability";
import {
  applyNonTabOpportunityFilters,
  compareOpportunityRows,
  opportunityDecision,
  opportunityEmptyMessage,
  opportunityIsBestSetup,
  opportunityIsMomentumContinuation,
  opportunityIsShockPotential,
  opportunityRankingExplanation,
  opportunitySetupLabel,
  opportunitySetupType,
  opportunityTabMatches,
  opportunityVisibilityReason,
  type OpportunityDecisionFilter as DecisionFilter,
  type OpportunityFilterState,
  type OpportunitySortKey as SortKey,
  type OpportunityTabKey as TabKey,
} from "@/lib/trading/opportunity-filtering";
import { buildRiskTolerantOpportunities } from "@/lib/trading/risk-tolerant-opportunities";
import type { IntradayDriftRow, ScannerScalar } from "@/lib/types";
import { cleanText, finiteNumber, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";
import { WatchlistButton } from "@/components/watchlist-controls";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { MiniPriceContextChart } from "@/components/terminal/MiniPriceContextChart";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { HeatDots, ScoreFactorStrip, type ScoreFactor, VisualMetricRail } from "@/components/visual/MiniVisuals";
import { InteractiveInsightZoneGrid, type InteractiveInsightZoneItem } from "@/components/visual/InteractiveVisualIntelligence";
import { SymbolIdentityLine, SymbolLogo } from "@/components/visual/SymbolLogo";
import { getSymbolVisualIdentity } from "@/lib/visual-identity";
import type { ChartCandle } from "@/components/terminal/SymbolChart";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { buildDistributionBarOption, buildDonutOption, hasDistributionData, type DistributionRow } from "@/lib/echarts-options";

const DECISION_OPTIONS: DecisionFilter[] = ["ALL", "ENTER", "WAIT_PULLBACK", "WATCH", "AVOID", "EXIT"];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "SCORE_DESC", label: "Score descending" },
  { value: "CONVICTION_DESC", label: "Conviction descending" },
  { value: "SYMBOL_ASC", label: "Symbol A-Z" },
  { value: "PRICE_DESC", label: "Price" },
  { value: "DECISION_PRIORITY", label: "Decision priority" },
];
const FIRST_REVIEW_GUIDE_KEY = "tradeveto_first_opportunity_review_hidden_v1";
const TAB_QUERY_MAP: Record<string, TabKey> = {
  best: "BEST",
  full: "FULL",
  momentum: "MOMENTUM",
  pullback: "PULLBACK",
  risk: "RISK_TOLERANT",
  risk_tolerant: "RISK_TOLERANT",
  shock: "SHOCK",
  watchlist: "WATCHLIST",
};

export function OpportunitiesWorkspace({
  adaptiveLearning = null,
  best,
  bestPriceSeries,
  initialProfile,
  intradayDriftRows = [],
  marketCondition,
  rows,
  scenarioIntelligence = null,
  strategyIntelligence = null,
  workflowEvolution,
}: {
  adaptiveLearning?: AdaptiveLearningSystem | null;
  best: OpportunityViewModel | null;
  bestPriceSeries: Record<string, ScannerScalar>[];
  initialProfile?: UserPersonalizationProfile;
  intradayDriftRows?: IntradayDriftRow[];
  marketCondition: string | null;
  rows: OpportunityViewModel[];
  scenarioIntelligence?: ScenarioIntelligenceSystem | null;
  strategyIntelligence?: StrategyIntelligenceSystem | null;
  workflowEvolution?: WorkflowEvolutionSummary;
}) {
  const searchParams = useSearchParams();
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
  const [showFirstReviewGuide, setShowFirstReviewGuide] = useState(false);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("SCORE_DESC");
  const { watchlistSet } = useLocalWatchlist();
  const riskTolerantRows = useMemo(() => buildRiskTolerantOpportunities(rows, { riskLevel: "high", rewardLevel: "high" }, { includeProfileMismatches: true, limit: 25 }), [rows]);
  const riskTolerantSymbols = useMemo(() => new Set(riskTolerantRows.map((candidate) => candidate.symbol)), [riskTolerantRows]);
  const filterState: OpportunityFilterState = useMemo(
    () => ({
      activeTab,
      assetTypeFilter,
      decisionFilter,
      entryStatusFilter,
      minConviction,
      minScore,
      qualityFilter,
      search,
      sectorFilter,
      setupFilter,
      showWatchlistOnly,
      sortKey,
    }),
    [
      activeTab,
      assetTypeFilter,
      decisionFilter,
      entryStatusFilter,
      minConviction,
      minScore,
      qualityFilter,
      search,
      sectorFilter,
      setupFilter,
      showWatchlistOnly,
      sortKey,
    ],
  );
  const deferredFilterState = useDeferredValue(filterState);
  const filterUpdating = deferredFilterState !== filterState;

  const options = useMemo(() => {
    return {
      assetTypes: uniqueValues(rows.map((row) => row.assetType)),
      entryStatuses: uniqueValues(rows.map((row) => row.entryStatus)),
      qualities: uniqueValues(rows.map((row) => row.recommendationQualityLabel)),
      sectors: uniqueValues(rows.map((row) => row.sector)),
      setups: uniqueValues(rows.map((row) => opportunitySetupType(row))),
    };
  }, [rows]);

  useEffect(() => {
    const requestedTab = TAB_QUERY_MAP[String(searchParams.get("tab") ?? "").toLowerCase()];
    if (requestedTab) setActiveTab(requestedTab);
  }, [searchParams]);

  useEffect(() => {
    const explicitFirstRun = searchParams.get("firstRun") === "1";
    const hidden = window.localStorage.getItem(FIRST_REVIEW_GUIDE_KEY) === "true";
    setShowFirstReviewGuide(explicitFirstRun || (!hidden && rows.length > 0));
  }, [rows.length, searchParams]);

  useEffect(() => {
    if (assetTypeFilter !== "ALL" && !options.assetTypes.includes(assetTypeFilter)) setAssetTypeFilter("ALL");
    if (entryStatusFilter !== "ALL" && !options.entryStatuses.includes(entryStatusFilter)) setEntryStatusFilter("ALL");
    if (qualityFilter !== "ALL" && !options.qualities.includes(qualityFilter)) setQualityFilter("ALL");
    if (sectorFilter !== "ALL" && !options.sectors.includes(sectorFilter)) setSectorFilter("ALL");
    if (setupFilter !== "ALL" && !options.setups.includes(setupFilter)) setSetupFilter("ALL");
  }, [
    assetTypeFilter,
    entryStatusFilter,
    options.assetTypes,
    options.entryStatuses,
    options.qualities,
    options.sectors,
    options.setups,
    qualityFilter,
    sectorFilter,
    setupFilter,
  ]);

  const tabCounts = useMemo(() => {
    return {
      BEST: rows.filter(opportunityIsBestSetup).length,
      MOMENTUM: rows.filter(opportunityIsMomentumContinuation).length,
      PULLBACK: rows.filter((row) => opportunitySetupType(row) === "PULLBACK").length,
      RISK_TOLERANT: riskTolerantSymbols.size,
      SHOCK: rows.filter(opportunityIsShockPotential).length,
      WATCHLIST: rows.filter((row) => watchlistSet.has(row.symbol)).length,
      FULL: rows.length,
    };
  }, [riskTolerantSymbols.size, rows, watchlistSet]);

  const filterResult = useMemo(() => {
    const fullUniverseRows = applyNonTabOpportunityFilters(rows, deferredFilterState, watchlistSet);
    const visibleRows = fullUniverseRows
      .filter((row) => opportunityTabMatches(row, deferredFilterState.activeTab, watchlistSet, riskTolerantSymbols))
      .sort((left, right) => compareOpportunityRows(left, right, deferredFilterState.sortKey, riskTolerantRows, deferredFilterState.activeTab));
    const sortedFullUniverseRows = [...fullUniverseRows].sort((left, right) => compareOpportunityRows(left, right, deferredFilterState.sortKey, riskTolerantRows, "FULL"));
    const matchingOutsideTab = deferredFilterState.activeTab === "FULL"
      ? []
      : sortedFullUniverseRows.filter((row) => !opportunityTabMatches(row, deferredFilterState.activeTab, watchlistSet, riskTolerantSymbols)).slice(0, 5);
    return {
      fullUniverseRows: sortedFullUniverseRows,
      matchingOutsideTab,
      tabRowCount: rows.filter((row) => opportunityTabMatches(row, deferredFilterState.activeTab, watchlistSet, riskTolerantSymbols)).length,
      visibleRows,
    };
  }, [
    deferredFilterState,
    riskTolerantRows,
    riskTolerantSymbols,
    rows,
    watchlistSet,
  ]);
  const filtered = filterResult.visibleRows;
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
  const activeCriteriaCount = [
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

  function clearCriteria() {
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
  }

  return (
    <div className="min-w-0 max-w-full space-y-5">
      {showFirstReviewGuide ? (
        <OpportunityFirstReviewGuide
          candidate={best ?? rows[0] ?? null}
          onDismiss={() => {
            window.localStorage.setItem(FIRST_REVIEW_GUIDE_KEY, "true");
            setShowFirstReviewGuide(false);
          }}
        />
      ) : null}
      <BestTradeNowOpportunityCard best={best} highestScored={highestScoredSetups(rows)} marketCondition={marketCondition} priceSeries={bestPriceSeries} rows={rows} />
      <OpportunityVisualCommandCenter marketCondition={marketCondition} rows={rows} watchlistSet={watchlistSet} />

      <GlassPanel className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionTitle eyebrow="Opportunities" title="Scanner Universe" meta={`Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} symbols`} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {filterUpdating ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 font-semibold text-cyan-100">
                Updating view...
              </span>
            ) : null}
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
        <div aria-label="Opportunity views" className="-mx-1 mt-5 flex min-w-0 snap-x gap-5 overflow-x-auto border-b border-white/10 px-1 pb-0 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden" role="tablist">
          <TabButton active={activeTab === "BEST"} count={tabCounts.BEST} label="Best Setups" onClick={() => setActiveTab("BEST")} />
          <TabButton active={activeTab === "RISK_TOLERANT"} count={tabCounts.RISK_TOLERANT} label="Risk-Tolerant" onClick={() => setActiveTab("RISK_TOLERANT")} />
          <TabButton active={activeTab === "SHOCK"} count={tabCounts.SHOCK} label="Shock Potential" onClick={() => setActiveTab("SHOCK")} />
          <TabButton active={activeTab === "PULLBACK"} count={tabCounts.PULLBACK} label="Pullback Watch" onClick={() => setActiveTab("PULLBACK")} />
          <TabButton active={activeTab === "MOMENTUM"} count={tabCounts.MOMENTUM} label="Momentum" onClick={() => setActiveTab("MOMENTUM")} />
          <TabButton active={activeTab === "WATCHLIST"} count={tabCounts.WATCHLIST} label="Watchlist" onClick={() => setActiveTab("WATCHLIST")} />
          <TabButton active={activeTab === "FULL"} count={tabCounts.FULL} label="Full Universe" onClick={() => setActiveTab("FULL")} />
        </div>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.3fr)_repeat(2,minmax(150px,1fr))_minmax(180px,0.9fr)]">
          <label className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Search
            <input
              className="mt-1 h-11 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50 sm:h-10"
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Symbol or company"
              type="search"
              value={search}
            />
          </label>
          <Select label="Decision" onChange={(value) => setDecisionFilter(value as DecisionFilter)} value={decisionFilter}>
            {DECISION_OPTIONS.map((option) => <option key={option} value={option}>{option === "ALL" ? "All decisions" : decisionLabel(option)}</option>)}
          </Select>
          <Select label="Sort" onChange={(value) => setSortKey(value as SortKey)} value={sortKey}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <label className="flex min-h-11 min-w-0 items-center gap-3 self-end rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 sm:h-10 sm:min-h-0">
            <input checked={showWatchlistOnly} className="h-4 w-4 accent-amber-300" onChange={(event) => setShowWatchlistOnly(event.currentTarget.checked)} type="checkbox" />
            Show only Watchlist
          </label>
        </div>
        <ResponsiveAdvancedDetails
          className="mt-3"
          eyebrow="Filters"
          summary="Use these when you need to narrow the universe. Leave them broad on mobile for more results."
          title="More search filters"
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(150px,1fr))]">
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
            {options.setups.map((setup) => <option key={setup} value={setup}>{opportunitySetupLabel(setup)}</option>)}
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
          </div>
        </ResponsiveAdvancedDetails>
        <FilterReliabilitySummary
          activeTab={activeTab}
          criteriaCount={activeCriteriaCount}
          fullUniverseCount={filterResult.fullUniverseRows.length}
          matchingOutsideTab={filterResult.matchingOutsideTab}
          sortKey={sortKey}
          tabRowCount={filterResult.tabRowCount}
          visibleCount={filtered.length}
        />
      </GlassPanel>

      <OpportunitySection
        activeFilterCount={activeFilterCount}
        activeTab={activeTab}
        criteriaCount={activeCriteriaCount}
        empty={opportunityEmptyMessage(activeTab, activeFilterCount, filterResult.fullUniverseRows.length, watchlistSet.size)}
        fullUniverseCount={filterResult.fullUniverseRows.length}
        matchingOutsideTab={filterResult.matchingOutsideTab}
        onClearCriteria={clearCriteria}
        onResetFilters={resetFilters}
        onShowFullUniverse={() => setActiveTab("FULL")}
        rows={filtered}
        sortKey={sortKey}
        title={tabTitle(activeTab)}
        totalRows={rows.length}
        watchlistCount={watchlistSet.size}
      />

      <ResponsiveAdvancedDetails
        deferMount
        eyebrow="Advanced context"
        summary="Secondary analytics load after the ranked opportunities so navigation stays responsive."
        title="Market, shock, execution, and strategy layers"
      >
        <MetaIntelligenceOperatingSystemPanel personalizationProfile={initialProfile} rows={rows} workflowEvolution={workflowEvolution ?? null} />
        <IntradayRegimeDriftPanel driftRows={intradayDriftRows} rows={rows} />
        <AdaptiveLearningInsightPanel system={adaptiveLearning} />
        <StrategyIntelligencePanel system={strategyIntelligence} />
        <ScenarioIntelligencePanel system={scenarioIntelligence} />
        <ExecutionIntelligencePanel rows={rows} />
        <RiskTolerantOpportunityRadar initialProfile={initialProfile} marketCondition={marketCondition} rows={rows} />
        <ShockMoveRadar rows={rows} />
        {workflowEvolution ? <WorkflowEvolutionPanel compact summary={workflowEvolution} surface="opportunities" /> : null}
        <InstitutionalIntelligencePanel rows={rows} />
        <OpportunityDeskMap marketCondition={marketCondition} rows={rows} />
        <SetupDistribution rows={rows} />
      </ResponsiveAdvancedDetails>
    </div>
  );
}

function OpportunityFirstReviewGuide({ candidate, onDismiss }: { candidate: OpportunityViewModel | null; onDismiss: () => void }) {
  const symbolHref = candidate ? `/symbol/${candidate.symbol}?firstRun=1` : "/terminal?firstRun=1";
  const symbolLabel = candidate?.symbol ?? "one symbol";
  return (
    <GlassPanel className="border-cyan-300/20 bg-cyan-400/[0.045] p-4 sm:p-5" data-onboarding-target="first-opportunity-review">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Guided first opportunity review</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Start with one candidate</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
            Review why it appears, what to wait for, and what can break it before scanning the full universe.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link className="rounded-full bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200" href={symbolHref}>
            Review {symbolLabel}
          </Link>
          <button className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-slate-400 transition hover:border-white/20 hover:text-slate-100" onClick={onDismiss} type="button">
            Hide guide
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <GuideCheckpoint title="1. Why it appears" text="Check the reason and evidence maturity." />
        <GuideCheckpoint title="2. What to wait for" text="Confirm timing, pullback, and entry quality." />
        <GuideCheckpoint title="3. What can break it" text="Review invalidation, chase risk, and downside." />
      </div>
    </GlassPanel>
  );
}

function GuideCheckpoint({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}

function OpportunityVisualCommandCenter({
  marketCondition,
  rows,
  watchlistSet,
}: {
  marketCondition: string | null;
  rows: OpportunityViewModel[];
  watchlistSet: Set<string>;
}) {
  const bestRows = rows.filter(opportunityIsBestSetup);
  const shockRows = rows.filter(opportunityIsShockPotential);
  const watchedRows = rows.filter((row) => watchlistSet.has(row.symbol));
  const riskRows = rows.filter((row) => opportunityDecision(row) === "AVOID" || row.fragility >= 68);
  const improvingRows = rows
    .map((row) => ({ change: numeric(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change), row }))
    .filter((item): item is { change: number; row: OpportunityViewModel } => item.change !== null)
    .sort((left, right) => right.change - left.change);
  const best = bestRows[0] ?? highestScoredSetups(rows)[0] ?? null;
  const topShock = shockRows[0] ?? null;
  const topRisk = riskRows[0] ?? null;
  const topWatched = watchedRows[0] ?? null;
  const averageScore = averageScoreValue(rows.map((row) => row.final_score));
  const averageConviction = averageScoreValue(rows.map((row) => row.conviction));
  const averageStability = averageScoreValue(rows.map((row) => 100 - row.fragility));

  const zones: InteractiveInsightZoneItem[] = [
    {
      bullets: [
        `${rows.length.toLocaleString()} symbols are in the latest scanner universe.`,
        `Market condition is ${cleanText(marketCondition, "not labeled")}.`,
        `Average score is ${averageScore === null ? "not available" : formatNumber(averageScore, 0)} and average conviction is ${averageConviction === null ? "not available" : formatNumber(averageConviction, 0)}.`,
      ],
      dataSource: "Latest scanner universe and opportunity view model",
      detailSummary: "This is the current map of the research universe. It shows coverage and average conditions without hiding weak or blocked rows.",
      detailTitle: "Universe Map",
      factors: [
        { label: "Avg Score", tone: "cyan", value: averageScore },
        { label: "Avg Conviction", tone: "emerald", value: averageConviction },
        { label: "Avg Stability", tone: "cyan", value: averageStability },
      ],
      href: "/opportunities?tab=full",
      icon: <BarChart3 className="h-6 w-6" />,
      id: "universe-map",
      label: "Universe Map",
      metric: rows.length.toLocaleString(),
      relatedSymbols: rows.slice(0, 12).map((row) => row.symbol),
      summary: `${rows.length.toLocaleString()} scanned symbols with ${bestRows.length.toLocaleString()} best-setup candidates.`,
      tone: "cyan",
    },
    {
      bullets: best ? [opportunityVisibilityReason(best, "BEST", "SCORE_DESC", 0), firstReason(best), `Evidence: ${evidenceSummary(best)}`] : ["No candidate currently clears the best-setup filter."],
      dataSource: "Opportunity score, conviction, evidence maturity, setup quality",
      detailSummary: best ? `${best.symbol} is the leading setup context in this view.` : "No top setup is available yet.",
      detailTitle: "Best Setup Stack",
      factors: best ? opportunityRowFactors(best) : [],
      href: best ? `/symbol/${best.symbol}` : "/opportunities?tab=best",
      icon: <Target className="h-6 w-6" />,
      id: "best-stack",
      label: "Best Stack",
      metric: bestRows.length.toLocaleString(),
      relatedSymbols: bestRows.slice(0, 12).map((row) => row.symbol),
      summary: best ? `${best.symbol}: ${firstReason(best)}` : "No best setup leader yet.",
      tone: "emerald",
    },
    {
      bullets: topShock ? [firstReason(topShock), `Current shock similarity: ${topShock.shockPattern?.currentSimilarityScore ?? "not scored"}/100`, `Chase risk: ${topShock.shockPattern?.chaseRiskLabel ?? "not scored"}`] : ["No shock-potential row is currently elevated."],
      dataSource: "Shock pattern map, large-move context, fragility, current setup quality",
      detailSummary: topShock ? `${topShock.symbol} has visible large-move research context.` : "No shock-potential candidate is currently elevated enough to lead this view.",
      detailTitle: "Shock Potential",
      factors: topShock ? opportunityRowFactors(topShock) : [],
      href: topShock ? `/symbol/${topShock.symbol}` : "/opportunities?tab=shock",
      icon: <Zap className="h-6 w-6" />,
      id: "shock-potential",
      label: "Shock Potential",
      metric: shockRows.length.toLocaleString(),
      relatedSymbols: shockRows.slice(0, 12).map((row) => row.symbol),
      summary: topShock ? `${topShock.symbol}: large-move context visible.` : "No elevated shock stack.",
      tone: "violet",
    },
    {
      bullets: topRisk ? [firstReason(topRisk), `Fragility ${topRisk.fragility}/100 (${topRisk.fragilityLabel})`, `Decision: ${decisionLabel(topRisk.final_decision)}`] : ["No avoid/high-fragility row dominates the current risk queue."],
      dataSource: "Risk vetoes, fragility, final decision, pressure fields",
      detailSummary: topRisk ? `${topRisk.symbol} is visible because risk conditions are elevated.` : "Risk is not concentrated in a single top row in this filtered view.",
      detailTitle: "Risk Watch",
      factors: topRisk ? opportunityRowFactors(topRisk) : [],
      href: topRisk ? `/symbol/${topRisk.symbol}` : "/opportunities?tab=full",
      icon: <ShieldAlert className="h-6 w-6" />,
      id: "risk-watch",
      label: "Risk Watch",
      metric: riskRows.length.toLocaleString(),
      relatedSymbols: riskRows.slice(0, 12).map((row) => row.symbol),
      summary: topRisk ? `${topRisk.symbol}: ${topRisk.fragilityLabel}` : "No dominant risk leader.",
      tone: "amber",
    },
    {
      bullets: topWatched ? [firstReason(topWatched), `Evidence: ${evidenceSummary(topWatched)}`, `Decision: ${decisionLabel(topWatched.final_decision)}`] : ["No watchlist rows are visible. Add symbols from symbol detail pages to personalize this view."],
      dataSource: "Local watchlist and current scanner rows",
      detailSummary: topWatched ? `${topWatched.symbol} is the current watchlist item with scanner context.` : "Watchlist intelligence appears after tracked symbols overlap current scanner rows.",
      detailTitle: "Watchlist Intelligence",
      factors: topWatched ? opportunityRowFactors(topWatched) : [],
      href: "/opportunities?tab=watchlist",
      icon: <Eye className="h-6 w-6" />,
      id: "watchlist-intel",
      label: "Watchlist",
      metric: watchedRows.length.toLocaleString(),
      relatedSymbols: watchedRows.slice(0, 12).map((row) => row.symbol),
      summary: watchedRows.length ? `${watchedRows.length} tracked symbols in scanner context.` : "No tracked scanner rows yet.",
      tone: "cyan",
    },
    {
      bullets: improvingRows.length
        ? improvingRows.slice(0, 5).map((item) => `${item.row.symbol}: ${item.change > 0 ? "+" : ""}${formatNumber(item.change, 1)} score/readiness change`)
        : ["No score-change field is available in this view yet."],
      dataSource: "Score/readiness/confidence change fields when present",
      detailSummary: improvingRows.length ? `${improvingRows[0].row.symbol} has the largest visible positive score/readiness change.` : "This scanner packet does not include enough change data for a movement chart.",
      detailTitle: "What Moved",
      factors: improvingRows[0] ? opportunityRowFactors(improvingRows[0].row) : [],
      href: improvingRows[0] ? `/symbol/${improvingRows[0].row.symbol}` : "/history",
      icon: <Activity className="h-6 w-6" />,
      id: "what-moved",
      label: "What Moved",
      metric: improvingRows.length.toLocaleString(),
      relatedSymbols: improvingRows.slice(0, 12).map((item) => item.row.symbol),
      summary: improvingRows.length ? `${improvingRows[0].row.symbol} moved most in the available change fields.` : "No validated movement feed yet.",
      tone: "rose",
    },
  ];

  return (
    <InteractiveInsightZoneGrid
      eyebrow="Visual opportunity map"
      summary="These zones are derived from the current scanner rows. Open one to inspect the scored factors and source context."
      title="Tap Into the Opportunity Stack"
      zones={zones}
    />
  );
}

function averageScoreValue(values: Array<number | null | undefined>): number | null {
  const safe = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!safe.length) return null;
  return safe.reduce((total, value) => total + value, 0) / safe.length;
}

function opportunityRowFactors(row: OpportunityViewModel): ScoreFactor[] {
  return [
    { label: "Score", tone: "cyan", value: row.final_score },
    { label: "Conviction", tone: "emerald", value: row.conviction },
    { label: "Stability", tone: row.fragility >= 68 ? "rose" : "emerald", value: Math.max(0, 100 - row.fragility) },
    { label: "Evidence", tone: row.evidence?.tier === "limited" ? "amber" : "emerald", value: row.evidence?.score },
  ];
}

function OpportunityDeskMap({ marketCondition, rows }: { marketCondition: string | null; rows: OpportunityViewModel[] }) {
  const pulse = setupPulse(rows);
  const setupCounts = countBy(rows, (row) => opportunitySetupLabel(opportunitySetupType(row)));
  const assetCounts = countBy(rows, (row) => humanizeLabel(row.assetType, "Unknown"));
  const riskBlocked = rows.filter((row) => opportunityDecision(row) === "AVOID" || hasVetoes(row.raw.vetoes)).length;
  const fallbackCount = rows.filter((row) => Boolean(row.raw.data_provider_fallback_used)).length;
  const eventRiskCount = rows.filter((row) => row.eventRisk >= 68).length;
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
          <CompactPulseCard title="Setup Distribution" value={compactMapLabel(setupCounts)} detail={humanizeInsightText(pulse.breadthDetail)} />
          <CompactPulseCard title="Asset Coverage" value={compactMapLabel(assetCounts)} detail="Shows where the latest scan has research context, not recommendations." />
          <CompactPulseCard title="Risk Filter Summary" value={`${riskBlocked} blocked`} detail="Avoided and vetoed rows stay visible so the risk picture is not hidden." />
          <CompactPulseCard title="Event / Data Quality" value={`${eventRiskCount} event pressure · ${fallbackCount} fallback`} detail={`${staleCount} stale rows. Verified events and provider quality both affect confidence.`} />
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
      <OpportunityInsightCharts rows={rows} />
    </GlassPanel>
  );
}

function OpportunityInsightCharts({ rows }: { rows: OpportunityViewModel[] }) {
  const setupRows = distributionRows(countBy(rows, (row) => opportunitySetupLabel(opportunitySetupType(row))), ["#67e8f9", "#a78bfa", "#34d399", "#fb7185"]);
  const decisionRows = distributionRows(countBy(rows, (row) => decisionLabel(row.final_decision)), ["#34d399", "#67e8f9", "#fbbf24", "#fb7185"]);
  const confidenceRows: DistributionRow[] = [
    { color: "#34d399", label: "High", value: rows.filter((row) => row.conviction >= 70).length },
    { color: "#fbbf24", label: "Medium", value: rows.filter((row) => row.conviction >= 50 && row.conviction < 70).length },
    { color: "#fb7185", label: "Low", value: rows.filter((row) => row.conviction < 50).length },
  ];

  if (!hasDistributionData(setupRows) && !hasDistributionData(decisionRows) && !hasDistributionData(confidenceRows)) {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
        Opportunity analytics will appear after scanner rows are available.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Setup Intelligence</div>
            <p className="mt-1 text-xs text-slate-500">Data-backed distribution from the latest scan.</p>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Research only</div>
        </div>
        {hasDistributionData(setupRows) ? (
          <PremiumEChart
            ariaLabel="Opportunity setup distribution chart"
            height={230}
            option={buildDistributionBarOption({ rows: setupRows, title: "Setup Distribution", vertical: true })}
          />
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No setup distribution data in the current scan.</div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          {hasDistributionData(decisionRows) ? (
            <PremiumEChart
              ariaLabel="Opportunity decision mix donut chart"
              height={220}
              option={buildDonutOption({ centerLabel: `${rows.length} rows`, rows: decisionRows, title: "Decision Mix" })}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No decision mix available.</div>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          {hasDistributionData(confidenceRows) ? (
            <PremiumEChart
              ariaLabel="Opportunity confidence distribution chart"
              height={220}
              option={buildDistributionBarOption({ rows: confidenceRows, title: "Confidence Distribution" })}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No confidence distribution available.</div>
          )}
        </div>
      </div>
    </div>
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
            <SymbolLogo companyName={best.company_name} sector={best.sector} size="lg" symbol={best.symbol} />
            <div className="min-w-0">
              <Link className="min-w-0 font-mono text-4xl font-black tracking-tight text-slate-50 transition hover:text-cyan-100 sm:text-5xl md:text-6xl" href={`/symbol/${best.symbol}`}>{best.symbol}</Link>
              <div className="mt-1"><SymbolIdentityLine companyName={best.company_name} sector={best.sector} symbol={best.symbol} /></div>
            </div>
            <DecisionBadge className="px-4 py-2 text-sm sm:px-5 sm:text-base" value={best.final_decision} />
            <DataHealthIndicator freshness={best.dataFreshness} />
          </div>
          <div className="mt-2 max-w-2xl text-base text-slate-400">{cleanText(best.company_name || best.sector, "Scanner signal")}</div>
          <p className="mt-5 max-w-3xl text-lg leading-7 text-slate-100">{humanizeInsightText(best.decision_reason, "Decision reason is not available yet.")}</p>
          <p className="mt-3 text-sm font-semibold text-cyan-200">{best.structuralLabel}. This is a research setup, not a trade instruction.</p>
          <div className="mt-5 flex min-w-0 flex-wrap gap-3">
            <div className="font-mono text-sm font-bold text-cyan-100">
              Tap or click {best.symbol} for symbol detail
            </div>
            <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              Conviction <span className="font-mono font-semibold text-slate-50">{best.conviction}</span>/100
            </div>
            <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              Fragility <span className="font-mono font-semibold text-slate-50">{best.fragility}</span>/100
            </div>
            <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              {best.macroLabel} <span className="font-mono font-semibold text-slate-50">{signedAdjustment(best.macroAdjustment)}</span>
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
  const actionability = buildOpportunityActionability(best);
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

      <details className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.055] p-4" open>
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Action context</summary>
        <p className="mt-3 text-xs leading-5 text-slate-300">{actionability.actionContext}</p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-1">
          <ActionabilityMetric metric={actionability.timingQuality} />
          <ActionabilityMetric metric={actionability.chaseRiskVisibility} />
        </div>
        <div className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
          <p><span className="font-semibold text-slate-200">Wait for:</span> {actionability.whatToWaitFor}</p>
          <p><span className="font-semibold text-slate-200">Invalidates:</span> {actionability.invalidationExplanation}</p>
        </div>
      </details>

      <details className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Regime impact</summary>
        <p className="mt-3 text-xs leading-5 text-slate-300">{humanizeInsightText(intelligence.regime_impact)}</p>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Setup profile</summary>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-950/35 p-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Setup</div>
            <div className="mt-1 text-sm font-bold text-slate-100">{opportunitySetupLabel(intelligence.setup_type)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Strength</div>
            <div className={`mt-1 font-mono text-lg font-black ${readinessTone.textClass}`}>{intelligence.setup_strength}</div>
          </div>
        </div>
        <InsightList className="mt-3" title="Setup reasons" items={intelligence.setup_reasons} />
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Setup health</summary>
        <div className="mt-3 space-y-2">
          {setupHealthRows(factors).map((factor) => <HealthBar key={factor.key} label={factor.label} value={factor.value} />)}
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Mini price context</summary>
        <div className="mt-3">
          <MiniPriceContextChart candles={candles} entryContext={best.entryZoneLabel ?? formatMoney(best.suggested_entry)} height={260} symbol={best.symbol} />
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <summary className="flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-slate-100">Risk snapshot</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <HeroMetric label="ATR" value={formatNumber(row.atr)} />
          <HeroMetric label="Macro adj." value={signedAdjustment(best.macroAdjustment)} tone={(best.macroAdjustment ?? 0) < -0.75 ? "risk" : "neutral"} />
          <HeroMetric label="Event context" value={best.eventLabel} tone={best.eventRisk >= 68 ? "risk" : "neutral"} />
          <HeroMetric label="Stop distance" value={stopDistance(best)} tone="risk" />
          <HeroMetric label="Volatility" value={percentLike(row.volatility ?? row.volatility_pct)} />
          <HeroMetric label="Fragility" value={`${best.fragility} / ${best.fragilityLabel}`} tone={best.fragility >= 70 ? "risk" : "neutral"} />
        </div>
      </details>
    </aside>
  );
}

function OpportunitySection({
  activeFilterCount,
  activeTab,
  criteriaCount,
  empty,
  fullUniverseCount,
  matchingOutsideTab,
  onClearCriteria,
  onResetFilters,
  onShowFullUniverse,
  rows,
  sortKey,
  title,
  totalRows,
  watchlistCount,
}: {
  activeFilterCount: number;
  activeTab: TabKey;
  criteriaCount: number;
  empty: string;
  fullUniverseCount: number;
  matchingOutsideTab: OpportunityViewModel[];
  onClearCriteria: () => void;
  onResetFilters: () => void;
  onShowFullUniverse: () => void;
  rows: OpportunityViewModel[];
  sortKey: SortKey;
  title: string;
  totalRows: number;
  watchlistCount: number;
}) {
  return (
    <GlassPanel className="p-4 sm:p-5">
      <SectionTitle eyebrow="Symbol Browser" title={title} meta={`${rows.length.toLocaleString()} symbols`} />
      <div className="mt-4">
        <OpportunityGrid
          activeFilterCount={activeFilterCount}
          activeTab={activeTab}
          criteriaCount={criteriaCount}
          empty={empty}
          fullUniverseCount={fullUniverseCount}
          matchingOutsideTab={matchingOutsideTab}
          onClearCriteria={onClearCriteria}
          onResetFilters={onResetFilters}
          onShowFullUniverse={onShowFullUniverse}
          rows={rows}
          sortKey={sortKey}
          totalRows={totalRows}
          watchlistCount={watchlistCount}
        />
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
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{opportunitySetupLabel(group.setup)}</div>
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

function FilterReliabilitySummary({
  activeTab,
  criteriaCount,
  fullUniverseCount,
  matchingOutsideTab,
  sortKey,
  tabRowCount,
  visibleCount,
}: {
  activeTab: TabKey;
  criteriaCount: number;
  fullUniverseCount: number;
  matchingOutsideTab: OpportunityViewModel[];
  sortKey: SortKey;
  tabRowCount: number;
  visibleCount: number;
}) {
  const hiddenByTab = activeTab !== "FULL" ? Math.max(0, fullUniverseCount - visibleCount) : 0;
  return (
    <div className="mt-4 grid gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-3 text-xs leading-5 text-slate-300 md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Filter Reliability</div>
        <p className="mt-1">
          {opportunityRankingExplanation(sortKey, activeTab)} {criteriaCount ? `${criteriaCount} search/filter rule${criteriaCount === 1 ? "" : "s"} applied.` : "No extra search/filter rules are applied."}
        </p>
      </div>
      <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-slate-200">{visibleCount.toLocaleString()} visible</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-slate-200">{fullUniverseCount.toLocaleString()} full-universe match{fullUniverseCount === 1 ? "" : "es"}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-slate-200">{tabRowCount.toLocaleString()} in tab before extra filters</span>
        </div>
        {hiddenByTab > 0 ? (
          <p className="mt-2 text-cyan-100">
            {hiddenByTab.toLocaleString()} matching symbol{hiddenByTab === 1 ? " is" : "s are"} outside this tab{matchingOutsideTab.length ? `, including ${matchingOutsideTab.map((row) => row.symbol).join(", ")}.` : "."}
          </p>
        ) : (
          <p className="mt-2 text-slate-400">No matching symbol is being hidden by the active tab.</p>
        )}
      </div>
    </div>
  );
}

function OpportunityHeroIntelligence({ marketCondition, rows }: { marketCondition: string | null; rows: OpportunityViewModel[] }) {
  const pulse = setupPulse(rows);
  const topImproving = [...rows]
    .map((row) => ({ change: numeric(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change), row }))
    .filter((item): item is { change: number; row: OpportunityViewModel } => item.change !== null)
    .sort((left, right) => right.change - left.change)
    .slice(0, 3);
  const riskBlocked = rows.filter((row) => opportunityDecision(row) === "AVOID" || hasVetoes(row.raw.vetoes)).length;
  const highReadiness = rows.filter((row) => row.conviction >= 70).length;
  const fallbackCount = rows.filter((row) => Boolean(row.raw.data_provider_fallback_used)).length;
  const eventRiskCount = rows.filter((row) => row.eventRisk >= 68).length;

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
        <CompactPulseCard title="Readiness Heatmap" value={`${highReadiness} high readiness`} detail={humanizeInsightText(`${pulse.confidence}. Confidence is not a prediction.`)} />
        <CompactPulseCard title="Regime Alignment" value={cleanText(marketCondition, "Neutral")} detail={humanizeInsightText(pulse.breadthDetail)} />
        <CompactPulseCard title="Risk Filters" value={`${riskBlocked} blocked`} detail="Blocked rows stay visible so TradeVeto can show caution without pretending there is a clean setup." />
        <CompactPulseCard title="Event Pressure" value={`${eventRiskCount} elevated`} detail="Verified macro and company events can raise or lower conviction in a limited, explainable way." />
        <CompactPulseCard title="Data Quality" value={`${fallbackCount} fallbacks`} detail={humanizeInsightText(pulse.scannerDetail)} />
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
        <CompactPulseCard title="Setup Momentum" value={pulse.momentum} detail={humanizeInsightText(pulse.momentumDetail)} />
        <CompactPulseCard title="Market Breadth Pulse" value={pulse.breadth} detail={humanizeInsightText(pulse.breadthDetail)} />
        <CompactPulseCard title="Confidence Distribution" value={pulse.confidence} detail={humanizeInsightText(pulse.confidenceDetail)} />
        <CompactPulseCard title="Scanner Pulse" value={pulse.scanner} detail={humanizeInsightText(pulse.scannerDetail)} />
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
        <MiniCardMetric label="Fragility" value={`${row.fragility}`} />
        <MiniCardMetric label="Macro" value={signedAdjustment(row.macroAdjustment)} />
      </div>
      <div className={`mt-2 text-[10px] font-black uppercase tracking-[0.1em] ${tone.textClass}`}>{tone.label}</div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(firstReason(row))}</div>
    </Link>
  );
}

function OpportunityGrid({
  activeFilterCount,
  activeTab,
  criteriaCount,
  empty,
  fullUniverseCount,
  matchingOutsideTab,
  onClearCriteria,
  onResetFilters,
  onShowFullUniverse,
  rows,
  sortKey,
  totalRows,
  watchlistCount,
}: {
  activeFilterCount: number;
  activeTab: TabKey;
  criteriaCount: number;
  empty: string;
  fullUniverseCount: number;
  matchingOutsideTab: OpportunityViewModel[];
  onClearCriteria: () => void;
  onResetFilters: () => void;
  onShowFullUniverse: () => void;
  rows: OpportunityViewModel[];
  sortKey: SortKey;
  totalRows: number;
  watchlistCount: number;
}) {
  if (!rows.length) {
    const tabHiddenMatches = activeTab !== "FULL" && fullUniverseCount > 0;
    const watchlistEmpty = activeTab === "WATCHLIST" && watchlistCount === 0;
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        <div className="max-w-2xl">
          <div className="font-semibold text-slate-200">No symbols match this view.</div>
          <p className="mt-2 leading-6">{empty}</p>
          {tabHiddenMatches ? (
            <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-3">
              <div className="text-xs font-semibold text-cyan-100">
                {fullUniverseCount.toLocaleString()} symbol{fullUniverseCount === 1 ? "" : "s"} still match your search and filters in Full Universe.
              </div>
              {matchingOutsideTab.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {matchingOutsideTab.map((row) => (
                    <Link className="rounded-full border border-white/10 bg-slate-950/45 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100" href={`/symbol/${row.symbol}`} key={row.symbol}>
                      {row.symbol}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {watchlistEmpty ? (
            <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-100">
              Your watchlist is empty on this device. Add symbols from any symbol card or detail page, then this tab will become useful.
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {tabHiddenMatches ? (
              <button
                className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/15"
                onClick={onShowFullUniverse}
                type="button"
              >
                Show Full Universe matches
              </button>
            ) : null}
            {criteriaCount ? (
              <button
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100"
                onClick={onClearCriteria}
                type="button"
              >
                Clear search and filters
              </button>
            ) : null}
            {activeFilterCount || totalRows ? (
            <button
              className="rounded-full border border-white/10 bg-slate-950/35 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100"
              onClick={onResetFilters}
              type="button"
            >
              Reset to Best Setups
            </button>
          ) : null}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => (
        <OpportunityCard
          key={row.symbol}
          row={row}
          visibilityReason={opportunityVisibilityReason(row, activeTab, sortKey, index)}
        />
      ))}
    </div>
  );
}

function OpportunityCard({ row, visibilityReason }: { row: OpportunityViewModel; visibilityReason: string }) {
  const router = useRouter();
  const href = `/symbol/${row.symbol}`;
  const openDetail = () => router.push(href);
  const visual = getSymbolVisualIdentity(row.symbol, row.sector, row.company_name);
  const institutionalLabels = compactInstitutionalLabels(row);
  const execution = buildExecutionIntelligence(row);
  const actionability = buildOpportunityActionability(row);
  const status = opportunityCardStatus(row, actionability, execution);
  const score = finiteNumber(row.final_score) ?? 0;
  const intelligenceLabels = [...institutionalLabels, ...execution.compactLabels].slice(0, 6);
  const detailMetrics = [
    { label: "Price", value: formatMoney(row.price) },
    { label: "Core decision", value: decisionLabel(row.final_decision) },
    { label: "Score", value: formatNumber(row.final_score, 0) },
    { label: "Conviction", value: `${row.conviction} ${row.confidenceLabel}` },
    { label: "Fragility", value: `${row.fragility} ${row.fragilityLabel}` },
    { label: "Evidence", value: evidenceSummary(row) },
    { label: "Macro", value: `${row.macroLabel} ${signedAdjustment(row.macroAdjustment)}` },
    { label: "Event", value: row.eventLabel },
    { label: "Entry quality", value: `${execution.entryQuality.score} ${execution.executionStateLabel}` },
    { label: "Timing", value: `${actionability.timingQuality.score ?? "N/A"} ${actionability.earlyOrLate}` },
    { label: "Confirmation", value: `${actionability.confirmationStatus.value} (${actionability.confirmationStatus.score ?? "N/A"})` },
    { label: "Pullback", value: `${actionability.pullbackQuality.value} (${actionability.pullbackQuality.score ?? "N/A"})` },
    { label: "Historical exit", value: execution.zones.historicalExitZone },
    { label: "Invalidation", value: execution.zones.invalidationZone },
    { label: "Structure", value: row.structuralLabel },
    { label: "Decay", value: row.decayLabel },
  ];
  const insightTiles: OpportunityInsightTileModel[] = [
    {
      label: "Why this setup?",
      value: actionability.whyInteresting,
      detail: visibilityReason,
      tone: "focus",
    },
    {
      label: "Upside potential",
      value: opportunityUpsidePotential(row),
      detail: actionability.asymmetryClarity,
      tone: "positive",
    },
    {
      label: "Main risk",
      value: actionability.whyRisky,
      detail: actionability.invalidationExplanation,
      tone: actionability.chaseRiskVisibility.tone === "risk" ? "risk" : "caution",
    },
    {
      label: "Entry quality",
      value: `${actionability.timingQuality.value} · ${actionability.earlyOrLate}`,
      detail: actionability.entryZoneClarity,
      tone: actionability.timingQuality.tone,
    },
    {
      label: "Chase risk",
      value: actionability.chaseRiskVisibility.value,
      detail: actionability.pullbackGuidance,
      tone: actionability.chaseRiskVisibility.tone,
    },
    {
      label: "Watch next",
      value: actionability.whatToWaitFor,
      detail: `Confirmation: ${actionability.confirmationStatus.value}. ${actionability.riskRewardCommunication}`,
      tone: "neutral",
    },
  ];
  return (
    <article
      className={`visual-card w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-2xl border bg-white/[0.04] p-4 shadow-xl shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-300/40 ${opportunityStatusBorderClass(status.tone)}`}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      role="link"
      style={{ boxShadow: `0 24px 52px rgba(0,0,0,0.18), 0 0 34px ${visual.accentSoft}` }}
      tabIndex={0}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <SymbolLogo companyName={row.company_name} sector={row.sector} size="md" symbol={row.symbol} />
          <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link className="relative z-10 inline-flex min-h-9 items-center font-mono text-2xl font-black text-slate-50 transition hover:text-cyan-100 sm:text-3xl" href={href} onClick={(event) => event.stopPropagation()}>{row.symbol}</Link>
            <OpportunityStatusPill status={status} />
          </div>
          <div className="mt-1 min-w-0 text-xs text-slate-400">{cleanText(row.company_name || row.sector, "Signal")}</div>
          <div className="mt-1"><SymbolIdentityLine companyName={row.company_name} sector={row.sector} symbol={row.symbol} /></div>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <WatchlistButton showLabel={false} symbol={row.symbol} />
          <DecisionBadge className="px-3 py-1.5 sm:px-4" value={row.final_decision} />
        </div>
      </div>
      <div className="mt-3">
        <DataHealthIndicator compact freshness={row.dataFreshness} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)]">
        <ScoreFactorStrip
          emptyMessage="This row has not produced enough scored factors for a visual breakdown."
          factors={[
            { label: "Score", tone: "cyan", value: row.final_score },
            { label: "Conviction", tone: "emerald", value: row.conviction },
            { label: "Stability", tone: row.fragility >= 68 ? "rose" : "emerald", value: Math.max(0, 100 - row.fragility) },
            { label: "Evidence", tone: row.evidence?.tier === "limited" ? "amber" : "emerald", value: row.evidence?.score },
            { label: "Event", tone: row.eventRisk >= 68 ? "rose" : "cyan", value: row.eventRisk },
          ]}
          label="Real scored factors"
        />
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <VisualMetricRail
            metrics={[
              { label: "Score", tone: "cyan", value: score },
              { label: "Conviction", tone: "emerald", value: row.conviction },
              { label: "Fragility", tone: row.fragility >= 68 ? "rose" : "amber", value: row.fragility },
            ]}
          />
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 break-words text-sm font-bold text-slate-50">{status.summary}</div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-300">
            {opportunitySetupLabel(opportunitySetupType(row))}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
          {humanizeInsightText(row.decision_reason, "Decision reason is not available yet.")}
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        <div className="grid gap-2 lg:grid-cols-2">
          <OpportunityInsightTile tile={insightTiles[0]} />
          <OpportunityInsightTile tile={insightTiles[5]} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {insightTiles.slice(1, 5).map((tile) => <OpportunityInsightTile key={tile.label} tile={tile} compact />)}
        </div>
      </div>
      <OpportunityZoneStrip actionability={actionability} execution={execution} />
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Market pressure</div>
          <div className="text-[10px] font-semibold text-slate-400">{row.fragilityLabel}</div>
        </div>
        <HeatDots active={Math.round(Math.max(0, Math.min(12, row.fragility / 8.4)))} tone={row.fragility >= 68 ? "rose" : "cyan"} />
      </div>
      {row.narrative ? (
        <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.045] p-3 text-xs leading-5 text-slate-300">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300">Market story</div>
          <p className="mt-1 line-clamp-3">{humanizeInsightText(row.narrative.narrativeSummary)}</p>
        </div>
      ) : null}
      {intelligenceLabels.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {intelligenceLabels.map((label) => (
            <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-300" key={label}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <details className="mt-3 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs text-slate-400" onClick={(event) => event.stopPropagation()}>
        <summary className="min-h-8 cursor-pointer font-semibold text-slate-200">More context and scores</summary>
        <div className="mt-2 grid gap-2">
          {detailMetrics.map((metric) => <CardMetric key={metric.label} label={metric.label} value={metric.value} />)}
        </div>
      </details>
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs text-slate-500">{cleanText(row.assetType, "Asset")} {row.sector ? `- ${row.sector}` : ""}</div>
        <div className="text-xs font-semibold text-cyan-200 opacity-90">Tap for symbol detail</div>
      </div>
    </article>
  );
}

type OpportunityStatusTone = "good" | "neutral" | "pullback" | "risk" | "speculative";

type OpportunityCardStatus = {
  label: string;
  summary: string;
  tone: OpportunityStatusTone;
};

type OpportunityTileTone = ExecutionTone | "focus";

type OpportunityInsightTileModel = {
  detail: string;
  label: string;
  tone: OpportunityTileTone;
  value: string;
};

function opportunityCardStatus(row: OpportunityViewModel, actionability: OpportunityActionability, execution: ExecutionIntelligence): OpportunityCardStatus {
  const shock = row.shockPattern;
  if (execution.executionState === "avoid_chase" || actionability.chaseRiskVisibility.tone === "risk") {
    return {
      label: "Avoid chase",
      summary: "Upside can still exist, but the current entry looks stretched.",
      tone: "risk",
    };
  }
  if (row.fragility >= 74 || (shock?.downsideRiskScore ?? 0) >= 76) {
    return {
      label: "Risk rising",
      summary: "The setup has attention value, but downside pressure is building.",
      tone: "risk",
    };
  }
  if (shock && shock.opportunityScore >= 70 && shock.downsideRiskScore >= 62) {
    return {
      label: "High risk / high reward",
      summary: "Large-move history is visible, but the risk side needs respect.",
      tone: "speculative",
    };
  }
  if (execution.executionState === "extended_entry" || execution.executionState === "wait_for_pullback") {
    return {
      label: "Wait for pullback",
      summary: "The idea is interesting, but a cleaner entry would improve quality.",
      tone: "pullback",
    };
  }
  if (execution.executionState === "breakout_confirmed" && row.conviction >= 55 && (row.final_score ?? 0) >= 58) {
    return {
      label: "Good setup",
      summary: "Setup quality is constructive while timing guardrails remain visible.",
      tone: "good",
    };
  }
  return {
    label: "Watch only",
    summary: "There is enough context to monitor, but confirmation still matters.",
    tone: "neutral",
  };
}

function opportunityUpsidePotential(row: OpportunityViewModel): string {
  const shock = row.shockPattern;
  if (shock) {
    return `${formatNumber(shock.upsideShockScore, 0)}/100 · ${shock.averageProfitPotential}`;
  }
  const riskReward = finiteNumber(row.raw.risk_reward ?? row.raw.reward_risk_ratio ?? row.raw.conservative_risk_reward);
  if (riskReward !== null) return `${formatNumber(riskReward, 1)}x model reward/risk`;
  return `${formatNumber(row.final_score, 0)}/100 setup quality`;
}

function OpportunityStatusPill({ status }: { status: OpportunityCardStatus }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${opportunityStatusPillClass(status.tone)}`}>
      {status.label}
    </span>
  );
}

function OpportunityInsightTile({ compact = false, tile }: { compact?: boolean; tile: OpportunityInsightTileModel }) {
  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-xl border p-3 ${opportunityTileClass(tile.tone)}`}>
      <div className="break-words text-[10px] font-black uppercase tracking-[0.1em] opacity-80">{tile.label}</div>
      <div className={`mt-1 line-clamp-4 break-words font-semibold leading-5 text-slate-50 ${compact ? "text-xs" : "text-sm"}`}>
        {tile.value}
      </div>
      <div className="mt-1 line-clamp-2 break-words text-[11px] leading-4 text-slate-300/85">{tile.detail}</div>
    </div>
  );
}

function OpportunityZoneStrip({ actionability, execution }: { actionability: OpportunityActionability; execution: ExecutionIntelligence }) {
  return (
    <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-emerald-300/15 bg-emerald-400/[0.045] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">Entry and exit context</div>
          <div className="mt-1 text-xs font-semibold text-slate-100">{actionability.primaryActionLabel} · {actionability.earlyOrLate}</div>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${actionabilityToneClass(actionability.chaseRiskVisibility.tone)}`}>
          {actionability.chaseRiskVisibility.value}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{actionability.actionContext}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ZonePill label="Research entry" value={execution.zones.researchEntryZone} />
        <ZonePill label="Do-not-chase" value={execution.zones.doNotChaseZone} tone="caution" />
        <ZonePill label="Invalidation" value={execution.zones.invalidationZone} tone="risk" />
        <ZonePill label="Historical exit" value={execution.zones.historicalExitZone} tone="positive" />
      </div>
    </div>
  );
}

function ZonePill({ label, tone = "neutral", value }: { label: string; tone?: ExecutionTone; value: string }) {
  return (
    <div className={`min-w-0 rounded-lg border bg-slate-950/35 p-2 ${zoneToneClass(tone)}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.1em] opacity-80">{label}</div>
      <div className="mt-1 break-words font-mono text-xs font-black leading-4">{value}</div>
    </div>
  );
}

function ActionabilityMetric({ metric }: { metric: OpportunityActionability["timingQuality"] }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/35 p-2">
      <div className="break-words text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">{metric.label}</div>
      <div className={`mt-1 flex items-baseline justify-between gap-2 ${actionabilityTextClass(metric.tone)}`}>
        <span className="break-words text-[11px] font-semibold">{metric.value}</span>
        {metric.score !== null ? <span className="font-mono text-xs font-black">{formatNumber(metric.score, 0)}</span> : null}
      </div>
    </div>
  );
}

function actionabilityToneClass(tone: OpportunityActionability["timingQuality"]["tone"]): string {
  if (tone === "positive") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (tone === "risk") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (tone === "caution") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function actionabilityTextClass(tone: OpportunityActionability["timingQuality"]["tone"]): string {
  if (tone === "positive") return "text-emerald-200";
  if (tone === "risk") return "text-rose-200";
  if (tone === "caution") return "text-amber-200";
  return "text-slate-100";
}

function opportunityStatusBorderClass(tone: OpportunityStatusTone): string {
  if (tone === "good") return "border-emerald-300/20 hover:border-emerald-300/45";
  if (tone === "pullback") return "border-amber-300/20 hover:border-amber-300/45";
  if (tone === "risk") return "border-rose-300/20 hover:border-rose-300/45";
  if (tone === "speculative") return "border-fuchsia-300/20 hover:border-fuchsia-300/45";
  return "border-white/10 hover:border-cyan-400/40";
}

function opportunityStatusPillClass(tone: OpportunityStatusTone): string {
  if (tone === "good") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (tone === "pullback") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (tone === "risk") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (tone === "speculative") return "border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100";
  return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
}

function opportunityTileClass(tone: OpportunityTileTone): string {
  if (tone === "positive") return "border-emerald-300/15 bg-emerald-400/[0.055] text-emerald-100";
  if (tone === "risk") return "border-rose-300/15 bg-rose-400/[0.055] text-rose-100";
  if (tone === "caution") return "border-amber-300/15 bg-amber-400/[0.055] text-amber-100";
  if (tone === "focus") return "border-cyan-300/15 bg-cyan-400/[0.055] text-cyan-100";
  return "border-white/10 bg-slate-950/35 text-slate-200";
}

function zoneToneClass(tone: ExecutionTone): string {
  if (tone === "positive") return "border-emerald-300/15 text-emerald-100";
  if (tone === "risk") return "border-rose-300/15 text-rose-100";
  if (tone === "caution") return "border-amber-300/15 text-amber-100";
  return "border-white/10 text-slate-100";
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
      <div className="break-words text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`mt-2 break-words font-mono text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function MiniCardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950/45 px-2 py-1">
      <div className="break-words text-[9px] font-semibold uppercase leading-3 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="break-words font-mono text-[12px] font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="break-words text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-semibold text-slate-100" title={value}>{value}</div>
    </div>
  );
}

function evidenceSummary(row: OpportunityViewModel): string {
  const evidence = row.evidence;
  if (!evidence) return "Evidence building";
  return `${evidence.label} · ${evidence.evidenceSampleSize.toLocaleString()} samples`;
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
    const matching = rows.filter((row) => opportunitySetupType(row) === setup);
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
  const setupCounts = countBy(rows, (row) => opportunitySetupLabel(opportunitySetupType(row)));
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

function distributionRows(counts: Map<string, number>, colors: string[]): DistributionRow[] {
  return Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([label, value], index) => ({ color: colors[index % colors.length], label, value }));
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

function signedAdjustment(value: number | null): string {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}`;
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
        className="mt-1 h-11 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50 sm:h-10"
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
      <select className="mt-1 h-11 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/50 sm:h-10" value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {children}
      </select>
    </label>
  );
}

function TabButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      aria-selected={active}
      className={`min-w-[min(68vw,190px)] shrink-0 snap-start border-b-2 px-0.5 py-3 text-left transition-colors duration-200 sm:min-w-[138px] ${active ? "border-cyan-300 text-cyan-50" : "border-transparent text-slate-400 hover:border-white/25 hover:text-slate-100"}`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <div className="text-sm font-bold">{label}</div>
      <div className={`mt-1 font-mono text-xs ${active ? "text-cyan-200/75" : "text-slate-500"}`}>{count.toLocaleString()} symbols</div>
    </button>
  );
}

function uniqueValues(values: Array<string | null>): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value, "")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function tabTitle(tab: TabKey) {
  if (tab === "FULL") return "Full Universe";
  if (tab === "WATCHLIST") return "Watchlist";
  if (tab === "RISK_TOLERANT") return "Risk-Tolerant Opportunities";
  if (tab === "SHOCK") return "Shock Potential";
  if (tab === "PULLBACK") return "Pullback Watch";
  if (tab === "MOMENTUM") return "Momentum Continuation";
  return "Best Setups";
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
