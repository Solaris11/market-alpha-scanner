import { filterInteractivePricePoints, summarizePriceMove, validClosePoints, type MarketChartHubItem } from "@/lib/interactive-chart-data";
import { isVerifiedNewsSource, verifiedNewsItemFromRow } from "@/lib/news-source-policy";
import type { RankingRow, ScannerScalar } from "@/lib/types";

export type MarketCommandItem = {
  category: "bonds" | "commodity" | "crypto" | "currency" | "equity";
  chart: MarketChartHubItem;
  currentPrice: number | null;
  dataSource: string;
  dayChangePct: number | null;
  freshness: string;
  label: string;
  macroRelevance: string;
  marketPressure: number | null;
  monthChangePct: number | null;
  pointCount: number;
  row: RankingRow | null;
  symbol: string;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
  values: number[];
};

export type MarketNewsItem = {
  affectedSectors: string[];
  bearishImplication: string;
  bullishImplication: string;
  direction: string;
  eventTrackingLabel: string;
  eventType: string;
  id: string;
  marketMovingLabel: string;
  publishedAt: string;
  reasonCodes: string[];
  relatedAssets: string[];
  relatedMacroContext: string;
  relatedReplayContext: string;
  relevance: number;
  scope: string;
  source: string;
  sourceUrl: string;
  title: string;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
  whyItMatters: string;
};

export type MarketCommandModel = {
  barItems: MarketCommandItem[];
  generatedAt: string | null;
  macroNews: MarketNewsItem[];
  pressureSummary: {
    constructive: number;
    deteriorating: number;
    limited: number;
    pressureScore: number | null;
  };
};

export type ResearchMetric = {
  detail: string;
  label: string;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
  value: string;
};

export type SymbolResearchTimelineItem = {
  category: "analyst" | "dividend" | "earnings" | "macro" | "news";
  date: string;
  label: string;
  source: string;
  sourceUrl: string | null;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
};

export type SymbolResearchModel = {
  bearishFactors: string[];
  bullishFactors: string[];
  company: {
    assetType: string;
    companyName: string;
    description: string | null;
    exchange: string | null;
    headquarters: string | null;
    industry: string | null;
    marketCap: number | null;
    sector: string | null;
    symbol: string;
  };
  dividend: {
    historyAvailable: boolean;
    narrative: string;
    yield: number | null;
  };
  earnings: {
    date: string | null;
    narrative: string;
    reactionHistoryAvailable: boolean;
    riskScore: number | null;
    surpriseHistoryAvailable: boolean;
  };
  eventTimeline: SymbolResearchTimelineItem[];
  financialMetrics: ResearchMetric[];
  macroConnections: ResearchMetric[];
  news: MarketNewsItem[];
  researchCompleteness: number;
};

type RawEvent = {
  affected_sectors?: unknown;
  affected_symbols?: unknown;
  article_url?: unknown;
  bearish_implication?: unknown;
  bullish_implication?: unknown;
  canonical_url?: unknown;
  category?: unknown;
  direction?: unknown;
  event_type?: unknown;
  event_tracking_label?: unknown;
  headline?: unknown;
  impact?: unknown;
  macro_context?: unknown;
  market_moving_label?: unknown;
  news_url?: unknown;
  published_at?: unknown;
  reason_codes?: unknown;
  related_assets?: unknown;
  replay_context?: unknown;
  scope?: unknown;
  sentiment?: unknown;
  source?: unknown;
  source_name?: unknown;
  source_url?: unknown;
  timestamp?: unknown;
  title?: unknown;
  url?: unknown;
  weight?: unknown;
};

type SourceLinkedEventField = {
  eventType: string;
  key: string;
  reasonCode: string;
  scope: "market" | "sector" | "symbol";
};

type DirectSourceLinkedEventSpec = {
  affectedSectorKeys?: string[];
  affectedSymbolKeys?: string[];
  directionKeys?: string[];
  eventType: string;
  reasonCode: string;
  scope: "market" | "sector" | "symbol";
  sourceKeys: string[];
  timestampKeys: string[];
  titleKeys: string[];
  urlKeys: string[];
};

const MARKET_CATEGORY: Record<string, MarketCommandItem["category"]> = {
  BTC: "crypto",
  DIA: "equity",
  GLD: "commodity",
  QQQ: "equity",
  SPY: "equity",
  TLT: "bonds",
  UUP: "currency",
  USO: "commodity",
};

const SOURCE_LINKED_EVENT_FIELDS: SourceLinkedEventField[] = [
  { eventType: "market_event", key: "verified_event_recent_events", reasonCode: "EVENT_SOURCE_LINKED", scope: "market" },
  { eventType: "market_event", key: "source_linked_events", reasonCode: "EVENT_SOURCE_LINKED", scope: "market" },
  { eventType: "market_event", key: "provider_events", reasonCode: "EVENT_PROVIDER_LINKED", scope: "market" },
  { eventType: "market_event", key: "market_events", reasonCode: "EVENT_MARKET_CONTEXT", scope: "market" },
  { eventType: "macro_data", key: "macro_events", reasonCode: "EVENT_MACRO_CONTEXT", scope: "market" },
  { eventType: "macro_data", key: "economic_events", reasonCode: "EVENT_ECONOMIC_CALENDAR", scope: "market" },
  { eventType: "macro_data", key: "inflation_events", reasonCode: "EVENT_INFLATION_PRESSURE", scope: "market" },
  { eventType: "rates", key: "rates_events", reasonCode: "EVENT_RATE_PRESSURE", scope: "market" },
  { eventType: "analyst_action", key: "analyst_action_events", reasonCode: "EVENT_ANALYST_ACTION", scope: "symbol" },
  { eventType: "analyst_action", key: "analyst_revision_events", reasonCode: "EVENT_ANALYST_ACTION", scope: "symbol" },
  { eventType: "dividend", key: "dividend_events", reasonCode: "EVENT_DIVIDEND", scope: "symbol" },
  { eventType: "earnings", key: "earnings_events", reasonCode: "EVENT_EARNINGS", scope: "symbol" },
  { eventType: "company_event", key: "company_events", reasonCode: "EVENT_COMPANY_CATALYST", scope: "symbol" },
  { eventType: "sector_event", key: "sector_events", reasonCode: "EVENT_SECTOR_CONTEXT", scope: "sector" },
  { eventType: "geopolitical", key: "geopolitical_events", reasonCode: "EVENT_GEOPOLITICAL_ESCALATION", scope: "market" },
  { eventType: "crypto", key: "crypto_events", reasonCode: "EVENT_CRYPTO_CONTEXT", scope: "market" },
];

const DIRECT_SOURCE_LINKED_EVENT_SPECS: DirectSourceLinkedEventSpec[] = [
  {
    affectedSymbolKeys: ["analyst_action_symbols", "rating_action_symbols"],
    directionKeys: ["analyst_action_sentiment", "rating_action_sentiment", "analyst_action_direction"],
    eventType: "analyst_action",
    reasonCode: "EVENT_ANALYST_ACTION",
    scope: "symbol",
    sourceKeys: ["analyst_action_source", "rating_action_source"],
    timestampKeys: ["analyst_action_timestamp", "analyst_action_date", "rating_action_timestamp", "rating_action_date"],
    titleKeys: ["analyst_action_headline", "analyst_action_summary", "rating_action_headline", "rating_action_summary"],
    urlKeys: ["analyst_action_url", "rating_action_url"],
  },
  {
    affectedSymbolKeys: ["dividend_symbols"],
    eventType: "dividend",
    reasonCode: "EVENT_DIVIDEND",
    scope: "symbol",
    sourceKeys: ["dividend_source", "dividend_event_source"],
    timestampKeys: ["dividend_timestamp", "dividend_event_timestamp", "ex_dividend_date", "dividend_ex_date"],
    titleKeys: ["dividend_headline", "dividend_event_headline", "dividend_summary", "dividend_event_summary"],
    urlKeys: ["dividend_url", "dividend_event_url"],
  },
  {
    affectedSymbolKeys: ["earnings_symbols"],
    directionKeys: ["earnings_sentiment", "earnings_direction"],
    eventType: "earnings",
    reasonCode: "EVENT_EARNINGS",
    scope: "symbol",
    sourceKeys: ["earnings_source", "earnings_event_source"],
    timestampKeys: ["earnings_timestamp", "earnings_event_timestamp", "earnings_date"],
    titleKeys: ["earnings_headline", "earnings_event_headline", "earnings_summary", "earnings_event_summary"],
    urlKeys: ["earnings_url", "earnings_event_url"],
  },
  {
    affectedSectorKeys: ["geopolitical_affected_sectors"],
    affectedSymbolKeys: ["geopolitical_affected_symbols"],
    directionKeys: ["geopolitical_sentiment", "geopolitical_direction"],
    eventType: "geopolitical",
    reasonCode: "EVENT_GEOPOLITICAL_ESCALATION",
    scope: "market",
    sourceKeys: ["geopolitical_source", "geopolitical_event_source"],
    timestampKeys: ["geopolitical_timestamp", "geopolitical_event_timestamp", "geopolitical_event_date"],
    titleKeys: ["geopolitical_headline", "geopolitical_event_headline", "geopolitical_summary", "geopolitical_event_summary"],
    urlKeys: ["geopolitical_url", "geopolitical_event_url"],
  },
  {
    affectedSymbolKeys: ["crypto_affected_symbols", "crypto_symbols"],
    directionKeys: ["crypto_sentiment", "crypto_direction"],
    eventType: "crypto",
    reasonCode: "EVENT_CRYPTO_CONTEXT",
    scope: "market",
    sourceKeys: ["crypto_source", "crypto_event_source"],
    timestampKeys: ["crypto_timestamp", "crypto_event_timestamp", "crypto_event_date"],
    titleKeys: ["crypto_headline", "crypto_event_headline", "crypto_summary", "crypto_event_summary"],
    urlKeys: ["crypto_url", "crypto_event_url"],
  },
  {
    affectedSectorKeys: ["macro_affected_sectors", "inflation_affected_sectors", "rates_affected_sectors"],
    affectedSymbolKeys: ["macro_affected_symbols", "inflation_affected_symbols", "rates_affected_symbols"],
    directionKeys: ["macro_event_sentiment", "inflation_sentiment", "rates_sentiment", "macro_event_direction"],
    eventType: "macro_data",
    reasonCode: "EVENT_MACRO_CONTEXT",
    scope: "market",
    sourceKeys: ["macro_event_source", "inflation_source", "rates_source"],
    timestampKeys: ["macro_event_timestamp", "macro_event_date", "inflation_timestamp", "rates_timestamp", "cpi_date", "ppi_date", "fed_event_date"],
    titleKeys: ["macro_event_headline", "macro_event_summary", "inflation_headline", "inflation_summary", "rates_headline", "rates_summary"],
    urlKeys: ["macro_event_url", "inflation_url", "rates_url"],
  },
  {
    affectedSectorKeys: ["sector_event_affected_sectors", "sector_affected_sectors"],
    affectedSymbolKeys: ["sector_event_symbols", "sector_event_affected_symbols"],
    directionKeys: ["sector_event_sentiment", "sector_event_direction"],
    eventType: "sector_event",
    reasonCode: "EVENT_SECTOR_CONTEXT",
    scope: "sector",
    sourceKeys: ["sector_event_source"],
    timestampKeys: ["sector_event_timestamp", "sector_event_date"],
    titleKeys: ["sector_event_headline", "sector_event_summary"],
    urlKeys: ["sector_event_url"],
  },
];

export function buildMarketCommandModel(input: { charts: MarketChartHubItem[]; generatedAt?: string | null; rows: RankingRow[] }): MarketCommandModel {
  const rowBySymbol = new Map(input.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const barItems = input.charts.map((chart) => buildMarketCommandItem(chart, rowBySymbol.get(chart.symbol.toUpperCase()) ?? null));
  const macroNews = buildMacroNews(input.rows);
  const constructive = barItems.filter((item) => item.monthChangePct !== null && item.monthChangePct >= 0.25).length;
  const deteriorating = barItems.filter((item) => item.monthChangePct !== null && item.monthChangePct <= -0.25).length;
  const limited = barItems.filter((item) => item.monthChangePct === null).length;
  const validated = barItems.length - limited;
  const pressureScore = validated ? Math.round((deteriorating / validated) * 100) : null;
  return {
    barItems,
    generatedAt: input.generatedAt ?? null,
    macroNews,
    pressureSummary: {
      constructive,
      deteriorating,
      limited,
      pressureScore,
    },
  };
}

export function buildSymbolResearchModel(row: RankingRow, contextRows: RankingRow[] = []): SymbolResearchModel {
  const symbol = row.symbol.toUpperCase();
  const news = buildMacroNews([row, ...contextRows.filter((candidate) => candidate.symbol.toUpperCase() !== symbol)]).filter((item) => item.relatedAssets.includes(symbol)).slice(0, 8);
  const financialMetrics: ResearchMetric[] = [
    metric("Revenue growth", formatRatioPercent(numeric(row.revenue_growth)), "Top-line growth from the scanner fundamentals cache.", growthTone(numeric(row.revenue_growth))),
    metric("Earnings growth", formatRatioPercent(numeric(row.earnings_growth)), "Earnings growth from the scanner fundamentals cache.", growthTone(numeric(row.earnings_growth))),
    metric("Profit margin", formatRatioPercent(numeric(row.profit_margin)), "Profitability context where available.", marginTone(numeric(row.profit_margin))),
    metric("Operating margin", formatRatioPercent(numeric(row.operating_margin)), "Operating leverage context where available.", marginTone(numeric(row.operating_margin))),
    metric("Gross margin", formatRatioPercent(numeric(row.gross_margin)), "Gross margin context where available.", marginTone(numeric(row.gross_margin))),
    metric("Debt / equity", formatNumber(numeric(row.debt_to_equity)), "Balance-sheet leverage context where available.", debtTone(numeric(row.debt_to_equity))),
    metric("Trailing P/E", formatNumber(numeric(row.trailing_pe)), "Trailing valuation from available fundamentals.", valuationTone(numeric(row.trailing_pe))),
    metric("Forward P/E", formatNumber(numeric(row.forward_pe)), "Forward valuation when available.", valuationTone(numeric(row.forward_pe))),
  ];
  const macroConnections: ResearchMetric[] = [
    metric("Macro alignment", scoreLabel(numeric(row.macro_alignment_score)), text(row.macro_context_summary) ?? "Macro alignment is limited in the current packet.", scoreTone(numeric(row.macro_alignment_score))),
    metric("Sector alignment", scoreLabel(numeric(row.sector_alignment_score)), text(row.sector_context_label) ?? "Sector context is limited in the current packet.", scoreTone(numeric(row.sector_alignment_score))),
    metric("Event risk", scoreLabel(numeric(row.event_risk_score)), text(row.event_context_summary) ?? "Verified event context is limited.", riskTone(numeric(row.event_risk_score))),
    metric("Volatility pressure", scoreLabel(numeric(row.volatility_pressure)), "Volatility pressure from scanner risk context.", riskTone(numeric(row.volatility_pressure))),
  ];
  const bullishFactors = compactText([
    text(row.upside_driver),
    text(row.quality_reason),
    text(row.selection_reason),
    text(row.macro_context_summary),
    news.find((item) => item.tone === "emerald")?.whyItMatters,
  ]).slice(0, 5);
  const bearishFactors = compactText([
    text(row.key_risk),
    text(row.target_warning),
    text(row.event_context_summary),
    text(row.stop_loss_reason),
    news.find((item) => item.tone === "rose" || item.tone === "amber")?.whyItMatters,
  ]).slice(0, 5);
  const knownInputs = [
    row.company_name,
    row.sector,
    row.industry,
    row.market_cap,
    row.earnings_date,
    row.dividend_yield,
    row.revenue_growth,
    row.earnings_growth,
    row.trailing_pe,
    row.forward_pe,
    row.verified_event_recent_events,
  ].filter((value) => value !== null && value !== undefined && String(value).trim() !== "").length;
  const eventTimeline = buildSymbolResearchTimeline(row, news);
  return {
    bearishFactors: bearishFactors.length ? bearishFactors : ["No validated bearish company-specific factor is available yet."],
    bullishFactors: bullishFactors.length ? bullishFactors : ["No validated bullish company-specific factor is available yet."],
    company: {
      assetType: text(row.asset_type) ?? "Unknown",
      companyName: text(row.company_name) ?? symbol,
      description: text(row.company_description ?? row.long_business_summary ?? row.description),
      exchange: text(row.exchange ?? row.primary_exchange ?? row.data_provider_primary),
      headquarters: text(row.headquarters ?? row.city ?? row.country),
      industry: text(row.industry),
      marketCap: numeric(row.market_cap),
      sector: text(row.sector),
      symbol,
    },
    dividend: {
      historyAvailable: Boolean(row.dividend_history ?? row.ex_dividend_date ?? row.payout_history),
      narrative: dividendNarrative(row),
      yield: numeric(row.dividend_yield),
    },
    earnings: {
      date: text(row.earnings_date),
      narrative: earningsNarrative(row),
      reactionHistoryAvailable: Boolean(row.earnings_reaction_history ?? row.prior_earnings_reactions),
      riskScore: numeric(row.event_risk_score),
      surpriseHistoryAvailable: Boolean(row.earnings_surprise_history ?? row.earnings_surprise),
    },
    eventTimeline,
    financialMetrics,
    macroConnections,
    news,
    researchCompleteness: Math.round((knownInputs / 11) * 100),
  };
}

function buildSymbolResearchTimeline(row: RankingRow, news: MarketNewsItem[]): SymbolResearchTimelineItem[] {
  const items: SymbolResearchTimelineItem[] = news.map((item) => ({
    category: item.eventType === "analyst_action" ? "analyst" : item.eventType.includes("earnings") ? "earnings" : item.eventType.includes("macro") || item.eventType.includes("rates") ? "macro" : "news",
    date: item.publishedAt,
    label: item.title,
    source: item.source,
    sourceUrl: item.sourceUrl,
    tone: item.tone,
  }));
  const earningsDate = text(row.earnings_date);
  if (earningsDate) {
    items.push({
      category: "earnings",
      date: earningsDate,
      label: `${row.symbol.toUpperCase()} earnings date`,
      source: "Stored earnings calendar",
      sourceUrl: null,
      tone: riskTone(numeric(row.event_risk_score)),
    });
  }
  const exDividendDate = text(row.ex_dividend_date ?? row.dividend_ex_date);
  if (exDividendDate) {
    items.push({
      category: "dividend",
      date: exDividendDate,
      label: `${row.symbol.toUpperCase()} ex-dividend date`,
      source: "Stored dividend calendar",
      sourceUrl: null,
      tone: "cyan",
    });
  }
  const analystDate = text(row.analyst_action_date ?? row.rating_action_date ?? row.upgrade_date ?? row.downgrade_date);
  if (analystDate) {
    items.push({
      category: "analyst",
      date: analystDate,
      label: text(row.analyst_action_summary ?? row.rating_action_summary ?? row.news_headline) ?? `${row.symbol.toUpperCase()} analyst action`,
      source: "Stored analyst action",
      sourceUrl: null,
      tone: row.downgrade_date ? "rose" : "violet",
    });
  }
  return dedupeTimeline(items)
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
    .slice(0, 10);
}

function buildMarketCommandItem(chart: MarketChartHubItem, row: RankingRow | null): MarketCommandItem {
  const valid = validClosePoints(chart.chart.rows);
  const latest = valid[valid.length - 1]?.close ?? numeric(row?.price) ?? null;
  const previous = valid.length >= 2 ? valid[valid.length - 2]?.close ?? null : null;
  const dayChangePct = latest !== null && previous !== null && previous > 0 ? ((latest - previous) / previous) * 100 : numeric(row?.return_1d);
  const monthSummary = summarizePriceMove(filterInteractivePricePoints(chart.chart.rows, "1mo"));
  const monthChangePct = monthSummary.changePct;
  return {
    category: MARKET_CATEGORY[chart.symbol] ?? "equity",
    chart,
    currentPrice: latest,
    dataSource: chart.chart.dataSource,
    dayChangePct,
    freshness: chart.chart.lastUpdated ?? text(row?.last_updated_utc ?? row?.last_updated ?? row?.data_timestamp) ?? "No timestamp",
    label: chart.label,
    macroRelevance: chart.interpretation,
    marketPressure: numeric(row?.macro_pressure_score ?? row?.volatility_pressure ?? row?.event_risk_score),
    monthChangePct,
    pointCount: chart.chart.pointCount,
    row,
    symbol: chart.symbol,
    tone: marketTone(monthChangePct, numeric(row?.macro_pressure_score ?? row?.event_risk_score)),
    values: valid.slice(-34).map((point) => point.close),
  };
}

function buildMacroNews(rows: RankingRow[]): MarketNewsItem[] {
  const byKey = new Map<string, MarketNewsItem>();
  for (const row of rows) {
    for (const event of rawEvents(row)) {
      const item = eventToNewsItem(event, row);
      if (!item) continue;
      const existing = byKey.get(item.id);
      if (existing) {
        const affectedSectors = unique([...existing.affectedSectors, ...item.affectedSectors]);
        const relatedAssets = unique([...existing.relatedAssets, ...item.relatedAssets]);
        byKey.set(item.id, {
          ...existing,
          affectedSectors,
          bearishImplication: groupedBearishImplication(existing, item),
          bullishImplication: groupedBullishImplication(existing, item),
          eventTrackingLabel: strongerTrackingLabel(existing.eventTrackingLabel, item.eventTrackingLabel),
          marketMovingLabel: strongerTrackingLabel(existing.marketMovingLabel, item.marketMovingLabel),
          relatedAssets,
          reasonCodes: unique([...existing.reasonCodes, ...item.reasonCodes]),
          relevance: Math.max(existing.relevance, item.relevance),
          relatedMacroContext: groupedContext(existing.relatedMacroContext, item.relatedMacroContext, relatedAssets, "Macro"),
          relatedReplayContext: groupedContext(existing.relatedReplayContext, item.relatedReplayContext, relatedAssets, "Replay"),
          whyItMatters: relatedAssets.length > 1
            ? groupedEventWhyItMatters(existing.eventType, existing.direction, relatedAssets, affectedSectors, existing.reasonCodes)
            : existing.whyItMatters,
        });
      } else {
        byKey.set(item.id, item);
      }
    }
  }
  return Array.from(byKey.values())
    .sort((left, right) => right.relevance - left.relevance || Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 12);
}

function rawEvents(row: RankingRow): RawEvent[] {
  const events: RawEvent[] = [];
  for (const field of SOURCE_LINKED_EVENT_FIELDS) {
    events.push(...rawEventsFromField(row[field.key], field));
  }
  events.push(...directSourceLinkedEventsFromRow(row));
  const directNews = verifiedNewsItemFromRow(row);
  if (directNews) {
    events.push({
      direction: directionFromSentiment(directNews.sentimentTag),
      event_type: inferEventType(`${directNews.headline} ${text(row.event_context_summary) ?? ""} ${text(row.sector) ?? ""}`),
      published_at: directNews.timestamp,
      reason_codes: [directNews.impactTag === "High impact" ? "NEWS_HIGH_IMPACT" : "NEWS_SOURCE_LINKED"],
      scope: "symbol",
      source: directNews.source,
      source_url: directNews.url,
      title: directNews.headline,
      weight: directNews.impactTag === "High impact" ? 0.95 : directNews.impactTag === "Moderate impact" ? 0.72 : 0.42,
    });
  }
  return events;
}

function rawEventsFromField(raw: ScannerScalar, field: SourceLinkedEventField): RawEvent[] {
  return parseRawEventList(raw).map((event) => ({
    ...event,
    event_type: event.event_type ?? field.eventType,
    reason_codes: mergeReasonCodes(event.reason_codes, field.reasonCode),
    scope: event.scope ?? field.scope,
  }));
}

function parseRawEventList(raw: ScannerScalar): RawEvent[] {
  if (Array.isArray(raw) || isRecord(raw)) return rawEventsFromParsedValue(raw);
  if (typeof raw !== "string") return [];
  const normalized = raw.trim();
  if (!normalized) return [];
  try {
    return rawEventsFromParsedValue(JSON.parse(normalized) as unknown);
  } catch {
    const parsed = parsePythonLiteralPayload(normalized);
    if (parsed !== null) return rawEventsFromParsedValue(parsed);
  }
  return [];
}

function rawEventsFromParsedValue(value: unknown): RawEvent[] {
  if (Array.isArray(value)) return value.filter(isRecord).map((item) => item as RawEvent);
  if (isRecord(value)) {
    const nested = value.events ?? value.items ?? value.data ?? null;
    if (Array.isArray(nested)) return nested.filter(isRecord).map((item) => item as RawEvent);
    return [value as RawEvent];
  }
  return [];
}

function parsePythonLiteralPayload(raw: string): unknown | null {
  const json = pythonLiteralToJson(raw);
  if (json === null) return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    // Scanner-owned provider payloads are best-effort; malformed rows must not fabricate events.
    return null;
  }
}

function pythonLiteralToJson(raw: string): string | null {
  let output = "";
  let inString = false;
  let quote: "'" | "\"" | null = null;
  let escaped = false;
  for (const char of raw) {
    if (inString) {
      if (escaped) {
        if (char === "'") output += "'";
        else if (char === "\"") output += "\\\"";
        else if (char === "\\") output += "\\\\";
        else output += `\\${char}`;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        output += "\"";
        inString = false;
        quote = null;
        continue;
      }
      output += char === "\"" ? "\\\"" : char;
      continue;
    }
    if (char === "'" || char === "\"") {
      inString = true;
      quote = char;
      output += "\"";
      continue;
    }
    output += char;
  }
  if (inString || escaped) return null;
  return output
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
}

function directSourceLinkedEventsFromRow(row: RankingRow): RawEvent[] {
  const events: RawEvent[] = [];
  for (const spec of DIRECT_SOURCE_LINKED_EVENT_SPECS) {
    const event = directSourceLinkedEventFromRow(row, spec);
    if (event) events.push(event);
  }
  return events;
}

function directSourceLinkedEventFromRow(row: RankingRow, spec: DirectSourceLinkedEventSpec): RawEvent | null {
  const title = firstRowText(row, spec.titleKeys);
  const source = firstRowText(row, spec.sourceKeys);
  const sourceUrl = firstRowText(row, spec.urlKeys);
  const publishedAt = firstRowText(row, spec.timestampKeys);
  if (!title || !source || !sourceUrl || !publishedAt) return null;
  const affectedSymbols = unique([
    ...rowStringArray(row, spec.affectedSymbolKeys ?? []),
    row.symbol.toUpperCase(),
  ]);
  const affectedSectors = unique([
    ...rowStringArray(row, spec.affectedSectorKeys ?? []),
    text(row.sector) ?? "",
  ]);
  return {
    affected_sectors: affectedSectors,
    affected_symbols: affectedSymbols,
    direction: firstRowText(row, spec.directionKeys ?? []),
    event_type: spec.eventType,
    published_at: publishedAt,
    reason_codes: [spec.reasonCode],
    scope: spec.scope,
    source,
    source_url: sourceUrl,
    title,
    weight: directEventWeight(row, spec.eventType),
  };
}

function eventToNewsItem(event: RawEvent, row: RankingRow): MarketNewsItem | null {
  const title = text(event.title ?? event.headline);
  const source = text(event.source ?? event.source_name);
  const sourceUrl = text(event.source_url ?? event.url ?? event.article_url ?? event.news_url ?? event.canonical_url);
  const publishedAt = text(event.published_at ?? event.timestamp);
  if (!title || !source || !sourceUrl || !publishedAt || !isVerifiedNewsSource(source, sourceUrl)) return null;
  const eventType = text(event.event_type ?? event.category) ?? inferEventType(title);
  const direction = normalizedDirection(text(event.direction ?? event.sentiment ?? event.impact));
  const reasonCodes = stringArray(event.reason_codes);
  const risk = numeric(row.event_risk_score ?? row.verified_event_pressure_score ?? row.event_shock_pressure_score) ?? 50;
  const weight = numeric(event.weight) ?? weightFromImpact(text(event.impact ?? event.market_moving_label));
  const relevance = Math.round(Math.max(0, Math.min(100, risk * 0.72 + weight * 28)));
  const affectedSectors = unique([...stringArray(event.affected_sectors), text(row.sector)].filter((value): value is string => Boolean(value)));
  const relatedAssets = unique([...stringArray(event.affected_symbols), ...stringArray(event.related_assets), row.symbol.toUpperCase()]);
  return {
    affectedSectors,
    bearishImplication: text(event.bearish_implication) ?? implicationFor("bearish", eventType, direction, row),
    bullishImplication: text(event.bullish_implication) ?? implicationFor("bullish", eventType, direction, row),
    direction,
    eventTrackingLabel: text(event.event_tracking_label) ?? eventTrackingLabel(eventType, source),
    eventType,
    id: `${sourceUrl}|${title}`.slice(0, 380),
    marketMovingLabel: text(event.market_moving_label) ?? marketMovingLabel(relevance, eventType),
    publishedAt,
    reasonCodes,
    relatedAssets,
    relatedMacroContext: text(event.macro_context) ?? macroContextFor(row, eventType, direction),
    relatedReplayContext: text(event.replay_context) ?? replayContextFor(row),
    relevance,
    scope: text(event.scope) ?? "market",
    source,
    sourceUrl,
    title,
    tone: eventTone(direction, risk),
    whyItMatters: eventWhyItMatters(eventType, direction, row.symbol, text(row.sector), reasonCodes),
  };
}

function directionFromSentiment(value: string): string {
  if (/supportive|positive|bullish/i.test(value)) return "positive";
  if (/cautious|negative|bearish/i.test(value)) return "negative";
  return "neutral";
}

function normalizedDirection(value: string | null): string {
  if (!value) return "neutral";
  if (/positive|supportive|bullish|beat|upgrade|improving/i.test(value)) return "positive";
  if (/negative|cautious|bearish|miss|downgrade|deteriorating|risk/i.test(value)) return "negative";
  if (/mixed|neutral/i.test(value)) return "neutral";
  return value.toLowerCase();
}

function inferEventType(value: string): string {
  const normalized = value.toLowerCase();
  if (/upgrade|downgrade|price target|initiated|analyst|rating/.test(normalized)) return "analyst_action";
  if (/dividend|ex-dividend|payout/.test(normalized)) return "dividend";
  if (/earnings|eps|revenue|guidance|margin/.test(normalized)) return "earnings";
  if (/fed|rate|yield|treasury|bond/.test(normalized)) return "rates";
  if (/cpi|ppi|inflation|jobs|payroll|gdp|recession/.test(normalized)) return "macro_data";
  if (/war|peace|geopolitical|sanction|conflict/.test(normalized)) return "geopolitical";
  if (/oil|energy|crude|opec|gas/.test(normalized)) return "energy";
  if (/btc|bitcoin|crypto/.test(normalized)) return "crypto";
  if (/sector|industry/.test(normalized)) return "sector_event";
  return "market_event";
}

function weightFromImpact(value: string | null): number {
  if (!value) return 0.5;
  if (/high|major|urgent|market moving/i.test(value)) return 0.95;
  if (/moderate|medium/i.test(value)) return 0.72;
  if (/low/i.test(value)) return 0.35;
  return 0.5;
}

function implicationFor(kind: "bearish" | "bullish", eventType: string, direction: string, row: RankingRow): string {
  const symbol = row.symbol.toUpperCase();
  const sector = text(row.sector);
  const subject = sector ? `${symbol} and the ${sector} group` : symbol;
  const type = eventType.replace(/_/g, " ");
  if (kind === "bullish") {
    if (direction === "positive") return `Supportive ${type} context may improve risk appetite or confirmation quality for ${subject}.`;
    if (direction === "negative") return `Bullish interpretation is limited unless price structure absorbs the ${type} pressure without confidence decay.`;
    return `A constructive read would require the ${type} context to improve breadth, confidence, or macro alignment for ${subject}.`;
  }
  if (direction === "negative") return `${capitalize(type)} pressure can weaken confidence, raise volatility, or increase risk review needs for ${subject}.`;
  if (direction === "positive") return `Bearish read is limited, but failed follow-through after supportive ${type} context would be a warning for ${subject}.`;
  return `Risk remains uncertain until the ${type} context resolves into clearer price, macro, or replay evidence for ${subject}.`;
}

function macroContextFor(row: RankingRow, eventType: string, direction: string): string {
  const explicit = text(row.macro_context_summary ?? row.market_regime_label ?? row.sector_context_label);
  if (explicit) return explicit;
  const macroScore = numeric(row.macro_alignment_score ?? row.macro_pressure_score);
  if (macroScore !== null) {
    const verb = macroScore >= 65 ? "supportive" : macroScore <= 35 ? "hostile" : "mixed";
    return `Macro alignment is ${verb} at ${Math.round(macroScore)}/100 while this ${eventType.replace(/_/g, " ")} item is ${direction}.`;
  }
  return "Macro linkage is limited in the current scanner packet; treat this as source-linked context, not complete causality.";
}

function replayContextFor(row: RankingRow): string {
  const explicit = text(row.replay_context_summary ?? row.large_move_history_summary ?? row.market_memory_summary);
  if (explicit) return explicit;
  const analogScore = numeric(row.analog_quality_score ?? row.regime_similarity_score ?? row.market_memory_similarity);
  if (analogScore !== null) return `Replay/memory similarity is available at ${Math.round(analogScore)}/100; use it to compare this event against prior environments.`;
  return "Replay and market-memory linkage is limited for this headline in the current packet.";
}

function marketMovingLabel(relevance: number, eventType: string): string {
  if (relevance >= 75) return `High-impact ${eventType.replace(/_/g, " ")} event`;
  if (relevance >= 55) return `Moderate-impact ${eventType.replace(/_/g, " ")} event`;
  return `Tracked ${eventType.replace(/_/g, " ")} context`;
}

function eventTrackingLabel(eventType: string, source: string): string {
  const label = eventType.replace(/_/g, " ");
  return `${capitalize(label)} tracked from ${source}`;
}

function groupedBullishImplication(existing: MarketNewsItem, next: MarketNewsItem): string {
  const assets = unique([...existing.relatedAssets, ...next.relatedAssets]);
  if (existing.direction === "positive" || next.direction === "positive") return `Supportive interpretation applies across ${assets.slice(0, 5).join(", ")} if confirmation and macro alignment hold.`;
  return existing.bullishImplication || next.bullishImplication;
}

function groupedBearishImplication(existing: MarketNewsItem, next: MarketNewsItem): string {
  const assets = unique([...existing.relatedAssets, ...next.relatedAssets]);
  if (existing.direction === "negative" || next.direction === "negative") return `Risk interpretation applies across ${assets.slice(0, 5).join(", ")} if volatility, breadth, or confidence deteriorates further.`;
  return existing.bearishImplication || next.bearishImplication;
}

function groupedContext(left: string, right: string, assets: string[], label: "Macro" | "Replay"): string {
  if (left === right) return left;
  return `${label} context is linked across ${assets.slice(0, 5).join(", ")}. ${left}`;
}

function strongerTrackingLabel(left: string, right: string): string {
  if (/high/i.test(right) && !/high/i.test(left)) return right;
  return left || right;
}

function eventWhyItMatters(eventType: string, direction: string, symbol: string, sector: string | null, reasonCodes: string[]): string {
  const normalizedType = eventType.replace(/_/g, " ");
  const scope = sector ? `${sector} / ${symbol.toUpperCase()}` : symbol.toUpperCase();
  const directionText = direction === "negative" ? "adds risk pressure to" : direction === "positive" ? "may support" : "adds context for";
  const reason = reasonCodes[0]?.replace(/^EVENT_/, "").replace(/_/g, " ").toLowerCase();
  return `${capitalize(normalizedType)} ${directionText} ${scope}${reason ? ` through ${reason}` : ""}.`;
}

function groupedEventWhyItMatters(eventType: string, direction: string, relatedAssets: string[], affectedSectors: string[], reasonCodes: string[]): string {
  const normalizedType = eventType.replace(/_/g, " ");
  const directionText = direction === "negative" ? "adds risk pressure across" : direction === "positive" ? "may support" : "adds context across";
  const assetText = relatedAssets.slice(0, 5).join(", ");
  const sectorText = affectedSectors.length ? ` in ${affectedSectors.slice(0, 3).join(", ")}` : "";
  const reason = reasonCodes[0]?.replace(/^EVENT_/, "").replace(/_/g, " ").toLowerCase();
  return `${capitalize(normalizedType)} ${directionText} ${assetText}${sectorText}${reason ? ` through ${reason}` : ""}.`;
}

function earningsNarrative(row: RankingRow): string {
  const date = text(row.earnings_date);
  const eventSummary = text(row.event_context_summary);
  if (date && eventSummary) return `Next stored earnings date: ${date}. ${eventSummary}`;
  if (date) return `Next stored earnings date: ${date}. Prior reaction and surprise history are not yet validated in this packet.`;
  if (eventSummary) return eventSummary;
  return "Earnings date, surprise history, and post-earnings reaction data are not available yet.";
}

function dividendNarrative(row: RankingRow): string {
  const yieldValue = numeric(row.dividend_yield);
  if (yieldValue !== null && yieldValue > 0) return `Stored dividend yield is ${yieldValue.toFixed(2)}%. Ex-dividend date and payout history are not validated in this packet unless shown separately.`;
  if (yieldValue === 0) return "The latest scanner packet shows no meaningful dividend yield.";
  return "Dividend yield, ex-dividend date, and payout history are not available yet.";
}

function metric(label: string, value: string, detail: string, tone: ResearchMetric["tone"]): ResearchMetric {
  return { detail, label, tone, value };
}

function text(value: unknown): string | null {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || cleaned === "N/A" || cleaned === "null" || cleaned === "undefined" || cleaned === "NaN") return null;
  return cleaned;
}

function firstRowText(row: RankingRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return null;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter((item): item is string => Boolean(item)).slice(0, 8);
  const single = text(value);
  if (!single) return [];
  try {
    const parsed = JSON.parse(single) as unknown;
    if (Array.isArray(parsed)) return parsed.map((item) => text(item)).filter((item): item is string => Boolean(item)).slice(0, 8);
  } catch {
    // Comma-separated provider fields are handled below.
  }
  return single
    .split(",")
    .map((item) => text(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function rowStringArray(row: RankingRow, keys: string[]): string[] {
  return unique(keys.flatMap((key) => stringArray(row[key])));
}

function mergeReasonCodes(value: unknown, fallback: string): string[] {
  const codes = stringArray(value);
  if (!codes.includes(fallback)) codes.unshift(fallback);
  return codes.slice(0, 8);
}

function directEventWeight(row: RankingRow, eventType: string): number {
  const explicit = numeric(row.event_source_weight ?? row.event_relevance ?? row.news_score);
  if (explicit !== null) return explicit > 1 ? Math.max(0, Math.min(1, explicit / 100)) : Math.max(0, Math.min(1, explicit));
  const risk = numeric(row.event_risk_score ?? row.verified_event_pressure_score);
  if (risk !== null) return Math.max(0.35, Math.min(0.95, risk / 100));
  if (eventType === "geopolitical" || eventType === "rates" || eventType === "macro_data") return 0.72;
  return 0.62;
}

function isRecord(value: unknown): value is Record<string, ScannerScalar> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 10);
}

function compactText(values: Array<string | null | undefined>): string[] {
  return unique(values.filter((value): value is string => Boolean(value)).map((value) => value.replace(/\s+/g, " ").trim()));
}

function dedupeTimeline(items: SymbolResearchTimelineItem[]): SymbolResearchTimelineItem[] {
  const seen = new Set<string>();
  const deduped: SymbolResearchTimelineItem[] = [];
  for (const item of items) {
    const key = `${item.category}:${item.date}:${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function formatRatioPercent(value: number | null): string {
  if (value === null) return "Limited";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "Limited";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function scoreLabel(value: number | null): string {
  if (value === null) return "Limited";
  return `${Math.round(value)}/100`;
}

function growthTone(value: number | null): ResearchMetric["tone"] {
  if (value === null) return "cyan";
  if (value >= 0.12) return "emerald";
  if (value < 0) return "rose";
  return "amber";
}

function marginTone(value: number | null): ResearchMetric["tone"] {
  if (value === null) return "cyan";
  if (value >= 0.2) return "emerald";
  if (value < 0) return "rose";
  return "amber";
}

function debtTone(value: number | null): ResearchMetric["tone"] {
  if (value === null) return "cyan";
  if (value >= 100) return "rose";
  if (value >= 40) return "amber";
  return "emerald";
}

function valuationTone(value: number | null): ResearchMetric["tone"] {
  if (value === null) return "cyan";
  if (value >= 80) return "amber";
  if (value <= 0) return "rose";
  return "emerald";
}

function scoreTone(value: number | null): ResearchMetric["tone"] {
  if (value === null) return "cyan";
  if (value >= 65) return "emerald";
  if (value <= 35) return "rose";
  return "amber";
}

function riskTone(value: number | null): ResearchMetric["tone"] {
  if (value === null) return "cyan";
  if (value >= 70) return "rose";
  if (value >= 45) return "amber";
  return "emerald";
}

function marketTone(monthChangePct: number | null, pressure: number | null): MarketCommandItem["tone"] {
  if (pressure !== null && pressure >= 72) return "rose";
  if (monthChangePct === null) return "cyan";
  if (monthChangePct >= 2) return "emerald";
  if (monthChangePct <= -2) return "rose";
  return "amber";
}

function eventTone(direction: string, risk: number): MarketNewsItem["tone"] {
  if (direction === "positive" && risk < 70) return "emerald";
  if (direction === "negative" || risk >= 75) return "rose";
  if (risk >= 55) return "amber";
  return "cyan";
}

function capitalize(value: string): string {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value;
}
