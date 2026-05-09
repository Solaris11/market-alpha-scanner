import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublishedIntelligenceIndex,
  buildPublishedMacroRegimePage,
  buildPublishedShockPage,
  buildPublishedSymbolIntelligence,
  buildWhyWaitIntelligence,
  publishingItemListJsonLd,
  publishingJsonLdForSymbol,
} from "./intelligence-publishing";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 78,
    averageDrawdownAfterEntry: "-4.0%",
    averageFollowthrough1d: 1.6,
    averageFollowthrough5d: 4.2,
    averageProfitPotential: "+13.0%",
    averageReversal5d: -2.0,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 44,
    chaseSuccessRate: 58,
    commonFailureConditions: ["failed continuation when volatility expanded"],
    commonPreconditions: ["volatility compression before expansion"],
    currentSimilarityScore: 70,
    downsideRiskScore: 44,
    downsideShockCount: 5,
    doNotChaseZone: "$116.00+",
    historicalExitZone: "$122.00-$128.00",
    invalidationZone: "$96.00",
    largestDownside1d: -12.3,
    largestUpside1d: 18.8,
    lastUpdated: "2026-05-08T20:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -7.1,
    medianUpsideShock: 9.4,
    opportunityScore: 76,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 64,
    reliabilityScore: 70,
    researchEntryZone: "$100.00-$103.00",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 58,
    upsideShockCount: 16,
    upsideShockScore: 80,
    ...overrides,
  };
}

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 76,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Core mode is waiting for confirmation while structure improves.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WAIT",
    final_score: 78,
    fragility: 46,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      breadth_score: 72,
      entry_distance_pct: 1.4,
      exchange_health_score: 70,
      final_decision: "WAIT",
      final_score: 78,
      fragility_score: 46,
      liquidity_pressure: 36,
      macro_alignment_score: 72,
      price: 105,
      relative_volume: 1.4,
      return_1d: 1.2,
      risk_on_score: 68,
      risk_reward: 2.4,
      score_change: 3,
      sector: "Semiconductors",
      sector_alignment_score: 74,
      setup_type: "PULLBACK",
      symbol,
      technical_score: 76,
      volatility_pressure: 42,
      volume: 54000000,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: shock({ symbol }),
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

const rows = [
  row({ symbol: "AMD" }),
  row({ final_decision: "WATCH", shockPattern: shock({ opportunityScore: 84, symbol: "MU", upsideShockScore: 88 }), symbol: "MU" }),
  row({
    assetType: "software",
    final_decision: "AVOID",
    fragility: 84,
    macroLabel: "Macro Conflict",
    raw: {
      entry_distance_pct: 10,
      liquidity_pressure: 80,
      macro_alignment_score: 38,
      return_1d: 9,
      sector: "Software",
      symbol: "DDOG",
      volatility_pressure: 86,
    },
    sector: "Software",
    shockPattern: shock({ chaseRiskLabel: "High chase risk", chaseRiskScore: 86, downsideRiskScore: 78, symbol: "DDOG", twoSidedVolatilityScore: 84 }),
    symbol: "DDOG",
  }),
  row({
    assetType: "etf",
    final_score: 58,
    raw: {
      macro_alignment_score: 52,
      sector: "Index ETF",
      symbol: "QQQ",
      volatility_pressure: 55,
    },
    sector: "Index ETF",
    shockPattern: null,
    symbol: "QQQ",
  }),
];

test("publishes symbol intelligence without premium trade-plan fields", () => {
  const item = buildPublishedSymbolIntelligence(rows, "AMD", "2026-05-09T00:00:00.000Z");

  assert.ok(item);
  assert.equal(item.symbol, "AMD");
  assert.ok(item.cards.length >= 5);
  assert.ok(item.internalLinks.some((link) => link.href === "/intelligence/why-wait/AMD"));
  assert.doesNotMatch(JSON.stringify(item), /suggested_entry|stop_loss|take_profit|buy_zone|risk_reward|final_score/i);
  assert.doesNotMatch(JSON.stringify(item), /buy now|sell now|guaranteed|sure profit/i);
});

test("builds index, shock, and macro intelligence collections", () => {
  const index = buildPublishedIntelligenceIndex(rows, "2026-05-09T00:00:00.000Z");
  const shockPage = buildPublishedShockPage(rows, "2026-05-09T00:00:00.000Z");
  const macroPage = buildPublishedMacroRegimePage(rows, "2026-05-09T00:00:00.000Z");

  assert.ok(index.collections.some((item) => item.href === "/intelligence/shock-opportunities"));
  assert.ok(index.symbolPages.some((item) => item.symbol === "AMD"));
  assert.ok(shockPage.items.some((item) => item.href === "/symbol/DDOG"));
  assert.ok(macroPage.metrics.length >= 4);
  assert.ok(macroPage.sectorMap.length >= 2);
});

test("why-wait pages and schema are public-safe and crawlable", () => {
  const wait = buildWhyWaitIntelligence(rows, "AMD", "2026-05-09T00:00:00.000Z");
  assert.ok(wait);
  assert.match(wait.whyWaitSummary, /restraint|patience|confirmation|WAIT/i);

  const articleJsonLd = publishingJsonLdForSymbol(wait);
  const itemListJsonLd = publishingItemListJsonLd("Shock Opportunities", buildPublishedShockPage(rows).items);

  assert.equal(articleJsonLd["@type"], "Article");
  assert.equal(itemListJsonLd["@type"], "ItemList");
  assert.doesNotMatch(JSON.stringify(articleJsonLd), /buy now|sell now|guaranteed/i);
});
