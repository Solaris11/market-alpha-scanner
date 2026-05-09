import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceDepthSummary, type EvidenceDepthWindow } from "./evidence-depth";

function window(overrides: Partial<EvidenceDepthWindow>): EvidenceDepthWindow {
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
    ...overrides,
  };
}

test("evidence depth penalizes shallow calendar history even with many rows", () => {
  const summary = buildEvidenceDepthSummary({
    duplicateChecks: [{ duplicateGroups: 0, label: "scanner signals" }],
    representativeSymbols: [
      { forwardReturnCount: 285, historicalDepthDays: 16, memorySnapshotCount: 1448, outcomeCoverage: 82, scannerSignalCount: 1701, symbol: "AMD" },
      { forwardReturnCount: 265, historicalDepthDays: 16, memorySnapshotCount: 1437, outcomeCoverage: 80, scannerSignalCount: 1690, symbol: "DDOG" },
    ],
    tableCounts: [{ area: "forward_returns_completed", count: 31_124 }],
    windows: [
      window({ completedForwardReturnCount: 31_124, forwardReturnCount: 38_295, historicalDepthDays: 16, memorySnapshotCount: 159_643, scanRunCount: 1701, signalCount: 187_722, uniqueSignalDays: 16, uniqueSymbolCount: 111, windowLabel: "90D" }),
    ],
  });

  assert.equal(summary.label, "Developing Evidence");
  assert.ok(summary.remainingGaps.some((gap) => gap.includes("Calendar depth")));
  assert.match(summary.summary, /completed forward outcomes/);
});

test("evidence depth reports high confidence only with long calendar and clean duplicate checks", () => {
  const summary = buildEvidenceDepthSummary({
    duplicateChecks: [{ duplicateGroups: 0, label: "scanner signals" }],
    representativeSymbols: [
      { forwardReturnCount: 640, historicalDepthDays: 95, memorySnapshotCount: 2000, outcomeCoverage: 86, scannerSignalCount: 2100, symbol: "NVDA" },
      { forwardReturnCount: 620, historicalDepthDays: 95, memorySnapshotCount: 1980, outcomeCoverage: 84, scannerSignalCount: 2090, symbol: "TSM" },
    ],
    tableCounts: [{ area: "forward_returns_completed", count: 54_000 }],
    windows: [
      window({ completedForwardReturnCount: 54_000, forwardReturnCount: 60_000, historicalDepthDays: 95, memorySnapshotCount: 240_000, scanRunCount: 3200, signalCount: 250_000, uniqueSignalDays: 92, uniqueSymbolCount: 120, windowLabel: "90D" }),
    ],
  });

  assert.equal(summary.label, "High Confidence Evidence");
  assert.ok(summary.maturityScore >= 86);
  assert.doesNotMatch(summary.summary, /guaranteed|predict/i);
});

test("duplicate groups cap the proof score until integrity is repaired", () => {
  const summary = buildEvidenceDepthSummary({
    duplicateChecks: [{ duplicateGroups: 2, label: "scanner signals" }],
    representativeSymbols: [{ forwardReturnCount: 640, historicalDepthDays: 95, memorySnapshotCount: 2000, outcomeCoverage: 86, scannerSignalCount: 2100, symbol: "NVDA" }],
    tableCounts: [],
    windows: [window({ completedForwardReturnCount: 54_000, forwardReturnCount: 60_000, memorySnapshotCount: 240_000, signalCount: 250_000, uniqueSignalDays: 92, uniqueSymbolCount: 120 })],
  });

  assert.notEqual(summary.label, "High Confidence Evidence");
  assert.ok(summary.remainingGaps.some((gap) => gap.includes("Duplicate")));
});
