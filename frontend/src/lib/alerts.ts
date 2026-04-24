import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
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

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "nvda_buy_zone",
    scope: "symbol",
    symbol: "NVDA",
    type: "buy_zone_hit",
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 720,
    entry_filter: "any",
    source: "system",
  },
  {
    id: "avgo_price_above_430",
    scope: "symbol",
    symbol: "AVGO",
    type: "price_above",
    threshold: 430,
    channels: ["telegram", "email"],
    enabled: true,
    cooldown_minutes: 1440,
    entry_filter: "any",
    source: "user",
  },
  {
    id: "stop_broken",
    scope: "symbol",
    symbol: "MSFT",
    type: "stop_loss_broken",
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 1440,
    entry_filter: "any",
    source: "system",
  },
  {
    id: "score_above_75",
    scope: "symbol",
    symbol: "TSM",
    type: "score_above",
    threshold: 75,
    channels: ["telegram"],
    enabled: true,
    cooldown_minutes: 1440,
    entry_filter: "avoid_overextended",
    source: "user",
  },
];

function alertsDir() {
  return path.join(scannerOutputDir(), "alerts");
}

export function alertRulesPath() {
  return path.join(alertsDir(), "alert_rules.json");
}

export function alertStatePath() {
  return path.join(alertsDir(), "alert_state.json");
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
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await fileExists(filePath))) return fallback;
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function ensureAlertRulesFile() {
  const filePath = alertRulesPath();
  if (!(await fileExists(filePath))) {
    await writeJsonAtomic(filePath, DEFAULT_RULES);
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
    channels,
    enabled: Boolean(input.enabled ?? existing?.enabled ?? true),
    cooldown_minutes: Number.isFinite(cooldown) ? Math.max(0, Math.round(cooldown)) : 1440,
    entry_filter: isEntryFilter(entryFilterInput) ? entryFilterInput : defaultEntryFilter(typeInput),
    source: sourceInput === "system" ? "system" : "user",
    created_at_utc: existing?.created_at_utc ?? now,
    updated_at_utc: now,
  };
}

export async function readAlertRules() {
  await ensureAlertRulesFile();
  const payload = await readJson<unknown>(alertRulesPath(), []);
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

export async function writeAlertRules(rules: AlertRule[]) {
  await writeJsonAtomic(alertRulesPath(), rules);
}

export async function readAlertState(): Promise<AlertState> {
  const state = await readJson<AlertState>(alertStatePath(), { alerts: {} });
  if (!state || typeof state !== "object" || !state.alerts || typeof state.alerts !== "object") {
    return { alerts: {} };
  }
  return state;
}

export async function getAlertOverview() {
  const [rules, state] = await Promise.all([readAlertRules(), readAlertState()]);
  const sentTimes = Object.values(state.alerts)
    .map((entry) => entry.last_sent_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    rules,
    state,
    activeCount: rules.filter((rule) => rule.enabled).length,
    lastSentAt: sentTimes.length ? sentTimes[sentTimes.length - 1] : null,
    rulesPath: alertRulesPath(),
    statePath: alertStatePath(),
  };
}
