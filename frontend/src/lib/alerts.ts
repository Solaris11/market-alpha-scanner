import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "./server/auth";
import { scannerOutputDir } from "./scanner-data";

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

const cacheRoot = globalThis as typeof globalThis & {
  __marketAlphaAlertJsonCache?: Map<string, FileCacheEntry<unknown>>;
};
const alertJsonCache = cacheRoot.__marketAlphaAlertJsonCache ?? new Map<string, FileCacheEntry<unknown>>();
cacheRoot.__marketAlphaAlertJsonCache = alertJsonCache;

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

function alertsDir(userId?: string | null) {
  if (userId) return path.join(scannerOutputDir(), "alerts", "users", userId);
  return path.join(scannerOutputDir(), "alerts");
}

export function alertRulesPath(userId?: string | null) {
  return path.join(alertsDir(userId), "alert_rules.json");
}

export function alertStatePath(userId?: string | null) {
  return path.join(alertsDir(userId), "alert_state.json");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
  alertJsonCache.delete(filePath);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await fileExists(filePath))) return fallback;
  try {
    const stat = await fs.stat(filePath);
    const cached = alertJsonCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached.value as T;
    }
    const value = JSON.parse(await fs.readFile(filePath, "utf8")) as T;
    alertJsonCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, value });
    return value;
  } catch {
    return fallback;
  }
}

export async function ensureAlertRulesFile(options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  const filePath = alertRulesPath(userId);
  try {
    if (!(await fileExists(filePath))) {
      await writeJsonAtomic(filePath, DEFAULT_RULES);
    }
  } catch (error) {
    console.warn("[alerts] alert rules file is not writable; continuing with an empty rules response.", error);
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
  if (options.createDefault !== false) {
    await ensureAlertRulesFile({ userId });
  }
  const payload = await readJson<unknown>(alertRulesPath(userId), []);
  if (!Array.isArray(payload)) return [];
  const rules: AlertRule[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    try {
      rules.push(sanitizeAlertRule(item as Record<string, unknown>));
    } catch {
      // Ignore malformed rules in the UI response rather than breaking the page.
    }
  }
  return rules;
}

export async function writeAlertRules(rules: AlertRule[], options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  await writeJsonAtomic(alertRulesPath(userId), rules);
}

export async function readAlertState(options: AlertStorageOptions = {}): Promise<AlertState> {
  const userId = await resolveAlertUserId(options);
  const state = await readJson<AlertState>(alertStatePath(userId), { alerts: {} });
  if (!state || typeof state !== "object" || !state.alerts || typeof state.alerts !== "object") {
    return { alerts: {} };
  }
  return state;
}

export async function writeAlertState(state: AlertState, options: AlertStorageOptions = {}) {
  const userId = await resolveAlertUserId(options);
  await writeJsonAtomic(alertStatePath(userId), {
    ...state,
    updated_at_utc: new Date().toISOString(),
  });
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
