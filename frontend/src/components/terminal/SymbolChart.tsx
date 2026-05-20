"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Expand, RotateCcw } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
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
  CHART_OVERLAY_FAMILIES,
  DEFAULT_CHART_OVERLAY_FAMILIES,
  buildChartCompareRows,
  buildChartIntelligenceZones,
  buildChartStoryPoints,
  familyLabel,
  overlayFamilyForMarker,
  toneForFamily,
  type ChartCompareRow,
  type ChartIntelligenceTone,
  type ChartIntelligenceZone,
  type ChartOverlayFamily,
  type ChartStoryPoint,
} from "./chart-intelligence-overlays";
import { EmptyState } from "./ui/EmptyState";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
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
  enableTimeframeSwitching?: boolean;
  expandable?: boolean;
  interpretation?: string;
  lastUpdated?: string | null;
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
  enableTimeframeSwitching = true,
  expandable = true,
  interpretation,
  lastUpdated,
}: SymbolChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const entryBandRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [period, setPeriod] = useState<InteractiveChartPeriod>(defaultPeriod);
  const [resetToken, setResetToken] = useState(0);
  const [showResearchLevels, setShowResearchLevels] = useState(true);
  const [enabledOverlayFamilies, setEnabledOverlayFamilies] = useState<ChartOverlayFamily[]>(DEFAULT_CHART_OVERLAY_FAMILIES);
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
  const storyPoints = useMemo(() => buildChartStoryPoints(chartCandles, visibleChartSignals, chartLevels), [chartCandles, chartLevels, visibleChartSignals]);
  const move = useMemo(() => summarizeCandles(chartCandles), [chartCandles]);
  const canRenderChart = chartCandles.length >= 2;

  function expandChart(): void {
    trackAnalyticsEvent("chart_expand", {
      candleCount: chartCandles.length,
      markerCount: visibleChartSignals.length,
      period,
      surface: "symbol_chart",
    }, { source: "chart", symbol });
    setExpanded(true);
  }

  function changePeriod(range: InteractiveChartPeriod): void {
    setPeriod(range);
    trackAnalyticsEvent("timeframe_change", {
      from: period,
      surface: "symbol_chart",
      timeframe: range,
    }, { source: "chart", symbol });
  }

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
      createSeriesMarkers(candleSeries, toSeriesMarkers(visibleChartSignals), { zOrder: "top" });
      if (showResearchLevelsToggle) {
        if (levelsVisible) addResearchContextLines(candleSeries, researchLevels);
      } else {
        addTradeLevelLines(candleSeries, chartLevels);
      }
      chart.timeScale().fitContent();

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
        resizeObserver.disconnect();
        chart?.remove();
      };
    } catch {
      chart?.remove();
      setFailed(true);
      return undefined;
    }
  }, [canRenderChart, chartCandles, chartLevels, levelsVisible, researchLevels, resetToken, showResearchLevelsToggle, visibleChartSignals]);

  if (failed || (candles?.length && !normalizedCandles.length)) {
    return <EmptyState title="Price chart unavailable" message="The latest price payload could not be validated for this symbol." />;
  }

  if (!normalizedCandles.length) {
    return <EmptyState title="No validated price history" message="This chart is hidden until real OHLC history is available. Scanner insights can still appear without drawing synthetic prices." />;
  }

  return (
    <>
    <div className="min-w-0">
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
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-cyan-300/40 hover:text-cyan-100 sm:min-h-0"
              onClick={() => setResetToken((value) => value + 1)}
              title="Reset chart zoom and pan"
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
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
        onToggle={(family) => {
          setEnabledOverlayFamilies((current) => {
            if (current.includes(family)) return current.filter((item) => item !== family);
            return [...current, family];
          });
        }}
      />
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-xl shadow-black/20" style={{ height }}>
      {canRenderChart ? <div ref={chartContainerRef} className="absolute inset-0" /> : (
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className="max-w-md text-center">
            <div className="text-sm font-semibold text-slate-100">Limited data for {period}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">This timeframe is hidden until at least two validated candles are available. No synthetic price action is drawn.</p>
          </div>
        </div>
      )}
      <ChartIntelligenceZoneOverlay zones={intelligenceZones} />
      <div ref={entryBandRef} className={`pointer-events-none absolute left-0 right-0 hidden border-y border-amber-300/35 bg-amber-300/10 ${showResearchLevelsToggle && !levelsVisible ? "opacity-0" : ""}`} />
      {showResearchLevelsToggle ? (
        <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 shadow-lg backdrop-blur-xl transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={() => {
              setShowResearchLevels((value) => !value);
              if (!enabledOverlayFamilies.includes("levels")) {
                setEnabledOverlayFamilies((current) => [...current, "levels"]);
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
      <ChartStoryPanel points={storyPoints} />
    </div>
    {expanded ? (
      <SymbolChartModal
        candles={normalizedCandles}
        close={() => setExpanded(false)}
        dataSource={dataSource}
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

function SymbolChartModal({
  candles,
  close,
  dataSource,
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
  defaultPeriod: InteractiveChartPeriod;
  interpretation: string;
  lastUpdated: string | null;
  showHistoricalSignals: boolean;
  showResearchLevelsToggle: boolean;
  signals?: ChartSignalMarker[];
  symbol: string;
  tradeLevels?: ChartTradeLevels;
}) {
  const [detailMode, setDetailMode] = useState<"compare" | "overlays" | "timeline">("overlays");
  const normalizedSignals = useMemo(() => (showHistoricalSignals ? filterSignalsByCandles(normalizeSignals(signals ?? []), candles) : []), [candles, showHistoricalSignals, signals]);
  const chartLevels = useMemo(() => normalizeTradeLevels(tradeLevels), [tradeLevels]);
  const markerSummary = markerGroupSummary(normalizedSignals);
  const markerEvidence = normalizedSignals.slice(-14).reverse();
  const storyPoints = useMemo(() => buildChartStoryPoints(candles, normalizedSignals, chartLevels), [candles, chartLevels, normalizedSignals]);
  const compareRows = useMemo(() => buildChartCompareRows(candles, normalizedSignals, chartLevels), [candles, chartLevels, normalizedSignals]);
  const levelSummary = tradeLevelSummary(tradeLevels);
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap gap-1.5">
            {(["overlays", "compare", "timeline"] as const).map((mode) => (
              <button
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                  detailMode === mode
                    ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
                }`}
                key={mode}
                onClick={() => setDetailMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500">Fullscreen exploration · synchronized overlays · research only</div>
        </div>
        <div className="mt-4">
          <SymbolChart
            candles={candles}
            dataSource={dataSource}
            defaultPeriod={defaultPeriod}
            expandable={false}
            height={460}
            interpretation={interpretation}
            lastUpdated={lastUpdated}
            showHistoricalSignals={showHistoricalSignals}
            showHeaderBadge={false}
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
    </StableDetailOverlay>
  );
}

function ChartModalModePanel({
  compareRows,
  mode,
  storyPoints,
  timelineMarkers,
}: {
  compareRows: ChartCompareRow[];
  mode: "compare" | "overlays" | "timeline";
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
