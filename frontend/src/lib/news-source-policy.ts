import type { ScannerScalar } from "./types";

export type VerifiedNewsItem = {
  headline: string;
  impactTag: string;
  sentimentTag: string;
  source: string;
  timestamp: string;
  url: string;
};

const ALLOWED_SOURCE_PATTERNS = [
  /(^|\b)yahoo\s*finance\b/i,
  /(^|\b)reuters\b/i,
  /(^|\b)ap\s*news\b/i,
  /(^|\b)associated\s*press\b/i,
  /(^|\b)cnbc\b/i,
  /(^|\b)marketwatch\b/i,
  /(^|\b)nasdaq\b/i,
  /(^|\b)sec\b/i,
  /investor\s*relations/i,
  /(^|\b)alpaca\b/i,
  /(^|\b)bloomberg\b/i,
  /(^|\b)stocktitan\b/i,
  /(^|\b)wall\s*street\s*journal\b|(^|\b)wsj\b/i,
  /(^|\b)federal\s*reserve\b|(^|\b)fed\b/i,
  /(^|\b)bureau\s*of\s*labor\s*statistics\b|(^|\b)bls\b/i,
  /(^|\b)bureau\s*of\s*economic\s*analysis\b|(^|\b)bea\b/i,
  /(^|\b)energy\s*information\s*administration\b|(^|\b)eia\b/i,
  /(^|\b)u\.?s\.?\s*treasury\b|(^|\b)treasury\b/i,
  /(^|\b)fred\b|st\.?\s*louis\s*fed/i,
  /(^|\b)cftc\b|commodity\s*futures\s*trading\s*commission/i,
  /(^|\b)u\.?s\.?\s*census\b|census\s*bureau/i,
  /(^|\b)cme\s*group\b/i,
  /(^|\b)coindesk\b/i,
  /(^|\b)pr\s*newswire\b/i,
  /(^|\b)globenewswire\b/i,
  /(^|\b)business\s*wire\b/i,
  /(^|\b)benzinga\b/i,
  /(^|\b)financial\s*modeling\s*prep\b|\bfmp\b/i,
  /(^|\b)finnhub\b/i,
  /(^|\b)polygon\.?io\b/i,
  /(^|\b)alpha\s*vantage\b/i,
  /(^|\b)iex\s*cloud\b/i,
  /(^|\b)imf\b|international\s*monetary\s*fund/i,
  /(^|\b)world\s*bank\b/i,
  /(^|\b)ecb\b|european\s*central\s*bank/i,
  /(^|\b)bank\s*of\s*england\b/i,
  /(^|\b)u\.?s\.?\s*department\s*of\s*state\b|(^|\b)state\s*department\b/i,
  /(^|\b)white\s*house\b/i,
];

const BLOCKED_SOURCE_PATTERNS = [
  /reddit/i,
  /\bx\b|twitter/i,
  /telegram/i,
  /stocktwits/i,
  /substack/i,
  /blog/i,
];

const ALLOWED_HOST_PATTERNS = [
  /(^|\.)finance\.yahoo\.com$/i,
  /(^|\.)reuters\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)cnbc\.com$/i,
  /(^|\.)marketwatch\.com$/i,
  /(^|\.)nasdaq\.com$/i,
  /(^|\.)sec\.gov$/i,
  /(^|\.)alpaca\.markets$/i,
  /(^|\.)bloomberg\.com$/i,
  /(^|\.)stocktitan\.net$/i,
  /(^|\.)wsj\.com$/i,
  /(^|\.)federalreserve\.gov$/i,
  /(^|\.)bls\.gov$/i,
  /(^|\.)bea\.gov$/i,
  /(^|\.)eia\.gov$/i,
  /(^|\.)treasury\.gov$/i,
  /(^|\.)stlouisfed\.org$/i,
  /(^|\.)cftc\.gov$/i,
  /(^|\.)census\.gov$/i,
  /(^|\.)cmegroup\.com$/i,
  /(^|\.)coindesk\.com$/i,
  /(^|\.)prnewswire\.com$/i,
  /(^|\.)globenewswire\.com$/i,
  /(^|\.)businesswire\.com$/i,
  /(^|\.)benzinga\.com$/i,
  /(^|\.)financialmodelingprep\.com$/i,
  /(^|\.)finnhub\.io$/i,
  /(^|\.)polygon\.io$/i,
  /(^|\.)alphavantage\.co$/i,
  /(^|\.)iexcloud\.io$/i,
  /(^|\.)imf\.org$/i,
  /(^|\.)worldbank\.org$/i,
  /(^|\.)ecb\.europa\.eu$/i,
  /(^|\.)bankofengland\.co\.uk$/i,
  /(^|\.)state\.gov$/i,
  /(^|\.)whitehouse\.gov$/i,
];

const BLOCKED_HOST_PATTERNS = [
  /(^|\.)reddit\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)telegram\.org$/i,
  /(^|\.)stocktwits\.com$/i,
];

export function verifiedNewsItemFromRow(row: Record<string, ScannerScalar> | undefined): VerifiedNewsItem | null {
  if (!row) return null;
  const headline = firstText(row.news_headline, row.headline, row.latest_headline, row.title, row.event_headline, row.article_title);
  const source = firstText(row.news_source, row.headline_source, row.source_name, row.provider, row.source, row.event_source);
  const url = firstText(row.news_url, row.headline_url, row.article_url, row.url, row.canonical_url, row.source_url);
  const timestamp = firstText(row.news_timestamp, row.published_at, row.publishedAt, row.pubDate, row.timestamp_utc, row.event_timestamp);
  if (!headline || !source || !url || !timestamp) return null;
  if (!isVerifiedNewsSource(source, url)) return null;
  return {
    headline,
    impactTag: conservativeImpactTag(row.news_score ?? row.event_relevance ?? row.relevance ?? row.impact_score),
    sentimentTag: conservativeSentimentTag(row.news_score ?? row.event_sentiment_score ?? row.sentiment_score),
    source,
    timestamp,
    url,
  };
}

export function isVerifiedNewsSource(source: string, url: string): boolean {
  const cleanSource = source.trim();
  if (!cleanSource || BLOCKED_SOURCE_PATTERNS.some((pattern) => pattern.test(cleanSource))) return false;
  if (!ALLOWED_SOURCE_PATTERNS.some((pattern) => pattern.test(cleanSource))) return false;
  let host = "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) return false;
  if (ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(host))) return true;
  return /investor/i.test(cleanSource) && /^[a-z0-9.-]+$/i.test(host);
}

export function conservativeSentimentTag(value: unknown): string {
  const score = numeric(value);
  if (score === null) return "Neutral";
  if (score >= 60) return "Supportive";
  if (score <= 40) return "Cautious";
  return "Neutral";
}

export function conservativeImpactTag(value: unknown): string {
  const score = numeric(value);
  if (score === null) return "Low impact";
  const distance = Math.abs(score - 50);
  if (distance >= 18) return "High impact";
  if (distance >= 10) return "Moderate impact";
  return "Low impact";
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text && text !== "N/A" && text !== "null" && text !== "undefined") return text.slice(0, 500);
  }
  return null;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
