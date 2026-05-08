import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { RankingRow } from "@/lib/types";
import { buildConvictionFragilityModel, compactStructuralLabel } from "./conviction-fragility";

const alignedRow: RankingRow = {
  confidence_score: 84,
  data_quality_score: 94,
  decision_reason_codes: ["TREND_CONFIRMED", "MOMENTUM_CONFIRMED", "RISK_REWARD_ACCEPTABLE"],
  factor_scores: {
    data_quality: 94,
    macro: 72,
    momentum: 81,
    risk: 78,
    trend: 86,
    volatility: 72,
    volume: 68,
  },
  final_decision: "WATCH",
  final_score: 83,
  market_regime: "RISK_ON",
  price: 100,
  risk_reward: 2.1,
  setup_strength: 78,
  setup_type: "CONTINUATION",
  stop_loss: 91,
  symbol: "NVDA",
  vetoes: [],
} as unknown as RankingRow;

const supportiveMemory: MarketMemorySummary = {
  analogs: [],
  available: true,
  evidence: {
    explanation: "High evidence confidence based on 140 comparable historical setups.",
    label: "High evidence confidence",
    sampleSize: 140,
    tier: "high",
  },
  narrative: ["Historically similar setups showed constructive follow-through."],
  outcome: {
    averageReturn: 0.021,
    downsideRisk: -0.028,
    horizon: "5D",
    medianReturn: 0.018,
    winRate: 0.62,
  },
};

const weakMemory: MarketMemorySummary = {
  ...supportiveMemory,
  evidence: {
    explanation: "Moderate evidence confidence based on 42 comparable historical setups.",
    label: "Moderate evidence confidence",
    sampleSize: 42,
    tier: "moderate",
  },
  narrative: ["Historically similar setups were fragile."],
  outcome: {
    averageReturn: -0.022,
    downsideRisk: -0.12,
    horizon: "5D",
    medianReturn: -0.018,
    winRate: 0.38,
  },
};

function history(scores: number[]): SignalHistoryPoint[] {
  return scores.map((score, index) => ({
    action: "WATCH",
    entry_status: "N/A",
    final_decision: "WATCH",
    final_score: score,
    rating: "ACTIONABLE",
    recommendation_quality: "WATCH",
    timestamp: `2026-05-08T10:${String(index).padStart(2, "0")}:00Z`,
  }));
}

describe("conviction fragility engine", () => {
  it("scores aligned setups as higher conviction and lower fragility", () => {
    const model = buildConvictionFragilityModel(alignedRow, {
      history: history([75, 78, 80, 83]),
      marketMemory: supportiveMemory,
    });

    assert.equal(model.conviction.tier, "high");
    assert.equal(model.fragility.tier, "low");
    assert.equal(model.drift.direction, "rising");
    assert.match(compactStructuralLabel(model), /Stable|High|Moderate|Strong/);
  });

  it("elevates fragility for overextended vetoed setups", () => {
    const model = buildConvictionFragilityModel({
      ...alignedRow,
      confidence_score: 58,
      entry_distance_pct: 8.2,
      factor_scores: {
        data_quality: 62,
        macro: 38,
        momentum: 70,
        risk: 32,
        trend: 74,
        volatility: 28,
        volume: 41,
      },
      risk_reward: 0.8,
      setup_reason_codes: ["SETUP_REJECTED_EXTENDED", "POOR_RISK_REWARD_SETUP"],
      setup_strength: 48,
      vetoes: ["OVEREXTENDED_ENTRY", "POOR_RISK_REWARD", "HIGH_VOLATILITY"],
    } as unknown as RankingRow, {
      history: history([66, 64, 61, 58]),
      marketMemory: weakMemory,
    });

    assert.equal(model.fragility.tier, "high");
    assert.ok(model.fragility.score > model.conviction.score);
    assert.equal(model.decay.stage, "extended");
    assert.ok(model.invalidation.conditions.some((item) => item.toLowerCase().includes("risk/reward") || item.toLowerCase().includes("extended")));
  });

  it("detects weakening confidence drift and setup decay", () => {
    const model = buildConvictionFragilityModel(alignedRow, { history: history([82, 80, 77, 73]) });

    assert.equal(model.drift.direction, "weakening");
    assert.equal(model.decay.stage, "decaying");
    assert.match(model.drift.explanation, /weakened/i);
  });

  it("uses historical downside tails as fragility context", () => {
    const supportive = buildConvictionFragilityModel(alignedRow, { marketMemory: supportiveMemory });
    const weak = buildConvictionFragilityModel(alignedRow, { marketMemory: weakMemory });

    assert.ok(weak.historicalFragility.riskScore > supportive.historicalFragility.riskScore);
    assert.ok(weak.fragility.score > supportive.fragility.score);
    assert.ok(weak.historicalFragility.lines.some((line) => line.includes("downside")));
  });

  it("flags close invalidation proximity", () => {
    const model = buildConvictionFragilityModel({
      ...alignedRow,
      price: 100,
      stop_loss: 98.5,
    });

    assert.ok(model.invalidation.proximityPct !== null && model.invalidation.proximityPct < 2);
    assert.ok(model.invalidation.riskScore >= 45);
  });

  it("keeps generated language probabilistic and non-advisory", () => {
    const model = buildConvictionFragilityModel(alignedRow, { marketMemory: weakMemory });
    const generated = [
      model.summary,
      model.decay.explanation,
      model.drift.explanation,
      ...model.invalidation.conditions,
      ...model.historicalFragility.lines,
      ...model.pressure.map((item) => item.explanation),
    ].join(" ").toLowerCase();

    assert.doesNotMatch(generated, /guarantee|guaranteed|will happen|buy now|sell now|prediction/);
  });
});
