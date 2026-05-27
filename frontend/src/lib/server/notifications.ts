import "server-only";

import type { QueryResultRow } from "pg";
import {
  isNotificationType,
  normalizeNotificationFeedbackValue,
  type NotificationFeedbackValue,
  type NotificationType,
  type UserNotification,
  type UserNotificationContext,
} from "@/lib/notifications";
import { sanitizeAnalyticsMetadata, sanitizeAnalyticsSource } from "@/lib/analytics-policy";
import { dbQuery } from "./db";

type NotificationRow = QueryResultRow & {
  action_url: string | null;
  created_at: string;
  feedback: string | null;
  id: string;
  message: string;
  metadata: Record<string, unknown> | string | null;
  read: boolean;
  title: string;
  type: string;
};

type CountRow = QueryResultRow & {
  count: string;
};

type SubscriptionActiveRow = QueryResultRow & {
  active: boolean;
};

type FeedbackWriteRow = QueryResultRow & {
  notification_id: string;
};

type FeedbackSummaryRow = QueryResultRow & {
  not_useful: string | number;
  total: string | number;
  useful: string | number;
};

export type NotificationFeedbackSummary = {
  notUseful: number;
  total: number;
  useful: number;
  usefulnessRatePct: number | null;
};

export type NotificationCreateMetadata = Record<string, string | number | boolean | null | undefined>;

export async function listNotifications(userId: string, limit = 20): Promise<{ notifications: UserNotification[]; unreadCount: number }> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const [notificationsResult, unreadResult] = await Promise.all([
    dbQuery<NotificationRow>(
      `
        SELECT
          notifications.id::text,
          notifications.type,
          notifications.title,
          notifications.message,
          notifications.read,
          notifications.action_url,
          notifications.metadata,
          notifications.created_at::text,
          notification_feedback.feedback
        FROM notifications
        LEFT JOIN notification_feedback
          ON notification_feedback.notification_id = notifications.id
          AND notification_feedback.user_id = notifications.user_id
        WHERE notifications.user_id = $1
        ORDER BY notifications.created_at DESC
        LIMIT $2
      `,
      [userId, safeLimit],
    ),
    dbQuery<CountRow>("SELECT count(*)::text AS count FROM notifications WHERE user_id = $1 AND read = false", [userId]),
  ]);

  return {
    notifications: notificationsResult.rows.map(notificationFromRow),
    unreadCount: Number.parseInt(unreadResult.rows[0]?.count ?? "0", 10) || 0,
  };
}

export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  const result = await dbQuery(
    `
      UPDATE notifications
      SET read = true
      WHERE id = $1 AND user_id = $2
    `,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await dbQuery("UPDATE notifications SET read = true WHERE user_id = $1 AND read = false", [userId]);
  return result.rowCount ?? 0;
}

export async function createNotification(userId: string, type: NotificationType, title: string, message: string): Promise<UserNotification> {
  return createNotificationWithAction(userId, type, title, message, null);
}

export async function createNotificationWithAction(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl: string | null,
  metadata: NotificationCreateMetadata = {},
): Promise<UserNotification> {
  if (!isNotificationType(type)) throw new Error("Unsupported notification type.");
  const result = await dbQuery<NotificationRow>(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata, created_at)
      VALUES ($1, $2, $3, $4, false, $5, $6::jsonb, now())
      RETURNING id::text, type, title, message, read, action_url, metadata, created_at::text, NULL::text AS feedback
    `,
    [userId, type, cleanText(title, 140), cleanText(message, 500), cleanActionUrl(actionUrl), JSON.stringify(sanitizeNotificationMetadata(metadata))],
  );
  return notificationFromRow(result.rows[0]);
}

export async function recordNotificationFeedback(input: {
  feedback: NotificationFeedbackValue;
  metadata?: unknown;
  notificationId: string;
  source?: unknown;
  userId: string;
}): Promise<NotificationFeedbackSummary | null> {
  const source = sanitizeAnalyticsSource(input.source) ?? "notification_bell";
  const metadata = sanitizeAnalyticsMetadata(input.metadata);
  const writeResult = await dbQuery<FeedbackWriteRow>(
    `
      WITH target_notification AS (
        SELECT id, user_id, type, action_url
        FROM notifications
        WHERE id = $2::uuid
          AND user_id = $1::uuid
        LIMIT 1
      )
      INSERT INTO notification_feedback
        (notification_id, user_id, feedback, notification_type, action_url, source, metadata, created_at, updated_at)
      SELECT id, user_id, $3, type, action_url, $4, $5::jsonb, now(), now()
      FROM target_notification
      ON CONFLICT (notification_id, user_id)
      DO UPDATE SET
        feedback = EXCLUDED.feedback,
        notification_type = EXCLUDED.notification_type,
        action_url = EXCLUDED.action_url,
        source = EXCLUDED.source,
        metadata = notification_feedback.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING notification_id::text
    `,
    [input.userId, input.notificationId, input.feedback, source, JSON.stringify(metadata)],
  );

  if (!writeResult.rows[0]?.notification_id) return null;
  return readNotificationFeedbackSummary(input.userId);
}

export async function createLoginNotifications(userId: string): Promise<void> {
  await createNotificationOnce(
    userId,
    "system",
    "Welcome to TradeVeto",
    "Signals are research-only. This is not financial advice.",
  );

  if (!(await hasVerifiedEmail(userId))) {
    await createUnreadNotificationIfMissing(
      userId,
      "email_verification",
      "Verify your email",
      "Verify your email address to unlock premium upgrade.",
      "/account",
    );
  }

  if (await hasActivePremiumSubscription(userId)) {
    await createNotificationOnce(
      userId,
      "subscription",
      "Your premium subscription is active",
      "Premium research features are available on this account.",
      "/account",
    );
  }
}

export async function createNotificationOnce(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl: string | null = null,
  metadata: NotificationCreateMetadata = {},
): Promise<void> {
  await dbQuery(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata, created_at)
      SELECT $1, $2, $3, $4, false, $5, $6::jsonb, now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE user_id = $1 AND type = $2 AND title = $3
      )
    `,
    [userId, type, cleanText(title, 140), cleanText(message, 500), cleanActionUrl(actionUrl), JSON.stringify(sanitizeNotificationMetadata(metadata))],
  );
}

export async function createUnreadNotificationIfMissing(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl: string | null = null,
  metadata: NotificationCreateMetadata = {},
): Promise<void> {
  await dbQuery(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata, created_at)
      SELECT $1, $2, $3, $4, false, $5, $6::jsonb, now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE user_id = $1 AND type = $2 AND title = $3 AND read = false
      )
    `,
    [userId, type, cleanText(title, 140), cleanText(message, 500), cleanActionUrl(actionUrl), JSON.stringify(sanitizeNotificationMetadata(metadata))],
  );
}

export async function markNotificationsReadByType(userId: string, type: NotificationType): Promise<number> {
  const result = await dbQuery("UPDATE notifications SET read = true WHERE user_id = $1 AND type = $2 AND read = false", [userId, type]);
  return result.rowCount ?? 0;
}

async function hasActivePremiumSubscription(userId: string): Promise<boolean> {
  const result = await dbQuery<SubscriptionActiveRow>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM user_subscriptions
        WHERE user_id = $1
          AND plan = 'premium'
          AND status IN ('active', 'trialing')
          AND current_period_end > now()
      ) AS active
    `,
    [userId],
  );
  return Boolean(result.rows[0]?.active);
}

async function hasVerifiedEmail(userId: string): Promise<boolean> {
  const result = await dbQuery<SubscriptionActiveRow>("SELECT email_verified AS active FROM users WHERE id = $1 LIMIT 1", [userId]);
  return Boolean(result.rows[0]?.active);
}

async function readNotificationFeedbackSummary(userId: string): Promise<NotificationFeedbackSummary> {
  const result = await dbQuery<FeedbackSummaryRow>(
    `
      SELECT
        count(*) FILTER (WHERE feedback = 'useful') AS useful,
        count(*) FILTER (WHERE feedback = 'not_useful') AS not_useful,
        count(*) AS total
      FROM notification_feedback
      WHERE user_id = $1::uuid
    `,
    [userId],
  );
  const row = result.rows[0];
  const useful = numberFromRow(row?.useful);
  const notUseful = numberFromRow(row?.not_useful);
  const total = numberFromRow(row?.total);
  return {
    notUseful,
    total,
    useful,
    usefulnessRatePct: total > 0 ? (useful / total) * 100 : null,
  };
}

function notificationFromRow(row: NotificationRow | undefined): UserNotification {
  if (!row) throw new Error("Notification record was not returned.");
  return {
    actionUrl: cleanActionUrl(row.action_url),
    context: notificationContextFromMetadata(row.metadata),
    createdAt: row.created_at,
    feedback: normalizeNotificationFeedbackValue(row.feedback),
    id: row.id,
    message: row.message,
    read: Boolean(row.read),
    title: row.title,
    type: isNotificationType(row.type) ? row.type : "system",
  };
}

function sanitizeNotificationMetadata(metadata: NotificationCreateMetadata): Record<string, string | number | boolean | null> {
  return sanitizeAnalyticsMetadata(metadata);
}

function notificationContextFromMetadata(value: NotificationRow["metadata"]): UserNotificationContext {
  const metadata = metadataRecord(value);
  return {
    adaptivePriority: cleanContextValue(metadata.adaptivePriority),
    feedCategory: cleanContextValue(metadata.feedCategory),
    feedSeverity: cleanContextValue(metadata.feedSeverity),
    sourceKey: cleanContextValue(metadata.sourceKey),
  };
}

function metadataRecord(value: NotificationRow["metadata"]): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanContextValue(value: unknown): string | null {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9:_./-]/g, "_").slice(0, 96);
  return text || null;
}

function cleanText(value: string, maxLength: number): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text.slice(0, maxLength);
}

function cleanActionUrl(value: string | null): string | null {
  const text = value?.trim();
  if (!text || !text.startsWith("/") || text.startsWith("//") || text.length > 240) return null;
  return text;
}

function numberFromRow(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
