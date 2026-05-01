import "server-only";

import { getFullRanking, getMarketRegime as getRegimeArtifact, getMarketStructure, getSymbolDetail, getSymbolHistoryForSymbol, getTopCandidates } from "@/lib/scanner-data";
import { getPaperAnalytics } from "@/lib/paper-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToMarketRegime, applyStaleDataSafetyToRow, applyStaleDataSafetyToRows, applyStaleDataSafetyToSymbolDetail } from "@/lib/stale-data-safety";
import type { RankingRow, SymbolDetail } from "@/lib/types";
import type { DataServiceAdapter, MarketRegime, SignalHistoryPoint, TerminalSnapshot } from "./DataServiceAdapter";
import { historyPointFromRow } from "./DataServiceAdapter";

const MOCK_SIGNALS: RankingRow[] = [
  { symbol: "TSM", company_name: "Taiwan Semiconductor", sector: "Semiconductors", asset_type: "Equity", price: 192.4, final_score: 91, final_decision: "ENTER", recommendation_quality: "TRADE_READY", rating: "TOP", action: "BUY", setup_type: "breakout continuation", entry_status: "GOOD ENTRY", suggested_entry: 192.4, stop_loss: 185, conservative_target: 210, risk_reward: 2.4, decision_reason: "Strong trend, clean entry, and acceptable risk/reward." },
  { symbol: "AVGO", company_name: "Broadcom", sector: "Semiconductors", asset_type: "Equity", price: 429.31, final_score: 86, final_decision: "WAIT_PULLBACK", recommendation_quality: "WAIT_PULLBACK", rating: "ACTIONABLE", action: "BUY", setup_type: "trend pullback", entry_status: "OVEREXTENDED", suggested_entry: 410, stop_loss: 392, conservative_target: 455, risk_reward: 1.9, decision_reason: "High-quality setup but price is extended." },
  { symbol: "MSFT", company_name: "Microsoft", sector: "Software", asset_type: "Equity", price: 421.8, final_score: 82, final_decision: "WATCH", recommendation_quality: "LOW_EDGE", rating: "WATCH", action: "WAIT", setup_type: "base build", entry_status: "NEAR ENTRY", suggested_entry: 416, stop_loss: 398, conservative_target: 445, risk_reward: 1.6, decision_reason: "Quality name, but current edge is moderate." },
  { symbol: "NVDA", company_name: "Nvidia", sector: "Technology", asset_type: "Equity", price: 875.3, final_score: 79, final_decision: "WATCH", recommendation_quality: "LOW_EDGE", rating: "WATCH", action: "WAIT", setup_type: "trend consolidation", entry_status: "NEAR ENTRY", suggested_entry: 852, stop_loss: 812, conservative_target: 930, risk_reward: 1.9, decision_reason: "Technology leadership remains strong, but entry quality needs confirmation." },
  { symbol: "HAL", company_name: "Halliburton", sector: "Energy", asset_type: "Equity", price: 37.42, final_score: 74, final_decision: "WATCH", recommendation_quality: "LOW_EDGE", rating: "WATCH", action: "WAIT", setup_type: "trend recovery", entry_status: "NEAR ENTRY", suggested_entry: 36.8, stop_loss: 34.9, conservative_target: 41.5, risk_reward: 2.1, decision_reason: "Energy setup is improving but still needs stronger confirmation." },
  { symbol: "IBIT", company_name: "iShares Bitcoin Trust", sector: "Bitcoin", asset_type: "ETF", price: 58.2, final_score: 64, final_decision: "WATCH", recommendation_quality: "LOW_EDGE", rating: "WATCH", action: "WAIT", setup_type: "volatile base", entry_status: "NEAR ENTRY", suggested_entry: 56.5, stop_loss: 52.8, conservative_target: 64, risk_reward: 2.0, decision_reason: "Crypto proxy remains volatile; wait for cleaner confirmation." },
  { symbol: "TSLA", company_name: "Tesla", sector: "Consumer Discretionary", asset_type: "Equity", price: 177.2, final_score: 39, final_decision: "AVOID", recommendation_quality: "AVOID", rating: "PASS", action: "WAIT", setup_type: "mixed setup", entry_status: "STOP RISK", suggested_entry: 168, stop_loss: 160, conservative_target: 188, risk_reward: 1.2, decision_reason: "Volatility and risk/reward do not clear the gate." },
  { symbol: "BAC", company_name: "Bank of America", sector: "Financials", asset_type: "Equity", price: 38.7, final_score: 31, final_decision: "EXIT", recommendation_quality: "AVOID", rating: "EXIT", action: "SELL", setup_type: "trend invalidation", entry_status: "STOP RISK", suggested_entry: 40.5, stop_loss: 38.8, conservative_target: 44, risk_reward: 2.1, decision_reason: "Exit signal is active after trend invalidation." },
];

function countDecision(rows: RankingRow[], decision: string) {
  return rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === decision).length;
}

function sectorLeaders(rows: RankingRow[], takeBest: boolean) {
  const scores = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const sector = String(row.sector ?? "Unclassified");
    const score = typeof row.final_score === "number" ? row.final_score : 0;
    const current = scores.get(sector) ?? { total: 0, count: 0 };
    scores.set(sector, { total: current.total + score, count: current.count + 1 });
  }
  return Array.from(scores.entries())
    .map(([sector, value]) => ({ sector, avg: value.count ? value.total / value.count : 0 }))
    .sort((a, b) => (takeBest ? b.avg - a.avg : a.avg - b.avg))
    .slice(0, 4)
    .map((item) => item.sector);
}

function inferRegime(rows: RankingRow[], artifact: Record<string, unknown> | null, structure: Record<string, unknown> | null): MarketRegime {
  const enter = countDecision(rows, "ENTER");
  const avoid = countDecision(rows, "AVOID");
  const label = String(artifact?.regime ?? (enter > avoid ? "RISK_ON" : avoid > enter ? "RISK_OFF" : "NEUTRAL")).toUpperCase();
  const riskMode = label.includes("OFF") ? "risk-off" : label.includes("ON") ? "risk-on" : "neutral";
  const confidence = typeof artifact?.confidence === "number" ? artifact.confidence : Math.min(100, 45 + Math.abs(enter - avoid) * 3);
  return {
    label,
    riskMode,
    confidence,
    breadth: String(structure?.breadth ?? "inferred").toUpperCase(),
    leadership: String(structure?.leadership ?? "scanner leaders").toUpperCase(),
    strongestSectors: sectorLeaders(rows, true),
    weakestSectors: sectorLeaders(rows, false),
    aggressiveEntriesAllowed: riskMode === "risk-on" && enter >= avoid,
    source: artifact ? "artifact" : rows.length ? "inferred" : "mock",
  };
}

export class ScannerDataAdapter implements DataServiceAdapter {
  async getOverviewSignals(): Promise<RankingRow[]> {
    const [rows, safety] = await Promise.all([getFullRanking(), getCurrentScanSafety()]);
    return applyStaleDataSafetyToRows(rows.length ? rows : MOCK_SIGNALS, safety);
  }

  async getSymbolDetail(symbol: string): Promise<SymbolDetail> {
    const [detail, safety] = await Promise.all([getSymbolDetail(symbol), getCurrentScanSafety()]);
    if (detail.row) return applyStaleDataSafetyToSymbolDetail(detail, safety);
    const mock = MOCK_SIGNALS.find((row) => row.symbol === symbol.trim().toUpperCase());
    return mock ? { row: applyStaleDataSafetyToRow(mock, safety), summary: null, history: [] } : detail;
  }

  async getMarketRegime(): Promise<MarketRegime> {
    const [rows, regime, structure, safety] = await Promise.all([getFullRanking(), getRegimeArtifact(), getMarketStructure(), getCurrentScanSafety()]);
    return applyStaleDataSafetyToMarketRegime(inferRegime(rows, regime, structure), safety);
  }

  async getSignalHistory(symbol: string): Promise<SignalHistoryPoint[]> {
    const [rows, safety] = await Promise.all([getSymbolHistoryForSymbol(symbol), getCurrentScanSafety()]);
    return applyStaleDataSafetyToRows(rows, safety).map((row) => historyPointFromRow(row, new Date().toISOString())).slice(-40);
  }

  async getTerminalSnapshot(): Promise<TerminalSnapshot> {
    const [signals, topSignals, marketRegime, analytics, safety] = await Promise.all([
      this.getOverviewSignals(),
      getTopCandidates(),
      this.getMarketRegime(),
      getPaperAnalytics().catch(() => null),
      getCurrentScanSafety(),
    ]);
    const safeTopSignals = applyStaleDataSafetyToRows(topSignals.length ? topSignals : signals.slice(0, 12), safety);
    return {
      signals,
      topSignals: safeTopSignals,
      marketRegime,
      historyPreview: [],
      paperSummary: {
        totalTrades: analytics?.summary.total_trades ?? 0,
        winRate: analytics?.summary.win_rate ?? 0,
        totalPnl: analytics?.summary.total_pnl ?? 0,
        openTrades: analytics?.summary.open_trades ?? 0,
      },
    };
  }
}
