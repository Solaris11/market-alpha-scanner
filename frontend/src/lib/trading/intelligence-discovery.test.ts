import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { OpportunityViewModel } from "./opportunity-view-model";
import {
  buildIntelligenceDiscoverySystem,
  buildLimitedIntelligenceDiscoverySystem,
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
          macro_alignment_score: 68,
          return_1d: 2.4,
          return_1m: 11.5,
          risk_pressure_score: 48,
          market_memory_similarity: 64,
        }),
        opportunity("TSLA", "Tesla", "Consumer Cyclical", {
          confidence_score: 49,
          final_score: 58,
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
          macro_alignment_score: 74,
          return_1d: 1.1,
          return_1m: 14.8,
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
    assert.equal(system.quickFilters.find((filter) => filter.key === "watchlist")?.count, 1);
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

    assert.deepEqual(technology.map((symbol) => symbol.symbol), ["AMD"]);
    assert.deepEqual(energyRisk.map((symbol) => symbol.symbol), ["XOM"]);
    assert.equal(matchesDiscoveryQuickFilter(system.symbols.find((symbol) => symbol.symbol === "XOM")!, "top_gainers_1m"), false);
  });

  test("returns an honest limited state when no validated scanner rows exist", () => {
    const limited = buildLimitedIntelligenceDiscoverySystem("No validated scan is available.");
    const empty = buildIntelligenceDiscoverySystem({ rows: [] });

    assert.equal(limited.limited, true);
    assert.equal(limited.symbols.length, 0);
    assert.equal(empty.limited, true);
    assert.equal(empty.stories[0]?.title, "Limited evidence");
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
