"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  ArrowRight,
  Bell,
  Brain,
  ChevronDown,
  GitCompare,
  Globe2,
  LayoutGrid,
  ListFilter,
  Radar,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
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
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type { DiscoverySavedScan, DiscoverySavedScanPayload } from "@/lib/discovery-saved-scans";
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
import { loadDiscoveryWorkflowState, saveDiscoveryWorkflowState, type DiscoveryResultDensity, type DiscoveryScannerColumnKey } from "./discovery-workflow-storage";

type DiscoveryMode = "overlay" | "page";
type ResultDensity = DiscoveryResultDensity;
type ScannerMessage = {
  text: string;
  tone: "amber" | "cyan" | "emerald" | "rose";
};

type BrowserWorkflowMetric = {
  id: string;
  latencyMs: number;
  recordedAt: string;
};

declare global {
  interface Window {
    __tradevetoBrowserWorkflowMetrics?: BrowserWorkflowMetric[];
  }
}

type SavedScanMutationResponse = {
  message?: string;
  ok?: boolean;
  scan?: DiscoverySavedScan;
};

type AlertMutationResponse = {
  message?: string;
  ok?: boolean;
};

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
const DEFAULT_SCANNER_COLUMNS: DiscoveryScannerColumnKey[] = ["performance", "confidence", "risk", "macro", "replay", "freshness"];
const SCANNER_COLUMN_LABELS: Record<DiscoveryScannerColumnKey, string> = {
  confidence: "Conf",
  freshness: "Fresh",
  macro: "Macro",
  performance: "Move",
  replay: "Replay",
  risk: "Risk",
};
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
const SCANNER_VIRTUALIZATION_THRESHOLD = 180;
const SCANNER_VIRTUAL_OVERSCAN_ROWS = 24;

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
  const rangeAnchorRef = useRef(0);
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
  const [scannerFullscreen, setScannerFullscreen] = useState(false);
  const [scannerColumnKeys, setScannerColumnKeys] = useState<DiscoveryScannerColumnKey[]>(DEFAULT_SCANNER_COLUMNS);
  const [selectedSymbol, setSelectedSymbol] = useState<DiscoverySymbol | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<DiscoveryCluster | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>(system.comparePresets[0]?.symbols.slice(0, 3) ?? []);
  const [pinnedCompareSymbols, setPinnedCompareSymbols] = useState<string[]>([]);
  const [shortlistSymbols, setShortlistSymbols] = useState<string[]>([]);
  const [rangeSelectedSymbols, setRangeSelectedSymbols] = useState<string[]>([]);
  const [expandedSymbols, setExpandedSymbols] = useState<string[]>([]);
  const [scannerPresets, setScannerPresets] = useState<DiscoveryScannerPreset[]>(system.scannerPresets);
  const [activeIndex, setActiveIndex] = useState(0);
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [savedScanName, setSavedScanName] = useState("");
  const [savingScan, setSavingScan] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<ScannerMessage | null>(null);
  const [alertingSymbol, setAlertingSymbol] = useState<string | null>(null);
  const { toggle: toggleWatchlist, watchlist } = useLocalWatchlist();

  const state: DiscoveryFilterState = { assetType, evidence, filter, marketCap, query: deferredQuery, riskBand, sector, sort, timeframe, watchlistOnly };
  const filtered = useMemo(() => filterDiscoverySymbols(system.symbols, state), [assetType, deferredQuery, evidence, filter, marketCap, riskBand, sector, sort, system.symbols, timeframe, watchlistOnly]);
  const visibleLimit = useMemo(() => {
    if (density === "ultra") return mode === "overlay" ? 260 : 520;
    if (density === "dense") return mode === "overlay" ? 140 : 240;
    if (density === "speed") return mode === "overlay" ? 72 : 144;
    return mode === "overlay" ? 36 : 84;
  }, [density, mode]);
  const visibleSymbols = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const sectors = useMemo(() => ["ALL", ...Array.from(new Set(system.symbols.map((symbol) => symbol.sector).filter((value): value is string => Boolean(value)))).sort()], [system.symbols]);
  const assetTypes = useMemo(() => ["ALL", ...Array.from(new Set(system.symbols.map((symbol) => symbol.assetType).filter((value): value is string => Boolean(value)))).sort()], [system.symbols]);
  const compareRows = useMemo(() => uniqueSymbols([...pinnedCompareSymbols, ...compareSymbols]).map((symbol) => system.symbols.find((candidate) => candidate.symbol === symbol)).filter((value): value is DiscoverySymbol => Boolean(value)), [compareSymbols, pinnedCompareSymbols, system.symbols]);
  const shortlistRows = useMemo(() => shortlistSymbols.map((symbol) => system.symbols.find((candidate) => candidate.symbol === symbol)).filter((value): value is DiscoverySymbol => Boolean(value)), [shortlistSymbols, system.symbols]);
  const watchedSymbols = useMemo(() => new Set([...system.symbols.filter((symbol) => symbol.watchlisted).map((symbol) => symbol.symbol), ...watchlist]), [system.symbols, watchlist]);
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

  function recordScannerWorkflow(id: string, startedAt: number): void {
    recordBrowserWorkflowMetric(`scanner:${id}`, startedAt);
  }

  function runTimedScannerWorkflow(id: string, operation: () => void): void {
    const startedAt = browserWorkflowNow();
    operation();
    recordScannerWorkflow(id, startedAt);
  }

  function updateQueryWithTiming(value: string): void {
    const startedAt = browserWorkflowNow();
    setQuery(value);
    recordScannerWorkflow("filter", startedAt);
  }

  useEffect(() => {
    setScannerPresets(system.scannerPresets);
  }, [system.scannerPresets]);

  useEffect(() => {
    trackAnalyticsEvent("scanner_usage", { action: "open_discovery_workspace", universeCount: system.universeCount }, { source: "discovery_workspace" });
  }, [system.universeCount]);

  useEffect(() => {
    const saved = loadDiscoveryWorkflowState(typeof window === "undefined" ? null : window.localStorage, system.symbols);
    setAssetType(saved.assetType);
    setDensity(saved.density);
    setEvidence(saved.evidence);
    setFilter(saved.filter);
    setMarketCap(saved.marketCap);
    setPinnedCompareSymbols(saved.pinnedCompareSymbols);
    setQuery(saved.query);
    setRiskBand(saved.riskBand);
    setScannerColumnKeys(saved.scannerColumnKeys);
    setSector(saved.sector);
    setSort(saved.sort);
    setTimeframe(saved.timeframe);
    setWatchlistOnly(saved.watchlistOnly);
    if (saved.compareSymbols.length) setCompareSymbols(saved.compareSymbols);
    setShortlistSymbols(saved.shortlistSymbols);
    if (saved.activeSymbol) {
      const index = system.symbols.findIndex((symbol) => symbol.symbol === saved.activeSymbol);
      if (index >= 0) {
        setActiveIndex(index);
        rangeAnchorRef.current = index;
      }
    }
    setWorkflowLoaded(true);
  }, [system.symbols]);

  useEffect(() => {
    if (!workflowLoaded) return;
    saveDiscoveryWorkflowState(typeof window === "undefined" ? null : window.localStorage, {
      activeSymbol: activeSymbol?.symbol ?? null,
      assetType,
      compareSymbols,
      density,
      evidence,
      filter,
      marketCap,
      pinnedCompareSymbols,
      query,
      riskBand,
      scannerColumnKeys,
      sector,
      shortlistSymbols,
      sort,
      timeframe,
      updatedAt: null,
      watchlistOnly,
    });
  }, [activeSymbol?.symbol, assetType, compareSymbols, density, evidence, filter, marketCap, pinnedCompareSymbols, query, riskBand, scannerColumnKeys, sector, shortlistSymbols, sort, timeframe, watchlistOnly, workflowLoaded]);

  useEffect(() => {
    setActiveIndex((current) => {
      const next = Math.min(current, Math.max(visibleSymbols.length - 1, 0));
      rangeAnchorRef.current = Math.min(rangeAnchorRef.current, Math.max(visibleSymbols.length - 1, 0));
      return next;
    });
    setRangeSelectedSymbols((current) => current.filter((symbol) => visibleSymbols.some((candidate) => candidate.symbol === symbol)));
  }, [visibleSymbols.length]);

  function toggleCompare(symbol: string): void {
    setCompareSymbols((current) => {
      if (current.includes(symbol)) return current.filter((item) => item !== symbol);
      trackAnalyticsEvent("scanner_usage", { action: "compare_add", symbol }, { source: "discovery_compare", symbol });
      trackFirstUsefulAction("scanner_compare", { symbol }, { source: "discovery_compare", symbol });
      return [symbol, ...current].slice(0, 8);
    });
  }

  function toggleComparePin(symbol: string): void {
    setPinnedCompareSymbols((current) => {
      if (current.includes(symbol)) return current.filter((item) => item !== symbol);
      trackAnalyticsEvent("scanner_usage", { action: "compare_pin", symbol }, { source: "discovery_compare", symbol });
      return [symbol, ...current].slice(0, 8);
    });
  }

  function toggleExpandedSymbol(symbol: string): void {
    setExpandedSymbols((current) => {
      if (current.includes(symbol)) return current.filter((item) => item !== symbol);
      return [symbol, ...current].slice(0, 20);
    });
  }

  function toggleActiveWatchlist(): void {
    if (!activeSymbol) return;
    toggleWatchlist(activeSymbol.symbol);
    setScannerMessage({ text: `${activeSymbol.symbol} watchlist state updated.`, tone: "amber" });
    trackAnalyticsEvent("scanner_usage", { action: "watchlist_toggle_shortcut", symbol: activeSymbol.symbol }, { source: "discovery_keyboard", symbol: activeSymbol.symbol });
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
    const symbols = visibleSymbols.slice(0, 8).map((symbol) => symbol.symbol);
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
    const symbols = shortlistRows.slice(0, 8).map((symbol) => symbol.symbol);
    if (!symbols.length) return;
    setCompareSymbols(symbols);
    trackAnalyticsEvent("scanner_usage", { action: "compare_shortlist", count: symbols.length }, { source: "discovery_compare" });
  }

  function compareSelectedRange(): void {
    const symbols = rangeSelectedSymbols.length ? rangeSelectedSymbols : activeSymbol ? [activeSymbol.symbol] : [];
    if (!symbols.length) return;
    setCompareSymbols((current) => uniqueSymbols([...symbols, ...current]).slice(0, 8));
    trackAnalyticsEvent("scanner_usage", { action: "compare_selected_range", count: symbols.length }, { source: "discovery_keyboard" });
  }

  function shortlistSelectedRange(): void {
    const symbols = rangeSelectedSymbols.length ? rangeSelectedSymbols : activeSymbol ? [activeSymbol.symbol] : [];
    if (!symbols.length) return;
    setShortlistSymbols((current) => uniqueSymbols([...symbols, ...current]).slice(0, 20));
    trackAnalyticsEvent("scanner_usage", { action: "shortlist_selected_range", count: symbols.length }, { source: "discovery_keyboard" });
    trackFirstUsefulAction("scanner_shortlist_range", { count: symbols.length }, { source: "discovery_keyboard" });
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
    setQuery(preset.query ?? "");
    setSector(preset.sector ?? "ALL");
    setAssetType(preset.assetType ?? "ALL");
    setMarketCap(preset.marketCap ?? "ALL");
    setRiskBand(preset.riskBand ?? "ALL");
    setEvidence(preset.evidence ?? "ALL");
    setWatchlistOnly(preset.watchlistOnly ?? false);
    if (preset.density) setDensity(preset.density);
    if (preset.userSaved && preset.id) {
      void csrfFetch(`/api/user/saved-scans/${encodeURIComponent(preset.id)}`, {
        body: JSON.stringify({ touch: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }).catch(() => undefined);
    }
    trackAnalyticsEvent("scanner_usage", { action: "preset", preset: preset.key, resultCount: preset.count, sort: preset.sort, timeframe: preset.timeframe }, { source: "discovery_preset" });
    trackFirstUsefulAction("scanner_preset", { preset: preset.key }, { source: "discovery_preset" });
  }

  async function saveCurrentScan(): Promise<void> {
    if (savingScan) return;
    setSavingScan(true);
    setScannerMessage(null);
    const payload: DiscoverySavedScanPayload = {
      assetType,
      density,
      evidence,
      filter,
      marketCap,
      query,
      riskBand,
      sector,
      sort,
      timeframe,
      watchlistOnly,
    };
    const name = savedScanName.trim() || defaultSavedScanName(filter, sort, timeframe, visibleSymbols.length);
    try {
      const response = await csrfFetch("/api/user/saved-scans", {
        body: JSON.stringify({ name, payload }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as SavedScanMutationResponse | null;
      if (!response.ok || !result?.scan) {
        throw new Error(result?.message ?? "Saved scan unavailable.");
      }
      const preset = savedScanToPreset(result.scan, system.symbols);
      setScannerPresets((current) => [preset, ...current.filter((item) => item.id !== preset.id && item.key !== preset.key)]);
      setSavedScanName("");
      setScannerMessage({ text: `${preset.label} saved for quick reload.`, tone: "emerald" });
      trackAnalyticsEvent("scanner_usage", { action: "saved_scan_create", filter, resultCount: filtered.length, scanId: preset.id }, { source: "discovery_saved_scan" });
      trackFirstUsefulAction("scanner_saved_scan", { filter, scanId: preset.id }, { source: "discovery_saved_scan" });
    } catch (error) {
      setScannerMessage({ text: error instanceof Error ? error.message : "Saved scan failed.", tone: "rose" });
    } finally {
      setSavingScan(false);
    }
  }

  async function createScannerAlert(symbol: DiscoverySymbol): Promise<void> {
    if (alertingSymbol) return;
    setAlertingSymbol(symbol.symbol);
    setScannerMessage(null);
    const threshold = Math.max(60, Math.round(symbol.confidence ?? symbol.conviction ?? 70));
    try {
      const response = await csrfFetch("/api/alerts/rules", {
        body: JSON.stringify({
          channels: ["email"],
          cooldown_minutes: 720,
          enabled: true,
          entry_filter: "good_or_wait",
          id: `scanner_${symbol.symbol.toLowerCase()}_score_above`,
          min_score: Math.max(55, threshold - 5),
          risk_reason: `Risk ${scoreLabel(symbol.risk)}; macro ${scoreLabel(symbol.macro)}; replay ${scoreLabel(symbol.replay)}; freshness ${scoreLabel(symbol.freshness)}.`,
          scope: "symbol",
          source: "user",
          source_reason: `Created from scanner row: ${humanizeInsightText(symbol.reason)}`,
          symbol: symbol.symbol,
          threshold,
          type: "score_above",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as AlertMutationResponse | null;
      if (!response.ok) throw new Error(result?.message ?? "Alert creation failed.");
      setScannerMessage({ text: `${symbol.symbol} scanner alert is active.`, tone: "emerald" });
      trackAnalyticsEvent("scanner_usage", { action: "alert_create", symbol: symbol.symbol, threshold }, { source: "discovery_scanner_alert", symbol: symbol.symbol });
      trackFirstUsefulAction("scanner_alert_create", { symbol: symbol.symbol, threshold }, { source: "discovery_scanner_alert", symbol: symbol.symbol });
    } catch (error) {
      setScannerMessage({ text: error instanceof Error ? error.message : "Alert creation failed.", tone: "rose" });
    } finally {
      setAlertingSymbol(null);
    }
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
    setDensity((current) => current === "ultra" ? "dense" : current === "dense" ? "speed" : current === "speed" ? "cards" : "ultra");
  }

  function toggleScannerColumn(column: DiscoveryScannerColumnKey): void {
    setScannerColumnKeys((current) => {
      if (current.includes(column)) {
        const next = current.filter((item) => item !== column);
        return next.length ? next : current;
      }
      return [...current, column];
    });
  }

  function moveActive(delta: number, extendRange: boolean): void {
    setActiveIndex((current) => {
      const next = Math.max(0, Math.min(current + delta, Math.max(visibleSymbols.length - 1, 0)));
      if (extendRange) {
        const anchor = rangeAnchorRef.current;
        const start = Math.min(anchor, next);
        const end = Math.max(anchor, next);
        setRangeSelectedSymbols(visibleSymbols.slice(start, end + 1).map((symbol) => symbol.symbol));
      } else {
        rangeAnchorRef.current = next;
        setRangeSelectedSymbols([]);
      }
      return next;
    });
  }

  function exportCompareMatrix(): void {
    if (!compareRows.length) return;
    const header = ["symbol", "company", "sector", "confidence", "risk", "macro", "replay", "freshness", "1D", "1M", "reason"];
    const rows = compareRows.map((symbol) => [
      symbol.symbol,
      symbol.companyName ?? "",
      symbol.sector ?? "",
      scoreLabel(symbol.confidence ?? symbol.conviction),
      scoreLabel(symbol.risk),
      scoreLabel(symbol.macro),
      scoreLabel(symbol.replay),
      scoreLabel(symbol.freshness),
      formatSigned(symbol.performance["1D"]),
      formatSigned(symbol.performance["1M"]),
      humanizeInsightText(symbol.reason),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tradeveto-compare-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    trackAnalyticsEvent("scanner_usage", { action: "compare_export", count: compareRows.length }, { source: "discovery_compare" });
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

      if (scannerFullscreen && key === "escape") {
        event.preventDefault();
        setScannerFullscreen(false);
        return;
      }

      if (selectedSymbol || selectedCluster) return;

      if (event.key === "/") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        const preset = scannerPresets.find((item) => item.shortcut === event.key);
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
        compareSelectedRange();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        setScannerFullscreen((current) => !current);
        return;
      }

      if (key === "g") {
        event.preventDefault();
        document.querySelector("[data-discovery-scanner-table='true']")?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      if (event.shiftKey && key === "s") {
        event.preventDefault();
        void saveCurrentScan();
        return;
      }

      if (key === "s" && activeSymbol) {
        event.preventDefault();
        shortlistSelectedRange();
        return;
      }

      if (key === "x" && activeSymbol) {
        event.preventDefault();
        toggleCompare(activeSymbol.symbol);
        return;
      }

      if (key === "a" && activeSymbol) {
        event.preventDefault();
        void createScannerAlert(activeSymbol);
        return;
      }

      if (key === "w") {
        event.preventDefault();
        toggleActiveWatchlist();
        return;
      }

      if (key === "p" && activeSymbol) {
        event.preventDefault();
        toggleComparePin(activeSymbol.symbol);
        return;
      }

      if (key === "o" && activeSymbol) {
        event.preventDefault();
        setSelectedSymbol(activeSymbol);
        return;
      }

      if (event.key === "ArrowDown" || key === "j") {
        event.preventDefault();
        moveActive(1, event.shiftKey);
        return;
      }

      if (event.key === "ArrowUp" || key === "k") {
        event.preventDefault();
        moveActive(-1, event.shiftKey);
        return;
      }

      if (event.key === "Enter" && activeSymbol) {
        event.preventDefault();
        if (event.shiftKey) setSelectedSymbol(activeSymbol);
        else toggleExpandedSymbol(activeSymbol.symbol);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSymbol, focusSearch, rangeSelectedSymbols, scannerFullscreen, scannerPresets, selectedCluster, selectedSymbol, visibleSymbols]);

  return (
    <section className={`tv-discovery-system ${mode === "overlay" ? "space-y-4" : "space-y-6"}`} data-discovery-workspace="true">
      <DiscoveryHero
        inputRef={searchInputRef}
        mode={mode}
        query={query}
        selectedFilter={selectedFilter}
                setQuery={updateQueryWithTiming}
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
            isFullscreen={scannerFullscreen}
            onCompareVisible={() => runTimedScannerWorkflow("compare-open", compareVisible)}
            onCycleDensity={() => runTimedScannerWorkflow("density-cycle", cycleDensity)}
            onFocusSearch={focusSearch}
            onSaveCurrent={() => {
              void saveCurrentScan();
            }}
            onShortlistVisible={shortlistVisible}
            onToggleFullscreen={() => runTimedScannerWorkflow("fullscreen-toggle", () => setScannerFullscreen((current) => !current))}
            presets={scannerPresets}
            rangeCount={rangeSelectedSymbols.length}
            shortlistCount={shortlistRows.length}
            visibleCount={visibleSymbols.length}
            watchedCount={watchedSymbols.size}
          />
          {scannerMessage ? <ScannerStatusMessage message={scannerMessage} /> : null}

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
                    aria-label="Search discovery scanner by symbol, company, sector, setup, or risk context"
                    autoComplete="off"
                    className="h-12 w-full rounded-2xl border border-cyan-300/20 bg-slate-950/70 pl-10 pr-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/15"
                    data-discovery-secondary-search="true"
                    enterKeyHint="search"
                    inputMode="search"
                    onChange={(event) => updateQueryWithTiming(event.currentTarget.value)}
                    placeholder="Search symbol, company, sector, setup, risk context..."
                    type="search"
                    value={query}
                  />
                </label>
                <DiscoverySelect label="Sector" onChange={setSector} value={sector} values={sectors.map((value) => ({ key: value, label: value === "ALL" ? "All sectors" : value }))} />
                <DiscoverySelect label="Sort" onChange={(value) => setSort(value as DiscoverySortKey)} value={sort} values={SORTS.map((item) => ({ key: item.key, label: item.label }))} />
                <DiscoverySelect label="Timeframe" onChange={(value) => setTimeframe(value as DiscoveryTimeframe)} value={timeframe} values={TIMEFRAMES.map((value) => ({ key: value, label: value }))} />
              </div>

              <div id="filters">
                <ScannerPresetRail
                  isSaving={savingScan}
                  onNameChange={setSavedScanName}
                  onSaveCurrent={() => {
                    void saveCurrentScan();
                  }}
                  onSelect={applyScannerPreset}
                  presets={scannerPresets}
                  saveName={savedScanName}
                />
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
              expandedSymbols={expandedSymbols}
              fullscreen={scannerFullscreen}
              alertingSymbol={alertingSymbol}
              onDensityChange={(nextDensity) => runTimedScannerWorkflow(nextDensity === "ultra" ? "ultra-dense" : "density-change", () => setDensity(nextDensity))}
              onCreateAlert={(symbol) => {
                void createScannerAlert(symbol);
              }}
              onOpen={setSelectedSymbol}
              onSortChange={(nextSort) => runTimedScannerWorkflow("sort", () => setSort(nextSort))}
              onToggleColumn={toggleScannerColumn}
              onToggleExpanded={(symbol) => runTimedScannerWorkflow("row-expansion", () => toggleExpandedSymbol(symbol))}
              onToggleFullscreen={() => runTimedScannerWorkflow("fullscreen-toggle", () => setScannerFullscreen((current) => !current))}
              onToggleShortlist={toggleShortlist}
              onToggleCompare={toggleCompare}
              resultCount={filtered.length}
              rangeSelectedSymbols={rangeSelectedSymbols}
              scannerColumnKeys={scannerColumnKeys}
              shortlistedSymbols={shortlistSymbols}
              sort={sort}
              symbols={visibleSymbols}
              timeframe={timeframe}
              watchedSymbols={watchedSymbols}
            />
            <div className="space-y-4">
              <ShortlistDock compareShortlist={compareShortlist} onClear={() => setShortlistSymbols([])} onOpen={setSelectedSymbol} onToggleShortlist={toggleShortlist} symbols={shortlistRows} />
              <CompareModePanel compareRows={compareRows} onClearCompare={() => setCompareSymbols([])} onCompareShortlist={compareShortlist} onCompareVisible={compareVisible} onExportCompare={exportCompareMatrix} onTogglePin={toggleComparePin} pinnedCompareSymbols={pinnedCompareSymbols} presets={system.comparePresets} setCompareSymbols={setCompareSymbols} />
            </div>
          </div>
        </>
      )}

      <SymbolDetailOverlay
        alertingSymbol={alertingSymbol}
        onClose={() => setSelectedSymbol(null)}
        onCreateAlert={(symbol) => {
          void createScannerAlert(symbol);
        }}
        symbol={selectedSymbol}
        timeframe={timeframe}
        watched={selectedSymbol ? watchedSymbols.has(selectedSymbol.symbol) : false}
      />
      <ClusterDetailOverlay cluster={selectedCluster} onClose={() => setSelectedCluster(null)} />
    </section>
  );
}

function DiscoveryHero({
  inputRef,
  mode,
  query,
  selectedFilter,
  setQuery,
  system,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
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
                aria-label="Search discovery scanner by symbol, company, sector, setup, or risk context"
                autoComplete="off"
                className="h-14 w-full rounded-2xl border border-cyan-300/25 bg-slate-950/72 pl-12 pr-4 text-base font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/15"
                data-discovery-search-input="true"
                enterKeyHint="search"
                inputMode="search"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search AMD, semis, macro-supported pullbacks, risk escalation..."
                ref={inputRef}
                type="search"
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
  isFullscreen,
  onCompareVisible,
  onCycleDensity,
  onFocusSearch,
  onSaveCurrent,
  onShortlistVisible,
  onToggleFullscreen,
  presets,
  rangeCount,
  shortlistCount,
  visibleCount,
  watchedCount,
}: {
  activeSymbol: DiscoverySymbol | null;
  compareCount: number;
  density: ResultDensity;
  filteredCount: number;
  isFullscreen: boolean;
  onCompareVisible: () => void;
  onCycleDensity: () => void;
  onFocusSearch: () => void;
  onSaveCurrent: () => void;
  onShortlistVisible: () => void;
  onToggleFullscreen: () => void;
  presets: DiscoveryScannerPreset[];
  rangeCount: number;
  shortlistCount: number;
  visibleCount: number;
  watchedCount: number;
}) {
  return (
    <section className="poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/55 p-3 shadow-2xl shadow-cyan-950/10">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Scanner command layer</span>
          <CommandChip label="Mode" value={density === "ultra" ? "Ultra dense" : density === "dense" ? "Dense table" : density === "speed" ? "Speed table" : "Visual cards"} />
          <CommandChip label="Visible" value={`${formatHydrationSafeInteger(visibleCount)} / ${formatHydrationSafeInteger(filteredCount)}`} />
          <CommandChip label="Active" value={activeSymbol?.symbol ?? "Top row"} />
          <CommandChip label="Range" value={formatHydrationSafeInteger(rangeCount)} />
          <CommandChip label="Compare" value={formatHydrationSafeInteger(compareCount)} />
          <CommandChip label="Shortlist" value={formatHydrationSafeInteger(shortlistCount)} />
          <CommandChip label="Watch" value={formatHydrationSafeInteger(watchedCount)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100" onClick={onFocusSearch} type="button">⌘K Search</button>
          <button className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100" onClick={onCycleDensity} type="button">D Density</button>
          <button className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100" onClick={onToggleFullscreen} type="button">{isFullscreen ? "F Exit" : "F Fullscreen"}</button>
          <button className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-200/60" onClick={onCompareVisible} type="button">C Compare top</button>
          <button className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 hover:border-amber-200/60" onClick={onShortlistVisible} type="button">Shortlist top</button>
          <button className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 hover:border-emerald-200/60" onClick={onSaveCurrent} type="button">⇧S Save</button>
        </div>
      </div>
      <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-mobile-gesture-ignore="true">
        {presets.slice(0, 10).map((preset) => (
          <span className={`shrink-0 snap-start rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${TONE_CLASS[preset.tone].border} ${TONE_CLASS[preset.tone].bg} ${TONE_CLASS[preset.tone].text}`} key={preset.key}>
            {preset.shortcut}: {preset.label}
          </span>
        ))}
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">↑↓ select</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">J/K rows</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Shift range</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Enter expand</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">O detail</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">A alert</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">W watch</span>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">P pin</span>
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

function ScannerStatusMessage({ message }: { message: ScannerMessage }) {
  const tone = TONE_CLASS[message.tone];
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${tone.border} ${tone.bg} ${tone.text}`}>
      {message.text}
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

function ScannerPresetRail({
  isSaving,
  onNameChange,
  onSaveCurrent,
  onSelect,
  presets,
  saveName,
}: {
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onSaveCurrent: () => void;
  onSelect: (preset: DiscoveryScannerPreset) => void;
  presets: DiscoveryScannerPreset[];
  saveName: string;
}) {
  if (!presets.length) return null;
  return (
    <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-3">
      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)] lg:items-end">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Saved scans and scan packs</div>
          <div className="mt-1 text-xs text-slate-500">Server-backed scanner presets, user scans, and instant reload workflows.</div>
        </div>
        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveCurrent();
          }}
        >
          <label className="block">
            <span className="sr-only">Saved scan name</span>
            <input
              className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-xs font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-200/55 focus:ring-2 focus:ring-cyan-300/15"
              maxLength={48}
              onChange={(event) => onNameChange(event.currentTarget.value)}
              placeholder="Name this scan"
              value={saveName}
            />
          </label>
          <button
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving" : "Save"}
          </button>
        </form>
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
                <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10px] font-black text-slate-200">{preset.userSaved ? "User" : preset.shortcut}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{preset.summary}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {preset.count} matches · {preset.timeframe}{preset.userSaved ? ` · used ${formatHydrationSafeInteger(preset.useCount ?? 0)}x` : ""}
              </div>
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
  alertingSymbol,
  compareSymbols,
  density,
  expandedSymbols,
  fullscreen,
  onCreateAlert,
  onOpen,
  onDensityChange,
  onSortChange,
  onToggleColumn,
  onToggleExpanded,
  onToggleFullscreen,
  onToggleCompare,
  onToggleShortlist,
  rangeSelectedSymbols,
  resultCount,
  scannerColumnKeys,
  shortlistedSymbols,
  sort,
  symbols,
  timeframe,
  watchedSymbols,
}: {
  activeSymbol: string | null;
  alertingSymbol: string | null;
  compareSymbols: string[];
  density: ResultDensity;
  expandedSymbols: string[];
  fullscreen: boolean;
  onCreateAlert: (symbol: DiscoverySymbol) => void;
  onOpen: (symbol: DiscoverySymbol) => void;
  onDensityChange: (density: ResultDensity) => void;
  onSortChange: (sort: DiscoverySortKey) => void;
  onToggleColumn: (column: DiscoveryScannerColumnKey) => void;
  onToggleExpanded: (symbol: string) => void;
  onToggleFullscreen: () => void;
  onToggleCompare: (symbol: string) => void;
  onToggleShortlist: (symbol: string) => void;
  rangeSelectedSymbols: string[];
  resultCount: number;
  scannerColumnKeys: DiscoveryScannerColumnKey[];
  shortlistedSymbols: string[];
  sort: DiscoverySortKey;
  symbols: DiscoverySymbol[];
  timeframe: DiscoveryTimeframe;
  watchedSymbols: Set<string>;
}) {
  const shellClass = fullscreen
    ? "fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] top-[calc(env(safe-area-inset-top)+0.5rem)] z-[80] overflow-auto rounded-3xl border border-cyan-300/25 bg-slate-950/96 p-4 shadow-2xl shadow-cyan-950/40 md:inset-x-6"
    : "poster-panel rounded-3xl border border-cyan-300/16 bg-slate-950/48 p-4";

  return (
    <section className={shellClass} data-discovery-dense-mode={density} data-scanner-fullscreen={fullscreen ? "true" : "false"}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Full-universe results</div>
          <h3 className="mt-1 text-xl font-black text-white">Searchable scanner command grid</h3>
          <div className="mt-1 text-xs text-slate-500">{formatHydrationSafeInteger(resultCount)} matching rows. Showing {formatHydrationSafeInteger(symbols.length)} for bounded rendering. {rangeSelectedSymbols.length ? `${formatHydrationSafeInteger(rangeSelectedSymbols.length)} selected.` : ""}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`grid h-10 w-10 place-items-center rounded-2xl border transition ${density === "ultra" ? "border-cyan-300/35 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-cyan-100"}`}
            onClick={() => onDensityChange("ultra")}
            title="Ultra dense scanner"
            type="button"
          >
            <span className="font-mono text-[10px] font-black">48</span>
          </button>
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
          <button
            className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition ${fullscreen ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-cyan-100"}`}
            onClick={onToggleFullscreen}
            type="button"
          >
            {fullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </div>
      <ColumnToggleRail onToggleColumn={onToggleColumn} visibleColumns={scannerColumnKeys} />
      {symbols.length ? (
        density === "speed" || density === "dense" || density === "ultra" ? (
          <RapidScannerTable activeSymbol={activeSymbol} alertingSymbol={alertingSymbol} compact={density === "dense" || density === "ultra"} expandedSymbols={expandedSymbols} rangeSelectedSymbols={rangeSelectedSymbols} compareSymbols={compareSymbols} onCreateAlert={onCreateAlert} onOpen={onOpen} onSortChange={onSortChange} onToggleCompare={onToggleCompare} onToggleExpanded={onToggleExpanded} onToggleShortlist={onToggleShortlist} shortlistedSymbols={shortlistedSymbols} sort={sort} symbols={symbols} timeframe={timeframe} ultra={density === "ultra"} visibleColumns={scannerColumnKeys} watchedSymbols={watchedSymbols} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {symbols.map((symbol) => (
              <DiscoverySymbolCard alerting={alertingSymbol === symbol.symbol} compareSelected={compareSymbols.includes(symbol.symbol)} key={symbol.symbol} onCreateAlert={onCreateAlert} onOpen={onOpen} onToggleCompare={onToggleCompare} onToggleShortlist={onToggleShortlist} shortlisted={shortlistedSymbols.includes(symbol.symbol)} symbol={symbol} timeframe={timeframe} watched={watchedSymbols.has(symbol.symbol)} />
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

function ColumnToggleRail({ onToggleColumn, visibleColumns }: { onToggleColumn: (column: DiscoveryScannerColumnKey) => void; visibleColumns: DiscoveryScannerColumnKey[] }) {
  return (
    <div className="mb-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-mobile-gesture-ignore="true">
      {DEFAULT_SCANNER_COLUMNS.map((column) => {
        const active = visibleColumns.includes(column);
        return (
          <button
            aria-pressed={active}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${active ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-cyan-100"}`}
            key={column}
            onClick={() => onToggleColumn(column)}
            type="button"
          >
            {SCANNER_COLUMN_LABELS[column]}
          </button>
        );
      })}
    </div>
  );
}

function RapidScannerTable({
  activeSymbol,
  alertingSymbol,
  compact,
  compareSymbols,
  expandedSymbols,
  rangeSelectedSymbols,
  onCreateAlert,
  onOpen,
  onSortChange,
  onToggleCompare,
  onToggleExpanded,
  onToggleShortlist,
  shortlistedSymbols,
  sort,
  symbols,
  timeframe,
  ultra,
  visibleColumns,
  watchedSymbols,
}: {
  activeSymbol: string | null;
  alertingSymbol: string | null;
  compact: boolean;
  compareSymbols: string[];
  expandedSymbols: string[];
  rangeSelectedSymbols: string[];
  onCreateAlert: (symbol: DiscoverySymbol) => void;
  onOpen: (symbol: DiscoverySymbol) => void;
  onSortChange: (sort: DiscoverySortKey) => void;
  onToggleCompare: (symbol: string) => void;
  onToggleExpanded: (symbol: string) => void;
  onToggleShortlist: (symbol: string) => void;
  shortlistedSymbols: string[];
  sort: DiscoverySortKey;
  symbols: DiscoverySymbol[];
  timeframe: DiscoveryTimeframe;
  ultra: boolean;
  visibleColumns: DiscoveryScannerColumnKey[];
  watchedSymbols: Set<string>;
}) {
  const activeMetricColumns = DEFAULT_SCANNER_COLUMNS.filter((column) => visibleColumns.includes(column));
  const tableTemplate = scannerTableTemplate(activeMetricColumns, compact);
  const tableStyle = { "--scanner-grid-template": tableTemplate } as CSSProperties;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const estimatedRowHeight = ultra ? 46 : compact ? 56 : 86;
  const viewportHeight = ultra ? 1152 : compact ? 896 : 704;
  const virtualizationActive = symbols.length > SCANNER_VIRTUALIZATION_THRESHOLD;
  const virtualWindow = useMemo(() => {
    if (!virtualizationActive) {
      return {
        bottomPaddingPx: 0,
        endIndex: symbols.length,
        rows: symbols.map((symbol, index) => ({ index, symbol })),
        topPaddingPx: 0,
      };
    }
    const startIndex = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - SCANNER_VIRTUAL_OVERSCAN_ROWS);
    const visibleCount = Math.ceil(viewportHeight / estimatedRowHeight) + SCANNER_VIRTUAL_OVERSCAN_ROWS * 2;
    const endIndex = Math.min(symbols.length, startIndex + visibleCount);
    return {
      bottomPaddingPx: Math.max(0, (symbols.length - endIndex) * estimatedRowHeight),
      endIndex,
      rows: symbols.slice(startIndex, endIndex).map((symbol, offset) => ({ index: startIndex + offset, symbol })),
      topPaddingPx: Math.max(0, startIndex * estimatedRowHeight),
    };
  }, [estimatedRowHeight, scrollTop, symbols, viewportHeight, virtualizationActive]);

  useEffect(() => {
    setScrollTop(0);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [symbols]);

  return (
    <div
      className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/48"
      data-discovery-scanner-table="true"
      data-scanner-rendered-rows={virtualWindow.rows.length}
      data-scanner-sort={sort}
      data-scanner-total-rows={symbols.length}
      data-scanner-virtualized={virtualizationActive ? "true" : "false"}
      style={tableStyle}
    >
      <div className="sticky top-0 z-20 grid gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 max-xl:hidden xl:[grid-template-columns:var(--scanner-grid-template)]">
        <span>Rank</span>
        <SortHeader active={sort === "symbol"} className="sticky left-0 z-20 bg-slate-950/95" label="Symbol" onClick={() => onSortChange("symbol")} sortKey="symbol" />
        <span>Context</span>
        {activeMetricColumns.map((column) => (
          <SortHeader active={sortActiveForColumn(column, sort)} key={column} label={column === "performance" ? timeframe : SCANNER_COLUMN_LABELS[column]} onClick={() => onSortChange(nextSortForColumn(column, sort))} sortKey={column} />
        ))}
        <span>Action</span>
      </div>
      <div
        className={`${ultra ? "max-h-[72rem]" : compact ? "max-h-[56rem]" : "max-h-[44rem]"} overflow-y-auto [scrollbar-width:thin]`}
        onScroll={(event) => {
          if (virtualizationActive) setScrollTop(event.currentTarget.scrollTop);
        }}
        ref={scrollerRef}
      >
        {virtualizationActive ? <div aria-hidden="true" style={{ height: virtualWindow.topPaddingPx }} /> : null}
        {virtualWindow.rows.map(({ index, symbol }) => {
          const riskTone: DiscoveryTone = (symbol.risk ?? 0) >= 70 ? "rose" : (symbol.risk ?? 0) >= 55 ? "amber" : "cyan";
          const selected = compareSymbols.includes(symbol.symbol);
          const shortlisted = shortlistedSymbols.includes(symbol.symbol);
          const active = activeSymbol === symbol.symbol;
          const rangeSelected = rangeSelectedSymbols.includes(symbol.symbol);
          const expanded = expandedSymbols.includes(symbol.symbol);
          const watched = watchedSymbols.has(symbol.symbol);
          return (
            <div className="relative" key={symbol.symbol}>
              <div
                className={`group grid gap-2 border-b border-white/[0.06] px-3 transition hover:bg-cyan-300/[0.045] xl:items-center xl:[grid-template-columns:var(--scanner-grid-template)] ${ultra ? "py-1" : compact ? "py-1.5" : "py-3"} ${active ? "bg-cyan-300/[0.07] ring-1 ring-inset ring-cyan-300/25" : ""} ${rangeSelected ? "bg-amber-300/[0.055]" : ""}`}
              >
                <div className="hidden font-mono text-xs font-black text-slate-500 xl:block">{index + 1}</div>
                <button className="sticky left-0 z-10 flex min-w-0 items-center gap-2 bg-slate-950/94 text-left xl:block" data-stable-overlay-trigger="true" onClick={() => onOpen(symbol)} type="button">
                  <span className="font-mono text-lg font-black text-white">{symbol.symbol}</span>
                  {watched ? <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300 xl:hidden" /> : null}
                  <span className="ml-auto font-mono text-xs text-slate-500 xl:hidden">#{index + 1}</span>
                </button>
                <div className="min-w-0">
                  <button className="w-full min-w-0 text-left" data-stable-overlay-trigger="true" onClick={() => onToggleExpanded(symbol.symbol)} type="button">
                    <div className="truncate text-sm font-semibold text-slate-200">{symbol.companyName ?? symbol.sector ?? symbol.setupType}</div>
                    <div className="truncate text-[11px] text-slate-500">{humanizeInsightText(symbol.reason)}</div>
                  </button>
                  <ScannerDrilldownRail compact symbol={symbol} />
                </div>
                {activeMetricColumns.map((column) => <ScannerMetricCell column={column} key={column} riskTone={riskTone} symbol={symbol} timeframe={timeframe} />)}
                <div className="flex gap-2">
                  <button className={`h-9 rounded-xl border px-2 text-[10px] font-black uppercase tracking-[0.1em] ${shortlisted ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-amber-100"}`} onClick={() => onToggleShortlist(symbol.symbol)} type="button">
                    ★
                  </button>
                  <button
                    className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:border-emerald-200/60 disabled:cursor-wait disabled:opacity-60"
                    disabled={alertingSymbol === symbol.symbol}
                    onClick={() => onCreateAlert(symbol)}
                    title={`Create scanner alert for ${symbol.symbol}`}
                    type="button"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </button>
                  <button className={`h-9 flex-1 rounded-xl border px-2 text-[10px] font-black uppercase tracking-[0.1em] ${selected ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-cyan-100"}`} onClick={() => onToggleCompare(symbol.symbol)} type="button">
                    {selected ? "On" : "Cmp"}
                  </button>
                  <Link className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-slate-400 hover:border-cyan-300/30 hover:text-cyan-100" href={symbol.href}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="pointer-events-none absolute left-24 top-2 z-30 hidden max-w-xs rounded-2xl border border-cyan-300/20 bg-slate-950/98 p-3 text-xs leading-5 text-slate-300 opacity-0 shadow-2xl shadow-cyan-950/30 transition group-hover:opacity-100 xl:block">
                  <span className="font-mono font-black text-cyan-100">{symbol.symbol}</span> {humanizeInsightText(symbol.reason)}
                </div>
              </div>
              {expanded ? <ExpandedScannerRow symbol={symbol} timeframe={timeframe} /> : null}
            </div>
          );
        })}
        {virtualizationActive ? <div aria-hidden="true" style={{ height: virtualWindow.bottomPaddingPx }} /> : null}
      </div>
    </div>
  );
}

function SortHeader({ active, className = "", label, onClick, sortKey }: { active: boolean; className?: string; label: string; onClick: () => void; sortKey: string }) {
  return (
    <button
      aria-pressed={active}
      className={`min-w-0 truncate text-left transition ${active ? "text-cyan-100" : "text-slate-500 hover:text-cyan-100"} ${className}`}
      data-scanner-sort-column={sortKey}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ScannerCell({ tone, value }: { tone: DiscoveryTone; value: string }) {
  return <div className={`rounded-xl border border-white/10 bg-white/[0.025] px-2 py-1.5 font-mono text-xs font-black ${TONE_CLASS[tone].text}`}>{value}</div>;
}

function ScannerMetricCell({
  column,
  riskTone,
  symbol,
  timeframe,
}: {
  column: DiscoveryScannerColumnKey;
  riskTone: DiscoveryTone;
  symbol: DiscoverySymbol;
  timeframe: DiscoveryTimeframe;
}) {
  if (column === "performance") return <ScannerCell tone={perfTone(symbol.performance[timeframe])} value={formatSigned(symbol.performance[timeframe])} />;
  if (column === "confidence") return <ScannerCell tone="emerald" value={scoreLabel(symbol.confidence ?? symbol.conviction)} />;
  if (column === "risk") return <ScannerCell tone={riskTone} value={scoreLabel(symbol.risk)} />;
  if (column === "macro") return <ScannerCell tone="cyan" value={scoreLabel(symbol.macro)} />;
  if (column === "replay") return <ScannerCell tone="violet" value={scoreLabel(symbol.replay)} />;
  return <ScannerCell tone="amber" value={scoreLabel(symbol.freshness)} />;
}

function ExpandedScannerRow({ symbol, timeframe }: { symbol: DiscoverySymbol; timeframe: DiscoveryTimeframe }) {
  return (
    <div className="border-b border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-3" data-scanner-expanded-row="true" data-scanner-expanded-symbol={symbol.symbol}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Expanded intelligence row</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{humanizeInsightText(symbol.reason)}</p>
          <ScannerDrilldownRail symbol={symbol} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MicroMetric label={timeframe} tone={perfTone(symbol.performance[timeframe])} value={formatSigned(symbol.performance[timeframe])} />
          <MicroMetric label="Confidence" tone="emerald" value={scoreLabel(symbol.confidence ?? symbol.conviction)} />
          <MicroMetric label="Risk" tone={(symbol.risk ?? 0) >= 70 ? "rose" : "amber"} value={scoreLabel(symbol.risk)} />
          <MicroMetric label="Freshness" tone="cyan" value={symbol.freshnessLabel} />
        </div>
      </div>
    </div>
  );
}

function DiscoverySymbolCard({
  alerting,
  compareSelected,
  onCreateAlert,
  onOpen,
  onToggleCompare,
  onToggleShortlist,
  shortlisted,
  symbol,
  timeframe,
  watched,
}: {
  alerting: boolean;
  compareSelected: boolean;
  onCreateAlert: (symbol: DiscoverySymbol) => void;
  onOpen: (symbol: DiscoverySymbol) => void;
  onToggleCompare: (symbol: string) => void;
  onToggleShortlist: (symbol: string) => void;
  shortlisted: boolean;
  symbol: DiscoverySymbol;
  timeframe: DiscoveryTimeframe;
  watched: boolean;
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
              {watched ? <Star className="h-4 w-4 fill-amber-300 text-amber-300" /> : null}
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
      <ScannerDrilldownRail symbol={symbol} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${shortlisted ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-amber-100"}`} onClick={() => onToggleShortlist(symbol.symbol)} type="button">
          {shortlisted ? "Shortlisted" : "Shortlist"}
        </button>
        <button
          className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 hover:border-emerald-200/60 disabled:cursor-wait disabled:opacity-60"
          disabled={alerting}
          onClick={() => onCreateAlert(symbol)}
          type="button"
        >
          <Bell className="h-3 w-3" />
          Alert
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

function ScannerDrilldownRail({ compact = false, symbol }: { compact?: boolean; symbol: DiscoverySymbol }) {
  const encoded = encodeURIComponent(symbol.symbol);
  const links = [
    { href: `/symbol/${encoded}`, label: "Chart" },
    { href: `/history?symbol=${encoded}`, label: "Replay" },
    { href: `/market-memory?symbol=${encoded}`, label: "Memory" },
    { href: `/strategy-labs?symbol=${encoded}`, label: "Strategy" },
    { href: `/alerts?symbol=${encoded}&source=scanner`, label: "Alerts" },
  ];
  return (
    <div className={`${compact ? "mt-1 hidden xl:flex" : "mt-3 flex"} flex-wrap gap-1.5`}>
      {links.map((link) => (
        <Link
          className={`${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"} rounded-full border border-white/10 bg-white/[0.035] font-black uppercase tracking-[0.1em] text-slate-500 hover:border-cyan-300/30 hover:text-cyan-100`}
          href={link.href}
          key={link.href}
          onClick={() => trackAnalyticsEvent("scanner_usage", { action: "drilldown", destination: link.label.toLowerCase(), symbol: symbol.symbol }, { source: "discovery_drilldown", symbol: symbol.symbol })}
        >
          {link.label}
        </Link>
      ))}
    </div>
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
  onClearCompare,
  onCompareShortlist,
  onCompareVisible,
  onExportCompare,
  onTogglePin,
  pinnedCompareSymbols,
  presets,
  setCompareSymbols,
}: {
  compareRows: DiscoverySymbol[];
  onClearCompare: () => void;
  onCompareShortlist: () => void;
  onCompareVisible: () => void;
  onExportCompare: () => void;
  onTogglePin: (symbol: string) => void;
  pinnedCompareSymbols: string[];
  presets: IntelligenceDiscoverySystem["comparePresets"];
  setCompareSymbols: (symbols: string[]) => void;
}) {
  return (
    <section className="poster-panel sticky top-24 rounded-3xl border border-violet-300/16 bg-slate-950/50 p-4" data-discovery-compare-panel="true" data-compare-count={compareRows.length} id="compare">
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
        <button className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 disabled:opacity-50" disabled={!compareRows.length} onClick={onExportCompare} type="button">
          Export CSV
        </button>
        <button className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 hover:text-slate-100" onClick={onClearCompare} type="button">
          Clear
        </button>
        {presets.map((preset) => (
          <button className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${TONE_CLASS[preset.tone].border} ${TONE_CLASS[preset.tone].bg} ${TONE_CLASS[preset.tone].text}`} key={preset.key} onClick={() => setCompareSymbols(preset.symbols.slice(0, 8))} type="button">
            {preset.label}
          </button>
        ))}
      </div>
      {compareRows.length >= 2 ? <CompareMatrix rows={compareRows} /> : null}
      {compareRows.length ? <CompareStory rows={compareRows} /> : null}
      <div className="mt-4 grid gap-3">
        {compareRows.length ? compareRows.map((symbol) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={symbol.symbol}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-lg font-black text-white">{symbol.symbol}</div>
                  {pinnedCompareSymbols.includes(symbol.symbol) ? <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">Pinned</span> : null}
                </div>
                <div className="text-xs text-slate-500">{symbol.sector ?? "Sector limited"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className={`rounded-xl border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${pinnedCompareSymbols.includes(symbol.symbol) ? "border-amber-300/35 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-amber-100"}`} onClick={() => onTogglePin(symbol.symbol)} type="button">
                  Pin
                </button>
                <div className="font-mono text-lg font-black text-cyan-100">{scoreLabel(symbol.confidence ?? symbol.conviction)}</div>
              </div>
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

function CompareStory({ rows }: { rows: DiscoverySymbol[] }) {
  const strongest = [...rows].sort((a, b) => (b.confidence ?? b.conviction ?? 0) - (a.confidence ?? a.conviction ?? 0))[0] ?? null;
  const riskiest = [...rows].sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0))[0] ?? null;
  const macroLeader = [...rows].sort((a, b) => (b.macro ?? 0) - (a.macro ?? 0))[0] ?? null;

  return (
    <div className="mt-4 rounded-2xl border border-violet-300/16 bg-violet-300/[0.06] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Compare storytelling</div>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        {strongest ? `${strongest.symbol} currently leads confidence. ` : ""}
        {macroLeader ? `${macroLeader.symbol} has the strongest macro alignment. ` : ""}
        {riskiest ? `${riskiest.symbol} carries the highest visible risk score. ` : ""}
        Matrix values are scanner context only, not trading instructions.
      </p>
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

function SymbolDetailOverlay({
  alertingSymbol,
  onClose,
  onCreateAlert,
  symbol,
  timeframe,
  watched,
}: {
  alertingSymbol: string | null;
  onClose: () => void;
  onCreateAlert: (symbol: DiscoverySymbol) => void;
  symbol: DiscoverySymbol | null;
  timeframe: DiscoveryTimeframe;
  watched: boolean;
}) {
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-4xl font-black text-white">{symbol.symbol}</div>
                  <div className="mt-1 text-sm text-slate-400">{symbol.companyName ?? symbol.sector ?? "Validated scanner row"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100 disabled:cursor-wait disabled:opacity-60"
                    disabled={alertingSymbol === symbol.symbol}
                    onClick={() => onCreateAlert(symbol)}
                    type="button"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Alert
                  </button>
                  <Link className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-100" href={symbol.href}>Open full detail</Link>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{humanizeInsightText(symbol.reason)}</p>
              <ScannerDrilldownRail symbol={symbol} />
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
                <div>Watchlist: {watched ? "Saved" : "Not saved"}</div>
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

function savedScanToPreset(scan: DiscoverySavedScan, symbols: DiscoverySymbol[]): DiscoveryScannerPreset {
  const matches = filterDiscoverySymbols(symbols, scan.payload);
  return {
    assetType: scan.payload.assetType,
    count: matches.length,
    density: scan.payload.density,
    evidence: scan.payload.evidence,
    filter: scan.payload.filter,
    id: scan.id,
    key: `saved-${scan.id}`,
    label: scan.name,
    lastUsedAt: scan.lastUsedAt,
    marketCap: scan.payload.marketCap,
    query: scan.payload.query,
    riskBand: scan.payload.riskBand,
    sector: scan.payload.sector,
    serverSaved: true,
    shortcut: "Saved",
    sort: scan.payload.sort,
    source: "user",
    summary: savedScanSummary(scan.payload),
    timeframe: scan.payload.timeframe,
    tone: savedScanTone(scan.payload),
    useCount: scan.useCount,
    userSaved: true,
    watchlistOnly: scan.payload.watchlistOnly,
  };
}

function savedScanSummary(payload: DiscoverySavedScanPayload): string {
  const filters = [
    payload.query ? `query "${payload.query}"` : null,
    payload.watchlistOnly ? "watchlist" : null,
    payload.sector !== "ALL" ? payload.sector : null,
    payload.assetType !== "ALL" ? payload.assetType : null,
    payload.marketCap !== "ALL" ? `${payload.marketCap.toLowerCase()} cap` : null,
    payload.riskBand !== "ALL" ? `${payload.riskBand.toLowerCase()} risk` : null,
    payload.evidence !== "ALL" ? `${payload.evidence.toLowerCase()} evidence` : null,
  ].filter((value): value is string => Boolean(value));
  return `${filters.length ? filters.join(", ") : "full universe"}; ${payload.sort.replace(/_/g, " ")} over ${payload.timeframe}.`;
}

function savedScanTone(payload: DiscoverySavedScanPayload): DiscoveryTone {
  if (payload.watchlistOnly) return "amber";
  if (payload.filter === "crash_risk" || payload.sort === "risk" || payload.sort === "crash" || payload.sort === "weakness") return "rose";
  if (payload.sort === "macro" || payload.filter === "macro_supported") return "cyan";
  if (payload.sort === "replay" || payload.filter === "replay_supported" || payload.filter === "breakout_candidates") return "violet";
  return "emerald";
}

function defaultSavedScanName(filter: DiscoveryQuickFilterKey, sort: DiscoverySortKey, timeframe: DiscoveryTimeframe, count: number): string {
  const filterLabel = filter.replace(/_/g, " ");
  return `${filterLabel} ${sort.replace(/_/g, " ")} ${timeframe} (${formatHydrationSafeInteger(count)})`;
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

function browserWorkflowNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function recordBrowserWorkflowMetric(id: string, startedAt: number): void {
  if (typeof window === "undefined") return;
  const finish = () => {
    const latencyMs = Math.max(0, browserWorkflowNow() - startedAt);
    const nextMetric: BrowserWorkflowMetric = {
      id,
      latencyMs: Math.round(latencyMs * 1000) / 1000,
      recordedAt: new Date().toISOString(),
    };
    window.__tradevetoBrowserWorkflowMetrics = [...(window.__tradevetoBrowserWorkflowMetrics ?? []), nextMetric].slice(-120);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
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

function scannerTableTemplate(columns: DiscoveryScannerColumnKey[], compact: boolean): string {
  const metricWidth = compact ? "4.4rem" : "5rem";
  const metrics = columns.map(() => metricWidth).join(" ");
  return `2.75rem 5.5rem minmax(12rem,1fr) ${metrics} ${compact ? "10rem" : "11rem"}`;
}

function sortActiveForColumn(column: DiscoveryScannerColumnKey, sort: DiscoverySortKey): boolean {
  if (column === "performance") return sort === "performance" || sort === "weakness";
  if (column === "risk") return sort === "risk" || sort === "crash";
  return sort === column;
}

function nextSortForColumn(column: DiscoveryScannerColumnKey, sort: DiscoverySortKey): DiscoverySortKey {
  if (column === "performance") return sort === "weakness" ? "performance" : "weakness";
  if (column === "risk") return sort === "crash" ? "risk" : "crash";
  return column;
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

function csvCell(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}
