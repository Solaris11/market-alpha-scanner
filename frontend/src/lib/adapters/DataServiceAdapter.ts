import type { RankingRow, ScannerScalar, SymbolDetail } from "@/lib/types";

export type SignalHistoryPoint = {
  timestamp: string;
  final_score: number | null;
  final_decision: string;
  recommendation_quality: string;
  rating: string;
  entry_status: string;
  action: string;
};

export type MarketRegime = {
  label: string;
  riskMode: "risk-on" | "neutral" | "risk-off";
  confidence: number;
  breadth: string;
  leadership: string;
  strongestSectors: string[];
  weakestSectors: string[];
  aggressiveEntriesAllowed: boolean;
  source: "artifact" | "inferred" | "unavailable";
};

export type TerminalSnapshot = {
  signals: RankingRow[];
  topSignals: RankingRow[];
  marketRegime: MarketRegime;
  historyPreview: SignalHistoryPoint[];
  paperSummary: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    openTrades: number;
  };
};

export interface DataServiceAdapter {
  getOverviewSignals(): Promise<RankingRow[]>;
  getSymbolDetail(symbol: string): Promise<SymbolDetail>;
  getMarketRegime(): Promise<MarketRegime>;
  getSignalHistory(symbol: string): Promise<SignalHistoryPoint[]>;
  getTerminalSnapshot(): Promise<TerminalSnapshot>;
}

export function historyPointFromRow(row: Record<string, ScannerScalar>, fallbackTimestamp: string): SignalHistoryPoint {
  return {
    timestamp: String(row.timestamp_utc ?? row.datetime ?? row.date ?? fallbackTimestamp),
    final_score: typeof row.final_score === "number" ? row.final_score : null,
    final_decision: String(row.final_decision ?? "WATCH"),
    recommendation_quality: String(row.recommendation_quality ?? "UNKNOWN"),
    rating: String(row.rating ?? "N/A"),
    entry_status: String(row.entry_status ?? "N/A"),
    action: String(row.action ?? "N/A"),
  };
}
