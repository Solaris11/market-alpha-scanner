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
