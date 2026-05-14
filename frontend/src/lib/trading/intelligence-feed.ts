import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";
import { normalizeWatchlistSymbol } from "@/lib/watchlist-storage";

export const NOTIFICATION_CATEGORIES = [
  "watchlist_risk_escalation",
  "large_score_change",
  "shock_risk",
  "macro_regime_shift",
  "replay_relevant_event",
  "alert_threshold",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "email", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_FREQUENCIES = ["high_signal_only", "daily_digest", "off"] as const;
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export const NOTIFICATION_SYMBOL_SCOPES = ["all", "watchlist_and_favorites", "custom_symbols"] as const;
export type NotificationSymbolScope = (typeof NOTIFICATION_SYMBOL_SCOPES)[number];

export const INTELLIGENCE_FEED_TYPES = [
  "market_regime_changed",
  "watchlist_score_improved",
  "risk_pressure_increased",
  "shock_risk_detected",
  "replay_similarity_found",
  "opportunity_attention_queue",
  "symbol_moved_to_risk_review",
  "macro_pressure_changed",
  "alert_triggered",
] as const;

export type IntelligenceFeedType = (typeof INTELLIGENCE_FEED_TYPES)[number];
export type IntelligenceFeedSeverity = "critical" | "high" | "info" | "medium" | "positive" | "warning";

export type NotificationPreferences = {
  categories: NotificationCategory[];
  channels: NotificationChannel[];
  dailyLimit: number;
  frequency: NotificationFrequency;
  quietHoursEnd: string | null;
  quietHoursStart: string | null;
  symbolScope: NotificationSymbolScope;
  symbols: string[];
  updatedAt: string | null;
};

export type IntelligenceFeedItem = {
  actionHref: string;
  category: NotificationCategory;
  createdAt?: string | null;
  dataTimestamp: string;
  evidenceLabel: string;
  id?: string | null;
  itemType: IntelligenceFeedType;
  monitorNext: string;
  notifiedAt?: string | null;
  notificationEligible: boolean;
  readAt?: string | null;
  relatedSymbol: string | null;
  severity: IntelligenceFeedSeverity;
  sourceKey: string;
  summary: string;
  title: string;
  whyItMatters: string;
};

export type DailyBrief = {
  bullets: string[];
  dangerousSymbols: string[];
  generatedAt: string;
  headline: string;
  marketState: string | null;
  monitorList: string[];
  shockSymbols: string[];
  topWatchSymbols: string[];
  watchlistChanges: string[];
};

export type BuildIntelligenceFeedInput = {
  activeAlertMatches?: IntelligenceFeedAlertMatch[];
  generatedAt?: string;
  marketCondition?: string | null;
  rows: OpportunityViewModel[];
  scanUpdatedAt?: string | null;
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export type IntelligenceFeedAlertMatch = {
  cooldown_active: boolean;
  match_reason: string;
  notification_status: "Covered" | "Radar only";
  signal: string;
  symbol: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: [...NOTIFICATION_CATEGORIES],
  channels: ["in_app"],
  dailyLimit: 6,
  frequency: "high_signal_only",
  quietHoursEnd: null,
  quietHoursStart: null,
  symbolScope: "watchlist_and_favorites",
  symbols: [],
  updatedAt: null,
};

const CATEGORY_SET = new Set<NotificationCategory>(NOTIFICATION_CATEGORIES);
const CHANNEL_SET = new Set<NotificationChannel>(NOTIFICATION_CHANNELS);
const FREQUENCY_SET = new Set<NotificationFrequency>(NOTIFICATION_FREQUENCIES);
const SYMBOL_SCOPE_SET = new Set<NotificationSymbolScope>(NOTIFICATION_SYMBOL_SCOPES);

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const source = objectValue(value);
  const categories = normalizeEnumArray(source.categories, CATEGORY_SET, DEFAULT_NOTIFICATION_PREFERENCES.categories, NOTIFICATION_CATEGORIES.length);
  const channels = normalizeEnumArray(source.channels, CHANNEL_SET, DEFAULT_NOTIFICATION_PREFERENCES.channels, NOTIFICATION_CHANNELS.length);
  const dailyLimit = integerValue(source.dailyLimit ?? source.daily_limit, DEFAULT_NOTIFICATION_PREFERENCES.dailyLimit, 1, 24);
  return {
    categories,
    channels: channels.length ? channels : ["in_app"],
    dailyLimit,
    frequency: enumValue(source.frequency, FREQUENCY_SET, DEFAULT_NOTIFICATION_PREFERENCES.frequency),
    quietHoursEnd: timeValue(source.quietHoursEnd ?? source.quiet_hours_end),
    quietHoursStart: timeValue(source.quietHoursStart ?? source.quiet_hours_start),
    symbolScope: enumValue(source.symbolScope ?? source.symbol_scope, SYMBOL_SCOPE_SET, DEFAULT_NOTIFICATION_PREFERENCES.symbolScope),
    symbols: normalizeSymbols(source.symbols, 40),
    updatedAt: stringOrNull(source.updatedAt ?? source.updated_at ?? source.preferencesUpdatedAt ?? source.preferences_updated_at),
  };
}

export function buildDailyBrief(input: BuildIntelligenceFeedInput): DailyBrief {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const topWatch = topOpportunityRows(input.rows, 4).map((row) => row.symbol);
  const dangerous = dangerousRows(input.rows, 4).map((row) => row.symbol);
  const shock = shockRows(input.rows, 4).map((row) => row.symbol);
  const watchlistChanges = (input.workflowEvolution?.watchlistEvolution ?? []).slice(0, 4).map((item) => `${item.symbol}: ${item.title}`);
  const marketState = stringOrNull(input.marketCondition);
  const headline = marketState
    ? `Market state is ${humanizeLabel(marketState)}. Review what changed before forcing new risk.`
    : "Daily brief is using the latest scanner packet. Market state is limited in this snapshot.";

  const bullets = [
    topWatch.length ? `Top watch candidates: ${topWatch.join(", ")}.` : "No high-quality watch candidate is dominant yet.",
    dangerous.length ? `Risk review names: ${dangerous.join(", ")}.` : "No critical dangerous-now cluster is dominant.",
    shock.length ? `Shock watch: ${shock.join(", ")}.` : "No elevated shock cluster is leading this packet.",
    watchlistChanges.length ? "Watchlist changes are available below." : "Watchlist change history is still building.",
  ];

  return {
    bullets,
    dangerousSymbols: dangerous,
    generatedAt,
    headline,
    marketState,
    monitorList: monitorListFor(input.rows, input.workflowEvolution),
    shockSymbols: shock,
    topWatchSymbols: topWatch,
    watchlistChanges,
  };
}

export function buildIntelligenceFeedItems(input: BuildIntelligenceFeedInput): IntelligenceFeedItem[] {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const dataTimestamp = input.scanUpdatedAt ?? generatedAt;
  const watchlist = new Set((input.watchlistSymbols ?? []).map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const items = [
    marketFeedItem(input.marketCondition, dataTimestamp),
    ...workflowItems(input.workflowEvolution, dataTimestamp),
    ...alertItems(input.activeAlertMatches ?? [], dataTimestamp),
    ...topOpportunityRows(input.rows, 3).map((row) => opportunityItem(row, dataTimestamp)),
    ...dangerousRows(input.rows, 3).map((row) => riskItem(row, dataTimestamp, watchlist.has(row.symbol))),
    ...shockRows(input.rows, 3).map((row) => shockItem(row, dataTimestamp)),
    replayItem(input.workflowEvolution, dataTimestamp),
  ].filter((item): item is IntelligenceFeedItem => Boolean(item));

  return dedupeFeedItems(items)
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || timestampMs(right.dataTimestamp) - timestampMs(left.dataTimestamp) || left.title.localeCompare(right.title))
    .slice(0, 18);
}

export function shouldNotifyForFeedItem(
  item: IntelligenceFeedItem,
  preferences: NotificationPreferences,
  options: { now?: Date; trackedSymbols?: string[] } = {},
): { allowed: boolean; reason: string } {
  if (!item.notificationEligible) return { allowed: false, reason: "Item is feed-only." };
  if (preferences.frequency === "off") return { allowed: false, reason: "Notifications are off." };
  if (!preferences.categories.includes(item.category)) return { allowed: false, reason: "Category disabled." };
  if (!preferences.channels.includes("in_app")) return { allowed: false, reason: "In-app notifications disabled." };
  if (insideQuietHours(options.now ?? new Date(), preferences.quietHoursStart, preferences.quietHoursEnd)) {
    return { allowed: false, reason: "Quiet hours active." };
  }
  if (!symbolAllowed(item.relatedSymbol, preferences, options.trackedSymbols ?? [])) {
    return { allowed: false, reason: "Symbol outside notification scope." };
  }
  if (preferences.frequency === "daily_digest" && item.severity !== "critical") {
    return { allowed: false, reason: "Daily digest only allows critical immediate notifications." };
  }
  return { allowed: true, reason: "High-signal item is notification eligible." };
}

export function notificationCategoryLabel(category: NotificationCategory): string {
  const labels: Record<NotificationCategory, string> = {
    alert_threshold: "Alert threshold",
    large_score_change: "Large score change",
    macro_regime_shift: "Macro regime shift",
    replay_relevant_event: "Replay-relevant event",
    shock_risk: "Shock risk",
    watchlist_risk_escalation: "Watchlist risk escalation",
  };
  return labels[category];
}

export function notificationChannelLabel(channel: NotificationChannel): string {
  if (channel === "in_app") return "In-app";
  if (channel === "email") return "Email";
  return "Future push";
}

export function notificationFrequencyLabel(frequency: NotificationFrequency): string {
  if (frequency === "high_signal_only") return "High signal only";
  if (frequency === "daily_digest") return "Daily digest";
  return "Off";
}

function marketFeedItem(marketCondition: string | null | undefined, dataTimestamp: string): IntelligenceFeedItem {
  const label = stringOrNull(marketCondition) ?? "Limited";
  const risky = /overheated|risk|transition|fragile|weak|avoid/i.test(label);
  return {
    actionHref: "/terminal#market-state",
    category: "macro_regime_shift",
    dataTimestamp,
    evidenceLabel: `Market state: ${humanizeLabel(label)}`,
    itemType: "market_regime_changed",
    monitorNext: risky ? "Watch breadth, volatility, liquidity, and whether top setups keep confirming." : "Watch whether breadth and setup quality keep supporting the current state.",
    notificationEligible: risky,
    relatedSymbol: null,
    severity: risky ? "warning" : "info",
    sourceKey: `market:${stableKey(label)}:${dateBucket(dataTimestamp)}`,
    summary: risky ? "Market conditions require more patience before adding risk." : "Market conditions are available for the daily research brief.",
    title: `Market state: ${humanizeLabel(label)}`,
    whyItMatters: "The market state changes how aggressively TradeVeto treats opportunities, risk review, and watchlist signals.",
  };
}

function workflowItems(workflow: WorkflowEvolutionSummary | null | undefined, dataTimestamp: string): IntelligenceFeedItem[] {
  const changes = [...(workflow?.whatChanged ?? []), ...(workflow?.watchlistEvolution ?? [])].slice(0, 8);
  return changes.map((change) => workflowItem(change, dataTimestamp));
}

function workflowItem(change: WorkflowChangeItem, dataTimestamp: string): IntelligenceFeedItem {
  const itemType = workflowType(change);
  const category = categoryForWorkflow(change);
  const symbol = change.symbol === "WORKFLOW" ? null : cleanSymbol(change.symbol);
  const severity = change.severity === "warning" ? "warning" : change.severity === "positive" ? "positive" : "info";
  return {
    actionHref: symbol ? `/symbol/${encodeURIComponent(symbol)}` : "/history",
    category,
    dataTimestamp,
    evidenceLabel: change.metricLabel || humanizeLabel(change.changeType),
    itemType,
    monitorNext: symbol ? `Review ${symbol} for confirmation, invalidation, and whether the change persists in the next scan.` : "Use this as a baseline for future what-changed comparisons.",
    notificationEligible: severity === "warning" || category === "watchlist_risk_escalation" || category === "large_score_change",
    relatedSymbol: symbol,
    severity,
    sourceKey: `workflow:${change.changeType}:${symbol ?? "market"}:${stableKey(change.metricLabel)}:${dateBucket(dataTimestamp)}`,
    summary: humanizeInsightText(change.detail, change.title),
    title: change.title,
    whyItMatters: "This is derived from scan-to-scan workflow memory, so it highlights changed conditions instead of static scores.",
  };
}

function alertItems(matches: IntelligenceFeedAlertMatch[], dataTimestamp: string): IntelligenceFeedItem[] {
  return matches.slice(0, 5).map((match) => {
    const symbol = cleanSymbol(match.symbol);
    return {
      actionHref: symbol ? `/symbol/${encodeURIComponent(symbol)}` : "/alerts",
      category: "alert_threshold" as const,
      dataTimestamp,
      evidenceLabel: `${match.signal} · ${match.notification_status}`,
      itemType: "alert_triggered" as const,
      monitorNext: "Review the alert reason, current entry status, and whether the condition is still active.",
      notificationEligible: match.notification_status === "Covered" && !match.cooldown_active,
      relatedSymbol: symbol,
      severity: match.signal.includes("STOP") || match.signal.includes("RISK") ? "warning" as const : "medium" as const,
      sourceKey: `alert:${symbol ?? "unknown"}:${stableKey(match.signal)}:${dateBucket(dataTimestamp)}`,
      summary: humanizeInsightText(match.match_reason, "A configured alert condition matched this symbol."),
      title: symbol ? `${symbol} alert triggered` : "Alert triggered",
      whyItMatters: "Alert matches are based on user rules and current scanner state, not a generic dashboard recommendation.",
    };
  });
}

function opportunityItem(row: OpportunityViewModel, dataTimestamp: string): IntelligenceFeedItem {
  const score = rounded(row.final_score ?? row.conviction);
  return {
    actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
    category: "large_score_change",
    dataTimestamp,
    evidenceLabel: `Score ${score}/100 · ${row.confidenceLabel}`,
    itemType: "opportunity_attention_queue",
    monitorNext: row.entryZoneLabel ? `Watch entry zone ${row.entryZoneLabel}, confirmation, and invalidation.` : "Watch pullback quality, confirmation, and invalidation before treating it as actionable.",
    notificationEligible: score >= 68,
    relatedSymbol: row.symbol,
    severity: score >= 72 ? "positive" : "medium",
    sourceKey: `opportunity:${row.symbol}:${score}:${dateBucket(dataTimestamp)}`,
    summary: `${row.symbol} entered the attention queue with ${row.confidenceLabel.toLowerCase()} confidence and ${humanizeLabel(row.final_decision ?? "research")} status.`,
    title: `${row.symbol} entered attention queue`,
    whyItMatters: "The feed only surfaces opportunity context when score, conviction, and setup quality are high enough to review.",
  };
}

function riskItem(row: OpportunityViewModel, dataTimestamp: string, watchlisted: boolean): IntelligenceFeedItem {
  const riskScore = rounded(Math.max(row.fragility, row.eventRisk, row.shockPattern?.downsideRiskScore ?? 0));
  return {
    actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
    category: watchlisted ? "watchlist_risk_escalation" : "large_score_change",
    dataTimestamp,
    evidenceLabel: `${row.fragilityLabel} · Event risk ${rounded(row.eventRisk)}/100`,
    itemType: "risk_pressure_increased",
    monitorNext: "Review invalidation, chase risk, event pressure, and whether the setup remains worth monitoring.",
    notificationEligible: watchlisted || riskScore >= 78,
    relatedSymbol: row.symbol,
    severity: riskScore >= 82 ? "critical" : "warning",
    sourceKey: `risk:${row.symbol}:${riskScore}:${dateBucket(dataTimestamp)}`,
    summary: `${row.symbol} has elevated risk pressure from fragility, event risk, or downside shock context.`,
    title: `${row.symbol} risk pressure increased`,
    whyItMatters: "Risk escalation helps prevent stale watchlist conviction from turning into blind exposure.",
  };
}

function shockItem(row: OpportunityViewModel, dataTimestamp: string): IntelligenceFeedItem {
  const pattern = row.shockPattern;
  const shockScore = rounded(Math.max(pattern?.twoSidedVolatilityScore ?? 0, pattern?.currentSimilarityScore ?? 0, pattern?.opportunityScore ?? 0, row.eventRisk));
  return {
    actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
    category: "shock_risk",
    dataTimestamp,
    evidenceLabel: pattern ? `Shock ${shockScore}/100 · ${pattern.chaseRiskLabel}` : `Event risk ${shockScore}/100`,
    itemType: "shock_risk_detected",
    monitorNext: "Check liquidity, event pressure, failed-gap risk, and whether the move is already late.",
    notificationEligible: shockScore >= 72,
    relatedSymbol: row.symbol,
    severity: shockScore >= 82 ? "critical" : "warning",
    sourceKey: `shock:${row.symbol}:${shockScore}:${dateBucket(dataTimestamp)}`,
    summary: `${row.symbol} has elevated large-move or volatility context. Treat this as risk context first.`,
    title: `${row.symbol} shock risk detected`,
    whyItMatters: "Shock risk can create opportunity, but it also raises chase risk and false-positive risk.",
  };
}

function replayItem(workflow: WorkflowEvolutionSummary | null | undefined, dataTimestamp: string): IntelligenceFeedItem | null {
  if (!workflow?.lastSeenAt) return null;
  return {
    actionHref: "/history",
    category: "replay_relevant_event",
    dataTimestamp,
    evidenceLabel: `Last workflow baseline ${new Date(workflow.lastSeenAt).toLocaleDateString("en-US")}`,
    itemType: "replay_similarity_found",
    monitorNext: "Open History to compare the prior baseline with the current scan before relying on stale assumptions.",
    notificationEligible: false,
    relatedSymbol: null,
    severity: "info",
    sourceKey: `replay:baseline:${dateBucket(dataTimestamp)}`,
    summary: "A workflow baseline exists for replay-style comparison against the latest scan.",
    title: "Replay baseline ready",
    whyItMatters: "Replay context helps explain what changed since the previous workflow snapshot.",
  };
}

function topOpportunityRows(rows: OpportunityViewModel[], limit: number): OpportunityViewModel[] {
  return rows
    .filter((row) => (row.final_score ?? 0) >= 55 || row.conviction >= 55)
    .sort((left, right) => (right.final_score ?? right.conviction) - (left.final_score ?? left.conviction) || right.conviction - left.conviction || left.symbol.localeCompare(right.symbol))
    .slice(0, limit);
}

function dangerousRows(rows: OpportunityViewModel[], limit: number): OpportunityViewModel[] {
  return rows
    .filter((row) => row.fragility >= 68 || row.eventRisk >= 68 || String(row.final_decision ?? "").toUpperCase() === "AVOID")
    .sort((left, right) => Math.max(right.fragility, right.eventRisk) - Math.max(left.fragility, left.eventRisk) || left.symbol.localeCompare(right.symbol))
    .slice(0, limit);
}

function shockRows(rows: OpportunityViewModel[], limit: number): OpportunityViewModel[] {
  return rows
    .filter((row) => Math.max(row.shockPattern?.twoSidedVolatilityScore ?? 0, row.shockPattern?.currentSimilarityScore ?? 0, row.shockPattern?.opportunityScore ?? 0, row.eventRisk) >= 64)
    .sort((left, right) => shockSortScore(right) - shockSortScore(left) || left.symbol.localeCompare(right.symbol))
    .slice(0, limit);
}

function shockSortScore(row: OpportunityViewModel): number {
  return Math.max(row.shockPattern?.twoSidedVolatilityScore ?? 0, row.shockPattern?.currentSimilarityScore ?? 0, row.shockPattern?.opportunityScore ?? 0, row.eventRisk);
}

function monitorListFor(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null | undefined): string[] {
  const fromWorkflow = (workflow?.triggerMonitors ?? []).slice(0, 3).map((item) => `${item.symbol}: ${item.condition}`);
  if (fromWorkflow.length) return fromWorkflow;
  return topOpportunityRows(rows, 3).map((row) => `${row.symbol}: ${row.entryZoneLabel ?? "watch confirmation"}`);
}

function workflowType(change: WorkflowChangeItem): IntelligenceFeedType {
  if (change.changeType === "fragility_rising") return "risk_pressure_increased";
  if (change.changeType === "macro_shift") return "macro_pressure_changed";
  if (change.changeType === "shock_aligning") return "shock_risk_detected";
  if (change.changeType === "watchlist_momentum") return "watchlist_score_improved";
  if (change.changeType === "improving" || change.changeType === "trigger_approaching") return "opportunity_attention_queue";
  return "replay_similarity_found";
}

function categoryForWorkflow(change: WorkflowChangeItem): NotificationCategory {
  if (change.changeType === "fragility_rising") return "watchlist_risk_escalation";
  if (change.changeType === "macro_shift") return "macro_regime_shift";
  if (change.changeType === "shock_aligning") return "shock_risk";
  if (change.changeType === "watchlist_momentum") return "watchlist_risk_escalation";
  if (change.changeType === "improving" || change.changeType === "trigger_approaching") return "large_score_change";
  return "replay_relevant_event";
}

function dedupeFeedItems(items: IntelligenceFeedItem[]): IntelligenceFeedItem[] {
  const seen = new Set<string>();
  const output: IntelligenceFeedItem[] = [];
  for (const item of items) {
    if (seen.has(item.sourceKey)) continue;
    seen.add(item.sourceKey);
    output.push(item);
  }
  return output;
}

function symbolAllowed(symbol: string | null, preferences: NotificationPreferences, trackedSymbols: string[]): boolean {
  if (!symbol || preferences.symbolScope === "all") return true;
  const normalized = cleanSymbol(symbol);
  if (!normalized) return false;
  if (preferences.symbolScope === "custom_symbols") return preferences.symbols.includes(normalized);
  const tracked = new Set([...preferences.symbols, ...trackedSymbols].map(cleanSymbol).filter((item): item is string => Boolean(item)));
  return tracked.size === 0 || tracked.has(normalized);
}

function insideQuietHours(now: Date, start: string | null, end: string | null): boolean {
  const startMinutes = minutesFromTime(start);
  const endMinutes = minutesFromTime(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (startMinutes < endMinutes) return current >= startMinutes && current < endMinutes;
  return current >= startMinutes || current < endMinutes;
}

function minutesFromTime(value: string | null): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number.parseInt(match[1] ?? "0", 10) * 60 + Number.parseInt(match[2] ?? "0", 10);
}

function normalizeEnumArray<T extends string>(value: unknown, allowed: Set<T>, fallback: readonly T[], limit: number): T[] {
  const raw = Array.isArray(value) ? value : fallback;
  const output: T[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !allowed.has(item as T)) continue;
    const normalized = item as T;
    if (!output.includes(normalized)) output.push(normalized);
    if (output.length >= limit) break;
  }
  return output.length ? output : [...fallback];
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  if (typeof value !== "string") return fallback;
  return allowed.has(value as T) ? value as T : fallback;
}

function normalizeSymbols(value: unknown, limit: number): string[] {
  const raw = Array.isArray(value) ? value : [];
  const output: string[] = [];
  for (const item of raw) {
    const symbol = cleanSymbol(item);
    if (symbol && !output.includes(symbol)) output.push(symbol);
    if (output.length >= limit) break;
  }
  return output;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringOrNull(value: unknown): string | null {
  const text = cleanText(value, "");
  return text ? text : null;
}

function timeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim()) ? value.trim() : null;
}

function integerValue(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : finiteNumber(value);
  if (parsed === null) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function cleanSymbol(value: unknown): string | null {
  const symbol = normalizeWatchlistSymbol(String(value ?? ""));
  return symbol || null;
}

function stableKey(value: unknown): string {
  return String(value ?? "none").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "none";
}

function dateBucket(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function timestampMs(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function rounded(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityRank(severity: IntelligenceFeedSeverity): number {
  if (severity === "critical") return 6;
  if (severity === "high") return 5;
  if (severity === "warning") return 4;
  if (severity === "positive") return 3;
  if (severity === "medium") return 2;
  return 1;
}
