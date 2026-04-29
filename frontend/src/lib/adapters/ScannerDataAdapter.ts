import "server-only";

import { getFullRanking, getMarketRegime as getRegimeArtifact, getMarketStructure, getSymbolDetail, getSymbolHistoryForSymbol, getTopCandidates } from "@/lib/scanner-data";
import { getPaperAnalytics } from "@/lib/paper-data";
import type { RankingRow, SymbolDetail } from "@/lib/types";
import type { DataServiceAdapter, MarketRegime, SignalHistoryPoint, TerminalSnapshot } from "./DataServiceAdapter";
import { historyPointFromRow } from "./DataServiceAdapter";

const MOCK_SIGNALS: RankingRow[] = [
  { symbol: "TSM", company_name: "Taiwan Semiconductor", sector: "Semiconductors", asset_type: "Equity", price: 192.4, final_score: 91, final_decision: "ENTER", recommendation_quality: "TRADE_READY", rating: "TOP", action: "BUY", setup_type: "breakout continuation", entry_status: "GOOD ENTRY", suggested_entry: 192.4, stop_loss: 185, conservative_target: 210, risk_reward: 2.4, decision_reason: "Strong trend, clean entry, and acceptable risk/reward." },
  { symbol: "AVGO", company_name: "Broadcom", sector: "Semiconductors", asset_type: "Equity", price: 429.31, final_score: 86, final_decision: "WAIT_PULLBACK", recommendation_quality: "WAIT_PULLBACK", rating: "ACTIONABLE", action: "BUY", setup_type: "trend pullback", entry_status: "OVEREXTENDED", suggested_entry: 410, stop_loss: 392, conservative_target: 455, risk_reward: 1.9, decision_reason: "High-quality setup but price is extended." },
  { symbol: "MSFT", company_name: "Microsoft", sector: "Software", asset_type: "Equity", price: 421.8, final_score: 82, final_decision: "WATCH", recommendation_quality: "LOW_EDGE", rating: "WATCH", action: "WAIT", setup_type: "base build", entry_status: "NEAR ENTRY", suggested_entry: 416, stop_loss: 398, conservative_target: 445, risk_reward: 1.6, decision_reason: "Quality name, but current edge is moderate." },
  { symbol: "TSLA", company_name: "Tesla", sector: "Consumer Discretionary", asset_type: "Equity", price: 177.2, final_score: 39, final_decision: "AVOID", recommendation_quality: "AVOID", rating: "PASS", action: "WAIT", setup_type: "mixed setup", entry_status: "STOP RISK", suggested_entry: 168, stop_loss: 160, conservative_target: 188, risk_reward: 1.2, decision_reason: "Volatility and risk/reward do not clear the gate." },
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
    const rows = await getFullRanking();
    return rows.length ? rows : MOCK_SIGNALS;
  }

  async getSymbolDetail(symbol: string): Promise<SymbolDetail> {
    const detail = await getSymbolDetail(symbol);
    if (detail.row) return detail;
    const mock = MOCK_SIGNALS.find((row) => row.symbol === symbol.trim().toUpperCase());
    return mock ? { row: mock, summary: null, history: [] } : detail;
  }

  async getMarketRegime(): Promise<MarketRegime> {
    const [rows, regime, structure] = await Promise.all([getFullRanking(), getRegimeArtifact(), getMarketStructure()]);
    return inferRegime(rows, regime, structure);
  }

  async getSignalHistory(symbol: string): Promise<SignalHistoryPoint[]> {
    const rows = await getSymbolHistoryForSymbol(symbol);
    return rows.map((row) => historyPointFromRow(row, new Date().toISOString())).slice(-40);
  }

  async getTerminalSnapshot(): Promise<TerminalSnapshot> {
    const [signals, topSignals, marketRegime, analytics] = await Promise.all([
      this.getOverviewSignals(),
      getTopCandidates(),
      this.getMarketRegime(),
      getPaperAnalytics().catch(() => null),
    ]);
    return {
      signals,
      topSignals: topSignals.length ? topSignals : signals.slice(0, 12),
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
