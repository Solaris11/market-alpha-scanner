import assert from "node:assert/strict";
import test from "node:test";
import {
  actualOrEstimatedLlmCost,
  cleanBudgetKey,
  estimateLlmCallCost,
  extractOpenAiUsage,
  llmBudgetCapsFromEnv,
  llmCacheKey,
  llmPayloadHash,
} from "./llm-cost-policy";

test("LLM payload hashing is stable across object key order", () => {
  const left = llmPayloadHash({ b: 2, a: { d: 4, c: 3 } });
  const right = llmPayloadHash({ a: { c: 3, d: 4 }, b: 2 });

  assert.equal(left, right);
});

test("LLM cache key includes surface, version, model, and prompt hash", () => {
  const promptHash = llmPayloadHash({ symbol: "AMD", score: 72 });
  const key = llmCacheKey({ model: "gpt-5.5", promptHash, surface: "research_copilot", version: "v1" });
  const differentVersion = llmCacheKey({ model: "gpt-5.5", promptHash, surface: "research_copilot", version: "v2" });

  assert.notEqual(key, differentVersion);
  assert.equal(key.length, 64);
});

test("LLM cost estimates are bounded and configurable", () => {
  const originalInput = process.env.TRADEVETO_LLM_EST_INPUT_USD_PER_1M;
  const originalOutput = process.env.TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M;
  process.env.TRADEVETO_LLM_EST_INPUT_USD_PER_1M = "1";
  process.env.TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M = "5";
  try {
    const estimate = estimateLlmCallCost({ maxOutputTokens: 1000, payload: { text: "x".repeat(4000) } });
    assert.ok(estimate.estimatedInputTokens >= 900);
    assert.equal(estimate.estimatedOutputTokens, 1000);
    assert.ok(estimate.estimatedCostUsd > 0);
  } finally {
    restoreEnv("TRADEVETO_LLM_EST_INPUT_USD_PER_1M", originalInput);
    restoreEnv("TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M", originalOutput);
  }
});

test("LLM usage extraction accepts Responses API usage payload", () => {
  const usage = extractOpenAiUsage({ usage: { input_tokens: 123, output_tokens: "45" } });

  assert.equal(usage.inputTokens, 123);
  assert.equal(usage.outputTokens, 45);
});

test("LLM actual cost prefers provider usage over preflight estimate", () => {
  const originalInput = process.env.TRADEVETO_LLM_EST_INPUT_USD_PER_1M;
  const originalOutput = process.env.TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M;
  process.env.TRADEVETO_LLM_EST_INPUT_USD_PER_1M = "1";
  process.env.TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M = "1";
  try {
    const actual = actualOrEstimatedLlmCost({
      estimatedInputTokens: 10_000,
      estimatedOutputTokens: 10_000,
      usageInputTokens: 500,
      usageOutputTokens: 250,
    });

    assert.equal(actual.estimatedInputTokens, 500);
    assert.equal(actual.estimatedOutputTokens, 250);
    assert.equal(actual.estimatedCostUsd, 0.00075);
  } finally {
    restoreEnv("TRADEVETO_LLM_EST_INPUT_USD_PER_1M", originalInput);
    restoreEnv("TRADEVETO_LLM_EST_OUTPUT_USD_PER_1M", originalOutput);
  }
});

test("LLM budget caps read operator overrides", () => {
  const original = process.env.TRADEVETO_LLM_USER_DAILY_USD_BUDGET;
  process.env.TRADEVETO_LLM_USER_DAILY_USD_BUDGET = "0.25";
  try {
    assert.equal(llmBudgetCapsFromEnv().userDailyUsd, 0.25);
  } finally {
    restoreEnv("TRADEVETO_LLM_USER_DAILY_USD_BUDGET", original);
  }
});

test("LLM budget keys remove unsafe characters", () => {
  assert.equal(cleanBudgetKey("Research Copilot / $$$"), "research_copilot_/_");
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
