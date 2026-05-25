import {
  defaultChartWorkflowWorkspace,
  mergeChartWorkflowWorkspace,
  mergeChartWorkflowWorkspaceMap,
  sanitizeChartWorkflowWorkspaceMap,
  type ChartWorkflowWorkspace,
  type ChartWorkflowWorkspaceMap,
  type ChartWorkflowWorkspacePatch,
} from "@/components/terminal/chart-workflow-storage";
import {
  filterDiscoverySymbols,
  type DiscoveryFilterState,
  type DiscoverySymbol,
  type DiscoveryTimeframe,
} from "./intelligence-discovery";

export type PowerWorkflowMetricId =
  | "scanner-interaction"
  | "large-watchlist-filter"
  | "compare-open"
  | "chart-interaction"
  | "fullscreen-chart-open"
  | "chart-workspace-restore"
  | "rapid-symbol-switch";

export type PowerWorkflowMetric = {
  budgetMs: number;
  checksum: number;
  id: PowerWorkflowMetricId;
  label: string;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  pass: boolean;
  samples: number;
};

export type ScannerVirtualWindow = {
  bottomPaddingPx: number;
  endIndex: number;
  renderedRows: number;
  startIndex: number;
  topPaddingPx: number;
  totalRows: number;
  virtualized: boolean;
};

export type PowerWorkflowProofReport = {
  budgets: typeof POWER_WORKFLOW_BUDGETS;
  generatedAt: string;
  largeWatchlistCount: number;
  metrics: PowerWorkflowMetric[];
  overallStatus: "ready" | "not_ready";
  proofScope: string;
  symbolCount: number;
  unsupportedClaims: string[];
  virtualWindow: ScannerVirtualWindow;
};

type MeasurementInput = {
  now?: () => number;
  samples?: number;
  symbolCount?: number;
};

type MeasurementConfig = {
  budgetMs: number;
  id: PowerWorkflowMetricId;
  label: string;
  operation: () => number;
  samples: number;
};

export const POWER_WORKFLOW_BUDGETS = {
  chartInteractionMs: 60,
  compareOpenMs: 150,
  fullscreenChartOpenMs: 150,
  largeWatchlistFilterMs: 150,
  rapidSymbolSwitchMs: 100,
  scannerInteractionMs: 100,
  workspaceRestoreMs: 250,
} as const;

const DISCOVERY_TIMEFRAMES: DiscoveryTimeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];
const SECTORS = ["Technology", "Semiconductors", "Financials", "Energy", "Healthcare", "Industrials", "Consumer Cyclical", "Crypto"] as const;
const SETUPS = ["Momentum Breakout", "Mean Reversion", "Risk Compression", "Macro Divergence", "Replay Analog", "Fresh Catalyst"] as const;
const DEFAULT_SYMBOL_COUNT = 520;
const DEFAULT_SAMPLES = 72;
const VIRTUALIZATION_THRESHOLD = 180;
const VIRTUAL_OVERSCAN_ROWS = 24;

export function buildSyntheticDiscoverySymbols(count = DEFAULT_SYMBOL_COUNT): DiscoverySymbol[] {
  const symbols: DiscoverySymbol[] = [];
  for (let index = 0; index < count; index += 1) {
    const sector = SECTORS[index % SECTORS.length] ?? "Technology";
    const setupType = SETUPS[index % SETUPS.length] ?? "Momentum Breakout";
    const confidence = 42 + ((index * 17) % 57);
    const risk = 28 + ((index * 19) % 69);
    const macro = 36 + ((index * 23) % 61);
    const replay = 31 + ((index * 29) % 66);
    const freshness = 45 + ((index * 31) % 54);
    const symbol = index < 20 ? ["AMD", "NVDA", "AAPL", "MSFT", "TSLA", "META", "GOOGL", "AMZN", "AVGO", "SMCI", "PLTR", "COIN", "MSTR", "XOM", "JPM", "LLY", "UNH", "BA", "SHOP", "SNOW"][index] ?? `TV${index}` : `TV${index.toString().padStart(4, "0")}`;
    symbols.push({
      alertState: index % 11 === 0 ? "armed" : "none",
      assetType: index % 13 === 0 ? "Crypto" : "Equity",
      companyName: `${symbol} Power Workflow Synthetic ${sector}`,
      confidence,
      conviction: confidence,
      decision: confidence >= 72 ? "Prioritize" : risk >= 72 ? "Monitor risk" : "Track",
      evidence: 40 + ((index * 7) % 60),
      evidenceLabel: index % 5 === 0 ? "Limited" : index % 3 === 0 ? "Developing" : "Strong",
      fragility: 20 + ((index * 11) % 75),
      freshness,
      freshnessLabel: `${freshness} fresh`,
      href: `/symbol/${symbol}`,
      macro,
      marketCap: 800_000_000 + index * 9_750_000_000,
      performance: buildSyntheticPerformance(index),
      price: 12 + index * 1.37,
      reason: `${setupType} with ${sector} context, replay evidence, scanner change memory, and macro linkage.`,
      replay,
      risk,
      sector,
      setupType,
      shockRisk: 25 + ((index * 5) % 70),
      symbol,
      trend: 30 + ((index * 37) % 68),
      volatility: 20 + ((index * 41) % 76),
      volume: 1_000_000 + index * 173_000,
      watchlisted: index < 500,
    });
  }
  return symbols;
}

export function buildScannerVirtualWindow(input: {
  overscanRows?: number;
  rowCount: number;
  rowHeight: number;
  scrollTop: number;
  threshold?: number;
  viewportHeight: number;
}): ScannerVirtualWindow {
  const threshold = input.threshold ?? VIRTUALIZATION_THRESHOLD;
  const overscanRows = input.overscanRows ?? VIRTUAL_OVERSCAN_ROWS;
  const virtualized = input.rowCount > threshold;
  if (!virtualized) {
    return {
      bottomPaddingPx: 0,
      endIndex: input.rowCount,
      renderedRows: input.rowCount,
      startIndex: 0,
      topPaddingPx: 0,
      totalRows: input.rowCount,
      virtualized,
    };
  }
  const safeRowHeight = Math.max(1, input.rowHeight);
  const safeScrollTop = Math.max(0, input.scrollTop);
  const startIndex = Math.max(0, Math.floor(safeScrollTop / safeRowHeight) - overscanRows);
  const visibleCount = Math.ceil(input.viewportHeight / safeRowHeight) + overscanRows * 2;
  const endIndex = Math.min(input.rowCount, startIndex + visibleCount);
  return {
    bottomPaddingPx: Math.max(0, (input.rowCount - endIndex) * safeRowHeight),
    endIndex,
    renderedRows: Math.max(0, endIndex - startIndex),
    startIndex,
    topPaddingPx: Math.max(0, startIndex * safeRowHeight),
    totalRows: input.rowCount,
    virtualized,
  };
}

export function buildCompareMatrix(symbols: DiscoverySymbol[], selectedSymbols: string[]): Array<Record<string, number | string | null>> {
  const selected = new Set(selectedSymbols.map((symbol) => symbol.toUpperCase()));
  return symbols
    .filter((symbol) => selected.has(symbol.symbol))
    .map((symbol) => ({
      confidence: symbol.confidence,
      macro: symbol.macro,
      move1m: symbol.performance["1M"],
      reason: symbol.reason,
      replay: symbol.replay,
      risk: symbol.risk,
      sector: symbol.sector,
      symbol: symbol.symbol,
    }));
}

export function measureChartScannerPowerWorkflowProof(input: MeasurementInput = {}): PowerWorkflowProofReport {
  const now = input.now ?? defaultNow;
  const samples = Math.max(12, input.samples ?? DEFAULT_SAMPLES);
  const symbolCount = Math.max(1, input.symbolCount ?? DEFAULT_SYMBOL_COUNT);
  const symbols = buildSyntheticDiscoverySymbols(symbolCount);
  const largeWatchlistCount = symbols.filter((symbol) => symbol.watchlisted).length;
  const compareSymbols = symbols.slice(0, 8).map((symbol) => symbol.symbol);
  const virtualWindow = buildScannerVirtualWindow({
    rowCount: symbols.length,
    rowHeight: 46,
    scrollTop: 46 * 250,
    viewportHeight: 1_152,
  });
  const measurementClock = { now };

  let workspaceMap = buildWorkspaceMap(symbols.slice(0, 24).map((symbol) => symbol.symbol));
  let workspace = defaultChartWorkflowWorkspace();
  const scannerState: DiscoveryFilterState = {
    evidence: "ALL",
    filter: "all",
    marketCap: "ALL",
    query: "synthetic",
    riskBand: "ALL",
    sector: "ALL",
    sort: "attention",
    timeframe: "1M",
  };
  const largeWatchlistState: DiscoveryFilterState = {
    evidence: "ALL",
    filter: "all",
    marketCap: "ALL",
    query: "",
    riskBand: "ALL",
    sector: "ALL",
    sort: "risk",
    timeframe: "1D",
    watchlistOnly: true,
  };

  const metrics = [
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.scannerInteractionMs,
      id: "scanner-interaction",
      label: "Filter, sort, rank, and return first rows from a 500+ symbol scanner universe",
      operation: () => filterDiscoverySymbols(symbols, scannerState).slice(0, 80).reduce((total, symbol) => total + symbol.symbol.length + (symbol.confidence ?? 0), 0),
      samples,
    }),
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.largeWatchlistFilterMs,
      id: "large-watchlist-filter",
      label: "Filter and sort 500 watchlisted scanner rows",
      operation: () => filterDiscoverySymbols(symbols, largeWatchlistState).slice(0, 120).reduce((total, symbol) => total + (symbol.risk ?? 0) + symbol.symbol.length, 0),
      samples,
    }),
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.compareOpenMs,
      id: "compare-open",
      label: "Build a rapid compare matrix with symbol, risk, macro, replay, and reason columns",
      operation: () => buildCompareMatrix(symbols, compareSymbols).reduce((total, row) => total + String(row.symbol).length + Number(row.confidence ?? 0), 0),
      samples,
    }),
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.chartInteractionMs,
      id: "chart-interaction",
      label: "Apply chart toolbar state, indicators, overlays, drawings, and compact mode",
      operation: () => {
        workspace = mergeChartWorkflowWorkspace(workspace, chartInteractionPatch());
        return workspace.drawings.length + workspace.indicators.length + workspace.overlayFamilies.length;
      },
      samples,
    }),
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.fullscreenChartOpenMs,
      id: "fullscreen-chart-open",
      label: "Open fullscreen chart state with stable toolbar and grid workspace settings",
      operation: () => {
        workspace = mergeChartWorkflowWorkspace(workspace, {
          fullscreenOpen: true,
          layoutMode: "grid",
          toolbarCollapsed: false,
        });
        return workspace.fullscreenOpen ? workspace.chartTabs.length + 1 : 0;
      },
      samples,
    }),
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.workspaceRestoreMs,
      id: "chart-workspace-restore",
      label: "Sanitize and restore multi-symbol chart workspace state",
      operation: () => {
        const restored = sanitizeChartWorkflowWorkspaceMap(workspaceMap);
        return Object.keys(restored).length + (restored.AMD?.drawings.length ?? 0);
      },
      samples,
    }),
    measureOperation(measurementClock, {
      budgetMs: POWER_WORKFLOW_BUDGETS.rapidSymbolSwitchMs,
      id: "rapid-symbol-switch",
      label: "Switch symbols while keeping chart workspace persistence bounded",
      operation: () => {
        const symbol = compareSymbols[Math.floor(Math.random() * compareSymbols.length)] ?? "AMD";
        workspaceMap = mergeChartWorkflowWorkspaceMap(workspaceMap, symbol, mergeChartWorkflowWorkspace(workspaceMap[symbol], chartInteractionPatch()));
        return Object.keys(workspaceMap).length + (workspaceMap[symbol]?.indicatorTemplates.length ?? 0);
      },
      samples,
    }),
  ];

  const metricsPass = metrics.every((metric) => metric.pass);
  const largeUniversePass = symbols.length >= 500 && largeWatchlistCount >= 500;
  const virtualWindowPass = virtualWindow.virtualized && virtualWindow.renderedRows <= 80;
  return {
    budgets: POWER_WORKFLOW_BUDGETS,
    generatedAt: new Date().toISOString(),
    largeWatchlistCount,
    metrics,
    overallStatus: metricsPass && largeUniversePass && virtualWindowPass ? "ready" : "not_ready",
    proofScope: "Deterministic scanner/chart operation proof for bounded rendering, persistence, compare, fullscreen state, and 500+ symbol workflows. It is not a TradingView parity claim and does not replace browser DOM or real-device timing evidence.",
    symbolCount: symbols.length,
    unsupportedClaims: [
      "No unsupported TradingView parity claim.",
      "No broker execution, fake fills, or trading automation claim.",
      "Browser DOM frame timing and physical-device gesture latency require separate evidence.",
    ],
    virtualWindow,
  };
}

function measureOperation(clock: { now: () => number }, config: MeasurementConfig): PowerWorkflowMetric {
  const durations: number[] = [];
  let checksum = 0;
  for (let index = 0; index < config.samples; index += 1) {
    const startedAt = clock.now();
    checksum += config.operation();
    durations.push(Math.max(0, clock.now() - startedAt));
  }
  const sorted = [...durations].sort((left, right) => left - right);
  const p50Ms = percentile(sorted, 50);
  const p95Ms = percentile(sorted, 95);
  const p99Ms = percentile(sorted, 99);
  const maxMs = sorted[sorted.length - 1] ?? 0;
  return {
    budgetMs: config.budgetMs,
    checksum,
    id: config.id,
    label: config.label,
    maxMs,
    p50Ms,
    p95Ms,
    p99Ms,
    pass: p95Ms <= config.budgetMs,
    samples: config.samples,
  };
}

function percentile(sorted: number[], percentileRank: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1));
  return roundMetric(sorted[index] ?? 0);
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function defaultNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function buildSyntheticPerformance(index: number): Record<DiscoveryTimeframe, number | null> {
  const performance: Record<DiscoveryTimeframe, number | null> = {
    "1D": null,
    "1W": null,
    "1M": null,
    "3M": null,
    "6M": null,
    "1Y": null,
    "5Y": null,
  };
  for (const [offset, timeframe] of DISCOVERY_TIMEFRAMES.entries()) {
    performance[timeframe] = roundMetric((((index * (offset + 3)) % 340) - 110) / 10);
  }
  return performance;
}

function buildWorkspaceMap(symbols: string[]): ChartWorkflowWorkspaceMap {
  let map: ChartWorkflowWorkspaceMap = {};
  for (const [index, symbol] of symbols.entries()) {
    map = mergeChartWorkflowWorkspaceMap(map, symbol, {
      ...defaultChartWorkflowWorkspace(),
      chartTabs: [
        {
          detailMode: index % 2 === 0 ? "compare" : "overlays",
          id: `${symbol.toLowerCase()}-tab`,
          indicators: ["ema20", "rsi14"],
          label: `${symbol} workflow`,
          layoutMode: index % 3 === 0 ? "split" : "focus",
          overlayFamilies: ["confidence", "risk", "events"],
          period: "6mo",
          symbol,
        },
      ],
      drawings: [
        {
          color: "cyan",
          end: { x: 80, y: 36 + index },
          id: `${symbol.toLowerCase()}-level`,
          label: `${symbol} level`,
          lineWidth: 2,
          start: { x: 12, y: 36 + index },
          style: "dashed",
          tool: "horizontal",
          visible: true,
        },
      ],
      fullscreenOpen: index % 4 === 0,
      updatedAt: new Date(Date.UTC(2026, 4, 24, 12, index)).toISOString(),
    } satisfies ChartWorkflowWorkspace);
  }
  return map;
}

function chartInteractionPatch(): ChartWorkflowWorkspacePatch {
  const now = new Date().toISOString();
  return {
    activeIndicatorTemplateId: "phase-25-power",
    compactMode: true,
    detailMode: "compare",
    drawingTool: "edit",
    drawings: [
      {
        color: "cyan",
        createdAt: now,
        end: { x: 88, y: 44 },
        id: "phase-25-power-level",
        label: "Power workflow level",
        lineWidth: 3,
        start: { x: 14, y: 44 },
        style: "dashed",
        tool: "horizontal",
        updatedAt: now,
        visible: true,
      },
    ],
    indicators: ["ema20", "ema50", "rsi14", "macd"],
    indicatorTemplates: [
      {
        createdAt: now,
        id: "phase-25-power",
        indicators: ["ema20", "ema50", "rsi14", "macd"],
        name: "Phase 25 Power Workflow",
        overlayFamilies: ["confidence", "risk", "events", "replay"],
        source: "user",
        updatedAt: now,
      },
    ],
    overlayFamilies: ["confidence", "risk", "events", "replay"],
    period: "6mo",
    toolbarCollapsed: false,
  };
}
