import { filterInteractivePricePoints, summarizePriceMove, validClosePoints, type MarketChartHubItem } from "@/lib/interactive-chart-data";
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
  direction: string;
  eventType: string;
  id: string;
  publishedAt: string;
  reasonCodes: string[];
  relatedAssets: string[];
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
  financialMetrics: ResearchMetric[];
  macroConnections: ResearchMetric[];
  news: MarketNewsItem[];
  researchCompleteness: number;
};

type RawEvent = {
  direction?: unknown;
  event_type?: unknown;
  published_at?: unknown;
  reason_codes?: unknown;
  scope?: unknown;
  source?: unknown;
  source_url?: unknown;
  title?: unknown;
  weight?: unknown;
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
    financialMetrics,
    macroConnections,
    news,
    researchCompleteness: Math.round((knownInputs / 11) * 100),
  };
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
        byKey.set(item.id, {
          ...existing,
          affectedSectors: unique([...existing.affectedSectors, ...item.affectedSectors]),
          relatedAssets: unique([...existing.relatedAssets, ...item.relatedAssets]),
          relevance: Math.max(existing.relevance, item.relevance),
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
  const raw = row.verified_event_recent_events;
  if (Array.isArray(raw)) return raw.filter(isRecord).map((item) => item as RawEvent);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => item as RawEvent) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function eventToNewsItem(event: RawEvent, row: RankingRow): MarketNewsItem | null {
  const title = text(event.title);
  const source = text(event.source);
  const sourceUrl = text(event.source_url);
  const publishedAt = text(event.published_at);
  if (!title || !source || !sourceUrl || !publishedAt || !isHttpUrl(sourceUrl)) return null;
  const eventType = text(event.event_type) ?? "market_event";
  const direction = text(event.direction) ?? "neutral";
  const reasonCodes = stringArray(event.reason_codes);
  const risk = numeric(row.event_risk_score ?? row.verified_event_pressure_score ?? row.event_shock_pressure_score) ?? 50;
  const weight = numeric(event.weight) ?? 0.5;
  const relevance = Math.round(Math.max(0, Math.min(100, risk * 0.72 + weight * 28)));
  return {
    affectedSectors: unique([text(row.sector)].filter((value): value is string => Boolean(value))),
    direction,
    eventType,
    id: `${sourceUrl}|${title}`.slice(0, 380),
    publishedAt,
    reasonCodes,
    relatedAssets: [row.symbol.toUpperCase()],
    relevance,
    scope: text(event.scope) ?? "market",
    source,
    sourceUrl,
    title,
    tone: eventTone(direction, risk),
    whyItMatters: eventWhyItMatters(eventType, direction, row.symbol, text(row.sector), reasonCodes),
  };
}

function eventWhyItMatters(eventType: string, direction: string, symbol: string, sector: string | null, reasonCodes: string[]): string {
  const normalizedType = eventType.replace(/_/g, " ");
  const scope = sector ? `${sector} / ${symbol.toUpperCase()}` : symbol.toUpperCase();
  const directionText = direction === "negative" ? "adds risk pressure to" : direction === "positive" ? "may support" : "adds context for";
  const reason = reasonCodes[0]?.replace(/^EVENT_/, "").replace(/_/g, " ").toLowerCase();
  return `${capitalize(normalizedType)} ${directionText} ${scope}${reason ? ` through ${reason}` : ""}.`;
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

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter((item): item is string => Boolean(item)).slice(0, 8);
}

function isRecord(value: unknown): value is Record<string, ScannerScalar> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 10);
}

function compactText(values: Array<string | null | undefined>): string[] {
  return unique(values.filter((value): value is string => Boolean(value)).map((value) => value.replace(/\s+/g, " ").trim()));
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
