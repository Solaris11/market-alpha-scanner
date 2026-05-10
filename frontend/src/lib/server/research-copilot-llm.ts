import "server-only";

import { configuredLlmFallbackModel, estimateLlmCallCost, extractOpenAiUsage } from "@/lib/llm-cost-policy";
import {
  checkLlmBudget,
  llmCacheIdentity,
  readLlmResponseCache,
  recordLlmUsage,
  writeLlmResponseCache,
} from "@/lib/server/llm-cost-control";
import { evaluateLlmGrounding, groundingPacketFromStructuredData } from "@/lib/trading/llm-grounding";
import {
  answerResearchCopilotDeterministically,
  type ResearchCopilotAnswer,
  type ResearchCopilotContext,
} from "@/lib/trading/research-copilot";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const FORBIDDEN_LANGUAGE = /\b(buy now|sell now|guaranteed|sure profit|can't lose|cannot lose|will definitely|must buy|must sell)\b/i;
const LLM_SURFACE = "research_copilot";
const LLM_ROUTE = "/api/research/copilot";
const LLM_CACHE_VERSION = "research_copilot_v1";

export async function answerResearchCopilot(context: ResearchCopilotContext, options: { userId?: string | null } = {}): Promise<ResearchCopilotAnswer> {
  if (!llmEnabled()) return answerResearchCopilotDeterministically(context);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = (process.env.TRADEVETO_RESEARCH_COPILOT_LLM_MODEL || process.env.TRADEVETO_EVENT_LLM_MODEL || configuredLlmFallbackModel() || "").trim();
  if (!apiKey || !model) return answerResearchCopilotDeterministically(context);

  const request = requestPayload(model, context);
  const { cacheKey, promptHash } = llmCacheIdentity({ model, payload: request, surface: LLM_SURFACE, version: LLM_CACHE_VERSION });
  const maxOutputTokens = context.mode === "deep_dive" ? 1400 : 900;
  const estimate = estimateLlmCallCost({ maxOutputTokens, payload: request });
  const cached = await readLlmResponseCache<unknown>({ cacheKey, surface: LLM_SURFACE });
  if (cached) {
    const validated = validateCopilotAnswer(cached, context);
    if (validated) {
      await recordLlmUsage({
        cacheStatus: "hit",
        estimatedInputTokens: estimate.estimatedInputTokens,
        estimatedOutputTokens: estimate.estimatedOutputTokens,
        model,
        payload: request,
        promptHash,
        route: LLM_ROUTE,
        status: "cache_hit",
        surface: LLM_SURFACE,
        userId: options.userId,
      });
      return validated;
    }
  }

  const budget = await checkLlmBudget({ maxOutputTokens, payload: request, route: LLM_ROUTE, surface: LLM_SURFACE, userId: options.userId });
  if (!budget.allowed) {
    await recordLlmUsage({
      cacheStatus: "bypass",
      estimatedInputTokens: budget.estimatedInputTokens,
      estimatedOutputTokens: budget.estimatedOutputTokens,
      model,
      payload: request,
      promptHash,
      route: LLM_ROUTE,
      status: "blocked",
      surface: LLM_SURFACE,
      userId: options.userId,
      errorCode: budget.reason,
    });
    return answerResearchCopilotDeterministically(context);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  const startedAt = Date.now();
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify(request),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "TradeVetoResearchCopilot/1.0 (+https://tradeveto.com)",
      },
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) {
      await recordLlmUsage({
        cacheStatus: "miss",
        durationMs: Date.now() - startedAt,
        estimatedInputTokens: budget.estimatedInputTokens,
        estimatedOutputTokens: budget.estimatedOutputTokens,
        model,
        payload: request,
        promptHash,
        route: LLM_ROUTE,
        status: "failed",
        surface: LLM_SURFACE,
        userId: options.userId,
        errorCode: `http_${response.status}`,
      });
      return answerResearchCopilotDeterministically(context);
    }
    const payload = await response.json() as unknown;
    const usage = extractOpenAiUsage(payload);
    const text = extractOutputText(payload);
    if (!text) {
      await recordLlmUsage({
        cacheStatus: "miss",
        durationMs: Date.now() - startedAt,
        estimatedInputTokens: budget.estimatedInputTokens,
        estimatedOutputTokens: budget.estimatedOutputTokens,
        model,
        payload: request,
        promptHash,
        route: LLM_ROUTE,
        status: "validation_failed",
        surface: LLM_SURFACE,
        usageInputTokens: usage.inputTokens,
        usageOutputTokens: usage.outputTokens,
        userId: options.userId,
        errorCode: "empty_output",
      });
      return answerResearchCopilotDeterministically(context);
    }
    const parsed = parseCopilotJson(text);
    const validated = validateCopilotAnswer(parsed, context);
    if (!validated) {
      await recordLlmUsage({
        cacheStatus: "miss",
        durationMs: Date.now() - startedAt,
        estimatedInputTokens: budget.estimatedInputTokens,
        estimatedOutputTokens: budget.estimatedOutputTokens,
        model,
        payload: request,
        promptHash,
        route: LLM_ROUTE,
        status: "validation_failed",
        surface: LLM_SURFACE,
        usageInputTokens: usage.inputTokens,
        usageOutputTokens: usage.outputTokens,
        userId: options.userId,
        errorCode: "schema_or_grounding",
      });
      return answerResearchCopilotDeterministically(context);
    }
    const cacheStatus = await writeLlmResponseCache({ cacheKey, model, responseJson: parsed, surface: LLM_SURFACE });
    await recordLlmUsage({
      cacheStatus: cacheStatus === "ok" ? "miss" : "write_failed",
      durationMs: Date.now() - startedAt,
      estimatedInputTokens: budget.estimatedInputTokens,
      estimatedOutputTokens: budget.estimatedOutputTokens,
      model,
      payload: request,
      promptHash,
      route: LLM_ROUTE,
      status: "success",
      surface: LLM_SURFACE,
      usageInputTokens: usage.inputTokens,
      usageOutputTokens: usage.outputTokens,
      userId: options.userId,
    });
    return validated;
  } catch {
    await recordLlmUsage({
      cacheStatus: "miss",
      durationMs: Date.now() - startedAt,
      estimatedInputTokens: budget.estimatedInputTokens,
      estimatedOutputTokens: budget.estimatedOutputTokens,
      model,
      payload: request,
      promptHash,
      route: LLM_ROUTE,
      status: "failed",
      surface: LLM_SURFACE,
      userId: options.userId,
      errorCode: "fetch_error",
    });
    return answerResearchCopilotDeterministically(context);
  } finally {
    clearTimeout(timeout);
  }
}

function requestPayload(model: string, context: ResearchCopilotContext): Record<string, unknown> {
  return {
    model,
    input: [
      {
        role: "system",
        content: [
          "You are TradeVeto's conversational market research copilot.",
          "Use only the supplied deterministic context packet.",
          "Explain rankings, comparisons, portfolio exposure, replay context, event synthesis, scenarios, market state, fragility, historical analogs, user fit, and what changed.",
          "Citations are attached by the application from the deterministic context; do not invent external links or source names.",
          "Honor context.mode: concise means one short answer with only the strongest evidence; deep_dive means more detail but still no filler.",
          "Do not invent prices, news, events, probabilities, performance, or hidden institutional flows.",
          "Do not override deterministic scores or final TradeVeto decisions.",
          "Do not use buy now or sell now. Avoid direct trade instructions.",
          "Keep the answer concise, specific, and grounded in the supplied symbols and metrics.",
          "If context is limited, say the evidence is limited.",
          "Return strict ASCII JSON only.",
          "The safetyLanguage field must include the exact phrase: Not financial advice.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify(trimContextForLlm(context)),
      },
    ],
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "tradeveto_research_copilot_answer",
        strict: true,
        schema: answerSchema(),
      },
    },
  };
}

function answerSchema(): Record<string, unknown> {
  const stringSchema = { type: "string", minLength: 1, maxLength: 900 };
  const shortString = { type: "string", minLength: 1, maxLength: 360 };
  return {
    additionalProperties: false,
    properties: {
      answer: stringSchema,
      confidenceNote: shortString,
      followUpQuestions: { items: shortString, maxItems: 3, type: "array" },
      keyPoints: { items: shortString, maxItems: 6, minItems: 1, type: "array" },
      safetyLanguage: shortString,
      symbolComparisons: { items: shortString, maxItems: 4, type: "array" },
      unsupportedClaimsDetected: { type: "boolean" },
      whatToWatch: { items: shortString, maxItems: 5, minItems: 1, type: "array" },
    },
    required: ["answer", "confidenceNote", "followUpQuestions", "keyPoints", "safetyLanguage", "symbolComparisons", "unsupportedClaimsDetected", "whatToWatch"],
    type: "object",
  };
}

function validateCopilotAnswer(value: unknown, context: ResearchCopilotContext): ResearchCopilotAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.unsupportedClaimsDetected !== false) return null;
  const answer = safeText(record.answer, 900);
  const confidenceNote = safeText(record.confidenceNote, 360);
  const followUpQuestions = stringArray(record.followUpQuestions, 3, 360);
  const safetyLanguage = safeText(record.safetyLanguage, 360);
  const keyPoints = stringArray(record.keyPoints, 6, 360);
  const symbolComparisons = stringArray(record.symbolComparisons, 4, 360);
  const whatToWatch = stringArray(record.whatToWatch, 5, 360);
  if (!answer || !confidenceNote || !safetyLanguage || !keyPoints.length || !whatToWatch.length) return null;
  if ([answer, confidenceNote, safetyLanguage, ...followUpQuestions, ...keyPoints, ...symbolComparisons, ...whatToWatch].some((text) => FORBIDDEN_LANGUAGE.test(text))) return null;
  if (!safetyLanguage.toLowerCase().includes("not financial advice") && !safetyLanguage.toLowerCase().includes("research")) return null;
  const grounding = evaluateLlmGrounding({
    output: {
      answer,
      confidenceNote,
      followUpQuestions,
      keyPoints,
      safetyLanguage,
      symbolComparisons,
      unsupportedClaimsDetected: record.unsupportedClaimsDetected,
      whatToWatch,
    },
    packet: groundingPacketFromStructuredData(context),
    requiredFields: ["answer", "confidenceNote", "keyPoints", "safetyLanguage", "whatToWatch"],
  });
  if (!grounding.safeForUse) return null;
  return {
    answer,
    citations: context.citations.slice(0, 8),
    confidenceNote,
    followUpQuestions,
    intent: context.intent,
    keyPoints,
    mode: context.mode,
    referencedSymbols: context.symbols.map((symbol) => symbol.symbol),
    safetyLanguage,
    source: "llm",
    symbolComparisons,
    unsupportedClaimsDetected: false,
    whatToWatch,
  };
}

function parseCopilotJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function trimContextForLlm(context: ResearchCopilotContext): ResearchCopilotContext {
  return {
    ...context,
    availableSymbols: context.availableSymbols.slice(0, 160),
    marketState: {
      ...context.marketState,
      alerts: context.marketState.alerts.slice(0, 4),
    },
    symbols: context.symbols.slice(0, 6).map((symbol) => ({
      ...symbol,
      memoryNarrative: symbol.memoryNarrative.slice(0, 3),
      narrativeSummary: symbol.narrativeSummary ? symbol.narrativeSummary.slice(0, 600) : null,
    })),
  };
}

function stringArray(value: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item, maxLength)).filter((item) => item && !FORBIDDEN_LANGUAGE.test(item)).slice(0, limit);
}

function safeText(value: unknown, maxLength: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const chunks: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) continue;
      const text = (chunk as Record<string, unknown>).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("").trim();
}

function llmEnabled(): boolean {
  const value = (process.env.TRADEVETO_RESEARCH_COPILOT_LLM_ENABLED || process.env.TRADEVETO_EVENT_LLM_ENABLED || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function timeoutMs(): number {
  const raw = Number(process.env.TRADEVETO_RESEARCH_COPILOT_LLM_TIMEOUT_SECONDS || process.env.TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS || 8);
  const seconds = Number.isFinite(raw) ? Math.max(2, Math.min(20, raw)) : 8;
  return seconds * 1000;
}
