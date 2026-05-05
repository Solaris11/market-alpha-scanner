import "server-only";

import { getFullRanking, getMarketRegime as getRegimeArtifact, getMarketStructure, getSymbolDetail, getSymbolHistoryForSymbol, getTopCandidates } from "@/lib/scanner-data";
import { getPaperAnalytics } from "@/lib/paper-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToMarketRegime, applyStaleDataSafetyToRows, applyStaleDataSafetyToSymbolDetail } from "@/lib/stale-data-safety";
import type { RankingRow, SymbolDetail } from "@/lib/types";
import type { DataServiceAdapter, MarketRegime, SignalHistoryPoint, TerminalSnapshot } from "./DataServiceAdapter";
import { historyPointFromRow } from "./DataServiceAdapter";

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
  const riskMode = label.includes("OFF") || label.includes("BEAR") ? "risk-off" : label.includes("ON") || label.includes("BULL") ? "risk-on" : "neutral";
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
    source: artifact ? "artifact" : rows.length ? "inferred" : "unavailable",
  };
}

export class ScannerDataAdapter implements DataServiceAdapter {
  async getOverviewSignals(): Promise<RankingRow[]> {
    const [rows, safety] = await Promise.all([getFullRanking(), getCurrentScanSafety()]);
    return applyStaleDataSafetyToRows(rows, safety);
  }

  async getSymbolDetail(symbol: string): Promise<SymbolDetail> {
    const [detail, safety] = await Promise.all([getSymbolDetail(symbol), getCurrentScanSafety()]);
    if (detail.row) return applyStaleDataSafetyToSymbolDetail(detail, safety);
    return detail;
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
