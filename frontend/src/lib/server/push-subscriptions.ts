import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "./db";

export type PushAlertPreferenceKey = "watchlist" | "shock" | "macro" | "fragility" | "whatChanged" | "replay";

export type PushPreferences = Record<PushAlertPreferenceKey, boolean>;

export type PushSubscriptionInput = {
  auth: string;
  endpoint: string;
  p256dh: string;
  platform?: string | null;
  preferences?: Partial<PushPreferences> | null;
  userAgent?: string | null;
};

export type StoredPushSubscription = {
  auth: string;
  endpoint: string;
  id: string;
  p256dh: string;
  platform: string | null;
  preferences: PushPreferences;
  userAgent: string | null;
};

export type PushSubscriptionStatus = {
  enabledCount: number;
  lastSeenAt: string | null;
  preferences: PushPreferences;
};

type PushSubscriptionRow = QueryResultRow & {
  auth: string;
  enabled_count?: string | number | null;
  endpoint: string;
  id: string;
  last_seen_at?: string | Date | null;
  p256dh: string;
  platform: string | null;
  preferences: unknown;
  user_agent: string | null;
};

const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  fragility: true,
  macro: true,
  replay: true,
  shock: true,
  watchlist: true,
  whatChanged: true,
};

export function defaultPushPreferences(): PushPreferences {
  return { ...DEFAULT_PUSH_PREFERENCES };
}

export function normalizePushPreferences(value: unknown): PushPreferences {
  const source = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    fragility: booleanPreference(source.fragility, DEFAULT_PUSH_PREFERENCES.fragility),
    macro: booleanPreference(source.macro, DEFAULT_PUSH_PREFERENCES.macro),
    replay: booleanPreference(source.replay, DEFAULT_PUSH_PREFERENCES.replay),
    shock: booleanPreference(source.shock, DEFAULT_PUSH_PREFERENCES.shock),
    watchlist: booleanPreference(source.watchlist, DEFAULT_PUSH_PREFERENCES.watchlist),
    whatChanged: booleanPreference(source.whatChanged, DEFAULT_PUSH_PREFERENCES.whatChanged),
  };
}

export function normalizePushSubscriptionInput(value: unknown): PushSubscriptionInput | null {
  const source = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!source) return null;
  const subscription = typeof source.subscription === "object" && source.subscription !== null && !Array.isArray(source.subscription)
    ? (source.subscription as Record<string, unknown>)
    : source;
  const endpoint = cleanUrl(subscription.endpoint);
  const keys = typeof subscription.keys === "object" && subscription.keys !== null && !Array.isArray(subscription.keys)
    ? (subscription.keys as Record<string, unknown>)
    : {};
  const p256dh = cleanToken(keys.p256dh);
  const auth = cleanToken(keys.auth);
  if (!endpoint || !p256dh || !auth) return null;
  return {
    auth,
    endpoint,
    p256dh,
    platform: cleanText(source.platform, 80),
    preferences: normalizePushPreferences(source.preferences),
    userAgent: cleanText(source.userAgent, 320),
  };
}

export async function savePushSubscription(userId: string, input: PushSubscriptionInput): Promise<StoredPushSubscription> {
  const preferences = normalizePushPreferences(input.preferences);
  const result = await dbQuery<PushSubscriptionRow>(
    `
      INSERT INTO push_subscriptions (
        user_id,
        endpoint,
        p256dh,
        auth,
        user_agent,
        platform,
        enabled,
        preferences,
        last_seen_at,
        last_error,
        created_at,
        updated_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, true, $7::jsonb, now(), null, now(), now())
      ON CONFLICT (endpoint)
      DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        platform = excluded.platform,
        enabled = true,
        preferences = excluded.preferences,
        last_seen_at = now(),
        last_error = null,
        updated_at = now()
      RETURNING id::text, endpoint, p256dh, auth, user_agent, platform, preferences
    `,
    [userId, input.endpoint, input.p256dh, input.auth, cleanText(input.userAgent, 320), cleanText(input.platform, 80), JSON.stringify(preferences)],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Push subscription was not saved.");
  return subscriptionFromRow(row);
}

export async function disablePushSubscription(userId: string, endpoint: string): Promise<boolean> {
  const result = await dbQuery(
    `
      UPDATE push_subscriptions
      SET enabled = false, updated_at = now()
      WHERE user_id = $1::uuid
        AND endpoint = $2
    `,
    [userId, endpoint],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markPushSubscriptionError(endpoint: string, error: string): Promise<void> {
  await dbQuery(
    `
      UPDATE push_subscriptions
      SET last_error = $2, updated_at = now()
      WHERE endpoint = $1
    `,
    [endpoint, cleanText(error, 240)],
  );
}

export async function listEnabledPushSubscriptions(userId: string): Promise<StoredPushSubscription[]> {
  const result = await dbQuery<PushSubscriptionRow>(
    `
      SELECT id::text, endpoint, p256dh, auth, user_agent, platform, preferences
      FROM push_subscriptions
      WHERE user_id = $1::uuid
        AND enabled = true
      ORDER BY updated_at DESC
      LIMIT 8
    `,
    [userId],
  );
  return result.rows.map(subscriptionFromRow);
}

export async function getPushSubscriptionStatus(userId: string): Promise<PushSubscriptionStatus> {
  const result = await dbQuery<PushSubscriptionRow>(
    `
      SELECT id::text, endpoint, p256dh, auth, user_agent, platform, preferences, last_seen_at::text
      FROM push_subscriptions
      WHERE user_id = $1::uuid
        AND enabled = true
      ORDER BY last_seen_at DESC
      LIMIT 1
    `,
    [userId],
  );
  const countResult = await dbQuery<QueryResultRow & { enabled_count: string | number }>(
    `
      SELECT count(*)::int AS enabled_count
      FROM push_subscriptions
      WHERE user_id = $1::uuid
        AND enabled = true
    `,
    [userId],
  );
  const first = result.rows[0];
  return {
    enabledCount: numberValue(countResult.rows[0]?.enabled_count) ?? 0,
    lastSeenAt: timestampOrNull(first?.last_seen_at),
    preferences: normalizePushPreferences(first?.preferences),
  };
}

export async function logMobilePushIntelligenceEvent(
  userId: string,
  input: {
    actionUrl?: string | null;
    eventType: string;
    message: string;
    payload?: Record<string, unknown>;
    priority: string;
    title: string;
  },
): Promise<void> {
  await dbQuery(
    `
      INSERT INTO mobile_push_intelligence_events (
        user_id,
        event_type,
        title,
        message,
        action_url,
        priority,
        payload,
        created_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, now())
    `,
    [
      userId,
      cleanText(input.eventType, 80) ?? "mobile_intelligence",
      cleanText(input.title, 180) ?? "TradeVeto mobile alert",
      cleanText(input.message, 360) ?? "A TradeVeto mobile intelligence update is ready.",
      cleanActionUrl(input.actionUrl),
      cleanText(input.priority, 40) ?? "medium",
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

function subscriptionFromRow(row: PushSubscriptionRow): StoredPushSubscription {
  return {
    auth: row.auth,
    endpoint: row.endpoint,
    id: row.id,
    p256dh: row.p256dh,
    platform: row.platform,
    preferences: normalizePushPreferences(row.preferences),
    userAgent: row.user_agent,
  };
}

function booleanPreference(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function cleanToken(value: unknown): string | null {
  const text = cleanText(value, 420);
  if (!text || !/^[A-Za-z0-9_+=/-]+$/.test(text)) return null;
  return text;
}

function cleanUrl(value: unknown): string | null {
  const text = cleanText(value, 2048);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanActionUrl(value: unknown): string | null {
  const text = cleanText(value, 240);
  if (!text || !text.startsWith("/") || text.startsWith("//")) return null;
  return text;
}

function cleanText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function timestampOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  const text = cleanText(value, 80);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
