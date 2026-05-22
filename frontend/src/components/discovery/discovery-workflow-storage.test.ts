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
      compareSymbols: ["amd", "NVDA", "NVDA", "<bad>", "TSLA", "XOM"],
      density: "dense",
      filter: "breakout_candidates",
      shortlistSymbols: ["xom", "missing", "TSLA", "AMD", "AMD"],
      sort: "breakout",
      timeframe: "1W",
      updatedAt: "2026-05-21T12:00:00.000Z",
    }, symbols);

    assert.deepEqual(state.compareSymbols, ["AMD", "NVDA", "TSLA", "XOM"]);
    assert.equal(state.density, "dense");
    assert.equal(state.filter, "breakout_candidates");
    assert.deepEqual(state.shortlistSymbols, ["XOM", "TSLA", "AMD"]);
    assert.equal(state.sort, "breakout");
    assert.equal(state.timeframe, "1W");
    assert.equal(state.updatedAt, "2026-05-21T12:00:00.000Z");
  });

  test("falls back safely for invalid local storage payloads", () => {
    const storage = new MemoryStorage("{bad json");
    const state = loadDiscoveryWorkflowState(storage, [symbol("AMD")]);
    assert.deepEqual(state.compareSymbols, []);
    assert.equal(state.density, "speed");
    assert.equal(state.filter, "all");
    assert.deepEqual(state.shortlistSymbols, []);
    assert.equal(state.sort, "attention");
    assert.equal(state.timeframe, "1M");
  });

  test("persists sanitized workflow state without unsupported values", () => {
    const storage = new MemoryStorage(null);
    const saved: DiscoveryWorkflowState = {
      compareSymbols: ["AMD", "NVDA", "NVDA"],
      density: "dense",
      filter: "crash_risk",
      shortlistSymbols: ["TSLA", "AMD"],
      sort: "crash",
      timeframe: "1D",
      updatedAt: null,
    };

    assert.equal(saveDiscoveryWorkflowState(storage, saved), true);
    const loaded = loadDiscoveryWorkflowState(storage, [symbol("AMD"), symbol("NVDA"), symbol("TSLA")]);

    assert.deepEqual(loaded.compareSymbols, ["AMD", "NVDA"]);
    assert.equal(loaded.density, "dense");
    assert.equal(loaded.filter, "crash_risk");
    assert.deepEqual(loaded.shortlistSymbols, ["TSLA", "AMD"]);
    assert.equal(loaded.sort, "crash");
    assert.equal(loaded.timeframe, "1D");
    assert.equal(typeof loaded.updatedAt, "string");
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
