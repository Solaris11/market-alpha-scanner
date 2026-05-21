"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  GitCompare,
  Globe2,
  LayoutGrid,
  ListFilter,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import {
  PosterFactorBars,
  PosterHeatmapChart,
  PosterIntelligenceOrbit,
  PosterRadialGauge,
  PosterTrendChart,
  type PosterHeatCell,
  type PosterOrbitNode,
  type PosterVisualTone,
} from "@/components/visual/PosterDataVisuals";
import {
  filterDiscoverySymbols,
  type DiscoveryCluster,
  type DiscoveryEvidenceFilter,
  type DiscoveryFilterState,
  type DiscoveryMarketCapFilter,
  type DiscoveryQuickFilter,
  type DiscoveryQuickFilterKey,
  type DiscoveryRiskBandFilter,
  type DiscoveryScannerPreset,
  type DiscoverySortKey,
  type DiscoverySymbol,
  type DiscoveryTimeframe,
  type DiscoveryTone,
  type IntelligenceDiscoverySystem,
} from "@/lib/trading/intelligence-discovery";
import { trackAnalyticsEvent, trackFirstUsefulAction } from "@/lib/client/analytics";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { formatHydrationSafeInteger, formatHydrationSafeUtcTime } from "@/lib/ui/hydration-safe-formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";
import { loadDiscoveryWorkflowState, saveDiscoveryWorkflowState, type DiscoveryResultDensity } from "./discovery-workflow-storage";

type DiscoveryMode = "overlay" | "page";
type ResultDensity = DiscoveryResultDensity;
type ScannerLane = {
  detail: string;
  filter: DiscoveryQuickFilterKey;
  key: string;
  sort: DiscoverySortKey;
  symbols: DiscoverySymbol[];
  timeframe: DiscoveryTimeframe;
  title: string;
  tone: DiscoveryTone;
};

const TIMEFRAMES: DiscoveryTimeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];
const SORTS: Array<{ key: DiscoverySortKey; label: string }> = [
  { key: "attention", label: "Attention" },
  { key: "performance", label: "Performance" },
  { key: "weakness", label: "Weakness" },
  { key: "breakout", label: "Breakout" },
  { key: "crash", label: "Crash risk" },
  { key: "money_flow", label: "Money flow" },
  { key: "risk", label: "Risk" },
  { key: "confidence", label: "Confidence" },
  { key: "macro", label: "Macro" },
  { key: "replay", label: "Replay" },
  { key: "freshness", label: "Freshness" },
  { key: "symbol", label: "A-Z" },
];

const FILTER_BEHAVIOR: Partial<Record<DiscoveryQuickFilterKey, { sort: DiscoverySortKey; timeframe: DiscoveryTimeframe }>> = {
  best_setups: { sort: "confidence", timeframe: "1M" },
  breakout_candidates: { sort: "breakout", timeframe: "1W" },
  crash_risk: { sort: "crash", timeframe: "1D" },
  money_flow: { sort: "money_flow", timeframe: "1D" },
  macro_supported: { sort: "macro", timeframe: "1M" },
  momentum_deterioration: { sort: "weakness", timeframe: "1W" },
  replay_supported: { sort: "replay", timeframe: "1M" },
  risk_escalation: { sort: "risk", timeframe: "1D" },
  top_gainers_1d: { sort: "performance", timeframe: "1D" },
  top_gainers_1m: { sort: "performance", timeframe: "1M" },
  top_gainers_1y: { sort: "performance", timeframe: "1Y" },
  top_gainers_3m: { sort: "performance", timeframe: "3M" },
  top_gainers_5y: { sort: "performance", timeframe: "5Y" },
  top_gainers_6m: { sort: "performance", timeframe: "6M" },
  top_gainers_1w: { sort: "performance", timeframe: "1W" },
  top_losers_1d: { sort: "weakness", timeframe: "1D" },
  top_losers_1m: { sort: "weakness", timeframe: "1M" },
  top_losers_1w: { sort: "weakness", timeframe: "1W" },
  high_confidence: { sort: "confidence", timeframe: "1M" },
  fresh_setups: { sort: "freshness", timeframe: "1D" },
  improving_conviction: { sort: "confidence", timeframe: "1W" },
  volatility_expansion: { sort: "breakout", timeframe: "1W" },
  watchlist: { sort: "attention", timeframe: "1M" },
  weakest: { sort: "weakness", timeframe: "1M" },
};

const TONE_CLASS: Record<DiscoveryTone, { border: string; bg: string; text: string; glow: string; chip: string }> = {
  amber: { bg: "bg-amber-400/[0.08]", border: "border-amber-300/25", chip: "bg-amber-300/15 text-amber-100", glow: "shadow-amber-950/20", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/[0.08]", border: "border-cyan-300/25", chip: "bg-cyan-300/15 text-cyan-100", glow: "shadow-cyan-950/20", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/[0.08]", border: "border-emerald-300/25", chip: "bg-emerald-300/15 text-emerald-100", glow: "shadow-emerald-950/20", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/[0.08]", border: "border-rose-300/25", chip: "bg-rose-300/15 text-rose-100", glow: "shadow-rose-950/20", text: "text-rose-100" },
  violet: { bg: "bg-violet-400/[0.08]", border: "border-violet-300/25", chip: "bg-violet-300/15 text-violet-100", glow: "shadow-violet-950/20", text: "text-violet-100" },
};

export function IntelligenceDiscoveryWorkspace({
  mode = "page",
  system,
}: {
  mode?: DiscoveryMode;
  system: IntelligenceDiscoverySystem;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<DiscoveryQuickFilterKey>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sector, setSector] = useState("ALL");
  const [assetType, setAssetType] = useState("ALL");
  const [marketCap, setMarketCap] = useState<DiscoveryMarketCapFilter>("ALL");
  const [riskBand, setRiskBand] = useState<DiscoveryRiskBandFilter>("ALL");
  const [evidence, setEvidence] = useState<DiscoveryEvidenceFilter>("ALL");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [sort, setSort] = useState<DiscoverySortKey>("attention");
  const [timeframe, setTimeframe] = useState<DiscoveryTimeframe>("1M");
  const [density, setDensity] = useState<ResultDensity>("speed");
  const [selectedSymbol, setSelectedSymbol] = useState<DiscoverySymbol | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<DiscoveryCluster | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(system.comparePresets[0]?.symbols.slice(0, 3) ?? []);
  const [shortlistSymbols, setShortlistSymbols] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [workflowLoaded, setWorkflowLoaded] = useState(false);

  const state: DiscoveryFilterState = { assetType, evidence, filter, marketCap, query: deferredQuery, riskBand, sector, sort, timeframe, watchlistOnly };
  const filtered = useMemo(() => filterDiscoverySymbols(system.symbols, state), [assetType, deferredQuery, evidence, filter, marketCap, riskBand, sector, sort, system.symbols, timeframe, watchlistOnly]);
  const visibleLimit = useMemo(() => {
    if (density === "dense") return mode === "overlay" ? 140 : 240;
    if (density === "speed") return mode === "overlay" ? 72 : 144;
    return mode === "overlay" ? 36 : 84;
  }, [density, mode]);
  const visibleSymbols = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const sectors = useMemo(() => ["ALL", ...Array.from(new Set(system.symbols.map((symbol) => symbol.sector).filter((value): value is string => Boolean(value)))).sort()], [system.symbols]);
  const assetTypes = useMemo(() => ["ALL", ...Array.from(new Set(system.symbols.map((symbol) => symbol.assetType).filter((value): value is string => Boolean(value)))).sort()], [system.symbols]);
  const compareRows = useMemo(() => compareSymbols.map((symbol) => system.symbols.find((candidate) => candidate.symbol === symbol)).filter((value): value is DiscoverySymbol => Boolean(value)), [compareSymbols, system.symbols]);
  const shortlistRows = useMemo(() => shortlistSymbols.map((symbol) => system.symbols.find((candidate) => candidate.symbol === symbol)).filter((value): value is DiscoverySymbol => Boolean(value)), [shortlistSymbols, system.symbols]);
  const scannerLanes = useMemo(() => buildScannerLanes(system.symbols), [system.symbols]);
  const speedLanes = useMemo(() => buildSpeedLanes(system.symbols), [system.symbols]);
  const activeAdvancedCount = [assetType !== "ALL", marketCap !== "ALL", riskBand !== "ALL", evidence !== "ALL", watchlistOnly].filter(Boolean).length;
  const heatCells: PosterHeatCell[] = system.sectorHeatmap.map((cluster) => ({ detail: cluster.detail, label: cluster.label, tone: cluster.tone, value: cluster.averageScore }));
  const orbitNodes: PosterOrbitNode[] = system.orbitNodes.map((node) => ({
    detail: node.detail,
    id: node.key,
    label: node.label,
    metric: node.metric,
    score: node.score,
    tone: node.tone,
  }));
  const selectedFilter = system.quickFilters.find((item) => item.key === filter);
  const activeSymbol = visibleSymbols[Math.min(activeIndex, Math.max(visibleSymbols.length - 1, 0))] ?? null;

  useEffect(() => {
    trackAnalyticsEvent("scanner_usage", { action: "open_discovery_workspace", universeCount: system.universeCount }, { source: "discovery_workspace" });
  }, [system.universeCount]);

  useEffect(() => {
    const saved = loadDiscoveryWorkflowState(typeof window === "undefined" ? null : window.localStorage, system.symbols);
    setDensity(saved.density);
    if (saved.compareSymbols.length) setCompareSymbols(saved.compareSymbols);
    setShortlistSymbols(saved.shortlistSymbols);
    setWorkflowLoaded(true);
  }, [system.symbols]);

  useEffect(() => {
    if (!workflowLoaded) return;
    saveDiscoveryWorkflowState(typeof window === "undefined" ? null : window.localStorage, {
      compareSymbols,
      density,
      shortlistSymbols,
      updatedAt: null,
    });
  }, [compareSymbols, density, shortlistSymbols, workflowLoaded]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(visibleSymbols.length - 1, 0)));
  }, [visibleSymbols.length]);

  function toggleCompare(symbol: string): void {
    setCompareSymbols((current) => {
      if (current.includes(symbol)) return current.filter((item) => item !== symbol);
      trackAnalyticsEvent("scanner_usage", { action: "compare_add", symbol }, { source: "discovery_compare", symbol });
      trackFirstUsefulAction("scanner_compare", { symbol }, { source: "discovery_compare", symbol });
      return [symbol, ...current].slice(0, 4);
    });
  }

  function toggleShortlist(symbol: string): void {
    setShortlistSymbols((current) => {
      if (current.includes(symbol)) return current.filter((item) => item !== symbol);
      trackAnalyticsEvent("scanner_usage", { action: "shortlist_add", symbol }, { source: "discovery_shortlist", symbol });
      trackFirstUsefulAction("scanner_shortlist", { symbol }, { source: "discovery_shortlist", symbol });
      return [symbol, ...current].slice(0, 20);
    });
  }

  function compareVisible(): void {
    const symbols = visibleSymbols.slice(0, 4).map((symbol) => symbol.symbol);
    if (!symbols.length) return;
    setCompareSymbols(symbols);
    trackAnalyticsEvent("scanner_usage", { action: "compare_visible", count: symbols.length }, { source: "discovery_compare" });
  }

  function shortlistVisible(): void {
    const symbols = visibleSymbols.slice(0, 8).map((symbol) => symbol.symbol);
    if (!symbols.length) return;
    setShortlistSymbols((current) => uniqueSymbols([...symbols, ...current]).slice(0, 20));
    trackAnalyticsEvent("scanner_usage", { action: "shortlist_visible", count: symbols.length }, { source: "discovery_shortlist" });
    trackFirstUsefulAction("scanner_shortlist_visible", { count: symbols.length }, { source: "discovery_shortlist" });
  }

  function compareShortlist(): void {
    const symbols = shortlistRows.slice(0, 4).map((symbol) => symbol.symbol);
    if (!symbols.length) return;
    setCompareSymbols(symbols);
    trackAnalyticsEvent("scanner_usage", { action: "compare_shortlist", count: symbols.length }, { source: "discovery_compare" });
  }

  function applyScannerFilter(nextFilter: DiscoveryQuickFilterKey): void {
    const behavior = FILTER_BEHAVIOR[nextFilter];
    setFilter(nextFilter);
    if (behavior) {
      setSort(behavior.sort);
      setTimeframe(behavior.timeframe);
    }
    trackAnalyticsEvent("scanner_usage", { action: "quick_filter", filter: nextFilter, sort: behavior?.sort ?? sort, timeframe: behavior?.timeframe ?? timeframe }, { source: "discovery_filter" });
    trackFirstUsefulAction("scanner_filter", { filter: nextFilter }, { source: "discovery_filter" });
  }

  function applyScannerPreset(preset: DiscoveryScannerPreset): void {
    setFilter(preset.filter);
    setSort(preset.sort);
    setTimeframe(preset.timeframe);
    setQuery("");
    setSector("ALL");
    setAssetType("ALL");
    setMarketCap("ALL");
    setRiskBand("ALL");
    setEvidence("ALL");
    setWatchlistOnly(false);
    trackAnalyticsEvent("scanner_usage", { action: "preset", preset: preset.key, resultCount: preset.count, sort: preset.sort, timeframe: preset.timeframe }, { source: "discovery_preset" });
    trackFirstUsefulAction("scanner_preset", { preset: preset.key }, { source: "discovery_preset" });
  }

  function applyScannerLane(nextFilter: DiscoveryQuickFilterKey): void {
    applyScannerFilter(nextFilter);
    setQuery("");
    setSector("ALL");
    trackAnalyticsEvent("scanner_usage", { action: "lane", filter: nextFilter }, { source: "discovery_lane" });
  }

  function clearAdvancedFilters(): void {
    setAssetType("ALL");
    setMarketCap("ALL");
    setRiskBand("ALL");
    setEvidence("ALL");
    setWatchlistOnly(false);
  }

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  function cycleDensity(): void {
    setDensity((current) => current === "dense" ? "speed" : current === "speed" ? "cards" : "dense");
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true;
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (isEditing) {
        if (key === "escape") target?.blur();
        return;
      }

      if (selectedSymbol || selectedCluster) return;

      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        const preset = system.scannerPresets.find((item) => item.shortcut === event.key);
        if (preset) {
          event.preventDefault();
          applyScannerPreset(preset);
        }
        return;
      }

      if (key === "d") {
        event.preventDefault();
        cycleDensity();
        return;
      }

      if (key === "c") {
        event.preventDefault();
        compareVisible();
        return;
      }

      if (key === "s" && activeSymbol) {
        event.preventDefault();
        toggleShortlist(activeSymbol.symbol);
        return;
      }

      if (key === "x" && activeSymbol) {
        event.preventDefault();
        toggleCompare(activeSymbol.symbol);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, Math.max(visibleSymbols.length - 1, 0)));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter" && activeSymbol) {
        event.preventDefault();
        setSelectedSymbol(activeSymbol);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSymbol, focusSearch, selectedCluster, selectedSymbol, system.scannerPresets, visibleSymbols.length]);

  return (
    <section className={`tv-discovery-system ${mode === "overlay" ? "space-y-4" : "space-y-6"}`} data-discovery-workspace="true">
      <DiscoveryHero
        mode={mode}
        query={query}
        selectedFilter={selectedFilter}
        setQuery={setQuery}
        system={system}
      />

      {system.limited ? (
        <LimitedDiscoveryState system={system} />
      ) : (
        <>
          <ScannerWorkflowCommandBar
            activeSymbol={activeSymbol}
            compareCount={compareRows.length}
            density={density}
            filteredCount={filtered.length}
            onCompareVisible={compareVisible}
            onCycleDensity={cycleDensity}
            onFocusSearch={focusSearch}
            onShortlistVisible={shortlistVisible}
            presets={system.scannerPresets}
            shortlistCount={shortlistRows.length}
            visibleCount={visibleSymbols.length}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="poster-panel overflow-hidden rounded-3xl border border-cyan-300/16 bg-slate-950/52 p-4 shadow-2xl shadow-cyan-950/10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Global intelligence search</div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Explore every validated scanner row</h2>
                </div>
                <div className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  {formatHydrationSafeInteger(filtered.length)} / {formatHydrationSafeInteger(system.universeCount)} visible
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_160px_160px_160px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200" />
                  <input
                    autoComplete="off"
                    className="h-12 w-full rounded-2xl border border-cyan-300/20 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/15"
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search symbol, company, sector, setup, risk context..."
                    ref={searchInputRef}
                    value={query}
                  />
                </label>
                <DiscoverySelect label="Sector" onChange={setSector} value={sector} values={sectors.map((value) => ({ key: value, label: value === "ALL" ? "All sectors" : value }))} />
                <DiscoverySelect label="Sort" onChange={(value) => setSort(value as DiscoverySortKey)} value={sort} values={SORTS.map((item) => ({ key: item.key, label: item.label }))} />
                <DiscoverySelect label="Timeframe" onChange={(value) => setTimeframe(value as DiscoveryTimeframe)} value={timeframe} values={TIMEFRAMES.map((value) => ({ key: value, label: value }))} />
              </div>

              <div id="filters">
                <ScannerPresetRail onSelect={applyScannerPreset} presets={system.scannerPresets} />
                <QuickFilterRail active={filter} filters={system.quickFilters} onSelect={applyScannerFilter} />
                <AdvancedFilterDeck
                  activeCount={activeAdvancedCount}
                  assetType={assetType}
                  assetTypes={assetTypes}
                  evidence={evidence}
                  marketCap={marketCap}
                  onAssetTypeChange={setAssetType}
                  onClear={clearAdvancedFilters}
                  onEvidenceChange={setEvidence}
                  onMarketCapChange={setMarketCap}
                  onRiskBandChange={setRiskBand}
                  onWatchlistOnlyChange={setWatchlistOnly}
                  riskBand={riskBand}
                  watchlistOnly={watchlistOnly}
                />
              </div>
            </div>

            <div className="poster-panel rounded-3xl border border-violet-300/16 bg-slate-950/52 p-4 shadow-2xl shadow-violet-950/10">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-100">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">Discovery story</div>
                  <h3 className="text-lg font-black text-white">{system.stories[0]?.title ?? "Discovery is monitoring the universe"}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{humanizeInsightText(system.stories[0]?.detail ?? system.summary)}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <MiniStat label="Universe" value={formatHydrationSafeInteger(system.universeCount)} />
                <MiniStat label="Watch" value={formatHydrationSafeInteger(system.watchlistCount)} />
                <MiniStat label="Updated" value={formatHydrationSafeUtcTime(system.dataTimestamp ?? system.generatedAt)} />
              </div>
            </div>
          </div>

          <ScannerSpeedDeck lanes={speedLanes} onSelect={applyScannerLane} />
          <ScannerLaneBoard lanes={scannerLanes} onSelect={applyScannerLane} />

          <div className="grid gap-4 2xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="space-y-4">
              <PosterIntelligenceOrbit centerLabel="Discover" className="min-h-[24rem]" nodes={orbitNodes} onNodeClick={(node) => setSelectedCluster(clusterForNode(system, node.id ?? node.label))} />
              <StoryStack stories={system.stories} />
            </div>
            <div className="space-y-4">
              <section className="poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Sector discovery map</div>
                    <h3 className="mt-1 text-xl font-black text-white">Where scanner attention is concentrated</h3>
                  </div>
                  <Globe2 className="h-5 w-5 text-cyan-200" />
                </div>
                <PosterHeatmapChart cells={heatCells} emptyMessage="Sector heatmap activates when scanner rows include sector context." onCellSelect={(cell) => setSelectedCluster(system.sectorHeatmap.find((cluster) => cluster.label === cell.label) ?? null)} />
              </section>
              <MomentumExplorer clusters={system.momentumClusters} onSelectCluster={setSelectedCluster} />
            </div>
            <div className="space-y-4">
              <DiscoveryGaugeDeck system={system} />
              <RiskExplorer clusters={system.riskClusters} onSelectCluster={setSelectedCluster} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)]">
            <SymbolResultGrid
              activeSymbol={activeSymbol?.symbol ?? null}
              compareSymbols={compareSymbols}
              density={density}
              onDensityChange={setDensity}
              onOpen={setSelectedSymbol}
              onToggleShortlist={toggleShortlist}
              onToggleCompare={toggleCompare}
              resultCount={filtered.length}
              shortlistedSymbols={shortlistSymbols}
              symbols={visibleSymbols}
              timeframe={timeframe}
            />
            <div className="space-y-4">
              <ShortlistDock compareShortlist={compareShortlist} onClear={() => setShortlistSymbols([])} onOpen={setSelectedSymbol} onToggleShortlist={toggleShortlist} symbols={shortlistRows} />
              <CompareModePanel compareRows={compareRows} onCompareShortlist={compareShortlist} onCompareVisible={compareVisible} presets={system.comparePresets} setCompareSymbols={setCompareSymbols} />
            </div>
          </div>
        </>
      )}

      <SymbolDetailOverlay onClose={() => setSelectedSymbol(null)} symbol={selectedSymbol} timeframe={timeframe} />
      <ClusterDetailOverlay cluster={selectedCluster} onClose={() => setSelectedCluster(null)} />
    </section>
  );
}

function DiscoveryHero({
  mode,
  query,
  selectedFilter,
  setQuery,
  system,
}: {
  mode: DiscoveryMode;
  query: string;
  selectedFilter?: DiscoveryQuickFilter;
  setQuery: (value: string) => void;
  system: IntelligenceDiscoverySystem;
}) {
  return (
    <div className="tv-discovery-hero relative overflow-hidden rounded-[2rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_35%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.82))] p-4 shadow-2xl shadow-cyan-950/20 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:38px_38px] opacity-35" />
      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">Discovery OS</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">⌘K / Ctrl+K</span>
            {selectedFilter ? <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${TONE_CLASS[selectedFilter.tone].chip}`}>{selectedFilter.label}</span> : null}
          </div>
          <h1 className={`${mode === "overlay" ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl"} mt-4 max-w-5xl font-black leading-[0.92] tracking-tight text-white`}>
            Intelligence discovery should never be buried.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{humanizeInsightText(system.headline)} {humanizeInsightText(system.summary)}</p>
          <div className="mt-5 max-w-3xl">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-200" />
              <input
                autoComplete="off"
                className="h-14 w-full rounded-2xl border border-cyan-300/25 bg-slate-950/72 pl-12 pr-4 text-base font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/15"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search AMD, semis, macro-supported pullbacks, risk escalation..."
                value={query}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <HeroMetric Icon={Radar} label="Universe" tone="cyan" value={formatHydrationSafeInteger(system.universeCount)} />
          <HeroMetric Icon={Sparkles} label="Discovery score" tone="emerald" value={`${system.discoveryScore}/100`} />
          <HeroMetric Icon={Star} label="Watchlist linked" tone="amber" value={formatHydrationSafeInteger(system.watchlistCount)} />
        </div>
      </div>
    </div>
  );
}

function ScannerWorkflowCommandBar({
  activeSymbol,
  compareCount,
  density,
  filteredCount,
  onCompareVisible,
  onCycleDensity,
  onFocusSearch,
  onShortlistVisible,
  presets,
  shortlistCount,
  visibleCount,
}: {
  activeSymbol: DiscoverySymbol | null;
  compareCount: number;
  density: ResultDensity;
  filteredCount: number;
  onCompareVisible: () => void;
  onCycleDensity: () => void;
  onFocusSearch: () => void;
  onShortlistVisible: () => void;
  presets: DiscoveryScannerPreset[];
  shortlistCount: number;
  visibleCount: number;
}) {
  return (
    <section className="poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/55 p-3 shadow-2xl shadow-cyan-950/10">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Scanner command layer</span>
          <CommandChip label="Mode" value={density === "dense" ? "Dense table" : density === "speed" ? "Speed table" : "Visual cards"} />
          <CommandChip label="Visible" value={`${formatHydrationSafeInteger(visibleCount)} / ${formatHydrationSafeInteger(filteredCount)}`} />
          <CommandChip label="Active" value={activeSymbol?.symbol ?? "Top row"} />
          <CommandChip label="Compare" value={formatHydrationSafeInteger(compareCount)} />
          <CommandChip label="Shortlist" value={formatHydrationSafeInteger(shortlistCount)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100" onClick={onFocusSearch} type="button">⌘K Search</button>
          <button className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100" onClick={onCycleDensity} type="button">D Density</button>
          <button className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-200/60" onClick={onCompareVisible} type="button">C Compare top</button>
          <button className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 hover:border-amber-200/60" onClick={onShortlistVisible} type="button">Shortlist top</button>
        </div>
      </div>
      <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-mobile-gesture-ignore="true">
        {presets.slice(0, 10).map((preset) => (
          <span className={`shrink-0 snap-start rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${TONE_CLASS[preset.tone].border} ${TONE_CLASS[preset.tone].bg} ${TONE_CLASS[preset.tone].text}`} key={preset.key}>
            {preset.shortcut}: {preset.label}
          </span>
        ))}
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">↑↓ select</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Enter detail</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">X compare</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">S shortlist</span>
      </div>
    </section>
  );
}

function CommandChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
      {label}: <span className="font-mono text-slate-100">{value}</span>
    </span>
  );
}

function QuickFilterRail({
  active,
  filters,
  onSelect,
}: {
  active: DiscoveryQuickFilterKey;
  filters: DiscoveryQuickFilter[];
  onSelect: (key: DiscoveryQuickFilterKey) => void;
}) {
  return (
    <div className="-mx-2 mt-4 flex snap-x gap-2 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-mobile-gesture-ignore="true">
      {filters.map((filter) => {
        const tone = TONE_CLASS[filter.tone];
        const selected = active === filter.key;
        return (
          <button
            className={`tv-tap-motion min-h-11 shrink-0 snap-start rounded-2xl border px-3 py-2 text-left transition ${selected ? `${tone.border} ${tone.bg} ${tone.text}` : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/25 hover:text-slate-100"}`}
            key={filter.key}
            onClick={() => onSelect(filter.key)}
            type="button"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">{filter.label}</span>
              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 font-mono text-[10px] font-black">{filter.count}</span>
            </div>
            <div className="mt-1 max-w-[14rem] truncate text-[10px] text-slate-500">{filter.summary}</div>
          </button>
        );
      })}
    </div>
  );
}

function ScannerPresetRail({ onSelect, presets }: { onSelect: (preset: DiscoveryScannerPreset) => void; presets: DiscoveryScannerPreset[] }) {
  if (!presets.length) return null;
  return (
    <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Server-side saved scan packs</div>
          <div className="mt-1 text-xs text-slate-500">Generated on the server from validated scanner rows, then applied instantly with keyboard shortcuts.</div>
        </div>
        <Sparkles className="h-4 w-4 text-cyan-200" />
      </div>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-mobile-gesture-ignore="true">
        {presets.map((preset) => {
          const tone = TONE_CLASS[preset.tone];
          return (
            <button
              className={`tv-tap-motion min-h-[4.5rem] min-w-[12rem] snap-start rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${tone.border} ${tone.bg}`}
              key={preset.key}
              onClick={() => onSelect(preset)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`text-sm font-black ${tone.text}`}>{preset.label}</div>
                <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10px] font-black text-slate-200">{preset.shortcut}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{preset.summary}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{preset.count} matches · {preset.timeframe}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdvancedFilterDeck({
  activeCount,
  assetType,
  assetTypes,
  evidence,
  marketCap,
  onAssetTypeChange,
  onClear,
  onEvidenceChange,
  onMarketCapChange,
  onRiskBandChange,
  onWatchlistOnlyChange,
  riskBand,
  watchlistOnly,
}: {
  activeCount: number;
  assetType: string;
  assetTypes: string[];
  evidence: DiscoveryEvidenceFilter;
  marketCap: DiscoveryMarketCapFilter;
  onAssetTypeChange: (value: string) => void;
  onClear: () => void;
  onEvidenceChange: (value: DiscoveryEvidenceFilter) => void;
  onMarketCapChange: (value: DiscoveryMarketCapFilter) => void;
  onRiskBandChange: (value: DiscoveryRiskBandFilter) => void;
  onWatchlistOnlyChange: (value: boolean) => void;
  riskBand: DiscoveryRiskBandFilter;
  watchlistOnly: boolean;
}) {
  return (
    <details className="group mt-3 rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-3" open={activeCount > 0 ? true : undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-cyan-200" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Advanced scanner filters</div>
            <div className="text-xs text-slate-500">Asset, market cap, evidence, risk, and watchlist constraints.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 ? <span className="rounded-full bg-cyan-300/15 px-2 py-1 font-mono text-[10px] font-black text-cyan-100">{activeCount}</span> : null}
          <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
        </div>
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <DiscoverySelect label="Asset type" onChange={onAssetTypeChange} value={assetType} values={assetTypes.map((value) => ({ key: value, label: value === "ALL" ? "All assets" : value }))} />
        <DiscoverySelect
          label="Market cap"
          onChange={(value) => onMarketCapChange(value as DiscoveryMarketCapFilter)}
          value={marketCap}
          values={[
            { key: "ALL", label: "All caps" },
            { key: "MEGA", label: "Mega cap" },
            { key: "LARGE", label: "Large cap" },
            { key: "MID", label: "Mid cap" },
            { key: "SMALL", label: "Small cap" },
            { key: "UNKNOWN", label: "Cap unknown" },
          ]}
        />
        <DiscoverySelect
          label="Risk band"
          onChange={(value) => onRiskBandChange(value as DiscoveryRiskBandFilter)}
          value={riskBand}
          values={[
            { key: "ALL", label: "All risk" },
            { key: "LOW", label: "Low risk" },
            { key: "ELEVATED", label: "Elevated risk" },
            { key: "HIGH", label: "High risk" },
          ]}
        />
        <DiscoverySelect
          label="Evidence"
          onChange={(value) => onEvidenceChange(value as DiscoveryEvidenceFilter)}
          value={evidence}
          values={[
            { key: "ALL", label: "All evidence" },
            { key: "STRONG", label: "Strong evidence" },
            { key: "DEVELOPING", label: "Developing" },
            { key: "LIMITED", label: "Limited evidence" },
          ]}
        />
        <div className="flex gap-2">
          <button
            className={`h-12 flex-1 rounded-2xl border px-3 text-xs font-black uppercase tracking-[0.12em] transition ${watchlistOnly ? "border-amber-300/35 bg-amber-300/15 text-amber-100" : "border-white/10 bg-slate-950/70 text-slate-400 hover:border-amber-300/25 hover:text-amber-100"}`}
            onClick={() => onWatchlistOnlyChange(!watchlistOnly)}
            type="button"
          >
            Watchlist
          </button>
          <button className="h-12 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 hover:border-cyan-300/25 hover:text-cyan-100" onClick={onClear} type="button">
            Clear
          </button>
        </div>
      </div>
    </details>
  );
}

function ScannerSpeedDeck({ lanes, onSelect }: { lanes: ScannerLane[]; onSelect: (filter: DiscoveryQuickFilterKey) => void }) {
  return (
    <section className="poster-panel rounded-3xl border border-white/10 bg-slate-950/50 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">One-click market exploration</div>
          <h3 className="mt-1 text-2xl font-black text-white">Fast scan the tape before opening deeper research</h3>
        </div>
        <div className="text-xs text-slate-500">Built for speed: movers, crash risk, expansion, money flow, macro, replay.</div>
      </div>
      <div className="grid gap-2 md:grid-cols-3 2xl:grid-cols-6">
        {lanes.map((lane) => {
          const tone = TONE_CLASS[lane.tone];
          const leader = lane.symbols[0];
          return (
            <button
              className={`tv-tap-motion rounded-3xl border p-3 text-left transition hover:-translate-y-0.5 ${tone.border} ${tone.bg}`}
              key={lane.key}
              onClick={() => onSelect(lane.filter)}
              type="button"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`text-sm font-black ${tone.text}`}>{lane.title}</div>
                <span className="rounded-full bg-black/25 px-2 py-0.5 font-mono text-[10px] font-black text-slate-200">{lane.symbols.length}</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-black text-white">{leader?.symbol ?? "N/A"}</div>
              <div className="mt-1 truncate text-[11px] text-slate-500">{leader ? leader.sector ?? leader.setupType : "Limited evidence"}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                {lane.symbols.slice(0, 4).map((symbol) => (
                  <span className="rounded-full bg-slate-950/55 px-2 py-1 font-mono text-[10px] font-black text-slate-300" key={symbol.symbol}>{symbol.symbol}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ScannerLaneBoard({ lanes, onSelect }: { lanes: ScannerLane[]; onSelect: (filter: DiscoveryQuickFilterKey) => void }) {
  return (
    <section className="poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/50 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Scanner dominance lanes</div>
          <h3 className="mt-1 text-2xl font-black text-white">Fast discovery for momentum, danger, replay, and macro support</h3>
        </div>
        <div className="text-xs text-slate-500">Tap a lane to load its scanner preset</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {lanes.map((lane) => {
          const tone = TONE_CLASS[lane.tone];
          return (
            <button
              className={`tv-tap-motion rounded-3xl border p-3 text-left transition hover:-translate-y-0.5 ${tone.border} ${tone.bg} ${tone.glow}`}
              key={lane.key}
              onClick={() => onSelect(lane.filter)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-sm font-black ${tone.text}`}>{lane.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{lane.detail}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] font-black text-slate-200">{lane.timeframe}</div>
              </div>
              <div className="mt-3 grid gap-2">
                {lane.symbols.length ? lane.symbols.slice(0, 5).map((symbol, index) => (
                  <div className="grid grid-cols-[1.5rem_4.25rem_1fr_auto] items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-2 py-2" key={symbol.symbol}>
                    <span className={`font-mono text-xs font-black ${tone.text}`}>{index + 1}</span>
                    <span className="font-mono text-sm font-black text-white">{symbol.symbol}</span>
                    <span className="truncate text-[11px] text-slate-500">{symbol.sector ?? symbol.setupType}</span>
                    <span className={`font-mono text-xs font-black ${perfTone(symbol.performance[lane.timeframe]) === "rose" ? "text-rose-200" : "text-emerald-200"}`}>{formatSigned(symbol.performance[lane.timeframe])}</span>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">Limited ranked evidence available for this scanner lane.</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SymbolResultGrid({
  activeSymbol,
  compareSymbols,
  density,
  onOpen,
  onDensityChange,
  onToggleCompare,
  onToggleShortlist,
  resultCount,
  shortlistedSymbols,
  symbols,
  timeframe,
}: {
  activeSymbol: string | null;
  compareSymbols: string[];
  density: ResultDensity;
  onOpen: (symbol: DiscoverySymbol) => void;
  onDensityChange: (density: ResultDensity) => void;
  onToggleCompare: (symbol: string) => void;
  onToggleShortlist: (symbol: string) => void;
  resultCount: number;
  shortlistedSymbols: string[];
  symbols: DiscoverySymbol[];
  timeframe: DiscoveryTimeframe;
}) {
  return (
    <section className="poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/48 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Full-universe results</div>
          <h3 className="mt-1 text-xl font-black text-white">Searchable scanner command grid</h3>
          <div className="mt-1 text-xs text-slate-500">{formatHydrationSafeInteger(resultCount)} matching rows. Showing {formatHydrationSafeInteger(symbols.length)} for fast rendering.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${density === "dense" ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-cyan-100"}`}
            onClick={() => onDensityChange("dense")}
            title="Dense scanner"
            type="button"
          >
            <span className="font-mono text-[10px] font-black">24</span>
          </button>
          <button
            className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${density === "speed" ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-cyan-100"}`}
            onClick={() => onDensityChange("speed")}
            title="Speed table"
            type="button"
          >
            <ListFilter className="h-4 w-4" />
          </button>
          <button
            className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${density === "cards" ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-cyan-100"}`}
            onClick={() => onDensityChange("cards")}
            title="Card grid"
            type="button"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>
      {symbols.length ? (
        density === "speed" || density === "dense" ? (
          <RapidScannerTable activeSymbol={activeSymbol} compact={density === "dense"} compareSymbols={compareSymbols} onOpen={onOpen} onToggleCompare={onToggleCompare} onToggleShortlist={onToggleShortlist} shortlistedSymbols={shortlistedSymbols} symbols={symbols} timeframe={timeframe} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {symbols.map((symbol) => (
              <DiscoverySymbolCard compareSelected={compareSymbols.includes(symbol.symbol)} key={symbol.symbol} onOpen={onOpen} onToggleCompare={onToggleCompare} onToggleShortlist={onToggleShortlist} shortlisted={shortlistedSymbols.includes(symbol.symbol)} symbol={symbol} timeframe={timeframe} />
            ))}
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-6 text-sm leading-6 text-slate-400">
          No symbols match this exact search. Clear filters or switch to Full universe to broaden the scanner.
        </div>
      )}
    </section>
  );
}

function RapidScannerTable({
  activeSymbol,
  compact,
  compareSymbols,
  onOpen,
  onToggleCompare,
  onToggleShortlist,
  shortlistedSymbols,
  symbols,
  timeframe,
}: {
  activeSymbol: string | null;
  compact: boolean;
  compareSymbols: string[];
  onOpen: (symbol: DiscoverySymbol) => void;
  onToggleCompare: (symbol: string) => void;
  onToggleShortlist: (symbol: string) => void;
  shortlistedSymbols: string[];
  symbols: DiscoverySymbol[];
  timeframe: DiscoveryTimeframe;
}) {
  const columns = compact
    ? "xl:grid-cols-[2.5rem_5rem_minmax(9rem,1fr)_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_7rem]"
    : "xl:grid-cols-[3rem_5.5rem_minmax(8rem,1fr)_5rem_5rem_5rem_5rem_5rem_6.5rem]";
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/48">
      <div className={`grid gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 max-xl:hidden ${columns}`}>
        <span>Rank</span>
        <span>Symbol</span>
        <span>Context</span>
        <span>{timeframe}</span>
        <span>Conf</span>
        <span>Risk</span>
        <span>Macro</span>
        <span>Replay</span>
        {compact ? <span>Fresh</span> : null}
        <span>Action</span>
      </div>
      <div className={`${compact ? "max-h-[56rem]" : "max-h-[44rem]"} overflow-y-auto [scrollbar-width:thin]`}>
        {symbols.map((symbol, index) => {
          const riskTone: DiscoveryTone = (symbol.risk ?? 0) >= 70 ? "rose" : (symbol.risk ?? 0) >= 55 ? "amber" : "cyan";
          const selected = compareSymbols.includes(symbol.symbol);
          const shortlisted = shortlistedSymbols.includes(symbol.symbol);
          const active = activeSymbol === symbol.symbol;
          return (
            <div
              className={`grid gap-2 border-b border-white/[0.06] px-3 transition hover:bg-cyan-300/[0.045] xl:items-center ${compact ? "py-1.5" : "py-3"} ${columns} ${active ? "bg-cyan-300/[0.07] ring-1 ring-inset ring-cyan-300/25" : ""}`}
              key={symbol.symbol}
            >
              <div className="hidden font-mono text-xs font-black text-slate-500 xl:block">{index + 1}</div>
              <button className="flex min-w-0 items-center gap-2 text-left xl:block" data-stable-overlay-trigger="true" onClick={() => onOpen(symbol)} type="button">
                <span className="font-mono text-lg font-black text-white">{symbol.symbol}</span>
                {symbol.watchlisted ? <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300 xl:hidden" /> : null}
                <span className="ml-auto font-mono text-xs text-slate-500 xl:hidden">#{index + 1}</span>
              </button>
              <button className="min-w-0 text-left" data-stable-overlay-trigger="true" onClick={() => onOpen(symbol)} type="button">
                <div className="truncate text-sm font-semibold text-slate-200">{symbol.companyName ?? symbol.sector ?? symbol.setupType}</div>
                <div className="truncate text-[11px] text-slate-500">{humanizeInsightText(symbol.reason)}</div>
              </button>
              <ScannerCell tone={perfTone(symbol.performance[timeframe])} value={formatSigned(symbol.performance[timeframe])} />
              <ScannerCell tone="emerald" value={scoreLabel(symbol.confidence ?? symbol.conviction)} />
              <ScannerCell tone={riskTone} value={scoreLabel(symbol.risk)} />
              <ScannerCell tone="cyan" value={scoreLabel(symbol.macro)} />
              <ScannerCell tone="violet" value={scoreLabel(symbol.replay)} />
              {compact ? <ScannerCell tone="amber" value={scoreLabel(symbol.freshness)} /> : null}
              <div className="flex gap-2">
                <button className={`h-9 rounded-xl border px-2 text-[10px] font-black uppercase tracking-[0.1em] ${shortlisted ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-amber-100"}`} onClick={() => onToggleShortlist(symbol.symbol)} type="button">
                  ★
                </button>
                <button className={`h-9 flex-1 rounded-xl border px-2 text-[10px] font-black uppercase tracking-[0.1em] ${selected ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-cyan-100"}`} onClick={() => onToggleCompare(symbol.symbol)} type="button">
                  {selected ? "On" : "Cmp"}
                </button>
                <Link className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-slate-400 hover:border-cyan-300/30 hover:text-cyan-100" href={symbol.href}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScannerCell({ tone, value }: { tone: DiscoveryTone; value: string }) {
  return <div className={`rounded-xl border border-white/10 bg-white/[0.025] px-2 py-1.5 font-mono text-xs font-black ${TONE_CLASS[tone].text}`}>{value}</div>;
}

function DiscoverySymbolCard({
  compareSelected,
  onOpen,
  onToggleCompare,
  onToggleShortlist,
  shortlisted,
  symbol,
  timeframe,
}: {
  compareSelected: boolean;
  onOpen: (symbol: DiscoverySymbol) => void;
  onToggleCompare: (symbol: string) => void;
  onToggleShortlist: (symbol: string) => void;
  shortlisted: boolean;
  symbol: DiscoverySymbol;
  timeframe: DiscoveryTimeframe;
}) {
  const riskTone: DiscoveryTone = (symbol.risk ?? 0) >= 70 ? "rose" : (symbol.risk ?? 0) >= 55 ? "amber" : "cyan";
  const perf = symbol.performance[timeframe];
  return (
    <motion.article className={`group rounded-3xl border bg-slate-950/54 p-3 shadow-xl transition hover:-translate-y-0.5 ${TONE_CLASS[riskTone].border} ${TONE_CLASS[riskTone].glow}`} whileHover={{ scale: 1.006 }} transition={{ duration: 0.18 }}>
      <button className="w-full text-left" data-stable-overlay-trigger="true" onClick={() => onOpen(symbol)} type="button">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-mono text-2xl font-black text-white">{symbol.symbol}</div>
              {symbol.watchlisted ? <Star className="h-4 w-4 fill-amber-300 text-amber-300" /> : null}
            </div>
            <div className="mt-1 truncate text-xs text-slate-400">{symbol.companyName ?? symbol.sector ?? "Validated scanner row"}</div>
          </div>
          <div className={`rounded-2xl px-3 py-2 text-right ${TONE_CLASS[riskTone].bg}`}>
            <div className={`font-mono text-lg font-black ${TONE_CLASS[riskTone].text}`}>{scoreLabel(symbol.confidence ?? symbol.conviction)}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">confidence</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MicroMetric label="Price" value={symbol.price === null ? "N/A" : formatMoney(symbol.price)} />
          <MicroMetric label={timeframe} tone={perfTone(perf)} value={formatSigned(perf)} />
          <MicroMetric label="Risk" tone={riskTone} value={scoreLabel(symbol.risk)} />
        </div>
        <div className="mt-3">
          <PosterTrendChart className="!p-2" emptyMessage="No validated performance series." label="Performance context" tone={perfTone(perf) as PosterVisualTone} values={["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"].map((tf) => symbol.performance[tf as DiscoveryTimeframe])} />
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{humanizeInsightText(symbol.reason)}</p>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${shortlisted ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-amber-100"}`} onClick={() => onToggleShortlist(symbol.symbol)} type="button">
          {shortlisted ? "Shortlisted" : "Shortlist"}
        </button>
        <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${compareSelected ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-cyan-100"}`} onClick={() => onToggleCompare(symbol.symbol)} type="button">
          {compareSelected ? "Comparing" : "Compare"}
        </button>
        <Link className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 hover:border-cyan-300/30 hover:text-cyan-100" href={symbol.href}>
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.article>
  );
}

function ShortlistDock({
  compareShortlist,
  onClear,
  onOpen,
  onToggleShortlist,
  symbols,
}: {
  compareShortlist: () => void;
  onClear: () => void;
  onOpen: (symbol: DiscoverySymbol) => void;
  onToggleShortlist: (symbol: string) => void;
  symbols: DiscoverySymbol[];
}) {
  return (
    <section className="poster-panel rounded-3xl border border-amber-300/16 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Rapid shortlist</div>
          <h3 className="text-lg font-black text-white">Research queue</h3>
        </div>
        <div className="font-mono text-lg font-black text-amber-100">{symbols.length}</div>
      </div>
      {symbols.length ? (
        <>
          <div className="mt-3 grid gap-2">
            {symbols.slice(0, 8).map((symbol) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2" key={symbol.symbol}>
                <button className="min-w-0 text-left" data-stable-overlay-trigger="true" onClick={() => onOpen(symbol)} type="button">
                  <div className="font-mono text-sm font-black text-white">{symbol.symbol}</div>
                  <div className="truncate text-[10px] text-slate-500">{symbol.sector ?? symbol.setupType}</div>
                </button>
                <span className={`font-mono text-xs font-black ${TONE_CLASS[perfTone(symbol.performance["1D"])].text}`}>{formatSigned(symbol.performance["1D"])}</span>
                <button className="grid h-8 w-8 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-100" onClick={() => onToggleShortlist(symbol.symbol)} type="button">×</button>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100" onClick={compareShortlist} type="button">Compare shortlist</button>
            <button className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 hover:text-slate-100" onClick={onClear} type="button">Clear</button>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-xs leading-5 text-slate-400">Use `S`, the star button, or Shortlist top to build a fast research queue without leaving the scanner.</div>
      )}
    </section>
  );
}

function CompareModePanel({
  compareRows,
  onCompareShortlist,
  onCompareVisible,
  presets,
  setCompareSymbols,
}: {
  compareRows: DiscoverySymbol[];
  onCompareShortlist: () => void;
  onCompareVisible: () => void;
  presets: IntelligenceDiscoverySystem["comparePresets"];
  setCompareSymbols: (symbols: string[]) => void;
}) {
  return (
    <section className="poster-panel sticky top-24 rounded-3xl border border-violet-300/16 bg-slate-950/50 p-4" id="compare">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-100">
          <GitCompare className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">Compare mode</div>
          <h3 className="text-lg font-black text-white">Side-by-side intelligence</h3>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100" onClick={onCompareVisible} type="button">
          Compare visible
        </button>
        <button className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100" onClick={onCompareShortlist} type="button">
          Compare shortlist
        </button>
        {presets.map((preset) => (
          <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${TONE_CLASS[preset.tone].border} ${TONE_CLASS[preset.tone].bg} ${TONE_CLASS[preset.tone].text}`} key={preset.key} onClick={() => setCompareSymbols(preset.symbols.slice(0, 4))} type="button">
            {preset.label}
          </button>
        ))}
      </div>
      {compareRows.length >= 2 ? <CompareMatrix rows={compareRows} /> : null}
      <div className="mt-4 grid gap-3">
        {compareRows.length ? compareRows.map((symbol) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={symbol.symbol}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-black text-white">{symbol.symbol}</div>
                <div className="text-xs text-slate-500">{symbol.sector ?? "Sector limited"}</div>
              </div>
              <div className="font-mono text-lg font-black text-cyan-100">{scoreLabel(symbol.confidence ?? symbol.conviction)}</div>
            </div>
            <PosterFactorBars
              className="mt-3"
              factors={[
                { label: "Risk", tone: "rose", value: symbol.risk },
                { label: "Macro", tone: "cyan", value: symbol.macro },
                { label: "Replay", tone: "violet", value: symbol.replay },
                { label: "Fresh", tone: "emerald", value: symbol.freshness },
              ]}
              label="Compare factors"
            />
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">Select scanner cards or a preset to compare symbols.</div>
        )}
      </div>
    </section>
  );
}

function CompareMatrix({ rows }: { rows: DiscoverySymbol[] }) {
  const metrics: Array<{ key: string; label: string; tone: DiscoveryTone; value: (symbol: DiscoverySymbol) => number | null }> = [
    { key: "confidence", label: "Confidence", tone: "emerald", value: (symbol) => symbol.confidence ?? symbol.conviction },
    { key: "risk", label: "Risk", tone: "rose", value: (symbol) => symbol.risk },
    { key: "macro", label: "Macro", tone: "cyan", value: (symbol) => symbol.macro },
    { key: "replay", label: "Replay", tone: "violet", value: (symbol) => symbol.replay },
    { key: "1d", label: "1D", tone: "emerald", value: (symbol) => symbol.performance["1D"] },
    { key: "1m", label: "1M", tone: "cyan", value: (symbol) => symbol.performance["1M"] },
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
      <div className="grid border-b border-white/10 bg-white/[0.035] text-[10px] font-black uppercase tracking-[0.12em] text-slate-500" style={{ gridTemplateColumns: `8rem repeat(${rows.length}, minmax(4.25rem, 1fr))` }}>
        <div className="px-3 py-2">Metric</div>
        {rows.map((symbol) => <div className="px-3 py-2 font-mono text-slate-300" key={symbol.symbol}>{symbol.symbol}</div>)}
      </div>
      {metrics.map((metric) => {
        const values = rows.map(metric.value);
        const leader = leaderIndex(values, metric.key === "risk");
        return (
          <div className="grid border-b border-white/[0.06] text-xs last:border-b-0" key={metric.key} style={{ gridTemplateColumns: `8rem repeat(${rows.length}, minmax(4.25rem, 1fr))` }}>
            <div className="px-3 py-2 font-semibold text-slate-400">{metric.label}</div>
            {values.map((value, index) => (
              <div className={`px-3 py-2 font-mono font-black ${index === leader ? TONE_CLASS[metric.tone].text : "text-slate-500"}`} key={`${metric.key}-${rows[index]?.symbol ?? index}`}>
                {metric.key === "1d" || metric.key === "1m" ? formatSigned(value) : scoreLabel(value)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DiscoveryGaugeDeck({ system }: { system: IntelligenceDiscoverySystem }) {
  const avgRisk = average(system.symbols.map((symbol) => symbol.risk));
  const avgMacro = average(system.symbols.map((symbol) => symbol.macro));
  return (
    <section className="poster-panel rounded-3xl border border-white/10 bg-slate-950/50 p-4">
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Discovery command gauges</div>
      <div className="grid grid-cols-3 gap-2">
        <PosterRadialGauge label="Discovery" score={system.discoveryScore} tone="cyan" />
        <PosterRadialGauge label="Risk" score={avgRisk} tone={avgRisk >= 65 ? "rose" : "amber"} />
        <PosterRadialGauge label="Macro" score={avgMacro} tone="emerald" />
      </div>
    </section>
  );
}

function MomentumExplorer({ clusters, onSelectCluster }: { clusters: DiscoveryCluster[]; onSelectCluster: (cluster: DiscoveryCluster) => void }) {
  return (
    <section className="poster-panel rounded-3xl border border-emerald-300/16 bg-slate-950/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">Performance discovery</div>
          <h3 className="text-xl font-black text-white">Momentum map</h3>
        </div>
        <TrendingUp className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {clusters.map((cluster) => <ClusterMiniCard cluster={cluster} key={cluster.key} onClick={onSelectCluster} />)}
      </div>
    </section>
  );
}

function RiskExplorer({ clusters, onSelectCluster }: { clusters: DiscoveryCluster[]; onSelectCluster: (cluster: DiscoveryCluster) => void }) {
  return (
    <section className="poster-panel rounded-3xl border border-rose-300/16 bg-slate-950/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-200">Risk discovery</div>
          <h3 className="text-xl font-black text-white">Deterioration scanner</h3>
        </div>
        <ShieldAlert className="h-5 w-5 text-rose-200" />
      </div>
      <div className="grid gap-3">
        {clusters.map((cluster) => <ClusterMiniCard cluster={cluster} key={cluster.key} onClick={onSelectCluster} />)}
      </div>
    </section>
  );
}

function StoryStack({ stories }: { stories: IntelligenceDiscoverySystem["stories"] }) {
  return (
    <section className="poster-panel rounded-3xl border border-white/10 bg-slate-950/50 p-4">
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Discovery storytelling</div>
      <div className="grid gap-2">
        {stories.slice(0, 5).map((story) => (
          <div className={`rounded-2xl border p-3 ${TONE_CLASS[story.tone].border} ${TONE_CLASS[story.tone].bg}`} key={story.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-sm font-black ${TONE_CLASS[story.tone].text}`}>{story.title}</div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{humanizeInsightText(story.detail)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 font-mono text-[10px] font-black text-slate-300">{story.metric}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {story.symbols.slice(0, 6).map((symbol) => <span className="rounded-full bg-slate-950/55 px-2 py-1 font-mono text-[10px] font-black text-slate-300" key={symbol}>{symbol}</span>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClusterMiniCard({ cluster, onClick }: { cluster: DiscoveryCluster; onClick: (cluster: DiscoveryCluster) => void }) {
  const tone = TONE_CLASS[cluster.tone];
  return (
    <button className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${tone.border} ${tone.bg}`} data-stable-overlay-trigger="true" onClick={() => onClick(cluster)} type="button">
      <div className="flex items-center justify-between gap-2">
        <div className={`text-sm font-black ${tone.text}`}>{cluster.label}</div>
        <div className="font-mono text-lg font-black text-white">{cluster.count}</div>
      </div>
      <PosterTrendChart className="mt-3 !p-2" emptyMessage="Limited cluster trend." label="Cluster values" tone={cluster.tone as PosterVisualTone} values={cluster.values} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cluster.symbols.slice(0, 5).map((symbol) => <span className="rounded-full bg-slate-950/55 px-2 py-1 font-mono text-[10px] font-black text-slate-300" key={symbol}>{symbol}</span>)}
      </div>
    </button>
  );
}

function SymbolDetailOverlay({ onClose, symbol, timeframe }: { onClose: () => void; symbol: DiscoverySymbol | null; timeframe: DiscoveryTimeframe }) {
  return (
    <StableDetailOverlay
      analyticsSurface="discovery_symbol_detail"
      description={symbol ? `${symbol.symbol} discovery context. Research only, not a recommendation to buy or sell.` : null}
      eyebrow="Discovery detail"
      onClose={onClose}
      open={Boolean(symbol)}
      size="xl"
      title={symbol ? `${symbol.symbol} intelligence discovery` : "Discovery detail"}
    >
      {symbol ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-cyan-300/16 bg-slate-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-4xl font-black text-white">{symbol.symbol}</div>
                  <div className="mt-1 text-sm text-slate-400">{symbol.companyName ?? symbol.sector ?? "Validated scanner row"}</div>
                </div>
                <Link className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100" href={symbol.href}>Open full detail</Link>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{humanizeInsightText(symbol.reason)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MicroMetric label="Price" value={symbol.price === null ? "N/A" : formatMoney(symbol.price)} />
                <MicroMetric label={timeframe} tone={perfTone(symbol.performance[timeframe])} value={formatSigned(symbol.performance[timeframe])} />
                <MicroMetric label="Decision" value={humanizeLabel(symbol.decision)} />
                <MicroMetric label="Evidence" value={symbol.evidenceLabel} />
              </div>
            </div>
            <PosterTrendChart label="Performance timeline" tone={perfTone(symbol.performance[timeframe]) as PosterVisualTone} values={TIMEFRAMES.map((tf) => symbol.performance[tf])} />
          </div>
          <div className="space-y-4">
            <PosterFactorBars
              factors={[
                { label: "Confidence", tone: "emerald", value: symbol.confidence ?? symbol.conviction },
                { label: "Risk", tone: "rose", value: symbol.risk },
                { label: "Macro", tone: "cyan", value: symbol.macro },
                { label: "Replay", tone: "violet", value: symbol.replay },
                { label: "Freshness", tone: "amber", value: symbol.freshness },
                { label: "Evidence", tone: "emerald", value: symbol.evidence },
              ]}
              label="Discovery factor comparison"
            />
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">What to inspect next</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <div>Macro: {scoreLabel(symbol.macro)} / Replay: {scoreLabel(symbol.replay)}</div>
                <div>Risk: {scoreLabel(symbol.risk)} / Shock: {scoreLabel(symbol.shockRisk)}</div>
                <div>Freshness: {symbol.freshnessLabel}</div>
                <div>Watchlist: {symbol.watchlisted ? "Saved" : "Not saved"}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </StableDetailOverlay>
  );
}

function ClusterDetailOverlay({ cluster, onClose }: { cluster: DiscoveryCluster | null; onClose: () => void }) {
  return (
    <StableDetailOverlay
      analyticsSurface="discovery_cluster_detail"
      description={cluster?.detail ?? null}
      eyebrow="Discovery cluster"
      onClose={onClose}
      open={Boolean(cluster)}
      size="lg"
      title={cluster?.label ?? "Discovery cluster"}
    >
      {cluster ? (
        <div className="space-y-4">
          <PosterTrendChart label="Cluster value history" tone={cluster.tone as PosterVisualTone} values={cluster.values} />
          <div className="grid gap-2 sm:grid-cols-2">
            <MiniStat label="Symbols" value={formatHydrationSafeInteger(cluster.count)} />
            <MiniStat label="Avg score" value={scoreLabel(cluster.averageScore)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {cluster.symbols.map((symbol) => (
              <Link className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs font-black text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100" href={`/symbol/${encodeURIComponent(symbol)}`} key={symbol}>
                {symbol}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </StableDetailOverlay>
  );
}

function LimitedDiscoveryState({ system }: { system: IntelligenceDiscoverySystem }) {
  return (
    <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.07] p-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 h-5 w-5 text-amber-200" />
        <div>
          <h2 className="text-xl font-black text-white">{system.headline}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{system.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100" href="/account">Sign in / upgrade</Link>
            <Link className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-300" href="/opportunities">View public preview</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscoverySelect({ label, onChange, value, values }: { label: string; onChange: (value: string) => void; value: string; values: Array<{ key: string; label: string }> }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 text-sm font-semibold text-slate-200 outline-none focus:border-cyan-300/45" onChange={(event) => onChange(event.currentTarget.value)} value={value}>
        {values.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
    </label>
  );
}

function HeroMetric({ Icon, label, tone, value }: { Icon: LucideIcon; label: string; tone: DiscoveryTone; value: string }) {
  return (
    <div className={`rounded-3xl border p-4 ${TONE_CLASS[tone].border} ${TONE_CLASS[tone].bg}`}>
      <div className="flex items-center justify-between gap-3">
        <Icon className={`h-5 w-5 ${TONE_CLASS[tone].text}`} />
        <div className={`font-mono text-2xl font-black ${TONE_CLASS[tone].text}`}>{value}</div>
      </div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
    </div>
  );
}

function MiniMetric({ label, tone = "cyan", value }: { label: string; tone?: DiscoveryTone; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <div className={`truncate font-mono text-sm font-black ${TONE_CLASS[tone].text}`}>{value}</div>
      <div className="mt-0.5 truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
    </div>
  );
}

function MicroMetric(props: { label: string; tone?: DiscoveryTone; value: string }) {
  return <MiniMetric {...props} />;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="font-mono text-xl font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
    </div>
  );
}

function clusterForNode(system: IntelligenceDiscoverySystem, key: string): DiscoveryCluster | null {
  const all = [...system.sectorHeatmap, ...system.momentumClusters, ...system.riskClusters, ...system.macroClusters];
  return all.find((cluster) => cluster.key === key || cluster.label === key) ?? all[0] ?? null;
}

function buildScannerLanes(symbols: DiscoverySymbol[]): ScannerLane[] {
  const definitions: Array<Omit<ScannerLane, "symbols">> = [
    {
      detail: "Strongest validated one-day performers.",
      filter: "top_gainers_1d",
      key: "top-gainers",
      sort: "performance",
      timeframe: "1D",
      title: "Top gainers",
      tone: "emerald",
    },
    {
      detail: "Largest one-day downside movers for risk triage.",
      filter: "top_losers_1d",
      key: "top-losers",
      sort: "weakness",
      timeframe: "1D",
      title: "Top losers",
      tone: "rose",
    },
    {
      detail: "Expansion pressure, volatility, replay, and trend context.",
      filter: "breakout_candidates",
      key: "breakout",
      sort: "breakout",
      timeframe: "1W",
      title: "Breakout candidates",
      tone: "violet",
    },
    {
      detail: "Fragility, downside pressure, shock risk, and weak structure.",
      filter: "crash_risk",
      key: "crash-risk",
      sort: "crash",
      timeframe: "1D",
      title: "Crash-risk candidates",
      tone: "rose",
    },
    {
      detail: "Sector leadership, performance, macro alignment, and liquidity context.",
      filter: "money_flow",
      key: "money-flow",
      sort: "money_flow",
      timeframe: "1D",
      title: "Money-flow leaders",
      tone: "cyan",
    },
    {
      detail: "Historical similarity or replay support visible in the scanner packet.",
      filter: "replay_supported",
      key: "replay",
      sort: "replay",
      timeframe: "1M",
      title: "Replay-supported setups",
      tone: "violet",
    },
    {
      detail: "Symbols with supportive macro and market-context alignment.",
      filter: "macro_supported",
      key: "macro",
      sort: "macro",
      timeframe: "1M",
      title: "Macro-supported setups",
      tone: "cyan",
    },
  ];

  return definitions.map((definition) => ({
    ...definition,
    symbols: filterDiscoverySymbols(symbols, {
      filter: definition.filter,
      query: "",
      sector: "ALL",
      sort: definition.sort,
      timeframe: definition.timeframe,
    }).slice(0, 5),
  }));
}

function buildSpeedLanes(symbols: DiscoverySymbol[]): ScannerLane[] {
  const definitions: Array<Omit<ScannerLane, "symbols">> = [
    { detail: "Largest validated positive one-day moves.", filter: "top_gainers_1d", key: "speed-gainers", sort: "performance", timeframe: "1D", title: "Top movers", tone: "emerald" },
    { detail: "Largest validated one-day downside movers.", filter: "top_losers_1d", key: "speed-losers", sort: "weakness", timeframe: "1D", title: "Downside movers", tone: "rose" },
    { detail: "Breakout and expansion pressure candidates.", filter: "breakout_candidates", key: "speed-expansion", sort: "breakout", timeframe: "1W", title: "Expansion", tone: "violet" },
    { detail: "Crash-risk, fragility, and shock pressure.", filter: "crash_risk", key: "speed-crash", sort: "crash", timeframe: "1D", title: "Crash risk", tone: "rose" },
    { detail: "Money-flow alignment across sector, macro, performance, and volume.", filter: "money_flow", key: "speed-flow", sort: "money_flow", timeframe: "1D", title: "Money flow", tone: "cyan" },
    { detail: "Macro-supported scanner rows.", filter: "macro_supported", key: "speed-macro", sort: "macro", timeframe: "1M", title: "Macro support", tone: "cyan" },
  ];
  return definitions.map((definition) => ({
    ...definition,
    symbols: filterDiscoverySymbols(symbols, {
      filter: definition.filter,
      query: "",
      sector: "ALL",
      sort: definition.sort,
      timeframe: definition.timeframe,
    }).slice(0, 6),
  }));
}

function average(values: Array<number | null | undefined>): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function uniqueSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of symbols) {
    const symbol = value.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    result.push(symbol);
  }
  return result;
}

function leaderIndex(values: Array<number | null>, lowerIsBetter: boolean): number {
  let bestIndex = -1;
  let bestValue = lowerIsBetter ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) return;
    if (lowerIsBetter ? value < bestValue : value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function scoreLabel(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}` : "Limited";
}

function formatSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Limited";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 1)}%`;
}

function perfTone(value: number | null): DiscoveryTone {
  if (value === null) return "cyan";
  if (value >= 3) return "emerald";
  if (value <= -3) return "rose";
  return "cyan";
}
