import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { actionFor } from "./format";
import { readAlertRules, readAlertState, type AlertRule, type AlertRuleState } from "./alerts";
import { getFullRanking, getScanDataHealth, getTopCandidates, scannerOutputDir } from "./scanner-data";
import type { RankingRow } from "./types";

export type ActiveAlertMatch = {
  rule_id: string | null;
  rule_type: string;
  signal: string;
  notification_status: "Covered" | "Radar only";
  scope: "global" | "watchlist" | "symbol" | "radar";
  symbol: string;
  company_name: string;
  price: number | null;
  final_score: number | null;
  rating: string;
  action: string;
  entry_status: string;
  trade_quality: string;
  setup_type: string;
  match_reason: string;
  threshold: number | null;
  buy_zone: string;
  stop_loss: number | null;
  take_profit: string;
  risk_reward: string;
  channels: string[];
  cooldown_minutes: number | null;
  last_sent: string | null;
  cooldown_active: boolean;
};

export type ActiveAlertMatchesResponse = {
  generated_at: string;
  data_status: "fresh" | "stale" | "missing" | "schema_mismatch";
  matches: ActiveAlertMatch[];
};

const RATING_RANK: Record<string, number> = {
  PASS: 0,
  WATCH: 1,
  ACTIONABLE: 2,
  TOP: 3,
};

function normalizeSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text && !["nan", "none", "null", "n/a"].includes(text.toLowerCase()) ? text : fallback;
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedAction(value: unknown) {
  return cleanText(value).toUpperCase().replace(/\s+/g, " ");
}

function extractNumbers(value: unknown) {
  return Array.from(String(value ?? "").replace(/,/g, "").replace(/[–—]/g, "-").matchAll(/(?<!\d)-?\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
}

function rangeFrom(row: RankingRow, lowKey: string, highKey: string, textKeys: string[]) {
  const low = numeric(row[lowKey]);
  const high = numeric(row[highKey]);
  if (low !== null && high !== null) return [Math.min(low, high), Math.max(low, high)] as const;
  for (const key of textKeys) {
    const numbers = extractNumbers(row[key]);
    if (numbers.length >= 2) return [Math.min(numbers[0], numbers[1]), Math.max(numbers[0], numbers[1])] as const;
    if (numbers.length === 1) return [numbers[0], numbers[0]] as const;
  }
  if (low !== null || high !== null) {
    const value = low ?? high;
    return [value, value] as const;
  }
  return [null, null] as const;
}

function buyZone(row: RankingRow) {
  return rangeFrom(row, "buy_zone_low", "buy_zone_high", ["buy_zone", "entry_zone"]);
}

function takeProfitZone(row: RankingRow) {
  return rangeFrom(row, "take_profit_low", "take_profit_high", ["take_profit_zone", "take_profit", "target", "upside_target", "conservative_target"]);
}

function stopLoss(row: RankingRow) {
  return numeric(row.stop_loss) ?? numeric(row.invalidation_level);
}

function formatNumber(value: unknown, digits = 2) {
  const parsed = numeric(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatRange(low: number | null, high: number | null, collapseEqual = false) {
  if (low === null && high === null) return "N/A";
  const values = [low, high].filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
  if (!values.length) return "N/A";
  if (values.length === 1 || (collapseEqual && Math.abs(values[0] - values[values.length - 1]) < 0.005)) return formatNumber(values[0]);
  return `${formatNumber(values[0])}-${formatNumber(values[values.length - 1])}`;
}

function companyFor(row: RankingRow) {
  return cleanText(row.company_name || row.long_name || row.short_name || row.display_name || row.security_name || row.name, "—");
}

function displayTradeQuality(row: RankingRow) {
  return cleanText(row.trade_quality || row.trade_quality_note, "REVIEW");
}

function tradeQualityEntryStatus(row: RankingRow) {
  const text = `${cleanText(row.trade_quality)} ${cleanText(row.trade_quality_note)} ${cleanText(row.target_warning)}`.toUpperCase();
  if (text.includes("LOW EDGE") || text.includes("EXTENDED")) return "OVEREXTENDED";
  if (text.includes("GOOD")) return "GOOD ENTRY";
  if (text.includes("ACCEPTABLE")) return "WAIT PULLBACK";
  return "REVIEW";
}

function displayEntryStatus(row: RankingRow, signal?: string) {
  if (signal === "STOP HIT" || signal === "STOP RISK" || signal === "BUY ZONE" || signal === "NEAR ENTRY") return signal;
  return tradeQualityEntryStatus(row);
}

function ratingMeetsMin(row: RankingRow, minimum?: string) {
  const min = cleanText(minimum).toUpperCase();
  if (!min) return true;
  const rating = cleanText(row.rating).toUpperCase();
  if (min === "TOP") return rating === "TOP";
  const ratingRank = RATING_RANK[rating];
  const minRank = RATING_RANK[min];
  return ratingRank !== undefined && minRank !== undefined && ratingRank >= minRank;
}

function allowedActions(rule: AlertRule) {
  return new Set((rule.allowed_actions ?? []).map(normalizedAction).filter(Boolean));
}

function riskRewardValue(row: RankingRow) {
  const values = [
    numeric(row.conservative_risk_reward),
    numeric(row.risk_reward),
    numeric(row.risk_reward_low),
    numeric(row.balanced_risk_reward_low),
  ].filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

function averageRiskReward(row: RankingRow, lowKey: string, highKey: string) {
  const low = numeric(row[lowKey]);
  const high = numeric(row[highKey]);
  if (low !== null && high !== null) return (low + high) / 2;
  return low ?? high;
}

function riskRewardLabel(row: RankingRow) {
  const conservative = numeric(row.conservative_risk_reward);
  const balanced = averageRiskReward(row, "balanced_risk_reward_low", "balanced_risk_reward_high");
  const aggressive = averageRiskReward(row, "aggressive_risk_reward_low", "aggressive_risk_reward_high");
  if (conservative !== null || balanced !== null || aggressive !== null) {
    return `${conservative !== null ? `${conservative.toFixed(1)}R` : "N/A"} / ${balanced !== null ? `${balanced.toFixed(1)}R` : "N/A"} / ${aggressive !== null ? `${aggressive.toFixed(1)}R` : "N/A"}`;
  }
  return cleanText(row.target_risk_reward_label || row.risk_reward_label, "N/A");
}

function entryFilterAllows(rule: AlertRule, row: RankingRow) {
  const filter = rule.entry_filter ?? (rule.type === "score_above" ? "avoid_overextended" : rule.type === "entry_ready" ? "good_or_wait" : "any");
  const status = tradeQualityEntryStatus(row);
  if (filter === "any") return true;
  if (filter === "good_only") return status === "GOOD ENTRY";
  if (filter === "good_or_wait") return status === "GOOD ENTRY" || status === "WAIT PULLBACK";
  if (filter === "avoid_overextended") return status !== "OVEREXTENDED";
  return true;
}

function passesRuleGuards(rule: AlertRule, row: RankingRow) {
  const score = numeric(row.final_score);
  const minScore = rule.min_score ?? (rule.type === "entry_ready" && rule.scope === "global" ? 70 : undefined);
  if (minScore !== undefined && (score === null || score < minScore)) return false;
  if (!ratingMeetsMin(row, rule.min_rating)) return false;
  const actions = allowedActions(rule);
  if (actions.size && !actions.has(normalizedAction(actionFor(row)))) return false;
  if (rule.min_risk_reward !== undefined) {
    const rr = riskRewardValue(row);
    if (rr === null || rr < rule.min_risk_reward) return false;
  }
  return true;
}

function matchesRuleType(rule: AlertRule, row: RankingRow, signal: string, topSymbols: Set<string>, state: AlertRuleState | undefined) {
  if (!passesRuleGuards(rule, row)) return false;
  const price = numeric(row.price);
  const score = numeric(row.final_score);
  const threshold = numeric(rule.threshold);
  const type = rule.type;

  if (type === "buy_zone_hit") return signal === "BUY ZONE";
  if (type === "stop_loss_broken") return signal === "STOP HIT";
  if (type === "take_profit_hit") return signal === "TP HIT";
  if (type === "score_above") return score !== null && threshold !== null && score >= threshold;
  if (type === "score_below") return score !== null && threshold !== null && score <= threshold;
  if (type === "price_above") return price !== null && threshold !== null && price >= threshold;
  if (type === "price_below") return price !== null && threshold !== null && price <= threshold;
  if (type === "entry_ready") {
    const rating = cleanText(row.rating).toUpperCase();
    const action = normalizedAction(actionFor(row));
    return (signal === "BUY ZONE" || signal === "NEAR ENTRY") && (rating === "TOP" || rating === "ACTIONABLE") && (action === "STRONG BUY" || action === "BUY");
  }
  if (type === "new_top_candidate") {
    const previous = cleanText(state?.last_observed_value ?? state?.last_trigger_value);
    return topSymbols.has(normalizeSymbol(row.symbol)) && previous !== "present";
  }
  if (type === "rating_changed") {
    const current = cleanText(row.rating);
    const previous = cleanText(state?.last_observed_value ?? state?.last_trigger_value);
    return Boolean(current && previous && current !== previous);
  }
  if (type === "action_changed") {
    const current = cleanText(actionFor(row));
    const previous = cleanText(state?.last_observed_value ?? state?.last_trigger_value);
    return Boolean(current && previous && current !== previous);
  }
  if (type === "score_changed_by") {
    const previous = numeric(state?.last_observed_value ?? state?.last_trigger_value);
    const minimum = threshold ?? 2;
    return score !== null && previous !== null && Math.abs(score - previous) >= minimum;
  }
  return false;
}

async function readWatchlistSymbols() {
  try {
    const payload = JSON.parse(await fs.readFile(path.join(scannerOutputDir(), "watchlist.json"), "utf8")) as unknown;
    const rawSymbols = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { symbols?: unknown[] }).symbols) ? (payload as { symbols: unknown[] }).symbols : [];
    return new Set(rawSymbols.map(normalizeSymbol).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function stateFor(ruleId: string, symbol: string, alerts: Record<string, AlertRuleState>) {
  return alerts[`${ruleId}:${symbol}`] ?? alerts[ruleId];
}

function cooldownActive(rule: AlertRule, state: AlertRuleState | undefined, nowMs: number) {
  if (!state?.last_sent_at) return false;
  const lastSentMs = Date.parse(state.last_sent_at);
  if (!Number.isFinite(lastSentMs)) return false;
  return nowMs - lastSentMs < rule.cooldown_minutes * 60_000;
}

function ruleCoversSymbol(rule: AlertRule, row: RankingRow, watchlist: Set<string>) {
  const symbol = normalizeSymbol(row.symbol);
  if (rule.scope === "symbol") return normalizeSymbol(rule.symbol) === symbol;
  if (rule.scope === "watchlist") return watchlist.has(symbol);
  return true;
}

function coverageFor(row: RankingRow, signal: string, rules: AlertRule[], topSymbols: Set<string>, watchlist: Set<string>, state: Record<string, AlertRuleState>, nowMs: number) {
  const symbol = normalizeSymbol(row.symbol);
  for (const rule of rules) {
    if (!ruleCoversSymbol(rule, row, watchlist)) continue;
    const ruleState = stateFor(rule.id, symbol, state);
    if (!matchesRuleType(rule, row, signal, topSymbols, ruleState)) continue;
    if (!entryFilterAllows(rule, row)) continue;
    return {
      rule,
      state: ruleState,
      cooldownActive: cooldownActive(rule, ruleState, nowMs),
    };
  }
  return null;
}

function radarSignals(row: RankingRow) {
  const signals: { signal: string; reason: string }[] = [];
  const price = numeric(row.price);
  const [buyLow, buyHigh] = buyZone(row);
  const stop = stopLoss(row);
  const [takeLow, takeHigh] = takeProfitZone(row);
  const target = takeLow ?? takeHigh;
  const rating = cleanText(row.rating).toUpperCase();
  const action = normalizedAction(actionFor(row));

  if (price !== null && buyLow !== null && buyHigh !== null) {
    if (price >= buyLow && price <= buyHigh) signals.push({ signal: "BUY ZONE", reason: `Price is inside buy zone ${formatRange(buyLow, buyHigh)}` });
    else if (price > buyHigh && price <= buyHigh * 1.02) signals.push({ signal: "NEAR ENTRY", reason: `Price is within 2% above buy zone ${formatRange(buyLow, buyHigh)}` });
  }
  if (price !== null && stop !== null) {
    if (price <= stop) signals.push({ signal: "STOP HIT", reason: `Price ${formatNumber(price)} is at or below stop ${formatNumber(stop)}` });
    else if ((price - stop) / price <= 0.03) signals.push({ signal: "STOP RISK", reason: `Price is within 3% of stop ${formatNumber(stop)}` });
  }
  if (price !== null && target !== null) {
    if (price >= target) signals.push({ signal: "TP HIT", reason: `Price ${formatNumber(price)} is at or above take profit ${formatNumber(target)}` });
    else if ((target - price) / target <= 0.03) signals.push({ signal: "TP NEAR", reason: `Price is within 3% of take profit ${formatNumber(target)}` });
  }
  if (rating === "TOP") signals.push({ signal: "TOP", reason: "Rating is TOP" });
  if (rating === "ACTIONABLE") signals.push({ signal: "ACTIONABLE", reason: "Rating is ACTIONABLE" });
  if (action === "STRONG BUY") signals.push({ signal: "STRONG BUY", reason: "Action is STRONG BUY" });
  if (action === "BUY") signals.push({ signal: "BUY", reason: "Action is BUY" });

  return signals;
}

export async function getActiveAlertMatches(): Promise<ActiveAlertMatchesResponse> {
  const generatedAt = new Date().toISOString();
  const health = await getScanDataHealth();
  if (health.status === "missing" || health.status === "schema_mismatch") {
    return { generated_at: generatedAt, data_status: health.status, matches: [] };
  }

  const [rows, topCandidates, rules, alertState, watchlist] = await Promise.all([
    getFullRanking(),
    getTopCandidates(),
    readAlertRules({ createDefault: false }),
    readAlertState(),
    readWatchlistSymbols(),
  ]);
  const enabledRules = rules.filter((rule) => rule.enabled);
  const topSymbols = new Set(topCandidates.map((row) => normalizeSymbol(row.symbol)));
  const nowMs = Date.now();
  const matches: ActiveAlertMatch[] = [];

  for (const row of rows) {
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol) continue;
    const [buyLow, buyHigh] = buyZone(row);
    const [takeLow, takeHigh] = takeProfitZone(row);
    for (const radar of radarSignals(row)) {
      const coverage = coverageFor(row, radar.signal, enabledRules, topSymbols, watchlist, alertState.alerts, nowMs);
      matches.push({
        rule_id: coverage?.rule.id ?? null,
        rule_type: radar.signal,
        signal: radar.signal,
        notification_status: coverage ? "Covered" : "Radar only",
        scope: coverage?.rule.scope ?? "radar",
        symbol,
        company_name: companyFor(row),
        price: numeric(row.price),
        final_score: numeric(row.final_score),
        rating: cleanText(row.rating, "—"),
        action: actionFor(row),
        entry_status: displayEntryStatus(row, radar.signal),
        trade_quality: displayTradeQuality(row),
        setup_type: cleanText(row.setup_type, "—"),
        match_reason: radar.reason,
        threshold: coverage ? numeric(coverage.rule.threshold) : null,
        buy_zone: formatRange(buyLow, buyHigh),
        stop_loss: stopLoss(row),
        take_profit: formatRange(takeLow, takeHigh, true),
        risk_reward: riskRewardLabel(row),
        channels: coverage?.rule.channels ?? [],
        cooldown_minutes: coverage?.rule.cooldown_minutes ?? null,
        last_sent: coverage?.state?.last_sent_at ?? null,
        cooldown_active: coverage?.cooldownActive ?? false,
      });
    }
  }

  matches.sort((left, right) => left.signal.localeCompare(right.signal) || left.symbol.localeCompare(right.symbol));
  return { generated_at: generatedAt, data_status: health.status, matches };
}
