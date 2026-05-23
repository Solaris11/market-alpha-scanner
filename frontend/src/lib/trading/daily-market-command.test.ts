import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyMarketCommandModel } from "./daily-market-command";
import type { MarketCommandModel } from "./market-research";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildUnifiedIntelligenceConsole } from "./unified-intelligence-console";

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 76,
    averageDrawdownAfterEntry: "-4.0%",
    averageFollowthrough1d: 1.2,
    averageFollowthrough5d: 3.8,
    averageProfitPotential: "+11.0%",
    averageReversal5d: -2.2,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 48,
    chaseSuccessRate: 56,
    commonFailureConditions: ["failed when volatility expanded"],
    commonPreconditions: ["volatility compression"],
    currentSimilarityScore: 76,
    downsideRiskScore: 42,
    downsideShockCount: 4,
    doNotChaseZone: "$116.00+",
    historicalExitZone: "$122.00-$128.00",
    invalidationZone: "$96.00",
    largestDownside1d: -11.4,
    largestUpside1d: 17.8,
    lastUpdated: "2026-05-19T12:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -6.8,
    medianUpsideShock: 9.1,
    opportunityScore: 76,
    opportunityState: "High Volatility Watch",
    pullbackSuccessRate: 62,
    reliabilityScore: 70,
    researchEntryZone: "$100.00-$103.00",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 64,
    upsideShockCount: 12,
    upsideShockScore: 83,
    ...overrides,
  };
}

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 74,
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-19T12:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Structure is improving but confirmation remains important.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 38,
    final_decision: "WATCH",
    final_score: 78,
    fragility: 46,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      earnings_date: "2026-05-22",
      entry_distance_pct: 1.4,
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 78,
      fragility_score: 46,
      liquidity_pressure: 36,
      macro_alignment_score: 72,
      price: 105,
      relative_volume: 1.4,
      return_1d: 1.2,
      return_1w: 4.2,
      risk_on_score: 68,
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

function marketCommand(): MarketCommandModel {
  return {
    barItems: [],
    generatedAt: "2026-05-19T13:00:00.000Z",
    macroNews: [{
      affectedSectors: ["Semiconductors"],
      bearishImplication: "Rates pressure can weaken growth multiples across AMD and MU.",
      bullishImplication: "Bullish read requires growth shares to absorb rate pressure without confidence decay.",
      direction: "negative",
      eventTrackingLabel: "Rates tracked from Reuters",
      eventType: "macro_policy",
      id: "https://www.reuters.com/markets/rates-pressure-growth-shares|Rates pressure growth",
      marketMovingLabel: "High-impact macro policy event",
      publishedAt: "2026-05-19T12:30:00.000Z",
      reasonCodes: ["EVENT_RATE_PRESSURE"],
      relatedAssets: ["AMD", "MU"],
      relatedMacroContext: "Rates pressure is reducing growth confidence.",
      relatedReplayContext: "Replay linkage is limited for this headline.",
      relevance: 82,
      scope: "market",
      source: "Reuters",
      sourceUrl: "https://www.reuters.com/markets/rates-pressure-growth-shares",
      title: "Rates pressure growth shares",
      tone: "rose",
      whyItMatters: "Macro policy adds risk pressure across AMD, MU in Semiconductors.",
    }],
    pressureSummary: {
      constructive: 2,
      deteriorating: 3,
      limited: 0,
      pressureScore: 60,
    },
  };
}

test("daily market command ranks opportunity, breakout, crash risk, money flow, and source-linked developments", () => {
  const rows = [
    row({ symbol: "AMD" }),
    row({
      eventLabel: "Verified Event Pressure Elevated",
      eventRisk: 82,
      final_score: 58,
      fragility: 84,
      raw: {
        entry_distance_pct: 8,
        event_risk_score: 82,
        fragility_score: 84,
        macro_alignment_score: 30,
        return_1d: -3.1,
        score_change: -5,
        sector: "Semiconductors",
        symbol: "MU",
        volatility_pressure: 86,
      },
      shockPattern: shock({ chaseRiskScore: 84, currentSimilarityScore: 70, downsideRiskScore: 78, symbol: "MU", twoSidedVolatilityScore: 82 }),
      symbol: "MU",
    }),
    row({
      final_score: 72,
      raw: {
        macro_alignment_score: 68,
        return_1d: 2.4,
        return_1w: 5.1,
        sector: "Software",
        symbol: "MSFT",
      },
      sector: "Software",
      shockPattern: null,
      symbol: "MSFT",
    }),
  ];
  const unified = buildUnifiedIntelligenceConsole({ marketCondition: "Risk-On Transition", rows, watchlistSymbols: ["AMD"] });
  const model = buildDailyMarketCommandModel({
    marketCommand: marketCommand(),
    marketCondition: "Risk-On Transition",
    now: new Date("2026-05-19T14:00:00.000Z"),
    rankedZones: unified.rankedZones,
    rows,
    watchlistSymbols: ["AMD"],
  });

  assert.equal(model.bestSetups[0]?.symbol, "AMD");
  assert.equal(model.crashRisk[0]?.symbol, "MU");
  assert.ok(model.breakoutCandidates.some((item) => item.symbol === "AMD" || item.symbol === "MU"));
  assert.ok(model.moneyFlow.sectors.some((sector) => sector.sector === "Semiconductors"));
  assert.equal(model.developments[0]?.sourceUrl, "https://www.reuters.com/markets/rates-pressure-growth-shares");
  assert.equal(model.developments[0]?.watchlistImpact, true);
  assert.match(model.developments[0]?.bearishImplication ?? "", /Rates pressure/);
  assert.match(model.developments[0]?.relatedMacroContext ?? "", /growth confidence/);
  assert.equal(model.developments[0]?.sourceQualityLabel, "Verified market source");
  assert.equal(model.developments[0]?.providerAttribution, "Verified market source · Reuters");
  assert.equal(model.developments[0]?.freshnessLabel, "Recent · 2h old");
  assert.equal(model.developments[0]?.symbolRelevanceLabel, "Symbol relevance: AMD, MU");
  assert.equal(model.developments[0]?.watchlistRelevanceLabel, "Watchlist relevance: AMD");
  assert.match(model.developments[0]?.latencyLabel ?? "", /latency not instrumented/);
  assert.match(model.developments[0]?.uncertaintyLabel ?? "", /High relevance/);
  assert.equal(model.developments[0]?.sectorImpactLabel, "Semiconductors impact");
  assert.ok((model.developments[0]?.priorityScore ?? 0) >= 90);
  assert.equal(model.newsEcosystem.watchlistImpactCount, 1);
  assert.equal(model.newsEcosystem.highImpactCount, 1);
  assert.equal(model.newsEcosystem.providerCoverage, "Single-source coverage");
  assert.equal(model.newsEcosystem.calendarCount, 3);
  assert.ok(model.newsEcosystem.completenessScore > 0);
  assert.equal(model.providerCoverage[0]?.source, "Reuters");
  assert.ok(model.providerStrategyAudit.some((audit) => audit.domain === "rates" && audit.coverage === "active" && audit.provider === "Reuters"));
  assert.ok(model.providerCoverageMatrix.some((audit) => audit.domain === "rates" && audit.operationalState === "active" && /source-linked/.test(audit.disclosure)));
  assert.ok(model.providerStrategyAudit.some((audit) => audit.domain === "earnings" && audit.coverage === "calendar-only"));
  assert.ok(model.providerStrategyAudit.some((audit) => audit.domain === "geopolitical-events" && audit.coverage === "limited"));
  assert.equal(model.newsEvolution[0]?.itemCount, 1);
  assert.ok(model.crossAssetRelationships.some((relationship) => relationship.affectedSymbols.includes("AMD") && relationship.affectedSymbols.includes("MU") && relationship.relationshipType === "Rates/yields versus duration-sensitive growth"));
  assert.ok(model.macroEventTimeline.some((item) => item.source === "Verified market source · Reuters" && item.relationshipType === "Rates/yields versus duration-sensitive growth"));
  assert.ok(model.companyTimelines.some((timeline) => timeline.symbol === "AMD" && timeline.timeline.length > 0));
  assert.ok(model.macroStorylines.some((story) => story.label === "Rates and inflation pressure"));
  assert.ok(model.sectorNews.some((cluster) => cluster.sector === "Semiconductors"));
  assert.ok(model.calendar.some((item) => item.symbol === "AMD" && item.category === "earnings"));
  assert.match(model.hero.narrative, /leads/);
});

test("daily market command keeps honest news empty state when no source-linked feed exists", () => {
  const rows = [row({ symbol: "NVDA", raw: { symbol: "NVDA" } })];
  const unified = buildUnifiedIntelligenceConsole({ rows });
  const model = buildDailyMarketCommandModel({
    marketCommand: { ...marketCommand(), macroNews: [] },
    rankedZones: unified.rankedZones,
    rows,
  });

  assert.equal(model.developments.length, 0);
  assert.equal(model.newsEmptyState.message, "News source not configured yet");
  assert.match(model.newsEmptyState.integrationNeeded, /verified headline/);
});

test("daily market command discloses stale and outage provider states without inventing events", () => {
  const staleRows = [
    row({ symbol: "AMD" }),
  ];
  const outageRows = [
    row({
      raw: {
        event_provider_error: "provider timeout",
        event_provider_status: "outage",
        symbol: "AMD",
      },
      symbol: "AMD",
    }),
  ];
  const staleCommand = marketCommand();
  staleCommand.macroNews = [{
    ...staleCommand.macroNews[0]!,
    publishedAt: "2026-05-15T12:30:00.000Z",
  }];
  const staleUnified = buildUnifiedIntelligenceConsole({ rows: staleRows });
  const staleModel = buildDailyMarketCommandModel({
    marketCommand: staleCommand,
    now: new Date("2026-05-19T14:00:00.000Z"),
    rankedZones: staleUnified.rankedZones,
    rows: staleRows,
  });
  const staleRates = staleModel.providerCoverageMatrix.find((audit) => audit.domain === "rates");
  assert.equal(staleRates?.operationalState, "stale");
  assert.match(staleRates?.disclosure ?? "", /stale/i);

  const outageModel = buildDailyMarketCommandModel({
    marketCommand: { ...marketCommand(), macroNews: [] },
    now: new Date("2026-05-19T14:00:00.000Z"),
    rankedZones: buildUnifiedIntelligenceConsole({ rows: outageRows }).rankedZones,
    rows: outageRows,
  });
  const companyAudit = outageModel.providerCoverageMatrix.find((audit) => audit.domain === "company-events");
  assert.equal(companyAudit?.operationalState, "outage");
  assert.match(companyAudit?.sourceTransparency ?? "", /Raw provider status/i);
  assert.equal(outageModel.developments.length, 0);
});
