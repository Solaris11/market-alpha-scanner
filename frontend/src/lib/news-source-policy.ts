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
  const headline = firstText(row.news_headline, row.headline, row.latest_headline, row.title);
  const source = firstText(row.news_source, row.headline_source, row.source_name, row.provider);
  const url = firstText(row.news_url, row.headline_url, row.article_url, row.url, row.canonical_url);
  const timestamp = firstText(row.news_timestamp, row.published_at, row.pubDate, row.timestamp_utc);
  if (!headline || !source || !url || !timestamp) return null;
  if (!isVerifiedNewsSource(source, url)) return null;
  return {
    headline,
    impactTag: conservativeImpactTag(row.news_score),
    sentimentTag: conservativeSentimentTag(row.news_score),
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
