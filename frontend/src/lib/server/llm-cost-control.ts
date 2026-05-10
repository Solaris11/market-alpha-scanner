import "server-only";

import type { QueryResultRow } from "pg";
import {
  actualOrEstimatedLlmCost,
  cleanBudgetKey,
  estimateLlmCallCost,
  llmBudgetCapsFromEnv,
  llmBudgetEnforcementEnabled,
  llmCacheKey,
  llmPayloadHash,
  llmResponseCacheTtlSeconds,
  type LlmBudgetCaps,
  type LlmCostEstimate,
} from "@/lib/llm-cost-policy";
import { dbQuery } from "./db";

export type LlmUsageStatus = "blocked" | "cache_hit" | "failed" | "success" | "validation_failed";

export type LlmBudgetDecision = LlmCostEstimate & {
  allowed: boolean;
  caps: LlmBudgetCaps;
  reason: string | null;
  warning: string | null;
};

export type LlmBudgetInput = {
  maxOutputTokens?: number;
  payload: unknown;
  route?: string | null;
  surface: string;
  userId?: string | null;
};

export type LlmUsageInput = LlmBudgetInput & {
  cacheStatus: "bypass" | "hit" | "miss" | "write_failed";
  durationMs?: number | null;
  errorCode?: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  model: string;
  promptHash?: string | null;
  status: LlmUsageStatus;
  usageInputTokens?: number | null;
  usageOutputTokens?: number | null;
};

type UsageDailyRow = QueryResultRow & {
  estimated_cost_usd: string | number | null;
  scope: string;
  subject: string;
};

type CacheRow = QueryResultRow & {
  response_json: unknown;
};

type MemoryDaily = {
  blocked: number;
  cacheHits: number;
  costUsd: number;
  day: string;
  failed: number;
  requests: number;
};

type LlmCostGlobal = typeof globalThis & {
  __tradeVetoLlmDaily?: Map<string, MemoryDaily>;
};

export async function checkLlmBudget(input: LlmBudgetInput): Promise<LlmBudgetDecision> {
  const estimate = estimateLlmCallCost({ maxOutputTokens: input.maxOutputTokens, payload: input.payload });
  const caps = llmBudgetCapsFromEnv();
  if (!llmBudgetEnforcementEnabled()) {
    return { ...estimate, allowed: true, caps, reason: null, warning: "Budget enforcement disabled by environment." };
  }

  const subjects = budgetSubjects(input);
  try {
    const result = await dbQuery<UsageDailyRow>(
      `
        SELECT scope, subject, estimated_cost_usd
        FROM llm_usage_daily
        WHERE day = current_date
          AND (scope, subject) IN (
            ('global', 'all'),
            ('surface', $1),
            ('route', $2),
            ('user', $3)
          )
      `,
      [subjects.surface, subjects.route, subjects.user],
    );
    const current = new Map(result.rows.map((row) => [`${row.scope}:${row.subject}`, toNumber(row.estimated_cost_usd)]));
    const exceeded = firstExceededBudget({
      caps,
      currentGlobal: current.get("global:all") ?? 0,
      currentRoute: current.get(`route:${subjects.route}`) ?? 0,
      currentSurface: current.get(`surface:${subjects.surface}`) ?? 0,
      currentUser: current.get(`user:${subjects.user}`) ?? 0,
      nextCost: estimate.estimatedCostUsd,
      userCapApplies: cleanUserId(input.userId) !== null,
    });
    return { ...estimate, allowed: exceeded === null, caps, reason: exceeded, warning: null };
  } catch {
    const exceeded = firstExceededMemoryBudget(input, estimate.estimatedCostUsd, caps);
    return {
      ...estimate,
      allowed: exceeded === null,
      caps,
      reason: exceeded,
      warning: "LLM budget table unavailable; using process-local budget guard.",
    };
  }
}

export async function recordLlmUsage(input: LlmUsageInput): Promise<void> {
  const actual = actualOrEstimatedLlmCost({
    estimatedInputTokens: input.estimatedInputTokens,
    estimatedOutputTokens: input.estimatedOutputTokens,
    usageInputTokens: input.usageInputTokens,
    usageOutputTokens: input.usageOutputTokens,
  });
  const cost = input.status === "cache_hit" || input.status === "blocked" ? 0 : actual.estimatedCostUsd;
  recordMemoryUsage(input, cost);
  try {
    await dbQuery(
      `
        INSERT INTO llm_usage_events (
          user_id,
          surface,
          route,
          model,
          status,
          cache_status,
          prompt_hash,
          estimated_input_tokens,
          estimated_output_tokens,
          usage_input_tokens,
          usage_output_tokens,
          estimated_cost_usd,
          duration_ms,
          error_code,
          created_at
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
      `,
      [
        cleanUserId(input.userId),
        cleanBudgetKey(input.surface),
        cleanRoute(input.route),
        input.model.trim().slice(0, 80),
        input.status,
        input.cacheStatus,
        input.promptHash ?? null,
        input.estimatedInputTokens,
        input.estimatedOutputTokens,
        input.usageInputTokens ?? null,
        input.usageOutputTokens ?? null,
        cost,
        input.durationMs !== null && input.durationMs !== undefined ? Math.max(0, Math.trunc(input.durationMs)) : null,
        input.errorCode ? input.errorCode.slice(0, 80) : null,
      ],
    );
    await upsertDailyUsage(input, actual, cost);
  } catch (error) {
    console.warn("[llm-cost] usage write failed", error instanceof Error ? error.message : error);
  }
}

export async function readLlmResponseCache<T>(input: { cacheKey: string; surface: string }): Promise<T | null> {
  try {
    const result = await dbQuery<CacheRow>(
      `
        SELECT response_json
        FROM llm_response_cache
        WHERE cache_key = $1
          AND expires_at > now()
        LIMIT 1
      `,
      [input.cacheKey],
    );
    const value = result.rows[0]?.response_json;
    return value === undefined ? null : value as T;
  } catch {
    return null;
  }
}

export async function writeLlmResponseCache(input: {
  cacheKey: string;
  model: string;
  responseJson: unknown;
  surface: string;
  ttlSeconds?: number;
}): Promise<"ok" | "write_failed"> {
  const ttlSeconds = Math.max(60, Math.trunc(input.ttlSeconds ?? llmResponseCacheTtlSeconds(input.surface)));
  try {
    await dbQuery(
      `
        INSERT INTO llm_response_cache (cache_key, surface, model, response_json, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now() + ($5::integer * interval '1 second'), now(), now())
        ON CONFLICT (cache_key)
        DO UPDATE SET
          surface = EXCLUDED.surface,
          model = EXCLUDED.model,
          response_json = EXCLUDED.response_json,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
      `,
      [input.cacheKey, cleanBudgetKey(input.surface), input.model.trim().slice(0, 80), JSON.stringify(input.responseJson), ttlSeconds],
    );
    return "ok";
  } catch {
    return "write_failed";
  }
}

export function llmCacheIdentity(input: { model: string; payload: unknown; surface: string; version: string }): { cacheKey: string; promptHash: string } {
  const promptHash = llmPayloadHash(input.payload);
  return {
    cacheKey: llmCacheKey({ model: input.model, promptHash, surface: input.surface, version: input.version }),
    promptHash,
  };
}

async function upsertDailyUsage(input: LlmUsageInput, actual: LlmCostEstimate, cost: number): Promise<void> {
  const subjects = budgetSubjects(input);
  const scopes = [
    { scope: "global", subject: "all" },
    { scope: "surface", subject: subjects.surface },
    { scope: "route", subject: subjects.route },
    { scope: "user", subject: subjects.user },
  ];
  for (const item of scopes) {
    await dbQuery(
      `
        INSERT INTO llm_usage_daily (
          day,
          scope,
          subject,
          request_count,
          cache_hit_count,
          blocked_count,
          failed_count,
          estimated_input_tokens,
          estimated_output_tokens,
          estimated_cost_usd,
          last_used_at,
          updated_at
        )
        VALUES (
          current_date,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          now(),
          now()
        )
        ON CONFLICT (day, scope, subject)
        DO UPDATE SET
          request_count = llm_usage_daily.request_count + EXCLUDED.request_count,
          cache_hit_count = llm_usage_daily.cache_hit_count + EXCLUDED.cache_hit_count,
          blocked_count = llm_usage_daily.blocked_count + EXCLUDED.blocked_count,
          failed_count = llm_usage_daily.failed_count + EXCLUDED.failed_count,
          estimated_input_tokens = llm_usage_daily.estimated_input_tokens + EXCLUDED.estimated_input_tokens,
          estimated_output_tokens = llm_usage_daily.estimated_output_tokens + EXCLUDED.estimated_output_tokens,
          estimated_cost_usd = llm_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
          last_used_at = now(),
          updated_at = now()
      `,
      [
        item.scope,
        item.subject,
        input.status === "cache_hit" ? 0 : 1,
        input.status === "cache_hit" ? 1 : 0,
        input.status === "blocked" ? 1 : 0,
        input.status === "failed" || input.status === "validation_failed" ? 1 : 0,
        actual.estimatedInputTokens,
        actual.estimatedOutputTokens,
        cost,
      ],
    );
  }
}

function firstExceededBudget(input: {
  caps: LlmBudgetCaps;
  currentGlobal: number;
  currentRoute: number;
  currentSurface: number;
  currentUser: number;
  nextCost: number;
  userCapApplies: boolean;
}): string | null {
  if (input.currentGlobal + input.nextCost > input.caps.globalDailyUsd) return "global_daily_budget_exceeded";
  if (input.currentRoute + input.nextCost > input.caps.routeDailyUsd) return "route_daily_budget_exceeded";
  if (input.currentSurface + input.nextCost > input.caps.surfaceDailyUsd) return "surface_daily_budget_exceeded";
  if (input.userCapApplies && input.currentUser + input.nextCost > input.caps.userDailyUsd) return "user_daily_budget_exceeded";
  return null;
}

function firstExceededMemoryBudget(input: LlmBudgetInput, nextCost: number, caps: LlmBudgetCaps): string | null {
  const subjects = budgetSubjects(input);
  const ledger = memoryLedger();
  const currentGlobal = ledger.get(`global:all`)?.costUsd ?? 0;
  const currentSurface = ledger.get(`surface:${subjects.surface}`)?.costUsd ?? 0;
  const currentRoute = ledger.get(`route:${subjects.route}`)?.costUsd ?? 0;
  const currentUser = ledger.get(`user:${subjects.user}`)?.costUsd ?? 0;
  return firstExceededBudget({ caps, currentGlobal, currentRoute, currentSurface, currentUser, nextCost, userCapApplies: cleanUserId(input.userId) !== null });
}

function recordMemoryUsage(input: LlmUsageInput, costUsd: number): void {
  const subjects = budgetSubjects(input);
  const keys = [`global:all`, `surface:${subjects.surface}`, `route:${subjects.route}`, `user:${subjects.user}`];
  for (const key of keys) {
    const entry = memoryEntry(key);
    entry.requests += input.status === "cache_hit" ? 0 : 1;
    entry.cacheHits += input.status === "cache_hit" ? 1 : 0;
    entry.blocked += input.status === "blocked" ? 1 : 0;
    entry.failed += input.status === "failed" || input.status === "validation_failed" ? 1 : 0;
    entry.costUsd += costUsd;
  }
}

function budgetSubjects(input: Pick<LlmBudgetInput, "route" | "surface" | "userId">): { route: string; surface: string; user: string } {
  return {
    route: cleanRoute(input.route),
    surface: cleanBudgetKey(input.surface),
    user: cleanUserId(input.userId) ?? "anonymous",
  };
}

function cleanRoute(value: string | null | undefined): string {
  return cleanBudgetKey(value ?? "background");
}

function cleanUserId(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function memoryLedger(): Map<string, MemoryDaily> {
  const globalCost = globalThis as LlmCostGlobal;
  if (!globalCost.__tradeVetoLlmDaily) {
    globalCost.__tradeVetoLlmDaily = new Map();
  }
  return globalCost.__tradeVetoLlmDaily;
}

function memoryEntry(key: string): MemoryDaily {
  const today = new Date().toISOString().slice(0, 10);
  const ledger = memoryLedger();
  const existing = ledger.get(key);
  if (existing?.day === today) return existing;
  const created = { blocked: 0, cacheHits: 0, costUsd: 0, day: today, failed: 0, requests: 0 };
  ledger.set(key, created);
  return created;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
