import { buildEvidenceMaturity, type EvidenceMaturityLabel } from "./evidence-maturity";

export type EvidenceDepthWindow = {
  completedForwardReturnCount: number;
  forwardReturnCount: number;
  historicalDepthDays: number;
  memorySnapshotCount: number;
  scanRunCount: number;
  signalCount: number;
  uniqueSignalDays: number;
  uniqueSymbolCount: number;
  windowLabel: "30D" | "60D" | "90D";
};

export type EvidenceDepthDuplicateCheck = {
  duplicateGroups: number;
  label: string;
};

export type EvidenceDepthTableCount = {
  area: string;
  count: number;
};

export type EvidenceDepthSymbol = {
  evidenceMaturity: EvidenceMaturityLabel;
  forwardReturnCount: number;
  historicalDepthDays: number;
  memorySnapshotCount: number;
  outcomeCoverage: number;
  scannerSignalCount: number;
  symbol: string;
};

export type EvidenceDepthSummary = {
  duplicateChecks: EvidenceDepthDuplicateCheck[];
  generatedAt: string;
  label: EvidenceMaturityLabel;
  maturityScore: number;
  remainingGaps: string[];
  representativeSymbols: EvidenceDepthSymbol[];
  summary: string;
  tableCounts: EvidenceDepthTableCount[];
  windows: EvidenceDepthWindow[];
};

export function buildEvidenceDepthSummary(input: {
  duplicateChecks: EvidenceDepthDuplicateCheck[];
  generatedAt?: string;
  representativeSymbols: Omit<EvidenceDepthSymbol, "evidenceMaturity">[];
  tableCounts: EvidenceDepthTableCount[];
  windows: EvidenceDepthWindow[];
}): EvidenceDepthSummary {
  const primary = input.windows.find((window) => window.windowLabel === "90D") ?? input.windows[input.windows.length - 1] ?? emptyWindow();
  const outcomeCoverage = primary.forwardReturnCount > 0 ? (primary.completedForwardReturnCount / primary.forwardReturnCount) * 100 : 0;
  const memoryCoverage = primary.signalCount > 0 ? (primary.memorySnapshotCount / primary.signalCount) * 100 : 0;
  const duplicatePenalty = input.duplicateChecks.some((check) => check.duplicateGroups > 0) ? 18 : 0;
  const representativeMedian = median(input.representativeSymbols.map((symbol) => symbol.forwardReturnCount));
  const representativeDepth = median(input.representativeSymbols.map((symbol) => symbol.historicalDepthDays));
  const maturity = buildEvidenceMaturity({
    analogQualityScore: memoryCoverage,
    confidenceReliability: duplicatePenalty > 0 ? 45 : 72,
    evidenceSampleSize: Math.max(primary.completedForwardReturnCount, representativeMedian),
    historicalDepthDays: Math.max(primary.uniqueSignalDays, representativeDepth),
    outcomeCoverage,
  });
  const maturityScore = Math.max(0, maturity.score - duplicatePenalty);
  const label = scoreLabel(maturityScore, primary.completedForwardReturnCount, primary.uniqueSignalDays, outcomeCoverage);
  const representativeSymbols = input.representativeSymbols.map((symbol) => ({
    ...symbol,
    evidenceMaturity: buildEvidenceMaturity({
      analogQualityScore: symbol.memorySnapshotCount >= 100 ? 78 : 45,
      confidenceReliability: 70,
      evidenceSampleSize: symbol.forwardReturnCount,
      historicalDepthDays: symbol.historicalDepthDays,
      outcomeCoverage: symbol.outcomeCoverage,
    }).label,
  }));
  const remainingGaps = gapsFor({ duplicatePenalty, label, outcomeCoverage, primary, representativeMedian });
  return {
    duplicateChecks: input.duplicateChecks,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    label,
    maturityScore,
    remainingGaps,
    representativeSymbols,
    summary: summaryFor(label, maturityScore, primary, outcomeCoverage),
    tableCounts: input.tableCounts,
    windows: input.windows,
  };
}

function scoreLabel(score: number, sampleSize: number, days: number, outcomeCoverage: number): EvidenceMaturityLabel {
  if (score >= 86 && sampleSize >= 20_000 && days >= 90 && outcomeCoverage >= 70) return "High Confidence Evidence";
  if (score >= 72 && sampleSize >= 10_000 && days >= 30 && outcomeCoverage >= 55) return "Mature Evidence";
  if (score >= 45 && sampleSize >= 2_000 && days >= 10) return "Developing Evidence";
  return "Limited Evidence";
}

function gapsFor(input: { duplicatePenalty: number; label: EvidenceMaturityLabel; outcomeCoverage: number; primary: EvidenceDepthWindow; representativeMedian: number }): string[] {
  const gaps: string[] = [];
  if (input.primary.uniqueSignalDays < 30) gaps.push("Calendar depth is still below the first 30-day target.");
  if (input.primary.uniqueSignalDays < 60) gaps.push("60/90-day evidence views need more market days before 95+ claims are honest.");
  if (input.outcomeCoverage < 60) gaps.push("Forward-return outcome coverage is not yet broad enough for strong calibration.");
  if (input.representativeMedian < 100) gaps.push("Representative symbols need at least 100 completed observations each for mature per-symbol claims.");
  if (input.duplicatePenalty > 0) gaps.push("Duplicate integrity checks found rows that must be reconciled before trust scores improve.");
  if (!gaps.length && input.label !== "High Confidence Evidence") gaps.push("Evidence is usable, but high-confidence proof still needs longer calendar history.");
  return gaps;
}

function summaryFor(label: EvidenceMaturityLabel, score: number, primary: EvidenceDepthWindow, outcomeCoverage: number): string {
  return `${label}: ${score}/100 proof score from ${primary.completedForwardReturnCount.toLocaleString()} completed forward outcomes, ${primary.uniqueSignalDays.toLocaleString()} unique signal days, and ${outcomeCoverage.toFixed(1)}% outcome coverage in the 90-day evidence view.`;
}

function emptyWindow(): EvidenceDepthWindow {
  return {
    completedForwardReturnCount: 0,
    forwardReturnCount: 0,
    historicalDepthDays: 0,
    memorySnapshotCount: 0,
    scanRunCount: 0,
    signalCount: 0,
    uniqueSignalDays: 0,
    uniqueSymbolCount: 0,
    windowLabel: "90D",
  };
}

function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}
