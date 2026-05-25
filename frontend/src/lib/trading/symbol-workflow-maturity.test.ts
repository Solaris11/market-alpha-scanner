import test from "node:test";
import assert from "node:assert/strict";
import type { HistorySummary, PerformanceData, RankingRow, SymbolHistoryRow } from "../types";
import {
  buildHistoryWorkflowMaturityModel,
  buildPerformanceWorkflowMaturityModel,
  buildSymbolSearchIndex,
  buildSymbolWorkflowMaturityModel,
  searchSymbolIndex,
} from "./symbol-workflow-maturity";
import { measureSymbolHistoryPerformancePolishProof } from "./symbol-history-performance-polish-proof";

const rows: RankingRow[] = [
  {
    symbol: "AMD",
    company_name: "Advanced Micro Devices",
    event_context_summary: "AI accelerator demand is lifting semiconductor attention.",
    event_risk_score: 72,
    final_decision: "WATCH",
    final_score: 78,
    macro_context_label: "Risk-on growth",
    market_regime: "risk_on",
    rank_position: 1,
    sector: "Technology",
    setup_type: "breakout",
  },
  {
    symbol: "XLE",
    company_name: "Energy Select Sector SPDR",
    final_decision: "REVIEW",
    final_score: 58,
    market_regime: "inflation hedge",
    rank_position: 8,
    sector: "Energy",
    setup_type: "rotation",
  },
];

const historySummary: HistorySummary = {
  count: 4,
  earliest: "2026-05-20T14:00:00.000Z",
  latest: "2026-05-24T14:00:00.000Z",
  snapshots: [],
  uniqueDates: ["2026-05-20", "2026-05-21", "2026-05-24"],
};

function historyRow(symbol: string, timestamp: string, score: number, decision: string, setup = "breakout"): SymbolHistoryRow {
  return {
    action: decision,
    final_decision: decision,
    final_score: score,
    market_regime: timestamp.endsWith("20:00.000Z") ? "risk_off" : "risk_on",
    news_headline: timestamp.endsWith("24:00.000Z") ? "AMD supplier update changes semiconductor risk" : undefined,
    price: 100 + score,
    setup_type: setup,
    source_file: `db:${timestamp}`,
    symbol,
    timestamp_utc: timestamp,
  };
}

function performanceData(): PerformanceData {
  return {
    autoCalibration: { columns: [], lineCount: 0, rows: [], state: "missing" },
    forwardReturns: {
      columns: ["symbol", "final_score", "return_pct"],
      lineCount: 5,
      rows: [
        { final_score: 82, return_pct: 0.05, symbol: "AMD" },
        { final_score: 76, return_pct: -0.02, symbol: "NVDA" },
        { final_score: 55, return_pct: 0.01, symbol: "MSFT" },
        { final_score: 33, return_pct: -0.03, symbol: "XLE" },
      ],
      state: "data",
    },
    lifecycle: { columns: ["symbol"], lineCount: 2, rows: [{ symbol: "AMD" }], state: "data" },
    lifecycleSummary: { columns: [], lineCount: 0, rows: [], state: "missing" },
    summary: { columns: [], lineCount: 0, rows: [], state: "missing" },
  };
}

test("symbol search supports ticker, company, sector, macro, history, and filters", () => {
  const index = buildSymbolSearchIndex({
    historySymbols: ["AMD", "AMD", "XLE", "TSLA"],
    recentSymbols: ["AMD"],
    rows,
    watchlistSymbols: ["XLE"],
  });

  assert.ok(index.some((item) => item.symbol === "TSLA" && item.scannerRanked === false && item.historyCount === 1));

  const ticker = searchSymbolIndex(index, "amd");
  assert.equal(ticker.results[0]?.document.symbol, "AMD");
  assert.ok(ticker.results[0]?.matchReasons.includes("exact ticker match"));

  const company = searchSymbolIndex(index, "advanced micro");
  assert.equal(company.results[0]?.document.symbol, "AMD");

  const sector = searchSymbolIndex(index, "energy", { sectors: ["ENERGY"] });
  assert.equal(sector.results[0]?.document.symbol, "XLE");

  const historyOnly = searchSymbolIndex(index, "tsla", { historyOnly: true });
  assert.equal(historyOnly.results[0]?.document.symbol, "TSLA");

  const fuzzy = searchSymbolIndex(index, "advaned micro devces");
  assert.equal(fuzzy.results[0]?.document.symbol, "AMD");

  const sourceFiltered = searchSymbolIndex(index, "replay", { sourceTags: ["history"], watchlistOnly: true });
  assert.equal(sourceFiltered.results[0]?.document.symbol, "XLE");
});

test("symbol maturity exposes timelines and continuity without fabricating catalysts", () => {
  const model = buildSymbolWorkflowMaturityModel({
    history: [
      { final_decision: "WATCH", final_score: 60, timestamp: "2026-05-20T14:00:00.000Z" },
      { final_decision: "WATCH", final_score: 78, timestamp: "2026-05-24T14:00:00.000Z" },
    ],
    marketMemoryAvailable: true,
    row: rows[0]!,
    symbol: "AMD",
    workflowChanges: [{ detail: "AMD moved closer to the current research trigger.", metricLabel: "trigger", title: "Trigger proximity" }],
  });

  assert.ok(model.maturityScore > 70);
  assert.ok(model.catalystTimeline.some((item) => /AI accelerator/i.test(item.detail)));
  assert.ok(model.whatChanged.some((item) => /18\.0|18/i.test(item.detail)));
  assert.ok(model.continuityActions.some((item) => item.href === "/history?symbol=AMD" && item.status === "available"));
});

test("history maturity builds replay clusters, macro chronology, and autopsy boundaries", () => {
  const historyRows = [
    historyRow("AMD", "2026-05-20T14:00:00.000Z", 60, "WATCH"),
    historyRow("AMD", "2026-05-21T14:00:00.000Z", 66, "WATCH"),
    historyRow("AMD", "2026-05-24T14:00:00.000Z", 78, "ENTER"),
  ];
  const model = buildHistoryWorkflowMaturityModel({ history: historySummary, rows: historyRows, selectedSymbol: "AMD" });

  assert.ok(model.score > 50);
  assert.ok(model.replayClusters.some((cluster) => cluster.label.includes("breakout")));
  assert.ok(model.historicalAnalogs.length >= 1);
  assert.ok(model.macroChronology.length >= 1);
  assert.ok(model.tradeAutopsyContinuity.some((item) => /does not fabricate fills/i.test(item.detail)));
});

test("performance maturity derives hit rate, calibration, and false-positive analysis from completed rows", () => {
  const model = buildPerformanceWorkflowMaturityModel({
    history: historySummary,
    performance: performanceData(),
    rankingRows: rows,
  });

  assert.ok(model.score > 50);
  assert.ok(model.cockpitCards.some((card) => card.label === "Scanner hit-rate analysis" && card.value === "50.0%"));
  assert.equal(model.falsePositiveAnalysis.value, "1");
  assert.ok(model.calibration.some((bucket) => bucket.label === "High score" && bucket.count === 2));
  assert.ok(model.watchlistPortfolioState.some((item) => item.label === "Watchlist performance" && item.status === "limited"));
  assert.ok(model.cockpitCards.some((card) => card.label === "Strategy evolution"));
});

test("phase 25.5 proof validates 90+ symbol, history, and performance maturity with large-universe search", () => {
  const report = measureSymbolHistoryPerformancePolishProof({ modelBuildBudgetMs: 1_000, samples: 16, searchBudgetMs: 1_000, symbolCount: 520 });

  assert.equal(report.overallStatus, "ready");
  assert.equal(report.indexSize >= 500, true);
  assert.equal(report.symbolScore >= 90, true);
  assert.equal(report.historyScore >= 90, true);
  assert.equal(report.performanceScore >= 90, true);
  assert.equal(report.metrics.every((metric) => metric.pass), true);
  assert.ok(report.unsupportedClaims.some((claim) => claim.includes("No Bloomberg")));
});
