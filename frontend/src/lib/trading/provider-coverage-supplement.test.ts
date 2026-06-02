import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSupplementalProviderEvents,
  parseMarketBeatAnalystActions,
  parseNasdaqMacroAndGeopoliticalEvents,
  parseStockTitanAnalystActions,
  parseTreasuryDailyYieldCurveRates,
} from "./provider-coverage-supplement";

test("parses source-linked MarketBeat analyst rows without fabricating missing fields", () => {
  const html = `
    <table><tbody>
      <tr>
        <td data-clean="APPS|Digital Turbine"><a href="/stocks/NASDAQ/APPS/forecast/">APPS</a></td>
        <td data-sort-value="Upgraded by">Upgraded by</td>
        <td data-clean="Bank of America|0">Bank of America</td>
        <td data-clean="Jane Analyst|"></td>
        <td data-clean="$6.68|38.9%">$6.68</td>
        <td data-clean="$0.00|$7.50">$7.50</td>
        <td data-clean="Neutral|Buy">Neutral to Buy</td>
        <td><a href="/all-access/ratings-screener/details/2408318/">Details</a></td>
      </tr>
    </tbody></table>`;
  const events = parseMarketBeatAnalystActions(html, "https://www.marketbeat.com/ratings/upgrades/", new Date("2026-05-28T12:00:00.000Z"));

  assert.equal(events.length, 1);
  assert.equal(events[0]?.source, "MarketBeat");
  assert.equal(events[0]?.eventType, "analyst_action");
  assert.equal(events[0]?.publishedAt, "2026-05-28T12:00:00.000Z");
  assert.deepEqual(events[0]?.relatedAssets, ["APPS"]);
  assert.match(events[0]?.sourceUrl ?? "", /^https:\/\/www\.marketbeat\.com\/all-access\/ratings-screener\/details\/2408318\//);
  assert.match(events[0]?.title ?? "", /Bank of America upgraded APPS/i);
});

test("parses StockTitan analyst RSS only when the headline is analyst-action related", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Analyst raises AMD price target | AMD Stock News</title><link>https://www.stocktitan.net/news/AMD/analyst-upgrade.html</link><pubDate>Thu, 28 May 2026 13:00:00 GMT</pubDate></item>
    <item><title>Company announces annual meeting | ABC Stock News</title><link>https://www.stocktitan.net/news/ABC/annual-meeting.html</link><pubDate>Thu, 28 May 2026 12:00:00 GMT</pubDate></item>
  </channel></rss>`;

  const events = parseStockTitanAnalystActions(xml);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.source, "StockTitan");
  assert.equal(events[0]?.eventType, "analyst_action");
  assert.deepEqual(events[0]?.relatedAssets, ["AMD"]);
});

test("parses Nasdaq geopolitical and commodity rows with source URLs and affected sectors", () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Stocks Settle Mixed on Conflicting US-Iran Signals</title><link>https://www.nasdaq.com/articles/stocks-settle-mixed-conflicting-us-iran-signals</link><pubDate>Thu, 28 May 2026 02:17:26 +0000</pubDate><description>Markets react to geopolitical uncertainty.</description></item>
    <item><title>Corn Pressure from Crude Continues on Wednesday</title><link>https://www.nasdaq.com/articles/corn-pressure-crude-continues-wednesday</link><pubDate>Thu, 28 May 2026 01:08:21 +0000</pubDate><description>Commodity context.</description></item>
  </channel></rss>`;

  const events = parseNasdaqMacroAndGeopoliticalEvents(xml);

  assert.equal(events.length, 2);
  assert.ok(events.some((item) => item.eventType === "geopolitical" && item.affectedSectors.includes("Energy")));
  assert.ok(events.some((item) => item.eventType === "macro_data" && item.reasonCodes.includes("EVENT_INFLATION_PRESSURE")));
  assert.ok(events.every((item) => item.source === "Nasdaq" && item.sourceUrl.startsWith("https://www.nasdaq.com/")));
});

test("parses official Treasury yield curve XML as source-linked rates evidence", () => {
  const xml = `<?xml version="1.0"?>
    <feed>
      <updated>2026-06-01T15:48:01Z</updated>
      <entry>
        <updated>2026-05-29T15:48:01Z</updated>
        <content><m:properties>
          <d:NEW_DATE m:type="Edm.DateTime">2026-05-29T00:00:00</d:NEW_DATE>
          <d:BC_2YEAR m:type="Edm.Double">3.98</d:BC_2YEAR>
          <d:BC_10YEAR m:type="Edm.Double">4.45</d:BC_10YEAR>
        </m:properties></content>
      </entry>
      <entry>
        <updated>2026-06-01T15:48:01Z</updated>
        <content><m:properties>
          <d:NEW_DATE m:type="Edm.DateTime">2026-06-01T00:00:00</d:NEW_DATE>
          <d:BC_2YEAR m:type="Edm.Double">4.05</d:BC_2YEAR>
          <d:BC_10YEAR m:type="Edm.Double">4.47</d:BC_10YEAR>
        </m:properties></content>
      </entry>
    </feed>`;

  const events = parseTreasuryDailyYieldCurveRates(xml, new Date("2026-06-01T16:30:00.000Z"));

  assert.equal(events.length, 1);
  assert.equal(events[0]?.source, "U.S. Treasury");
  assert.equal(events[0]?.eventType, "rates");
  assert.equal(events[0]?.publishedAt, "2026-06-01T15:48:01.000Z");
  assert.match(events[0]?.sourceUrl ?? "", /^https:\/\/home\.treasury\.gov\/resource-center\/data-chart-center\/interest-rates\/pages\/xml/);
  assert.match(events[0]?.title ?? "", /2Y 4\.05%/);
  assert.match(events[0]?.relatedMacroContext ?? "", /10Y-2Y 0\.42 pp/);
});

test("selects supplemental events across rates, analyst, geopolitical, and inflation domains", async () => {
  const marketbeatRows = Array.from({ length: 6 }, (_, index) => `
      <tr>
        <td data-clean="A${index}|Analyst ${index}"><a href="/stocks/NASDAQ/A${index}/forecast/">A${index}</a></td>
        <td data-sort-value="Upgraded by">Upgraded by</td>
        <td data-clean="Broker ${index}|0">Broker ${index}</td>
        <td data-clean="Analyst ${index}|"></td>
        <td data-clean="$6.68|38.9%">$6.68</td>
        <td data-clean="$0.00|$7.50">$7.50</td>
        <td data-clean="Neutral|Buy">Neutral to Buy</td>
        <td><a href="/all-access/ratings-screener/details/${index}/">Details</a></td>
      </tr>`).join("");
  const marketbeatHtml = `<table><tbody>${marketbeatRows}</tbody></table>`;
  const nasdaqXml = `<?xml version="1.0"?><rss><channel>
    <item><title>Stocks Settle Mixed on Conflicting US-Iran Signals</title><link>https://www.nasdaq.com/articles/stocks-settle-mixed-conflicting-us-iran-signals</link><pubDate>Thu, 28 May 2026 02:17:26 +0000</pubDate><description>Markets react to geopolitical uncertainty.</description></item>
    <item><title>Corn Pressure from Crude Continues on Wednesday</title><link>https://www.nasdaq.com/articles/corn-pressure-crude-continues-wednesday</link><pubDate>Thu, 28 May 2026 01:08:21 +0000</pubDate><description>Commodity context.</description></item>
  </channel></rss>`;
  const treasuryXml = `<?xml version="1.0"?><feed><updated>2026-05-28T15:00:00Z</updated><entry><updated>2026-05-28T15:00:00Z</updated><content><m:properties><d:NEW_DATE>2026-05-28T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.00</d:BC_2YEAR><d:BC_10YEAR>4.45</d:BC_10YEAR></m:properties></content></entry></feed>`;
  const emptyRss = `<?xml version="1.0"?><rss><channel></channel></rss>`;
  const fetcher = async (url: string): Promise<Response> => {
    if (url.includes("marketbeat.com")) return new Response(marketbeatHtml, { status: 200 });
    if (url.includes("stocktitan.net")) return new Response(emptyRss, { status: 200 });
    if (url.includes("nasdaq.com")) return new Response(nasdaqXml, { status: 200 });
    if (url.includes("home.treasury.gov")) return new Response(treasuryXml, { status: 200 });
    return new Response("", { status: 404 });
  };

  const events = await fetchSupplementalProviderEvents({ fetcher, limit: 4, now: new Date("2026-05-28T12:00:00.000Z") });

  assert.equal(events.length, 4);
  assert.ok(events.some((item) => item.eventType === "rates" && item.source === "U.S. Treasury"));
  assert.ok(events.some((item) => item.eventType === "analyst_action"));
  assert.ok(events.some((item) => item.eventType === "geopolitical"));
  assert.ok(events.some((item) => item.reasonCodes.includes("EVENT_INFLATION_PRESSURE")));
});
