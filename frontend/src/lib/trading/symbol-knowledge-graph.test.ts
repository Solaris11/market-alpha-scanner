import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { RankingRow, ScannerScalar } from "@/lib/types";
import type { MarketMemorySummary } from "./market-memory";
import {
  buildSymbolKnowledgeGraphModel,
  symbolKnowledgeTextContainsUnsupportedClaim,
} from "./symbol-knowledge-graph";

function row(symbol: string, overrides: Record<string, ScannerScalar> = {}): RankingRow {
  return {
    asset_type: "Equity",
    company_name: `${symbol} Inc.`,
    final_decision: "WATCH",
    final_score: 72,
    market_regime: "Risk On",
    macro_event_regime_signature: "AI capex risk-on",
    sector: "Technology",
    setup_type: "Continuation",
    symbol,
    verified_event_signature: "earnings guidance",
    ...overrides,
  } as RankingRow;
}

const history: SignalHistoryPoint[] = [
  {
    action: "WATCH",
    entry_status: "WAIT_PULLBACK",
    final_decision: "WATCH",
    final_score: 64,
    rating: "B",
    recommendation_quality: "GOOD",
    timestamp: "2026-05-01T12:00:00Z",
  },
  {
    action: "ENTER",
    entry_status: "BREAKOUT_TRIGGERED",
    final_decision: "ENTER",
    final_score: 79,
    rating: "A",
    recommendation_quality: "STRONG",
    timestamp: "2026-05-02T12:00:00Z",
  },
  {
    action: "EXIT",
    entry_status: "STALE",
    final_decision: "AVOID",
    final_score: 42,
    rating: "C",
    recommendation_quality: "WEAK",
    timestamp: "2026-05-03T12:00:00Z",
  },
];

const marketMemory: MarketMemorySummary = {
  analogs: [
    {
      decision: "WATCH",
      eventSignature: "earnings guidance",
      finalScore: 74,
      macroEventRegimeSignature: "AI capex risk-on",
      marketRegime: "Risk On",
      outcomes: [
        { horizon: "5D", returnPct: 0.05 },
        { horizon: "10D", returnPct: -0.02 },
      ],
      reasonCodes: ["same_setup_type", "same_sector", "similar_macro_event_regime"],
      scoreBucket: "65-74",
      sector: "Technology",
      setupType: "Continuation",
      signalTimestamp: "2026-04-15T12:00:00Z",
      similarityScore: 82,
      symbol: "NVDA",
    },
  ],
  available: true,
  evidence: {
    explanation: "Limited historical evidence.",
    label: "Limited historical evidence",
    sampleSize: 1,
    tier: "limited",
  },
  narrative: ["Comparable memory exists."],
  outcome: null,
};

describe("symbol knowledge graph", () => {
  it("builds source-backed memory traits, relationships, analogs, events, and timeline items", () => {
    const model = buildSymbolKnowledgeGraphModel({
      contextRows: [
        row("AMD"),
        row("NVDA", { final_score: 91 }),
        row("AVGO", { final_score: 84 }),
        row("QQQ", { sector: "ETF", setup_type: "Risk Appetite", verified_event_signature: "FOMC rates" }),
      ],
      history,
      marketMemory,
      priceSeries: [
        { close: 100, timestamp_utc: "2026-05-01T00:00:00Z" },
        { close: 103, timestamp_utc: "2026-05-02T00:00:00Z" },
        { close: 108, timestamp_utc: "2026-05-03T00:00:00Z" },
      ],
      row: row("AMD", { avg_dollar_volume: 2_000_000_000, volatility_pressure: 66 }),
    });

    assert.equal(model.symbol, "AMD");
    assert.ok(model.traits.some((trait) => trait.id === "prior-failures" && trait.status === "available"));
    assert.ok(model.traits.some((trait) => trait.id === "prior-breakouts" && trait.status === "available"));
    assert.ok(model.relationships.some((relationship) => relationship.type === "sector_leader" && relationship.target === "NVDA"));
    assert.ok(model.relationships.some((relationship) => relationship.type === "correlated" && /not statistical correlation/i.test(relationship.evidence)));
    assert.ok(model.relationships.some((relationship) => relationship.type === "event_linked"));
    assert.equal(model.historicalAnalogs[0]?.successRate, 0.5);
    assert.equal(model.historicalAnalogs[0]?.failureRate, 0.5);
    assert.ok(model.eventMemory.some((event) => event.domain === "earnings"));
    assert.ok(model.timeline.some((item) => item.category === "scanner"));
    assert.ok(model.timeline.some((item) => item.category === "replay"));
  });

  it("does not fabricate inverse links or event memory when source fields are missing", () => {
    const model = buildSymbolKnowledgeGraphModel({
      contextRows: [row("AMD", { sector: null, verified_event_signature: null, macro_event_regime_signature: null })],
      history: [],
      marketMemory: {
        analogs: [],
        available: false,
        evidence: {
          explanation: "No comparable memory yet.",
          label: "No comparable memory yet",
          sampleSize: 0,
          tier: "unavailable",
        },
        narrative: [],
        outcome: null,
      },
      row: row("AMD", {
        event_context_label: null,
        event_context_summary: null,
        macro_context_label: null,
        macro_event_regime_signature: null,
        market_regime: null,
        sector: null,
        setup_type: null,
        verified_event_signature: null,
      }),
    });

    assert.equal(model.relationships.some((relationship) => relationship.type === "inverse"), false);
    assert.equal(model.eventMemory.length, 0);
    assert.ok(model.unavailable.some((item) => /inverse/i.test(item)));
    assert.ok(model.unavailable.some((item) => /earnings/i.test(item)));
  });

  it("allows explicit source-backed inverse relationships only when fields exist", () => {
    const model = buildSymbolKnowledgeGraphModel({
      contextRows: [row("AMD"), row("SQQQ")],
      history,
      marketMemory,
      row: row("AMD", { inverse_symbol: "SQQQ" }),
    });

    assert.ok(model.relationships.some((relationship) => relationship.type === "inverse" && relationship.target === "SQQQ"));
  });

  it("keeps generated copy free of unsupported certainty claims", () => {
    const model = buildSymbolKnowledgeGraphModel({
      contextRows: [row("AMD"), row("NVDA")],
      history,
      marketMemory,
      row: row("AMD"),
    });

    const text = JSON.stringify(model);
    assert.equal(symbolKnowledgeTextContainsUnsupportedClaim(text), false);
    assert.equal(symbolKnowledgeTextContainsUnsupportedClaim("This is a guaranteed risk-free buy."), true);
  });
});
