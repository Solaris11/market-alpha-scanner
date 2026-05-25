import type { HistorySummary, PerformanceData, RankingRow, SymbolHistoryRow } from "../types";
import {
  buildHistoryWorkflowMaturityModel,
  buildPerformanceWorkflowMaturityModel,
  buildSymbolSearchIndex,
  buildSymbolWorkflowMaturityModel,
  searchSymbolIndex,
  type SymbolSearchDocument,
} from "./symbol-workflow-maturity";

export type SymbolHistoryPerformanceProofMetric = {
  budgetMs: number;
  id: "large-universe-search" | "fuzzy-search" | "watchlist-replay-search" | "model-build";
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  pass: boolean;
  samples: number;
};

export type SymbolHistoryPerformanceProofReport = {
  blockers: string[];
  generatedAt: string;
  historyScore: number;
  indexSize: number;
  metrics: SymbolHistoryPerformanceProofMetric[];
  overallStatus: "ready" | "not_ready";
  performanceScore: number;
  proofScope: string;
  symbolScore: number;
  unsupportedClaims: string[];
};

const SEARCH_BUDGET_MS = 50;
const MODEL_BUILD_BUDGET_MS = 100;

export function measureSymbolHistoryPerformancePolishProof(input: { modelBuildBudgetMs?: number; samples?: number; searchBudgetMs?: number; symbolCount?: number } = {}): SymbolHistoryPerformanceProofReport {
  const samples = Math.max(12, input.samples ?? 48);
  const searchBudgetMs = input.searchBudgetMs ?? SEARCH_BUDGET_MS;
  const modelBuildBudgetMs = input.modelBuildBudgetMs ?? MODEL_BUILD_BUDGET_MS;
  const rows = buildSyntheticRankingRows(Math.max(500, input.symbolCount ?? 760));
  const historyRows = buildSyntheticHistoryRows(rows.slice(0, 42));
  const history = buildSyntheticHistorySummary(historyRows);
  const performance = buildSyntheticPerformanceData(rows);
  const index = buildSymbolSearchIndex({
    historySymbols: historyRows.map((row) => row.symbol),
    recentSymbols: ["AMD", "NVDA", "TV0008"],
    rows,
    watchlistSymbols: rows.slice(0, 80).map((row) => row.symbol),
  });
  const targetRow = rows.find((row) => row.symbol === "AMD") ?? rows[0]!;
  let symbolScore = 0;
  let historyScore = 0;
  let performanceScore = 0;
  const metrics: SymbolHistoryPerformanceProofMetric[] = [
    measureOperation({
      budgetMs: searchBudgetMs,
      id: "large-universe-search",
      operation: () => searchChecksum(searchSymbolIndex(index, "semiconductors macro replay", { sourceTags: ["macro"], sort: "relevance" }, 12).results),
      samples,
    }),
    measureOperation({
      budgetMs: searchBudgetMs,
      id: "fuzzy-search",
      operation: () => searchChecksum(searchSymbolIndex(index, "advaned micro devces", {}, 12).results),
      samples,
    }),
    measureOperation({
      budgetMs: searchBudgetMs,
      id: "watchlist-replay-search",
      operation: () => searchChecksum(searchSymbolIndex(index, "replay memory", { sourceTags: ["history"], watchlistOnly: true, sort: "history" }, 12).results),
      samples,
    }),
    measureOperation({
      budgetMs: modelBuildBudgetMs,
      id: "model-build",
      operation: () => {
        const symbolModel = buildSymbolWorkflowMaturityModel({
          history: historyRows
            .filter((row) => row.symbol === "AMD")
            .map((row) => ({
              entry_status: row.final_decision,
              final_decision: row.final_decision,
              final_score: typeof row.final_score === "number" ? row.final_score : null,
              price: typeof row.price === "number" ? row.price : null,
              timestamp: row.timestamp_utc,
            })),
          marketMemoryAvailable: true,
          row: targetRow,
          symbol: "AMD",
          workflowChanges: [
            { detail: "AMD moved from watchlist replay into a higher-confidence semiconductor comparison.", metricLabel: "workflow memory", title: "Continue symbol" },
            { detail: "Replay analog and macro chronology both remained available for continuation.", metricLabel: "replay", title: "Replay continuity" },
          ],
        });
        const historyModel = buildHistoryWorkflowMaturityModel({ history, rows: historyRows, selectedSymbol: "AMD" });
        const performanceModel = buildPerformanceWorkflowMaturityModel({ history, performance, rankingRows: rows });
        symbolScore = symbolModel.maturityScore;
        historyScore = historyModel.score;
        performanceScore = performanceModel.score;
        return symbolScore + historyScore + performanceScore;
      },
      samples,
    }),
  ];
  const blockers: string[] = [];
  if (index.length < 500) blockers.push("Symbol search index is below 500 documents.");
  if (symbolScore < 90) blockers.push(`Symbol Detail proof score ${symbolScore} is below 90.`);
  if (historyScore < 90) blockers.push(`History proof score ${historyScore} is below 90.`);
  if (performanceScore < 90) blockers.push(`Performance proof score ${performanceScore} is below 90.`);
  for (const metric of metrics) {
    if (!metric.pass) blockers.push(`${metric.id} p95 ${metric.p95Ms}ms exceeds ${metric.budgetMs}ms.`);
  }
  return {
    blockers,
    generatedAt: new Date().toISOString(),
    historyScore,
    indexSize: index.length,
    metrics,
    overallStatus: blockers.length ? "not_ready" : "ready",
    performanceScore,
    proofScope: "Deterministic proof for symbol search, history maturity, and performance maturity using large synthetic scanner/history/performance evidence. This validates workflow mechanics and scoring gates, not competitor parity or real-user retention.",
    symbolScore,
    unsupportedClaims: [
      "No Bloomberg, TradingView, StockTitan, or Finviz parity claim.",
      "No fabricated provider event, return, fill, broker, or trading advice claim.",
      "Real production cohort behavior and manual UX proof remain separate certification evidence.",
    ],
  };
}

function measureOperation(config: { budgetMs: number; id: SymbolHistoryPerformanceProofMetric["id"]; operation: () => number; samples: number }): SymbolHistoryPerformanceProofMetric {
  const durations: number[] = [];
  let checksum = 0;
  for (let index = 0; index < config.samples; index += 1) {
    const startedAt = nowMs();
    checksum += config.operation();
    durations.push(Math.max(0, nowMs() - startedAt + checksum * 0));
  }
  const sorted = [...durations].sort((left, right) => left - right);
  const p50Ms = percentile(sorted, 50);
  const p95Ms = percentile(sorted, 95);
  return {
    budgetMs: config.budgetMs,
    id: config.id,
    maxMs: roundMetric(sorted[sorted.length - 1] ?? 0),
    p50Ms,
    p95Ms,
    pass: p95Ms <= config.budgetMs,
    samples: config.samples,
  };
}

function searchChecksum(results: Array<{ document: SymbolSearchDocument; score: number }>): number {
  return results.reduce((sum, result) => sum + result.document.symbol.length + Math.round(result.score), 0);
}

function buildSyntheticRankingRows(count: number): RankingRow[] {
  const sectors = ["Technology", "Semiconductors", "Energy", "Financials", "Healthcare", "Industrials", "Crypto"];
  const setups = ["breakout", "rotation", "replay analog", "macro divergence", "risk compression"];
  const rows: RankingRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const symbol = index < 6 ? ["AMD", "NVDA", "AAPL", "MSFT", "TSLA", "XLE"][index]! : `TV${index.toString().padStart(4, "0")}`;
    const sector = sectors[index % sectors.length] ?? "Technology";
    const setup = setups[index % setups.length] ?? "breakout";
    rows.push({
      analog_quality_score: 50 + ((index * 23) % 50),
      company_name: symbol === "AMD" ? "Advanced Micro Devices" : `${symbol} Synthetic Research Co`,
      event_context_summary: `${sector} source-linked event context for ${setup} review.`,
      event_risk_score: 35 + ((index * 17) % 60),
      final_decision: index % 5 === 0 ? "WATCH" : index % 4 === 0 ? "REVIEW" : "RESEARCH",
      final_score: 42 + ((index * 19) % 57),
      macro_context_label: index % 3 === 0 ? "risk_on" : index % 3 === 1 ? "inflation hedge" : "liquidity pressure",
      macro_context_summary: `${sector} macro-aware scanner context with replay memory.`,
      market_regime: index % 2 === 0 ? "risk_on" : "risk_off",
      rank_position: index + 1,
      risk_pressure_score: 25 + ((index * 13) % 70),
      sector,
      setup_type: setup,
      symbol,
    });
  }
  return rows;
}

function buildSyntheticHistoryRows(rows: RankingRow[]): SymbolHistoryRow[] {
  const historyRows: SymbolHistoryRow[] = [];
  const dates = ["2026-05-01", "2026-05-05", "2026-05-09", "2026-05-13", "2026-05-17", "2026-05-21", "2026-05-24"];
  for (const [rowIndex, row] of rows.entries()) {
    for (const [dateIndex, date] of dates.entries()) {
      historyRows.push({
        ...row,
        event_context_summary: dateIndex % 2 === 0 ? `${row.symbol} chronology event changed ${row.sector} risk.` : row.event_context_summary,
        final_score: Math.max(20, Math.min(98, Number(row.final_score ?? 50) - 12 + dateIndex * 4 + (rowIndex % 3))),
        market_regime: dateIndex < 2 ? "risk_off" : dateIndex < 5 ? "risk_on" : "liquidity pressure",
        news_headline: dateIndex % 3 === 0 ? `${row.symbol} source-linked event chronology update` : undefined,
        source_file: `synthetic:${date}`,
        timestamp_utc: `${date}T14:00:00.000Z`,
      });
    }
  }
  return historyRows;
}

function buildSyntheticHistorySummary(rows: SymbolHistoryRow[]): HistorySummary {
  const timestamps = rows.map((row) => row.timestamp_utc).sort();
  return {
    count: rows.length,
    earliest: timestamps[0] ?? null,
    latest: timestamps[timestamps.length - 1] ?? null,
    snapshots: timestamps.slice(0, 40).map((timestamp) => ({ modifiedAt: timestamp, name: `Synthetic snapshot ${timestamp}`, timestamp })),
    uniqueDates: Array.from(new Set(timestamps.map((timestamp) => timestamp.slice(0, 10)))).sort(),
  };
}

function buildSyntheticPerformanceData(rows: RankingRow[]): PerformanceData {
  const forwardRows = rows.slice(0, 180).map((row, index) => {
    const score = Number(row.final_score ?? 50);
    const expectedPositive = score >= 60;
    return {
      final_score: score,
      return_pct: expectedPositive ? (index % 7 === 0 ? -0.01 : 0.02 + (index % 5) / 100) : (index % 4 === 0 ? 0.01 : -0.015),
      symbol: row.symbol,
    };
  });
  return {
    autoCalibration: { columns: [], lineCount: 0, rows: [], state: "missing" },
    forwardReturns: { columns: ["symbol", "final_score", "return_pct"], lineCount: forwardRows.length + 1, rows: forwardRows, state: "data" },
    lifecycle: { columns: ["symbol", "state"], lineCount: 61, rows: rows.slice(0, 60).map((row) => ({ state: "completed", symbol: row.symbol })), state: "data" },
    lifecycleSummary: { columns: ["strategy", "change"], lineCount: 4, rows: [{ change: "risk filters tightened", strategy: "scanner" }, { change: "replay weighting improved", strategy: "replay" }, { change: "macro filter added", strategy: "macro" }], state: "data" },
    summary: { columns: [], lineCount: 0, rows: [], state: "missing" },
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

function nowMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}
