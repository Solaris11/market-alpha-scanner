"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  GitCompare,
  Globe2,
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
  type DiscoveryFilterState,
  type DiscoveryQuickFilter,
  type DiscoveryQuickFilterKey,
  type DiscoveryScannerPreset,
  type DiscoverySortKey,
  type DiscoverySymbol,
  type DiscoveryTimeframe,
  type DiscoveryTone,
  type IntelligenceDiscoverySystem,
} from "@/lib/trading/intelligence-discovery";
import { trackAnalyticsEvent, trackFirstUsefulAction } from "@/lib/client/analytics";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";

type DiscoveryMode = "overlay" | "page";
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
  macro_supported: { sort: "macro", timeframe: "1M" },
  momentum_deterioration: { sort: "weakness", timeframe: "1W" },
  replay_supported: { sort: "replay", timeframe: "1M" },
  risk_escalation: { sort: "risk", timeframe: "1D" },
  top_gainers_1d: { sort: "performance", timeframe: "1D" },
  top_gainers_1m: { sort: "performance", timeframe: "1M" },
  top_gainers_1w: { sort: "performance", timeframe: "1W" },
  top_losers_1d: { sort: "weakness", timeframe: "1D" },
  top_losers_1m: { sort: "weakness", timeframe: "1M" },
  top_losers_1w: { sort: "weakness", timeframe: "1W" },
  volatility_expansion: { sort: "breakout", timeframe: "1W" },
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
  const [filter, setFilter] = useState<DiscoveryQuickFilterKey>("all");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("ALL");
  const [sort, setSort] = useState<DiscoverySortKey>("attention");
  const [timeframe, setTimeframe] = useState<DiscoveryTimeframe>("1M");
  const [selectedSymbol, setSelectedSymbol] = useState<DiscoverySymbol | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<DiscoveryCluster | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(system.comparePresets[0]?.symbols.slice(0, 3) ?? []);

  const state: DiscoveryFilterState = { filter, query, sector, sort, timeframe };
  const filtered = useMemo(() => filterDiscoverySymbols(system.symbols, state), [filter, query, sector, sort, system.symbols, timeframe]);
  const sectors = useMemo(() => ["ALL", ...Array.from(new Set(system.symbols.map((symbol) => symbol.sector).filter((value): value is string => Boolean(value)))).sort()], [system.symbols]);
  const compareRows = useMemo(() => compareSymbols.map((symbol) => system.symbols.find((candidate) => candidate.symbol === symbol)).filter((value): value is DiscoverySymbol => Boolean(value)), [compareSymbols, system.symbols]);
  const scannerLanes = useMemo(() => buildScannerLanes(system.symbols), [system.symbols]);
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

  useEffect(() => {
    trackAnalyticsEvent("scanner_usage", { action: "open_discovery_workspace", universeCount: system.universeCount }, { source: "discovery_workspace" });
  }, [system.universeCount]);

  function toggleCompare(symbol: string): void {
    setCompareSymbols((current) => {
      if (current.includes(symbol)) return current.filter((item) => item !== symbol);
      trackAnalyticsEvent("scanner_usage", { action: "compare_add", symbol }, { source: "discovery_compare", symbol });
      trackFirstUsefulAction("scanner_compare", { symbol }, { source: "discovery_compare", symbol });
      return [symbol, ...current].slice(0, 4);
    });
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
    trackAnalyticsEvent("scanner_usage", { action: "preset", preset: preset.key, resultCount: preset.count, sort: preset.sort, timeframe: preset.timeframe }, { source: "discovery_preset" });
    trackFirstUsefulAction("scanner_preset", { preset: preset.key }, { source: "discovery_preset" });
  }

  function applyScannerLane(nextFilter: DiscoveryQuickFilterKey): void {
    applyScannerFilter(nextFilter);
    setQuery("");
    setSector("ALL");
    trackAnalyticsEvent("scanner_usage", { action: "lane", filter: nextFilter }, { source: "discovery_lane" });
  }

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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="poster-panel overflow-hidden rounded-3xl border border-cyan-300/16 bg-slate-950/52 p-4 shadow-2xl shadow-cyan-950/10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Global intelligence search</div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Explore every validated scanner row</h2>
                </div>
                <div className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  {filtered.length.toLocaleString()} / {system.universeCount.toLocaleString()} visible
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
                <MiniStat label="Universe" value={system.universeCount.toLocaleString()} />
                <MiniStat label="Watch" value={system.watchlistCount.toLocaleString()} />
                <MiniStat label="Updated" value={formatTime(system.dataTimestamp ?? system.generatedAt)} />
              </div>
            </div>
          </div>

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
            <SymbolResultGrid compareSymbols={compareSymbols} onOpen={setSelectedSymbol} onToggleCompare={toggleCompare} symbols={filtered.slice(0, mode === "overlay" ? 18 : 36)} timeframe={timeframe} />
            <CompareModePanel compareRows={compareRows} presets={system.comparePresets} setCompareSymbols={setCompareSymbols} />
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
          <HeroMetric Icon={Radar} label="Universe" tone="cyan" value={system.universeCount.toLocaleString()} />
          <HeroMetric Icon={Sparkles} label="Discovery score" tone="emerald" value={`${system.discoveryScore}/100`} />
          <HeroMetric Icon={Star} label="Watchlist linked" tone="amber" value={system.watchlistCount.toLocaleString()} />
        </div>
      </div>
    </div>
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
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Saved scanner presets</div>
          <div className="mt-1 text-xs text-slate-500">Fast Finviz/Trade Ideas-style discovery workflows with TradeVeto context.</div>
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
                <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10px] font-black text-slate-200">{preset.count}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{preset.summary}</div>
            </button>
          );
        })}
      </div>
    </div>
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
  compareSymbols,
  onOpen,
  onToggleCompare,
  symbols,
  timeframe,
}: {
  compareSymbols: string[];
  onOpen: (symbol: DiscoverySymbol) => void;
  onToggleCompare: (symbol: string) => void;
  symbols: DiscoverySymbol[];
  timeframe: DiscoveryTimeframe;
}) {
  return (
    <section className="poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/48 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Full-universe results</div>
          <h3 className="mt-1 text-xl font-black text-white">Searchable scanner command grid</h3>
        </div>
        <div className="text-xs text-slate-500">Select up to 4 for compare</div>
      </div>
      {symbols.length ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {symbols.map((symbol) => (
            <DiscoverySymbolCard compareSelected={compareSymbols.includes(symbol.symbol)} key={symbol.symbol} onOpen={onOpen} onToggleCompare={onToggleCompare} symbol={symbol} timeframe={timeframe} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-6 text-sm leading-6 text-slate-400">
          No symbols match this exact search. Clear filters or switch to Full universe to broaden the scanner.
        </div>
      )}
    </section>
  );
}

function DiscoverySymbolCard({
  compareSelected,
  onOpen,
  onToggleCompare,
  symbol,
  timeframe,
}: {
  compareSelected: boolean;
  onOpen: (symbol: DiscoverySymbol) => void;
  onToggleCompare: (symbol: string) => void;
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

function CompareModePanel({
  compareRows,
  presets,
  setCompareSymbols,
}: {
  compareRows: DiscoverySymbol[];
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
        {presets.map((preset) => (
          <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${TONE_CLASS[preset.tone].border} ${TONE_CLASS[preset.tone].bg} ${TONE_CLASS[preset.tone].text}`} key={preset.key} onClick={() => setCompareSymbols(preset.symbols.slice(0, 4))} type="button">
            {preset.label}
          </button>
        ))}
      </div>
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
            <MiniStat label="Symbols" value={cluster.count.toLocaleString()} />
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

function average(values: Array<number | null | undefined>): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
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

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Latest";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
