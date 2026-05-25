import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POWER_WORKFLOW_BUDGETS,
  buildCompareMatrix,
  buildScannerVirtualWindow,
  buildSyntheticDiscoverySymbols,
  measureChartScannerPowerWorkflowProof,
} from "./chart-scanner-power-workflow-proof";
import { filterDiscoverySymbols, type DiscoveryFilterState } from "./intelligence-discovery";

describe("chart and scanner power workflow proof", () => {
  it("builds a 500+ symbol scanner universe with a large watchlist", () => {
    const symbols = buildSyntheticDiscoverySymbols(520);
    const watchlisted = symbols.filter((symbol) => symbol.watchlisted);

    assert.equal(symbols.length, 520);
    assert.equal(watchlisted.length >= 500, true);
    assert.equal(symbols.every((symbol) => symbol.href === `/symbol/${symbol.symbol}`), true);
  });

  it("keeps the scanner render window bounded for large universes", () => {
    const window = buildScannerVirtualWindow({
      rowCount: 520,
      rowHeight: 46,
      scrollTop: 46 * 250,
      viewportHeight: 1_152,
    });

    assert.equal(window.virtualized, true);
    assert.equal(window.totalRows, 520);
    assert.equal(window.renderedRows <= 80, true);
    assert.equal(window.topPaddingPx > 0, true);
    assert.equal(window.bottomPaddingPx > 0, true);
  });

  it("supports rapid scanner filtering, sorting, and compare matrix creation", () => {
    const symbols = buildSyntheticDiscoverySymbols(520);
    const state: DiscoveryFilterState = {
      evidence: "ALL",
      filter: "all",
      marketCap: "ALL",
      query: "synthetic",
      riskBand: "ALL",
      sector: "ALL",
      sort: "attention",
      timeframe: "1M",
    };
    const filtered = filterDiscoverySymbols(symbols, state);
    const matrix = buildCompareMatrix(symbols, ["AMD", "NVDA", "AAPL", "MSFT"]);

    assert.equal(filtered.length, 520);
    assert.equal(matrix.length, 4);
    assert.deepEqual(matrix.map((row) => row.symbol), ["AMD", "NVDA", "AAPL", "MSFT"]);
  });

  it("measures scanner and chart workflow operations against the Phase 25.4 budgets", () => {
    const report = measureChartScannerPowerWorkflowProof({ samples: 24, symbolCount: 520 });

    assert.equal(report.overallStatus, "ready");
    assert.equal(report.symbolCount, 520);
    assert.equal(report.largeWatchlistCount >= 500, true);
    assert.equal(report.virtualWindow.renderedRows <= 80, true);
    assert.equal(report.metrics.every((metric) => metric.pass), true);
    assert.equal(report.budgets.scannerInteractionMs, POWER_WORKFLOW_BUDGETS.scannerInteractionMs);
    assert.equal(report.unsupportedClaims.some((claim) => claim.includes("No unsupported TradingView parity claim")), true);
  });
});
