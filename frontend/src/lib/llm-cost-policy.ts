import { createHash } from "node:crypto";

export type LlmBudgetCaps = {
  globalDailyUsd: number;
  routeDailyUsd: number;
  surfaceDailyUsd: number;
  userDailyUsd: number;
};

export type LlmCostEstimate = {
  estimatedCostUsd: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

const DEFAULT_INPUT_USD_PER_1M = 2;
const DEFAULT_OUTPUT_USD_PER_1M = 10;
const DEFAULT_GLOBAL_DAILY_USD = 25;
const DEFAULT_ROUTE_DAILY_USD = 8;
const DEFAULT_SURFACE_DAILY_USD = 10;
const DEFAULT_USER_DAILY_USD = 1.5;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 12;

export function llmPayloadHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function llmCacheKey(input: { model: string; promptHash: string; surface: string; version: string }): string {
  return llmPayloadHash({
    model: input.model.trim(),
    promptHash: input.promptHash,
    surface: cleanBudgetKey(input.surface),
    version: input.version,
  });
}

export function estimateLlmTokensFromText(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function estimateLlmTokensFromPayload(value: unknown): number {
  return estimateLlmTokensFromText(stableJson(value));
}

export function estimateLlmCost(input: {
  inputTokens: number;
  outputTokens: number;
  inputUsdPer1m?: number;
  outputUsdPer1m?: number;
}): number {
  const inputRate = nonNegativeFinite(input.inputUsdPer1m, DEFAULT_INPUT_USD_PER_1M);
  const outputRate = nonNegativeFinite(input.outputUsdPer1m, DEFAULT_OUTPUT_USD_PER_1M);
  const inputTokens = Math.max(0, Math.trunc(input.inputTokens));
  const outputTokens = Math.max(0, Math.trunc(input.outputTokens));
  return roundUsd((inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate);
}

export function estimateLlmCallCost(input: { maxOutputTokens?: number; payload: unknown }): LlmCostEstimate {
  const estimatedInputTokens = estimateLlmTokensFromPayload(input.payload);
  const estimatedOutputTokens = Math.max(1, Math.trunc(input.maxOutputTokens ?? 900));
  return {
    estimatedCostUsd: estimateLlmCost({
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      inputUsdPer1m: envNumber("TRADEVETO_LLM_EST_INPUT_USD_PER_1M", DEFAULT_INPUT_USD_PER_1M),
      outputUsdPer1m: envNumber("TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M", DEFAULT_OUTPUT_USD_PER_1M),
    }),
    estimatedInputTokens,
    estimatedOutputTokens,
  };
}

export function actualOrEstimatedLlmCost(input: {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  usageInputTokens?: number | null;
  usageOutputTokens?: number | null;
}): LlmCostEstimate {
  const estimatedInputTokens = safeTokenCount(input.usageInputTokens ?? input.estimatedInputTokens);
  const estimatedOutputTokens = safeTokenCount(input.usageOutputTokens ?? input.estimatedOutputTokens);
  return {
    estimatedCostUsd: estimateLlmCost({
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      inputUsdPer1m: envNumber("TRADEVETO_LLM_EST_INPUT_USD_PER_1M", DEFAULT_INPUT_USD_PER_1M),
      outputUsdPer1m: envNumber("TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M", DEFAULT_OUTPUT_USD_PER_1M),
    }),
    estimatedInputTokens,
    estimatedOutputTokens,
  };
}

export function llmBudgetCapsFromEnv(): LlmBudgetCaps {
  return {
    globalDailyUsd: envNumber("TRADEVETO_LLM_DAILY_USD_BUDGET", DEFAULT_GLOBAL_DAILY_USD),
    routeDailyUsd: envNumber("TRADEVETO_LLM_ROUTE_DAILY_USD_BUDGET", DEFAULT_ROUTE_DAILY_USD),
    surfaceDailyUsd: envNumber("TRADEVETO_LLM_SURFACE_DAILY_USD_BUDGET", DEFAULT_SURFACE_DAILY_USD),
    userDailyUsd: envNumber("TRADEVETO_LLM_USER_DAILY_USD_BUDGET", DEFAULT_USER_DAILY_USD),
  };
}

export function llmBudgetEnforcementEnabled(): boolean {
  const value = String(process.env.TRADEVETO_LLM_BUDGET_ENFORCEMENT ?? "true").trim().toLowerCase();
  return !["0", "false", "no", "off", "disabled"].includes(value);
}

export function llmResponseCacheTtlSeconds(surface?: string): number {
  const surfaceKey = cleanBudgetKey(surface ?? "");
  const overrideName = surfaceKey ? `TRADEVETO_LLM_${surfaceKey.toUpperCase()}_CACHE_TTL_SECONDS` : "";
  const override = overrideName ? process.env[overrideName] : undefined;
  return Math.max(60, Math.min(7 * 24 * 60 * 60, Math.trunc(envNumberFromValue(override, envNumber("TRADEVETO_LLM_RESPONSE_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS)))));
}

export function configuredLlmFallbackModel(): string | null {
  const value = String(process.env.TRADEVETO_LLM_FALLBACK_MODEL ?? "").trim();
  return value || null;
}

export function cleanBudgetKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_./-]+/g, "_").slice(0, 160) || "unknown";
}

export function extractOpenAiUsage(payload: unknown): { inputTokens: number | null; outputTokens: number | null } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { inputTokens: null, outputTokens: null };
  }
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return { inputTokens: null, outputTokens: null };
  }
  const record = usage as Record<string, unknown>;
  const inputTokens = tokenFromUnknown(record.input_tokens ?? record.prompt_tokens);
  const outputTokens = tokenFromUnknown(record.output_tokens ?? record.completion_tokens);
  return { inputTokens, outputTokens };
}

function tokenFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  }
  return null;
}

function stableJson(value: unknown): string {
  return JSON.stringify(normalizeForHash(value));
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().reduce<Record<string, unknown>>((accumulator, key) => {
    accumulator[key] = normalizeForHash(record[key]);
    return accumulator;
  }, {});
}

function envNumber(name: string, fallback: number): number {
  return envNumberFromValue(process.env[name], fallback);
}

function envNumberFromValue(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeFinite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function safeTokenCount(value: number | null | undefined): number {
  return value !== null && value !== undefined && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
