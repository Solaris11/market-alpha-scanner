import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { actionFor } from "./format";
import { readAlertRules, readAlertState, type AlertRule, type AlertRuleState } from "./alerts";
import { getFullRanking, getScanDataHealth, getTopCandidates, scannerOutputDir } from "./scanner-data";
import type { RankingRow } from "./types";

export type ActiveAlertMatch = {
  rule_id: string;
  rule_type: string;
  scope: "global" | "watchlist" | "symbol";
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
  cooldown_minutes: number;
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

function displayEntryStatus(row: RankingRow) {
  const price = numeric(row.price);
  const [buyLow, buyHigh] = buyZone(row);
  const stop = stopLoss(row);
  if (price !== null && stop !== null) {
    if (price <= stop) return "STOP HIT";
    if ((price - stop) / price <= 0.03) return "STOP RISK";
  }
  if (price !== null && buyLow !== null && buyHigh !== null) {
    if (price >= buyLow && price <= buyHigh) return "BUY ZONE";
    if (price > buyHigh && price <= buyHigh * 1.02) return "NEAR ENTRY";
  }
  return tradeQualityEntryStatus(row);
}

function inOrNearBuyZone(row: RankingRow) {
  const price = numeric(row.price);
  const [buyLow, buyHigh] = buyZone(row);
  return price !== null && buyLow !== null && buyHigh !== null && (price >= buyLow && price <= buyHigh || (price > buyHigh && price <= buyHigh * 1.02));
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

function evaluateRuleMatch(rule: AlertRule, row: RankingRow, topSymbols: Set<string>, state: AlertRuleState | undefined) {
  if (!passesRuleGuards(rule, row)) return null;
  const price = numeric(row.price);
  const score = numeric(row.final_score);
  const threshold = numeric(rule.threshold);
  const type = rule.type;

  let matched = false;
  let reason = "";

  if (type === "price_above" && price !== null && threshold !== null) {
    matched = price >= threshold;
    reason = `Price ${formatNumber(price)} is above ${formatNumber(threshold)}`;
  } else if (type === "price_below" && price !== null && threshold !== null) {
    matched = price <= threshold;
    reason = `Price ${formatNumber(price)} is below ${formatNumber(threshold)}`;
  } else if (type === "buy_zone_hit" && price !== null) {
    const [low, high] = buyZone(row);
    matched = low !== null && high !== null && price >= low && price <= high;
    reason = `Price is inside buy zone ${formatRange(low, high)}`;
  } else if (type === "stop_loss_broken" && price !== null) {
    const stop = stopLoss(row);
    matched = stop !== null && price <= stop;
    reason = `Price ${formatNumber(price)} is at or below stop ${formatNumber(stop)}`;
  } else if (type === "take_profit_hit" && price !== null) {
    const [low, high] = takeProfitZone(row);
    const target = low ?? high;
    matched = target !== null && price >= target;
    reason = `Price ${formatNumber(price)} is at or above take profit ${formatNumber(target)}`;
  } else if (type === "score_above" && score !== null && threshold !== null) {
    matched = score >= threshold;
    reason = `Score ${formatNumber(score)} is above ${formatNumber(threshold)}`;
  } else if (type === "score_below" && score !== null && threshold !== null) {
    matched = score <= threshold;
    reason = `Score ${formatNumber(score)} is below ${formatNumber(threshold)}`;
  } else if (type === "score_changed_by" && score !== null) {
    const previous = numeric(state?.last_observed_value ?? state?.last_trigger_value);
    const minimum = threshold ?? 2;
    const change = previous === null ? null : score - previous;
    matched = change !== null && Math.abs(change) >= minimum;
    reason = change === null ? "No score baseline recorded" : `Score changed ${change > 0 ? "+" : ""}${formatNumber(change)}`;
  } else if (type === "rating_changed") {
    const current = cleanText(row.rating);
    const previous = cleanText(state?.last_observed_value ?? state?.last_trigger_value);
    matched = Boolean(current && previous && current !== previous);
    reason = previous ? `Rating changed ${previous} -> ${current}` : "No rating baseline recorded";
  } else if (type === "action_changed") {
    const current = actionFor(row);
    const previous = cleanText(state?.last_observed_value ?? state?.last_trigger_value);
    matched = Boolean(current && previous && current !== previous);
    reason = previous ? `Action changed ${previous} -> ${current}` : "No action baseline recorded";
  } else if (type === "new_top_candidate") {
    const current = topSymbols.has(row.symbol) ? "present" : "absent";
    const previous = cleanText(state?.last_observed_value ?? state?.last_trigger_value);
    matched = previous !== "present" && current === "present";
    reason = matched ? `${row.symbol} appeared in top candidates` : "No new top-candidate transition";
  } else if (type === "entry_ready") {
    const rating = cleanText(row.rating).toUpperCase();
    const action = normalizedAction(actionFor(row));
    matched = (rating === "TOP" || rating === "ACTIONABLE") && (action === "STRONG BUY" || action === "BUY") && (tradeQualityEntryStatus(row) === "GOOD ENTRY" || tradeQualityEntryStatus(row) === "WAIT PULLBACK") && inOrNearBuyZone(row);
    reason = "Entry-ready opportunity";
  }

  if (!matched || !entryFilterAllows(rule, row)) return null;
  return reason || `${type} matched`;
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

function rowsForRule(rule: AlertRule, rowsBySymbol: Map<string, RankingRow>, watchlist: Set<string>) {
  if (rule.scope === "symbol") {
    const row = rowsBySymbol.get(normalizeSymbol(rule.symbol));
    return row ? [row] : [];
  }
  if (rule.scope === "watchlist") {
    return Array.from(watchlist).map((symbol) => rowsBySymbol.get(symbol)).filter((row): row is RankingRow => Boolean(row));
  }
  return Array.from(rowsBySymbol.values());
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
  const rowsBySymbol = new Map(rows.map((row) => [row.symbol, row]));
  const topSymbols = new Set(topCandidates.map((row) => row.symbol));
  const nowMs = Date.now();
  const matches: ActiveAlertMatch[] = [];

  for (const rule of enabledRules) {
    for (const row of rowsForRule(rule, rowsBySymbol, watchlist)) {
      const ruleState = stateFor(rule.id, row.symbol, alertState.alerts);
      const reason = evaluateRuleMatch(rule, row, topSymbols, ruleState);
      if (!reason) continue;
      const [buyLow, buyHigh] = buyZone(row);
      const [takeLow, takeHigh] = takeProfitZone(row);
      matches.push({
        rule_id: rule.id,
        rule_type: rule.type,
        scope: rule.scope,
        symbol: row.symbol,
        company_name: companyFor(row),
        price: numeric(row.price),
        final_score: numeric(row.final_score),
        rating: cleanText(row.rating, "—"),
        action: actionFor(row),
        entry_status: displayEntryStatus(row),
        trade_quality: displayTradeQuality(row),
        setup_type: cleanText(row.setup_type, "—"),
        match_reason: reason,
        threshold: numeric(rule.threshold),
        buy_zone: formatRange(buyLow, buyHigh),
        stop_loss: stopLoss(row),
        take_profit: formatRange(takeLow, takeHigh, true),
        risk_reward: riskRewardLabel(row),
        channels: rule.channels,
        cooldown_minutes: rule.cooldown_minutes,
        last_sent: ruleState?.last_sent_at ?? null,
        cooldown_active: cooldownActive(rule, ruleState, nowMs),
      });
    }
  }

  matches.sort((left, right) => left.rule_type.localeCompare(right.rule_type) || left.symbol.localeCompare(right.symbol));
  return { generated_at: generatedAt, data_status: health.status, matches };
}
