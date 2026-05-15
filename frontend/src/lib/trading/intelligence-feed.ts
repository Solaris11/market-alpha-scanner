import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";
import { normalizeWatchlistSymbol } from "@/lib/watchlist-storage";

export const NOTIFICATION_CATEGORIES = [
  "watchlist_risk_escalation",
  "large_score_change",
  "confidence_change",
  "freshness_decay",
  "shock_risk",
  "macro_regime_shift",
  "volatility_spike",
  "breadth_deterioration",
  "sector_pressure_change",
  "contradiction_detected",
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
  "score_improved",
  "score_deteriorated",
  "confidence_changed",
  "freshness_decayed",
  "watchlist_score_improved",
  "risk_pressure_increased",
  "volatility_spiked",
  "breadth_deteriorated",
  "sector_pressure_changed",
  "shock_risk_detected",
  "replay_similarity_found",
  "opportunity_attention_queue",
  "symbol_moved_to_risk_review",
  "macro_pressure_changed",
  "alert_triggered",
  "stale_setup_detected",
  "contradiction_detected",
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

export type DailyBriefSectionKey =
  | "market_state"
  | "macro_pressure"
  | "risk_environment"
  | "watchlist_changes"
  | "best_setups"
  | "dangerous_names"
  | "stale_setups"
  | "replay_similarities"
  | "shock_watch"
  | "what_changed"
  | "what_to_monitor";

export type DailyBriefSection = {
  actionHref: string;
  details: string[];
  key: DailyBriefSectionKey;
  severity: IntelligenceFeedSeverity;
  status: string;
  summary: string;
  symbols: string[];
  title: string;
};

export type DailyBrief = {
  bullets: string[];
  dangerousSymbols: string[];
  generatedAt: string;
  headline: string;
  macroPressure: string;
  marketState: string | null;
  monitorList: string[];
  replaySimilaritySymbols: string[];
  riskEnvironment: string;
  sections: DailyBriefSection[];
  shockSymbols: string[];
  sinceLastVisit: string[];
  staleSymbols: string[];
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
  const topWatchRowsForBrief = topOpportunityRows(input.rows, 4);
  const dangerousRowsForBrief = dangerousRows(input.rows, 4);
  const shockRowsForBrief = shockRows(input.rows, 4);
  const staleRowsForBrief = staleRows(input.rows, 4);
  const replayRowsForBrief = replaySimilarityRows(input.rows, 4);
  const topWatch = topWatchRowsForBrief.map((row) => row.symbol);
  const dangerous = dangerousRowsForBrief.map((row) => row.symbol);
  const shock = shockRowsForBrief.map((row) => row.symbol);
  const stale = staleRowsForBrief.map((row) => row.symbol);
  const replay = replayRowsForBrief.map((row) => row.symbol);
  const watchlistChanges = (input.workflowEvolution?.watchlistEvolution ?? []).slice(0, 4).map((item) => `${item.symbol}: ${item.title}`);
  const marketState = stringOrNull(input.marketCondition);
  const macroPressure = macroPressureSummary(input.rows, marketState);
  const riskEnvironment = riskEnvironmentSummary(input.rows, marketState);
  const sinceLastVisit = sinceLastVisitItems(input.workflowEvolution);
  const monitorList = monitorListFor(input.rows, input.workflowEvolution);
  const headline = marketState
    ? `Market state is ${humanizeLabel(marketState)}. ${riskEnvironment} Review what changed before forcing new risk.`
    : "Daily brief is using the latest scanner packet. Market state is limited in this snapshot.";

  const bullets = [
    topWatch.length ? `Top watch candidates: ${topWatch.join(", ")}.` : "No high-quality watch candidate is dominant yet.",
    dangerous.length ? `Risk review names: ${dangerous.join(", ")}.` : "No critical dangerous-now cluster is dominant.",
    shock.length ? `Shock watch: ${shock.join(", ")}.` : "No elevated shock cluster is leading this packet.",
    stale.length ? `Stale or decaying setups: ${stale.join(", ")}.` : "No stale setup cluster is dominating the feed.",
    sinceLastVisit.length ? "Since-last-visit changes are available below." : "Change history is still building from real workflow snapshots.",
  ];

  const sections = buildDailyBriefSections({
    dangerousRows: dangerousRowsForBrief,
    macroPressure,
    marketState,
    monitorList,
    replayRows: replayRowsForBrief,
    riskEnvironment,
    shockRows: shockRowsForBrief,
    sinceLastVisit,
    staleRows: staleRowsForBrief,
    topWatchRows: topWatchRowsForBrief,
    watchlistChanges,
  });

  return {
    bullets,
    dangerousSymbols: dangerous,
    generatedAt,
    headline,
    macroPressure,
    marketState,
    monitorList,
    replaySimilaritySymbols: replay,
    riskEnvironment,
    sections,
    shockSymbols: shock,
    sinceLastVisit,
    staleSymbols: stale,
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
    ...scoreChangeItems(input.rows, dataTimestamp, watchlist),
    ...confidenceChangeItems(input.rows, dataTimestamp, watchlist),
    ...topOpportunityRows(input.rows, 3).map((row) => opportunityItem(row, dataTimestamp)),
    ...dangerousRows(input.rows, 3).map((row) => riskItem(row, dataTimestamp, watchlist.has(row.symbol))),
    breadthDeteriorationItem(input.rows, dataTimestamp),
    ...sectorPressureItems(input.rows, dataTimestamp),
    ...freshnessDecayItems(input.rows, dataTimestamp, watchlist),
    ...contradictionItems(input.rows, dataTimestamp, watchlist),
    ...volatilitySpikeItems(input.rows, dataTimestamp, watchlist),
    ...shockRows(input.rows, 3).map((row) => shockItem(row, dataTimestamp)),
    ...replaySimilarityItems(input.rows, dataTimestamp, watchlist),
    replayItem(input.workflowEvolution, dataTimestamp),
  ].filter((item): item is IntelligenceFeedItem => Boolean(item));

  return dedupeFeedItems(items)
    .sort((left, right) => feedRankScore(right, watchlist) - feedRankScore(left, watchlist) || timestampMs(right.dataTimestamp) - timestampMs(left.dataTimestamp) || left.title.localeCompare(right.title))
    .slice(0, 24);
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
    breadth_deterioration: "Breadth deterioration",
    confidence_change: "Confidence change",
    contradiction_detected: "Contradiction detected",
    freshness_decay: "Freshness decay",
    large_score_change: "Large score change",
    macro_regime_shift: "Macro regime shift",
    replay_relevant_event: "Replay-relevant event",
    sector_pressure_change: "Sector pressure change",
    shock_risk: "Shock risk",
    volatility_spike: "Volatility spike",
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

function scoreChangeItems(rows: OpportunityViewModel[], dataTimestamp: string, watchlist: Set<string>): IntelligenceFeedItem[] {
  return rows
    .map((row) => ({ delta: scoreChangeValue(row), row }))
    .filter((item): item is { delta: number; row: OpportunityViewModel } => item.delta !== null && Math.abs(item.delta) >= 4)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 4)
    .map(({ delta, row }) => {
      const improved = delta > 0;
      const score = rounded(row.final_score ?? row.conviction);
      return {
        actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
        category: improved ? "large_score_change" : "watchlist_risk_escalation",
        dataTimestamp,
        evidenceLabel: `Score ${signed(delta)} · now ${score}/100`,
        itemType: improved ? "score_improved" : "score_deteriorated",
        monitorNext: improved
          ? "Check whether price, market context, and evidence quality confirm the improvement."
          : "Review what weakened before trusting any stale watchlist view.",
        notificationEligible: watchlist.has(row.symbol) || Math.abs(delta) >= 8,
        relatedSymbol: row.symbol,
        severity: improved ? "positive" : Math.abs(delta) >= 8 ? "warning" : "medium",
        sourceKey: `score:${row.symbol}:${Math.round(delta)}:${dateBucket(dataTimestamp)}`,
        summary: improved
          ? `${row.symbol} improved versus the previous comparable scanner context.`
          : `${row.symbol} weakened versus the previous comparable scanner context.`,
        title: improved ? `${row.symbol} score improved` : `${row.symbol} score deteriorated`,
        whyItMatters: "Large score movement is more useful than a static score because it highlights changing setup quality.",
      };
    });
}

function confidenceChangeItems(rows: OpportunityViewModel[], dataTimestamp: string, watchlist: Set<string>): IntelligenceFeedItem[] {
  return rows
    .map((row) => ({ delta: confidenceChangeValue(row), row }))
    .filter((item): item is { delta: number; row: OpportunityViewModel } => item.delta !== null && Math.abs(item.delta) >= 5)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 4)
    .map(({ delta, row }) => {
      const improved = delta > 0;
      return {
        actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
        category: "confidence_change" as const,
        dataTimestamp,
        evidenceLabel: `Confidence ${signed(delta)} · ${row.confidenceLabel}`,
        itemType: "confidence_changed" as const,
        monitorNext: improved ? "Confirm that stronger confidence is supported by current market and risk context." : "Check whether lower confidence is from stale evidence, risk pressure, or weaker setup quality.",
        notificationEligible: watchlist.has(row.symbol) || Math.abs(delta) >= 9,
        relatedSymbol: row.symbol,
        severity: improved ? "positive" as const : "warning" as const,
        sourceKey: `confidence:${row.symbol}:${Math.round(delta)}:${dateBucket(dataTimestamp)}`,
        summary: `${row.symbol} confidence ${improved ? "improved" : "weakened"} in the latest comparable scanner context.`,
        title: `${row.symbol} confidence ${improved ? "improved" : "weakened"}`,
        whyItMatters: "Confidence changes help separate improving research candidates from stale or weakening setups.",
      };
    });
}

function freshnessDecayItems(rows: OpportunityViewModel[], dataTimestamp: string, watchlist: Set<string>): IntelligenceFeedItem[] {
  return staleRows(rows, 5).map((row) => ({
    actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
    category: "freshness_decay" as const,
    dataTimestamp,
    evidenceLabel: row.dataFreshness.message,
    itemType: "freshness_decayed" as const,
    monitorNext: "Wait for a fresher scan or updated evidence before treating the setup as current.",
    notificationEligible: watchlist.has(row.symbol) && row.dataFreshness.status === "stale",
    relatedSymbol: row.symbol,
    severity: row.dataFreshness.status === "stale" ? "warning" as const : "info" as const,
    sourceKey: `freshness:${row.symbol}:${row.dataFreshness.status}:${dateBucket(dataTimestamp)}`,
    summary: `${row.symbol} evidence is ${row.dataFreshness.label.toLowerCase()}.`,
    title: `${row.symbol} setup freshness decayed`,
    whyItMatters: "Signals age. Freshness decay prevents older context from feeling more certain than it is.",
  }));
}

function contradictionItems(rows: OpportunityViewModel[], dataTimestamp: string, watchlist: Set<string>): IntelligenceFeedItem[] {
  return rows
    .filter((row) => (row.final_score ?? row.conviction) >= 62 && Math.max(row.fragility, row.eventRisk, row.shockPattern?.twoSidedVolatilityScore ?? 0) >= 70)
    .sort((left, right) => contradictionScore(right) - contradictionScore(left) || left.symbol.localeCompare(right.symbol))
    .slice(0, 5)
    .map((row) => ({
      actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
      category: "contradiction_detected" as const,
      dataTimestamp,
      evidenceLabel: `Score ${rounded(row.final_score ?? row.conviction)}/100 · Risk ${rounded(Math.max(row.fragility, row.eventRisk))}/100`,
      itemType: "contradiction_detected" as const,
      monitorNext: "Separate setup quality from risk pressure before escalating this symbol.",
      notificationEligible: watchlist.has(row.symbol) || contradictionScore(row) >= 150,
      relatedSymbol: row.symbol,
      severity: "warning" as const,
      sourceKey: `contradiction:${row.symbol}:${rounded(contradictionScore(row))}:${dateBucket(dataTimestamp)}`,
      summary: `${row.symbol} has useful setup evidence, but risk pressure is also elevated.`,
      title: `${row.symbol} has conflicting signals`,
      whyItMatters: "Contradictions are where users most often over-trust a single score. TradeVeto surfaces the conflict explicitly.",
    }));
}

function volatilitySpikeItems(rows: OpportunityViewModel[], dataTimestamp: string, watchlist: Set<string>): IntelligenceFeedItem[] {
  return rows
    .filter((row) => volatilityPressureScore(row) >= 72)
    .sort((left, right) => volatilityPressureScore(right) - volatilityPressureScore(left) || left.symbol.localeCompare(right.symbol))
    .slice(0, 4)
    .map((row) => ({
      actionHref: `/symbol/${encodeURIComponent(row.symbol)}`,
      category: "volatility_spike" as const,
      dataTimestamp,
      evidenceLabel: `Volatility pressure ${rounded(volatilityPressureScore(row))}/100`,
      itemType: "volatility_spiked" as const,
      monitorNext: "Check whether volatility expansion is event-driven, late-cycle, or supported by real setup quality.",
      notificationEligible: watchlist.has(row.symbol) || volatilityPressureScore(row) >= 82,
      relatedSymbol: row.symbol,
      severity: volatilityPressureScore(row) >= 82 ? "critical" as const : "warning" as const,
      sourceKey: `volatility:${row.symbol}:${rounded(volatilityPressureScore(row))}:${dateBucket(dataTimestamp)}`,
      summary: `${row.symbol} is showing elevated volatility or large-move pressure.`,
      title: `${row.symbol} volatility pressure increased`,
      whyItMatters: "Volatility expansion can make a setup more fragile even when the headline score looks attractive.",
    }));
}

function replaySimilarityItems(rows: OpportunityViewModel[], dataTimestamp: string, watchlist: Set<string>): IntelligenceFeedItem[] {
  return replaySimilarityRows(rows, 4).map((row) => ({
    actionHref: `/symbol/${encodeURIComponent(row.symbol)}#replay`,
    category: "replay_relevant_event" as const,
    dataTimestamp,
    evidenceLabel: `Replay similarity ${rounded(row.shockPattern?.currentSimilarityScore ?? 0)}/100`,
    itemType: "replay_similarity_found" as const,
    monitorNext: "Open replay context to compare prior similar environments before trusting the current setup.",
    notificationEligible: watchlist.has(row.symbol) && (row.shockPattern?.currentSimilarityScore ?? 0) >= 76,
    relatedSymbol: row.symbol,
    severity: "info" as const,
    sourceKey: `replay:${row.symbol}:${rounded(row.shockPattern?.currentSimilarityScore ?? 0)}:${dateBucket(dataTimestamp)}`,
    summary: `${row.symbol} has historical pattern context available for research comparison.`,
    title: `${row.symbol} replay similarity found`,
    whyItMatters: "Replay context helps users see whether current conditions resemble past environments instead of relying on today’s score alone.",
  }));
}

function breadthDeteriorationItem(rows: OpportunityViewModel[], dataTimestamp: string): IntelligenceFeedItem | null {
  if (!rows.length) return null;
  const avoidCount = rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === "AVOID" || row.fragility >= 72).length;
  const ratio = avoidCount / rows.length;
  if (ratio < 0.42) return null;
  return {
    actionHref: "/terminal#market-state",
    category: "breadth_deterioration",
    dataTimestamp,
    evidenceLabel: `${avoidCount}/${rows.length} symbols risk-filtered`,
    itemType: "breadth_deteriorated",
    monitorNext: "Watch whether risk-filtered names keep expanding or whether breadth improves in the next scan.",
    notificationEligible: ratio >= 0.55,
    relatedSymbol: null,
    severity: ratio >= 0.55 ? "warning" : "medium",
    sourceKey: `breadth:${avoidCount}:${rows.length}:${dateBucket(dataTimestamp)}`,
    summary: "A large share of the scanner universe is risk-filtered or fragile.",
    title: "Market breadth deteriorated",
    whyItMatters: "Broad deterioration changes how much trust to put in individual opportunities, even strong-looking ones.",
  };
}

function sectorPressureItems(rows: OpportunityViewModel[], dataTimestamp: string): IntelligenceFeedItem[] {
  const groups = new Map<string, { count: number; pressure: number; symbols: string[] }>();
  for (const row of rows) {
    const sector = stringOrNull(row.sector) ?? "Unclassified";
    const current = groups.get(sector) ?? { count: 0, pressure: 0, symbols: [] };
    current.count += 1;
    current.pressure += Math.max(row.fragility, row.eventRisk);
    if (current.symbols.length < 4) current.symbols.push(row.symbol);
    groups.set(sector, current);
  }
  return [...groups.entries()]
    .map(([sector, item]) => ({ average: item.pressure / item.count, sector, symbols: item.symbols }))
    .filter((item) => item.average >= 70 && item.symbols.length >= 2)
    .sort((left, right) => right.average - left.average || left.sector.localeCompare(right.sector))
    .slice(0, 3)
    .map((item) => ({
      actionHref: "/opportunities",
      category: "sector_pressure_change" as const,
      dataTimestamp,
      evidenceLabel: `${item.sector} pressure ${rounded(item.average)}/100`,
      itemType: "sector_pressure_changed" as const,
      monitorNext: `Review whether ${item.symbols.join(", ")} share the same sector pressure or isolated symbol risk.`,
      notificationEligible: item.average >= 78,
      relatedSymbol: item.symbols[0] ?? null,
      severity: item.average >= 78 ? "warning" as const : "medium" as const,
      sourceKey: `sector:${stableKey(item.sector)}:${rounded(item.average)}:${dateBucket(dataTimestamp)}`,
      summary: `${item.sector} has elevated average risk pressure across multiple scanner rows.`,
      title: `${item.sector} pressure increased`,
      whyItMatters: "Sector pressure helps users tell whether a symbol is moving alone or inside a broader risk cluster.",
    }));
}

function buildDailyBriefSections(input: {
  dangerousRows: OpportunityViewModel[];
  macroPressure: string;
  marketState: string | null;
  monitorList: string[];
  replayRows: OpportunityViewModel[];
  riskEnvironment: string;
  shockRows: OpportunityViewModel[];
  sinceLastVisit: string[];
  staleRows: OpportunityViewModel[];
  topWatchRows: OpportunityViewModel[];
  watchlistChanges: string[];
}): DailyBriefSection[] {
  return [
    {
      actionHref: "/terminal#market-state",
      details: [
        input.marketState ? `Market state is ${humanizeLabel(input.marketState)}.` : "Market state is limited in this snapshot.",
        input.riskEnvironment,
      ],
      key: "market_state",
      severity: /risk|overheated|transition|fragile|weak/i.test(input.marketState ?? "") ? "warning" : "info",
      status: input.marketState ? humanizeLabel(input.marketState) : "Limited",
      summary: input.marketState ? `Current environment: ${humanizeLabel(input.marketState)}.` : "Market state is not fully available yet.",
      symbols: [],
      title: "Market State",
    },
    {
      actionHref: "/terminal#market-charts",
      details: [input.macroPressure, "Macro pressure is inferred from real macro/exchange alignment fields when available."],
      key: "macro_pressure",
      severity: /elevated|weak|negative|deterior/i.test(input.macroPressure) ? "warning" : "info",
      status: input.macroPressure,
      summary: input.macroPressure,
      symbols: [],
      title: "Macro Pressure",
    },
    {
      actionHref: "/opportunities",
      details: input.topWatchRows.map((row) => `${row.symbol}: ${row.confidenceLabel} confidence, score ${rounded(row.final_score ?? row.conviction)}/100.`),
      key: "best_setups",
      severity: input.topWatchRows.length ? "positive" : "info",
      status: input.topWatchRows.length ? `${input.topWatchRows.length} candidates` : "Limited",
      summary: input.topWatchRows.length ? `${input.topWatchRows.map((row) => row.symbol).join(", ")} are the highest-priority research candidates.` : "No high-quality setup cluster is dominant yet.",
      symbols: input.topWatchRows.map((row) => row.symbol),
      title: "Best Setups",
    },
    {
      actionHref: "/opportunities?mode=risk",
      details: input.dangerousRows.map((row) => `${row.symbol}: fragility ${rounded(row.fragility)}/100, event risk ${rounded(row.eventRisk)}/100.`),
      key: "dangerous_names",
      severity: input.dangerousRows.length ? "warning" : "info",
      status: input.dangerousRows.length ? `${input.dangerousRows.length} risk-review` : "Quiet",
      summary: input.dangerousRows.length ? `${input.dangerousRows.map((row) => row.symbol).join(", ")} require risk review first.` : "No dominant dangerous-name cluster is present.",
      symbols: input.dangerousRows.map((row) => row.symbol),
      title: "Dangerous Names",
    },
    {
      actionHref: "/terminal#intelligence-feed",
      details: input.shockRows.map((row) => `${row.symbol}: volatility/shock pressure ${rounded(shockSortScore(row))}/100.`),
      key: "shock_watch",
      severity: input.shockRows.length ? "warning" : "info",
      status: input.shockRows.length ? `${input.shockRows.length} elevated` : "No cluster",
      summary: input.shockRows.length ? `${input.shockRows.map((row) => row.symbol).join(", ")} have elevated large-move or shock context.` : "No shock cluster is dominating this scan.",
      symbols: input.shockRows.map((row) => row.symbol),
      title: "Shock Watch",
    },
    {
      actionHref: "/history",
      details: input.sinceLastVisit,
      key: "what_changed",
      severity: input.sinceLastVisit.some((item) => /risk|weaken|deterior|fragility/i.test(item)) ? "warning" : "info",
      status: input.sinceLastVisit.length ? `${input.sinceLastVisit.length} updates` : "Building",
      summary: input.sinceLastVisit.length ? input.sinceLastVisit[0] ?? "Workflow changes are available." : "TradeVeto is building a baseline for since-last-visit changes.",
      symbols: symbolsFromText(input.sinceLastVisit.join(" ")),
      title: "What Changed",
    },
    {
      actionHref: "/history",
      details: input.replayRows.map((row) => `${row.symbol}: replay similarity ${rounded(row.shockPattern?.currentSimilarityScore ?? 0)}/100.`),
      key: "replay_similarities",
      severity: "info",
      status: input.replayRows.length ? `${input.replayRows.length} available` : "Limited",
      summary: input.replayRows.length ? `${input.replayRows.map((row) => row.symbol).join(", ")} have replay-style historical context.` : "No strong replay similarity is available yet.",
      symbols: input.replayRows.map((row) => row.symbol),
      title: "Replay Similarities",
    },
    {
      actionHref: "/opportunities",
      details: input.staleRows.map((row) => `${row.symbol}: ${row.dataFreshness.message}.`),
      key: "stale_setups",
      severity: input.staleRows.length ? "warning" : "info",
      status: input.staleRows.length ? `${input.staleRows.length} stale` : "Fresh enough",
      summary: input.staleRows.length ? `${input.staleRows.map((row) => row.symbol).join(", ")} need fresher evidence before confidence increases.` : "No stale setup cluster is dominating the feed.",
      symbols: input.staleRows.map((row) => row.symbol),
      title: "Stale Setups",
    },
    {
      actionHref: "/terminal#intelligence-feed",
      details: input.watchlistChanges.length ? input.watchlistChanges : ["Watchlist change history is still building from real user workflow snapshots."],
      key: "watchlist_changes",
      severity: input.watchlistChanges.some((item) => /risk|fragility|deterior/i.test(item)) ? "warning" : "info",
      status: input.watchlistChanges.length ? `${input.watchlistChanges.length} changes` : "Building",
      summary: input.watchlistChanges.length ? "Tracked symbols changed since the prior workflow snapshot." : "Add symbols to the watchlist to personalize future daily briefs.",
      symbols: symbolsFromText(input.watchlistChanges.join(" ")),
      title: "Watchlist Changes",
    },
    {
      actionHref: "/terminal#intelligence-feed",
      details: input.monitorList.length ? input.monitorList : ["No validated monitor list is available yet."],
      key: "what_to_monitor",
      severity: "info",
      status: input.monitorList.length ? `${input.monitorList.length} checks` : "Limited",
      summary: input.monitorList.length ? "These are the highest-signal items to monitor next." : "The monitor list will fill as scanner evidence and workflow memory mature.",
      symbols: symbolsFromText(input.monitorList.join(" ")),
      title: "What To Monitor",
    },
  ];
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

function staleRows(rows: OpportunityViewModel[], limit: number): OpportunityViewModel[] {
  return rows
    .filter((row) => row.dataFreshness.status === "stale" || row.dataFreshness.status === "missing" || /stale|decay|old/i.test(row.decayLabel))
    .sort((left, right) => freshnessRank(right) - freshnessRank(left) || (right.dataFreshness.ageMinutes ?? 0) - (left.dataFreshness.ageMinutes ?? 0) || left.symbol.localeCompare(right.symbol))
    .slice(0, limit);
}

function replaySimilarityRows(rows: OpportunityViewModel[], limit: number): OpportunityViewModel[] {
  return rows
    .filter((row) => (row.shockPattern?.currentSimilarityScore ?? 0) >= 62)
    .sort((left, right) => (right.shockPattern?.currentSimilarityScore ?? 0) - (left.shockPattern?.currentSimilarityScore ?? 0) || left.symbol.localeCompare(right.symbol))
    .slice(0, limit);
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

function scoreChangeValue(row: OpportunityViewModel): number | null {
  return firstAvailableNumber(row.raw.score_change, row.raw.final_score_change, row.raw.readiness_change, row.raw.score_delta, row.raw.final_score_delta);
}

function confidenceChangeValue(row: OpportunityViewModel): number | null {
  return firstAvailableNumber(row.raw.confidence_change, row.raw.conviction_change, row.raw.confidence_delta, row.raw.conviction_delta);
}

function volatilityPressureScore(row: OpportunityViewModel): number {
  return Math.max(
    row.shockPattern?.twoSidedVolatilityScore ?? 0,
    finiteNumber(row.raw.volatility_score) ?? 0,
    finiteNumber(row.raw.volatility_pressure_score) ?? 0,
    finiteNumber(row.raw.event_shock_pressure_score) ?? 0,
    row.eventRisk,
  );
}

function contradictionScore(row: OpportunityViewModel): number {
  return rounded(row.final_score ?? row.conviction) + rounded(Math.max(row.fragility, row.eventRisk, row.shockPattern?.twoSidedVolatilityScore ?? 0));
}

function macroPressureSummary(rows: OpportunityViewModel[], marketState: string | null): string {
  const macroScores = rows
    .map((row) => firstAvailableNumber(row.raw.macro_alignment_score, row.raw.macro_score, row.macroAdjustment))
    .filter((value): value is number => value !== null);
  if (!macroScores.length) {
    return marketState && /risk|transition|overheated/i.test(marketState) ? "Macro context is cautious from the current market state." : "Macro context is limited in this snapshot.";
  }
  const average = macroScores.reduce((total, value) => total + value, 0) / macroScores.length;
  if (average >= 62) return `Macro alignment is supportive on average (${Math.round(average)}/100).`;
  if (average <= 42) return `Macro pressure is elevated on average (${Math.round(average)}/100).`;
  return `Macro alignment is mixed on average (${Math.round(average)}/100).`;
}

function riskEnvironmentSummary(rows: OpportunityViewModel[], marketState: string | null): string {
  if (!rows.length) return "Risk environment is limited until scanner rows are available.";
  const elevated = rows.filter((row) => Math.max(row.fragility, row.eventRisk, volatilityPressureScore(row)) >= 70).length;
  const ratio = elevated / rows.length;
  if (ratio >= 0.45) return `Risk is elevated across ${elevated}/${rows.length} scanner rows.`;
  if (marketState && /overheated|risk|transition/i.test(marketState)) return "Risk is elevated by current market-state context.";
  return `Risk pressure is contained across most scanner rows (${elevated}/${rows.length} elevated).`;
}

function sinceLastVisitItems(workflow: WorkflowEvolutionSummary | null | undefined): string[] {
  const items = [...(workflow?.whatChanged ?? []), ...(workflow?.watchlistEvolution ?? [])]
    .map((item) => `${item.symbol === "WORKFLOW" ? "Workflow" : item.symbol}: ${item.title} - ${item.metricLabel}`)
    .slice(0, 6);
  if (items.length) return items;
  return workflow?.dailyBrief.slice(0, 4) ?? [];
}

function feedRankScore(item: IntelligenceFeedItem, watchlist: Set<string>): number {
  const symbolBoost = item.relatedSymbol && watchlist.has(item.relatedSymbol) ? 18 : 0;
  const notifyBoost = item.notificationEligible ? 8 : 0;
  const categoryBoost: Partial<Record<NotificationCategory, number>> = {
    alert_threshold: 15,
    breadth_deterioration: 11,
    contradiction_detected: 12,
    freshness_decay: 7,
    macro_regime_shift: 10,
    shock_risk: 14,
    volatility_spike: 13,
    watchlist_risk_escalation: 16,
  };
  const itemBoost: Partial<Record<IntelligenceFeedType, number>> = {
    alert_triggered: 18,
    breadth_deteriorated: 11,
    contradiction_detected: 13,
    freshness_decayed: 8,
    market_regime_changed: 10,
    opportunity_attention_queue: 8,
    replay_similarity_found: 7,
    risk_pressure_increased: 14,
    shock_risk_detected: 14,
    volatility_spiked: 13,
    watchlist_score_improved: 15,
  };
  return severityRank(item.severity) * 20 + symbolBoost + notifyBoost + (categoryBoost[item.category] ?? 0) + (itemBoost[item.itemType] ?? 0);
}

function firstAvailableNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function freshnessRank(row: OpportunityViewModel): number {
  if (row.dataFreshness.status === "missing") return 4;
  if (row.dataFreshness.status === "schema_mismatch") return 3;
  if (row.dataFreshness.status === "stale") return 2;
  if (/stale|decay|old/i.test(row.decayLabel)) return 1;
  return 0;
}

function signed(value: number): string {
  const roundedValue = Math.round(value * 10) / 10;
  return `${roundedValue > 0 ? "+" : ""}${roundedValue.toFixed(Math.abs(roundedValue) < 10 && !Number.isInteger(roundedValue) ? 1 : 0)}`;
}

function symbolsFromText(value: string): string[] {
  const matches = value.match(/\b[A-Z][A-Z0-9._-]{1,5}\b/g) ?? [];
  const output: string[] = [];
  for (const item of matches) {
    if (["THIS", "WHAT", "WATCH", "RISK", "WAIT", "HIGH", "LOW"].includes(item)) continue;
    if (!output.includes(item)) output.push(item);
    if (output.length >= 6) break;
  }
  return output;
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
