import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MacroExchangeContext } from "./macro-regime";
import type { MarketMemorySummary } from "./market-memory";
import { buildSymbolIntelligenceGraph, buildZoneIntelligenceGraph } from "./intelligence-graph";
import type { RankingRow } from "@/lib/types";

function row(symbol: string, overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    asset_type: "Equity",
    company_name: `${symbol} Inc.`,
    final_score: 60,
    sector: "Technology",
    symbol,
    ...overrides,
  } as RankingRow;
}

const macroContext: MacroExchangeContext = {
  alignmentState: "aligned",
  exchangeContextLabel: "Macro context is supportive",
  exchangeHeadwind: [],
  exchangeHealthScore: 68,
  exchangeTailwind: ["Risk appetite supportive"],
  liquidityPressure: 28,
  macroAlignmentScore: 72,
  macroPressureScore: 36,
  macroRegime: "Risk On",
  opposingForces: [],
  proxyCoverage: {
    missing: ["TLT"],
    used: ["SPY", "QQQ"],
  },
  regimeExplanation: "Broad market proxies are supportive.",
  riskOnScore: 74,
  sectorAlignmentScore: 70,
  sectorPressure: [],
  sectorTailwind: ["Technology leadership"],
  supportingForces: ["Risk appetite supportive"],
  symbolProfile: "Large-cap technology",
  themeContext: "AI infrastructure",
  volatilityPressure: 32,
};

const marketMemory: MarketMemorySummary = {
  analogs: [
    {
      decision: "WATCH",
      finalScore: 71,
      marketRegime: "Risk On",
      outcomes: [],
      reasonCodes: ["same_sector", "similar_score_range"],
      scoreBucket: "65-74",
      sector: "Technology",
      setupType: "Continuation",
      signalTimestamp: "2026-05-01T00:00:00Z",
      similarityScore: 76,
      symbol: "NVDA",
    },
  ],
  available: true,
  evidence: {
    explanation: "Moderate evidence confidence based on comparable setups.",
    label: "Moderate evidence confidence",
    sampleSize: 42,
    tier: "moderate",
  },
  narrative: ["Similar setups had constructive follow-through."],
  outcome: null,
};

describe("intelligence graph", () => {
  it("builds symbol relationships from sector, macro, proxy, event, and replay data", () => {
    const graph = buildSymbolIntelligenceGraph({
      contextRows: [
        row("AMD", { event_context_label: "Earnings pressure", event_risk_score: 68, final_score: 66 }),
        row("NVDA", { final_score: 82 }),
        row("QQQ", { final_score: 72 }),
        row("SPY", { final_score: 64 }),
      ],
      macroContext,
      marketMemory,
      row: row("AMD", { event_context_label: "Earnings pressure", event_risk_score: 68, final_score: 66 }),
    });

    assert.equal(graph.focus, "AMD");
    assert.ok(graph.relationships.some((relationship) => relationship.category === "sector"));
    assert.ok(graph.relationships.some((relationship) => relationship.category === "macro"));
    assert.ok(graph.relationships.some((relationship) => relationship.category === "event"));
    assert.ok(graph.relationships.some((relationship) => relationship.category === "replay" && relationship.targetHref === "/symbol/NVDA"));
    assert.ok(graph.relationships.some((relationship) => relationship.category === "proxy" && relationship.target === "QQQ"));
  });

  it("does not create available proxy relationships when proxy rows are missing", () => {
    const graph = buildSymbolIntelligenceGraph({
      contextRows: [row("AMD", { final_score: 66 }), row("NVDA", { final_score: 82 })],
      macroContext: null,
      marketMemory: null,
      row: row("AMD", { final_score: 66 }),
    });

    assert.equal(graph.relationships.some((relationship) => relationship.category === "proxy"), false);
    assert.ok(graph.unavailable.some((item) => item.includes("QQQ") || item.includes("SPY")));
  });

  it("creates zone relationships only from visible scored factors and related symbols", () => {
    const graph = buildZoneIntelligenceGraph({
      dataSource: "Unit test source",
      factors: [
        { detail: "Attention has enough scanner evidence.", label: "Attention", tone: "cyan", value: 58 },
        { detail: "Risk pressure is elevated.", label: "Risk Pressure", tone: "rose", value: 71 },
        { label: "No Value", value: null },
      ],
      focus: "Market State",
      relatedSymbols: ["AMD", "QQQ"],
      summary: "Market state context",
      title: "Market State Detail",
    });

    assert.equal(graph.relationships.length, 4);
    assert.ok(graph.relationships.some((relationship) => relationship.targetHref === "/symbol/AMD"));
    assert.ok(graph.relationships.some((relationship) => relationship.label === "Risk Pressure" && relationship.status === "pressure"));
  });
});
