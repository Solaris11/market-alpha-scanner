import type { CsvRow, PerformanceData, RankingRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";

export type HistoricalEdgeProof = {
  available: boolean;
  avgReturn: number | null;
  bestHorizon: string;
  groupLabel: string;
  sampleSize: number;
  source: "performance_summary" | "auto_calibration" | "none";
  winRate: number | null;
};

type Candidate = {
  avgReturn: number | null;
  count: number;
  groupType: string;
  groupValue: string;
  horizon: string;
  source: HistoricalEdgeProof["source"];
  winRate: number | null;
  weight: number;
};

const MIN_SAMPLE = 20;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return clean(value).toUpperCase().replace(/\s+/g, " ").replaceAll("_", " ");
}

function scoreBucket(score: unknown) {
  const value = finiteNumber(score);
  if (value === null) return "";
  if (value >= 80) return "80+";
  if (value >= 70) return "70-79";
  if (value >= 60) return "60-69";
  if (value >= 50) return "50-59";
  return "<50";
}

function action(row: RankingRow) {
  return clean(row.action ?? row.recommended_action ?? row.composite_action ?? row.mid_action ?? row.short_action ?? row.long_action);
}

function rowValue(row: RankingRow, groupType: string) {
  if (groupType === "score_bucket") return scoreBucket(row.final_score);
  if (groupType === "action") return action(row);
  return clean(row[groupType]);
}

function groupWeight(groupType: string) {
  if (groupType === "setup_type") return 9;
  if (groupType === "recommendation_quality") return 8;
  if (groupType === "score_bucket") return 7;
  if (groupType === "sector") return 6;
  if (groupType === "rating") return 5;
  if (groupType === "entry_status") return 4;
  if (groupType === "asset_type") return 3;
  if (groupType === "action") return 2;
  return 1;
}

function candidateFromSummary(row: CsvRow, signal: RankingRow): Candidate | null {
  const groupType = clean(row.group_type);
  const groupValue = clean(row.group_value);
  if (!groupType || !groupValue) return null;
  const signalValue = rowValue(signal, groupType);
  if (!signalValue || normalized(signalValue) !== normalized(groupValue)) return null;
  return {
    avgReturn: finiteNumber(row.avg_return),
    count: finiteNumber(row.count) ?? 0,
    groupType,
    groupValue,
    horizon: clean(row.horizon) || "N/A",
    source: "performance_summary",
    winRate: finiteNumber(row.hit_rate),
    weight: groupWeight(groupType),
  };
}

function candidateFromCalibration(row: CsvRow, signal: RankingRow): Candidate | null {
  const groupType = clean(row.group_type);
  const groupValue = clean(row.group_value);
  if (!groupType || !groupValue) return null;
  const signalValue = rowValue(signal, groupType);
  if (!signalValue || normalized(signalValue) !== normalized(groupValue)) return null;
  return {
    avgReturn: finiteNumber(row.avg_return),
    count: finiteNumber(row.count) ?? 0,
    groupType,
    groupValue,
    horizon: clean(row.horizon) || "N/A",
    source: "auto_calibration",
    winRate: finiteNumber(row.hit_rate),
    weight: groupWeight(groupType) - 0.5,
  };
}

function descriptiveGroup(signal: RankingRow, candidate: Candidate) {
  const parts = [clean(signal.sector), clean(signal.setup_type), scoreBucket(signal.final_score)].filter(Boolean);
  if (parts.length >= 2) return parts.join(" + ");
  return `${candidate.groupType.replaceAll("_", " ")}: ${candidate.groupValue}`;
}

export function buildHistoricalEdgeProof(signal: RankingRow, performance: PerformanceData | null): HistoricalEdgeProof {
  if (!performance) {
    return { available: false, avgReturn: null, bestHorizon: "N/A", groupLabel: "Not enough historical data", sampleSize: 0, source: "none", winRate: null };
  }

  const candidates = [
    ...performance.summary.rows.map((row) => candidateFromSummary(row, signal)),
    ...performance.autoCalibration.rows.map((row) => candidateFromCalibration(row, signal)),
  ].filter((candidate): candidate is Candidate => Boolean(candidate));

  const ranked = candidates
    .filter((candidate) => candidate.count >= MIN_SAMPLE)
    .sort((left, right) => {
      const returnDelta = (right.avgReturn ?? -999) - (left.avgReturn ?? -999);
      if (Math.abs(returnDelta) > 0.0001) return returnDelta;
      if (right.weight !== left.weight) return right.weight - left.weight;
      return right.count - left.count;
    });
  const best = ranked[0];

  if (!best) {
    const sample = candidates.sort((left, right) => right.count - left.count)[0]?.count ?? 0;
    return { available: false, avgReturn: null, bestHorizon: "N/A", groupLabel: "Not enough historical data", sampleSize: sample, source: "none", winRate: null };
  }

  return {
    available: true,
    avgReturn: best.avgReturn,
    bestHorizon: best.horizon,
    groupLabel: descriptiveGroup(signal, best),
    sampleSize: best.count,
    source: best.source,
    winRate: best.winRate,
  };
}
