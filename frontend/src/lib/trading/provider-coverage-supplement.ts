import { isVerifiedNewsSource } from "@/lib/news-source-policy";
import type { MarketNewsItem } from "./market-research";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type RssItem = {
  description: string;
  link: string;
  pubDate: string;
  title: string;
};

type HtmlCell = {
  clean: string;
  html: string;
  text: string;
};

const USER_AGENT = "TradeVeto-ProviderCoverageSupplement/1.0";
const MARKETBEAT_ANALYST_PAGES = [
  "https://www.marketbeat.com/ratings/upgrades/",
  "https://www.marketbeat.com/ratings/downgrades/",
  "https://www.marketbeat.com/ratings/initiated/",
  "https://www.marketbeat.com/ratings/price-target-changes/",
] as const;
const STOCKTITAN_RSS = "https://www.stocktitan.net/rss";
const NASDAQ_STOCKS_RSS = "https://www.nasdaq.com/feed/rssoutbound?category=Stocks";
const TREASURY_YIELD_CURVE_XML = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve";

export async function fetchSupplementalProviderEvents(input: { fetcher?: FetchLike; limit?: number; now?: Date } = {}): Promise<MarketNewsItem[]> {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? new Date();
  const limit = input.limit ?? 8;
  const batches = await Promise.all([
    fetchMarketBeatAnalystActions(fetcher, now).catch(() => []),
    fetchStockTitanAnalystActions(fetcher).catch(() => []),
    fetchNasdaqMacroAndGeopoliticalEvents(fetcher).catch(() => []),
    fetchTreasuryDailyYieldCurveRates(fetcher, now).catch(() => []),
  ]);
  const byId = new Map<string, MarketNewsItem>();
  for (const item of batches.flat()) {
    if (!isVerifiedNewsSource(item.source, item.sourceUrl)) continue;
    byId.set(item.id, item);
  }
  return selectProviderDomainCoverage(Array.from(byId.values()), limit);
}

export function parseMarketBeatAnalystActions(html: string, pageUrl: string, now: Date): MarketNewsItem[] {
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const events: MarketNewsItem[] = [];
  for (const row of rows) {
    const cells = parseHtmlCells(row);
    if (cells.length < 7) continue;
    const [company, action, brokerage, analyst, currentPrice, priceTarget, rating, details] = cells;
    const [symbol, companyName] = splitClean(company?.clean);
    const actionText = cleanText(action?.clean || action?.text);
    const brokerageText = splitClean(brokerage?.clean)[0] || cleanText(brokerage?.text);
    const analystText = splitClean(analyst?.clean)[0] || cleanText(analyst?.text);
    const priceTargetText = cleanText(priceTarget?.clean || priceTarget?.text);
    const ratingText = cleanText(rating?.clean || rating?.text);
    const currentPriceText = cleanText(currentPrice?.clean || currentPrice?.text);
    const sourceUrl = absoluteUrl(firstHref(details?.html ?? row) ?? pageUrl, pageUrl);
    if (!symbol || !actionText || !brokerageText || !sourceUrl) continue;
    if (!isAnalystActionText(`${actionText} ${ratingText} ${priceTargetText}`)) continue;
    const direction = analystDirection(`${actionText} ${ratingText}`);
    const title = [
      `${brokerageText} ${humanizeAction(actionText)} ${symbol}`,
      companyName ? `(${companyName})` : null,
      ratingText ? `rating ${ratingText.replace("|", " to ")}` : null,
      priceTargetText ? `target ${priceTargetText.replace("|", " to ")}` : null,
    ].filter((part): part is string => Boolean(part)).join(" ");
    events.push({
      affectedSectors: [],
      bearishImplication: direction === "negative"
        ? `${brokerageText} analyst action adds company-specific review pressure for ${symbol}.`
        : `Bearish read is limited unless ${symbol} fails to confirm the analyst-action catalyst.`,
      bullishImplication: direction === "positive"
        ? `${brokerageText} analyst action can support company-specific catalyst review for ${symbol}.`
        : `Bullish read is limited until ${symbol} confirms the analyst-action context with price and follow-through.`,
      direction,
      eventTrackingLabel: `Analyst action tracked from MarketBeat${analystText ? `; analyst ${analystText}` : ""}`,
      eventType: "analyst_action",
      id: `${sourceUrl}|${symbol}|${actionText}|${ratingText}|${priceTargetText}`.slice(0, 380),
      marketMovingLabel: "Source-linked analyst action",
      publishedAt: now.toISOString(),
      reasonCodes: ["EVENT_ANALYST_ACTION"],
      relatedAssets: [symbol],
      relatedMacroContext: "MarketBeat analyst-action row; action timestamp is represented by provider page retrieval time because the public row does not expose an intraday timestamp.",
      relatedReplayContext: "Replay linkage limited; no historical analog is inferred for this analyst-action row.",
      relevance: 72,
      scope: "symbol",
      source: "MarketBeat",
      sourceUrl,
      title,
      tone: direction === "negative" ? "rose" : direction === "positive" ? "emerald" : "violet",
      whyItMatters: `Analyst action adds source-linked company-specific catalyst context for ${symbol}; no recommendation certainty is inferred.`,
    });
  }
  return events.slice(0, 6);
}

export function parseStockTitanAnalystActions(xml: string): MarketNewsItem[] {
  return parseRssItems(xml)
    .filter((item) => isAnalystActionText(item.title))
    .map((item) => {
      const symbol = symbolFromStockTitanUrl(item.link) ?? symbolFromText(item.title) ?? "MARKET";
      const direction = analystDirection(item.title);
      return {
        affectedSectors: [],
        bearishImplication: direction === "negative"
          ? `${symbol} carries source-linked analyst-action pressure from StockTitan.`
          : `Bearish read is limited unless ${symbol} fails to confirm the analyst-action catalyst.`,
        bullishImplication: direction === "positive"
          ? `${symbol} has supportive source-linked analyst-action context from StockTitan.`
          : `Bullish read is limited until ${symbol} confirms the analyst-action context with price and follow-through.`,
        direction,
        eventTrackingLabel: "Analyst action tracked from StockTitan RSS",
        eventType: "analyst_action",
        id: `${item.link}|${item.title}`.slice(0, 380),
        marketMovingLabel: "Source-linked analyst action",
        publishedAt: normalizeDate(item.pubDate) ?? new Date().toISOString(),
        reasonCodes: ["EVENT_ANALYST_ACTION"],
        relatedAssets: symbol === "MARKET" ? [] : [symbol],
        relatedMacroContext: "StockTitan analyst-action news row; no macro causality is inferred.",
        relatedReplayContext: "Replay linkage limited; no historical analog is inferred for this analyst-action row.",
        relevance: 70,
        scope: symbol === "MARKET" ? "market" : "symbol",
        source: "StockTitan",
        sourceUrl: item.link,
        title: item.title,
        tone: direction === "negative" ? "rose" : direction === "positive" ? "emerald" : "violet",
        whyItMatters: `Analyst action adds source-linked catalyst context${symbol === "MARKET" ? "" : ` for ${symbol}`}; no recommendation certainty is inferred.`,
      } satisfies MarketNewsItem;
    })
    .filter((item) => isVerifiedNewsSource(item.source, item.sourceUrl))
    .slice(0, 4);
}

export function parseNasdaqMacroAndGeopoliticalEvents(xml: string): MarketNewsItem[] {
  const events: MarketNewsItem[] = [];
  for (const item of parseRssItems(xml)) {
    const text = `${item.title} ${item.description}`;
    const publishedAt = normalizeDate(item.pubDate);
    if (!publishedAt || !isVerifiedNewsSource("Nasdaq", item.link)) continue;
    if (isGeopoliticalText(text)) {
      const sectors = geopoliticalSectors(text);
      events.push({
        affectedSectors: sectors,
        bearishImplication: "Geopolitical risk can pressure liquidity, energy, defense, or broad-market risk appetite depending on follow-through.",
        bullishImplication: "Constructive read requires de-escalation confirmation and improving market breadth; no geopolitical certainty is inferred.",
        direction: /peace|deal|ceasefire|reopen|de-escal/i.test(text) ? "neutral" : "negative",
        eventTrackingLabel: "Geopolitical event tracked from Nasdaq RSS",
        eventType: "geopolitical",
        id: `${item.link}|${item.title}`.slice(0, 380),
        marketMovingLabel: "Source-linked geopolitical market context",
        publishedAt,
        reasonCodes: ["EVENT_GEOPOLITICAL_ESCALATION"],
        relatedAssets: [],
        relatedMacroContext: "Nasdaq source-linked geopolitical market context; affected sectors are disclosed with uncertainty.",
        relatedReplayContext: "Replay linkage limited; no historical analog is inferred for this geopolitical event.",
        relevance: 76,
        scope: "market",
        source: "Nasdaq",
        sourceUrl: item.link,
        title: item.title,
        tone: "rose",
        whyItMatters: `Geopolitical event may affect ${sectors.slice(0, 3).join(", ") || "broad-market"} context; no headline or market impact is inferred beyond the source row.`,
      });
      continue;
    }
    if (isCommodityInflationText(text)) {
      const sectors = commoditySectors(text);
      events.push({
        affectedSectors: sectors,
        bearishImplication: "Commodity or dollar pressure can affect inflation-sensitive risk review when confirmed by price and macro context.",
        bullishImplication: "Constructive read requires easing commodity or dollar pressure plus improving breadth; no inflation certainty is inferred.",
        direction: /lower|fall|falls|weigh|pressure|knocks/i.test(text) ? "neutral" : "negative",
        eventTrackingLabel: "Inflation/commodity proxy tracked from Nasdaq RSS",
        eventType: "macro_data",
        id: `${item.link}|${item.title}`.slice(0, 380),
        marketMovingLabel: "Source-linked commodity/inflation context",
        publishedAt,
        reasonCodes: ["EVENT_INFLATION_PRESSURE"],
        relatedAssets: [],
        relatedMacroContext: "Nasdaq source-linked commodity or dollar context; inflation linkage is an uncertainty-labeled proxy, not a CPI claim.",
        relatedReplayContext: "Replay linkage limited; no historical analog is inferred for this commodity/inflation proxy.",
        relevance: 68,
        scope: "market",
        source: "Nasdaq",
        sourceUrl: item.link,
        title: item.title,
        tone: "amber",
        whyItMatters: `Commodity or dollar context can affect inflation-sensitive market interpretation across ${sectors.slice(0, 3).join(", ") || "macro"} sectors.`,
      });
    }
  }
  return events.slice(0, 6);
}

export function parseTreasuryDailyYieldCurveRates(xml: string, now: Date): MarketNewsItem[] {
  const feedUpdated = normalizeDate(firstTag(xml, "updated") ?? "") ?? now.toISOString();
  const entries = (xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [])
    .map((entry) => treasuryYieldCurveEntry(entry, feedUpdated))
    .filter((entry): entry is TreasuryYieldCurveEntry => entry !== null)
    .sort((left, right) => Date.parse(right.recordDate) - Date.parse(left.recordDate));
  const latest = entries[0] ?? null;
  if (!latest) return [];
  const slope = latest.tenYear !== null && latest.twoYear !== null ? Number((latest.tenYear - latest.twoYear).toFixed(2)) : null;
  const sourceUrl = treasurySourceUrl(now);
  return [{
    affectedSectors: ["Bonds", "Financials", "Growth equities"],
    bearishImplication: "Higher or steeper Treasury-rate pressure can reduce risk appetite for rate-sensitive growth and duration-heavy assets when confirmed by price action.",
    bullishImplication: "Lower or easing Treasury-rate pressure can support liquidity-sensitive risk review when breadth and price confirmation improve.",
    direction: slope !== null && slope < 0 ? "negative" : "neutral",
    eventTrackingLabel: "Official U.S. Treasury daily yield-curve feed",
    eventType: "rates",
    id: `${sourceUrl}|${latest.recordDate}|${latest.updatedAt}`.slice(0, 380),
    marketMovingLabel: "Source-linked Treasury rates context",
    publishedAt: latest.updatedAt,
    reasonCodes: ["EVENT_RATE_PRESSURE", "EVENT_TREASURY_YIELD_CURVE"],
    relatedAssets: ["TLT", "IEF", "SPY", "QQQ"],
    relatedMacroContext: `U.S. Treasury yield curve record ${latest.recordDate.slice(0, 10)}: 2Y ${formatRate(latest.twoYear)}, 10Y ${formatRate(latest.tenYear)}${slope === null ? "" : `, 10Y-2Y ${slope.toFixed(2)} pp`}.`,
    relatedReplayContext: "Replay linkage limited; no historical analog is inferred from the Treasury feed row.",
    relevance: 78,
    scope: "market",
    source: "U.S. Treasury",
    sourceUrl,
    title: `Treasury yield curve updated: 2Y ${formatRate(latest.twoYear)}, 10Y ${formatRate(latest.tenYear)}`,
    tone: slope !== null && slope < 0 ? "rose" : "amber",
    whyItMatters: "Treasury yields are source-linked rates context for liquidity, duration, equity-risk appetite, and macro-sensitive scanner interpretation; no trading outcome is implied.",
  }];
}

async function fetchMarketBeatAnalystActions(fetcher: FetchLike, now: Date): Promise<MarketNewsItem[]> {
  const htmlPages = await Promise.all(MARKETBEAT_ANALYST_PAGES.map(async (url) => {
    const response = await fetcher(url, requestInit());
    if (!response.ok) return [];
    return parseMarketBeatAnalystActions(await response.text(), url, now);
  }));
  return htmlPages.flat();
}

async function fetchStockTitanAnalystActions(fetcher: FetchLike): Promise<MarketNewsItem[]> {
  const response = await fetcher(STOCKTITAN_RSS, requestInit());
  if (!response.ok) return [];
  return parseStockTitanAnalystActions(await response.text());
}

async function fetchNasdaqMacroAndGeopoliticalEvents(fetcher: FetchLike): Promise<MarketNewsItem[]> {
  const response = await fetcher(NASDAQ_STOCKS_RSS, requestInit());
  if (!response.ok) return [];
  return parseNasdaqMacroAndGeopoliticalEvents(await response.text());
}

async function fetchTreasuryDailyYieldCurveRates(fetcher: FetchLike, now: Date): Promise<MarketNewsItem[]> {
  const year = now.getUTCFullYear();
  const response = await fetcher(`${TREASURY_YIELD_CURVE_XML}&field_tdr_date_value=${year}`, requestInit());
  if (!response.ok) return [];
  return parseTreasuryDailyYieldCurveRates(await response.text(), now);
}

function requestInit(): RequestInit {
  return {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(6000),
  };
}

type TreasuryYieldCurveEntry = {
  recordDate: string;
  tenYear: number | null;
  twoYear: number | null;
  updatedAt: string;
};

function treasuryYieldCurveEntry(entry: string, feedUpdated: string): TreasuryYieldCurveEntry | null {
  const recordDate = normalizeDate(firstTag(entry, "d:NEW_DATE") ?? "");
  if (!recordDate) return null;
  return {
    recordDate,
    tenYear: numericTag(entry, "d:BC_10YEAR"),
    twoYear: numericTag(entry, "d:BC_2YEAR"),
    updatedAt: normalizeDate(firstTag(entry, "updated") ?? "") ?? feedUpdated,
  };
}

function numericTag(raw: string, tag: string): number | null {
  const value = Number(firstTag(raw, tag) ?? "");
  return Number.isFinite(value) ? value : null;
}

function parseRssItems(xml: string): RssItem[] {
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []).map((raw) => ({
    description: decodeEntities(stripTags(firstTag(raw, "description") ?? "")),
    link: decodeEntities(stripCdata(firstTag(raw, "link") ?? "")).trim(),
    pubDate: decodeEntities(stripTags(firstTag(raw, "pubDate") ?? firstTag(raw, "published") ?? "")),
    title: decodeEntities(stripTags(firstTag(raw, "title") ?? "")),
  })).filter((item) => item.title && item.link);
}

function parseHtmlCells(row: string): HtmlCell[] {
  return (row.match(/<td\b[\s\S]*?<\/td>/gi) ?? []).map((cell) => {
    const clean = attr(cell, "data-clean") || attr(cell, "data-sort-value") || "";
    return {
      clean: decodeEntities(clean),
      html: cell,
      text: decodeEntities(stripTags(cell)).replace(/\s+/g, " ").trim(),
    };
  });
}

function firstTag(raw: string, tag: string): string | null {
  const match = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? null;
}

function stripTags(value: string): string {
  return stripCdata(value).replace(/<[^>]+>/g, " ");
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function attr(html: string, name: string): string | null {
  const match = html.match(new RegExp(`${name}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function firstHref(html: string): string | null {
  return attr(html, "href");
}

function absoluteUrl(value: string, base: string): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return base;
  }
}

function splitClean(value: string | undefined): [string, string] {
  const [first = "", second = ""] = String(value ?? "").split("|").map((item) => cleanText(item));
  return [first, second];
}

function cleanText(value: string | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x279D;/gi, "->")
    .replace(/&nbsp;/g, " ");
}

function normalizeDate(value: string): string | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function treasurySourceUrl(now: Date): string {
  return `${TREASURY_YIELD_CURVE_XML}&field_tdr_date_value=${now.getUTCFullYear()}`;
}

function formatRate(value: number | null): string {
  return value === null ? "not available" : `${value.toFixed(2)}%`;
}

function isAnalystActionText(value: string): boolean {
  return /\banalyst\b|\bupgrade(?:d|s)?\b|\bdowngrade(?:d|s)?\b|price target|\binitiated\b|\binitiates\b|\brating\b|\bcoverage\b/i.test(value);
}

function analystDirection(value: string): "negative" | "neutral" | "positive" {
  if (/\bdowngrade(?:d|s)?\b|\bunderperform\b|\bsell\b|\breduce\b|\bcut\b|\blower/i.test(value)) return "negative";
  if (/\bupgrade(?:d|s)?\b|\bbuy\b|\boutperform\b|\braise|\braised|\bhigher/i.test(value)) return "positive";
  return "neutral";
}

function humanizeAction(value: string): string {
  return value.replace(/\bby\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isGeopoliticalText(value: string): boolean {
  return /\biran\b|\bhormuz\b|\bwar\b|\bconflict\b|\bsanction\b|\bgeopolitical\b|\bmissile\b|\bstrike\b|\bdefense\b|\bceasefire\b|\bpeace\b/i.test(value);
}

function isCommodityInflationText(value: string): boolean {
  return /\bcrude\b|\boil\b|\bcommodity\b|\bcommodities\b|\bcotton\b|\bsugar\b|\bcocoa\b|\bcorn\b|\bwheat\b|\bdollar\b|\binflation\b/i.test(value);
}

function geopoliticalSectors(value: string): string[] {
  const sectors = ["Broad market"];
  if (/\boil\b|\bcrude\b|\bhormuz\b|\biran\b/i.test(value)) sectors.push("Energy", "Commodities");
  if (/\bdefense\b|\bmissile\b|\bstrike\b|\bwar\b/i.test(value)) sectors.push("Defense");
  return uniqueStrings(sectors);
}

function commoditySectors(value: string): string[] {
  const sectors = ["Commodities"];
  if (/\boil\b|\bcrude\b/i.test(value)) sectors.push("Energy");
  if (/\bdollar\b/i.test(value)) sectors.push("Currency");
  return uniqueStrings(sectors);
}

function symbolFromStockTitanUrl(value: string): string | null {
  const match = value.match(/\/news\/([A-Z0-9.-]{1,12})\//);
  return match?.[1] ?? null;
}

function symbolFromText(value: string): string | null {
  const match = value.match(/\|\s*([A-Z0-9.-]{1,12})\s+Stock News/i) ?? value.match(/\(([A-Z0-9.-]{1,12})\)/);
  return match?.[1]?.toUpperCase() ?? null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 8);
}

function selectProviderDomainCoverage(items: MarketNewsItem[], limit: number): MarketNewsItem[] {
  const sorted = [...items].sort(compareMarketNewsRecency);
  const selected = new Map<string, MarketNewsItem>();
  for (const domain of ["rates", "analyst-actions", "geopolitical-events", "inflation"] as const) {
    const match = sorted.find((item) => !selected.has(item.id) && providerDomain(item) === domain);
    if (match) selected.set(match.id, match);
  }
  for (const item of sorted) {
    if (selected.size >= limit) break;
    selected.set(item.id, item);
  }
  return Array.from(selected.values()).slice(0, limit);
}

function compareMarketNewsRecency(left: MarketNewsItem, right: MarketNewsItem): number {
  return Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || right.relevance - left.relevance;
}

function providerDomain(item: MarketNewsItem): "analyst-actions" | "geopolitical-events" | "inflation" | "rates" | "other" {
  const text = `${item.eventType} ${item.title} ${item.reasonCodes.join(" ")} ${item.relatedMacroContext}`.toLowerCase();
  if (item.eventType === "rates" || /event_rate_pressure|event_treasury_yield_curve|\byield curve\b|\btreasury\b|\b10y\b|\b2y\b/.test(text)) return "rates";
  if (item.eventType === "analyst_action" || /\banalyst\b|price target|\bupgrade|\bdowngrade|\bcoverage\b/.test(text)) return "analyst-actions";
  if (item.eventType === "geopolitical" || /event_geopolitical|\biran\b|\bhormuz\b|\bgeopolitical\b|\bsanction\b|\bwar\b|\bconflict\b/.test(text)) return "geopolitical-events";
  if (/event_inflation_pressure|\binflation\b|\bcommodity\b|\bcommodities\b|\bcrude\b|\boil\b|\bdollar\b|\bcorn\b|\bwheat\b|\bcotton\b|\bsugar\b|\bcocoa\b/.test(text)) return "inflation";
  return "other";
}
