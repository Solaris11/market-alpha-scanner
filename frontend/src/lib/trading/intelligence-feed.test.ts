import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyBrief,
  buildIntelligenceFeedItems,
  normalizeNotificationPreferences,
  shouldNotifyForFeedItem,
  type IntelligenceFeedItem,
} from "./intelligence-feed";
import type { OpportunityViewModel } from "./opportunity-view-model";

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    conviction: 72,
    confidenceLabel: "High",
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-13T16:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Core mode is waiting for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Context Mixed",
    eventRisk: 48,
    final_decision: "WATCH",
    final_score: 74,
    fragility: 45,
    fragilityLabel: "Moderate fragility",
    macroAdjustment: 1.2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      symbol,
      action: "WATCH",
      entry_distance_pct: 2.2,
      final_decision: "WATCH",
      final_score: 74,
      macro_alignment_score: 68,
      price: 105,
      relative_volume: 1.25,
      return_1d: 3.1,
      risk_reward: 2.4,
      setup_strength: 76,
      setup_type: "CONTINUATION",
      stop_loss: 96,
      take_profit_high: 126,
      technical_score: 78,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable trend",
    suggested_entry: 101,
    symbol,
    target: 121,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

test("feed builder creates data-backed opportunity, risk, and market items", () => {
  const items = buildIntelligenceFeedItems({
    generatedAt: "2026-05-13T16:00:00.000Z",
    marketCondition: "OVERHEATED",
    rows: [
      opportunity({ symbol: "NVDA", final_score: 82, conviction: 80 }),
      opportunity({ symbol: "MU", eventRisk: 82, final_decision: "AVOID", final_score: 45, fragility: 84 }),
    ],
    scanUpdatedAt: "2026-05-13T16:00:00.000Z",
    watchlistSymbols: ["MU"],
  });

  assert.ok(items.some((item) => item.itemType === "market_regime_changed"));
  assert.ok(items.some((item) => item.itemType === "opportunity_attention_queue" && item.relatedSymbol === "NVDA"));
  assert.ok(items.some((item) => item.itemType === "risk_pressure_increased" && item.relatedSymbol === "MU" && item.notificationEligible));
  assert.equal(new Set(items.map((item) => item.sourceKey)).size, items.length);
});

test("daily brief uses real candidate and risk symbols", () => {
  const brief = buildDailyBrief({
    generatedAt: "2026-05-13T16:00:00.000Z",
    marketCondition: "RISK REVIEW",
    rows: [
      opportunity({ symbol: "TSM", final_score: 79 }),
      opportunity({ symbol: "OXY", eventRisk: 78, final_decision: "AVOID", fragility: 72 }),
    ],
  });

  assert.equal(brief.topWatchSymbols[0], "TSM");
  assert.equal(brief.dangerousSymbols[0], "OXY");
  assert.match(brief.headline, /Risk Review/i);
  assert.ok(brief.sections.some((section) => section.key === "best_setups" && section.symbols.includes("TSM")));
  assert.ok(brief.sections.some((section) => section.key === "dangerous_names" && section.symbols.includes("OXY")));
});

test("feed builder surfaces market awareness event types without fake visuals", () => {
  const items = buildIntelligenceFeedItems({
    generatedAt: "2026-05-13T16:00:00.000Z",
    marketCondition: "RISK TRANSITION",
    rows: [
      opportunity({
        confidenceLabel: "Medium",
        conviction: 62,
        eventRisk: 76,
        final_score: 67,
        fragility: 74,
        raw: {
          confidence_change: -8,
          final_score: 67,
          score_change: -6,
          symbol: "TSLA",
          volatility_pressure_score: 78,
        },
        symbol: "TSLA",
      }),
      opportunity({
        dataFreshness: {
          ageMinutes: 85,
          humanAge: "Updated 85 min ago",
          label: "Stale",
          lastUpdated: "2026-05-13T14:35:00.000Z",
          message: "Stale - updated 85 min ago",
          status: "stale",
        },
        decayLabel: "Stale setup",
        raw: { final_score: 57, symbol: "AAPL" },
        symbol: "AAPL",
      }),
    ],
    scanUpdatedAt: "2026-05-13T16:00:00.000Z",
    watchlistSymbols: ["TSLA", "AAPL"],
  });

  assert.ok(items.some((item) => item.itemType === "score_deteriorated" && item.relatedSymbol === "TSLA"));
  assert.ok(items.some((item) => item.itemType === "confidence_changed" && item.relatedSymbol === "TSLA"));
  assert.ok(items.some((item) => item.itemType === "volatility_spiked" && item.relatedSymbol === "TSLA"));
  assert.ok(items.some((item) => item.itemType === "contradiction_detected" && item.relatedSymbol === "TSLA"));
  assert.ok(items.some((item) => item.itemType === "freshness_decayed" && item.relatedSymbol === "AAPL"));
});

test("notification preferences normalize unsafe values", () => {
  const preferences = normalizeNotificationPreferences({
    categories: ["shock_risk", "bad"],
    channels: ["in_app", "sms"],
    dailyLimit: 200,
    frequency: "daily_digest",
    quietHoursEnd: "07:30",
    quietHoursStart: "22:00",
    symbolScope: "custom_symbols",
    symbols: ["amd", "bad symbol", "NVDA"],
  });

  assert.deepEqual(preferences.categories, ["shock_risk"]);
  assert.deepEqual(preferences.channels, ["in_app"]);
  assert.equal(preferences.dailyLimit, 24);
  assert.equal(preferences.quietHoursStart, "22:00");
  assert.deepEqual(preferences.symbols, ["AMD", "BADSYMBOL", "NVDA"]);
});

test("notification eligibility respects quiet hours and custom symbol scope", () => {
  const item: IntelligenceFeedItem = {
    actionHref: "/symbol/AMD",
    category: "shock_risk",
    dataTimestamp: "2026-05-13T16:00:00.000Z",
    evidenceLabel: "Shock 82/100",
    itemType: "shock_risk_detected",
    monitorNext: "Review chase risk.",
    notificationEligible: true,
    relatedSymbol: "AMD",
    severity: "critical",
    sourceKey: "shock:AMD:82:2026-05-13",
    summary: "AMD has elevated shock risk.",
    title: "AMD shock risk detected",
    whyItMatters: "Shock risk can create false positives.",
  };
  const preferences = normalizeNotificationPreferences({
    categories: ["shock_risk"],
    channels: ["in_app"],
    frequency: "high_signal_only",
    quietHoursEnd: "07:00",
    quietHoursStart: "22:00",
    symbolScope: "custom_symbols",
    symbols: ["NVDA"],
  });

  assert.equal(shouldNotifyForFeedItem(item, preferences, { now: new Date("2026-05-13T12:00:00") }).allowed, false);
  const allowedPreferences = normalizeNotificationPreferences({ ...preferences, quietHoursEnd: null, quietHoursStart: null, symbols: ["AMD"] });
  assert.equal(shouldNotifyForFeedItem(item, allowedPreferences, { now: new Date("2026-05-13T12:00:00") }).allowed, true);
});
