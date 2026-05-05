import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDecisionFactors, buildDecisionIntelligence, reasonCodes } from "./decision-intelligence";
import type { RankingRow } from "@/lib/types";

const baseRow: RankingRow = {
  confidence_score: 78,
  data_quality_score: 92,
  decision_reason_codes: ["TREND_CONFIRMED", "MOMENTUM_CONFIRMED", "RISK_REWARD_ACCEPTABLE"],
  factor_scores: {
    data_quality: 92,
    macro: 66,
    momentum: 76,
    risk: 74,
    trend: 82,
    volume: 61,
  },
  final_decision: "WATCH",
  final_score: 81,
  risk_reward: 1.8,
  symbol: "NVDA",
  vetoes: [],
} as unknown as RankingRow;

describe("decision intelligence", () => {
  it("always returns structured explanations and watch conditions", () => {
    const result = buildDecisionIntelligence({ symbol: "OXY" });

    assert.equal(result.decision, "WATCH");
    assert.ok(result.why.positives.length > 0);
    assert.ok(result.why.negatives.length > 0);
    assert.ok(result.what_to_watch.length > 0);
    assert.ok(result.risks.length > 0);
  });

  it("maps vetoes into negative reasons and improvement conditions", () => {
    const result = buildDecisionIntelligence({
      ...baseRow,
      decision_reason_codes: ["TREND_CONFIRMED", "OVEREXTENDED_ENTRY", "WEAK_VOLUME"],
      vetoes: ["OVEREXTENDED_ENTRY", "WEAK_VOLUME"],
    } as unknown as RankingRow);

    assert.ok(result.why.negatives.some((item) => item.includes("extended")));
    assert.ok(result.what_to_watch.some((item) => item.includes("pullback")));
    assert.ok(result.what_to_watch.some((item) => item.includes("volume expansion")));
  });

  it("reduces readiness when vetoes are present", () => {
    const clean = buildDecisionIntelligence(baseRow);
    const blocked = buildDecisionIntelligence({
      ...baseRow,
      vetoes: ["HIGH_VOLATILITY", "POOR_RISK_REWARD"],
    } as unknown as RankingRow);

    assert.ok(clean.readiness_score > blocked.readiness_score);
    assert.ok(blocked.readiness_score <= 50);
  });

  it("reduces readiness for low data quality", () => {
    const clean = buildDecisionIntelligence(baseRow);
    const lowQuality = buildDecisionIntelligence({
      ...baseRow,
      data_quality_score: 42,
      factor_scores: { data_quality: 42, momentum: 76, risk: 74, trend: 82 },
      vetoes: ["LOW_CONFIDENCE_DATA"],
    } as unknown as RankingRow);

    assert.ok(clean.readiness_score > lowQuality.readiness_score);
    assert.ok(lowQuality.risks.some((item) => item.includes("Data")));
  });

  it("normalizes reason code arrays and JSON strings", () => {
    assert.deepEqual(reasonCodes("[\"high volatility\", \"macro-mismatch\"]"), ["HIGH_VOLATILITY", "MACRO_MISMATCH"]);
    assert.deepEqual(reasonCodes("HIGH_VOLATILITY|LOW_CONFIDENCE_DATA"), ["HIGH_VOLATILITY", "LOW_CONFIDENCE_DATA"]);
  });

  it("uses structured factor scores when available", () => {
    const factors = buildDecisionFactors(baseRow);
    assert.equal(factors.find((factor) => factor.key === "trend")?.value, 82);
    assert.equal(factors.find((factor) => factor.key === "data_quality")?.value, 92);
  });

  it("surfaces regime impact from scanner diagnostics", () => {
    const result = buildDecisionIntelligence({
      ...baseRow,
      market_regime: "OVERHEATED",
      regime_impact: "Overheated market: scanner is reducing breakout signals and increasing risk filters.",
    } as unknown as RankingRow);

    assert.equal(result.regime, "OVERHEATED");
    assert.ok(result.regime_impact.includes("risk filters"));
  });

  it("does not generate financial advice language in explanation copy", () => {
    const result = buildDecisionIntelligence({
      ...baseRow,
      decision_reason_codes: ["OVEREXTENDED_ENTRY", "MACRO_MISMATCH", "LOW_CONFIDENCE_DATA"],
      final_decision: "ENTER",
      vetoes: ["OVEREXTENDED_ENTRY", "MACRO_MISMATCH", "LOW_CONFIDENCE_DATA"],
    } as unknown as RankingRow);
    const generated = [
      ...result.why.positives,
      ...result.why.negatives,
      ...result.risks,
      ...result.what_to_watch,
    ].join(" ").toLowerCase();

    assert.equal(generated.includes("buy now"), false);
    assert.equal(generated.includes("recommended trade"), false);
    assert.equal(generated.includes("this will go up"), false);
    assert.equal(generated.includes("sell"), false);
  });
});
