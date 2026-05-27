"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Copy, Expand, Eye, EyeOff, Keyboard, Lock, Magnet, Palette, PanelTopClose, PanelTopOpen, RotateCcw, Save, Search, Trash2, Unlock, X } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import {
  addResearchContextLines,
  addTradeLevelLines,
  buildResearchContextLevels,
  normalizeCandles,
  normalizeSignals,
  normalizeTradeLevels,
  toChartData,
  toSeriesMarkers,
} from "./symbol-chart-utils";
import {
  CHART_INDICATORS,
  CHART_OVERLAY_FAMILIES,
  DEFAULT_CHART_INDICATORS,
  DEFAULT_CHART_OVERLAY_FAMILIES,
  buildChartIndicatorSeries,
  buildChartCompareRows,
  buildChartIntelligenceZones,
  buildChartStoryPoints,
  buildChartWorkflowSummary,
  familyLabel,
  indicatorDefinition,
  overlayFamilyForMarker,
  toneForFamily,
  type ChartCompareRow,
  type ChartIndicatorId,
  type ChartIndicatorSeries,
  type ChartIntelligenceTone,
  type ChartIntelligenceZone,
  type ChartOverlayFamily,
  type ChartStoryPoint,
  type ChartWorkflowSummary,
} from "./chart-intelligence-overlays";
import {
  DEFAULT_CHART_INDICATOR_TEMPLATES,
  defaultChartWorkflowWorkspace,
  readChartWorkflowWorkspace,
  replaceChartWorkflowWorkspace,
  writeChartWorkflowWorkspace,
  type ChartIndicatorTemplate,
  type ChartWorkspaceTab,
  type ChartWorkflowWorkspace,
  type ChartDetailMode,
  type ChartLayoutMode,
  type StoredChartAlertHistoryEntry,
  type StoredChartDrawingColor,
  type StoredChartDrawing,
  type StoredChartDrawingStyle,
  type StoredChartDrawingWidth,
  type StoredChartDrawingPoint,
  type StoredChartDrawingTool,
} from "./chart-workflow-storage";
import {
  fetchAccountChartWorkflowWorkspace,
  mergeLocalAndAccountChartWorkspace,
  saveAccountChartWorkflowWorkspace,
} from "./chart-workflow-account-sync";
import { buildChartAlertRulePayload, type ChartAlertRequest, type ChartAlertRuleType } from "./chart-workflow-alerts";
import { EmptyState } from "./ui/EmptyState";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { INTERACTIVE_CHART_PERIODS, type InteractiveChartPeriod } from "@/lib/interactive-chart-data";

export type ChartCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSignalMarkerType =
  | "ALERT"
  | "BREAKOUT"
  | "CONFIDENCE"
  | "CONTRADICTION"
  | "ENTER"
  | "EVENT"
  | "EXIT"
  | "FAILURE"
  | "FRESHNESS"
  | "MACRO"
  | "MEMORY"
  | "REPLAY"
  | "RISK"
  | "SHOCK"
  | "STALE"
  | "STOP"
  | "TARGET"
  | "VOLATILITY"
  | "WAIT";

export type ChartSignalMarker = {
  time: string;
  type: ChartSignalMarkerType;
  text?: string;
  source?: string;
  uncertainty?: string;
};

export type ChartTradeLevels = {
  entry?: number | null;
  entryLow?: number | null;
  entryHigh?: number | null;
  stop?: number | null;
  target?: number | null;
};

export type SymbolChartProps = {
  symbol: string;
  candles?: ChartCandle[];
  signals?: ChartSignalMarker[];
  showHistoricalSignals?: boolean;
  showHeaderBadge?: boolean;
  showResearchLevelsToggle?: boolean;
  tradeLevels?: ChartTradeLevels;
  height?: number;
  dataSource?: string;
  defaultPeriod?: InteractiveChartPeriod;
  controlledPeriod?: InteractiveChartPeriod;
  onPeriodChange?: (period: InteractiveChartPeriod) => void;
  enableTimeframeSwitching?: boolean;
  expandable?: boolean;
  interpretation?: string;
  lastUpdated?: string | null;
  defaultIndicators?: ChartIndicatorId[];
  controlledIndicators?: ChartIndicatorId[];
  crosshairSyncGroup?: string;
  enableAccountSync?: boolean;
  onIndicatorsChange?: (indicators: ChartIndicatorId[]) => void;
  defaultOverlayFamilies?: ChartOverlayFamily[];
  controlledOverlayFamilies?: ChartOverlayFamily[];
  onOverlayFamiliesChange?: (families: ChartOverlayFamily[]) => void;
  restoreFullscreenState?: boolean;
  scannerScore?: number | null;
  showDrawingTools?: boolean;
  symbolSequence?: string[];
};

type ChartDrawingTool = StoredChartDrawingTool;
type ChartDrawingPoint = StoredChartDrawingPoint;
type ChartDrawing = StoredChartDrawing;

const CHART_DRAWING_TOOLS: ChartDrawingTool[] = [
  "inspect",
  "edit",
  "horizontal",
  "trendline",
  "supportZone",
  "resistanceZone",
  "entryZone",
  "stopZone",
  "targetZone",
  "riskBox",
  "annotation",
  "ruler",
];

const CHART_CROSSHAIR_SYNC_EVENT = "tradeveto-chart-crosshair-sync";

type ChartCrosshairSyncPayload = {
  clear?: boolean;
  group: string;
  price: number | null;
  sourceId: string;
  symbol: string;
  time: Time | null;
};

type BrowserWorkflowMetric = {
  id: string;
  latencyMs: number;
  recordedAt: string;
};

export function SymbolChart({
  symbol,
  candles,
  signals,
  showHistoricalSignals = false,
  showHeaderBadge = true,
  showResearchLevelsToggle = false,
  tradeLevels,
  height = 360,
  dataSource = "validated price history",
  defaultPeriod = "6mo",
  controlledPeriod,
  onPeriodChange,
  enableTimeframeSwitching = true,
  expandable = true,
  interpretation,
  lastUpdated,
  defaultIndicators = DEFAULT_CHART_INDICATORS,
  controlledIndicators,
  crosshairSyncGroup,
  enableAccountSync = true,
  onIndicatorsChange,
  defaultOverlayFamilies = DEFAULT_CHART_OVERLAY_FAMILIES,
  controlledOverlayFamilies,
  onOverlayFamiliesChange,
  restoreFullscreenState = true,
  scannerScore = null,
  showDrawingTools = true,
  symbolSequence = [],
}: SymbolChartProps) {
  const chartInstanceId = useId();
  const { authenticated, loading: accountLoading, user } = useCurrentUser();
  const chartRootRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const entryBandRef = useRef<HTMLDivElement | null>(null);
  const applyingRemoteCrosshairRef = useRef(false);
  const skipNextWorkspacePersistRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [uncontrolledPeriod, setUncontrolledPeriod] = useState<InteractiveChartPeriod>(defaultPeriod);
  const [resetToken, setResetToken] = useState(0);
  const [showResearchLevels, setShowResearchLevels] = useState(true);
  const [uncontrolledOverlayFamilies, setUncontrolledOverlayFamilies] = useState<ChartOverlayFamily[]>(defaultOverlayFamilies);
  const [uncontrolledIndicators, setUncontrolledIndicators] = useState<ChartIndicatorId[]>(defaultIndicators);
  const [drawingTool, setDrawingTool] = useState<ChartDrawingTool>("inspect");
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null);
  const [alertHistory, setAlertHistory] = useState<StoredChartAlertHistoryEntry[]>([]);
  const [chartTabs, setChartTabs] = useState<ChartWorkspaceTab[]>([]);
  const [compactMode, setCompactMode] = useState(false);
  const [magnetMode, setMagnetMode] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hotkeysActive, setHotkeysActive] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [accountWorkspaceLoaded, setAccountWorkspaceLoaded] = useState(false);
  const [workspaceUpdatedAt, setWorkspaceUpdatedAt] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [indicatorTemplates, setIndicatorTemplates] = useState<ChartIndicatorTemplate[]>(DEFAULT_CHART_INDICATOR_TEMPLATES);
  const [activeIndicatorTemplateId, setActiveIndicatorTemplateId] = useState<string | null>("default-trend-risk");
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [chartAlertMessage, setChartAlertMessage] = useState<string | null>(null);
  const [chartAlertSaving, setChartAlertSaving] = useState(false);
  const period = controlledPeriod ?? uncontrolledPeriod;
  const enabledOverlayFamilies = controlledOverlayFamilies ?? uncontrolledOverlayFamilies;
  const enabledIndicators = controlledIndicators ?? uncontrolledIndicators;
  const normalizedCandles = useMemo(() => normalizeCandles(candles), [candles]);
  const chartCandles = useMemo(() => filterCandlesByPeriod(normalizedCandles, period), [normalizedCandles, period]);
  const chartSignals = useMemo(() => (
    showHistoricalSignals && signals?.length ? filterSignalsByCandles(normalizeSignals(signals), chartCandles) : []
  ), [chartCandles, showHistoricalSignals, signals]);
  const chartLevels = useMemo(() => normalizeTradeLevels(tradeLevels), [tradeLevels]);
  const researchLevels = useMemo(() => buildResearchContextLevels(chartCandles, chartLevels), [chartCandles, chartLevels]);
  const hasTradeLevels = chartLevels.entry !== null || chartLevels.entryLow !== null || chartLevels.entryHigh !== null || chartLevels.stop !== null || chartLevels.target !== null;
  const visibleChartSignals = useMemo(() => {
    const enabled = new Set(enabledOverlayFamilies);
    return chartSignals.filter((signal) => enabled.has(overlayFamilyForMarker(signal.type)));
  }, [chartSignals, enabledOverlayFamilies]);
  const levelsVisible = enabledOverlayFamilies.includes("levels") && showResearchLevels;
  const overlayGroups = useMemo(() => markerGroupSummary(visibleChartSignals), [visibleChartSignals]);
  const intelligenceZones = useMemo(() => buildChartIntelligenceZones({
    candles: chartCandles,
    enabledFamilies: enabledOverlayFamilies,
    levels: chartLevels,
    signals: visibleChartSignals,
  }), [chartCandles, chartLevels, enabledOverlayFamilies, visibleChartSignals]);
  const indicatorSeries = useMemo(() => buildChartIndicatorSeries(chartCandles, enabledIndicators), [chartCandles, enabledIndicators]);
  const storyPoints = useMemo(() => buildChartStoryPoints(chartCandles, visibleChartSignals, chartLevels), [chartCandles, chartLevels, visibleChartSignals]);
  const workflowSummary = useMemo(() => buildChartWorkflowSummary({
    candleCount: chartCandles.length,
    drawingCount: drawings.length,
    enabledFamilies: enabledOverlayFamilies,
    enabledIndicators,
    markerCount: visibleChartSignals.length,
  }), [chartCandles.length, drawings.length, enabledIndicators, enabledOverlayFamilies, visibleChartSignals.length]);
  const move = useMemo(() => summarizeCandles(chartCandles), [chartCandles]);
  const latestClose = chartCandles[chartCandles.length - 1]?.close ?? null;
  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null;
  const selectedDrawingPrice = useMemo(() => selectedDrawing ? priceFromDrawingY(chartCandles, drawingReferenceY(selectedDrawing)) : null, [chartCandles, selectedDrawing]);
  const navigationSymbols = useMemo(() => normalizeSymbolSequence(symbolSequence, symbol), [symbol, symbolSequence]);
  const canRenderChart = chartCandles.length >= 2;
  const accountSyncEnabled = enableAccountSync && !controlledPeriod && !controlledOverlayFamilies && !controlledIndicators;
  const crosshairSourceId = chartInstanceId.replace(/:/g, "");

  function runTimedChartWorkflow(id: string, operation: () => void): void {
    const startedAt = browserWorkflowNow();
    operation();
    recordBrowserWorkflowMetric(`chart:${id}`, startedAt);
  }

  function expandChart(): void {
    const startedAt = browserWorkflowNow();
    trackAnalyticsEvent("chart_expand", {
      candleCount: chartCandles.length,
      markerCount: visibleChartSignals.length,
      period,
      surface: "symbol_chart",
    }, { source: "chart", symbol });
    writeChartWorkflowWorkspace(symbol, { fullscreenOpen: true });
    setExpanded(true);
    recordBrowserWorkflowMetric("chart:fullscreen-open", startedAt);
  }

  function closeExpandedChart(): void {
    writeChartWorkflowWorkspace(symbol, { fullscreenOpen: false });
    setExpanded(false);
  }

  function changePeriod(range: InteractiveChartPeriod): void {
    if (onPeriodChange) onPeriodChange(range);
    else setUncontrolledPeriod(range);
    trackAnalyticsEvent("timeframe_change", {
      from: period,
      surface: "symbol_chart",
      timeframe: range,
    }, { source: "chart", symbol });
  }

  function updateOverlayFamilies(nextFamilies: ChartOverlayFamily[]): void {
    if (onOverlayFamiliesChange) onOverlayFamiliesChange(nextFamilies);
    else setUncontrolledOverlayFamilies(nextFamilies);
  }

  function toggleOverlayFamily(family: ChartOverlayFamily): void {
    updateOverlayFamilies(
      enabledOverlayFamilies.includes(family)
        ? enabledOverlayFamilies.filter((item) => item !== family)
        : [...enabledOverlayFamilies, family],
    );
    setActiveIndicatorTemplateId(null);
  }

  function updateIndicators(nextIndicators: ChartIndicatorId[]): void {
    if (onIndicatorsChange) onIndicatorsChange(nextIndicators);
    else setUncontrolledIndicators(nextIndicators);
  }

  function toggleIndicator(indicator: ChartIndicatorId): void {
    updateIndicators(
      enabledIndicators.includes(indicator)
        ? enabledIndicators.filter((item) => item !== indicator)
        : [...enabledIndicators, indicator],
    );
    setActiveIndicatorTemplateId(null);
  }

  function applyIndicatorTemplate(templateId: string): void {
    const template = indicatorTemplates.find((item) => item.id === templateId);
    if (!template) return;
    updateIndicators(template.indicators);
    updateOverlayFamilies(template.overlayFamilies);
    setActiveIndicatorTemplateId(template.id);
    trackAnalyticsEvent("chart_indicator_template_apply", {
      indicatorCount: template.indicators.length,
      overlayCount: template.overlayFamilies.length,
      templateId: template.id,
    }, { source: "chart", symbol });
  }

  function saveIndicatorTemplate(name: string): void {
    const trimmedName = name.replace(/\s+/g, " ").trim().slice(0, 36);
    if (!trimmedName) return;
    const now = new Date().toISOString();
    const id = `user-${slugifyChartId(trimmedName)}-${Date.now().toString(36)}`;
    const template: ChartIndicatorTemplate = {
      createdAt: now,
      id,
      indicators: [...enabledIndicators],
      name: trimmedName,
      overlayFamilies: [...enabledOverlayFamilies],
      source: "user",
      updatedAt: now,
    };
    setIndicatorTemplates((current) => [...current.filter((item) => item.id !== id), template].slice(-12));
    setActiveIndicatorTemplateId(id);
    trackAnalyticsEvent("chart_indicator_template_save", {
      indicatorCount: template.indicators.length,
      overlayCount: template.overlayFamilies.length,
    }, { source: "chart", symbol });
  }

  function deleteIndicatorTemplate(templateId: string): void {
    setIndicatorTemplates((current) => current.filter((template) => template.source === "default" || template.id !== templateId));
    if (activeIndicatorTemplateId === templateId) setActiveIndicatorTemplateId(null);
  }

  function saveWorkspaceNow(): void {
    const saved = writeChartWorkflowWorkspace(symbol, currentWorkspacePatch(expanded));
    if (saved) {
      setWorkspaceUpdatedAt(saved.updatedAt);
      setWorkspaceMessage("Chart workspace saved");
      if (!accountLoading && authenticated && user && accountSyncEnabled) {
        void saveAccountChartWorkflowWorkspace(symbol, saved).catch(() => undefined);
      }
    }
  }

  function resetWorkspaceState(): void {
    const nextWorkspace = {
      ...defaultChartWorkflowWorkspace(),
      updatedAt: new Date().toISOString(),
    };
    skipNextWorkspacePersistRef.current = true;
    applyWorkspaceState(nextWorkspace, false);
    replaceChartWorkflowWorkspace(symbol, nextWorkspace);
    setResetToken((value) => value + 1);
    setWorkspaceMessage("Chart workspace reset");
    if (!accountLoading && authenticated && user && accountSyncEnabled) {
      void saveAccountChartWorkflowWorkspace(symbol, nextWorkspace).catch(() => undefined);
    }
  }

  function currentWorkspacePatch(fullscreenOpen: boolean): Partial<ChartWorkflowWorkspace> {
    return {
      activeIndicatorTemplateId,
      alertHistory,
      chartTabs,
      compactMode,
      drawingTool,
      drawings,
      fullscreenOpen,
      indicators: enabledIndicators,
      indicatorTemplates,
      magnetMode,
      overlayFamilies: enabledOverlayFamilies,
      period,
      toolbarCollapsed,
    };
  }

  async function createChartAlert(request: ChartAlertRequest): Promise<void> {
    if (!authenticated || accountLoading) {
      setChartAlertMessage("Sign in with Premium to save chart alerts");
      return;
    }
    setChartAlertSaving(true);
    setChartAlertMessage("Saving chart alert...");
    try {
      const rulePayload = buildChartAlertRulePayload({ request, symbol });
      const response = await csrfFetch("/api/alerts/rules", {
        body: JSON.stringify(rulePayload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; ok?: boolean } | null;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message ?? "Chart alert save failed.");
      }
      setChartAlertMessage("Chart alert saved");
      const historyEntry: StoredChartAlertHistoryEntry = {
        cooldownMinutes: rulePayload.cooldown_minutes,
        createdAt: new Date().toISOString(),
        id: rulePayload.id,
        label: `${chartAlertTypeLabel(rulePayload.type)} ${formatChartAlertThreshold(rulePayload.threshold, rulePayload.type)}`,
        sourceReason: rulePayload.source_reason,
        threshold: rulePayload.threshold,
        type: rulePayload.type,
      };
      setAlertHistory((current) => [...current.filter((entry) => entry.id !== historyEntry.id), historyEntry].slice(-20));
      trackAnalyticsEvent("chart_alert_create", {
        threshold: request.threshold,
        type: request.type,
      }, { source: "chart", symbol });
    } catch (error) {
      setChartAlertMessage(error instanceof Error ? error.message : "Chart alert save failed");
    } finally {
      setChartAlertSaving(false);
    }
  }

  function navigateSymbol(direction: -1 | 1): void {
    if (navigationSymbols.length < 2 || typeof window === "undefined") return;
    const current = symbol.toUpperCase();
    const currentIndex = navigationSymbols.indexOf(current);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + navigationSymbols.length) % navigationSymbols.length;
    const nextSymbol = navigationSymbols[nextIndex];
    if (!nextSymbol || nextSymbol === current) return;
    trackAnalyticsEvent("chart_symbol_keyboard_navigate", {
      direction,
      nextSymbol,
    }, { source: "chart", symbol });
    window.location.assign(`/symbol/${encodeURIComponent(nextSymbol)}`);
  }

  function applyWorkspaceState(workspace: ChartWorkflowWorkspace | null, restoreFullscreen: boolean): void {
    if (workspace) {
      if (!controlledPeriod) setUncontrolledPeriod(workspace.period);
      if (!controlledOverlayFamilies) setUncontrolledOverlayFamilies(workspace.overlayFamilies);
      if (!controlledIndicators) setUncontrolledIndicators(workspace.indicators);
      setAlertHistory(workspace.alertHistory);
      setChartTabs(workspace.chartTabs);
      setCompactMode(workspace.compactMode);
      setDrawingTool(workspace.drawingTool);
      setDrawings(workspace.drawings);
      setIndicatorTemplates(workspace.indicatorTemplates);
      setActiveIndicatorTemplateId(workspace.activeIndicatorTemplateId);
      setMagnetMode(workspace.magnetMode);
      setToolbarCollapsed(workspace.toolbarCollapsed);
      setWorkspaceUpdatedAt(workspace.updatedAt);
      if (restoreFullscreen && expandable && workspace.fullscreenOpen) setExpanded(true);
    } else {
      if (!controlledPeriod) setUncontrolledPeriod(defaultPeriod);
      if (!controlledOverlayFamilies) setUncontrolledOverlayFamilies(defaultOverlayFamilies);
      if (!controlledIndicators) setUncontrolledIndicators(defaultIndicators);
      setAlertHistory([]);
      setChartTabs([]);
      setCompactMode(false);
      setDrawingTool("inspect");
      setDrawings([]);
      setIndicatorTemplates([...DEFAULT_CHART_INDICATOR_TEMPLATES]);
      setActiveIndicatorTemplateId("default-trend-risk");
      setMagnetMode(false);
      setToolbarCollapsed(false);
      setWorkspaceUpdatedAt(null);
    }
    setDraftDrawing(null);
    setSelectedDrawingId(null);
  }

  function updateDrawing(drawingId: string, updater: (drawing: ChartDrawing) => ChartDrawing): void {
    setDrawings((current) => current.map((drawing) => drawing.id === drawingId ? { ...updater(drawing), updatedAt: new Date().toISOString() } : drawing));
  }

  function clearDrawings(): void {
    setDrawings([]);
    setSelectedDrawingId(null);
  }

  function deleteSelectedDrawing(): void {
    if (!selectedDrawingId) return;
    if (selectedDrawing?.locked) return;
    setDrawings((current) => current.filter((drawing) => drawing.id !== selectedDrawingId));
    setSelectedDrawingId(null);
  }

  function duplicateSelectedDrawing(): void {
    if (!selectedDrawingId) return;
    const drawing = drawings.find((item) => item.id === selectedDrawingId);
    if (!drawing) return;
    const duplicate = nudgeDrawing({
      ...drawing,
      createdAt: new Date().toISOString(),
      id: `${drawing.tool}-${Date.now()}-copy`,
      locked: false,
      visible: true,
    }, 1.8, 1.8);
    setDrawings((current) => [...current, duplicate].slice(-24));
    setSelectedDrawingId(duplicate.id);
  }

  function nudgeSelectedDrawing(deltaX: number, deltaY: number): void {
    if (!selectedDrawingId) return;
    if (selectedDrawing?.locked) return;
    updateDrawing(selectedDrawingId, (drawing) => nudgeDrawing(drawing, deltaX, deltaY));
  }

  useEffect(() => {
    setWorkspaceLoaded(false);
    setAccountWorkspaceLoaded(false);
    const workspace = readChartWorkflowWorkspace(symbol);
    skipNextWorkspacePersistRef.current = true;
    applyWorkspaceState(workspace, restoreFullscreenState);
    setWorkspaceLoaded(true);
  // This effect intentionally keys off the symbol so persisted chart state follows the active instrument.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (!workspaceLoaded || !accountSyncEnabled || accountLoading) {
      if (!accountSyncEnabled) setAccountWorkspaceLoaded(true);
      return undefined;
    }
    if (!authenticated || !user) {
      setAccountWorkspaceLoaded(true);
      return undefined;
    }

    let cancelled = false;
    setAccountWorkspaceLoaded(false);
    void fetchAccountChartWorkflowWorkspace(symbol)
      .then((result) => {
        if (cancelled) return;
        const localWorkspace = readChartWorkflowWorkspace(symbol);
        const nextWorkspace = mergeLocalAndAccountChartWorkspace(localWorkspace, result.workspace);
        if (nextWorkspace) {
          skipNextWorkspacePersistRef.current = true;
          applyWorkspaceState(nextWorkspace, restoreFullscreenState);
          replaceChartWorkflowWorkspace(symbol, nextWorkspace);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAccountWorkspaceLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  // Account chart sync intentionally hydrates once per account + symbol. Local state changes are saved by the persistence effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountLoading, accountSyncEnabled, authenticated, symbol, user?.id, workspaceLoaded]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    if (skipNextWorkspacePersistRef.current) {
      skipNextWorkspacePersistRef.current = false;
      return;
    }
    const saved = writeChartWorkflowWorkspace(symbol, {
      activeIndicatorTemplateId,
      alertHistory,
      chartTabs,
      compactMode,
      drawingTool,
      drawings,
      fullscreenOpen: expanded,
      indicators: enabledIndicators,
      indicatorTemplates,
      magnetMode,
      overlayFamilies: enabledOverlayFamilies,
      period,
      toolbarCollapsed,
    });
    if (saved) setWorkspaceUpdatedAt(saved.updatedAt);
  }, [activeIndicatorTemplateId, alertHistory, chartTabs, compactMode, drawingTool, drawings, enabledIndicators, enabledOverlayFamilies, expanded, indicatorTemplates, magnetMode, period, symbol, toolbarCollapsed, workspaceLoaded]);

  useEffect(() => {
    if (!workspaceLoaded || !accountWorkspaceLoaded || !accountSyncEnabled || accountLoading || !authenticated || !user) return undefined;
    const workspace = readChartWorkflowWorkspace(symbol);
    if (!workspace) return undefined;
    const timeout = window.setTimeout(() => {
      void saveAccountChartWorkflowWorkspace(symbol, workspace).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    accountLoading,
    accountSyncEnabled,
    accountWorkspaceLoaded,
    authenticated,
    activeIndicatorTemplateId,
    alertHistory,
    chartTabs,
    compactMode,
    drawingTool,
    drawings,
    enabledIndicators,
    enabledOverlayFamilies,
    expanded,
    indicatorTemplates,
    magnetMode,
    period,
    symbol,
    toolbarCollapsed,
    user,
    workspaceLoaded,
  ]);

  useEffect(() => {
    if (!hotkeysActive) return undefined;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      if (key === "/" || key === "?") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (selectedDrawingId && (key === "backspace" || key === "delete")) {
        event.preventDefault();
        deleteSelectedDrawing();
        return;
      }
      if (selectedDrawingId && key.startsWith("arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 2 : 0.5;
        if (key === "arrowleft") nudgeSelectedDrawing(-step, 0);
        if (key === "arrowright") nudgeSelectedDrawing(step, 0);
        if (key === "arrowup") nudgeSelectedDrawing(0, -step);
        if (key === "arrowdown") nudgeSelectedDrawing(0, step);
        return;
      }
      const rangeIndex = Number.parseInt(key, 10) - 1;
      if (enableTimeframeSwitching && rangeIndex >= 0 && rangeIndex < INTERACTIVE_CHART_PERIODS.length) {
        event.preventDefault();
        changePeriod(INTERACTIVE_CHART_PERIODS[rangeIndex]!);
        return;
      }
      if (key === "f" && expandable) {
        event.preventDefault();
        expandChart();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        saveWorkspaceNow();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        navigateSymbol(1);
        return;
      }
      if (key === "p") {
        event.preventDefault();
        navigateSymbol(-1);
        return;
      }
      if (key === "i") {
        event.preventDefault();
        updateIndicators(enabledIndicators.length ? [] : [...DEFAULT_CHART_INDICATORS]);
        setActiveIndicatorTemplateId(null);
        return;
      }
      if (key === "m" && showDrawingTools) {
        event.preventDefault();
        setMagnetMode((value) => !value);
        return;
      }
      if (key === ",") {
        event.preventDefault();
        setCompactMode((value) => !value);
        return;
      }
      if (key === "r" && event.shiftKey) {
        event.preventDefault();
        resetWorkspaceState();
        return;
      }
      if (key === "r") {
        event.preventDefault();
        setResetToken((value) => value + 1);
        return;
      }
      if (key === "d" && showDrawingTools) {
        event.preventDefault();
        const currentIndex = CHART_DRAWING_TOOLS.indexOf(drawingTool);
        setDrawingTool(CHART_DRAWING_TOOLS[(currentIndex + 1) % CHART_DRAWING_TOOLS.length] ?? "inspect");
        return;
      }
      if (key === "e" && showDrawingTools) {
        event.preventDefault();
        setDrawingTool("edit");
        return;
      }
      if (key === "escape" && drawingTool !== "inspect") {
        event.preventDefault();
        setDraftDrawing(null);
        setSelectedDrawingId(null);
        setDrawingTool("inspect");
        return;
      }
      if (key === "escape" && commandPaletteOpen) {
        event.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (key === "escape" && selectedDrawingId) {
        event.preventDefault();
        setSelectedDrawingId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, drawingTool, enableTimeframeSwitching, enabledIndicators.length, expandable, hotkeysActive, navigationSymbols, period, selectedDrawingId, showDrawingTools]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !canRenderChart) return undefined;

    let chart: ReturnType<typeof createChart> | null = null;
    try {
      setFailed(false);
      const bounds = container.getBoundingClientRect();
      chart = createChart(container, {
        autoSize: false,
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height)),
        layout: {
          background: { color: "transparent", type: ColorType.Solid },
          textColor: "#D1D4DC",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        },
        grid: {
          vertLines: { color: "rgba(43, 43, 67, 0.45)" },
          horzLines: { color: "rgba(43, 43, 67, 0.45)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(148, 163, 184, 0.38)", labelBackgroundColor: "#0f172a" },
          horzLine: { color: "rgba(148, 163, 184, 0.38)", labelBackgroundColor: "#0f172a" },
        },
        rightPriceScale: {
          borderColor: "#1f2937",
          visible: true,
        },
        timeScale: {
          borderColor: "#1f2937",
          fixLeftEdge: true,
          fixRightEdge: true,
          timeVisible: true,
          visible: true,
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        borderDownColor: "#ef5350",
        borderUpColor: "#26a69a",
        downColor: "#ef5350",
        upColor: "#26a69a",
        wickDownColor: "#ef5350",
        wickUpColor: "#26a69a",
      });
      candleSeries.setData(toChartData(chartCandles));
      for (const indicator of indicatorSeries.filter((item) => item.renderMode === "overlay" && item.points.length >= 2)) {
        const lineSeries = chart.addSeries(LineSeries, {
          color: indicator.color,
          lastValueVisible: false,
          lineWidth: 2,
          priceLineVisible: false,
          title: indicator.label,
        });
        lineSeries.setData(indicator.points.map((point) => ({ time: point.time as Time, value: point.value })));
      }
      createSeriesMarkers(candleSeries, toSeriesMarkers(visibleChartSignals), { zOrder: "top" });
      if (showResearchLevelsToggle) {
        if (levelsVisible) addResearchContextLines(candleSeries, researchLevels);
      } else {
        addTradeLevelLines(candleSeries, chartLevels);
      }
      chart.timeScale().fitContent();

      const syncGroup = crosshairSyncGroup?.trim() || null;
      const handleCrosshairMove = (param: MouseEventParams<Time>) => {
        if (!syncGroup || applyingRemoteCrosshairRef.current) return;
        if (!param.point || !param.time) {
          dispatchChartCrosshairSync({
            clear: true,
            group: syncGroup,
            price: null,
            sourceId: crosshairSourceId,
            symbol,
            time: null,
          });
          return;
        }
        const price = Number(candleSeries.coordinateToPrice(param.point.y));
        if (!Number.isFinite(price)) return;
        dispatchChartCrosshairSync({
          group: syncGroup,
          price,
          sourceId: crosshairSourceId,
          symbol,
          time: param.time,
        });
      };
      const handleRemoteCrosshair = (event: Event) => {
        if (!syncGroup || !(event instanceof CustomEvent) || !isChartCrosshairSyncPayload(event.detail)) return;
        const payload = event.detail;
        if (payload.group !== syncGroup || payload.sourceId === crosshairSourceId) return;
        applyingRemoteCrosshairRef.current = true;
        try {
          if (payload.clear || payload.time === null || payload.price === null) {
            chart?.clearCrosshairPosition();
          } else {
            chart?.setCrosshairPosition(payload.price, payload.time, candleSeries);
          }
        } finally {
          window.setTimeout(() => {
            applyingRemoteCrosshairRef.current = false;
          }, 0);
        }
      };
      if (syncGroup) {
        chart.subscribeCrosshairMove(handleCrosshairMove);
        window.addEventListener(CHART_CROSSHAIR_SYNC_EVENT, handleRemoteCrosshair);
      }

      const updateEntryBand = () => {
        const band = entryBandRef.current;
        if (!band || chartLevels.entryLow === null || chartLevels.entryHigh === null || !levelsVisible) {
          if (band) band.style.display = "none";
          return;
        }
        const top = candleSeries.priceToCoordinate(Math.max(chartLevels.entryLow, chartLevels.entryHigh));
        const bottom = candleSeries.priceToCoordinate(Math.min(chartLevels.entryLow, chartLevels.entryHigh));
        if (top === null || bottom === null) {
          band.style.display = "none";
          return;
        }
        band.style.display = "block";
        band.style.top = `${Math.min(top, bottom)}px`;
        band.style.height = `${Math.max(3, Math.abs(bottom - top))}px`;
      };
      updateEntryBand();

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chart) return;
        chart.resize(Math.max(1, Math.floor(entry.contentRect.width)), Math.max(1, Math.floor(entry.contentRect.height)));
        updateEntryBand();
      });
      resizeObserver.observe(container);

      return () => {
        if (syncGroup) {
          chart?.unsubscribeCrosshairMove(handleCrosshairMove);
          window.removeEventListener(CHART_CROSSHAIR_SYNC_EVENT, handleRemoteCrosshair);
        }
        resizeObserver.disconnect();
        chart?.remove();
      };
    } catch {
      chart?.remove();
      setFailed(true);
      return undefined;
    }
  }, [canRenderChart, chartCandles, chartLevels, crosshairSourceId, crosshairSyncGroup, indicatorSeries, levelsVisible, researchLevels, resetToken, showResearchLevelsToggle, symbol, visibleChartSignals]);

  if (failed || (candles?.length && !normalizedCandles.length)) {
    return <EmptyState title="Price chart unavailable" message="The latest price payload could not be validated for this symbol." />;
  }

  if (!normalizedCandles.length) {
    return <EmptyState title="No validated price history" message="This chart is hidden until real OHLC history is available. Scanner insights can still appear without drawing synthetic prices." />;
  }

  return (
    <>
    <div
      className="min-w-0"
      data-chart-account-workspace-loaded={accountWorkspaceLoaded ? "true" : "false"}
      data-chart-expanded={expanded ? "true" : "false"}
      data-chart-symbol={symbol.toUpperCase()}
      data-chart-workspace-loaded={workspaceLoaded ? "true" : "false"}
      onFocusCapture={() => setHotkeysActive(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHotkeysActive(false);
      }}
      onMouseEnter={() => setHotkeysActive(true)}
      onMouseLeave={() => setHotkeysActive(false)}
      ref={chartRootRef}
    >
      {showHeaderBadge ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3">
          <div>
            <div className="font-mono text-sm font-bold text-slate-50">{symbol.toUpperCase()}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Interactive Price Action</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="text-xs text-slate-400">{chartCandles.length.toLocaleString()} candles · {move.label}</div>
            {expandable ? (
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
                data-chart-expand-trigger={symbol.toUpperCase()}
                data-stable-overlay-trigger="true"
                onClick={expandChart}
                type="button"
                aria-label={`Expand ${symbol.toUpperCase()} chart`}
              >
                <Expand className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {enableTimeframeSwitching ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {INTERACTIVE_CHART_PERIODS.map((range) => (
              <button
                className={`min-h-9 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition sm:min-h-0 sm:px-2.5 ${
                  range === period
                    ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
                }`}
                key={range}
                onClick={() => changePeriod(range)}
                type="button"
              >
                {range}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-300/45 hover:text-emerald-50 sm:min-h-0"
              onClick={saveWorkspaceNow}
              title="Save chart workspace"
              type="button"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100 sm:min-h-0"
              onClick={() => setResetToken((value) => value + 1)}
              title="Reset chart zoom and pan"
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rose-300/20 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-rose-300/45 hover:text-rose-100 sm:min-h-0"
              onClick={resetWorkspaceState}
              title="Reset chart workspace"
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Workspace
            </button>
            <div className="text-[11px] text-slate-500">{lastUpdated ? `Updated ${formatChartDate(lastUpdated)}` : dataSource}</div>
          </div>
        </div>
      ) : null}
      <ChartOverlaySummary
        dataSource={dataSource}
        hasTradeLevels={hasTradeLevels}
        markerGroups={overlayGroups}
        showHistoricalSignals={showHistoricalSignals}
      />
      <ChartOverlayControls
        enabledFamilies={enabledOverlayFamilies}
        hasTradeLevels={hasTradeLevels}
        markerCount={chartSignals.length}
        onToggle={toggleOverlayFamily}
      />
      <ChartIndicatorControls enabledIndicators={enabledIndicators} indicatorSeries={indicatorSeries} onToggle={toggleIndicator} />
      <ChartIndicatorTemplateControls
        activeTemplateId={activeIndicatorTemplateId}
        onApply={applyIndicatorTemplate}
        onDelete={deleteIndicatorTemplate}
        onSave={saveIndicatorTemplate}
        templates={indicatorTemplates}
      />
      {showDrawingTools ? (
        <ChartDrawingToolbar
          activeTool={drawingTool}
          drawings={drawings}
          drawingCount={drawings.length}
          magnetMode={magnetMode}
          onClear={() => runTimedChartWorkflow("drawing-operation", clearDrawings)}
          onDeleteSelected={() => runTimedChartWorkflow("drawing-operation", deleteSelectedDrawing)}
          onDuplicateSelected={() => runTimedChartWorkflow("drawing-operation", duplicateSelectedDrawing)}
          onNudgeSelected={(deltaX, deltaY) => runTimedChartWorkflow("drawing-operation", () => nudgeSelectedDrawing(deltaX, deltaY))}
          onReset={() => runTimedChartWorkflow("workspace-reset", resetWorkspaceState)}
          onSelect={(tool) => runTimedChartWorkflow("drawing-operation", () => setDrawingTool(tool))}
          onSelectDrawing={setSelectedDrawingId}
          onToggleMagnet={() => runTimedChartWorkflow("drawing-operation", () => setMagnetMode((value) => !value))}
          onToggleToolbar={() => runTimedChartWorkflow("toolbar-interaction", () => setToolbarCollapsed((value) => !value))}
          onUpdateSelected={(patch) => {
            if (!selectedDrawingId) return;
            runTimedChartWorkflow("drawing-operation", () => updateDrawing(selectedDrawingId, (drawing) => ({ ...drawing, ...patch })));
          }}
          selectedDrawing={selectedDrawing}
          toolbarCollapsed={toolbarCollapsed}
        />
      ) : null}
      <ChartAlertPanel
        authenticated={authenticated}
        drawingPrice={selectedDrawingPrice}
        history={alertHistory}
        latestClose={latestClose}
        message={chartAlertMessage}
        onCreate={createChartAlert}
        saving={chartAlertSaving}
        scannerScore={scannerScore}
        selectedDrawing={selectedDrawing}
        symbol={symbol}
      />
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-xl shadow-black/20" style={{ height: compactMode ? Math.max(260, height - 80) : height }}>
      {canRenderChart ? <div ref={chartContainerRef} className="absolute inset-0" /> : (
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className="max-w-md text-center">
            <div className="text-sm font-semibold text-slate-100">Limited data for {period}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">This timeframe is hidden until at least two validated candles are available. No synthetic price action is drawn.</p>
          </div>
        </div>
      )}
      <ChartIntelligenceZoneOverlay zones={intelligenceZones} />
      <ChartDrawingLayer
        drawings={drawings}
        draftDrawing={draftDrawing}
        onCommit={(drawing) => {
          const startedAt = browserWorkflowNow();
          setDrawings((current) => [...current, drawing].slice(-24));
          setSelectedDrawingId(drawing.id);
          recordBrowserWorkflowMetric("chart:drawing-operation", startedAt);
        }}
        onDraftChange={setDraftDrawing}
        onSelect={setSelectedDrawingId}
        onUpdate={updateDrawing}
        magnetMode={magnetMode}
        selectedDrawingId={selectedDrawingId}
        tool={drawingTool}
      />
      <div ref={entryBandRef} className={`pointer-events-none absolute left-0 right-0 hidden border-y border-amber-300/35 bg-amber-300/10 ${showResearchLevelsToggle && !levelsVisible ? "opacity-0" : ""}`} />
      {showResearchLevelsToggle ? (
        <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 shadow-lg backdrop-blur-xl transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={() => {
              setShowResearchLevels((value) => !value);
              if (!enabledOverlayFamilies.includes("levels")) {
                updateOverlayFamilies([...enabledOverlayFamilies, "levels"]);
              }
            }}
            title="Levels are research context only. Not financial advice."
            type="button"
          >
            {levelsVisible ? "Hide levels" : "Show levels"}
          </button>
          {levelsVisible ? <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-400">{researchLevels.length} context levels</span> : null}
        </div>
      ) : null}
      {hasTradeLevels && (!showResearchLevelsToggle || levelsVisible) ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-xs shadow-lg backdrop-blur-xl">
          <div className="font-semibold text-amber-200">Entry zone context</div>
          <div className="mt-1 font-semibold text-rose-200">Stop context</div>
          <div className="mt-1 font-semibold text-sky-200">Target context</div>
        </div>
      ) : null}
    </div>
      <ChartWorkflowDock indicatorSeries={indicatorSeries} message={workspaceMessage} summary={workflowSummary} workspaceLoaded={workspaceLoaded} workspaceUpdatedAt={workspaceUpdatedAt} />
      <ChartStoryPanel points={storyPoints} />
      <ChartCommandPalette
        commands={[
          { action: saveWorkspaceNow, detail: "Persist local and account chart state.", label: "Save workspace", shortcut: "S" },
          { action: () => setCompactMode((value) => !value), detail: compactMode ? "Return to full chart density." : "Reduce chrome and chart height.", label: compactMode ? "Disable compact mode" : "Enable compact mode", shortcut: "," },
          { action: () => setMagnetMode((value) => !value), detail: magnetMode ? "Freehand drawing points." : "Snap drawing points to a stable grid.", label: magnetMode ? "Disable magnet mode" : "Enable magnet mode", shortcut: "M" },
          { action: () => setDrawingTool("edit"), detail: "Move drawings and drag anchor handles.", label: "Edit drawings", shortcut: "E" },
          { action: () => updateIndicators(enabledIndicators.length ? [] : [...DEFAULT_CHART_INDICATORS]), detail: "Toggle default indicator stack.", label: "Toggle indicators", shortcut: "I" },
          { action: resetWorkspaceState, detail: "Restore default chart workspace.", label: "Reset workspace", shortcut: "Shift+R" },
          ...(expandable ? [{ action: expandChart, detail: "Open the fullscreen chart workflow.", label: "Fullscreen chart", shortcut: "F" }] : []),
        ]}
        onClose={() => setCommandPaletteOpen(false)}
        open={commandPaletteOpen}
      />
    </div>
    {expanded ? (
      <SymbolChartModal
        candles={normalizedCandles}
        close={closeExpandedChart}
        dataSource={dataSource}
        defaultIndicators={enabledIndicators}
        defaultOverlayFamilies={enabledOverlayFamilies}
        defaultPeriod={period}
        interpretation={interpretation ?? buildDefaultChartInterpretation(symbol, move)}
        lastUpdated={lastUpdated ?? normalizedCandles[normalizedCandles.length - 1]?.time ?? null}
        showHistoricalSignals={showHistoricalSignals}
        showResearchLevelsToggle={showResearchLevelsToggle}
        signals={signals}
        symbol={symbol}
        tradeLevels={tradeLevels}
      />
    ) : null}
    </>
  );
}

function ChartOverlayControls({
  enabledFamilies,
  hasTradeLevels,
  markerCount,
  onToggle,
}: {
  enabledFamilies: ChartOverlayFamily[];
  hasTradeLevels: boolean;
  markerCount: number;
  onToggle: (family: ChartOverlayFamily) => void;
}) {
  return (
    <div className="mb-2 rounded-2xl border border-white/10 bg-slate-950/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Synchronized intelligence overlays
        </div>
        <div className="text-[11px] text-slate-500">{markerCount.toLocaleString()} source markers</div>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {CHART_OVERLAY_FAMILIES.map(({ family, label }) => {
          const enabled = enabledFamilies.includes(family);
          const disabled = family === "levels" && !hasTradeLevels;
          const tone = toneForFamily(family);
          return (
            <button
              aria-pressed={enabled}
              className={`min-h-10 shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                enabled
                  ? `${overlayToneClasses[tone].active} shadow-lg`
                  : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
              } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
              disabled={disabled}
              key={family}
              onClick={() => onToggle(family)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartIndicatorControls({
  enabledIndicators,
  indicatorSeries,
  onToggle,
}: {
  enabledIndicators: ChartIndicatorId[];
  indicatorSeries: ChartIndicatorSeries[];
  onToggle: (indicator: ChartIndicatorId) => void;
}) {
  const activeSeries = new Map(indicatorSeries.map((series) => [series.id, series]));
  const [indicatorQuery, setIndicatorQuery] = useState("");
  const query = indicatorQuery.trim().toLowerCase();
  const visibleIndicators = query
    ? CHART_INDICATORS.filter(({ id }) => {
      const definition = indicatorDefinition(id);
      return `${definition.label} ${definition.description} ${id}`.toLowerCase().includes(query);
    })
    : CHART_INDICATORS;
  return (
    <div className="mb-2 rounded-2xl border border-white/10 bg-slate-950/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Indicator management
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <label className="relative min-w-0 sm:max-w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              aria-label="Search indicators"
              className="min-h-8 w-full rounded-full border border-white/10 bg-slate-950/55 py-1 pl-8 pr-3 text-xs font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              onChange={(event) => setIndicatorQuery(event.target.value)}
              placeholder="Quick indicator"
              type="search"
              value={indicatorQuery}
            />
          </label>
          <div className="text-[11px] text-slate-500">{enabledIndicators.length.toLocaleString()} enabled</div>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {visibleIndicators.map(({ id: indicator }) => {
          const definition = indicatorDefinition(indicator);
          const enabled = enabledIndicators.includes(indicator);
          const active = activeSeries.get(indicator) ?? null;
          const evidenceLabel = active ? `${active.valueLabel}${active.renderMode === "overlay" ? ` · ${active.points.length} points` : ""}` : "Limited evidence";
          return (
            <button
              aria-pressed={enabled}
              className={`min-h-10 shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                enabled
                  ? `${overlayToneClasses[definition.tone].active} shadow-lg`
                  : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
              }`}
              key={indicator}
              onClick={() => onToggle(indicator)}
              title={`${definition.description}${enabled ? ` ${evidenceLabel}.` : ""}`}
              type="button"
            >
              {definition.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartIndicatorTemplateControls({
  activeTemplateId,
  onApply,
  onDelete,
  onSave,
  templates,
}: {
  activeTemplateId: string | null;
  onApply: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onSave: (name: string) => void;
  templates: ChartIndicatorTemplate[];
}) {
  const [templateName, setTemplateName] = useState("");
  return (
    <div className="mb-2 rounded-2xl border border-white/10 bg-slate-950/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Indicator templates
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          <input
            aria-label="Template name"
            className="min-h-9 min-w-0 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            type="text"
            value={templateName}
          />
          <button
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-300/45 hover:text-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
            data-chart-template-save="true"
            disabled={!templateName.trim()}
            onClick={() => {
              onSave(templateName);
              setTemplateName("");
            }}
            type="button"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {templates.map((template) => (
          <div className="flex shrink-0 items-center gap-1" key={template.id}>
            <button
              aria-pressed={activeTemplateId === template.id}
              className={`min-h-10 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                activeTemplateId === template.id
                  ? "border-emerald-300/55 bg-emerald-300/12 text-emerald-100 shadow-lg shadow-emerald-950/20"
                  : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
              }`}
              onClick={() => onApply(template.id)}
              title={`${template.indicators.length} indicators · ${template.overlayFamilies.length} overlays`}
              type="button"
            >
              {template.name}
            </button>
            {template.source === "user" ? (
              <button
                aria-label={`Delete ${template.name} template`}
                className="grid h-9 w-9 place-items-center rounded-full border border-rose-300/20 bg-white/[0.035] text-slate-500 transition hover:border-rose-300/50 hover:text-rose-100"
                onClick={() => onDelete(template.id)}
                title="Delete template"
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartDrawingToolbar({
  activeTool,
  drawings,
  drawingCount,
  magnetMode,
  onClear,
  onDeleteSelected,
  onDuplicateSelected,
  onNudgeSelected,
  onReset,
  onSelect,
  onSelectDrawing,
  onToggleMagnet,
  onToggleToolbar,
  onUpdateSelected,
  selectedDrawing,
  toolbarCollapsed,
}: {
  activeTool: ChartDrawingTool;
  drawings: ChartDrawing[];
  drawingCount: number;
  magnetMode: boolean;
  onClear: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onNudgeSelected: (deltaX: number, deltaY: number) => void;
  onReset: () => void;
  onSelect: (tool: ChartDrawingTool) => void;
  onSelectDrawing: (drawingId: string | null) => void;
  onToggleMagnet: () => void;
  onToggleToolbar: () => void;
  onUpdateSelected: (patch: Partial<Pick<ChartDrawing, "color" | "folder" | "label" | "lineWidth" | "locked" | "style" | "visible">>) => void;
  selectedDrawing: ChartDrawing | null;
  toolbarCollapsed: boolean;
}) {
  const tools: Array<{ label: string; tool: ChartDrawingTool }> = [
    { label: "Inspect", tool: "inspect" },
    { label: "Edit", tool: "edit" },
    { label: "H-Line", tool: "horizontal" },
    { label: "Trendline", tool: "trendline" },
    { label: "Support", tool: "supportZone" },
    { label: "Resistance", tool: "resistanceZone" },
    { label: "Entry", tool: "entryZone" },
    { label: "Stop", tool: "stopZone" },
    { label: "Target", tool: "targetZone" },
    { label: "Risk Box", tool: "riskBox" },
    { label: "Note", tool: "annotation" },
    { label: "Ruler", tool: "ruler" },
  ];
  return (
    <div
      className="mb-2 rounded-2xl border border-white/10 bg-slate-950/50 p-2"
      data-chart-drawing-count={drawingCount}
      data-chart-drawing-toolbar="true"
      data-chart-drawing-tool={activeTool}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Drawing tools</div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Client-side research annotations. Drawings are not treated as TradeVeto evidence.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            aria-pressed={magnetMode}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
              magnetMode
                ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100"
                : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-cyan-300/40 hover:text-cyan-100"
            }`}
            onClick={onToggleMagnet}
            title="Snap new and edited drawing points to a stable chart grid"
            type="button"
          >
            <Magnet className="h-3.5 w-3.5" />
            Magnet
          </button>
          <button
            aria-expanded={!toolbarCollapsed}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={onToggleToolbar}
            title={toolbarCollapsed ? "Show drawing controls" : "Collapse drawing controls"}
            type="button"
          >
            {toolbarCollapsed ? <PanelTopOpen className="h-3.5 w-3.5" /> : <PanelTopClose className="h-3.5 w-3.5" />}
          </button>
          {selectedDrawing ? (
            <>
              <IconNudgeButton disabled={Boolean(selectedDrawing.locked)} label="Nudge left" onClick={() => onNudgeSelected(-0.5, 0)}><ArrowLeft className="h-3.5 w-3.5" /></IconNudgeButton>
              <IconNudgeButton disabled={Boolean(selectedDrawing.locked)} label="Nudge up" onClick={() => onNudgeSelected(0, -0.5)}><ArrowUp className="h-3.5 w-3.5" /></IconNudgeButton>
              <IconNudgeButton disabled={Boolean(selectedDrawing.locked)} label="Nudge down" onClick={() => onNudgeSelected(0, 0.5)}><ArrowDown className="h-3.5 w-3.5" /></IconNudgeButton>
              <IconNudgeButton disabled={Boolean(selectedDrawing.locked)} label="Nudge right" onClick={() => onNudgeSelected(0.5, 0)}><ArrowRight className="h-3.5 w-3.5" /></IconNudgeButton>
              <IconNudgeButton label="Duplicate drawing" onClick={onDuplicateSelected}><Copy className="h-3.5 w-3.5" /></IconNudgeButton>
              <IconNudgeButton disabled={Boolean(selectedDrawing.locked)} label="Delete drawing" onClick={onDeleteSelected} tone="danger"><Trash2 className="h-3.5 w-3.5" /></IconNudgeButton>
            </>
          ) : null}
          <button
            className="min-h-9 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-rose-300/40 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!drawingCount}
            onClick={onClear}
            type="button"
          >
            Clear {drawingCount ? `(${drawingCount})` : ""}
          </button>
          <button
            className="min-h-9 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-rose-300/40 hover:text-rose-100"
            onClick={onReset}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>
      {!toolbarCollapsed ? (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {tools.map(({ label, tool }) => (
            <button
              aria-pressed={activeTool === tool}
              className={`min-h-10 shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                activeTool === tool
                  ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100 shadow-lg shadow-cyan-950/20"
                  : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
              }`}
              key={tool}
              onClick={() => onSelect(tool)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {!toolbarCollapsed && drawings.length ? (
        <ChartDrawingObjectControls
          drawings={drawings}
          onDeleteSelected={onDeleteSelected}
          onDuplicateSelected={onDuplicateSelected}
          onSelectDrawing={onSelectDrawing}
          onUpdateSelected={onUpdateSelected}
          selectedDrawing={selectedDrawing}
        />
      ) : null}
    </div>
  );
}

const DRAWING_COLOR_OPTIONS: Array<{ color: StoredChartDrawingColor; label: string; swatch: string }> = [
  { color: "cyan", label: "Cyan", swatch: "bg-cyan-300" },
  { color: "emerald", label: "Emerald", swatch: "bg-emerald-300" },
  { color: "amber", label: "Amber", swatch: "bg-amber-300" },
  { color: "rose", label: "Rose", swatch: "bg-rose-300" },
  { color: "violet", label: "Violet", swatch: "bg-violet-300" },
  { color: "slate", label: "Slate", swatch: "bg-slate-300" },
];

const DRAWING_STYLE_OPTIONS: StoredChartDrawingStyle[] = ["solid", "dashed", "dotted"];
const DRAWING_WIDTH_OPTIONS: StoredChartDrawingWidth[] = [1, 2, 3, 4];

function ChartDrawingObjectControls({
  drawings,
  onDeleteSelected,
  onDuplicateSelected,
  onSelectDrawing,
  onUpdateSelected,
  selectedDrawing,
}: {
  drawings: ChartDrawing[];
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onSelectDrawing: (drawingId: string | null) => void;
  onUpdateSelected: (patch: Partial<Pick<ChartDrawing, "color" | "folder" | "label" | "lineWidth" | "locked" | "style" | "visible">>) => void;
  selectedDrawing: ChartDrawing | null;
}) {
  const [drawingSearch, setDrawingSearch] = useState("");
  const selectedColor = selectedDrawing?.color ?? "cyan";
  const selectedStyle = selectedDrawing?.style ?? "solid";
  const selectedWidth = selectedDrawing?.lineWidth ?? 2;
  const selectedFolder = selectedDrawing?.folder ?? "General";
  const selectedVisible = selectedDrawing?.visible !== false;
  const selectedLocked = Boolean(selectedDrawing?.locked);
  const drawingQuery = drawingSearch.trim().toLowerCase();
  const filteredDrawings = drawingQuery
    ? drawings.filter((drawing) => `${drawing.label ?? ""} ${drawingToolLabel(drawing.tool)} ${drawing.folder ?? ""}`.toLowerCase().includes(drawingQuery))
    : drawings;
  return (
    <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 xl:grid-cols-[minmax(0,0.75fr)_minmax(280px,1fr)]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Object list</div>
          <label className="relative min-w-0 flex-1 sm:max-w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              aria-label="Search drawings"
              className="min-h-8 w-full rounded-full border border-white/10 bg-slate-950/55 py-1 pl-8 pr-3 text-xs font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              onChange={(event) => setDrawingSearch(event.target.value)}
              placeholder="Find object"
              type="search"
              value={drawingSearch}
            />
          </label>
        </div>
        <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
          {filteredDrawings.map((drawing, index) => (
            <button
              aria-pressed={selectedDrawing?.id === drawing.id}
              className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                selectedDrawing?.id === drawing.id
                  ? "border-cyan-300/45 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-slate-100"
              }`}
              key={drawing.id}
              onClick={() => onSelectDrawing(drawing.id)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{drawing.label || drawingToolLabel(drawing.tool)}</span>
                <span className="block truncate text-[10px] text-slate-500">{drawing.folder ?? "General"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-slate-500">
                {drawing.visible === false ? <EyeOff className="h-3 w-3" /> : null}
                {drawing.locked ? <Lock className="h-3 w-3" /> : null}
                #{index + 1}
              </span>
            </button>
          ))}
          {!filteredDrawings.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-slate-500">No matching drawings.</div>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        {selectedDrawing ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">{drawingToolLabel(selectedDrawing.tool)}</div>
              <div className="flex items-center gap-1.5">
                <IconNudgeButton label={selectedVisible ? "Hide drawing" : "Show drawing"} onClick={() => onUpdateSelected({ visible: !selectedVisible })}>
                  {selectedVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </IconNudgeButton>
                <IconNudgeButton label={selectedLocked ? "Unlock drawing" : "Lock drawing"} onClick={() => onUpdateSelected({ locked: !selectedLocked })}>
                  {selectedLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </IconNudgeButton>
                <IconNudgeButton label="Duplicate drawing" onClick={onDuplicateSelected}><Copy className="h-3.5 w-3.5" /></IconNudgeButton>
                <IconNudgeButton disabled={selectedLocked} label="Delete drawing" onClick={onDeleteSelected} tone="danger"><Trash2 className="h-3.5 w-3.5" /></IconNudgeButton>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Label</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                onChange={(event) => onUpdateSelected({ label: event.target.value })}
                placeholder={drawingToolLabel(selectedDrawing.tool)}
                type="text"
                value={selectedDrawing.label ?? ""}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Folder / group</span>
              <select
                className="min-h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-300/40"
                onChange={(event) => onUpdateSelected({ folder: event.target.value })}
                value={selectedFolder}
              >
                {["General", "Levels", "Risk", "Replay", "Notes"].map((folder) => <option key={folder} value={folder}>{folder}</option>)}
              </select>
            </label>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                <Palette className="h-3.5 w-3.5" />
                Color
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DRAWING_COLOR_OPTIONS.map((option) => (
                  <button
                    aria-label={option.label}
                    aria-pressed={selectedColor === option.color}
                    className={`grid h-8 w-8 place-items-center rounded-full border transition ${
                      selectedColor === option.color ? "border-white/70 bg-white/10" : "border-white/10 bg-white/[0.025] hover:border-white/30"
                    }`}
                    key={option.color}
                    onClick={() => onUpdateSelected({ color: option.color })}
                    title={option.label}
                    type="button"
                  >
                    <span className={`h-3.5 w-3.5 rounded-full ${option.swatch}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Style</span>
                <select
                  className="min-h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-300/40"
                  onChange={(event) => onUpdateSelected({ style: event.target.value as StoredChartDrawingStyle })}
                  value={selectedStyle}
                >
                  {DRAWING_STYLE_OPTIONS.map((style) => <option key={style} value={style}>{style}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Width</span>
                <select
                  className="min-h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-300/40"
                  onChange={(event) => onUpdateSelected({ lineWidth: Number(event.target.value) as StoredChartDrawingWidth })}
                  value={selectedWidth}
                >
                  {DRAWING_WIDTH_OPTIONS.map((width) => <option key={width} value={width}>{width}</option>)}
                </select>
              </label>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Style presets</div>
              <div className="flex flex-wrap gap-1.5">
                <button className="min-h-8 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100" onClick={() => onUpdateSelected({ color: "cyan", folder: "Levels", lineWidth: 2, style: "solid" })} type="button">Level</button>
                <button className="min-h-8 rounded-full border border-rose-300/20 bg-rose-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-100" onClick={() => onUpdateSelected({ color: "rose", folder: "Risk", lineWidth: 3, style: "dashed" })} type="button">Risk</button>
                <button className="min-h-8 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100" onClick={() => onUpdateSelected({ color: "amber", folder: "Notes", lineWidth: 2, style: "dotted" })} type="button">Note</button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className="min-h-10 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={() => onSelectDrawing(drawings[0]?.id ?? null)}
            type="button"
          >
            Select object
          </button>
        )}
      </div>
    </div>
  );
}

function ChartAlertPanel({
  authenticated,
  drawingPrice,
  history,
  latestClose,
  message,
  onCreate,
  saving,
  scannerScore,
  selectedDrawing,
  symbol,
}: {
  authenticated: boolean;
  drawingPrice: number | null;
  history: StoredChartAlertHistoryEntry[];
  latestClose: number | null;
  message: string | null;
  onCreate: (request: ChartAlertRequest) => Promise<void>;
  saving: boolean;
  scannerScore: number | null;
  selectedDrawing: ChartDrawing | null;
  symbol: string;
}) {
  const [alertType, setAlertType] = useState<ChartAlertRuleType>("price_above");
  const [thresholdInput, setThresholdInput] = useState("");
  const hasScoreContext = typeof scannerScore === "number" && Number.isFinite(scannerScore);

  useEffect(() => {
    if (thresholdInput) return;
    const defaultValue = alertType.startsWith("score") ? scannerScore : latestClose;
    if (typeof defaultValue === "number" && Number.isFinite(defaultValue)) {
      setThresholdInput(defaultValue.toFixed(alertType.startsWith("score") ? 0 : 2));
    }
  }, [alertType, latestClose, scannerScore, thresholdInput]);

  async function submit(): Promise<void> {
    const threshold = Number(thresholdInput);
    if (!Number.isFinite(threshold)) return;
    const isScore = alertType.startsWith("score");
    await onCreate({
      riskReason: isScore
        ? `${symbol.toUpperCase()} scanner score condition saved from chart workflow.`
        : `${symbol.toUpperCase()} price-level condition saved from chart workflow.`,
      sourceReason: isScore
        ? `Created from /symbol/${symbol.toUpperCase()} chart score context.`
        : `Created from /symbol/${symbol.toUpperCase()} chart price context.`,
      threshold,
      type: alertType,
    });
  }

  async function createDrawingAlert(type: Extract<ChartAlertRuleType, "price_above" | "price_below">): Promise<void> {
    if (!selectedDrawing || drawingPrice === null) return;
    await onCreate({
      riskReason: `${drawingToolLabel(selectedDrawing.tool)} drawing level is treated as a user research threshold, not TradeVeto evidence.`,
      sourceReason: `Created from /symbol/${symbol.toUpperCase()} selected drawing "${selectedDrawing.label || drawingToolLabel(selectedDrawing.tool)}".`,
      threshold: Number(drawingPrice.toFixed(2)),
      type,
    });
  }

  return (
    <div className="mb-2 rounded-2xl border border-white/10 bg-slate-950/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Chart alerts</div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Saved alerts use server-side scanner rules and keep their chart source attached.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <select
            aria-label="Chart alert condition"
            className="min-h-9 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-300/40"
            onChange={(event) => {
              const nextType = event.target.value as ChartAlertRuleType;
              setAlertType(nextType);
              const nextDefault = nextType.startsWith("score") ? scannerScore : latestClose;
              setThresholdInput(typeof nextDefault === "number" && Number.isFinite(nextDefault) ? nextDefault.toFixed(nextType.startsWith("score") ? 0 : 2) : "");
            }}
            value={alertType}
          >
            <option value="price_above">Price above</option>
            <option value="price_below">Price below</option>
            {hasScoreContext ? <option value="score_above">Score above</option> : null}
            {hasScoreContext ? <option value="score_below">Score below</option> : null}
          </select>
          <input
            aria-label="Chart alert threshold"
            className="min-h-9 w-28 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
            inputMode="decimal"
            onChange={(event) => setThresholdInput(event.target.value)}
            placeholder={alertType.startsWith("score") ? "Score" : "Price"}
            type="text"
            value={thresholdInput}
          />
          <button
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-300/45 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-45"
            data-chart-alert-save="true"
            disabled={saving || !authenticated || !Number.isFinite(Number(thresholdInput))}
            onClick={() => void submit()}
            type="button"
          >
            <Bell className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Last {formatChartMoney(latestClose)}
        </span>
        {hasScoreContext ? (
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-100">
            Score {scannerScore?.toFixed(0)}
          </span>
        ) : null}
        {selectedDrawing && drawingPrice !== null ? (
          <>
            <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-100">
              Drawing {formatChartMoney(drawingPrice)}
            </span>
            <button
              className="min-h-8 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={saving || !authenticated}
              onClick={() => void createDrawingAlert("price_above")}
              type="button"
            >
              Above drawing
            </button>
            <button
              className="min-h-8 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={saving || !authenticated}
              onClick={() => void createDrawingAlert("price_below")}
              type="button"
            >
              Below drawing
            </button>
          </>
        ) : null}
        {!hasScoreContext ? (
          <span className="text-[11px] text-slate-600">Indicator alerts stay limited to server-evaluated scanner score conditions when score context exists.</span>
        ) : null}
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Cooldown 240m
        </span>
      </div>
      {history.length ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Recent chart alert history</div>
          <div className="grid gap-2 md:grid-cols-2">
            {history.slice(-4).reverse().map((entry) => (
              <div className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2" key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100">{entry.label}</span>
                  <span className="font-mono text-[10px] text-slate-500">{formatChartDate(entry.createdAt)}</span>
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  {chartAlertTypeLabel(entry.type)} · {entry.cooldownMinutes}m cooldown
                </div>
                {entry.sourceReason ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{entry.sourceReason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {message ? (
        <div className="mt-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2 text-[11px] font-semibold text-cyan-100">
          {message}
        </div>
      ) : null}
    </div>
  );
}

type ChartCommand = {
  action: () => void;
  detail: string;
  label: string;
  shortcut: string;
};

function ChartCommandPalette({
  commands,
  onClose,
  open,
}: {
  commands: ChartCommand[];
  onClose: () => void;
  open: boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands;
    return commands.filter((command) => `${command.label} ${command.detail} ${command.shortcut}`.toLowerCase().includes(normalizedQuery));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;
  return (
    <div aria-label="Chart command palette" aria-modal="true" className="fixed inset-0 z-[11000] grid place-items-start bg-slate-950/55 px-3 pt-[calc(4rem+var(--tv-safe-area-top))] backdrop-blur-sm sm:place-items-center sm:p-6" role="dialog">
      <button aria-label="Close chart command palette" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-black/45">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Keyboard className="h-4 w-4 text-cyan-200" />
          <input
            aria-label="Search chart commands"
            className="min-h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chart command"
            ref={inputRef}
            type="search"
            value={query}
          />
          <button
            aria-label="Close chart command palette"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={onClose}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[min(60dvh,420px)] overflow-y-auto p-2">
          {filteredCommands.map((command) => (
            <button
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.06]"
              key={`${command.label}-${command.shortcut}`}
              onClick={() => {
                command.action();
                onClose();
              }}
              type="button"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-100">{command.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{command.detail}</span>
              </span>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">{command.shortcut}</span>
            </button>
          ))}
          {!filteredCommands.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">No chart commands found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IconNudgeButton({
  children,
  disabled = false,
  label,
  onClick,
  tone = "neutral",
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone?: "danger" | "neutral";
}) {
  return (
    <button
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-full border bg-white/[0.035] text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-45 ${
        tone === "danger"
          ? "border-rose-300/20 hover:border-rose-300/50 hover:text-rose-100"
          : "border-white/10 hover:border-cyan-300/40 hover:text-cyan-100"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function ChartDrawingLayer({
  drawings,
  draftDrawing,
  magnetMode,
  onCommit,
  onDraftChange,
  onSelect,
  onUpdate,
  selectedDrawingId,
  tool,
}: {
  drawings: ChartDrawing[];
  draftDrawing: ChartDrawing | null;
  magnetMode: boolean;
  onCommit: (drawing: ChartDrawing) => void;
  onDraftChange: (drawing: ChartDrawing | null) => void;
  onSelect: (drawingId: string | null) => void;
  onUpdate: (drawingId: string, updater: (drawing: ChartDrawing) => ChartDrawing) => void;
  selectedDrawingId: string | null;
  tool: ChartDrawingTool;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const editDragRef = useRef<{ anchor: "end" | "move" | "start"; drawing: ChartDrawing; pointerId: number; start: ChartDrawingPoint } | null>(null);
  const visibleDrawings = drawings.filter((drawing) => drawing.visible !== false);
  const allDrawings = draftDrawing ? [...visibleDrawings, draftDrawing] : visibleDrawings;

  function pointFromClient(clientX: number, clientY: number): ChartDrawingPoint {
    const box = layerRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    const point = {
      x: clamp(((clientX - box.left) / Math.max(1, box.width)) * 100, 0, 100),
      y: clamp(((clientY - box.top) / Math.max(1, box.height)) * 100, 0, 100),
    };
    return magnetMode ? snapChartPoint(point) : point;
  }

  function begin(event: ReactPointerEvent<HTMLDivElement>): void {
    if (tool === "edit") {
      onSelect(null);
      return;
    }
    if (tool === "inspect") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = pointFromClient(event.clientX, event.clientY);
    onDraftChange({
      end: start,
      id: `draft-${tool}`,
      start,
      tool,
    });
  }

  function move(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!draftDrawing || tool === "inspect") return;
    onDraftChange({
      ...draftDrawing,
      end: pointFromClient(event.clientX, event.clientY),
    });
  }

  function end(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!draftDrawing || tool === "inspect") return;
    const endPoint = pointFromClient(event.clientX, event.clientY);
    const distance = Math.hypot(endPoint.x - draftDrawing.start.x, endPoint.y - draftDrawing.start.y);
    const nextDrawing = {
      ...draftDrawing,
      createdAt: new Date().toISOString(),
      end: isPointDrawingTool(tool) || distance < 1 ? draftDrawing.start : endPoint,
      id: `${tool}-${Date.now()}-${Math.round(draftDrawing.start.x * 10)}-${Math.round(draftDrawing.start.y * 10)}`,
    };
    onDraftChange(null);
    if (isPointDrawingTool(tool) || distance >= 2.5) onCommit(nextDrawing);
  }

  function beginEditDrag(event: ReactPointerEvent<SVGElement>, drawing: ChartDrawing, anchor: "end" | "move" | "start" = "move"): void {
    if (tool !== "edit" || drawing.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(drawing.id);
    editDragRef.current = {
      drawing,
      anchor,
      pointerId: event.pointerId,
      start: pointFromClient(event.clientX, event.clientY),
    };
  }

  function moveEditDrag(event: ReactPointerEvent<SVGGElement>): void {
    const drag = editDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY);
    const deltaX = point.x - drag.start.x;
    const deltaY = point.y - drag.start.y;
    onUpdate(drag.drawing.id, () => (
      drag.anchor === "move"
        ? nudgeDrawing(drag.drawing, deltaX, deltaY)
        : resizeDrawingAtAnchor(drag.drawing, drag.anchor, point)
    ));
  }

  function endEditDrag(event: ReactPointerEvent<SVGGElement>): void {
    const drag = editDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    editDragRef.current = null;
  }

  return (
    <div
      className={`absolute inset-0 z-[4] ${tool === "inspect" ? "pointer-events-none" : tool === "edit" ? "cursor-move touch-none" : "cursor-crosshair touch-none"}`}
      onPointerCancel={() => onDraftChange(null)}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      ref={layerRef}
    >
      <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
        {allDrawings.map((drawing) => (
          <g
            className={tool === "edit" ? "pointer-events-auto" : "pointer-events-none"}
            key={drawing.id}
            onPointerCancel={endEditDrag}
            onPointerDown={(event) => beginEditDrag(event, drawing)}
            onPointerMove={moveEditDrag}
            onPointerUp={endEditDrag}
          >
            <DrawingShape drawing={drawing} />
            {tool === "edit" ? <DrawingHitTarget drawing={drawing} /> : null}
            {selectedDrawingId === drawing.id ? <DrawingSelectionFrame drawing={drawing} /> : null}
            {tool === "edit" && selectedDrawingId === drawing.id && !drawing.locked ? (
              <DrawingAnchorHandles
                drawing={drawing}
                onAnchorPointerDown={(event, anchor) => beginEditDrag(event, drawing, anchor)}
              />
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function isPointDrawingTool(tool: ChartDrawingTool): boolean {
  return tool === "annotation" || tool === "horizontal" || tool === "marker";
}

type DrawingVisualStyle = {
  fill: string;
  stroke: string;
  text: string;
};

function DrawingShape({ drawing }: { drawing: ChartDrawing }) {
  if (drawing.tool === "horizontal") {
    const visual = drawingVisualStyle(drawing, { fill: "rgba(226,232,240,0.08)", stroke: "rgba(226,232,240,0.72)", text: "#e2e8f0" });
    return (
      <g>
        <line stroke={visual.stroke} strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} x1="0" x2="100" y1={drawing.start.y} y2={drawing.start.y} />
        <text fill={visual.text} fontSize="2.15" fontWeight="800" x="1.5" y={clamp(drawing.start.y - 1.2, 3, 96)}>
          {drawingDisplayLabel(drawing, "H-LINE")}
        </text>
      </g>
    );
  }
  if (drawing.tool === "supportZone" || drawing.tool === "resistanceZone" || drawing.tool === "entryZone" || drawing.tool === "stopZone" || drawing.tool === "targetZone") {
    const zone = drawingZoneStyle(drawing.tool);
    const visual = drawingVisualStyle(drawing, { fill: zone.fill, stroke: zone.stroke, text: zone.text });
    const y = Math.min(drawing.start.y, drawing.end.y);
    const height = Math.max(2.5, Math.abs(drawing.end.y - drawing.start.y));
    return (
      <g>
        <rect fill={visual.fill} height={height} rx="1.4" stroke={visual.stroke} strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} width="100" x="0" y={y} />
        <text fill={visual.text} fontSize="2.2" fontWeight="800" x="1.5" y={clamp(y + 3.2, 3, 98)}>
          {drawingDisplayLabel(drawing, zone.label)}
        </text>
      </g>
    );
  }
  if (drawing.tool === "riskBox") {
    const visual = drawingVisualStyle(drawing, { fill: "rgba(244,63,94,0.075)", stroke: "rgba(251,113,133,0.66)", text: "#fecdd3" });
    const x = Math.min(drawing.start.x, drawing.end.x);
    const y = Math.min(drawing.start.y, drawing.end.y);
    const width = Math.max(1, Math.abs(drawing.end.x - drawing.start.x));
    const height = Math.max(1, Math.abs(drawing.end.y - drawing.start.y));
    return (
      <g>
        <rect fill={visual.fill} height={height} rx="1.5" stroke={visual.stroke} strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} width={width} x={x} y={y} />
        <text fill={visual.text} fontSize="2.2" fontWeight="800" x={x + 1.4} y={Math.max(3, y + 3)}>
          {drawingDisplayLabel(drawing, "RISK")}
        </text>
      </g>
    );
  }
  if (drawing.tool === "annotation") {
    const visual = drawingVisualStyle(drawing, { fill: "rgba(251,191,36,0.18)", stroke: "#fde68a", text: "#fde68a" });
    return (
      <g>
        <circle cx={drawing.start.x} cy={drawing.start.y} fill={visual.fill} r="2.4" stroke={visual.stroke} strokeWidth={drawingStrokeWidth(drawing)} />
        <rect fill="rgba(15,23,42,0.82)" height="5.4" rx="1.4" stroke={visual.stroke} strokeWidth="0.22" width="17" x={clamp(drawing.start.x + 1.5, 1, 82)} y={clamp(drawing.start.y - 6, 1, 92)} />
        <text fill={visual.text} fontSize="2.2" fontWeight="800" x={clamp(drawing.start.x + 3, 2, 84)} y={clamp(drawing.start.y - 2.4, 4, 96)}>
          {drawingDisplayLabel(drawing, "NOTE")}
        </text>
      </g>
    );
  }
  if (drawing.tool === "range") {
    const visual = drawingVisualStyle(drawing, { fill: "rgba(34,211,238,0.08)", stroke: "rgba(34,211,238,0.58)", text: "#a5f3fc" });
    const x = Math.min(drawing.start.x, drawing.end.x);
    const y = Math.min(drawing.start.y, drawing.end.y);
    const width = Math.max(1, Math.abs(drawing.end.x - drawing.start.x));
    const height = Math.max(1, Math.abs(drawing.end.y - drawing.start.y));
    return (
      <g>
        <rect fill={visual.fill} height={height} rx="1.5" stroke={visual.stroke} strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} width={width} x={x} y={y} />
        <text fill={visual.text} fontSize="2.2" fontWeight="800" x={x + 1.4} y={Math.max(3, y + 3)}>
          {drawingDisplayLabel(drawing, "RANGE")}
        </text>
      </g>
    );
  }
  if (drawing.tool === "marker") {
    const visual = drawingVisualStyle(drawing, { fill: "rgba(251,191,36,0.2)", stroke: "#fde68a", text: "#fde68a" });
    return (
      <g>
        <line stroke={visual.stroke} strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} x1={drawing.start.x} x2={drawing.start.x} y1="0" y2="100" />
        <circle cx={drawing.start.x} cy={drawing.start.y} fill={visual.fill} r="2.2" stroke={visual.stroke} strokeWidth={drawingStrokeWidth(drawing)} />
        <text fill={visual.text} fontSize="2.2" fontWeight="800" x={Math.min(92, drawing.start.x + 1.5)} y={Math.max(3, drawing.start.y - 1.2)}>
          {drawingDisplayLabel(drawing, "NOTE")}
        </text>
      </g>
    );
  }
  if (drawing.tool === "ruler") {
    const visual = drawingVisualStyle(drawing, { fill: "rgba(8,47,73,0.74)", stroke: "rgba(34,211,238,0.82)", text: "#a5f3fc" });
    const midX = (drawing.start.x + drawing.end.x) / 2;
    const midY = (drawing.start.y + drawing.end.y) / 2;
    const spanX = Math.abs(drawing.end.x - drawing.start.x);
    const spanY = Math.abs(drawing.end.y - drawing.start.y);
    return (
      <g>
        <line stroke={visual.stroke} strokeLinecap="round" strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} x1={drawing.start.x} x2={drawing.end.x} y1={drawing.start.y} y2={drawing.end.y} />
        <circle cx={drawing.start.x} cy={drawing.start.y} fill={visual.text} r="0.85" />
        <circle cx={drawing.end.x} cy={drawing.end.y} fill={visual.text} r="0.85" />
        <rect fill={visual.fill} height="5.2" rx="1.4" stroke={visual.stroke} strokeWidth="0.22" width="22" x={clamp(midX - 11, 1, 77)} y={clamp(midY - 6, 1, 92)} />
        <text fill={visual.text} fontSize="2.15" fontWeight="800" x={clamp(midX - 9.4, 2, 78)} y={clamp(midY - 2.45, 4, 95)}>
          {drawing.label ? drawingDisplayLabel(drawing, "RULER") : `${spanX.toFixed(0)}W / ${spanY.toFixed(0)}H`}
        </text>
      </g>
    );
  }
  const visual = drawingVisualStyle(drawing, { fill: "rgba(196,181,253,0.2)", stroke: "rgba(196,181,253,0.76)", text: "#c4b5fd" });
  return (
    <g>
      <line stroke={visual.stroke} strokeLinecap="round" strokeDasharray={drawingDashArray(drawing)} strokeWidth={drawingStrokeWidth(drawing)} x1={drawing.start.x} x2={drawing.end.x} y1={drawing.start.y} y2={drawing.end.y} />
      <circle cx={drawing.start.x} cy={drawing.start.y} fill={visual.text} r="0.95" />
      <circle cx={drawing.end.x} cy={drawing.end.y} fill={visual.text} r="0.95" />
      {drawing.label ? (
        <text fill={visual.text} fontSize="2.15" fontWeight="800" x={clamp((drawing.start.x + drawing.end.x) / 2 + 1, 2, 84)} y={clamp((drawing.start.y + drawing.end.y) / 2 - 1, 4, 96)}>
          {drawingDisplayLabel(drawing, "TREND")}
        </text>
      ) : null}
    </g>
  );
}

const drawingPalette: Record<StoredChartDrawingColor, DrawingVisualStyle> = {
  amber: { fill: "rgba(251,191,36,0.12)", stroke: "rgba(251,191,36,0.78)", text: "#fde68a" },
  cyan: { fill: "rgba(34,211,238,0.10)", stroke: "rgba(34,211,238,0.78)", text: "#a5f3fc" },
  emerald: { fill: "rgba(52,211,153,0.10)", stroke: "rgba(52,211,153,0.78)", text: "#bbf7d0" },
  rose: { fill: "rgba(251,113,133,0.10)", stroke: "rgba(251,113,133,0.78)", text: "#fecdd3" },
  slate: { fill: "rgba(226,232,240,0.08)", stroke: "rgba(226,232,240,0.72)", text: "#e2e8f0" },
  violet: { fill: "rgba(196,181,253,0.10)", stroke: "rgba(196,181,253,0.78)", text: "#ddd6fe" },
};

function drawingVisualStyle(drawing: ChartDrawing, fallback: DrawingVisualStyle): DrawingVisualStyle {
  return drawing.color ? drawingPalette[drawing.color] : fallback;
}

function drawingDashArray(drawing: ChartDrawing): string | undefined {
  if (drawing.style === "solid") return undefined;
  if (drawing.style === "dotted") return "0.6 1.1";
  return "1.6 1.1";
}

function drawingStrokeWidth(drawing: ChartDrawing): string {
  const width = drawing.lineWidth ?? 2;
  return (0.22 + width * 0.08).toFixed(2);
}

function drawingDisplayLabel(drawing: ChartDrawing, fallback: string): string {
  return (drawing.label?.trim() || fallback).slice(0, 24).toUpperCase();
}

function DrawingSelectionFrame({ drawing }: { drawing: ChartDrawing }) {
  const bounds = drawingBounds(drawing, 1.6);
  return (
    <g pointerEvents="none">
      <rect
        fill="rgba(34,211,238,0.035)"
        height={bounds.height}
        rx="1.4"
        stroke="rgba(103,232,249,0.78)"
        strokeDasharray="1.2 0.9"
        strokeWidth="0.3"
        width={bounds.width}
        x={bounds.x}
        y={bounds.y}
      />
      <circle cx={drawing.start.x} cy={drawing.start.y} fill="#67e8f9" r="0.95" stroke="#020617" strokeWidth="0.26" />
      <circle cx={drawing.end.x} cy={drawing.end.y} fill="#67e8f9" r="0.95" stroke="#020617" strokeWidth="0.26" />
    </g>
  );
}

function DrawingAnchorHandles({
  drawing,
  onAnchorPointerDown,
}: {
  drawing: ChartDrawing;
  onAnchorPointerDown: (event: ReactPointerEvent<SVGCircleElement>, anchor: "end" | "start") => void;
}) {
  const anchors: Array<{ anchor: "end" | "start"; point: ChartDrawingPoint }> = isPointDrawingTool(drawing.tool)
    ? [{ anchor: "start", point: drawing.start }]
    : [
      { anchor: "start", point: drawing.start },
      { anchor: "end", point: drawing.end },
    ];
  return (
    <g>
      {anchors.map(({ anchor, point }) => (
        <circle
          aria-label={`${anchor} drawing anchor`}
          cx={point.x}
          cy={point.y}
          fill="#020617"
          key={anchor}
          onPointerDown={(event) => onAnchorPointerDown(event, anchor)}
          pointerEvents="all"
          r="1.7"
          role="button"
          stroke="#67e8f9"
          strokeWidth="0.45"
          tabIndex={-1}
        />
      ))}
    </g>
  );
}

function DrawingHitTarget({ drawing }: { drawing: ChartDrawing }) {
  const bounds = drawingBounds(drawing, 3);
  if (drawing.tool === "horizontal") {
    return <rect fill="transparent" height="8" pointerEvents="all" width="100" x="0" y={clamp(drawing.start.y - 4, 0, 92)} />;
  }
  if (drawing.tool === "trendline" || drawing.tool === "ruler") {
    return <line stroke="transparent" strokeLinecap="round" strokeWidth="5" pointerEvents="stroke" x1={drawing.start.x} x2={drawing.end.x} y1={drawing.start.y} y2={drawing.end.y} />;
  }
  return <rect fill="transparent" height={bounds.height} pointerEvents="all" width={bounds.width} x={bounds.x} y={bounds.y} />;
}

function drawingBounds(drawing: ChartDrawing, padding: number): { height: number; width: number; x: number; y: number } {
  if (drawing.tool === "horizontal") {
    return {
      height: 2 + padding * 2,
      width: 100,
      x: 0,
      y: clamp(drawing.start.y - padding - 1, 0, 100),
    };
  }
  if (isPointDrawingTool(drawing.tool)) {
    return {
      height: 6 + padding * 2,
      width: 6 + padding * 2,
      x: clamp(drawing.start.x - padding - 3, 0, 100),
      y: clamp(drawing.start.y - padding - 3, 0, 100),
    };
  }
  const minX = Math.min(drawing.start.x, drawing.end.x);
  const minY = Math.min(drawing.start.y, drawing.end.y);
  const maxX = Math.max(drawing.start.x, drawing.end.x);
  const maxY = Math.max(drawing.start.y, drawing.end.y);
  return {
    height: clamp(maxY - minY + padding * 2, 2, 100),
    width: clamp(maxX - minX + padding * 2, 2, 100),
    x: clamp(minX - padding, 0, 100),
    y: clamp(minY - padding, 0, 100),
  };
}

function drawingZoneStyle(tool: Extract<ChartDrawingTool, "entryZone" | "resistanceZone" | "stopZone" | "supportZone" | "targetZone">): { fill: string; label: string; stroke: string; text: string } {
  if (tool === "supportZone") return { fill: "rgba(34,211,238,0.07)", label: "SUPPORT", stroke: "rgba(34,211,238,0.58)", text: "#a5f3fc" };
  if (tool === "resistanceZone") return { fill: "rgba(244,114,182,0.07)", label: "RESIST", stroke: "rgba(244,114,182,0.58)", text: "#fbcfe8" };
  if (tool === "entryZone") return { fill: "rgba(251,191,36,0.08)", label: "ENTRY", stroke: "rgba(251,191,36,0.62)", text: "#fde68a" };
  if (tool === "stopZone") return { fill: "rgba(244,63,94,0.08)", label: "STOP", stroke: "rgba(251,113,133,0.68)", text: "#fecdd3" };
  return { fill: "rgba(52,211,153,0.075)", label: "TARGET", stroke: "rgba(52,211,153,0.62)", text: "#bbf7d0" };
}

function ChartIntelligenceZoneOverlay({ zones }: { zones: ChartIntelligenceZone[] }) {
  if (!zones.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      {zones.map((zone) => (
        <div
          className={`absolute rounded-xl border ${overlayToneClasses[zone.tone].zone}`}
          key={zone.id}
          style={{
            height: `${zone.heightPct}%`,
            left: `${zone.leftPct}%`,
            top: `${zone.topPct}%`,
            width: `${zone.widthPct}%`,
          }}
        >
          <div className={`absolute left-2 top-2 max-w-[11rem] truncate rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${overlayToneClasses[zone.tone].pill}`}>
            {zone.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartStoryPanel({ points }: { points: ChartStoryPoint[] }) {
  if (!points.length) return null;
  return (
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      {points.slice(0, 4).map((point) => (
        <div className={`rounded-2xl border p-3 ${overlayToneClasses[point.tone].panel}`} key={`${point.family}-${point.title}`}>
          <div className="flex items-center justify-between gap-2">
            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${overlayToneClasses[point.tone].text}`}>{point.title}</div>
            <div className="rounded-full border border-white/10 bg-slate-950/45 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{familyLabel(point.family)}</div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">{point.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ChartWorkflowDock({
  indicatorSeries,
  message,
  summary,
  workspaceLoaded,
  workspaceUpdatedAt,
}: {
  indicatorSeries: ChartIndicatorSeries[];
  message: string | null;
  summary: ChartWorkflowSummary;
  workspaceLoaded: boolean;
  workspaceUpdatedAt: string | null;
}) {
  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Chart-linked intelligence state</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{summary.narrative}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <div className="font-mono text-sm text-slate-100">{summary.activeFamilies}</div>
            Overlays
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <div className="font-mono text-sm text-slate-100">{summary.activeIndicators}</div>
            Indicators
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <div className="font-mono text-sm text-slate-100">{summary.drawingCount}</div>
            Drawings
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <div className="font-mono text-sm text-slate-100">{workspaceLoaded ? "Saved" : "Session"}</div>
            Workspace
          </div>
        </div>
      </div>
      {workspaceUpdatedAt ? (
        <div className="mt-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2 text-[11px] font-semibold text-cyan-100">
          Persistent chart workspace · {formatChartDate(workspaceUpdatedAt)}
        </div>
      ) : null}
      {message ? (
        <div className="mt-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] px-3 py-2 text-[11px] font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}
      {indicatorSeries.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {indicatorSeries.map((series) => (
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${overlayToneClasses[series.tone].pill}`} key={series.id}>
              {series.label}: {series.valueLabel}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SymbolChartModal({
  candles,
  close,
  dataSource,
  defaultIndicators,
  defaultOverlayFamilies,
  defaultPeriod,
  interpretation,
  lastUpdated,
  showHistoricalSignals,
  showResearchLevelsToggle,
  signals,
  symbol,
  tradeLevels,
}: {
  candles: ChartCandle[];
  close: () => void;
  dataSource: string;
  defaultIndicators: ChartIndicatorId[];
  defaultOverlayFamilies: ChartOverlayFamily[];
  defaultPeriod: InteractiveChartPeriod;
  interpretation: string;
  lastUpdated: string | null;
  showHistoricalSignals: boolean;
  showResearchLevelsToggle: boolean;
  signals?: ChartSignalMarker[];
  symbol: string;
  tradeLevels?: ChartTradeLevels;
}) {
  const { authenticated, loading: accountLoading, user } = useCurrentUser();
  const skipNextModalWorkspacePersistRef = useRef(false);
  const [detailMode, setDetailMode] = useState<ChartDetailMode>("overlays");
  const [layoutMode, setLayoutMode] = useState<ChartLayoutMode>("focus");
  const [modalChartTabs, setModalChartTabs] = useState<ChartWorkspaceTab[]>([]);
  const [modalCommandPaletteOpen, setModalCommandPaletteOpen] = useState(false);
  const [modalCompactMode, setModalCompactMode] = useState(false);
  const [modalPeriod, setModalPeriod] = useState<InteractiveChartPeriod>(defaultPeriod);
  const [modalOverlayFamilies, setModalOverlayFamilies] = useState<ChartOverlayFamily[]>(defaultOverlayFamilies);
  const [modalIndicators, setModalIndicators] = useState<ChartIndicatorId[]>(defaultIndicators);
  const [modalToolbarCollapsed, setModalToolbarCollapsed] = useState(false);
  const [modalWorkspaceLoaded, setModalWorkspaceLoaded] = useState(false);
  const normalizedSignals = useMemo(() => (showHistoricalSignals ? filterSignalsByCandles(normalizeSignals(signals ?? []), candles) : []), [candles, showHistoricalSignals, signals]);
  const chartLevels = useMemo(() => normalizeTradeLevels(tradeLevels), [tradeLevels]);
  const markerSummary = markerGroupSummary(normalizedSignals);
  const markerEvidence = normalizedSignals.slice(-14).reverse();
  const storyPoints = useMemo(() => buildChartStoryPoints(candles, normalizedSignals, chartLevels), [candles, chartLevels, normalizedSignals]);
  const compareRows = useMemo(() => buildChartCompareRows(candles, normalizedSignals, chartLevels), [candles, chartLevels, normalizedSignals]);
  const levelSummary = tradeLevelSummary(tradeLevels);

  function applyModalWorkspace(workspace: ChartWorkflowWorkspace): void {
    setModalChartTabs(workspace.chartTabs);
    setModalCompactMode(workspace.compactMode);
    setDetailMode(workspace.detailMode);
    setLayoutMode(workspace.layoutMode);
    setModalPeriod(workspace.period);
    setModalOverlayFamilies(workspace.overlayFamilies);
    setModalIndicators(workspace.indicators);
    setModalToolbarCollapsed(workspace.toolbarCollapsed);
  }

  function saveModalWorkspaceNow(): void {
    const saved = writeChartWorkflowWorkspace(symbol, {
      detailMode,
      chartTabs: modalChartTabs,
      compactMode: modalCompactMode,
      fullscreenOpen: true,
      indicators: modalIndicators,
      layoutMode,
      overlayFamilies: modalOverlayFamilies,
      period: modalPeriod,
      toolbarCollapsed: modalToolbarCollapsed,
    });
    if (!accountLoading && authenticated && user && saved) {
      void saveAccountChartWorkflowWorkspace(symbol, saved).catch(() => undefined);
    }
  }

  function resetModalWorkspace(): void {
    const nextWorkspace = {
      ...defaultChartWorkflowWorkspace(),
      fullscreenOpen: true,
      updatedAt: new Date().toISOString(),
    };
    skipNextModalWorkspacePersistRef.current = true;
    applyModalWorkspace(nextWorkspace);
    replaceChartWorkflowWorkspace(symbol, nextWorkspace);
    if (!accountLoading && authenticated && user) {
      void saveAccountChartWorkflowWorkspace(symbol, nextWorkspace).catch(() => undefined);
    }
  }

  function saveModalChartTab(): void {
    const now = new Date().toISOString();
    const label = `${symbol.toUpperCase()} ${modalPeriod} ${layoutMode}`;
    const tab: ChartWorkspaceTab = {
      detailMode,
      id: `tab-${symbol.toLowerCase()}-${modalPeriod}-${layoutMode}-${Date.now().toString(36)}`,
      indicators: [...modalIndicators],
      label,
      layoutMode,
      overlayFamilies: [...modalOverlayFamilies],
      period: modalPeriod,
      symbol: symbol.toUpperCase(),
      updatedAt: now,
    };
    setModalChartTabs((current) => [...current.filter((item) => item.id !== tab.id), tab].slice(-8));
  }

  function applyModalChartTab(tab: ChartWorkspaceTab): void {
    setDetailMode(tab.detailMode);
    setLayoutMode(tab.layoutMode);
    setModalPeriod(tab.period);
    setModalIndicators(tab.indicators);
    setModalOverlayFamilies(tab.overlayFamilies);
  }

  function deleteModalChartTab(tabId: string): void {
    setModalChartTabs((current) => current.filter((tab) => tab.id !== tabId));
  }

  useEffect(() => {
    const workspace = readChartWorkflowWorkspace(symbol);
    skipNextModalWorkspacePersistRef.current = true;
    if (workspace) applyModalWorkspace(workspace);
    setModalWorkspaceLoaded(true);
  // This effect restores the modal workspace once for the opened symbol.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (!modalWorkspaceLoaded || accountLoading) return undefined;
    if (!authenticated || !user) return undefined;
    let cancelled = false;
    void fetchAccountChartWorkflowWorkspace(symbol)
      .then((result) => {
        if (cancelled) return;
        const localWorkspace = readChartWorkflowWorkspace(symbol);
        const nextWorkspace = mergeLocalAndAccountChartWorkspace(localWorkspace, result.workspace);
        if (nextWorkspace) {
          skipNextModalWorkspacePersistRef.current = true;
          applyModalWorkspace(nextWorkspace);
          replaceChartWorkflowWorkspace(symbol, nextWorkspace);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  // Account modal sync intentionally hydrates once per account + symbol.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountLoading, authenticated, modalWorkspaceLoaded, symbol, user?.id]);

  useEffect(() => {
    if (!modalWorkspaceLoaded) return;
    if (skipNextModalWorkspacePersistRef.current) {
      skipNextModalWorkspacePersistRef.current = false;
      return undefined;
    }
    const saved = writeChartWorkflowWorkspace(symbol, {
      chartTabs: modalChartTabs,
      compactMode: modalCompactMode,
      detailMode,
      fullscreenOpen: true,
      indicators: modalIndicators,
      layoutMode,
      overlayFamilies: modalOverlayFamilies,
      period: modalPeriod,
      toolbarCollapsed: modalToolbarCollapsed,
    });
    if (!accountLoading && authenticated && user && saved) {
      const timeout = window.setTimeout(() => {
        void saveAccountChartWorkflowWorkspace(symbol, saved).catch(() => undefined);
      }, 450);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [accountLoading, authenticated, detailMode, layoutMode, modalChartTabs, modalCompactMode, modalIndicators, modalOverlayFamilies, modalPeriod, modalToolbarCollapsed, modalWorkspaceLoaded, symbol, user]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.altKey || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setModalCommandPaletteOpen(true);
        return;
      }
      if (event.ctrlKey || event.metaKey) return;
      if (key === "/" || key === "?") {
        event.preventDefault();
        setModalCommandPaletteOpen(true);
        return;
      }
      if (key === "escape" && modalCommandPaletteOpen) {
        event.preventDefault();
        setModalCommandPaletteOpen(false);
        return;
      }
      const rangeIndex = Number.parseInt(key, 10) - 1;
      if (rangeIndex >= 0 && rangeIndex < INTERACTIVE_CHART_PERIODS.length) {
        event.preventDefault();
        setModalPeriod(INTERACTIVE_CHART_PERIODS[rangeIndex]!);
        return;
      }
      if (key === "c") {
        event.preventDefault();
        setDetailMode("compare");
        return;
      }
      if (key === "t") {
        event.preventDefault();
        setDetailMode("timeline");
        return;
      }
      if (key === "o") {
        event.preventDefault();
        setDetailMode("overlays");
        return;
      }
      if (key === "l") {
        event.preventDefault();
        setLayoutMode((current) => current === "focus" ? "split" : current === "split" ? "stack" : "focus");
        return;
      }
      if (key === "f") {
        event.preventDefault();
        close();
        return;
      }
      if (key === "i") {
        event.preventDefault();
        setModalIndicators((current) => current.length ? [] : [...DEFAULT_CHART_INDICATORS]);
        return;
      }
      if (key === ",") {
        event.preventDefault();
        setModalCompactMode((current) => !current);
        return;
      }
      if (key === "s") {
        event.preventDefault();
        saveModalWorkspaceNow();
        return;
      }
      if (key === "r" && event.shiftKey) {
        event.preventDefault();
        resetModalWorkspace();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [accountLoading, authenticated, close, detailMode, layoutMode, modalCommandPaletteOpen, modalIndicators, modalOverlayFamilies, modalPeriod, symbol, user]);

  return (
    <StableDetailOverlay
      analyticsSurface="symbol_chart"
      className="max-w-[min(100vw,1440px)] sm:max-w-[min(96vw,1440px)]"
      closeLabel="Close expanded chart"
      description={interpretation}
      eyebrow="Symbol chart detail"
      onClose={close}
      open
      size="xl"
      title={`${symbol.toUpperCase()} Price + Intelligence Overlays`}
    >
      <div
        className="tv-chart-fullscreen-toolbar mt-4"
        data-chart-fullscreen-layout={layoutMode}
        data-chart-fullscreen-mode={detailMode}
        data-chart-fullscreen-toolbar="true"
        data-chart-fullscreen-workspace-loaded={modalWorkspaceLoaded ? "true" : "false"}
      >
        <div className="tv-chart-toolbar-row flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap gap-1.5">
            {(["overlays", "compare", "timeline"] as const).map((mode) => (
              <button
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                  detailMode === mode
                    ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
                }`}
                key={mode}
                onClick={() => {
                  const startedAt = browserWorkflowNow();
                  setDetailMode(mode);
                  recordBrowserWorkflowMetric("chart:toolbar-interaction", startedAt);
                }}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap gap-1">
              {(["focus", "split", "grid", "stack"] as const).map((mode) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    layoutMode === mode
                      ? "border-violet-300/55 bg-violet-300/12 text-violet-100"
                      : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
                  }`}
                  key={mode}
                  onClick={() => {
                    const startedAt = browserWorkflowNow();
                    setLayoutMode(mode);
                    recordBrowserWorkflowMetric("chart:toolbar-interaction", startedAt);
                  }}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100"
              onClick={() => setModalCommandPaletteOpen(true)}
              type="button"
            >
              <Keyboard className="h-3.5 w-3.5" />
              Command
            </button>
            <button
              aria-pressed={modalCompactMode}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                modalCompactMode
                  ? "border-emerald-300/45 bg-emerald-300/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-emerald-300/40 hover:text-emerald-100"
              }`}
              onClick={() => {
                const startedAt = browserWorkflowNow();
                setModalCompactMode((current) => !current);
                recordBrowserWorkflowMetric("chart:toolbar-interaction", startedAt);
              }}
              type="button"
            >
              Compact
            </button>
            <button
              aria-expanded={!modalToolbarCollapsed}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100"
              onClick={() => {
                const startedAt = browserWorkflowNow();
                setModalToolbarCollapsed((current) => !current);
                recordBrowserWorkflowMetric("chart:toolbar-interaction", startedAt);
              }}
              title={modalToolbarCollapsed ? "Show fullscreen toolbar" : "Collapse fullscreen toolbar"}
              type="button"
            >
              {modalToolbarCollapsed ? <PanelTopOpen className="h-3.5 w-3.5" /> : <PanelTopClose className="h-3.5 w-3.5" />}
            </button>
            <div className="text-xs text-slate-500">Fullscreen exploration · synchronized state · research only</div>
          </div>
        </div>
        {!modalToolbarCollapsed ? <div className="tv-chart-toolbar-row mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Synchronized chart state</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">Timeframe, overlays, and indicators stay linked across fullscreen chart panes.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INTERACTIVE_CHART_PERIODS.map((range) => (
                <button
                  className={`min-h-9 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition sm:min-h-0 sm:px-2.5 ${
                    range === modalPeriod
                      ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
                  }`}
                  key={range}
                  onClick={() => setModalPeriod(range)}
                  type="button"
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div> : null}
        {!modalToolbarCollapsed ? (
          <ChartWorkspaceTabs
            onApply={applyModalChartTab}
            onDelete={deleteModalChartTab}
            onSave={saveModalChartTab}
            tabs={modalChartTabs}
          />
        ) : null}
      </div>
      <div className="mt-4">
        <ChartLayoutExplorer
          candles={candles}
          compactMode={modalCompactMode}
          dataSource={dataSource}
          indicators={modalIndicators}
          interpretation={interpretation}
          lastUpdated={lastUpdated}
          layoutMode={layoutMode}
          onIndicatorsChange={setModalIndicators}
          onOverlayFamiliesChange={setModalOverlayFamilies}
          onPeriodChange={setModalPeriod}
          overlayFamilies={modalOverlayFamilies}
          period={modalPeriod}
          showHistoricalSignals={showHistoricalSignals}
          showResearchLevelsToggle={showResearchLevelsToggle}
          signals={signals}
          symbol={symbol}
          tradeLevels={tradeLevels}
        />
      </div>
      <ChartModalModePanel compareRows={compareRows} mode={detailMode} storyPoints={storyPoints} timelineMarkers={markerEvidence} />
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <ChartDetailTile label="Data source" value={dataSource} detail="Stored validated OHLC history only. No seeded or synthetic candles are drawn." />
        <ChartDetailTile label="Research levels" value={levelSummary.value} detail={levelSummary.detail} />
        <ChartDetailTile label="Intelligence markers" value={showHistoricalSignals ? `${normalizedSignals.length} available` : "Hidden"} detail={markerSummary.length ? markerSummary.join(" · ") : "Markers appear only when real scanner, freshness, replay, or risk context exists."} />
        <ChartDetailTile label="Last updated" value={lastUpdated ? formatChartDate(lastUpdated) : "Unavailable"} detail="Timestamp comes from the latest validated chart point or scanner payload." />
      </div>
      <ChartMarkerEvidenceList markers={markerEvidence} />
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-500">
        Research only. Entry, stop, target, confidence, risk, replay, and freshness overlays are context for investigation, not a recommendation to buy or sell.
      </div>
      <ChartCommandPalette
        commands={[
          { action: saveModalWorkspaceNow, detail: "Persist fullscreen layout, timeframe, indicators, and overlays.", label: "Save fullscreen workspace", shortcut: "S" },
          { action: saveModalChartTab, detail: "Save the current fullscreen mode as a reusable chart tab.", label: "Save chart tab", shortcut: "Tab" },
          { action: () => setModalCompactMode((current) => !current), detail: modalCompactMode ? "Return panes to full working height." : "Reduce chart pane height for faster review.", label: modalCompactMode ? "Disable compact chart" : "Enable compact chart", shortcut: "," },
          { action: () => setLayoutMode((current) => current === "focus" ? "split" : current === "split" ? "grid" : current === "grid" ? "stack" : "focus"), detail: "Cycle focus, split, grid, and stack layouts.", label: "Cycle layout", shortcut: "L" },
          { action: () => setDetailMode("compare"), detail: "Open the compare evidence panel.", label: "Compare mode", shortcut: "C" },
          { action: () => setDetailMode("timeline"), detail: "Open replay and marker timeline.", label: "Timeline mode", shortcut: "T" },
          { action: () => setModalIndicators((current) => current.length ? [] : [...DEFAULT_CHART_INDICATORS]), detail: "Toggle the default indicator stack.", label: "Toggle indicators", shortcut: "I" },
          { action: resetModalWorkspace, detail: "Restore the default fullscreen chart workspace.", label: "Reset fullscreen workspace", shortcut: "Shift+R" },
        ]}
        onClose={() => setModalCommandPaletteOpen(false)}
        open={modalCommandPaletteOpen}
      />
    </StableDetailOverlay>
  );
}

function ChartWorkspaceTabs({
  onApply,
  onDelete,
  onSave,
  tabs,
}: {
  onApply: (tab: ChartWorkspaceTab) => void;
  onDelete: (tabId: string) => void;
  onSave: () => void;
  tabs: ChartWorkspaceTab[];
}) {
  return (
    <div className="tv-chart-toolbar-row mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Chart tabs</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Saved fullscreen tabs restore layout, timeframe, overlays, and indicators for this workspace.</p>
        </div>
        <button
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-300/45 hover:text-emerald-50"
          onClick={onSave}
          type="button"
        >
          <Save className="h-3.5 w-3.5" />
          Save tab
        </button>
      </div>
      {tabs.length ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {tabs.map((tab) => (
            <div className="flex shrink-0 items-center gap-1" key={tab.id}>
              <button
                className="min-h-10 rounded-full border border-violet-300/20 bg-violet-300/[0.06] px-3 py-1.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-violet-100 transition hover:border-violet-300/45"
                onClick={() => onApply(tab)}
                title={`${tab.period} · ${tab.layoutMode} · ${tab.indicators.length} indicators`}
                type="button"
              >
                {tab.label}
              </button>
              <button
                aria-label={`Delete ${tab.label} chart tab`}
                className="grid h-9 w-9 place-items-center rounded-full border border-rose-300/20 bg-white/[0.035] text-slate-500 transition hover:border-rose-300/50 hover:text-rose-100"
                onClick={() => onDelete(tab.id)}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-slate-500">No saved chart tabs yet.</div>
      )}
    </div>
  );
}

function ChartLayoutExplorer({
  candles,
  compactMode,
  dataSource,
  indicators,
  interpretation,
  lastUpdated,
  layoutMode,
  onIndicatorsChange,
  onOverlayFamiliesChange,
  onPeriodChange,
  overlayFamilies,
  period,
  showHistoricalSignals,
  showResearchLevelsToggle,
  signals,
  symbol,
  tradeLevels,
}: {
  candles: ChartCandle[];
  compactMode: boolean;
  dataSource: string;
  indicators: ChartIndicatorId[];
  interpretation: string;
  lastUpdated: string | null;
  layoutMode: ChartLayoutMode;
  onIndicatorsChange: (indicators: ChartIndicatorId[]) => void;
  onOverlayFamiliesChange: (families: ChartOverlayFamily[]) => void;
  onPeriodChange: (period: InteractiveChartPeriod) => void;
  overlayFamilies: ChartOverlayFamily[];
  period: InteractiveChartPeriod;
  showHistoricalSignals: boolean;
  showResearchLevelsToggle: boolean;
  signals?: ChartSignalMarker[];
  symbol: string;
  tradeLevels?: ChartTradeLevels;
}) {
  const riskMacroFamilies: ChartOverlayFamily[] = ["macro", "risk", "events", "memory", "replay"];
  const replayMemoryFamilies: ChartOverlayFamily[] = ["replay", "memory", "confidence", "levels"];
  const crosshairSyncGroup = layoutMode === "focus" ? undefined : `symbol-chart:${symbol}:${layoutMode}`;
  const primaryHeight = compactMode ? 340 : 460;
  const splitHeight = compactMode ? 320 : 420;
  const gridHeight = compactMode ? 240 : 300;
  const stackPrimaryHeight = compactMode ? 300 : 360;
  const stackSecondaryHeight = compactMode ? 240 : 300;
  const sharedProps = {
    candles,
    controlledIndicators: indicators,
    controlledOverlayFamilies: overlayFamilies,
    controlledPeriod: period,
    crosshairSyncGroup,
    dataSource,
    defaultPeriod: period,
    enableAccountSync: false,
    expandable: false,
    interpretation,
    lastUpdated,
    onIndicatorsChange,
    onOverlayFamiliesChange,
    onPeriodChange,
    showHistoricalSignals,
    showHeaderBadge: false,
    showResearchLevelsToggle,
    signals,
    symbol,
    tradeLevels,
  } satisfies Omit<SymbolChartProps, "height">;

  if (layoutMode === "split") {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.68fr)]">
        <div className="rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.025] p-3">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Primary chart lane</div>
          <SymbolChart {...sharedProps} height={splitHeight} />
        </div>
        <div className="rounded-3xl border border-rose-300/12 bg-rose-300/[0.025] p-3">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-rose-200">Risk / macro lane</div>
          <SymbolChart
            {...sharedProps}
            controlledIndicators={indicators.includes("rangePressure") ? indicators : [...indicators, "rangePressure"]}
            controlledOverlayFamilies={riskMacroFamilies.filter((family) => overlayFamilies.includes(family))}
            enableTimeframeSwitching={false}
            height={splitHeight}
            showDrawingTools={false}
          />
        </div>
      </div>
    );
  }

  if (layoutMode === "grid") {
    const gridPanes: Array<{
      families: ChartOverlayFamily[];
      indicators: ChartIndicatorId[];
      label: string;
      tone: string;
    }> = [
      { families: overlayFamilies, indicators, label: "Primary research pane", tone: "border-cyan-300/12 bg-cyan-300/[0.025] text-cyan-200" },
      { families: riskMacroFamilies.filter((family) => overlayFamilies.includes(family)), indicators: indicators.includes("rangePressure") ? indicators : [...indicators, "rangePressure"], label: "Risk / macro pane", tone: "border-rose-300/12 bg-rose-300/[0.025] text-rose-200" },
      { families: replayMemoryFamilies.filter((family) => overlayFamilies.includes(family)), indicators: indicators.filter((indicator) => indicator !== "rangePressure"), label: "Replay / memory pane", tone: "border-violet-300/12 bg-violet-300/[0.025] text-violet-200" },
      { families: overlayFamilies.filter((family) => family === "levels" || family === "confidence" || family === "events"), indicators: uniqueIndicators(["sma20", "ema20", "atr14", ...indicators]), label: "Levels / catalyst pane", tone: "border-amber-300/12 bg-amber-300/[0.025] text-amber-200" },
    ];
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {gridPanes.map((pane) => (
          <div className={`rounded-3xl border p-3 ${pane.tone}`} key={pane.label}>
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em]">{pane.label}</div>
            <SymbolChart
              {...sharedProps}
              controlledIndicators={pane.indicators}
              controlledOverlayFamilies={pane.families}
              enableTimeframeSwitching={false}
              height={gridHeight}
              showDrawingTools={pane.label === "Primary research pane"}
            />
          </div>
        ))}
      </div>
    );
  }

  if (layoutMode === "stack") {
    return (
      <div className="grid gap-4">
        <div className="rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.025] p-3">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Price + indicator pane</div>
          <SymbolChart {...sharedProps} height={stackPrimaryHeight} />
        </div>
        <div className="rounded-3xl border border-violet-300/12 bg-violet-300/[0.025] p-3">
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Replay / memory pane</div>
          <SymbolChart
            {...sharedProps}
            controlledIndicators={indicators.filter((indicator) => indicator !== "rangePressure")}
            controlledOverlayFamilies={replayMemoryFamilies.filter((family) => overlayFamilies.includes(family))}
            enableTimeframeSwitching={false}
            height={stackSecondaryHeight}
            showDrawingTools={false}
          />
        </div>
      </div>
    );
  }

  return (
    <SymbolChart
      {...sharedProps}
      height={primaryHeight}
    />
  );
}

function ChartModalModePanel({
  compareRows,
  mode,
  storyPoints,
  timelineMarkers,
}: {
  compareRows: ChartCompareRow[];
  mode: ChartDetailMode;
  storyPoints: ChartStoryPoint[];
  timelineMarkers: ChartSignalMarker[];
}) {
  if (mode === "compare") {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Compare mode</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">Price, risk, macro, replay, and level context are synchronized against the same validated timeframe.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {compareRows.map((row) => (
            <div className={`rounded-2xl border p-3 ${overlayToneClasses[row.tone].panel}`} key={row.label}>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{row.label}</div>
              <div className={`mt-2 font-mono text-xl font-black ${overlayToneClasses[row.tone].text}`}>{row.value}</div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">{row.detail}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "timeline") {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Replay timeline</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">A chronological evidence layer for replay, macro, risk, confidence, event, and memory markers.</p>
        {timelineMarkers.length ? (
          <div className="mt-4 space-y-2">
            {timelineMarkers.slice().reverse().map((marker, index) => {
              const family = overlayFamilyForMarker(marker.type);
              const tone = toneForFamily(family);
              return (
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 sm:grid-cols-[120px_minmax(0,1fr)]" key={`${marker.time}-${marker.type}-${marker.text ?? index}`}>
                  <div className="font-mono text-xs font-black text-slate-400">{formatChartDate(marker.time)}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${overlayToneClasses[tone].pill}`}>{marker.text ?? markerTypeLabel(marker.type)}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{familyLabel(family)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{marker.source ?? marker.uncertainty ?? "Validated chart evidence."}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">No synchronized marker timeline exists for this chart range yet.</div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Why this chart matters</div>
      <ChartStoryPanel points={storyPoints} />
    </div>
  );
}

function ChartMarkerEvidenceList({ markers }: { markers: ChartSignalMarker[] }) {
  if (!markers.length) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Overlay evidence</div>
        <p className="mt-2 text-xs leading-5 text-slate-400">No intelligence markers are visible for this chart range. TradeVeto does not draw replay, risk, macro, or confidence overlays without source data.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Overlay evidence</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">Latest real marker sources shown first. These explain why each overlay appears.</p>
        </div>
        <div className="text-[11px] text-slate-500">Max 10 recent markers</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {markers.map((marker, index) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3" key={`${marker.time}-${marker.type}-${marker.text ?? index}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
                {marker.text ?? markerTypeLabel(marker.type)}
              </span>
              <span className="font-mono text-[11px] text-slate-500">{formatChartDate(marker.time)}</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-200">{marker.source ?? "validated chart context"}</div>
            {marker.uncertainty ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{marker.uncertainty}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartOverlaySummary({
  dataSource,
  hasTradeLevels,
  markerGroups,
  showHistoricalSignals,
}: {
  dataSource: string;
  hasTradeLevels: boolean;
  markerGroups: string[];
  showHistoricalSignals: boolean;
}) {
  const chips = [
    hasTradeLevels ? "Entry / stop / target context" : null,
    showHistoricalSignals && markerGroups.length ? markerGroups.join(" · ") : null,
    showHistoricalSignals && !markerGroups.length ? "No visible intelligence markers in this range" : null,
  ].filter((chip): chip is string => Boolean(chip));

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.length ? chips.map((chip) => (
          <span className="rounded-full border border-white/10 bg-slate-950/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-100" key={chip}>
            {chip}
          </span>
        )) : (
          <span className="rounded-full border border-white/10 bg-slate-950/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Price history only
          </span>
        )}
      </div>
      <div className="text-[11px] text-slate-500">Source: {dataSource}</div>
    </div>
  );
}

function ChartDetailTile({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-base font-black text-slate-50">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

const overlayToneClasses: Record<ChartIntelligenceTone, { active: string; panel: string; pill: string; text: string; zone: string }> = {
  amber: {
    active: "border-amber-300/55 bg-amber-300/12 text-amber-100 shadow-amber-950/20",
    panel: "border-amber-300/15 bg-amber-300/[0.035]",
    pill: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    text: "text-amber-200",
    zone: "border-amber-300/20 bg-amber-300/[0.075] shadow-[inset_0_0_32px_rgba(251,191,36,0.10)]",
  },
  cyan: {
    active: "border-cyan-300/55 bg-cyan-300/12 text-cyan-100 shadow-cyan-950/20",
    panel: "border-cyan-300/15 bg-cyan-300/[0.035]",
    pill: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    text: "text-cyan-200",
    zone: "border-cyan-300/20 bg-cyan-300/[0.07] shadow-[inset_0_0_32px_rgba(34,211,238,0.10)]",
  },
  emerald: {
    active: "border-emerald-300/55 bg-emerald-300/12 text-emerald-100 shadow-emerald-950/20",
    panel: "border-emerald-300/15 bg-emerald-300/[0.035]",
    pill: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    text: "text-emerald-200",
    zone: "border-emerald-300/20 bg-emerald-300/[0.065] shadow-[inset_0_0_32px_rgba(52,211,153,0.10)]",
  },
  rose: {
    active: "border-rose-300/55 bg-rose-300/12 text-rose-100 shadow-rose-950/20",
    panel: "border-rose-300/15 bg-rose-300/[0.035]",
    pill: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    text: "text-rose-200",
    zone: "border-rose-300/20 bg-rose-300/[0.075] shadow-[inset_0_0_32px_rgba(251,113,133,0.11)]",
  },
  violet: {
    active: "border-violet-300/55 bg-violet-300/12 text-violet-100 shadow-violet-950/20",
    panel: "border-violet-300/15 bg-violet-300/[0.035]",
    pill: "border-violet-300/25 bg-violet-300/10 text-violet-100",
    text: "text-violet-200",
    zone: "border-violet-300/20 bg-violet-300/[0.075] shadow-[inset_0_0_32px_rgba(192,132,252,0.10)]",
  },
};

function markerGroupSummary(signals: ChartSignalMarker[]): string[] {
  const counts = new Map<ChartSignalMarkerType, number>();
  for (const signal of signals) {
    counts.set(signal.type, (counts.get(signal.type) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([type, count]) => `${markerTypeLabel(type)} ${count}`);
}

function markerTypeLabel(type: ChartSignalMarkerType): string {
  if (type === "BREAKOUT") return "breakout";
  if (type === "CONFIDENCE") return "score";
  if (type === "CONTRADICTION") return "contradiction";
  if (type === "ENTER") return "entry";
  if (type === "EXIT") return "exit";
  if (type === "EVENT") return "event";
  if (type === "FAILURE") return "failure";
  if (type === "FRESHNESS") return "freshness";
  if (type === "MACRO") return "macro";
  if (type === "MEMORY") return "memory";
  if (type === "REPLAY") return "replay";
  if (type === "RISK") return "risk";
  if (type === "SHOCK") return "shock";
  if (type === "STALE") return "stale";
  if (type === "STOP") return "stop";
  if (type === "TARGET") return "target";
  if (type === "VOLATILITY") return "volatility";
  if (type === "WAIT") return "wait";
  return "alert";
}

function drawingToolLabel(tool: ChartDrawing["tool"]): string {
  if (tool === "entryZone") return "Entry zone";
  if (tool === "horizontal") return "Horizontal level";
  if (tool === "marker") return "Marker";
  if (tool === "range") return "Range";
  if (tool === "resistanceZone") return "Resistance zone";
  if (tool === "riskBox") return "Risk box";
  if (tool === "ruler") return "Ruler";
  if (tool === "stopZone") return "Stop zone";
  if (tool === "supportZone") return "Support zone";
  if (tool === "targetZone") return "Target zone";
  if (tool === "trendline") return "Trendline";
  return "Annotation";
}

function drawingReferenceY(drawing: ChartDrawing): number {
  if (drawing.tool === "horizontal" || drawing.tool === "annotation" || drawing.tool === "marker") return drawing.start.y;
  if (drawing.tool.endsWith("Zone")) return (drawing.start.y + drawing.end.y) / 2;
  return (drawing.start.y + drawing.end.y) / 2;
}

function priceFromDrawingY(candles: ChartCandle[], y: number): number | null {
  if (!candles.length) return null;
  const lows = candles.map((candle) => candle.low).filter((value) => Number.isFinite(value));
  const highs = candles.map((candle) => candle.high).filter((value) => Number.isFinite(value));
  if (!lows.length || !highs.length) return null;
  const minLow = Math.min(...lows);
  const maxHigh = Math.max(...highs);
  if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh) || maxHigh <= minLow) return null;
  return maxHigh - (clamp(y, 0, 100) / 100) * (maxHigh - minLow);
}

function formatChartMoney(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2, style: "currency" });
}

function normalizeSymbolSequence(symbols: string[], fallbackSymbol: string): string[] {
  const sequence: string[] = [];
  for (const rawSymbol of [fallbackSymbol, ...symbols]) {
    const symbol = rawSymbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
    if (symbol && !sequence.includes(symbol)) sequence.push(symbol);
  }
  return sequence;
}

function slugifyChartId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "template";
}

function tradeLevelSummary(levels?: ChartTradeLevels): { detail: string; value: string } {
  if (!levels) {
    return {
      detail: "No validated entry, stop, or target context exists for this chart.",
      value: "Unavailable",
    };
  }
  const count = [levels.entry, levels.entryLow, levels.entryHigh, levels.stop, levels.target]
    .filter((value) => typeof value === "number" && Number.isFinite(value)).length;
  if (!count) {
    return {
      detail: "No validated entry, stop, or target context exists for this chart.",
      value: "Unavailable",
    };
  }
  return {
    detail: "Research-only levels come from scanner trade context and are never generated when source values are missing.",
    value: `${count} real level${count === 1 ? "" : "s"}`,
  };
}

function filterCandlesByPeriod(candles: ChartCandle[], period: InteractiveChartPeriod): ChartCandle[] {
  if (!candles.length) return [];
  const dated = candles
    .map((candle) => ({ candle, time: Date.parse(candle.time) }))
    .filter((item): item is { candle: ChartCandle; time: number } => Number.isFinite(item.time))
    .sort((left, right) => left.time - right.time);
  const latest = dated[dated.length - 1]?.time;
  if (latest === undefined) return [];
  const days = period === "1d" ? 1 : period === "1wk" ? 7 : period === "1mo" ? 31 : period === "3mo" ? 93 : period === "6mo" ? 186 : period === "5y" ? 365 * 5 + 2 : 365;
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return dated.filter((item) => item.time >= cutoff).map((item) => item.candle);
}

function filterSignalsByCandles(signals: ChartSignalMarker[], candles: ChartCandle[]): ChartSignalMarker[] {
  if (!signals.length || !candles.length) return [];
  const first = candles[0]?.time;
  const last = candles[candles.length - 1]?.time;
  if (!first || !last) return [];
  return signals.filter((signal) => signal.time >= first && signal.time <= last);
}

function summarizeCandles(candles: ChartCandle[]): { changePct: number | null; label: string; tone: "down" | "flat" | "up" } {
  const first = candles[0]?.close;
  const last = candles[candles.length - 1]?.close;
  if (typeof first !== "number" || typeof last !== "number" || !Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
    return { changePct: null, label: "Limited data", tone: "flat" };
  }
  const changePct = ((last - first) / first) * 100;
  const label = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
  return {
    changePct,
    label,
    tone: Math.abs(changePct) < 0.25 ? "flat" : changePct > 0 ? "up" : "down",
  };
}

function buildDefaultChartInterpretation(symbol: string, move: { changePct: number | null; tone: "down" | "flat" | "up" }): string {
  if (move.changePct === null) return `${symbol.toUpperCase()} has insufficient validated price history for the selected chart range.`;
  if (move.tone === "up") return `${symbol.toUpperCase()} is rising in the selected validated range. Use the move with TradeVeto risk, replay, and regime context.`;
  if (move.tone === "down") return `${symbol.toUpperCase()} is weakening in the selected validated range. Review risk pressure and setup quality before interpreting the move.`;
  return `${symbol.toUpperCase()} is mostly flat in the selected validated range. Watch for stronger confirmation before overreading the chart.`;
}

function formatChartDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value.slice(0, 16);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function uniqueIndicators(indicators: ChartIndicatorId[]): ChartIndicatorId[] {
  const unique: ChartIndicatorId[] = [];
  for (const indicator of indicators) {
    if (!unique.includes(indicator)) unique.push(indicator);
  }
  return unique;
}

function nudgeDrawing(drawing: ChartDrawing, deltaX: number, deltaY: number): ChartDrawing {
  return {
    ...drawing,
    end: nudgePoint(drawing.end, deltaX, deltaY),
    start: nudgePoint(drawing.start, deltaX, deltaY),
  };
}

function nudgePoint(point: ChartDrawingPoint, deltaX: number, deltaY: number): ChartDrawingPoint {
  return {
    x: clamp(point.x + deltaX, 0, 100),
    y: clamp(point.y + deltaY, 0, 100),
  };
}

function resizeDrawingAtAnchor(drawing: ChartDrawing, anchor: "end" | "start", point: ChartDrawingPoint): ChartDrawing {
  if (isPointDrawingTool(drawing.tool)) {
    return {
      ...drawing,
      end: point,
      start: point,
    };
  }
  if (drawing.tool === "horizontal") {
    const nextPoint = { x: drawing.start.x, y: point.y };
    return {
      ...drawing,
      end: { x: drawing.end.x, y: point.y },
      start: nextPoint,
    };
  }
  return {
    ...drawing,
    [anchor]: point,
  };
}

function snapChartPoint(point: ChartDrawingPoint): ChartDrawingPoint {
  return {
    x: clamp(Math.round(point.x / 2.5) * 2.5, 0, 100),
    y: clamp(Math.round(point.y / 2.5) * 2.5, 0, 100),
  };
}

function chartAlertTypeLabel(type: ChartAlertRuleType): string {
  if (type === "price_above") return "Price above";
  if (type === "price_below") return "Price below";
  if (type === "score_above") return "Score above";
  return "Score below";
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
    const metricsWindow = window as Window & { __tradevetoBrowserWorkflowMetrics?: BrowserWorkflowMetric[] };
    metricsWindow.__tradevetoBrowserWorkflowMetrics = [...(metricsWindow.__tradevetoBrowserWorkflowMetrics ?? []), nextMetric].slice(-120);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
}

function formatChartAlertThreshold(value: number, type: ChartAlertRuleType): string {
  return type.startsWith("score") ? value.toFixed(0) : formatChartMoney(value);
}

function dispatchChartCrosshairSync(payload: ChartCrosshairSyncPayload): void {
  window.dispatchEvent(new CustomEvent(CHART_CROSSHAIR_SYNC_EVENT, { detail: payload }));
}

function isChartCrosshairSyncPayload(value: unknown): value is ChartCrosshairSyncPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ChartCrosshairSyncPayload>;
  return typeof payload.group === "string"
    && typeof payload.sourceId === "string"
    && typeof payload.symbol === "string"
    && (payload.price === null || typeof payload.price === "number")
    && (payload.time === null || payload.time !== undefined);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
