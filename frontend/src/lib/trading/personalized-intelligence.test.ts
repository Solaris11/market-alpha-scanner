import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalizedOpportunities,
  buildUserPersonalizationProfile,
  personalizedSignalFit,
} from "./personalized-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { RankingRow } from "../types";

type OpportunityOverride = Omit<Partial<OpportunityViewModel>, "raw"> & {
  raw?: Partial<RankingRow>;
};

function opportunity(overrides: OpportunityOverride = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const raw: RankingRow = {
    symbol,
    action: "WATCH",
    asset_type: "equity",
    company_name: `${symbol} Inc.`,
    entry_distance_pct: 2,
    event_risk_score: 48,
    event_shock_pressure_score: 54,
    exchange_health_score: 68,
    final_decision: "AVOID",
    final_score: 74,
    liquidity_pressure: 45,
    macro_alignment_score: 68,
    price: 100,
    return_1d: 1.2,
    risk_reward: 2.1,
    sector: "Semiconductors",
    sector_alignment_score: 70,
    setup_strength: 72,
    setup_type: "PULLBACK",
    stop_loss: 94,
    take_profit_high: 116,
    technical_score: 76,
    volatility_pressure: 50,
    ...(overrides.raw ?? {}),
  };
  return {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    conviction: 72,
    confidenceLabel: "High",
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh scans resume during market hours.",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Core mode is waiting for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$98.00-$101.00",
    eventLabel: "Event Context Mixed",
    eventRisk: 48,
    final_decision: "AVOID",
    final_score: 74,
    fragility: 45,
    fragilityLabel: "Moderate fragility",
    macroAdjustment: 1,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 100,
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 94,
    structuralLabel: "Stable trend",
    suggested_entry: 99,
    symbol,
    target: 116,
    ...overrides,
    raw: { ...raw, ...(overrides.raw ?? {}) },
  };
}

test("same opportunity set ranks differently by risk personality", () => {
  const rows = [
    opportunity({
      symbol: "AMD",
      eventRisk: 82,
      final_score: 84,
      fragility: 82,
      price: 125,
      raw: {
        entry_distance_pct: 10,
        event_risk_score: 82,
        event_shock_pressure_score: 94,
        final_score: 84,
        price: 125,
        return_1d: 12,
        risk_reward: 3.7,
        setup_type: "VOLATILITY",
        stop_loss: 109,
        take_profit_high: 164,
        technical_score: 86,
        volume_spike_ratio: 3.8,
        volatility_pressure: 76,
      },
      stop_loss: 109,
      suggested_entry: 118,
      target: 164,
    }),
    opportunity({
      symbol: "TSM",
      final_score: 78,
      fragility: 38,
      price: 100,
      raw: {
        entry_distance_pct: 0.8,
        event_risk_score: 36,
        event_shock_pressure_score: 44,
        final_score: 78,
        price: 100,
        return_1d: 0.9,
        risk_reward: 2.2,
        setup_type: "PULLBACK",
        stop_loss: 94,
        take_profit_high: 116,
        technical_score: 78,
        volatility_pressure: 42,
      },
      stop_loss: 94,
      suggested_entry: 99,
      target: 116,
    }),
  ];
  const conservative = buildUserPersonalizationProfile({
    profile: {
      drawdownTolerance: 42,
      personalityProfile: "conservative",
      preferredRewardLevel: "medium",
      preferredRiskLevel: "low",
      pullbackPreference: 82,
      volatilityTolerance: 32,
    },
  });
  const volatilityHunter = buildUserPersonalizationProfile({
    profile: {
      drawdownTolerance: 82,
      personalityProfile: "volatility_hunter",
      preferredRewardLevel: "high",
      preferredRiskLevel: "high",
      volatilityTolerance: 88,
    },
  });

  const conservativeRanked = buildPersonalizedOpportunities(rows, conservative, { includeProfileMismatches: true, limit: 2 });
  const volatilityRanked = buildPersonalizedOpportunities(rows, volatilityHunter, { includeProfileMismatches: true, limit: 2 });

  assert.equal(conservativeRanked[0]?.candidate.symbol, "TSM");
  assert.equal(volatilityRanked[0]?.candidate.symbol, "AMD");
  assert.equal(conservativeRanked.find((item) => item.candidate.symbol === "AMD")?.profileFit, "conflict");
});

test("personalized signal fit preserves risk warnings and research language", () => {
  const profile = buildUserPersonalizationProfile({
    profile: {
      drawdownTolerance: 40,
      personalityProfile: "defensive",
      preferredRiskLevel: "low",
      volatilityTolerance: 30,
    },
  });
  const row: RankingRow = {
    symbol: "AMD",
    event_risk_score: 76,
    final_decision: "AVOID",
    fragility_score: 78,
    price: 125,
    setup_type: "BREAKOUT",
  };

  const fit = personalizedSignalFit(row, null, profile);

  assert.match(fit.fitLabel, /conflict|partial/i);
  assert.match(fit.profileWarning, /not financial advice/i);
  assert.ok(fit.monitorNext.length >= 3);
  assert.match(fit.conflictReason, /fragility|event pressure/i);
});

test("behavioral signals increase profile confidence without changing the scanner decision", () => {
  const profile = buildUserPersonalizationProfile({
    behavior: {
      repeatedSymbolViews: 12,
      topSymbols: ["amd", "mu", "ddog"],
      watchlistCount: 6,
    },
    profile: {
      personalityConfidence: 35,
      personalityProfile: "momentum",
      preferredRewardLevel: "high",
      preferredRiskLevel: "medium",
    },
    source: "hybrid",
  });

  assert.equal(profile.personality, "momentum");
  assert.equal(profile.source, "hybrid");
  assert.ok(profile.personalityConfidence > 35);
  assert.deepEqual(profile.behavior.topSymbols, ["AMD", "MU", "DDOG"]);
  assert.ok(profile.guardrails.some((item) => item.toLowerCase().includes("scanner decision")));
});
