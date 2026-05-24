import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  loadDiscoveryWorkflowState,
  sanitizeDiscoverySymbols,
  sanitizeDiscoveryWorkflowState,
  saveDiscoveryWorkflowState,
  type DiscoveryWorkflowState,
} from "./discovery-workflow-storage";
import type { DiscoverySymbol } from "@/lib/trading/intelligence-discovery";

describe("discovery workflow storage", () => {
  test("sanitizes symbols, density, and stored workflow state", () => {
    const symbols = [symbol("AMD"), symbol("NVDA"), symbol("TSLA"), symbol("XOM")];
    const state = sanitizeDiscoveryWorkflowState({
      activeSymbol: "amd",
      assetType: "Equity",
      compareSymbols: ["amd", "NVDA", "NVDA", "<bad>", "TSLA", "XOM"],
      density: "ultra",
      evidence: "STRONG",
      filter: "breakout_candidates",
      marketCap: "LARGE",
      pinnedCompareSymbols: ["tsla", "AMD", "missing"],
      query: "  macro supported semis  ",
      riskBand: "ELEVATED",
      scannerColumnKeys: ["confidence", "risk", "risk", "unsupported", "macro"],
      sector: "Technology & Semis",
      shortlistSymbols: ["xom", "missing", "TSLA", "AMD", "AMD"],
      sort: "breakout",
      timeframe: "1W",
      updatedAt: "2026-05-21T12:00:00.000Z",
      watchlistOnly: true,
    }, symbols);

    assert.equal(state.activeSymbol, "AMD");
    assert.equal(state.assetType, "Equity");
    assert.deepEqual(state.compareSymbols, ["AMD", "NVDA", "TSLA", "XOM"]);
    assert.equal(state.density, "ultra");
    assert.equal(state.evidence, "STRONG");
    assert.equal(state.filter, "breakout_candidates");
    assert.equal(state.marketCap, "LARGE");
    assert.deepEqual(state.pinnedCompareSymbols, ["TSLA", "AMD"]);
    assert.equal(state.query, "macro supported semis");
    assert.equal(state.riskBand, "ELEVATED");
    assert.deepEqual(state.scannerColumnKeys, ["confidence", "risk", "macro"]);
    assert.equal(state.sector, "Technology & Semis");
    assert.deepEqual(state.shortlistSymbols, ["XOM", "TSLA", "AMD"]);
    assert.equal(state.sort, "breakout");
    assert.equal(state.timeframe, "1W");
    assert.equal(state.updatedAt, "2026-05-21T12:00:00.000Z");
    assert.equal(state.watchlistOnly, true);
  });

  test("falls back safely for invalid local storage payloads", () => {
    const storage = new MemoryStorage("{bad json");
    const state = loadDiscoveryWorkflowState(storage, [symbol("AMD")]);
    assert.equal(state.activeSymbol, null);
    assert.equal(state.assetType, "ALL");
    assert.deepEqual(state.compareSymbols, []);
    assert.equal(state.density, "speed");
    assert.equal(state.evidence, "ALL");
    assert.equal(state.filter, "all");
    assert.equal(state.marketCap, "ALL");
    assert.deepEqual(state.pinnedCompareSymbols, []);
    assert.equal(state.query, "");
    assert.equal(state.riskBand, "ALL");
    assert.deepEqual(state.scannerColumnKeys, ["performance", "confidence", "risk", "macro", "replay", "freshness"]);
    assert.equal(state.sector, "ALL");
    assert.deepEqual(state.shortlistSymbols, []);
    assert.equal(state.sort, "attention");
    assert.equal(state.timeframe, "1M");
    assert.equal(state.watchlistOnly, false);
  });

  test("persists sanitized workflow state without unsupported values", () => {
    const storage = new MemoryStorage(null);
    const saved: DiscoveryWorkflowState = {
      activeSymbol: "AMD",
      assetType: "Equity",
      compareSymbols: ["AMD", "NVDA", "NVDA"],
      density: "dense",
      evidence: "DEVELOPING",
      filter: "crash_risk",
      marketCap: "MEGA",
      pinnedCompareSymbols: ["NVDA"],
      query: "risk",
      riskBand: "HIGH",
      scannerColumnKeys: ["performance", "risk", "freshness"],
      sector: "Technology",
      shortlistSymbols: ["TSLA", "AMD"],
      sort: "crash",
      timeframe: "1D",
      updatedAt: null,
      watchlistOnly: true,
    };

    assert.equal(saveDiscoveryWorkflowState(storage, saved), true);
    const loaded = loadDiscoveryWorkflowState(storage, [symbol("AMD"), symbol("NVDA"), symbol("TSLA")]);

    assert.equal(loaded.activeSymbol, "AMD");
    assert.equal(loaded.assetType, "Equity");
    assert.deepEqual(loaded.compareSymbols, ["AMD", "NVDA"]);
    assert.equal(loaded.density, "dense");
    assert.equal(loaded.evidence, "DEVELOPING");
    assert.equal(loaded.filter, "crash_risk");
    assert.equal(loaded.marketCap, "MEGA");
    assert.deepEqual(loaded.pinnedCompareSymbols, ["NVDA"]);
    assert.equal(loaded.query, "risk");
    assert.equal(loaded.riskBand, "HIGH");
    assert.deepEqual(loaded.scannerColumnKeys, ["performance", "risk", "freshness"]);
    assert.equal(loaded.sector, "Technology");
    assert.deepEqual(loaded.shortlistSymbols, ["TSLA", "AMD"]);
    assert.equal(loaded.sort, "crash");
    assert.equal(loaded.timeframe, "1D");
    assert.equal(typeof loaded.updatedAt, "string");
    assert.equal(loaded.watchlistOnly, true);
  });

  test("limits symbol arrays for scanner throughput state", () => {
    const values = Array.from({ length: 30 }, (_, index) => `S${index}`);
    assert.equal(sanitizeDiscoverySymbols(values, undefined, 12).length, 12);
  });
});

class MemoryStorage {
  private value: string | null;

  public constructor(value: string | null) {
    this.value = value;
  }

  public getItem(_key: string): string | null {
    return this.value;
  }

  public setItem(_key: string, value: string): void {
    this.value = value;
  }
}

function symbol(value: string): DiscoverySymbol {
  return {
    alertState: "Not configured",
    assetType: "Equity",
    companyName: value,
    confidence: 50,
    conviction: 50,
    decision: "Watch",
    evidence: 50,
    evidenceLabel: "Developing",
    fragility: 50,
    freshness: 50,
    freshnessLabel: "Fresh",
    href: `/symbol/${value}`,
    macro: 50,
    marketCap: null,
    performance: { "1D": 0, "1W": 0, "1M": 0, "3M": 0, "6M": 0, "1Y": 0, "5Y": 0 },
    price: 100,
    reason: "Test symbol.",
    replay: 50,
    risk: 50,
    sector: "Technology",
    setupType: "Watch",
    shockRisk: 50,
    symbol: value,
    trend: 50,
    volatility: 50,
    volume: null,
    watchlisted: false,
  };
}
