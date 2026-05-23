import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isVerifiedNewsSource, verifiedNewsItemFromRow } from "./news-source-policy";

describe("news source policy", () => {
  it("allows reputable linked financial news", () => {
    assert.equal(isVerifiedNewsSource("Reuters", "https://www.reuters.com/markets/example"), true);
    assert.equal(isVerifiedNewsSource("Yahoo Finance", "https://finance.yahoo.com/news/example"), true);
    assert.equal(isVerifiedNewsSource("Nasdaq", "https://www.nasdaq.com/articles/example"), true);
    assert.equal(isVerifiedNewsSource("Federal Reserve", "https://www.federalreserve.gov/newsevents/pressreleases/example.htm"), true);
    assert.equal(isVerifiedNewsSource("CFTC", "https://www.cftc.gov/PressRoom/PressReleases/example"), true);
    assert.equal(isVerifiedNewsSource("PR Newswire", "https://www.prnewswire.com/news-releases/company-example.html"), true);
    assert.equal(isVerifiedNewsSource("StockTitan", "https://www.stocktitan.net/news/NVDA/example.html"), true);
    assert.equal(isVerifiedNewsSource("Benzinga", "https://www.benzinga.com/markets/equities/example"), true);
    assert.equal(isVerifiedNewsSource("Financial Modeling Prep", "https://financialmodelingprep.com/market-news/example"), true);
    assert.equal(isVerifiedNewsSource("IMF", "https://www.imf.org/en/News/Articles/example"), true);
    assert.equal(isVerifiedNewsSource("European Central Bank", "https://www.ecb.europa.eu/press/example"), true);
    assert.equal(isVerifiedNewsSource("CoinDesk", "https://www.coindesk.com/markets/example"), true);
  });

  it("blocks unverified social and missing urls", () => {
    assert.equal(isVerifiedNewsSource("Reddit", "https://www.reddit.com/r/stocks/comments/example"), false);
    assert.equal(isVerifiedNewsSource("Stocktwits", "https://stocktwits.com/symbol/NVDA"), false);
    assert.equal(verifiedNewsItemFromRow({ news_headline: "Headline", news_source: "Reuters", news_timestamp: "2026-05-05T00:00:00Z" }), null);
  });

  it("requires source, timestamp, headline, and URL", () => {
    const item = verifiedNewsItemFromRow({
      news_headline: "Company reports quarterly results",
      news_score: 61,
      news_source: "AP News",
      news_timestamp: "2026-05-05T00:00:00Z",
      news_url: "https://apnews.com/article/example",
    });
    assert.equal(item?.headline, "Company reports quarterly results");
    assert.equal(item?.sentimentTag, "Supportive");
    assert.equal(item?.impactTag, "Moderate impact");
  });
});
