import test from "node:test";
import assert from "node:assert/strict";
import type { MarketChartHubItem } from "../interactive-chart-data";
import type { RankingRow } from "../types";
import { buildMarketCommandModel, buildSymbolResearchModel } from "./market-research";

function chart(symbol: string, closes: number[]): MarketChartHubItem {
  return {
    chart: {
      dataSource: "validated price history",
      endDate: "2026-05-12",
      lastUpdated: "2026-05-12T20:00:00.000Z",
      pointCount: closes.length,
      rows: closes.map((close, index) => ({
        close,
        date: `2026-05-${String(index + 1).padStart(2, "0")}`,
        datetime: `2026-05-${String(index + 1).padStart(2, "0")}T20:00:00.000Z`,
        high: close + 1,
        low: close - 1,
        open: close,
        volume: null,
      })),
      startDate: "2026-05-01",
      symbol,
    },
    interpretation: `${symbol} macro proxy context.`,
    label: `${symbol} proxy`,
    symbol,
  };
}

const verifiedEvent = {
  direction: "negative",
  event_type: "macro_policy",
  published_at: "2026-05-12T12:00:00.000Z",
  reason_codes: ["EVENT_RATE_PRESSURE"],
  scope: "market",
  source: "Reuters",
  source_url: "https://www.reuters.com/markets/test",
  title: "Bond weakness pressures growth shares",
  weight: 0.8,
};

test("buildMarketCommandModel restores cross-asset market command context from validated charts", () => {
  const rows: RankingRow[] = [
    {
      symbol: "QQQ",
      event_risk_score: 80,
      sector: "Technology",
      verified_event_recent_events: [verifiedEvent],
    },
    {
      symbol: "AMD",
      event_risk_score: 62,
      sector: "Technology",
      verified_event_recent_events: [verifiedEvent],
    },
  ];

  const model = buildMarketCommandModel({
    charts: [chart("QQQ", [100, 101, 102]), chart("GLD", [200, 198, 197])],
    generatedAt: "2026-05-12T20:00:00.000Z",
    rows,
  });

  assert.equal(model.barItems.length, 2);
  assert.equal(model.barItems[0]?.symbol, "QQQ");
  assert.equal(model.barItems[0]?.currentPrice, 102);
  assert.equal(model.macroNews.length, 1);
  assert.deepEqual(model.macroNews[0]?.relatedAssets.sort(), ["AMD", "QQQ"]);
  assert.match(model.macroNews[0]?.whyItMatters ?? "", /AMD, QQQ|QQQ, AMD/);
  assert.match(model.macroNews[0]?.bearishImplication ?? "", /pressure|Risk/i);
  assert.match(model.macroNews[0]?.relatedMacroContext ?? "", /Macro|alignment|limited/i);
});

/**
 * Every bar item used to carry the whole scanner row into the page source.
 *
 * The browser reads one field off it, but the row it travelled in held 305 --
 * including alpaca_request_id and the other provider plumbing that
 * stripRawFields removes on the opportunity path. This is the second path, and
 * it needs its own guard: if someone puts the row back to reach one more field,
 * these fail rather than silently republishing request ids.
 */
test("bar items carry only the summary the client reads, never the scanner row", () => {
  const rows: RankingRow[] = [
    {
      symbol: "QQQ",
      alpaca_request_id: "req-aaaa,req-bbbb",
      data_provider_primary: "yfinance",
      data_timestamp: "2026-05-12T20:00:00.000Z",
      event_context_summary: "Rate decision keeps growth proxies under pressure.",
      event_risk_score: 80,
      provider_error: "rate limited",
      provider_latency_ms: 412,
      sector: "Technology",
      verified_event_recent_events: [verifiedEvent],
    } as unknown as RankingRow,
  ];

  const model = buildMarketCommandModel({
    charts: [chart("QQQ", [100, 101, 102]), chart("GLD", [200, 198, 197])],
    generatedAt: "2026-05-12T20:00:00.000Z",
    rows,
  });

  const matched = model.barItems.find((item) => item.symbol === "QQQ");
  const unmatched = model.barItems.find((item) => item.symbol === "GLD");

  // The one field the overlay renders still arrives.
  assert.equal(matched?.eventContextSummary, "Rate decision keeps growth proxies under pressure.");
  // A proxy with no scanner row is null, not undefined, and does not throw.
  assert.equal(unmatched?.eventContextSummary, null);

  // Nothing from the row may ride along.
  const serialised = JSON.stringify(model.barItems);
  for (const field of ["alpaca_request_id", "provider_error", "provider_latency_ms", "data_provider_primary", "data_timestamp", "verified_event_recent_events"]) {
    assert.equal(serialised.includes(field), false, `${field} must not reach the client through barItems`);
  }
  assert.equal("row" in (matched ?? {}), false, "the raw scanner row must not be attached to a bar item");
});

test("dropping the row does not change the values built from it", () => {
  const rows: RankingRow[] = [
    { symbol: "QQQ", event_risk_score: 80, macro_pressure_score: 64, price: 102, return_1d: 1.2 } as unknown as RankingRow,
  ];
  const model = buildMarketCommandModel({ charts: [chart("QQQ", [100, 101, 102])], generatedAt: null, rows });
  const item = model.barItems[0];
  // These are all derived from the row on the server and must survive it.
  assert.equal(item?.marketPressure, 64);
  assert.equal(item?.currentPrice, 102);
  assert.ok(item?.freshness);
  assert.ok(item?.tone);
});

test("buildSymbolResearchModel exposes real research fields and limited-data states", () => {
  const row: RankingRow = {
    symbol: "AMD",
    asset_type: "Equity",
    company_name: "Advanced Micro Devices, Inc.",
    debt_to_equity: 7.5,
    dividend_yield: 0,
    earnings_date: "2026-07-28",
    earnings_growth: 0.18,
    event_context_summary: "Rates context is pressuring growth multiples.",
    event_risk_score: 71,
    forward_pe: 31,
    gross_margin: 0.49,
    industry: "Semiconductors",
    macro_alignment_score: 44,
    market_cap: 260_000_000_000,
    operating_margin: 0.08,
    profit_margin: 0.07,
    revenue_growth: 0.12,
    sector: "Technology",
    trailing_pe: 42,
    verified_event_recent_events: [verifiedEvent],
  };

  const model = buildSymbolResearchModel(row);

  assert.equal(model.company.companyName, "Advanced Micro Devices, Inc.");
  assert.equal(model.company.description, null);
  assert.equal(model.company.headquarters, null);
  assert.equal(model.earnings.date, "2026-07-28");
  assert.equal(model.earnings.surpriseHistoryAvailable, false);
  assert.equal(model.dividend.yield, 0);
  assert.ok(model.eventTimeline.some((item) => item.category === "earnings" && item.label.includes("AMD")));
  assert.ok(model.eventTimeline.some((item) => item.source === "Reuters"));
  assert.equal(model.news.length, 1);
  assert.match(model.news[0]?.bullishImplication ?? "", /supportive|constructive|Bullish/i);
  assert.match(model.news[0]?.relatedReplayContext ?? "", /Replay|memory/i);
  assert.ok(model.financialMetrics.some((metric) => metric.label === "Revenue growth" && metric.value === "12.0%"));
  assert.ok(model.researchCompleteness > 50);
});

test("buildMarketCommandModel ingests direct source-linked row news without fabricating headlines", () => {
  const rows: RankingRow[] = [{
    symbol: "NVDA",
    event_risk_score: 58,
    macro_alignment_score: 66,
    news_headline: "Analyst raises Nvidia price target on AI demand",
    news_score: 72,
    news_source: "Yahoo Finance",
    news_timestamp: "2026-05-12T14:00:00.000Z",
    news_url: "https://finance.yahoo.com/news/nvidia-price-target-ai-demand",
    sector: "Technology",
  }];

  const model = buildMarketCommandModel({
    charts: [],
    generatedAt: "2026-05-12T20:00:00.000Z",
    rows,
  });

  assert.equal(model.macroNews.length, 1);
  assert.equal(model.macroNews[0]?.source, "Yahoo Finance");
  assert.equal(model.macroNews[0]?.eventType, "analyst_action");
  assert.deepEqual(model.macroNews[0]?.relatedAssets, ["NVDA"]);
  assert.match(model.macroNews[0]?.marketMovingLabel ?? "", /impact|Tracked/i);
});

test("market command ingests only source-linked provider event domains", () => {
  const row: RankingRow = {
    analyst_revision_events: JSON.stringify([{
      affected_symbols: ["AMD"],
      event_type: "analyst_action",
      published_at: "2026-05-19T13:35:00.000Z",
      source: "StockTitan",
      source_url: "https://www.stocktitan.net/news/AMD/analyst-upgrade.html",
      title: "Analyst raises AMD price target",
    }]),
    crypto_events: [{
      affected_symbols: ["BTC", "QQQ"],
      event_type: "crypto",
      published_at: "2026-05-19T13:15:00.000Z",
      source: "CoinDesk",
      source_url: "https://www.coindesk.com/markets/bitcoin-etf-flows",
      title: "Bitcoin ETF flows shift crypto risk appetite",
    }],
    dividend_headline: "Microsoft declares quarterly dividend",
    dividend_source: "Nasdaq",
    dividend_timestamp: "2026-05-19T13:10:00.000Z",
    dividend_url: "https://www.nasdaq.com/market-activity/stocks/msft/dividend-history",
    event_risk_score: 82,
    geopolitical_events: {
      events: [{
        affected_sectors: ["Energy"],
        affected_symbols: ["USO", "SPY"],
        event_type: "geopolitical",
        published_at: "2026-05-19T13:25:00.000Z",
        source: "Reuters",
        source_url: "https://www.reuters.com/world/geopolitical-shipping-risk",
        title: "Geopolitical conflict escalates near shipping routes",
      }],
    },
    sector: "Semiconductors",
    symbol: "AMD",
    unverified_blog_events: [{
      published_at: "2026-05-19T13:00:00.000Z",
      source: "Random Blog",
      source_url: "https://example.com/unverified",
      title: "Unverified rumor",
    }],
  };

  const model = buildMarketCommandModel({ charts: [], generatedAt: "2026-05-19T14:00:00.000Z", rows: [row] });

  assert.ok(model.macroNews.some((item) => item.eventType === "analyst_action" && item.source === "StockTitan" && item.relatedAssets.includes("AMD")));
  assert.ok(model.macroNews.some((item) => item.eventType === "geopolitical" && item.source === "Reuters" && item.affectedSectors.includes("Energy")));
  assert.ok(model.macroNews.some((item) => item.eventType === "crypto" && item.source === "CoinDesk" && item.relatedAssets.includes("BTC")));
  assert.ok(model.macroNews.some((item) => item.eventType === "dividend" && item.source === "Nasdaq" && item.relatedAssets.includes("AMD")));
  assert.equal(model.macroNews.some((item) => item.source === "Random Blog"), false);
  assert.ok(model.macroNews.every((item) => item.sourceUrl.startsWith("https://")));
});

test("market command parses scanner Python-literal verified events without fabricating rows", () => {
  const row: RankingRow = {
    event_risk_score: 74,
    sector: "Energy",
    symbol: "EOG",
    verified_event_recent_events: "[{'affected_sectors': ['energy', 'commodities'], 'affected_symbols': ['OIL'], 'direction': 'negative', 'event_type': 'oil_supply_shock', 'published_at': '2026-05-25T03:05:00+00:00', 'reason_codes': ['EVENT_OIL_SUPPLY_SHOCK', 'EVENT_GEOPOLITICAL_ESCALATION'], 'scope': 'sector', 'source': 'MarketWatch', 'source_confidence': 'high', 'source_name': 'MarketWatch', 'source_url': 'https://www.marketwatch.com/story/oil-prices-tumble', 'title': \"Oil prices tumble as deal to end Iran war appears close\", 'weight': 0.42}, {'affected_sectors': ['crypto'], 'affected_symbols': [], 'direction': 'neutral', 'event_type': 'crypto_macro', 'published_at': '2026-05-25T08:09:00+00:00', 'reason_codes': ['EVENT_CRYPTO_CONTEXT'], 'scope': 'broad', 'source': 'CoinDesk', 'source_url': 'https://www.coindesk.com/markets/test', 'title': 'Bitcoin trades above $77,000 as oil\\'s slide pushes equities higher', 'weight': 0.37}]",
  };

  const model = buildMarketCommandModel({
    charts: [],
    generatedAt: "2026-05-25T12:00:00.000Z",
    rows: [row],
  });

  assert.equal(model.macroNews.length, 2);
  assert.ok(model.macroNews.some((item) => item.source === "MarketWatch" && item.eventType === "oil_supply_shock"));
  assert.ok(model.macroNews.some((item) => item.source === "CoinDesk" && item.eventType === "crypto_macro" && item.title.includes("oil's slide")));
  assert.ok(model.macroNews.every((item) => item.sourceUrl.startsWith("https://")));
});

test("market command preserves provider-domain breadth when one event type dominates", () => {
  const dividendRows: RankingRow[] = Array.from({ length: 16 }, (_, index) => ({
    dividend_headline: `DIV${index} dividend calendar context`,
    dividend_source: "Yahoo Finance Dividend Calendar",
    dividend_timestamp: "2026-05-25T12:00:00.000Z",
    dividend_url: `https://finance.yahoo.com/quote/DIV${index}`,
    event_risk_score: 95 - index,
    sector: "Financial Services",
    symbol: `DIV${index}`,
  }));
  const sourceRows: RankingRow[] = [
    {
      event_risk_score: 74,
      geopolitical_events: JSON.stringify([{
        affected_sectors: ["Energy"],
        affected_symbols: ["USO"],
        event_type: "geopolitical",
        published_at: "2026-05-25T03:05:00.000Z",
        source: "MarketWatch",
        source_url: "https://www.marketwatch.com/story/geopolitical-shipping-risk",
        title: "Geopolitical conflict escalates near shipping routes",
      }]),
      sector: "Energy",
      symbol: "USO",
    },
    {
      crypto_events: JSON.stringify([{
        affected_symbols: ["BTC"],
        event_type: "crypto",
        published_at: "2026-05-25T08:09:00.000Z",
        source: "CoinDesk",
        source_url: "https://www.coindesk.com/markets/bitcoin-etf-flows",
        title: "Bitcoin ETF flows shift crypto risk appetite",
      }]),
      event_risk_score: 70,
      sector: "Crypto",
      symbol: "BTC",
    },
  ];

  const model = buildMarketCommandModel({ charts: [], generatedAt: "2026-05-25T13:00:00.000Z", rows: [...dividendRows, ...sourceRows] });

  assert.equal(model.macroNews.length, 12);
  assert.ok(model.macroNews.some((item) => item.source === "MarketWatch" && item.eventType === "geopolitical"));
  assert.ok(model.macroNews.some((item) => item.source === "CoinDesk" && item.eventType === "crypto"));
  assert.ok(model.macroNews.some((item) => item.source === "Yahoo Finance Dividend Calendar" && item.eventType === "dividend"));
});
