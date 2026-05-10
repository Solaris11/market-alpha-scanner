import { Pool, type QueryResultRow } from "pg";
import { loadEnvFiles, safeErrorMessage } from "./monitoring-common";
import { configuredLlmFallbackModel, estimateLlmCallCost, extractOpenAiUsage } from "../src/lib/llm-cost-policy";
import {
  checkLlmBudget,
  llmCacheIdentity,
  readLlmResponseCache,
  recordLlmUsage,
  writeLlmResponseCache,
} from "../src/lib/server/llm-cost-control";
import { createMacroContextResolver } from "../src/lib/trading/macro-regime";
import { buildMarketMemorySummary, scoreBucket, type MarketMemoryCandidate, type MarketMemoryOutcomePoint, type MarketMemorySummary } from "../src/lib/trading/market-memory";
import {
  applyValidatedLlmNarrative,
  buildNarrativeInputPacket,
  buildNarrativeIntelligence,
  narrativeJsonSchema,
  type NarrativeInputPacket,
  type NarrativeIntelligence,
} from "../src/lib/trading/narrative-intelligence";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "../src/lib/trading/opportunity-view-model";
import { shockPatternFromDbRow, type ShockMovePattern } from "../src/lib/trading/shock-move";
import type { RankingRow } from "../src/lib/types";

type LatestSignalRow = QueryResultRow & {
  action: string | null;
  asset_type: string | null;
  buy_zone: string | null;
  company_name: string | null;
  completed_at: string | Date | null;
  conservative_target: string | number | null;
  created_at: string | Date;
  entry_distance_pct: string | number | null;
  entry_status: string | null;
  entry_zone_high: string | number | null;
  entry_zone_low: string | number | null;
  final_decision: string | null;
  final_score: string | number | null;
  final_score_adjusted: string | number | null;
  market_regime: string | null;
  payload: unknown;
  price: string | number | null;
  quality_score: string | number | null;
  rank_position: number | null;
  rating: string | null;
  recommendation_quality: string | null;
  risk_reward: string | number | null;
  scan_run_id: string;
  sector: string | null;
  setup_type: string | null;
  stop_loss: string | number | null;
  suggested_entry: string | number | null;
  symbol: string;
  take_profit: string | number | null;
};

type MemorySnapshotRow = QueryResultRow & {
  decision: string | null;
  final_score: string | number | null;
  market_regime: string | null;
  outcome: unknown;
  score_bucket: string | null;
  sector: string | null;
  setup_type: string | null;
  signal_ts: string | Date;
  signature: unknown;
  symbol: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const LLM_SURFACE = "narrative_refresh";
const LLM_ROUTE = "script:narrative-refresh";
const LLM_CACHE_VERSION = "narrative_refresh_v1";

loadEnvFiles();

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ ok: false, error: safeErrorMessage(error) }));
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for narrative refresh.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const latest = await latestSignals(pool);
    const rows = latest.map(signalRowToRankingRow);
    const shockPatterns = await shockPatternMap(pool, rows.map((row) => row.symbol));
    const opportunityModel = buildOpportunitiesPageModel(rows, null, shockPatterns);
    const macroResolver = createMacroContextResolver(rows);
    const llmLimit = llmEnabled() ? narrativeLlmLimit() : 0;
    let deterministicCount = 0;
    let llmAttempts = 0;
    let llmCount = 0;
    const examples: Array<{ decision: string | null; drift: string; source: string; summary: string; symbol: string }> = [];

    for (const modelRow of opportunityModel.rows) {
      const signal = latest.find((row) => row.symbol.trim().toUpperCase() === modelRow.symbol) ?? null;
      if (!signal) continue;
      const marketMemory = await marketMemoryForRow(pool, modelRow.raw).catch(() => unavailableMemory());
      const macroContext = macroResolver.forRow(modelRow.raw);
      const deterministic = buildNarrativeIntelligence({ macroContext, marketMemory, row: modelRow });
      const packet = buildNarrativeInputPacket({ macroContext, marketMemory, row: modelRow }, deterministic);
      const shouldAttemptLlm = llmAttempts < llmLimit;
      if (shouldAttemptLlm) llmAttempts += 1;
      const llmNarrative = shouldAttemptLlm ? await llmNarrativeFor(deterministic, packet).catch(() => null) : null;
      const narrative = llmNarrative ?? deterministic;
      if (narrative.source === "llm") llmCount += 1;
      deterministicCount += 1;
      await upsertNarrative(pool, signal, narrative, packet, llmNarrative);
      if (exampleSymbols().has(modelRow.symbol) || examples.length < 6) {
        examples.push({
          decision: modelRow.final_decision,
          drift: narrative.narrativeDrift.label,
          source: narrative.source,
          summary: narrative.narrativeSummary,
          symbol: modelRow.symbol,
        });
      }
    }

    console.log(JSON.stringify({
      ok: true,
      deterministicCount,
      examples: examples.slice(0, 14),
      llmAttempts,
      llmCount,
      scanRunId: latest[0]?.scan_run_id ?? null,
      symbols: opportunityModel.rows.length,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

async function latestSignals(pool: Pool): Promise<LatestSignalRow[]> {
  const result = await pool.query<LatestSignalRow>(`
    WITH latest_run AS (
      SELECT id, completed_at, created_at
      FROM scan_runs
      WHERE status = 'success'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    )
    SELECT
      latest_run.id::text AS scan_run_id,
      latest_run.completed_at,
      ss.symbol,
      ss.rank_position,
      ss.company_name,
      ss.asset_type,
      ss.sector,
      ss.price,
      ss.rating,
      ss.action,
      ss.final_decision,
      ss.final_score,
      ss.final_score_adjusted,
      ss.setup_type,
      ss.entry_status,
      ss.recommendation_quality,
      ss.quality_score,
      ss.suggested_entry,
      ss.entry_distance_pct,
      ss.entry_zone_low,
      ss.entry_zone_high,
      ss.buy_zone,
      ss.stop_loss,
      ss.take_profit,
      ss.conservative_target,
      ss.risk_reward,
      ss.market_regime,
      ss.payload,
      ss.created_at
    FROM scanner_signals ss
    JOIN latest_run ON latest_run.id = ss.scan_run_id
    ORDER BY ss.rank_position ASC NULLS LAST, ss.final_score DESC NULLS LAST, ss.symbol ASC
  `);
  return result.rows;
}

function signalRowToRankingRow(row: LatestSignalRow): RankingRow {
  const completedAt = timestampText(row.completed_at) ?? timestampText(row.created_at);
  const payload = recordFrom(row.payload);
  return {
    ...payload,
    action: row.action ?? undefined,
    asset_type: row.asset_type ?? undefined,
    buy_zone: row.buy_zone ?? undefined,
    company_name: row.company_name ?? undefined,
    conservative_target: scalar(row.conservative_target),
    entry_distance_pct: numeric(row.entry_distance_pct) ?? undefined,
    entry_status: row.entry_status ?? undefined,
    entry_zone_high: numeric(row.entry_zone_high) ?? undefined,
    entry_zone_low: numeric(row.entry_zone_low) ?? undefined,
    final_decision: row.final_decision ?? undefined,
    final_score: numeric(row.final_score) ?? undefined,
    final_score_adjusted: numeric(row.final_score_adjusted) ?? undefined,
    last_updated: completedAt ?? undefined,
    last_updated_utc: completedAt ?? undefined,
    market_regime: row.market_regime ?? undefined,
    price: numeric(row.price) ?? undefined,
    quality_score: numeric(row.quality_score) ?? undefined,
    rank_position: row.rank_position ?? undefined,
    rating: row.rating ?? undefined,
    recommendation_quality: row.recommendation_quality ?? undefined,
    risk_reward: numeric(row.risk_reward) ?? undefined,
    sector: row.sector ?? undefined,
    setup_type: row.setup_type ?? undefined,
    stop_loss: scalar(row.stop_loss),
    suggested_entry: scalar(row.suggested_entry),
    symbol: row.symbol.trim().toUpperCase(),
    take_profit: scalar(row.take_profit),
  };
}

async function shockPatternMap(pool: Pool, symbols: string[]): Promise<Map<string, ShockMovePattern>> {
  const cleaned = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
  if (!cleaned.length) return new Map();
  try {
    const result = await pool.query<QueryResultRow>(
      `
        SELECT *
        FROM shock_move_patterns
        WHERE lookback_window = '1y'
          AND symbol = ANY($1::text[])
      `,
      [cleaned],
    );
    return new Map(result.rows.map((row) => shockPatternFromDbRow(row)).filter((pattern): pattern is ShockMovePattern => pattern !== null).map((pattern) => [pattern.symbol, pattern]));
  } catch (error) {
    if (error instanceof Error && /shock_move_patterns|relation .* does not exist/i.test(error.message)) return new Map();
    throw error;
  }
}

async function marketMemoryForRow(pool: Pool, row: RankingRow): Promise<MarketMemorySummary> {
  const currentTimestamp = textOrNull(row.last_updated_utc ?? row.last_updated);
  const result = await pool.query<MemorySnapshotRow>(
    `
      SELECT
        symbol,
        signal_ts,
        setup_type,
        sector,
        market_regime,
        final_decision AS decision,
        final_score,
        score_bucket,
        signature,
        outcome
      FROM market_memory_snapshots
      WHERE signal_ts < COALESCE($6::timestamptz, now())
        AND (
          symbol = $1
          OR ($2::text IS NOT NULL AND setup_type = $2)
          OR ($3::text IS NOT NULL AND sector = $3)
          OR ($4::text IS NOT NULL AND market_regime = $4)
          OR ($5::text IS NOT NULL AND score_bucket = $5)
        )
      ORDER BY signal_ts DESC
      LIMIT 700
    `,
    [
      row.symbol.trim().toUpperCase(),
      textOrNull(row.setup_type),
      textOrNull(row.sector),
      textOrNull(row.market_regime),
      scoreBucket(row.final_score),
      currentTimestamp,
    ],
  );
  return buildMarketMemorySummary(row, result.rows.map(memoryCandidateFromRow));
}

function memoryCandidateFromRow(row: MemorySnapshotRow): MarketMemoryCandidate {
  const signature = recordFrom(row.signature);
  return {
    decision: textOrNull(row.decision),
    eventSignature: textOrNull(signature.verified_event_signature),
    finalScore: numeric(row.final_score),
    macroEventRegimeSignature: textOrNull(signature.macro_event_regime_signature),
    marketRegime: textOrNull(row.market_regime),
    outcomes: outcomePoints(row.outcome),
    scoreBucket: textOrNull(row.score_bucket),
    sector: textOrNull(row.sector),
    setupType: textOrNull(row.setup_type),
    signalTimestamp: timestampText(row.signal_ts) ?? new Date(0).toISOString(),
    symbol: row.symbol.toUpperCase(),
  };
}

function outcomePoints(value: unknown): MarketMemoryOutcomePoint[] {
  const record = recordFrom(value);
  return Object.entries(record)
    .map(([horizon, raw]) => {
      const payload = recordFrom(raw);
      return {
        horizon,
        returnPct: numeric(payload.return_pct ?? payload.returnPct ?? raw),
      };
    })
    .filter((point) => point.horizon.trim().length > 0);
}

async function upsertNarrative(pool: Pool, signal: LatestSignalRow, narrative: NarrativeIntelligence, packet: NarrativeInputPacket, llmNarrative: NarrativeIntelligence | null): Promise<void> {
  await pool.query(
    `
      INSERT INTO narrative_intelligence_snapshots (
        symbol,
        scan_run_id,
        signal_ts,
        source,
        narrative_summary,
        bullish_narrative,
        bearish_narrative,
        moderator_summary,
        risk_narrative,
        macro_narrative,
        sector_narrative,
        liquidity_narrative,
        volatility_narrative,
        positioning_narrative,
        decision_reasoning,
        event_reasoning,
        fragility_reasoning,
        why_setup_matters,
        what_could_break,
        conditional_opportunity,
        pressure_story,
        what_to_watch,
        narrative_drift,
        risk_language,
        unsupported_claims_detected,
        llm_json,
        input_packet,
        generated_at,
        updated_at
      )
      VALUES (
        $1, $2::uuid, $3::timestamptz, $4,
        $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22::jsonb, $23::jsonb, $24, $25,
        $26::jsonb, $27::jsonb, $28::timestamptz, now()
      )
      ON CONFLICT (symbol, scan_run_id)
      DO UPDATE SET
        source = EXCLUDED.source,
        signal_ts = EXCLUDED.signal_ts,
        narrative_summary = EXCLUDED.narrative_summary,
        bullish_narrative = EXCLUDED.bullish_narrative,
        bearish_narrative = EXCLUDED.bearish_narrative,
        moderator_summary = EXCLUDED.moderator_summary,
        risk_narrative = EXCLUDED.risk_narrative,
        macro_narrative = EXCLUDED.macro_narrative,
        sector_narrative = EXCLUDED.sector_narrative,
        liquidity_narrative = EXCLUDED.liquidity_narrative,
        volatility_narrative = EXCLUDED.volatility_narrative,
        positioning_narrative = EXCLUDED.positioning_narrative,
        decision_reasoning = EXCLUDED.decision_reasoning,
        event_reasoning = EXCLUDED.event_reasoning,
        fragility_reasoning = EXCLUDED.fragility_reasoning,
        why_setup_matters = EXCLUDED.why_setup_matters,
        what_could_break = EXCLUDED.what_could_break,
        conditional_opportunity = EXCLUDED.conditional_opportunity,
        pressure_story = EXCLUDED.pressure_story,
        what_to_watch = EXCLUDED.what_to_watch,
        narrative_drift = EXCLUDED.narrative_drift,
        risk_language = EXCLUDED.risk_language,
        unsupported_claims_detected = EXCLUDED.unsupported_claims_detected,
        llm_json = EXCLUDED.llm_json,
        input_packet = EXCLUDED.input_packet,
        generated_at = EXCLUDED.generated_at,
        updated_at = now()
    `,
    [
      narrative.symbol,
      signal.scan_run_id,
      timestampText(signal.completed_at ?? signal.created_at),
      narrative.source,
      narrative.narrativeSummary,
      narrative.bullishNarrative,
      narrative.bearishNarrative,
      narrative.moderatorSummary,
      narrative.riskNarrative,
      narrative.macroNarrative,
      narrative.sectorNarrative,
      narrative.liquidityNarrative,
      narrative.volatilityNarrative,
      narrative.positioningNarrative,
      narrative.decisionReasoning,
      narrative.eventReasoning,
      narrative.fragilityReasoning,
      narrative.whySetupMatters,
      narrative.whatCouldBreak,
      narrative.conditionalOpportunity,
      narrative.pressureStory,
      JSON.stringify(narrative.whatToWatch),
      JSON.stringify(narrative.narrativeDrift),
      narrative.riskLanguage,
      narrative.unsupportedClaimsDetected,
      JSON.stringify(llmNarrative ?? {}),
      JSON.stringify(packet),
      narrative.generatedAt,
    ],
  );
}

async function llmNarrativeFor(base: NarrativeIntelligence, packet: NarrativeInputPacket): Promise<NarrativeIntelligence | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = (process.env.TRADEVETO_NARRATIVE_LLM_MODEL || process.env.TRADEVETO_EVENT_LLM_MODEL || configuredLlmFallbackModel() || "").trim();
  if (!apiKey || !model) return null;
  const requestBody = {
    input: [
      {
        role: "system",
        content: [
          "You are TradeVeto's narrative reasoning layer.",
          "Use only the supplied structured packet and deterministic narrative baseline.",
          "Do not invent prices, scores, events, probabilities, forecasts, source names, or news facts.",
          "Do not override deterministic decisions or rankings.",
          "Do not use direct financial advice. Do not use buy now, sell now, guaranteed, or sure profit.",
          "Return strict ASCII JSON only with the requested schema.",
          "The riskLanguage field must include the exact phrase: not financial advice.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({ baseline: base, packet }),
      },
    ],
    model,
    store: false,
    text: {
      format: {
        name: "tradeveto_narrative_intelligence",
        schema: narrativeJsonSchema(),
        strict: true,
        type: "json_schema",
      },
    },
  };
  const { cacheKey, promptHash } = llmCacheIdentity({ model, payload: requestBody, surface: LLM_SURFACE, version: LLM_CACHE_VERSION });
  const estimate = estimateLlmCallCost({ maxOutputTokens: 1200, payload: requestBody });
  const cached = await readLlmResponseCache<unknown>({ cacheKey, surface: LLM_SURFACE });
  if (cached) {
    const validated = applyValidatedLlmNarrative(base, cached, packet);
    if (validated) {
      await recordLlmUsage({
        cacheStatus: "hit",
        estimatedInputTokens: estimate.estimatedInputTokens,
        estimatedOutputTokens: estimate.estimatedOutputTokens,
        model,
        payload: requestBody,
        promptHash,
        route: LLM_ROUTE,
        status: "cache_hit",
        surface: LLM_SURFACE,
      });
      return validated;
    }
  }
  const budget = await checkLlmBudget({ maxOutputTokens: 1200, payload: requestBody, route: LLM_ROUTE, surface: LLM_SURFACE });
  if (!budget.allowed) {
    await recordLlmUsage({
      cacheStatus: "bypass",
      estimatedInputTokens: budget.estimatedInputTokens,
      estimatedOutputTokens: budget.estimatedOutputTokens,
      model,
      payload: requestBody,
      promptHash,
      route: LLM_ROUTE,
      status: "blocked",
      surface: LLM_SURFACE,
      errorCode: budget.reason,
    });
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  const startedAt = Date.now();
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify(requestBody),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "TradeVetoNarrativeRefresh/1.0 (+https://tradeveto.com)",
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
        payload: requestBody,
        promptHash,
        route: LLM_ROUTE,
        status: "failed",
        surface: LLM_SURFACE,
        errorCode: `http_${response.status}`,
      });
      return null;
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
        payload: requestBody,
        promptHash,
        route: LLM_ROUTE,
        status: "validation_failed",
        surface: LLM_SURFACE,
        usageInputTokens: usage.inputTokens,
        usageOutputTokens: usage.outputTokens,
        errorCode: "empty_output",
      });
      return null;
    }
    const parsed = JSON.parse(text) as unknown;
    const validated = applyValidatedLlmNarrative(base, parsed, packet);
    if (!validated) {
      await recordLlmUsage({
        cacheStatus: "miss",
        durationMs: Date.now() - startedAt,
        estimatedInputTokens: budget.estimatedInputTokens,
        estimatedOutputTokens: budget.estimatedOutputTokens,
        model,
        payload: requestBody,
        promptHash,
        route: LLM_ROUTE,
        status: "validation_failed",
        surface: LLM_SURFACE,
        usageInputTokens: usage.inputTokens,
        usageOutputTokens: usage.outputTokens,
        errorCode: "schema_or_grounding",
      });
      return null;
    }
    const cacheStatus = await writeLlmResponseCache({ cacheKey, model, responseJson: parsed, surface: LLM_SURFACE });
    await recordLlmUsage({
      cacheStatus: cacheStatus === "ok" ? "miss" : "write_failed",
      durationMs: Date.now() - startedAt,
      estimatedInputTokens: budget.estimatedInputTokens,
      estimatedOutputTokens: budget.estimatedOutputTokens,
      model,
      payload: requestBody,
      promptHash,
      route: LLM_ROUTE,
      status: "success",
      surface: LLM_SURFACE,
      usageInputTokens: usage.inputTokens,
      usageOutputTokens: usage.outputTokens,
    });
    return validated;
  } catch {
    await recordLlmUsage({
      cacheStatus: "miss",
      durationMs: Date.now() - startedAt,
      estimatedInputTokens: budget.estimatedInputTokens,
      estimatedOutputTokens: budget.estimatedOutputTokens,
      model,
      payload: requestBody,
      promptHash,
      route: LLM_ROUTE,
      status: "failed",
      surface: LLM_SURFACE,
      errorCode: "fetch_error",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  const value = (process.env.TRADEVETO_NARRATIVE_LLM_ENABLED || process.env.TRADEVETO_EVENT_LLM_ENABLED || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function narrativeLlmLimit(): number {
  const raw = Number(process.env.TRADEVETO_NARRATIVE_LLM_TOP_N ?? 8);
  if (!Number.isFinite(raw)) return 8;
  return Math.max(0, Math.min(25, Math.floor(raw)));
}

function timeoutMs(): number {
  const raw = Number(process.env.TRADEVETO_NARRATIVE_LLM_TIMEOUT_SECONDS || 30);
  const seconds = Number.isFinite(raw) ? Math.max(4, Math.min(30, raw)) : 30;
  return seconds * 1000;
}

function unavailableMemory(): MarketMemorySummary {
  return {
    analogs: [],
    available: false,
    evidence: {
      explanation: "Market memory is unavailable for this symbol.",
      label: "No comparable memory yet",
      sampleSize: 0,
      tier: "unavailable",
    },
    narrative: ["Market memory is unavailable for this symbol."],
    outcome: null,
  };
}

function exampleSymbols(): Set<string> {
  return new Set(["AMD", "MU", "DDOG", "AVGO", "ASML", "CRWD", "NVDA", "TSM", "OXY", "QQQ", "SPY", "GLD", "IBIT", "BTC-USD"]);
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scalar(value: unknown): string | number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return null;
  return text;
}

function timestampText(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
