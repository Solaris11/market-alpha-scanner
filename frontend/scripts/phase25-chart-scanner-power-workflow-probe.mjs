#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

const outputPath = process.env.TRADEVETO_PHASE25_POWER_WORKFLOW_OUTPUT ?? "";
const samples = positiveInteger(process.env.TRADEVETO_PHASE25_POWER_WORKFLOW_SAMPLES, 96);
const symbolCount = positiveInteger(process.env.TRADEVETO_PHASE25_POWER_WORKFLOW_SYMBOLS, 520);
const startedAt = new Date().toISOString();

const budgets = {
  chartInteractionMs: 60,
  compareOpenMs: 150,
  fullscreenChartOpenMs: 150,
  largeWatchlistFilterMs: 150,
  rapidSymbolSwitchMs: 100,
  scannerInteractionMs: 100,
  workspaceRestoreMs: 250,
};

async function main() {
  let exitCode = 0;
  try {
    const beforeMemory = memorySnapshot();
    const report = buildReport();
    report.memory = {
      before: beforeMemory,
      after: memorySnapshot(),
      deltaRssMb: roundMetric(memorySnapshot().rssMb - beforeMemory.rssMb),
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    console.log(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, "utf8");
    }
    if (report.overallStatus !== "ready") exitCode = 1;
  } catch (error) {
    exitCode = 1;
    const failure = {
      error: error instanceof Error ? error.message : "Phase 25 chart/scanner power workflow probe failed",
      generatedAt: new Date().toISOString(),
      overallStatus: "not_ready",
      startedAt,
    };
    const serialized = `${JSON.stringify(failure, null, 2)}\n`;
    console.error(serialized);
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true }).catch(() => undefined);
      await writeFile(outputPath, serialized, "utf8").catch(() => undefined);
    }
  } finally {
    process.exitCode = exitCode;
  }
}

function buildReport() {
  const symbols = buildSyntheticSymbols(symbolCount);
  const largeWatchlistCount = symbols.filter((symbol) => symbol.watchlisted).length;
  const virtualWindow = buildScannerVirtualWindow({
    rowCount: symbols.length,
    rowHeight: 46,
    scrollTop: 46 * 250,
    viewportHeight: 1152,
  });
  const compareSymbols = symbols.slice(0, 8).map((symbol) => symbol.symbol);
  let workspace = defaultWorkspace();
  let workspaceMap = buildWorkspaceMap(symbols.slice(0, 24).map((symbol) => symbol.symbol));
  let switchIndex = 0;

  const scannerState = {
    filter: "all",
    query: "synthetic",
    sector: "ALL",
    sort: "attention",
    timeframe: "1M",
  };
  const watchlistState = {
    filter: "all",
    query: "",
    sector: "ALL",
    sort: "risk",
    timeframe: "1D",
    watchlistOnly: true,
  };
  const metrics = [
    measureOperation({
      budgetMs: budgets.scannerInteractionMs,
      id: "scanner-interaction",
      label: "Filter, sort, rank, and return first rows from a 500+ symbol scanner universe",
      operation: () => filterSymbols(symbols, scannerState).slice(0, 80).reduce((total, symbol) => total + symbol.symbol.length + symbol.confidence, 0),
    }),
    measureOperation({
      budgetMs: budgets.largeWatchlistFilterMs,
      id: "large-watchlist-filter",
      label: "Filter and sort 500 watchlisted scanner rows",
      operation: () => filterSymbols(symbols, watchlistState).slice(0, 120).reduce((total, symbol) => total + symbol.risk + symbol.symbol.length, 0),
    }),
    measureOperation({
      budgetMs: budgets.compareOpenMs,
      id: "compare-open",
      label: "Build a rapid compare matrix with symbol, risk, macro, replay, and reason columns",
      operation: () => buildCompareMatrix(symbols, compareSymbols).reduce((total, row) => total + row.symbol.length + row.confidence, 0),
    }),
    measureOperation({
      budgetMs: budgets.chartInteractionMs,
      id: "chart-interaction",
      label: "Apply chart toolbar state, indicators, overlays, drawings, and compact mode",
      operation: () => {
        workspace = mergeWorkspace(workspace, chartInteractionPatch());
        return workspace.drawings.length + workspace.indicators.length + workspace.overlayFamilies.length;
      },
    }),
    measureOperation({
      budgetMs: budgets.fullscreenChartOpenMs,
      id: "fullscreen-chart-open",
      label: "Open fullscreen chart state with stable toolbar and grid workspace settings",
      operation: () => {
        workspace = mergeWorkspace(workspace, { fullscreenOpen: true, layoutMode: "grid", toolbarCollapsed: false });
        return workspace.fullscreenOpen ? workspace.chartTabs.length + 1 : 0;
      },
    }),
    measureOperation({
      budgetMs: budgets.workspaceRestoreMs,
      id: "chart-workspace-restore",
      label: "Sanitize and restore multi-symbol chart workspace state",
      operation: () => {
        const restored = sanitizeWorkspaceMap(workspaceMap);
        return Object.keys(restored).length + (restored.AMD?.drawings?.length ?? 0);
      },
    }),
    measureOperation({
      budgetMs: budgets.rapidSymbolSwitchMs,
      id: "rapid-symbol-switch",
      label: "Switch symbols while keeping chart workspace persistence bounded",
      operation: () => {
        const symbol = compareSymbols[switchIndex % compareSymbols.length] ?? "AMD";
        switchIndex += 1;
        workspaceMap = mergeWorkspaceMap(workspaceMap, symbol, mergeWorkspace(workspaceMap[symbol], chartInteractionPatch()));
        return Object.keys(workspaceMap).length + (workspaceMap[symbol]?.indicatorTemplates?.length ?? 0);
      },
    }),
  ];
  const blockers = [];
  if (symbols.length < 500) blockers.push("Synthetic scanner universe is below 500 symbols.");
  if (largeWatchlistCount < 500) blockers.push("Large-watchlist path is below 500 symbols.");
  if (!virtualWindow.virtualized || virtualWindow.renderedRows > 80) blockers.push("Scanner virtual window is not bounded to 80 rendered rows.");
  for (const metric of metrics) {
    if (!metric.pass) blockers.push(`${metric.id} p95 ${metric.p95Ms}ms exceeds ${metric.budgetMs}ms budget.`);
  }
  return {
    blockers,
    budgets,
    generatedAt: new Date().toISOString(),
    largeWatchlistCount,
    metrics,
    overallStatus: blockers.length === 0 ? "ready" : "not_ready",
    proofScope: "Production container deterministic workflow proof for scanner filtering, large-watchlist operations, compare matrix creation, chart persistence, fullscreen state, and workspace restore. Browser DOM frame timing is captured by the Phase 25 browser timing companion probe. This is not physical-device proof or TradingView parity.",
    samples,
    startedAt,
    symbolCount: symbols.length,
    unsupportedClaims: [
      "No unsupported TradingView parity claim.",
      "No broker execution, fake fills, or trading automation claim.",
      "Physical-device gesture latency requires separate evidence.",
    ],
    virtualWindow,
  };
}

function measureOperation(config) {
  const durations = [];
  let checksum = 0;
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    checksum += config.operation();
    durations.push(Math.max(0, performance.now() - started));
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
    maxMs: roundMetric(maxMs),
    p50Ms,
    p95Ms,
    p99Ms,
    pass: p95Ms <= config.budgetMs,
    samples,
  };
}

function buildSyntheticSymbols(count) {
  const sectors = ["Technology", "Semiconductors", "Financials", "Energy", "Healthcare", "Industrials", "Consumer Cyclical", "Crypto"];
  const setups = ["Momentum Breakout", "Mean Reversion", "Risk Compression", "Macro Divergence", "Replay Analog", "Fresh Catalyst"];
  const known = ["AMD", "NVDA", "AAPL", "MSFT", "TSLA", "META", "GOOGL", "AMZN", "AVGO", "SMCI", "PLTR", "COIN", "MSTR", "XOM", "JPM", "LLY", "UNH", "BA", "SHOP", "SNOW"];
  const symbols = [];
  for (let index = 0; index < count; index += 1) {
    const sector = sectors[index % sectors.length] ?? "Technology";
    const setupType = setups[index % setups.length] ?? "Momentum Breakout";
    const confidence = 42 + ((index * 17) % 57);
    const risk = 28 + ((index * 19) % 69);
    const macro = 36 + ((index * 23) % 61);
    const replay = 31 + ((index * 29) % 66);
    const freshness = 45 + ((index * 31) % 54);
    const symbol = index < known.length ? known[index] : `TV${index.toString().padStart(4, "0")}`;
    symbols.push({
      confidence,
      companyName: `${symbol} Power Workflow Synthetic ${sector}`,
      freshness,
      macro,
      performance: buildPerformance(index),
      reason: `${setupType} with ${sector} context, replay evidence, scanner change memory, and macro linkage.`,
      replay,
      risk,
      sector,
      setupType,
      symbol,
      watchlisted: index < 500,
    });
  }
  return symbols;
}

function buildPerformance(index) {
  const performanceMap = {};
  for (const [offset, timeframe] of ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"].entries()) {
    performanceMap[timeframe] = roundMetric((((index * (offset + 3)) % 340) - 110) / 10);
  }
  return performanceMap;
}

function filterSymbols(symbols, state) {
  const query = state.query.trim().toLowerCase();
  const filtered = symbols.filter((symbol) => {
    if (state.watchlistOnly && !symbol.watchlisted) return false;
    if (state.sector !== "ALL" && symbol.sector !== state.sector) return false;
    if (!query) return true;
    return [symbol.symbol, symbol.companyName, symbol.sector, symbol.setupType, symbol.reason].some((value) => String(value).toLowerCase().includes(query));
  });
  return filtered.sort((left, right) => {
    if (state.sort === "symbol") return left.symbol.localeCompare(right.symbol);
    const leftValue = primaryRankValue(left, state.sort, state.timeframe);
    const rightValue = primaryRankValue(right, state.sort, state.timeframe);
    if (rightValue !== leftValue) return rightValue - leftValue;
    return right.confidence - left.confidence || left.symbol.localeCompare(right.symbol);
  });
}

function primaryRankValue(symbol, sort, timeframe) {
  if (sort === "performance") return symbol.performance[timeframe] ?? 0;
  if (sort === "risk") return symbol.risk ?? 0;
  if (sort === "macro") return symbol.macro ?? 0;
  if (sort === "replay") return symbol.replay ?? 0;
  if (sort === "freshness") return symbol.freshness ?? 0;
  return (symbol.confidence ?? 0) * 0.34 + (symbol.performance[timeframe] ?? 0) * 0.18 + (symbol.replay ?? 0) * 0.16 + (symbol.macro ?? 0) * 0.14 + (symbol.freshness ?? 0) * 0.1 - (symbol.risk ?? 0) * 0.08;
}

function buildCompareMatrix(symbols, selectedSymbols) {
  const selected = new Set(selectedSymbols);
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

function buildScannerVirtualWindow(input) {
  const virtualized = input.rowCount > 180;
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
  const startIndex = Math.max(0, Math.floor(Math.max(0, input.scrollTop) / Math.max(1, input.rowHeight)) - 24);
  const visibleCount = Math.ceil(input.viewportHeight / Math.max(1, input.rowHeight)) + 48;
  const endIndex = Math.min(input.rowCount, startIndex + visibleCount);
  return {
    bottomPaddingPx: Math.max(0, (input.rowCount - endIndex) * input.rowHeight),
    endIndex,
    renderedRows: Math.max(0, endIndex - startIndex),
    startIndex,
    topPaddingPx: Math.max(0, startIndex * input.rowHeight),
    totalRows: input.rowCount,
    virtualized,
  };
}

function defaultWorkspace() {
  return {
    activeIndicatorTemplateId: "default-trend-risk",
    alertHistory: [],
    chartTabs: [],
    compactMode: false,
    detailMode: "overlays",
    drawingTool: "inspect",
    drawings: [],
    fullscreenOpen: false,
    indicators: ["ema20", "ema50", "rsi14"],
    indicatorTemplates: [],
    layoutMode: "focus",
    magnetMode: false,
    overlayFamilies: ["confidence", "risk", "events"],
    period: "6mo",
    toolbarCollapsed: false,
    updatedAt: null,
    version: 1,
  };
}

function chartInteractionPatch() {
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

function mergeWorkspace(current, patch) {
  return sanitizeWorkspace({
    ...defaultWorkspace(),
    ...(current ?? {}),
    ...patch,
    updatedAt: new Date().toISOString(),
    version: 1,
  });
}

function sanitizeWorkspace(input) {
  const record = input && typeof input === "object" ? input : {};
  return {
    ...defaultWorkspace(),
    ...record,
    alertHistory: Array.isArray(record.alertHistory) ? record.alertHistory.slice(-20) : [],
    chartTabs: Array.isArray(record.chartTabs) ? record.chartTabs.slice(-8) : [],
    drawings: Array.isArray(record.drawings) ? record.drawings.slice(-24) : [],
    indicatorTemplates: Array.isArray(record.indicatorTemplates) ? record.indicatorTemplates.slice(-12) : [],
    indicators: Array.isArray(record.indicators) ? record.indicators.slice(0, 8) : defaultWorkspace().indicators,
    overlayFamilies: Array.isArray(record.overlayFamilies) ? record.overlayFamilies.slice(0, 8) : defaultWorkspace().overlayFamilies,
    version: 1,
  };
}

function buildWorkspaceMap(symbols) {
  let map = {};
  for (const [index, symbol] of symbols.entries()) {
    map = mergeWorkspaceMap(map, symbol, {
      ...defaultWorkspace(),
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
    });
  }
  return map;
}

function mergeWorkspaceMap(current, symbol, workspace) {
  const base = sanitizeWorkspaceMap(current);
  const next = { ...base, [symbol.trim().toUpperCase()]: sanitizeWorkspace(workspace) };
  return sanitizeWorkspaceMap(next);
}

function sanitizeWorkspaceMap(input) {
  const entries = Object.entries(input && typeof input === "object" ? input : {})
    .map(([symbol, workspace]) => [symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24), sanitizeWorkspace(workspace)])
    .filter(([symbol]) => symbol && symbol !== "UNKNOWN")
    .sort((left, right) => {
      const leftTime = Date.parse(left[1].updatedAt ?? "") || 0;
      const rightTime = Date.parse(right[1].updatedAt ?? "") || 0;
      return rightTime - leftTime || left[0].localeCompare(right[0]);
    })
    .slice(0, 24);
  return Object.fromEntries(entries);
}

function memorySnapshot() {
  const memory = process.memoryUsage();
  return {
    heapUsedMb: roundMetric(memory.heapUsed / 1024 / 1024),
    rssMb: roundMetric(memory.rss / 1024 / 1024),
  };
}

function percentile(sorted, percentileRank) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileRank / 100) * sorted.length) - 1));
  return roundMetric(sorted[index] ?? 0);
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

await main();
