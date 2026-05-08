import type { RankingRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export type MarketMemoryOutcomePoint = {
  horizon: string;
  returnPct: number | null;
};

export type MarketMemoryCandidate = {
  decision: string | null;
  finalScore: number | null;
  marketRegime: string | null;
  outcomes: MarketMemoryOutcomePoint[];
  scoreBucket: string | null;
  sector: string | null;
  setupType: string | null;
  signalTimestamp: string;
  symbol: string;
};

export type MarketMemoryAnalog = MarketMemoryCandidate & {
  reasonCodes: string[];
  similarityScore: number;
};

export type EvidenceMaturityTier = "high" | "moderate" | "limited" | "unavailable";

export type EvidenceMaturity = {
  explanation: string;
  label: string;
  sampleSize: number;
  tier: EvidenceMaturityTier;
};

export type MarketMemoryOutcomeSummary = {
  averageReturn: number | null;
  downsideRisk: number | null;
  horizon: string;
  medianReturn: number | null;
  winRate: number | null;
};

export type MarketMemorySummary = {
  analogs: MarketMemoryAnalog[];
  available: boolean;
  evidence: EvidenceMaturity;
  narrative: string[];
  outcome: MarketMemoryOutcomeSummary | null;
};

const OUTCOME_HORIZON_PRIORITY = ["10D", "5D", "3D", "2D", "1D"];

export function scoreBucket(value: unknown): string | null {
  const score = finiteNumber(value);
  if (score === null) return null;
  if (score >= 85) return "85+";
  if (score >= 75) return "75-84";
  if (score >= 65) return "65-74";
  if (score >= 55) return "55-64";
  return "<55";
}

export function buildCurrentMemoryCandidate(row: RankingRow): MarketMemoryCandidate {
  return {
    decision: textOrNull(row.final_decision ?? row.action),
    finalScore: finiteNumber(row.final_score),
    marketRegime: textOrNull(row.market_regime),
    outcomes: [],
    scoreBucket: scoreBucket(row.final_score),
    sector: textOrNull(row.sector),
    setupType: textOrNull(row.setup_type),
    signalTimestamp: textOrNull(row.last_updated_utc ?? row.last_updated) ?? new Date(0).toISOString(),
    symbol: row.symbol.toUpperCase(),
  };
}

export function similarityReasons(current: MarketMemoryCandidate, candidate: MarketMemoryCandidate): string[] {
  const reasons: string[] = [];
  if (sameText(current.setupType, candidate.setupType)) reasons.push("same_setup_type");
  if (sameText(current.marketRegime, candidate.marketRegime)) reasons.push("similar_regime");
  if (sameText(current.sector, candidate.sector)) reasons.push("same_sector");
  if (sameText(current.scoreBucket, candidate.scoreBucket)) reasons.push("similar_score_range");
  if (sameText(current.decision, candidate.decision)) reasons.push("same_decision_state");
  if (current.symbol === candidate.symbol) reasons.push("same_symbol_memory");
  return reasons;
}

export function marketMemorySimilarity(current: MarketMemoryCandidate, candidate: MarketMemoryCandidate): number {
  let score = 0;
  if (sameText(current.setupType, candidate.setupType)) score += 32;
  if (sameText(current.marketRegime, candidate.marketRegime)) score += 22;
  if (sameText(current.sector, candidate.sector)) score += 16;
  if (sameText(current.scoreBucket, candidate.scoreBucket)) score += 14;
  if (sameText(current.decision, candidate.decision)) score += 8;
  if (current.symbol === candidate.symbol) score += 8;

  if (current.finalScore !== null && candidate.finalScore !== null) {
    score += Math.max(0, 12 - Math.abs(current.finalScore - candidate.finalScore) * 0.8);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function evidenceMaturity(sampleSize: number): EvidenceMaturity {
  if (sampleSize >= 100) {
    return {
      explanation: `High evidence confidence based on ${sampleSize} comparable historical setups. Treat it as context, not a prediction.`,
      label: "High evidence confidence",
      sampleSize,
      tier: "high",
    };
  }
  if (sampleSize >= 30) {
    return {
      explanation: `Moderate evidence confidence based on ${sampleSize} comparable historical setups. Outcomes can still vary by regime.`,
      label: "Moderate evidence confidence",
      sampleSize,
      tier: "moderate",
    };
  }
  if (sampleSize > 0) {
    return {
      explanation: `Limited historical evidence: only ${sampleSize} comparable setup${sampleSize === 1 ? "" : "s"} found so far.`,
      label: "Limited historical evidence",
      sampleSize,
      tier: "limited",
    };
  }
  return {
    explanation: "Market memory is still building. Similar historical setups are not available yet.",
    label: "No comparable memory yet",
    sampleSize,
    tier: "unavailable",
  };
}

export function buildMarketMemorySummary(row: RankingRow, candidates: MarketMemoryCandidate[], options: { maxAnalogs?: number } = {}): MarketMemorySummary {
  const current = buildCurrentMemoryCandidate(row);
  const matchedAnalogs = candidates
    .filter((candidate) => candidate.symbol && candidate.signalTimestamp)
    .filter((candidate) => candidate.symbol !== current.symbol || candidate.signalTimestamp !== current.signalTimestamp)
    .map((candidate) => ({
      ...candidate,
      reasonCodes: similarityReasons(current, candidate),
      similarityScore: marketMemorySimilarity(current, candidate),
    }))
    .filter((candidate) => candidate.similarityScore >= 35)
    .sort((left, right) => right.similarityScore - left.similarityScore || String(right.signalTimestamp).localeCompare(String(left.signalTimestamp)));
  const analogs = matchedAnalogs.slice(0, options.maxAnalogs ?? 24);

  const evidence = evidenceMaturity(matchedAnalogs.length);
  const outcome = matchedAnalogs.length ? summarizeOutcomes(matchedAnalogs) : null;
  return {
    analogs,
    available: matchedAnalogs.length > 0,
    evidence,
    narrative: buildNarrative(current, matchedAnalogs, outcome),
    outcome,
  };
}

export function summarizeOutcomes(analogs: MarketMemoryAnalog[]): MarketMemoryOutcomeSummary | null {
  const selected = selectOutcomeSeries(analogs);
  if (!selected) return null;
  const sorted = [...selected.values].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const midpoint = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
  return {
    averageReturn: total / sorted.length,
    downsideRisk: sorted[0] ?? null,
    horizon: selected.horizon,
    medianReturn: median,
    winRate: sorted.filter((value) => value > 0).length / sorted.length,
  };
}

function selectOutcomeSeries(analogs: MarketMemoryAnalog[]): { horizon: string; values: number[] } | null {
  for (const horizon of OUTCOME_HORIZON_PRIORITY) {
    const values = analogs
      .flatMap((analog) => analog.outcomes)
      .filter((outcome) => outcome.horizon.toUpperCase() === horizon)
      .map((outcome) => outcome.returnPct)
      .filter((value): value is number => value !== null);
    if (values.length >= 3) return { horizon, values };
  }
  return null;
}

function buildNarrative(current: MarketMemoryCandidate, analogs: MarketMemoryAnalog[], outcome: MarketMemoryOutcomeSummary | null): string[] {
  if (!analogs.length) return ["No comparable historical setup cluster is available yet."];
  const top = analogs[0];
  const setup = current.setupType ? humanizeLabel(current.setupType) : "current setup";
  const regime = current.marketRegime ? ` during ${humanizeLabel(current.marketRegime).toLowerCase()} conditions` : "";
  const lines = [`This ${setup.toLowerCase()} resembles ${analogs.length} comparable historical setup${analogs.length === 1 ? "" : "s"}${regime}.`];
  if (outcome) {
    lines.push(`Historically similar setups had a ${formatMemoryPercent(outcome.winRate)} positive-rate over ${outcome.horizon}, with median forward return of ${formatMemoryReturn(outcome.medianReturn)}.`);
  }
  lines.push(`Closest analog: ${top.symbol} on ${formatMemoryDate(top.signalTimestamp)} (${decisionLabel(top.decision)} / ${top.similarityScore}% similarity).`);
  return lines;
}

export function memoryReasonLabel(code: string): string {
  if (code === "same_setup_type") return "same setup";
  if (code === "similar_regime") return "similar regime";
  if (code === "same_sector") return "same sector";
  if (code === "similar_score_range") return "similar score";
  if (code === "same_decision_state") return "same decision state";
  if (code === "same_symbol_memory") return "same symbol memory";
  return humanizeLabel(code);
}

export function formatMemoryReturn(value: number | null): string {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

export function formatMemoryPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value * 100)}%`;
}

export function formatMemoryDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC", year: "numeric" }).format(timestamp);
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return null;
  return text;
}

function sameText(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  return left.trim().toUpperCase().replaceAll("_", " ") === right.trim().toUpperCase().replaceAll("_", " ");
}
