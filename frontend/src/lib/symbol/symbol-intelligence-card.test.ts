import test from "node:test";
import assert from "node:assert/strict";
import { buildSymbolIntelligenceCard, symbolCardContextFromRow } from "./symbol-intelligence-card";
import type { SymbolDetail } from "@/lib/types";

const history: SymbolDetail["history"] = [
  { close: 100, high: 101, low: 99, open: 100, timestamp_utc: "2026-05-20T14:00:00.000Z" },
  { close: 104, high: 105, low: 100, open: 101, timestamp_utc: "2026-05-21T14:00:00.000Z" },
  { close: 106, high: 107, low: 103, open: 104, timestamp_utc: "2026-05-22T14:00:00.000Z" },
];

test("symbol card model builds decision zones from available scanner data", () => {
  const model = buildSymbolIntelligenceCard({
    detail: {
      history,
      row: {
        buy_zone_high: 102,
        buy_zone_low: 98,
        company_name: "Advanced Micro Devices",
        final_decision: "WATCH",
        final_score: 78,
        key_risk: "Invalid if semiconductor breadth breaks down.",
        price: 101,
        recent_resistance: 112,
        recent_support: 96,
        risk_reward: 2.4,
        risk_score: 42,
        sector: "Technology",
        stop_loss: 94,
        symbol: "AMD",
        take_profit_high: 118,
        take_profit_low: 114,
      },
      summary: null,
    },
    symbol: "AMD",
  });

  assert.equal(model.symbol, "AMD");
  assert.equal(model.companyName, "Advanced Micro Devices");
  assert.equal(model.decision, "WATCH");
  assert.equal(model.chart.status, "available");
  assert.equal(model.zones.find((zone) => zone.label === "Entry zone")?.status, "available");
  assert.match(model.zones.find((zone) => zone.label === "Risk/reward estimate")?.value ?? "", /2\.40R/);
});

test("source-backed profile fields require value, provider, source URL, and timestamp", () => {
  const model = buildSymbolIntelligenceCard({
    detail: {
      history,
      row: { company_name: "EOG Resources", price: 120, symbol: "EOG" },
      summary: {
        company_profile_provider: "verified-profile-provider",
        company_profile_source_url: "https://example.com/eog-profile",
        description: "EOG Resources is an energy company profile from a verified source.",
        updated_at_utc: "2026-05-24T12:00:00.000Z",
      },
    },
    symbol: "EOG",
  });

  const description = model.limitedFields.find((field) => field.label === "Company description");
  assert.equal(description?.status, "available");
  assert.equal(description?.provider, "verified-profile-provider");
  assert.equal(description?.sourceUrl, "https://example.com/eog-profile");
});

test("limited states stay honest when CEO headquarters earnings and dividends have no verified provider", () => {
  const model = buildSymbolIntelligenceCard({
    detail: {
      history,
      row: {
        ceo: "Unsupported CEO Name",
        company_name: "Example Co",
        dividend_yield: 0.02,
        earnings_surprise_history: "unsupported surprise history",
        headquarters: "Unsupported headquarters",
        price: 12,
        symbol: "EXM",
      },
      summary: null,
    },
    symbol: "EXM",
  });

  for (const label of ["Headquarters / CEO", "Earnings surprise history", "Dividend payout history"]) {
    const field = model.limitedFields.find((item) => item.label === label);
    assert.equal(field?.status, "limited", `${label} must remain limited without provider/source/timestamp`);
  }
});

test("source-linked news cards require provider URL timestamp and do not fabricate headlines", () => {
  const model = buildSymbolIntelligenceCard({
    detail: {
      history,
      row: {
        news_headline: "AMD source-linked event",
        news_source: "verified-news",
        news_timestamp: "2026-05-24T10:00:00.000Z",
        news_url: "https://example.com/amd-event",
        symbol: "AMD",
      },
      summary: null,
    },
    symbol: "AMD",
  });

  assert.equal(model.events.length, 1);
  assert.equal(model.events[0]?.headline, "AMD source-linked event");

  const limited = buildSymbolIntelligenceCard({
    detail: {
      history,
      row: {
        news_headline: "Headline without URL must not render",
        news_source: "verified-news",
        news_timestamp: "2026-05-24T10:00:00.000Z",
        symbol: "AMD",
      },
      summary: null,
    },
    symbol: "AMD",
  });
  assert.equal(limited.events.length, 0);
});

test("symbol card source context from rows preserves source and bounded symbol identity", () => {
  const context = symbolCardContextFromRow({ company_name: "NVIDIA", final_score: 101, price: 950, risk_score: -5, symbol: "nvda<script>" }, "unit-test");
  assert.equal(context.symbol, "NVDASCRIPT");
  assert.equal(context.source, "unit-test");
  assert.equal(context.companyName, "NVIDIA");
});
