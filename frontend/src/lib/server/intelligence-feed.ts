import "server-only";

import type { QueryResultRow } from "pg";
import type { ActiveAlertMatch } from "@/lib/active-alert-matches";
import { createNotificationWithAction } from "@/lib/server/notifications";
import {
  buildDailyBrief,
  buildIntelligenceFeedItems,
  DEFAULT_NOTIFICATION_PREFERENCES,
  INTELLIGENCE_FEED_TYPES,
  normalizeNotificationPreferences,
  shouldNotifyForFeedItem,
  type BuildIntelligenceFeedInput,
  type DailyBrief,
  type IntelligenceFeedItem,
  type IntelligenceFeedSeverity,
  type IntelligenceFeedType,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/lib/trading/intelligence-feed";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { dbQuery, dbTransaction, type DbExecutor } from "./db";

type NotificationPreferencesRow = QueryResultRow & {
  categories: string[] | null;
  channels: string[] | null;
  daily_limit: number | null;
  frequency: string | null;
  preferences_updated_at: Date | string | null;
  quiet_hours_end: string | null;
  quiet_hours_start: string | null;
  symbol_scope: string | null;
  symbols: string[] | null;
};

type IntelligenceFeedItemRow = QueryResultRow & {
  action_href: string;
  category: string;
  created_at: Date | string | null;
  data_timestamp: Date | string;
  evidence_label: string;
  id: string;
  item_type: string;
  monitor_next: string;
  notification_eligible: boolean;
  notified_at: Date | string | null;
  read_at: Date | string | null;
  related_symbol: string | null;
  severity: string;
  source_key: string;
  summary: string;
  title: string;
  why_it_matters: string;
};

type CountRow = QueryResultRow & {
  count: string;
};

type NotificationFeedbackCategoryRow = QueryResultRow & {
  category: string | null;
  not_useful: string | number;
  total: string | number;
  useful: string | number;
};

type NotificationCategoryFatigue = {
  notUseful: number;
  suppressed: boolean;
  total: number;
  useful: number;
  usefulnessRatePct: number | null;
};

type NotificationAdaptiveProfile = {
  categories: Map<NotificationCategory, NotificationCategoryFatigue>;
};

export type IntelligenceFeedLoadInput = Omit<BuildIntelligenceFeedInput, "activeAlertMatches" | "rows" | "watchlistSymbols" | "workflowEvolution"> & {
  activeAlertMatches?: ActiveAlertMatch[];
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export type IntelligenceFeedLoadResult = {
  brief: DailyBrief;
  generatedAt: string;
  items: IntelligenceFeedItem[];
  preferences: NotificationPreferences;
};

export async function readUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const result = await dbQuery<NotificationPreferencesRow>(
    `
      SELECT
        categories,
        channels,
        frequency,
        symbol_scope,
        symbols,
        quiet_hours_start,
        quiet_hours_end,
        daily_limit,
        preferences_updated_at
      FROM user_notification_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return notificationPreferencesFromRow(result.rows[0]);
}

export async function upsertUserNotificationPreferences(userId: string, value: unknown): Promise<NotificationPreferences> {
  const preferences = normalizeNotificationPreferences(value);
  const result = await dbQuery<NotificationPreferencesRow>(
    `
      INSERT INTO user_notification_preferences (
        user_id,
        categories,
        channels,
        frequency,
        symbol_scope,
        symbols,
        quiet_hours_start,
        quiet_hours_end,
        daily_limit,
        created_at,
        updated_at,
        preferences_updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        categories = EXCLUDED.categories,
        channels = EXCLUDED.channels,
        frequency = EXCLUDED.frequency,
        symbol_scope = EXCLUDED.symbol_scope,
        symbols = EXCLUDED.symbols,
        quiet_hours_start = EXCLUDED.quiet_hours_start,
        quiet_hours_end = EXCLUDED.quiet_hours_end,
        daily_limit = EXCLUDED.daily_limit,
        updated_at = now(),
        preferences_updated_at = now()
      RETURNING
        categories,
        channels,
        frequency,
        symbol_scope,
        symbols,
        quiet_hours_start,
        quiet_hours_end,
        daily_limit,
        preferences_updated_at
    `,
    [
      userId,
      preferences.categories,
      preferences.channels,
      preferences.frequency,
      preferences.symbolScope,
      preferences.symbols,
      preferences.quietHoursStart,
      preferences.quietHoursEnd,
      preferences.dailyLimit,
    ],
  );
  return notificationPreferencesFromRow(result.rows[0]);
}

export async function loadIntelligenceFeedForUser(userId: string | null, input: IntelligenceFeedLoadInput): Promise<IntelligenceFeedLoadResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const feedInput: BuildIntelligenceFeedInput = { ...input, generatedAt };
  const brief = buildDailyBrief(feedInput);
  const generatedItems = buildIntelligenceFeedItems(feedInput);
  if (!userId) {
    return {
      brief,
      generatedAt,
      items: generatedItems,
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  const preferences = await readUserNotificationPreferences(userId).catch(() => DEFAULT_NOTIFICATION_PREFERENCES);
  const items = await syncUserIntelligenceFeedItems(userId, generatedItems).catch(() => generatedItems);
  await materializeEligibleNotifications(userId, items, preferences, input.watchlistSymbols ?? []).catch((error: unknown) => {
    console.warn("[intelligence-feed] notification materialization failed", error instanceof Error ? error.message : error);
  });

  return {
    brief,
    generatedAt,
    items,
    preferences,
  };
}

export async function listPersistedIntelligenceFeedItems(userId: string, limit = 24): Promise<IntelligenceFeedItem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const result = await dbQuery<IntelligenceFeedItemRow>(
    `
      SELECT
        id::text,
        source_key,
        item_type,
        category,
        severity,
        title,
        summary,
        why_it_matters,
        monitor_next,
        related_symbol,
        action_href,
        evidence_label,
        data_timestamp,
        notification_eligible,
        read_at,
        notified_at,
        created_at
      FROM user_intelligence_feed_items
      WHERE user_id = $1
      ORDER BY data_timestamp DESC, created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit],
  );
  return result.rows.map(feedItemFromRow);
}

async function syncUserIntelligenceFeedItems(userId: string, items: IntelligenceFeedItem[]): Promise<IntelligenceFeedItem[]> {
  if (!items.length) return [];
  return dbTransaction(async (db) => {
    const synced: IntelligenceFeedItem[] = [];
    for (const item of items) {
      const result = await upsertFeedItem(db, userId, item);
      synced.push(feedItemFromRow(result.rows[0]));
    }
    return synced;
  });
}

async function upsertFeedItem(db: DbExecutor, userId: string, item: IntelligenceFeedItem) {
  return db.query<IntelligenceFeedItemRow>(
    `
      INSERT INTO user_intelligence_feed_items (
        user_id,
        source_key,
        item_type,
        category,
        severity,
        title,
        summary,
        why_it_matters,
        monitor_next,
        related_symbol,
        action_href,
        evidence_label,
        data_timestamp,
        notification_eligible,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14, now(), now())
      ON CONFLICT (user_id, source_key)
      DO UPDATE SET
        item_type = EXCLUDED.item_type,
        category = EXCLUDED.category,
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        why_it_matters = EXCLUDED.why_it_matters,
        monitor_next = EXCLUDED.monitor_next,
        related_symbol = EXCLUDED.related_symbol,
        action_href = EXCLUDED.action_href,
        evidence_label = EXCLUDED.evidence_label,
        data_timestamp = EXCLUDED.data_timestamp,
        notification_eligible = EXCLUDED.notification_eligible,
        updated_at = now()
      RETURNING
        id::text,
        source_key,
        item_type,
        category,
        severity,
        title,
        summary,
        why_it_matters,
        monitor_next,
        related_symbol,
        action_href,
        evidence_label,
        data_timestamp,
        notification_eligible,
        read_at,
        notified_at,
        created_at
    `,
    [
      userId,
      item.sourceKey,
      item.itemType,
      item.category,
      item.severity,
      item.title.slice(0, 180),
      item.summary.slice(0, 600),
      item.whyItMatters.slice(0, 600),
      item.monitorNext.slice(0, 600),
      item.relatedSymbol,
      safeActionHref(item.actionHref),
      item.evidenceLabel.slice(0, 220),
      item.dataTimestamp,
      item.notificationEligible,
    ],
  );
}

async function materializeEligibleNotifications(userId: string, items: IntelligenceFeedItem[], preferences: NotificationPreferences, trackedSymbols: string[]): Promise<void> {
  if (!items.length || preferences.frequency === "off" || !preferences.channels.includes("in_app")) return;
  const remaining = await remainingNotificationBudget(userId, preferences.dailyLimit);
  if (remaining <= 0) return;
  const adaptiveProfile = await readNotificationAdaptiveProfile(userId).catch((error: unknown) => {
    console.warn("[intelligence-feed] notification fatigue profile unavailable", error instanceof Error ? error.message : error);
    return emptyNotificationAdaptiveProfile();
  });
  let created = 0;
  for (const rankedItem of rankNotificationCandidates(items, adaptiveProfile)) {
    const { item, rank } = rankedItem;
    if (created >= remaining) break;
    if (item.notifiedAt) continue;
    const decision = shouldNotifyForFeedItem(item, preferences, { trackedSymbols });
    if (!decision.allowed) continue;
    const fatigue = adaptiveProfile.categories.get(item.category);
    if (fatigue?.suppressed && item.severity !== "critical") continue;
    await createNotificationWithAction(userId, "signal", item.title, `${item.summary} ${item.monitorNext}`, item.actionHref, {
      adaptivePriority: rank <= 3 ? "top_return_loop" : "normal",
      feedCategory: item.category,
      feedSeverity: item.severity,
      sourceKey: item.sourceKey,
      usefulnessRatePct: fatigue?.usefulnessRatePct ?? null,
    });
    await dbQuery("UPDATE user_intelligence_feed_items SET notified_at = now(), updated_at = now() WHERE user_id = $1 AND source_key = $2", [userId, item.sourceKey]);
    item.notifiedAt = new Date().toISOString();
    created += 1;
  }
}

async function readNotificationAdaptiveProfile(userId: string): Promise<NotificationAdaptiveProfile> {
  const result = await dbQuery<NotificationFeedbackCategoryRow>(
    `
      SELECT
        NULLIF(COALESCE(notification_feedback.metadata->>'feedCategory', notifications.metadata->>'feedCategory', ''), '') AS category,
        count(*) FILTER (WHERE notification_feedback.feedback = 'useful') AS useful,
        count(*) FILTER (WHERE notification_feedback.feedback = 'not_useful') AS not_useful,
        count(*) AS total
      FROM notification_feedback
      JOIN notifications
        ON notifications.id = notification_feedback.notification_id
        AND notifications.user_id = notification_feedback.user_id
      WHERE notification_feedback.user_id = $1::uuid
        AND notification_feedback.updated_at >= now() - interval '45 days'
      GROUP BY 1
    `,
    [userId],
  );
  const categories = new Map<NotificationCategory, NotificationCategoryFatigue>();
  for (const row of result.rows) {
    const category = normalizeNotificationCategory(row.category);
    if (!category) continue;
    const useful = numberFromRow(row.useful);
    const notUseful = numberFromRow(row.not_useful);
    const total = numberFromRow(row.total);
    const usefulnessRatePct = total > 0 ? (useful / total) * 100 : null;
    categories.set(category, {
      notUseful,
      suppressed: total >= 3 && notUseful >= 2 && (usefulnessRatePct ?? 0) < 35,
      total,
      useful,
      usefulnessRatePct,
    });
  }
  return { categories };
}

function rankNotificationCandidates(items: IntelligenceFeedItem[], profile: NotificationAdaptiveProfile): Array<{ item: IntelligenceFeedItem; rank: number }> {
  return [...items]
    .sort((left, right) => notificationPriorityScore(right, profile) - notificationPriorityScore(left, profile) || notificationTimestampMs(right.dataTimestamp) - notificationTimestampMs(left.dataTimestamp))
    .map((item, index) => ({ item, rank: index + 1 }));
}

function notificationPriorityScore(item: IntelligenceFeedItem, profile: NotificationAdaptiveProfile): number {
  const fatigue = profile.categories.get(item.category);
  const fatiguePenalty = fatigue?.suppressed ? 50 : fatigue?.notUseful ? Math.min(24, fatigue.notUseful * 6) : 0;
  const usefulBoost = fatigue?.usefulnessRatePct !== null && fatigue?.usefulnessRatePct !== undefined ? Math.round(fatigue.usefulnessRatePct / 8) : 0;
  const severityScore = item.severity === "critical" ? 90 : item.severity === "warning" ? 70 : item.severity === "positive" ? 64 : item.severity === "medium" ? 54 : 42;
  return severityScore + usefulBoost - fatiguePenalty;
}

function emptyNotificationAdaptiveProfile(): NotificationAdaptiveProfile {
  return { categories: new Map() };
}

function normalizeNotificationCategory(value: unknown): NotificationCategory | null {
  const text = String(value ?? "");
  return NOTIFICATION_CATEGORIES.includes(text as NotificationCategory) ? (text as NotificationCategory) : null;
}

function notificationTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberFromRow(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function remainingNotificationBudget(userId: string, dailyLimit: number): Promise<number> {
  const result = await dbQuery<CountRow>(
    `
      SELECT count(*)::text AS count
      FROM user_intelligence_feed_items
      WHERE user_id = $1
        AND notified_at >= date_trunc('day', now())
    `,
    [userId],
  );
  const used = Number.parseInt(result.rows[0]?.count ?? "0", 10) || 0;
  return Math.max(0, dailyLimit - used);
}

function notificationPreferencesFromRow(row: NotificationPreferencesRow | undefined): NotificationPreferences {
  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;
  return normalizeNotificationPreferences({
    categories: row.categories ?? [],
    channels: row.channels ?? [],
    dailyLimit: row.daily_limit ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyLimit,
    frequency: row.frequency,
    preferencesUpdatedAt: timestampValue(row.preferences_updated_at),
    quietHoursEnd: row.quiet_hours_end,
    quietHoursStart: row.quiet_hours_start,
    symbolScope: row.symbol_scope,
    symbols: row.symbols ?? [],
  });
}

function feedItemFromRow(row: IntelligenceFeedItemRow): IntelligenceFeedItem {
  return {
    actionHref: safeActionHref(row.action_href),
    category: categoryValue(row.category),
    createdAt: timestampValue(row.created_at),
    dataTimestamp: timestampValue(row.data_timestamp) ?? new Date().toISOString(),
    evidenceLabel: row.evidence_label,
    id: row.id,
    itemType: itemTypeValue(row.item_type),
    monitorNext: row.monitor_next,
    notificationEligible: Boolean(row.notification_eligible),
    notifiedAt: timestampValue(row.notified_at),
    readAt: timestampValue(row.read_at),
    relatedSymbol: row.related_symbol,
    severity: severityValue(row.severity),
    sourceKey: row.source_key,
    summary: row.summary,
    title: row.title,
    whyItMatters: row.why_it_matters,
  };
}

function categoryValue(value: string): NotificationCategory {
  return NOTIFICATION_CATEGORIES.includes(value as NotificationCategory) ? value as NotificationCategory : "large_score_change";
}

function itemTypeValue(value: string): IntelligenceFeedType {
  return INTELLIGENCE_FEED_TYPES.includes(value as IntelligenceFeedType) ? value as IntelligenceFeedType : "opportunity_attention_queue";
}

function severityValue(value: string): IntelligenceFeedSeverity {
  if (["critical", "high", "info", "medium", "positive", "warning"].includes(value)) return value as IntelligenceFeedSeverity;
  return "info";
}

function safeActionHref(value: string): string {
  const text = String(value ?? "").trim();
  if (!text || !text.startsWith("/") || text.startsWith("//") || text.length > 240) return "/terminal";
  return text;
}

function timestampValue(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
