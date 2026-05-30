import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PaperPositionRow } from "@/lib/paper-data";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { buildPredictiveIntelligenceSystem } from "./predictive-intelligence";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 78,
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-30T15:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Scanner structure is improving while risk remains bounded.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    evidence: {
      analogQualityScore: 72,
      calibrationDrift: 24,
      confidenceConfidence: 74,
      confidenceReliability: 76,
      evidenceConsistency: 72,
      evidenceSampleSize: 86,
      historicalDepthDays: 91,
      label: "Mature Evidence",
      limitations: [],
      outcomeCoverage: 62,
      reasons: ["86 evidence samples available.", "Historical depth is 91 days."],
      score: 74,
      setupReliabilityHistory: 70,
      tier: "mature",
    },
    eventLabel: "Event Risk Contained",
    eventRisk: 34,
    final_decision: "WATCH",
    final_score: 82,
    fragility: 38,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 3,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      breadth_score: 74,
      confidence_reliability: 76,
      evidence_sample_size: 86,
      exchange_health_score: 71,
      final_decision: "WATCH",
      final_score: 82,
      fragility_score: 38,
      historical_sample_size: 86,
      liquidity_pressure: 32,
      macro_alignment_score: 74,
      market_memory_sample_size: 86,
      price: 105,
      risk_on_score: 72,
      sector: "Semiconductors",
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 34,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable structure",
    suggested_entry: 101,
    symbol,
    target: 126,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function position(symbol: string): PaperPositionRow {
  return {
    close_reason: null,
    closed_at: null,
    current_price: 110,
    entry_price: 100,
    entry_status: "watch",
    exit_price: null,
    final_decision: "WATCH",
    id: `position-${symbol}`,
    opened_at: "2026-05-29T15:00:00.000Z",
    quantity: 100,
    rating: "watch",
    realized_pnl: null,
    recommendation_quality: "watch",
    return_pct: null,
    setup_type: "MOMENTUM_CONTINUATION",
    status: "OPEN",
    stop_loss: 92,
    symbol,
    target_price: 124,
    unrealized_pnl: 1000,
  };
}

describe("predictive intelligence engine", () => {
  test("builds operational market, opportunity, alert, and portfolio forecasts from real model inputs", () => {
    const rows = [
      row({ symbol: "AMD" }),
      row({
        confidenceLabel: "Medium",
        conviction: 63,
        eventRisk: 68,
        final_score: 68,
        fragility: 66,
        raw: {
          event_risk_score: 68,
          final_score: 68,
          fragility_score: 66,
          liquidity_pressure: 62,
          macro_alignment_score: 54,
          symbol: "MU",
          volatility_pressure: 67,
        },
        symbol: "MU",
      }),
    ];
    const regimeSystem = buildRegimeShiftSystem({ rows });
    const portfolioSystem = buildPortfolioIntelligenceSystem({
      accountValue: 100_000,
      opportunities: rows,
      positions: [position("AMD"), position("MU")],
    });

    const system = buildPredictiveIntelligenceSystem({
      portfolioSystem,
      regimeSystem,
      rows,
      watchlistSymbols: ["AMD"],
    });

    assert.equal(system.certification.overallStatus, "ready");
    assert.equal(system.certification.finalVerdict, "TRADEVETO PREDICTIVE INTELLIGENCE ENGINE ACCOMPLISHED");
    assert.ok(system.marketRegimeForecast.confidenceScore > 0);
    assert.ok(system.opportunityForecasts.length >= 2);
    assert.equal(system.portfolioForecast.status, "operational");
    assert.ok(system.predictiveAlerts.length >= 3);
    assert.ok(system.confidenceFramework.evidenceCount >= 10);
  });

  test("keeps forecasts probabilistic and avoids fabricated certainty language", () => {
    const rows = [row({ symbol: "NVDA" })];
    const regimeSystem = buildRegimeShiftSystem({ rows });
    const portfolioSystem = buildPortfolioIntelligenceSystem({
      accountValue: 50_000,
      opportunities: rows,
      positions: [position("NVDA")],
    });
    const system = buildPredictiveIntelligenceSystem({ portfolioSystem, regimeSystem, rows });
    const serialized = JSON.stringify(system);

    assert.equal(system.certification.noFabricatedCertainty, true);
    assert.match(system.proofBoundary, /probabilistic research context/i);
    assert.doesNotMatch(serialized, /\bguaranteed|must buy|must sell|sure profit|will definitely\b/i);
  });

  test("keeps portfolio forecasting limited when no authenticated positions exist", () => {
    const rows = [row({ symbol: "QQQ" })];
    const regimeSystem = buildRegimeShiftSystem({ rows });
    const system = buildPredictiveIntelligenceSystem({ regimeSystem, rows });

    assert.equal(system.portfolioForecast.status, "limited");
    assert.ok(system.certification.blockers.some((blocker) => /Portfolio forecast is limited/i.test(blocker)));
    assert.equal(system.certification.overallStatus, "not_ready");
  });

  test("boosts predictive alert priority for watchlisted opportunity forecasts", () => {
    const rows = [row({ symbol: "AMD" }), row({ conviction: 72, final_score: 74, symbol: "AVGO" })];
    const regimeSystem = buildRegimeShiftSystem({ rows });
    const portfolioSystem = buildPortfolioIntelligenceSystem({
      accountValue: 100_000,
      opportunities: rows,
      positions: [position("AMD")],
    });
    const system = buildPredictiveIntelligenceSystem({
      portfolioSystem,
      regimeSystem,
      rows,
      watchlistSymbols: ["AMD"],
    });
    const amdForecast = system.opportunityForecasts.find((forecast) => forecast.symbol === "AMD");
    const avgoForecast = system.opportunityForecasts.find((forecast) => forecast.symbol === "AVGO");

    assert.equal(amdForecast?.userInterestScore, 82);
    assert.equal(avgoForecast?.userInterestScore, 45);
    assert.ok(system.predictiveAlerts.some((alert) => alert.symbol === "AMD" && alert.userInterestScore === 82));
  });
});
