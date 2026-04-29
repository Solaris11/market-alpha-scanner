import { buildHistoricalEdgeProof, type HistoricalEdgeProof } from "@/lib/trading/edge-proof";
import type { PerformanceData, RankingRow } from "@/lib/types";
import { clamp, cleanText, finiteNumber, firstNumber } from "@/lib/ui/formatters";

export type ConvictionResult = {
  label: "High" | "Medium" | "Weak" | "Avoid";
  score: number;
};

export type BestTradeResult = {
  confidence: number;
  row: RankingRow;
  score: number;
} | null;

export type TradeLevels = {
  entry: number | null;
  stop: number | null;
  target: number | null;
};

export type EdgeLookup = Record<string, HistoricalEdgeProof | undefined>;

export function buildEdgeLookup(rows: RankingRow[], performance: PerformanceData | null): EdgeLookup {
  return Object.fromEntries(rows.map((row) => [row.symbol.toUpperCase(), buildHistoricalEdgeProof(row, performance)]));
}

export function decision(row: RankingRow) {
  return cleanText(row.final_decision ?? row.action, "WATCH").toUpperCase();
}

export function isActionableDecision(value: unknown) {
  const text = cleanText(value, "").toUpperCase();
  return text === "ENTER" || text === "WAIT_PULLBACK";
}

export function qualityWeight(value: unknown) {
  const quality = cleanText(value, "WATCH").toUpperCase();
  if (quality === "TRADE_READY") return 100;
  if (quality === "ACTIONABLE" || quality === "WAIT_PULLBACK") return 70;
  if (quality === "WATCH" || quality === "LOW_EDGE") return 40;
  if (quality === "AVOID") return 10;
  return 50;
}

export function recommendationBonus(value: unknown) {
  const quality = cleanText(value, "WATCH").toUpperCase();
  if (quality === "TRADE_READY") return 20;
  if (quality === "ACTIONABLE" || quality === "WAIT_PULLBACK") return 10;
  if (quality === "AVOID") return -20;
  return 0;
}

export function entryDistanceBonus(value: unknown) {
  const distance = finiteNumber(value);
  if (distance === null) return 0;
  if (distance <= 0.01) return 10;
  if (distance <= 0.02) return 5;
  return 0;
}

export function edgeScore(edge?: HistoricalEdgeProof) {
  if (!edge?.available || edge.winRate === null) return 50;
  return clamp(edge.winRate * 100);
}

export function historicalEdgeBonus(edge?: HistoricalEdgeProof) {
  if (!edge?.available || edge.winRate === null) return 0;
  return clamp((edge.winRate - 0.5) * 40, -10, 15);
}

export function computeConviction(row: RankingRow, edge?: HistoricalEdgeProof): ConvictionResult {
  const finalScore = clamp(finiteNumber(row.final_score) ?? 0);
  const score = Math.round(clamp((0.5 * finalScore) + (0.3 * qualityWeight(row.recommendation_quality ?? row.rating)) + (0.2 * edgeScore(edge))));
  return { score, label: convictionLabel(score) };
}

export function convictionLabel(score: number): ConvictionResult["label"] {
  if (score > 80) return "High";
  if (score >= 60) return "Medium";
  if (score >= 40) return "Weak";
  return "Avoid";
}

export function selectBestTradeNow(rows: RankingRow[], edges: EdgeLookup = {}): BestTradeResult {
  const candidates = rows.filter((row) => isActionableDecision(row.final_decision));
  if (!candidates.length) return null;
  const ranked = candidates
    .map((row) => {
      const edge = edges[row.symbol.toUpperCase()];
      const rawScore =
        (finiteNumber(row.final_score) ?? 0) +
        recommendationBonus(row.recommendation_quality ?? row.rating) +
        entryDistanceBonus(row.entry_distance_pct) +
        historicalEdgeBonus(edge);
      return {
        confidence: Math.round(clamp((rawScore / 145) * 100)),
        row,
        score: rawScore,
      };
    })
    .sort((left, right) => right.score - left.score || cleanText(left.row.symbol).localeCompare(cleanText(right.row.symbol)));
  return ranked[0] ?? null;
}

export function tradeLevels(row: RankingRow): TradeLevels {
  return {
    entry: firstNumber(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price),
    stop: firstNumber(row.stop_loss ?? row.invalidation_level),
    target: firstNumber(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price),
  };
}

export function shortReason(row: RankingRow) {
  return cleanText(row.decision_reason ?? row.quality_reason ?? row.selection_reason, "Decision reason is not available yet.");
}

export function edgeQualityLine(edge: HistoricalEdgeProof) {
  if (!edge.available || edge.winRate === null) return "Not enough historical data to judge this setup yet.";
  if (edge.winRate >= 0.57 && (edge.avgReturn ?? 0) > 0) return "This setup has historically performed good.";
  if (edge.winRate >= 0.48) return "This setup has historically performed moderate.";
  return "This setup has historically performed poor.";
}

export function edgeConfidenceLabel(edge: HistoricalEdgeProof) {
  if (edge.sampleSize < 20) return "Low confidence";
  if (edge.sampleSize <= 50) return "Medium confidence";
  return "High confidence";
}
