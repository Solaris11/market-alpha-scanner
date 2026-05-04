import "server-only";

import type { PoolClient, QueryResultRow } from "pg";
import { alertRulePayload } from "@/lib/security/alert-persistence";
import { getCurrentUser } from "./server/auth";
import { dbQuery, getDbPool } from "./server/db";

export const ALERT_TYPES = [
  "price_above",
  "price_below",
  "buy_zone_hit",
  "stop_loss_broken",
  "take_profit_hit",
  "score_above",
  "score_below",
  "score_changed_by",
  "rating_changed",
  "action_changed",
  "new_top_candidate",
  "entry_ready",
] as const;

export const ALERT_CHANNELS = ["telegram", "email"] as const;
export const ENTRY_FILTERS = ["any", "good_only", "good_or_wait", "avoid_overextended"] as const;
export const ALERT_SCOPES = ["symbol", "watchlist", "global"] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertChannel = (typeof ALERT_CHANNELS)[number];
export type EntryFilter = (typeof ENTRY_FILTERS)[number];
export type AlertScope = (typeof ALERT_SCOPES)[number];

export type AlertRule = {
  id: string;
  scope: AlertScope;
  symbol?: string;
  type: AlertType;
  threshold?: number;
  min_score?: number;
  min_rating?: string;
  allowed_actions?: string[];
  min_risk_reward?: number;
  max_alerts_per_run?: number;
  channels: AlertChannel[];
  enabled: boolean;
  cooldown_minutes: number;
  entry_filter?: EntryFilter;
  source?: "system" | "user";
  created_at_utc?: string;
  updated_at_utc?: string;
};

export type AlertRuleState = {
  alert_id?: string;
  symbol?: string;
  last_sent_at?: string;
  last_skipped_at?: string;
  last_trigger_value?: string;
  last_message_hash?: string;
  last_observed_value?: string;
  last_status?: string;
  last_skip_reason?: string;
  last_entry_status?: string;
  last_channel_results?: Record<string, string>;
};

export type AlertState = {
  alerts: Record<string, AlertRuleState>;
  updated_at_utc?: string;
};

type FileCacheEntry<T> = {
  mtimeMs: number;
  size: number;
  value: T;
};

type AlertStorageOptions = {
  createDefault?: boolean;
  userId?: string | null;
};

type AlertRuleRow = QueryResultRow & {
  alert_type: string;
  client_rule_id: string;
  created_at: string | Date;
  is_active: boolean;
  payload: unknown;
  scope: string;
  symbol: string | null;
  threshold: string | number | null;
  updated_at: string | Date;
};

type AlertStateRow = QueryResultRow & {
  last_sent_at: string | Date | null;
  last_skipped_at: string | Date | null;
  payload: unknown;
  rule_client_id: string | null;
  state_key: string;
  symbol: string | null;
  updated_at: string | Date;
};

type DefaultSeedRow = QueryResultRow & {
  defaults_seeded: boolean;
};

type QueryExecutor = Pick<PoolClient, "query">;

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "global_entry_ready",
    scope: "global",
    type: "entry_ready",
    min_score: 70,
    min_rating: "ACTIONABLE",
    allowed_actions: ["STRONG BUY", "BUY"],
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 720,
    entry_filter: "good_or_wait",
    min_risk_reward: 1.5,
    max_alerts_per_run: 5,
    source: "system",
  },
  {
    id: "global_top_signals",
    scope: "global",
    type: "score_above",
    threshold: 80,
    min_rating: "TOP",
    allowed_actions: ["STRONG BUY", "BUY"],
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 720,
    entry_filter: "avoid_overextended",
    min_risk_reward: 1.5,
    max_alerts_per_run: 5,
    source: "system",
  },
  {
    id: "watchlist_buy_zone",
    scope: "watchlist",
    type: "buy_zone_hit",
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 360,
    entry_filter: "any",
    source: "system",
  },
  {
    id: "watchlist_stop_loss",
    scope: "watchlist",
    type: "stop_loss_broken",
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 1440,
    entry_filter: "any",
    source: "system",
  },
  {
    id: "watchlist_take_profit",
    scope: "watchlist",
    type: "take_profit_hit",
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 720,
    entry_filter: "any",
    source: "system",
  },
  {
    id: "watchlist_action_changed",
    scope: "watchlist",
    type: "action_changed",
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 720,
    entry_filter: "any",
    source: "system",
  },
  {
    id: "watchlist_score_spike",
    scope: "watchlist",
    type: "score_changed_by",
    threshold: 2,
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 720,
    entry_filter: "good_or_wait",
    source: "system",
  },
];

export async function ensureDefaultAlertRules(options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  if (!userId) return;
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const settings = await client.query<DefaultSeedRow>(
      `
        INSERT INTO alert_user_settings (user_id, defaults_seeded, created_at, updated_at)
        VALUES ($1, false, now(), now())
        ON CONFLICT (user_id) DO NOTHING
        RETURNING defaults_seeded
      `,
      [userId],
    );
    const row = settings.rows[0] ?? (await client.query<DefaultSeedRow>("SELECT defaults_seeded FROM alert_user_settings WHERE user_id = $1 FOR UPDATE", [userId])).rows[0];
    if (!row?.defaults_seeded) {
      for (const rule of DEFAULT_RULES) {
        await upsertAlertRule(client, userId, sanitizeAlertRule(rule));
      }
      await client.query("UPDATE alert_user_settings SET defaults_seeded = true, updated_at = now() WHERE user_id = $1", [userId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function normalizeSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
}

function normalizeId(value: unknown, fallback: string) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function isAlertType(value: string): value is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(value);
}

function isAlertChannel(value: string): value is AlertChannel {
  return (ALERT_CHANNELS as readonly string[]).includes(value);
}

function isEntryFilter(value: string): value is EntryFilter {
  return (ENTRY_FILTERS as readonly string[]).includes(value);
}

function isAlertScope(value: string): value is AlertScope {
  return (ALERT_SCOPES as readonly string[]).includes(value);
}

function needsThreshold(type: AlertType) {
  return ["price_above", "price_below", "score_above", "score_below"].includes(type);
}

function defaultEntryFilter(type: AlertType): EntryFilter {
  if (type === "score_above") return "avoid_overextended";
  if (type === "entry_ready") return "good_or_wait";
  if (type === "stop_loss_broken" || type === "take_profit_hit") return "any";
  return "any";
}

export function sanitizeAlertRule(input: Record<string, unknown>, existing?: AlertRule): AlertRule {
  const now = new Date().toISOString();
  const typeInput = String(input.type ?? existing?.type ?? "").trim().toLowerCase();
  if (!isAlertType(typeInput)) {
    throw new Error("Invalid alert type.");
  }
  const scopeInput = String(input.scope ?? existing?.scope ?? (input.symbol ?? existing?.symbol ? "symbol" : "global")).trim().toLowerCase();
  const scope = isAlertScope(scopeInput) ? scopeInput : "symbol";

  const rawChannels = Array.isArray(input.channels) ? input.channels : existing?.channels ?? ["telegram"];
  const channels = Array.from(new Set(rawChannels.map((channel) => String(channel).toLowerCase()).filter(isAlertChannel)));
  if (!channels.length) {
    throw new Error("At least one valid channel is required.");
  }

  const symbol = normalizeSymbol(input.symbol ?? existing?.symbol ?? "");
  if (scope === "symbol" && !symbol) {
    throw new Error("Symbol is required for this alert type.");
  }

  const rawThreshold = input.threshold ?? existing?.threshold;
  const threshold = rawThreshold === undefined || rawThreshold === null || rawThreshold === "" ? undefined : Number(rawThreshold);
  if (needsThreshold(typeInput) && !Number.isFinite(threshold)) {
    throw new Error("A numeric threshold is required for this alert type.");
  }
  const rawMinScore = input.min_score ?? existing?.min_score;
  const minScore = rawMinScore === undefined || rawMinScore === null || rawMinScore === "" ? undefined : Number(rawMinScore);
  const rawMinRiskReward = input.min_risk_reward ?? existing?.min_risk_reward;
  const minRiskReward = rawMinRiskReward === undefined || rawMinRiskReward === null || rawMinRiskReward === "" ? undefined : Number(rawMinRiskReward);
  const rawMaxAlerts = input.max_alerts_per_run ?? existing?.max_alerts_per_run;
  const maxAlertsPerRun = rawMaxAlerts === undefined || rawMaxAlerts === null || rawMaxAlerts === "" ? undefined : Number(rawMaxAlerts);
  const normalizedMaxAlerts = Number.isFinite(maxAlertsPerRun) ? Math.max(1, Math.round(maxAlertsPerRun as number)) : undefined;
  const minRating = String(input.min_rating ?? existing?.min_rating ?? "").trim().toUpperCase() || undefined;
  const rawAllowedActions = Array.isArray(input.allowed_actions) ? input.allowed_actions : existing?.allowed_actions ?? [];
  const allowedActions = Array.from(new Set(rawAllowedActions.map((action) => String(action).trim().toUpperCase()).filter(Boolean)));

  const fallbackId = normalizeId(`${scope}_${symbol || "all"}_${typeInput}_${Date.now()}`, `alert_${Date.now()}`);
  const cooldown = Number(input.cooldown_minutes ?? existing?.cooldown_minutes ?? 1440);
  const sourceInput = String(input.source ?? existing?.source ?? (needsThreshold(typeInput) ? "user" : "system")).toLowerCase();
  const entryFilterInput = String(input.entry_filter ?? existing?.entry_filter ?? defaultEntryFilter(typeInput)).toLowerCase();

  return {
    id: normalizeId(input.id ?? existing?.id, fallbackId),
    scope,
    symbol: scope === "symbol" ? symbol : undefined,
    type: typeInput,
    threshold: Number.isFinite(threshold) ? threshold : undefined,
    min_score: Number.isFinite(minScore) ? minScore : undefined,
    min_rating: minRating,
    allowed_actions: allowedActions.length ? allowedActions : undefined,
    min_risk_reward: Number.isFinite(minRiskReward) ? minRiskReward : undefined,
    max_alerts_per_run: normalizedMaxAlerts,
    channels,
    enabled: Boolean(input.enabled ?? existing?.enabled ?? true),
    cooldown_minutes: Number.isFinite(cooldown) ? Math.max(0, Math.round(cooldown)) : 1440,
    entry_filter: isEntryFilter(entryFilterInput) ? entryFilterInput : defaultEntryFilter(typeInput),
    source: sourceInput === "system" ? "system" : "user",
    created_at_utc: existing?.created_at_utc ?? now,
    updated_at_utc: now,
  };
}

export async function readAlertRules(options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  if (!userId) return [];
  if (options.createDefault !== false) await ensureDefaultAlertRules({ userId });
  const result = await dbQuery<AlertRuleRow>(
    `
      SELECT client_rule_id, scope, symbol, alert_type, threshold, payload, is_active, created_at::text, updated_at::text
      FROM alert_rules
      WHERE user_id = $1
      ORDER BY created_at ASC, client_rule_id ASC
    `,
    [userId],
  );
  return result.rows.map(alertRuleFromRow).filter((rule): rule is AlertRule => Boolean(rule));
}

export async function writeAlertRules(rules: AlertRule[], options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  if (!userId) throw new Error("Authenticated user is required for alert rules.");
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM alert_rules WHERE user_id = $1", [userId]);
    for (const rule of rules) {
      await upsertAlertRule(client, userId, sanitizeAlertRule(rule));
    }
    await client.query(
      `
        INSERT INTO alert_user_settings (user_id, defaults_seeded, created_at, updated_at)
        VALUES ($1, true, now(), now())
        ON CONFLICT (user_id) DO UPDATE SET defaults_seeded = true, updated_at = now()
      `,
      [userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function readAlertState(options: AlertStorageOptions = {}): Promise<AlertState> {
  const userId = await resolveAlertUserId(options);
  if (!userId) return { alerts: {} };
  const result = await dbQuery<AlertStateRow>(
    `
      SELECT state_key, rule_client_id, symbol, payload, last_sent_at::text, last_skipped_at::text, updated_at::text
      FROM alert_rule_state
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `,
    [userId],
  );
  const alerts = Object.fromEntries(result.rows.map((row) => [row.state_key, alertStateFromRow(row)]));
  return { alerts, updated_at_utc: result.rows[0] ? isoText(result.rows[0].updated_at) : undefined };
}

export async function writeAlertState(state: AlertState, options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  if (!userId) throw new Error("Authenticated user is required for alert state.");
  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM alert_rule_state WHERE user_id = $1", [userId]);
    for (const [stateKey, entry] of Object.entries(state.alerts)) {
      await upsertAlertState(client, userId, stateKey, entry);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getAlertOverview(options: AlertStorageOptions & { stateLimit?: number } = {}) {
  const userId = await resolveAlertUserId(options);
  const createDefault = options.createDefault ?? Boolean(userId);
  const [rules, state] = await Promise.all([readAlertRules({ userId, createDefault }), readAlertState({ userId })]);
  const sentTimes = Object.values(state.alerts)
    .map((entry) => entry.last_sent_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  const stateLimit = options.stateLimit ?? 300;
  const compactStateEntries = Object.entries(state.alerts)
    .sort(([, left], [, right]) => String(right.last_sent_at ?? right.last_skipped_at ?? "").localeCompare(String(left.last_sent_at ?? left.last_skipped_at ?? "")))
    .slice(0, stateLimit);
  return {
    rules,
    state: { ...state, alerts: Object.fromEntries(compactStateEntries) },
    activeCount: rules.filter((rule) => rule.enabled).length,
    lastSentAt: sentTimes.length ? sentTimes[sentTimes.length - 1] : null,
  };
}

async function resolveAlertUserId(options: AlertStorageOptions): Promise<string | null> {
  if (Object.prototype.hasOwnProperty.call(options, "userId")) return options.userId ?? null;
  const user = await getCurrentUser().catch(() => null);
  return user?.id ?? null;
}

async function upsertAlertRule(executor: QueryExecutor, userId: string, rule: AlertRule): Promise<void> {
  await executor.query(
    `
      INSERT INTO alert_rules (
        user_id,
        client_rule_id,
        scope,
        symbol,
        alert_type,
        condition_operator,
        threshold,
        payload,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NULL, $6, $7::jsonb, $8, COALESCE($9::timestamptz, now()), now())
      ON CONFLICT (user_id, client_rule_id)
      DO UPDATE SET
        scope = EXCLUDED.scope,
        symbol = EXCLUDED.symbol,
        alert_type = EXCLUDED.alert_type,
        condition_operator = EXCLUDED.condition_operator,
        threshold = EXCLUDED.threshold,
        payload = EXCLUDED.payload,
        is_active = EXCLUDED.is_active,
        updated_at = now()
    `,
    [
      userId,
      rule.id,
      rule.scope,
      rule.symbol ?? null,
      rule.type,
      rule.threshold ?? null,
      JSON.stringify(alertRulePayload(rule)),
      rule.enabled,
      rule.created_at_utc ?? null,
    ],
  );
}

async function upsertAlertState(executor: QueryExecutor, userId: string, stateKey: string, entry: AlertRuleState): Promise<void> {
  await executor.query(
    `
      INSERT INTO alert_rule_state (
        user_id,
        state_key,
        rule_client_id,
        symbol,
        payload,
        last_sent_at,
        last_skipped_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, now(), now())
      ON CONFLICT (user_id, state_key)
      DO UPDATE SET
        rule_client_id = EXCLUDED.rule_client_id,
        symbol = EXCLUDED.symbol,
        payload = EXCLUDED.payload,
        last_sent_at = EXCLUDED.last_sent_at,
        last_skipped_at = EXCLUDED.last_skipped_at,
        updated_at = now()
    `,
    [
      userId,
      stateKey,
      entry.alert_id ?? null,
      entry.symbol ?? null,
      JSON.stringify(entry),
      dateOrNull(entry.last_sent_at),
      dateOrNull(entry.last_skipped_at),
    ],
  );
}

function alertRuleFromRow(row: AlertRuleRow): AlertRule | null {
  const payload = recordFromJson(row.payload);
  try {
    const rule = sanitizeAlertRule({
      ...payload,
      id: row.client_rule_id,
      scope: row.scope,
      symbol: row.symbol ?? undefined,
      type: row.alert_type,
      threshold: nullableNumber(row.threshold),
      enabled: row.is_active,
    });
    return {
      ...rule,
      created_at_utc: isoText(row.created_at),
      updated_at_utc: isoText(row.updated_at),
    };
  } catch {
    return null;
  }
}

function alertStateFromRow(row: AlertStateRow): AlertRuleState {
  const payload = recordFromJson(row.payload);
  return {
    ...payload,
    alert_id: textOrUndefined(payload.alert_id) ?? row.rule_client_id ?? undefined,
    last_sent_at: isoText(row.last_sent_at) ?? textOrUndefined(payload.last_sent_at),
    last_skipped_at: isoText(row.last_skipped_at) ?? textOrUndefined(payload.last_skipped_at),
    symbol: textOrUndefined(payload.symbol) ?? row.symbol ?? undefined,
  };
}

function recordFromJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function nullableNumber(value: string | number | null): number | undefined {
  if (value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isoText(value: string | Date | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function textOrUndefined(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}
