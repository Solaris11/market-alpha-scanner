import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarketMemorySummary,
  evidenceMaturity,
  marketMemorySimilarity,
  scoreBucket,
  type MarketMemoryCandidate,
} from "./market-memory";
import type { RankingRow } from "@/lib/types";

const current: RankingRow = {
  symbol: "TSM",
  final_decision: "WATCH",
  final_score: 82,
  market_regime: "RISK_ON",
  sector: "Technology",
  setup_type: "continuation",
};

function candidate(overrides: Partial<MarketMemoryCandidate> = {}): MarketMemoryCandidate {
  return {
    decision: "WATCH",
    finalScore: 80,
    marketRegime: "RISK_ON",
    outcomes: [{ horizon: "5D", returnPct: 0.025 }],
    scoreBucket: "75-84",
    sector: "Technology",
    setupType: "continuation",
    signalTimestamp: "2026-04-25T12:00:00Z",
    symbol: "NVDA",
    ...overrides,
  };
}

describe("market memory helpers", () => {
  it("buckets scores into stable ranges for similarity", () => {
    assert.equal(scoreBucket(90), "85+");
    assert.equal(scoreBucket(80), "75-84");
    assert.equal(scoreBucket(70), "65-74");
    assert.equal(scoreBucket(60), "55-64");
    assert.equal(scoreBucket(40), "<55");
    assert.equal(scoreBucket("n/a"), null);
  });

  it("scores similar setup, regime, sector, and score range above weak analogs", () => {
    const strong = marketMemorySimilarity(candidate({ symbol: "TSM" }), candidate());
    const weak = marketMemorySimilarity(candidate({ setupType: "pullback", marketRegime: "RISK_OFF", sector: "Energy", scoreBucket: "<55", finalScore: 42 }), candidate());
    assert.ok(strong > weak);
    assert.ok(strong >= 70);
  });

  it("labels evidence maturity honestly by sample size", () => {
    assert.equal(evidenceMaturity(0).tier, "unavailable");
    assert.equal(evidenceMaturity(12).tier, "limited");
    assert.equal(evidenceMaturity(40).tier, "moderate");
    assert.equal(evidenceMaturity(120).tier, "high");
  });

  it("builds probabilistic historical context without prediction language", () => {
    const summary = buildMarketMemorySummary(current, [
      candidate({ symbol: "NVDA", outcomes: [{ horizon: "5D", returnPct: 0.03 }] }),
      candidate({ symbol: "AMD", outcomes: [{ horizon: "5D", returnPct: -0.01 }] }),
      candidate({ symbol: "AVGO", outcomes: [{ horizon: "5D", returnPct: 0.02 }] }),
      candidate({ symbol: "AAPL", setupType: "failed_breakout", marketRegime: "RISK_OFF", sector: "Consumer", scoreBucket: "<55", finalScore: 40 }),
    ]);

    assert.equal(summary.available, true);
    assert.equal(summary.analogs.length, 3);
    assert.equal(summary.outcome?.horizon, "5D");
    assert.equal(summary.evidence.tier, "limited");
    assert.match(summary.narrative.join(" "), /Historically similar setups/);
    assert.doesNotMatch(summary.narrative.join(" ").toLowerCase(), /guarantee|will happen|prediction/);
  });

  it("uses total comparable analog count for evidence maturity, not just displayed analogs", () => {
    const candidates = Array.from({ length: 40 }, (_value, index) => candidate({ symbol: `SYM${index}`, signalTimestamp: `2026-04-${String((index % 20) + 1).padStart(2, "0")}T12:00:00Z` }));
    const summary = buildMarketMemorySummary(current, candidates, { maxAnalogs: 5 });
    assert.equal(summary.analogs.length, 5);
    assert.equal(summary.evidence.sampleSize, 40);
    assert.equal(summary.evidence.tier, "moderate");
  });
});
