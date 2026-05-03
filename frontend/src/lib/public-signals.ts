import type { ActiveAlertMatchesResponse } from "@/lib/active-alert-matches";
import type { CsvRow, RankingRow, SymbolDetail, SymbolHistoryRow } from "@/lib/types";

export type PublicMarketSummary = {
  filesAvailable: number;
  lastUpdated: string | null;
  locked: true;
  message: string;
  premiumDataHidden: true;
  scannerStatus: string;
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
  row: null;
  summary: null;
};

export type PublicSignalHistoryRow = {
  limited: true;
};

export type PublicAlertMatch = {
  limited: true;
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
  void row;
  return lockedPublicSignal();
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
  void rows;
  const preview = Array.from({ length: Math.max(0, Math.min(limit, 3)) }, lockedPublicSignal);
  assertNoPremiumFields(preview);
  return preview;
}

export function previewSymbolDetail(detail: SymbolDetail): PublicSymbolDetail {
  void detail;
  const preview = {
    history: [],
    row: null,
    summary: null,
  };
  assertNoPremiumFields(preview);
  return preview;
}

export function previewSymbolHistoryRows(rows: SymbolHistoryRow[], limit = 5): PublicSignalHistoryRow[] {
  void rows;
  const preview = Array.from({ length: Math.max(0, Math.min(limit, 3)) }, () => ({ limited: true as const }));
  assertNoPremiumFields(preview);
  return preview;
}

export function previewCsvRows(_rows: CsvRow[], _limit = 25): CsvRow[] {
  return [];
}

export function previewAlertMatches(response: ActiveAlertMatchesResponse, limit = 5): PublicAlertMatchesResponse {
  void limit;
  const preview = {
    data_status: response.data_status,
    generated_at: response.generated_at,
    matches: response.matches.length
      ? [{
      limited: true as const,
    }]
      : [],
  };
  assertNoPremiumFields(preview);
  return preview;
}

export function previewAlertOverview(overview: { activeCount: number; lastSentAt: string | null; rules: Array<Record<string, unknown>> }): PublicAlertOverview {
  const rules = overview.rules.slice(0, 2).map((rule, index) => ({
    enabled: Boolean(rule.enabled),
    id: `alert_${index + 1}`,
    limited: true as const,
    scope: cleanText(rule.scope, "global"),
    type: "signal_alert",
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

export type PublicSignal = PublicMarketSummary;

export function lockedPublicSignal(): PublicMarketSummary {
  return {
    filesAvailable: 0,
    lastUpdated: null,
    locked: true,
    message: "Premium unlocks live scanner intelligence.",
    premiumDataHidden: true,
    scannerStatus: "locked",
  };
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
