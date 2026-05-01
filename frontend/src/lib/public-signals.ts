import type { ActiveAlertMatchesResponse } from "@/lib/active-alert-matches";
import type { CsvRow, RankingRow, SymbolDetail, SymbolHistoryRow } from "@/lib/types";

export type PublicSignal = {
  asset_type?: string;
  company_name?: string;
  data_status?: string;
  last_updated?: string | null;
  market_regime?: string;
  price?: number | null;
  rating: string;
  score_bucket: string;
  sector?: string;
  symbol: string;
};

export type PremiumSignal = {
  buy_zone: number[];
  final_score: number | null;
  final_score_adjusted: number | null;
  risk_reward: number | null;
  stop_loss: number | null;
  symbol: string;
  take_profit_zone: number[];
};

export type PublicSymbolDetail = {
  history: PublicSignalHistoryRow[];
  row: PublicSignal | null;
  summary: null;
};

export type PublicSignalHistoryRow = {
  company_name?: string;
  data_status?: string;
  rating: string;
  score_bucket: string;
  symbol: string;
  timestamp_utc?: string;
};

export type PublicAlertMatch = {
  limited: true;
  signal: string;
  symbol: string;
};

export type PublicAlertMatchesResponse = {
  data_status: ActiveAlertMatchesResponse["data_status"];
  generated_at: string;
  matches: PublicAlertMatch[];
};

export type PublicAlertRule = {
  enabled: boolean;
  id: string;
  limited: true;
  scope: string;
  symbol?: string;
  type: string;
};

export type PublicAlertOverview = {
  activeCount: number;
  lastSentAt: null;
  rules: PublicAlertRule[];
  state: { alerts: Record<string, never> };
};

const PREMIUM_FIELD_NAMES = new Set([
  "aggressive_risk_reward_high",
  "aggressive_risk_reward_low",
  "balanced_risk_reward_high",
  "balanced_risk_reward_low",
  "buy_zone",
  "buy_zone_high",
  "buy_zone_low",
  "conservative_risk_reward",
  "conservative_target",
  "entry_price",
  "entry_zone",
  "entry_zone_high",
  "entry_zone_low",
  "exit_price",
  "final_score",
  "final_score_adjusted",
  "forward_return",
  "max_drawdown_after_signal",
  "max_gain_after_signal",
  "price_at_signal",
  "risk_reward",
  "risk_reward_high",
  "risk_reward_low",
  "signal_price",
  "stop_loss",
  "suggested_entry",
  "take_profit",
  "take_profit_high",
  "take_profit_low",
  "take_profit_zone",
  "target_price",
]);

export function toPublicSignal(row: RankingRow): PublicSignal {
  return {
    asset_type: cleanOptional(row.asset_type),
    company_name: cleanOptional(row.company_name),
    data_status: cleanOptional(row.recommendation_quality),
    last_updated: timestampValue(row.last_updated ?? row.last_updated_utc),
    market_regime: cleanOptional(row.market_regime),
    price: numberValue(row.price),
    rating: cleanText(row.rating, "REVIEW"),
    score_bucket: scoreBucket(row.final_score),
    sector: cleanOptional(row.sector),
    symbol: cleanText(row.symbol, "").toUpperCase(),
  };
}

export function toPremiumSignal(row: RankingRow): PremiumSignal {
  return {
    buy_zone: numericRange(row.buy_zone_low, row.buy_zone_high, row.buy_zone),
    final_score: numberValue(row.final_score),
    final_score_adjusted: numberValue(row.final_score_adjusted),
    risk_reward: numberValue(row.risk_reward),
    stop_loss: numberValue(row.stop_loss),
    symbol: cleanText(row.symbol, "").toUpperCase(),
    take_profit_zone: numericRange(row.take_profit_low, row.take_profit_high, row.take_profit_zone ?? row.take_profit ?? row.conservative_target),
  };
}

export function previewRankingRows(rows: RankingRow[], limit = 3): PublicSignal[] {
  const preview = rows.slice(0, limit).map(toPublicSignal);
  assertNoPremiumFields(preview);
  return preview;
}

export function previewSymbolDetail(detail: SymbolDetail): PublicSymbolDetail {
  const preview = {
    history: [],
    row: detail.row ? toPublicSignal(detail.row) : null,
    summary: null,
  };
  assertNoPremiumFields(preview);
  return preview;
}

export function previewSymbolHistoryRows(rows: SymbolHistoryRow[], limit = 5): PublicSignalHistoryRow[] {
  const preview = rows.slice(-limit).map((row) => ({
    company_name: cleanOptional(row.company_name),
    data_status: cleanOptional(row.recommendation_quality),
    rating: cleanText(row.rating, "REVIEW"),
    score_bucket: scoreBucket(row.final_score),
    symbol: cleanText(row.symbol, "").toUpperCase(),
    timestamp_utc: cleanOptional(row.timestamp_utc),
  }));
  assertNoPremiumFields(preview);
  return preview;
}

export function previewCsvRows(_rows: CsvRow[], _limit = 25): CsvRow[] {
  return [];
}

export function previewAlertMatches(response: ActiveAlertMatchesResponse, limit = 5): PublicAlertMatchesResponse {
  const preview = {
    data_status: response.data_status,
    generated_at: response.generated_at,
    matches: response.matches.slice(0, limit).map((match) => ({
      limited: true as const,
      signal: cleanText(match.signal, "REVIEW"),
      symbol: cleanText(match.symbol, "").toUpperCase(),
    })),
  };
  assertNoPremiumFields(preview);
  return preview;
}

export function previewAlertOverview(overview: { activeCount: number; lastSentAt: string | null; rules: Array<Record<string, unknown>> }): PublicAlertOverview {
  const rules = overview.rules.slice(0, 2).map((rule) => ({
    enabled: Boolean(rule.enabled),
    id: cleanText(rule.id, "alert"),
    limited: true as const,
    scope: cleanText(rule.scope, "global"),
    symbol: cleanOptional(rule.symbol),
    type: cleanText(rule.type, "alert"),
  }));
  const preview = {
    activeCount: rules.filter((rule) => rule.enabled).length,
    lastSentAt: null,
    rules,
    state: { alerts: {} },
  };
  assertNoPremiumFields(preview);
  return preview;
}

export function containsPremiumFields(data: unknown): boolean {
  return findPremiumField(data) !== null;
}

export function assertNoPremiumFields(data: unknown): void {
  const field = findPremiumField(data);
  if (field) {
    throw new Error(`SECURITY: premium data leak (${field})`);
  }
}

function findPremiumField(data: unknown, seen = new WeakSet<object>()): string | null {
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") return null;
  if (seen.has(data)) return null;
  seen.add(data);

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findPremiumField(item, seen);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isPremiumFieldName(key)) return key;
    const found = findPremiumField(value, seen);
    if (found) return found;
  }
  return null;
}

function isPremiumFieldName(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return PREMIUM_FIELD_NAMES.has(normalized) || normalized.includes("risk_reward") || normalized.startsWith("take_profit") || normalized.startsWith("buy_zone");
}

function cleanText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return fallback;
  return text;
}

function cleanOptional(value: unknown): string | undefined {
  const text = cleanText(value, "");
  return text || undefined;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreBucket(value: unknown): string {
  const score = numberValue(value);
  if (score === null) return "unscored";
  if (score >= 80) return "elite";
  if (score >= 70) return "strong";
  if (score >= 60) return "watch";
  if (score >= 50) return "developing";
  return "low";
}

function timestampValue(value: unknown): string | null {
  const text = cleanText(value, "");
  return text || null;
}

function numericRange(low: unknown, high: unknown, fallback: unknown): number[] {
  const lowValue = numberValue(low);
  const highValue = numberValue(high);
  if (lowValue !== null && highValue !== null) return [Math.min(lowValue, highValue), Math.max(lowValue, highValue)];
  const values = Array.from(String(fallback ?? "").replace(/,/g, "").matchAll(/-?\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
  if (values.length >= 2) return [Math.min(values[0], values[1]), Math.max(values[0], values[1])];
  if (values.length === 1) return [values[0]];
  return [];
}
