import "server-only";

import type { QueryResultRow } from "pg";
import { isNotificationType, type NotificationType, type UserNotification } from "@/lib/notifications";
import { dbQuery } from "./db";

type NotificationRow = QueryResultRow & {
  action_url: string | null;
  created_at: string;
  id: string;
  message: string;
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

export async function listNotifications(userId: string, limit = 20): Promise<{ notifications: UserNotification[]; unreadCount: number }> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
  const [notificationsResult, unreadResult] = await Promise.all([
    dbQuery<NotificationRow>(
      `
        SELECT id::text, type, title, message, read, action_url, created_at::text
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
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

export async function createNotificationWithAction(userId: string, type: NotificationType, title: string, message: string, actionUrl: string | null): Promise<UserNotification> {
  if (!isNotificationType(type)) throw new Error("Unsupported notification type.");
  const result = await dbQuery<NotificationRow>(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, created_at)
      VALUES ($1, $2, $3, $4, false, $5, now())
      RETURNING id::text, type, title, message, read, action_url, created_at::text
    `,
    [userId, type, cleanText(title, 140), cleanText(message, 500), cleanActionUrl(actionUrl)],
  );
  return notificationFromRow(result.rows[0]);
}

export async function createLoginNotifications(userId: string): Promise<void> {
  await createNotificationOnce(
    userId,
    "system",
    "Welcome to Market Alpha",
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

export async function createNotificationOnce(userId: string, type: NotificationType, title: string, message: string, actionUrl: string | null = null): Promise<void> {
  await dbQuery(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, created_at)
      SELECT $1, $2, $3, $4, false, $5, now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE user_id = $1 AND type = $2 AND title = $3
      )
    `,
    [userId, type, cleanText(title, 140), cleanText(message, 500), cleanActionUrl(actionUrl)],
  );
}

export async function createUnreadNotificationIfMissing(userId: string, type: NotificationType, title: string, message: string, actionUrl: string | null = null): Promise<void> {
  await dbQuery(
    `
      INSERT INTO notifications (user_id, type, title, message, read, action_url, created_at)
      SELECT $1, $2, $3, $4, false, $5, now()
      WHERE NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE user_id = $1 AND type = $2 AND title = $3 AND read = false
      )
    `,
    [userId, type, cleanText(title, 140), cleanText(message, 500), cleanActionUrl(actionUrl)],
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

function notificationFromRow(row: NotificationRow | undefined): UserNotification {
  if (!row) throw new Error("Notification record was not returned.");
  return {
    actionUrl: cleanActionUrl(row.action_url),
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    read: Boolean(row.read),
    title: row.title,
    type: isNotificationType(row.type) ? row.type : "system",
  };
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
