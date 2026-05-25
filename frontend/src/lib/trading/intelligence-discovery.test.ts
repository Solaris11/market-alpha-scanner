import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { OpportunityViewModel } from "./opportunity-view-model";
import {
  buildIntelligenceDiscoverySystem,
  buildLimitedIntelligenceDiscoverySystem,
  compactIntelligenceDiscoverySystem,
  filterDiscoverySymbols,
  matchesDiscoveryQuickFilter,
} from "./intelligence-discovery";

describe("intelligence discovery system", () => {
  test("builds a data-backed discovery model with scanner, sector, risk, and watchlist context", () => {
    const system = buildIntelligenceDiscoverySystem({
      generatedAt: "2026-05-19T12:00:00.000Z",
      rows: [
        opportunity("AMD", "Advanced Micro Devices", "Technology", {
          confidence_score: 76,
          final_score: 72,
          market_cap: 180_000_000_000,
          macro_alignment_score: 68,
          return_1d: 2.4,
          return_1m: 11.5,
          setup_type: "Momentum Breakout",
          volume: 82_000_000,
          volatility_pressure: 70,
          risk_pressure_score: 48,
          market_memory_similarity: 64,
        }),
        opportunity("TSLA", "Tesla", "Consumer Cyclical", {
          confidence_score: 49,
          final_score: 58,
          market_cap: 900_000_000_000,
          macro_alignment_score: 38,
          return_1d: -3.2,
          return_1m: -8.1,
          fragility_score: 78,
          risk_pressure_score: 78,
          shock_risk_score: 72,
          trend_quality_score: 34,
        }),
        opportunity("NVDA", "NVIDIA", "Technology", {
          confidence_score: 82,
          final_score: 86,
          market_cap: 3_000_000_000_000,
          macro_alignment_score: 74,
          return_1d: 1.1,
          return_1m: 14.8,
          volume: 190_000_000,
          risk_pressure_score: 52,
          replay_similarity_score: 71,
        }),
      ],
      watchlistSymbols: ["tsla"],
    });

    assert.equal(system.limited, false);
    assert.equal(system.universeCount, 3);
    assert.equal(system.watchlistCount, 1);
    assert.equal(system.sectorHeatmap.some((cluster) => cluster.label === "Technology" && cluster.count === 2), true);
    assert.equal(system.quickFilters.find((filter) => filter.key === "risk_escalation")?.count, 1);
    assert.equal(system.quickFilters.find((filter) => filter.key === "breakout_candidates")?.count, 1);
    assert.equal(system.quickFilters.find((filter) => filter.key === "crash_risk")?.count, 1);
    assert.equal(system.quickFilters.find((filter) => filter.key === "money_flow")?.count, 2);
    assert.equal(system.quickFilters.find((filter) => filter.key === "top_losers_1d")?.count, 1);
    assert.equal(system.quickFilters.find((filter) => filter.key === "watchlist")?.count, 1);
    assert.equal(system.scannerPresets.some((preset) => preset.key === "preset-breakout" && preset.count === 1), true);
    assert.equal(system.scannerPresets.some((preset) => preset.key === "preset-money-flow" && preset.count === 2), true);
    assert.equal(system.scannerPresets.every((preset) => preset.serverSaved && preset.shortcut.length > 0), true);
    assert.equal(system.comparePresets.some((preset) => preset.symbols.includes("AMD") && preset.symbols.includes("NVDA")), true);
  });

  test("filters by query, sector, quick filter, sort, and timeframe without inventing results", () => {
    const system = buildIntelligenceDiscoverySystem({
      rows: [
        opportunity("AMD", "Advanced Micro Devices", "Technology", { confidence_score: 72, return_1m: 8.2, risk_pressure_score: 45 }),
        opportunity("XOM", "Exxon Mobil", "Energy", { confidence_score: 61, fragility_score: 75, return_1m: -4.5, risk_pressure_score: 68 }),
      ],
    });

    const technology = filterDiscoverySymbols(system.symbols, {
      filter: "top_gainers_1m",
      query: "advanced",
      sector: "Technology",
      sort: "performance",
      timeframe: "1M",
    });
    const energyRisk = filterDiscoverySymbols(system.symbols, {
      filter: "risk_escalation",
      query: "",
      sector: "Energy",
      sort: "risk",
      timeframe: "1M",
    });
    const weakest = filterDiscoverySymbols(system.symbols, {
      filter: "top_losers_1m",
      query: "",
      sector: "ALL",
      sort: "weakness",
      timeframe: "1M",
    });

    assert.deepEqual(technology.map((symbol) => symbol.symbol), ["AMD"]);
    assert.deepEqual(energyRisk.map((symbol) => symbol.symbol), ["XOM"]);
    assert.deepEqual(weakest.map((symbol) => symbol.symbol), ["XOM"]);
    assert.equal(matchesDiscoveryQuickFilter(system.symbols.find((symbol) => symbol.symbol === "XOM")!, "top_gainers_1m"), false);
    assert.equal(matchesDiscoveryQuickFilter(system.symbols.find((symbol) => symbol.symbol === "XOM")!, "top_losers_1m"), true);
  });

  test("promotes user saved scans ahead of default scan packs with full filter state", () => {
    const system = buildIntelligenceDiscoverySystem({
      rows: [
        opportunity("AMD", "Advanced Micro Devices", "Technology", { confidence_score: 72, return_1m: 8.2, risk_pressure_score: 45 }),
        opportunity("XOM", "Exxon Mobil", "Energy", { confidence_score: 61, fragility_score: 75, return_1m: -4.5, risk_pressure_score: 68 }),
      ],
      savedScans: [
        {
          createdAt: "2026-05-23T20:00:00.000Z",
          id: "11111111-1111-4111-8111-111111111111",
          lastUsedAt: "2026-05-23T20:05:00.000Z",
          name: "AMD watchlist replay",
          nameKey: "amd_watchlist_replay",
          payload: {
            assetType: "Equity",
            density: "dense",
            evidence: "ALL",
            filter: "all",
            marketCap: "ALL",
            query: "advanced",
            riskBand: "ALL",
            sector: "Technology",
            sort: "replay",
            timeframe: "1M",
            watchlistOnly: true,
          },
          updatedAt: "2026-05-23T20:00:00.000Z",
          useCount: 3,
        },
      ],
      watchlistSymbols: ["AMD"],
    });

    const saved = system.scannerPresets[0];
    assert.equal(saved?.userSaved, true);
    assert.equal(saved?.label, "AMD watchlist replay");
    assert.equal(saved?.count, 1);
    assert.equal(saved?.density, "dense");
    assert.equal(saved?.query, "advanced");
    assert.equal(saved?.watchlistOnly, true);
    assert.equal(system.scannerPresets.some((preset) => preset.key === "preset-best-setups"), true);
  });

  test("applies advanced scanner filters for market cap, risk, evidence, asset, and watchlist speed workflows", () => {
    const system = buildIntelligenceDiscoverySystem({
      rows: [
        opportunity("AMD", "Advanced Micro Devices", "Technology", { confidence_score: 72, evidence_quality_score: 78, market_cap: 180_000_000_000, return_1d: 2.5, return_1m: 9.4, risk_pressure_score: 42 }),
        opportunity("NVDA", "NVIDIA", "Technology", { confidence_score: 86, evidence_quality_score: 82, market_cap: 3_000_000_000_000, return_1d: 1.2, return_1m: 15.1, risk_pressure_score: 54, volume: 190_000_000 }),
        opportunity("TSLA", "Tesla", "Consumer Cyclical", { confidence_score: 44, evidence_quality_score: 38, event_risk_score: 85, fragility_score: 78, market_cap: 900_000_000_000, return_1d: -4.8, return_1m: -12.2, risk_pressure_score: 82 }),
        opportunity("XOM", "Exxon Mobil", "Energy", { confidence_score: 64, evidence_quality_score: 56, market_cap: 480_000_000_000, return_1d: 0.7, return_1m: 3.8, macro_alignment_score: 69 }),
      ],
      watchlistSymbols: ["TSLA", "NVDA"],
    });

    const megaWatchRisk = filterDiscoverySymbols(system.symbols, {
      assetType: "Equity",
      evidence: "ALL",
      filter: "all",
      marketCap: "MEGA",
      query: "",
      riskBand: "ALL",
      sector: "ALL",
      sort: "risk",
      timeframe: "1D",
      watchlistOnly: true,
    });
    const strongEvidenceLarge = filterDiscoverySymbols(system.symbols, {
      assetType: "ALL",
      evidence: "STRONG",
      filter: "all",
      marketCap: "LARGE",
      query: "",
      riskBand: "ALL",
      sector: "ALL",
      sort: "confidence",
      timeframe: "1M",
    });
    const limitedEvidenceHighRisk = filterDiscoverySymbols(system.symbols, {
      filter: "all",
      query: "",
      sector: "ALL",
      sort: "risk",
      timeframe: "1D",
      evidence: "LIMITED",
      riskBand: "HIGH",
    });

    assert.deepEqual(megaWatchRisk.map((symbol) => symbol.symbol), ["TSLA", "NVDA"]);
    assert.deepEqual(strongEvidenceLarge.map((symbol) => symbol.symbol), ["AMD"]);
    assert.deepEqual(limitedEvidenceHighRisk.map((symbol) => symbol.symbol), ["TSLA"]);
    assert.equal(matchesDiscoveryQuickFilter(system.symbols.find((symbol) => symbol.symbol === "NVDA")!, "money_flow"), true);
  });

  test("returns an honest limited state when no validated scanner rows exist", () => {
    const limited = buildLimitedIntelligenceDiscoverySystem("No validated scan is available.");
    const empty = buildIntelligenceDiscoverySystem({ rows: [] });

    assert.equal(limited.limited, true);
    assert.equal(limited.symbols.length, 0);
    assert.equal(empty.limited, true);
    assert.equal(empty.stories[0]?.title, "Limited evidence");
  });

  test("keeps scanner, compare, and overlay render contracts deterministic", () => {
    const input = {
      generatedAt: "2026-05-19T12:00:00.000Z",
      rows: [
        opportunity("AMD", "Advanced Micro Devices", "Technology", { confidence_score: 72, final_score: 72, return_1d: 2.5, return_1m: 9.4, risk_pressure_score: 62, replay_similarity_score: 68 }),
        opportunity("NVDA", "NVIDIA", "Technology", { confidence_score: 86, final_score: 86, return_1d: 1.2, return_1m: 15.1, risk_pressure_score: 54, macro_alignment_score: 74 }),
        opportunity("TSLA", "Tesla", "Consumer Cyclical", { confidence_score: 44, final_score: 52, return_1d: -4.8, return_1m: -12.2, risk_pressure_score: 82, shock_risk_score: 78 }),
        opportunity("XOM", "Exxon Mobil", "Energy", { confidence_score: 64, final_score: 64, return_1d: 0.7, return_1m: 3.8, macro_alignment_score: 69 }),
      ],
      watchlistSymbols: ["AMD", "TSLA"],
    };
    const first = buildIntelligenceDiscoverySystem(input);
    const second = buildIntelligenceDiscoverySystem(input);

    assert.deepEqual(first.quickFilters, second.quickFilters);
    assert.deepEqual(first.scannerPresets, second.scannerPresets);
    assert.deepEqual(first.comparePresets, second.comparePresets);
    assert.deepEqual(first.orbitNodes, second.orbitNodes);
    assert.deepEqual(first.riskClusters, second.riskClusters);
    assert.deepEqual(first.momentumClusters, second.momentumClusters);
    assert.equal(new Set(first.orbitNodes.map((node) => node.key)).size, first.orbitNodes.length);
    assert.equal(new Set(first.riskClusters.map((cluster) => cluster.key)).size, first.riskClusters.length);
  });

  test("keeps responsive scanner filters and compare mode order stable", () => {
    const system = buildIntelligenceDiscoverySystem({
      generatedAt: "2026-05-19T12:00:00.000Z",
      rows: [
        opportunity("AMD", "Advanced Micro Devices", "Technology", { confidence_score: 72, return_1d: 2.5, return_1m: 9.4, risk_pressure_score: 62 }),
        opportunity("NVDA", "NVIDIA", "Technology", { confidence_score: 86, return_1d: 1.2, return_1m: 15.1, risk_pressure_score: 54 }),
        opportunity("TSLA", "Tesla", "Consumer Cyclical", { confidence_score: 44, fragility_score: 78, return_1d: -4.8, return_1m: -12.2, risk_pressure_score: 82 }),
        opportunity("XOM", "Exxon Mobil", "Energy", { confidence_score: 64, return_1d: 0.7, return_1m: 3.8, macro_alignment_score: 69 }),
      ],
    });
    const state = {
      filter: "all" as const,
      query: "",
      sector: "ALL",
      sort: "attention" as const,
      timeframe: "1M" as const,
    };
    const first = filterDiscoverySymbols(system.symbols, state).map((symbol) => symbol.symbol);
    const second = filterDiscoverySymbols(system.symbols, state).map((symbol) => symbol.symbol);
    const risk = filterDiscoverySymbols(system.symbols, { ...state, filter: "risk_escalation", sort: "risk", timeframe: "1D" }).map((symbol) => symbol.symbol);

    assert.deepEqual(first, second);
    assert.deepEqual(risk, ["TSLA"]);
    assert.ok(system.comparePresets.every((preset) => preset.symbols.length >= 2));
    assert.ok(system.comparePresets.every((preset) => new Set(preset.symbols).size === preset.symbols.length));
  });

  test("builds a compact initial discovery packet without changing full-universe counts", () => {
    const rows = Array.from({ length: 40 }, (_, index) => opportunity(`TV${index}`, `TradeVeto ${index}`, index % 2 === 0 ? "Technology" : "Energy", { final_score: 80 - (index % 20), return_1m: index }));
    const system = buildIntelligenceDiscoverySystem({ rows, watchlistSymbols: ["TV1", "TV2"] });
    const compact = compactIntelligenceDiscoverySystem(system, 12);

    assert.equal(compact.universeCount, system.universeCount);
    assert.equal(compact.watchlistCount, system.watchlistCount);
    assert.equal(compact.quickFilters.find((filter) => filter.key === "all")?.count, 40);
    assert.equal(compact.symbols.length, 12);
    assert.match(compact.summary, /Full-universe rows hydrate progressively/i);
  });
});

function opportunity(symbol: string, companyName: string, sector: string, rawOverrides: Record<string, string | number | boolean | null>): OpportunityViewModel {
  const lastUpdated = "2026-05-19T11:55:00.000Z";
  const finalScore = typeof rawOverrides.final_score === "number" ? rawOverrides.final_score : 60;
  return {
    assetType: "Equity",
    company_name: companyName,
    confidenceLabel: finalScore >= 70 ? "High" : "Medium",
    conviction: finalScore,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated,
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh",
    decision_reason: "Validated scanner context with market-aware discovery signals.",
    entryStatus: "Watch",
    entryZoneLabel: "$100-$105",
    eventLabel: "Event limited",
    eventRisk: typeof rawOverrides.event_risk_score === "number" ? rawOverrides.event_risk_score : 35,
    evidence: {
      analogQualityScore: 60,
      calibrationDrift: 20,
      confidenceConfidence: 62,
      confidenceReliability: 62,
      evidenceConsistency: 62,
      evidenceSampleSize: 12,
      historicalDepthDays: 180,
      label: "Developing Evidence",
      limitations: [],
      outcomeCoverage: 55,
      reasons: ["Validated scanner evidence is available."],
      score: typeof rawOverrides.evidence_quality_score === "number" ? rawOverrides.evidence_quality_score : 62,
      setupReliabilityHistory: 58,
      tier: "developing",
    },
    final_decision: "Watch",
    final_score: finalScore,
    fragility: typeof rawOverrides.fragility_score === "number" ? rawOverrides.fragility_score : 42,
    fragilityLabel: "Moderate fragility",
    macroAdjustment: null,
    macroLabel: "Macro Mixed",
    narrative: null,
    price: 100,
    raw: {
      company_name: companyName,
      final_score: finalScore,
      last_updated_utc: lastUpdated,
      price: 100,
      sector,
      symbol,
      ...rawOverrides,
    },
    recommendationQuality: "research_signal",
    recommendationQualityLabel: "Research signal",
    sector,
    shockPattern: null,
    stop_loss: 95,
    structuralLabel: "Constructive",
    suggested_entry: 101,
    symbol,
    target: 112,
  };
}
