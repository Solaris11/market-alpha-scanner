import type { RankingRow, ScannerScalar, SymbolDetail } from "@/lib/types";

export type SymbolCardSourceContext = {
  assetClass?: string | null;
  companyName?: string | null;
  decision?: string | null;
  freshnessLabel?: string | null;
  href?: string | null;
  price?: number | null;
  reason?: string | null;
  riskScore?: number | null;
  score?: number | null;
  sector?: string | null;
  source: string;
  symbol?: string | null;
  row?: Record<string, unknown> | null;
};

export type SymbolCardDataInput = {
  detail?: Partial<SymbolDetail> | null;
  sourceContext?: SymbolCardSourceContext | null;
  symbol: string;
};

export type SymbolDecisionZone = {
  label: string;
  limitedReason?: string;
  status: "available" | "limited";
  value: string;
};

export type SymbolSourceField = {
  label: string;
  limitedReason?: string;
  provider?: string;
  sourceUrl?: string;
  status: "available" | "limited";
  timestamp?: string;
  value: string;
};

export type SymbolEventCard = {
  affectedSymbols: string[];
  freshness: string;
  headline: string;
  provider: string;
  sourceUrl: string;
  timestamp: string;
  uncertainty: string;
};

export type SymbolChartPoint = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: string;
};

export type SymbolIntelligenceCardModel = {
  actions: Array<{ href: string; label: string }>;
  assetClass: string;
  chart: {
    limitedReason?: string;
    points: SymbolChartPoint[];
    status: "available" | "limited";
  };
  companyName: string;
  convictionScore: number | null;
  currentPrice: number | null;
  dataConfidence: string;
  decision: string;
  decisionExplanation: string;
  events: SymbolEventCard[];
  freshness: string;
  limitedFields: SymbolSourceField[];
  riskScore: number | null;
  sector: string;
  sourceContext: string;
  symbol: string;
  zones: SymbolDecisionZone[];
};

const SOURCE_URL_KEYS = [
  "source_url",
  "sourceUrl",
  "url",
  "link",
  "provider_url",
  "company_profile_source_url",
  "profile_source_url",
  "news_url",
];

const PROVIDER_KEYS = [
  "provider",
  "source",
  "provider_name",
  "providerName",
  "company_profile_provider",
  "profile_provider",
  "news_source",
];

const TIMESTAMP_KEYS = [
  "timestamp",
  "timestamp_utc",
  "published_at",
  "publishedAt",
  "updated_at",
  "updated_at_utc",
  "last_updated",
  "last_updated_utc",
  "asOf",
  "as_of",
  "news_timestamp",
];

export function cleanSymbolForCard(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

export function buildSymbolIntelligenceCard(input: SymbolCardDataInput): SymbolIntelligenceCardModel {
  const symbol = cleanSymbolForCard(input.symbol);
  const detailRow = rowRecord(input.detail?.row);
  const summary = record(input.detail?.summary);
  const contextRow = input.sourceContext?.row ? record(input.sourceContext.row) : null;
  const row = mergeRecords(contextRow, detailRow);
  const currentPrice = numberFrom(row, "price", "latest_price", "close") ?? input.sourceContext?.price ?? null;
  const companyName = textFrom(row, "company_name", "long_name", "longName", "short_name", "shortName", "name") ?? input.sourceContext?.companyName ?? "Company profile limited";
  const sector = textFrom(row, "sector", "industry", "sector_name") ?? input.sourceContext?.sector ?? "Sector limited";
  const assetClass = textFrom(row, "asset_type", "assetClass", "asset_class") ?? input.sourceContext?.assetClass ?? "Asset class limited";
  const rawDecision = textFrom(row, "final_decision", "decision", "action", "rating") ?? input.sourceContext?.decision ?? "RESEARCH ONLY";
  const decision = decisionLabel(rawDecision);
  const convictionScore = boundedScore(numberFrom(row, "final_score", "final_score_adjusted", "quality_score", "confidence_score") ?? input.sourceContext?.score ?? null);
  const riskScore = boundedScore(numberFrom(row, "risk_score", "risk_penalty", "event_risk_score", "shockRisk") ?? input.sourceContext?.riskScore ?? null);
  const freshness = textFrom(row, "freshness_label", "freshnessLabel", "last_updated_utc", "last_updated") ?? input.sourceContext?.freshnessLabel ?? "Freshness limited";
  const dataConfidence = confidenceLabel(row, summary, input.detail?.history);
  const decisionExplanation = textFrom(row, "decision_reason", "quality_reason", "selection_reason", "reason", "upside_driver")
    ?? input.sourceContext?.reason
    ?? "No source-backed decision explanation is available for this symbol yet.";
  const chartPoints = chartPointsFromHistory(input.detail?.history ?? []);

  return {
    actions: buildActions(symbol),
    assetClass,
    chart: chartPoints.length >= 2
      ? { points: chartPoints, status: "available" }
      : { limitedReason: "Limited: fewer than two verified price points are available for the chart preview.", points: chartPoints, status: "limited" },
    companyName,
    convictionScore,
    currentPrice,
    dataConfidence,
    decision,
    decisionExplanation,
    events: sourceLinkedEvents(row, symbol),
    freshness,
    limitedFields: [
      sourceBackedField("Company description", summary, row, ["longBusinessSummary", "long_business_summary", "company_description", "description"], "Limited: no verified company-description provider/source/timestamp is configured."),
      sourceBackedField("Headquarters / CEO", summary, row, ["headquarters", "headquarters_city", "ceo", "chief_executive_officer"], "Limited: no verified headquarters or CEO provider/source/timestamp is configured."),
      sourceBackedField("Earnings surprise history", summary, row, ["earnings_surprise_history", "earnings_surprises", "latest_earnings_surprise"], "Limited: no verified earnings surprise provider configured."),
      postEarningsReactionField(input.detail?.history ?? [], summary, row),
      sourceBackedField("Dividend payout history", summary, row, ["dividend_history", "dividend_payout_history", "dividend_yield", "last_dividend_amount"], "Limited: no verified dividend payout provider configured."),
      sourceLinkedNewsField(row),
    ],
    riskScore,
    sector,
    sourceContext: input.sourceContext?.source ?? "symbol_api",
    symbol,
    zones: buildDecisionZones(row, currentPrice),
  };
}

export function symbolCardContextFromRow(row: Record<string, unknown>, source: string): SymbolCardSourceContext {
  const symbol = cleanSymbolForCard(row.symbol);
  return {
    assetClass: textFrom(row, "asset_type", "assetClass", "asset_class"),
    companyName: textFrom(row, "company_name", "companyName", "name"),
    decision: textFrom(row, "final_decision", "decision", "action", "rating"),
    freshnessLabel: textFrom(row, "freshness_label", "freshnessLabel", "last_updated_utc", "last_updated"),
    href: symbol ? `/symbol/${encodeURIComponent(symbol)}` : null,
    price: numberFrom(row, "price", "latest_price", "close"),
    reason: textFrom(row, "decision_reason", "quality_reason", "selection_reason", "reason"),
    riskScore: numberFrom(row, "risk_score", "risk", "risk_penalty", "event_risk_score"),
    score: numberFrom(row, "final_score", "final_score_adjusted", "confidence", "conviction", "quality_score"),
    sector: textFrom(row, "sector", "industry"),
    source,
    symbol,
    row,
  };
}

function mergeRecords(first: Record<string, unknown> | null, second: Record<string, unknown> | null): Record<string, unknown> {
  return {
    ...(first ?? {}),
    ...(second ?? {}),
  };
}

function rowRecord(value: Partial<SymbolDetail>["row"] | undefined): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as RankingRow) : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function valueFrom(recordValue: Record<string, unknown> | null, keys: string[]): unknown {
  if (!recordValue) return null;
  for (const key of keys) {
    const value = recordValue[key];
    if (!isEmptyValue(value)) return value;
  }
  return null;
}

function textFrom(recordValue: Record<string, unknown> | null, ...keys: string[]): string | null {
  const value = valueFrom(recordValue, keys);
  const text = cleanText(value);
  return text || null;
}

function numberFrom(recordValue: Record<string, unknown> | null, ...keys: string[]): number | null {
  const value = valueFrom(recordValue, keys);
  return numeric(value);
}

function cleanText(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const lowered = raw.toLowerCase();
  if (lowered === "nan" || lowered === "none" || lowered === "null" || lowered === "undefined") return "";
  return raw;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return !cleanText(value);
  return false;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function boundedScore(value: number | null): number | null {
  if (value === null) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function decisionLabel(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (normalized === "ENTER" || normalized === "BUY" || normalized === "BUY_ZONE") return "BUY ZONE";
  if (normalized === "WAIT_PULLBACK" || normalized === "PULLBACK") return "WAIT PULLBACK";
  if (normalized === "AVOID") return "AVOID";
  if (normalized === "EXIT") return "EXIT";
  if (normalized === "WATCH") return "WATCH";
  if (normalized === "RESEARCH_ONLY" || normalized === "REVIEW") return "RESEARCH ONLY";
  return normalized ? normalized.replace(/_/g, " ") : "RESEARCH ONLY";
}

function confidenceLabel(row: Record<string, unknown>, summary: Record<string, unknown> | null, history: SymbolDetail["history"] | undefined): string {
  const explicit = textFrom(row, "confidence_label", "evidence_maturity", "confidence_reliability") ?? textFrom(summary, "confidence_label", "evidence_maturity");
  if (explicit) return explicit;
  const samples = numberFrom(row, "historical_sample_size", "market_memory_sample_size", "evidence_sample_size") ?? (Array.isArray(history) ? history.length : 0);
  if (samples >= 50) return "High evidence";
  if (samples >= 10) return "Developing evidence";
  return "Limited evidence";
}

function buildDecisionZones(row: Record<string, unknown>, currentPrice: number | null): SymbolDecisionZone[] {
  return [
    zoneFromRange("Current price", currentPrice, currentPrice, "Limited: current price is missing from verified scanner data."),
    zoneFromFields("Support levels", row, ["recent_support", "support_level", "support", "recent_swing_low", "swing_low", "avwap"], "Limited: no verified support level is available."),
    zoneFromFields("Resistance levels", row, ["recent_resistance", "resistance_level", "resistance", "recent_swing_high", "swing_high"], "Limited: no verified resistance level is available."),
    zoneFromRange("Entry zone", rangeLow(row, "entry_zone_low", "buy_zone_low", "correction_zone_low"), rangeHigh(row, "entry_zone_high", "buy_zone_high", "correction_zone_high"), "Limited: no verified entry or buy-zone range is available.", textFrom(row, "entry_zone", "buy_zone", "suggested_entry")),
    zoneFromRange("Pullback zone", rangeLow(row, "correction_zone_low", "buy_zone_low"), rangeHigh(row, "correction_zone_high", "buy_zone_high"), "Limited: no verified pullback zone is available.", textFrom(row, "correction_price", "correction_trigger_price", "correction_trigger_reason")),
    zoneFromFields("Invalidation / stop zone", row, ["stop_loss", "invalidation_level", "stop", "risk_level"], "Limited: no verified invalidation or stop context is available."),
    zoneFromRange("Profit-taking zones", rangeLow(row, "take_profit_low"), rangeHigh(row, "take_profit_high"), "Limited: no verified profit-taking zone is available.", textFrom(row, "take_profit_zone", "take_profit", "conservative_target", "balanced_target", "aggressive_target")),
    textZone("Exit / avoid condition", textFrom(row, "key_risk", "target_warning", "stop_loss_reason", "exit_condition"), "Limited: no verified exit or avoid condition is available."),
    textZone("Risk/reward estimate", riskRewardText(row), "Limited: risk/reward cannot be estimated without verified entry, stop, and target context."),
    textZone("What would change the decision", textFrom(row, "correction_trigger_reason", "decision_reason", "quality_reason"), "Limited: no verified decision-change explanation is available."),
  ];
}

function rangeLow(row: Record<string, unknown>, ...keys: string[]): number | null {
  return numberFrom(row, ...keys);
}

function rangeHigh(row: Record<string, unknown>, ...keys: string[]): number | null {
  return numberFrom(row, ...keys);
}

function zoneFromFields(label: string, row: Record<string, unknown>, keys: string[], limitedReason: string): SymbolDecisionZone {
  const numericValue = numberFrom(row, ...keys);
  const textValue = textFrom(row, ...keys);
  if (numericValue !== null) return { label, status: "available", value: money(numericValue) };
  if (textValue) return { label, status: "available", value: textValue };
  return { label, limitedReason, status: "limited", value: "LIMITED" };
}

function zoneFromRange(label: string, low: number | null, high: number | null, limitedReason: string, textFallback?: string | null): SymbolDecisionZone {
  if (low !== null && high !== null) {
    return { label, status: "available", value: low === high ? money(low) : `${money(Math.min(low, high))} - ${money(Math.max(low, high))}` };
  }
  const single = low ?? high;
  if (single !== null) return { label, status: "available", value: money(single) };
  if (textFallback) return { label, status: "available", value: textFallback };
  return { label, limitedReason, status: "limited", value: "LIMITED" };
}

function textZone(label: string, value: string | null, limitedReason: string): SymbolDecisionZone {
  return value ? { label, status: "available", value } : { label, limitedReason, status: "limited", value: "LIMITED" };
}

function riskRewardText(row: Record<string, unknown>): string | null {
  const direct = numberFrom(row, "risk_reward", "conservative_risk_reward");
  if (direct !== null) return `${direct.toFixed(2)}R`;
  const low = numberFrom(row, "risk_reward_low", "balanced_risk_reward_low", "aggressive_risk_reward_low");
  const high = numberFrom(row, "risk_reward_high", "balanced_risk_reward_high", "aggressive_risk_reward_high");
  if (low !== null && high !== null) return `${Math.min(low, high).toFixed(2)}R - ${Math.max(low, high).toFixed(2)}R`;
  return textFrom(row, "risk_reward_label", "target_risk_reward_label", "risk_reward_reason");
}

function money(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: value >= 100 ? 2 : 4, style: "currency" });
}

function sourceBackedField(
  label: string,
  summary: Record<string, unknown> | null,
  row: Record<string, unknown>,
  valueKeys: string[],
  limitedReason: string,
): SymbolSourceField {
  const sourceRecord = summary ?? row;
  const value = cleanText(valueFrom(summary, valueKeys)) || cleanText(valueFrom(row, valueKeys));
  const provider = textFrom(sourceRecord, ...PROVIDER_KEYS);
  const sourceUrl = textFrom(sourceRecord, ...SOURCE_URL_KEYS);
  const timestamp = textFrom(sourceRecord, ...TIMESTAMP_KEYS);
  if (value && provider && sourceUrl && timestamp) {
    return { label, provider, sourceUrl, status: "available", timestamp, value };
  }
  return { label, limitedReason, status: "limited", value: "LIMITED" };
}

function sourceLinkedNewsField(row: Record<string, unknown>): SymbolSourceField {
  const events = sourceLinkedEvents(row, cleanSymbolForCard(row.symbol));
  if (events.length) {
    const first = events[0]!;
    return {
      label: "Source-linked news context",
      provider: first.provider,
      sourceUrl: first.sourceUrl,
      status: "available",
      timestamp: first.timestamp,
      value: first.headline,
    };
  }
  return {
    label: "Source-linked news context",
    limitedReason: "Limited: no source-linked news card with provider, URL, timestamp, and freshness is available.",
    status: "limited",
    value: "LIMITED",
  };
}

function postEarningsReactionField(history: SymbolDetail["history"], summary: Record<string, unknown> | null, row: Record<string, unknown>): SymbolSourceField {
  const earningsDate = textFrom(summary, "earnings_date", "latest_earnings_date", "next_earnings_date") ?? textFrom(row, "earnings_date", "latest_earnings_date");
  if (!earningsDate) {
    return {
      label: "Post-earnings reaction history",
      limitedReason: "Limited: earnings dates are missing, so post-earnings reaction is not computed.",
      status: "limited",
      value: "LIMITED",
    };
  }
  const points = chartPointsFromHistory(history);
  const reaction = computePostEventReaction(points, earningsDate);
  if (!reaction) {
    return {
      label: "Post-earnings reaction history",
      limitedReason: "Limited: price history around the verified earnings date is insufficient.",
      status: "limited",
      value: "LIMITED",
    };
  }
  return {
    label: "Post-earnings reaction history",
    provider: textFrom(summary, ...PROVIDER_KEYS) ?? "stored scanner price history",
    sourceUrl: textFrom(summary, ...SOURCE_URL_KEYS) ?? "/history",
    status: "available",
    timestamp: earningsDate,
    value: reaction,
  };
}

function computePostEventReaction(points: SymbolChartPoint[], earningsDate: string): string | null {
  const eventTime = Date.parse(earningsDate);
  if (!Number.isFinite(eventTime) || points.length < 2) return null;
  const before = [...points].reverse().find((point) => Date.parse(point.time) <= eventTime);
  const after = points.find((point) => Date.parse(point.time) > eventTime);
  if (!before || !after || before.close === 0) return null;
  const change = ((after.close - before.close) / before.close) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}% from first available close after verified earnings date.`;
}

function sourceLinkedEvents(row: Record<string, unknown>, symbol: string): SymbolEventCard[] {
  const rawEvents = eventsFromValue(valueFrom(row, ["verified_event_recent_events", "recent_events", "events", "source_linked_events"]));
  const directHeadline = textFrom(row, "news_headline", "headline");
  if (directHeadline) rawEvents.push(row);
  return rawEvents
    .map((event) => sourceLinkedEvent(event, symbol))
    .filter((event): event is SymbolEventCard => event !== null)
    .slice(0, 4);
}

function eventsFromValue(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(record).filter((item): item is Record<string, unknown> => item !== null);
  if (typeof value === "string") {
    const parsed = parseJson(value);
    if (Array.isArray(parsed)) return parsed.map(record).filter((item): item is Record<string, unknown> => item !== null);
  }
  const single = record(value);
  return single ? [single] : [];
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sourceLinkedEvent(event: Record<string, unknown>, symbol: string): SymbolEventCard | null {
  const headline = textFrom(event, "headline", "title", "summary", "news_headline");
  const provider = textFrom(event, ...PROVIDER_KEYS);
  const sourceUrl = textFrom(event, ...SOURCE_URL_KEYS);
  const timestamp = textFrom(event, ...TIMESTAMP_KEYS);
  if (!headline || !provider || !sourceUrl || !timestamp) return null;
  return {
    affectedSymbols: affectedSymbols(event, symbol),
    freshness: textFrom(event, "freshness", "freshness_label", "providerStateLabel") ?? "source timestamp provided",
    headline,
    provider,
    sourceUrl,
    timestamp,
    uncertainty: textFrom(event, "uncertainty", "uncertainty_label", "confidence", "providerState") ?? "source-linked; no certainty implied",
  };
}

function affectedSymbols(event: Record<string, unknown>, fallback: string): string[] {
  const raw = event.affected_symbols ?? event.symbols ?? event.symbol;
  if (Array.isArray(raw)) {
    const symbols = raw.map(cleanSymbolForCard).filter(Boolean);
    return symbols.length ? symbols : [fallback].filter(Boolean);
  }
  const cleaned = cleanSymbolForCard(raw);
  return cleaned ? [cleaned] : [fallback].filter(Boolean);
}

function chartPointsFromHistory(history: SymbolDetail["history"] | undefined): SymbolChartPoint[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((row) => {
      const item = row as Record<string, ScannerScalar>;
      const time = cleanText(item.date ?? item.datetime ?? item.timestamp ?? item.timestamp_utc);
      const close = numeric(item.close ?? item.adj_close ?? item.adjclose ?? item.price);
      if (!time || close === null || !Number.isFinite(Date.parse(time))) return null;
      const open = numeric(item.open) ?? close;
      const high = numeric(item.high) ?? Math.max(open, close);
      const low = numeric(item.low) ?? Math.min(open, close);
      return { close, high, low, open, time };
    })
    .filter((point): point is SymbolChartPoint => point !== null)
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time))
    .slice(-240);
}

function buildActions(symbol: string): Array<{ href: string; label: string }> {
  const encoded = encodeURIComponent(symbol);
  return [
    { href: `/symbol/${encoded}`, label: "Open full symbol page" },
    { href: `/symbol/${encoded}#chart`, label: "Open full chart" },
    { href: `/history?symbol=${encoded}`, label: "Open history" },
    { href: "/performance#history", label: "Open performance" },
    { href: `/discover?compare=${encoded}`, label: "Compare" },
    { href: `/alerts?symbol=${encoded}&source=symbol-card`, label: "Create alert" },
  ];
}
