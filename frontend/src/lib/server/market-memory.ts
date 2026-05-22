import "server-only";

import { dbQuery } from "@/lib/server/db";
import { buildMarketMemorySummary, scoreBucket, type MarketMemoryCandidate, type MarketMemoryOutcomePoint, type MarketMemorySummary } from "@/lib/trading/market-memory";
import type { RankingRow } from "@/lib/types";
import type { QueryResultRow } from "pg";

type MarketMemorySnapshotRow = QueryResultRow & {
  decision: string | null;
  final_score: string | number | null;
  market_regime: string | null;
  outcome: unknown;
  score_bucket: string | null;
  sector: string | null;
  signature: unknown;
  setup_type: string | null;
  signal_ts: string | Date;
  symbol: string;
};

type ScannerSignalMemoryRow = QueryResultRow & {
  decision: string | null;
  final_score: string | number | null;
  market_regime: string | null;
  outcome: unknown;
  payload: unknown;
  score_bucket: string | null;
  sector: string | null;
  setup_type: string | null;
  signal_ts: string | Date;
  symbol: string;
};

type MarketMemoryCacheEntry = {
  expiresAt: number;
  value: Promise<MarketMemorySummary>;
};

const MARKET_MEMORY_SIGNAL_CACHE_TTL_MS = 90_000;
const MARKET_MEMORY_SIGNAL_CACHE_LIMIT = 160;
const signalMemoryCache = new Map<string, MarketMemoryCacheEntry>();

export async function getMarketMemoryForSignal(row: RankingRow): Promise<MarketMemorySummary> {
  const key = memoryCacheKey(row);
  const now = Date.now();
  const cached = signalMemoryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const generatedAt = new Date(now).toISOString();
  const value = buildMarketMemoryForSignal(row, generatedAt);
  signalMemoryCache.set(key, { expiresAt: now + MARKET_MEMORY_SIGNAL_CACHE_TTL_MS, value });
  pruneSignalMemoryCache(now);
  try {
    return await value;
  } catch (error) {
    if (signalMemoryCache.get(key)?.value === value) signalMemoryCache.delete(key);
    throw error;
  }
}

async function getMarketMemoryCandidates(row: RankingRow): Promise<MarketMemoryCandidate[]> {
  const symbol = row.symbol.trim().toUpperCase();
  if (!symbol) return [];
  const currentTimestamp = textOrNull(row.last_updated_utc ?? row.last_updated);
  const setupType = textOrNull(row.setup_type);
  const sector = textOrNull(row.sector);
  const marketRegime = textOrNull(row.market_regime);
  const bucket = scoreBucket(row.final_score);
  const result = await dbQuery<MarketMemorySnapshotRow>(
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
      ORDER BY
        CASE
          WHEN symbol = $1 THEN 0
          WHEN $2::text IS NOT NULL AND setup_type = $2 THEN 1
          WHEN $3::text IS NOT NULL AND sector = $3 THEN 2
          WHEN $4::text IS NOT NULL AND market_regime = $4 THEN 3
          ELSE 4
        END,
        signal_ts DESC
      LIMIT 360
    `,
    [symbol, setupType, sector, marketRegime, bucket, currentTimestamp],
  );
  const snapshotCandidates = result.rows.map(snapshotToCandidate);
  const scannerCandidates = await getScannerSignalMemoryCandidates({ bucket, currentTimestamp, marketRegime, sector, setupType, symbol }).catch((): MarketMemoryCandidate[] => []);
  return dedupeCandidates([...snapshotCandidates, ...scannerCandidates]);
}

async function getScannerSignalMemoryCandidates(input: {
  bucket: string | null;
  currentTimestamp: string | null;
  marketRegime: string | null;
  sector: string | null;
  setupType: string | null;
  symbol: string;
}): Promise<MarketMemoryCandidate[]> {
  const result = await dbQuery<ScannerSignalMemoryRow>(
    `
      SELECT
        ss.symbol,
        COALESCE(sr.completed_at, sr.created_at) AS signal_ts,
        ss.setup_type,
        ss.sector,
        ss.market_regime,
        ss.final_decision AS decision,
        ss.final_score,
        CASE
          WHEN ss.final_score >= 85 THEN '85+'
          WHEN ss.final_score >= 75 THEN '75-84'
          WHEN ss.final_score >= 65 THEN '65-74'
          WHEN ss.final_score >= 55 THEN '55-64'
          ELSE '<55'
        END AS score_bucket,
        ss.payload,
        outcomes.outcome
      FROM scanner_signals ss
      JOIN scan_runs sr ON sr.id = ss.scan_run_id
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(fr.horizon, jsonb_build_object('return_pct', fr.return_pct)) AS outcome
        FROM forward_returns fr
        WHERE fr.return_pct IS NOT NULL
          AND fr.horizon IS NOT NULL
          AND (
            fr.scanner_signal_id = ss.id
            OR (fr.scan_run_id = ss.scan_run_id AND fr.symbol = ss.symbol)
          )
      ) outcomes ON true
      WHERE sr.status = 'success'
        AND COALESCE(sr.completed_at, sr.created_at) < COALESCE($6::timestamptz, now())
        AND (
          ss.symbol = $1
          OR ($2::text IS NOT NULL AND ss.setup_type = $2)
          OR ($3::text IS NOT NULL AND ss.sector = $3)
          OR ($4::text IS NOT NULL AND ss.market_regime = $4)
          OR ($5::text IS NOT NULL AND (
            CASE
              WHEN ss.final_score >= 85 THEN '85+'
              WHEN ss.final_score >= 75 THEN '75-84'
              WHEN ss.final_score >= 65 THEN '65-74'
              WHEN ss.final_score >= 55 THEN '55-64'
              ELSE '<55'
            END
          ) = $5)
        )
      ORDER BY
        CASE
          WHEN ss.symbol = $1 THEN 0
          WHEN $2::text IS NOT NULL AND ss.setup_type = $2 THEN 1
          WHEN $3::text IS NOT NULL AND ss.sector = $3 THEN 2
          WHEN $4::text IS NOT NULL AND ss.market_regime = $4 THEN 3
          ELSE 4
        END,
        COALESCE(sr.completed_at, sr.created_at) DESC NULLS LAST,
        ss.rank_position ASC NULLS LAST,
        ss.symbol ASC
      LIMIT 420
    `,
    [input.symbol, input.setupType, input.sector, input.marketRegime, input.bucket, input.currentTimestamp],
  );

  return result.rows.map(scannerSignalToCandidate);
}

function snapshotToCandidate(row: MarketMemorySnapshotRow): MarketMemoryCandidate {
  const signature = signatureRecord(row.signature);
  return {
    decision: textOrNull(row.decision),
    drawdownBucket: textOrNull(signature.drawdown_bucket),
    eventSignature: textOrNull(signature.verified_event_signature),
    finalScore: finiteDbNumber(row.final_score),
    liquidityBucket: textOrNull(signature.liquidity_bucket),
    macroEventRegimeSignature: textOrNull(signature.macro_event_regime_signature),
    macroPressureBucket: textOrNull(signature.macro_pressure_bucket),
    marketRegime: textOrNull(row.market_regime),
    outcomes: outcomePoints(row.outcome),
    scoreBucket: textOrNull(row.score_bucket),
    sector: textOrNull(row.sector),
    setupType: textOrNull(row.setup_type),
    signalTimestamp: timestampText(row.signal_ts),
    symbol: row.symbol.toUpperCase(),
    volatilityBucket: textOrNull(signature.volatility_bucket),
  };
}

function scannerSignalToCandidate(row: ScannerSignalMemoryRow): MarketMemoryCandidate {
  const payload = signatureRecord(row.payload);
  return {
    decision: textOrNull(row.decision),
    drawdownBucket: drawdownBucket(firstNumeric(payload.max_drawdown, payload.avg_max_drawdown, payload.max_drawdown_after_signal)),
    eventSignature: textOrNull(payload.verified_event_signature),
    finalScore: finiteDbNumber(row.final_score),
    liquidityBucket: liquidityBucket(firstNumeric(payload.liquidity_pressure, payload.liquidity_pressure_adjustment, payload.avg_dollar_volume)),
    macroEventRegimeSignature: textOrNull(payload.macro_event_regime_signature),
    macroPressureBucket: pressureBucket(firstNumeric(payload.macro_pressure_score, payload.macro_context_adjustment_total, payload.macro_alignment_score)),
    marketRegime: textOrNull(row.market_regime),
    outcomes: outcomePoints(row.outcome),
    scoreBucket: textOrNull(row.score_bucket),
    sector: textOrNull(row.sector),
    setupType: textOrNull(row.setup_type),
    signalTimestamp: timestampText(row.signal_ts),
    symbol: row.symbol.toUpperCase(),
    volatilityBucket: pressureBucket(firstNumeric(payload.volatility_pressure, payload.atr_pct, payload.annualized_volatility)),
  };
}

function dedupeCandidates(candidates: MarketMemoryCandidate[]): MarketMemoryCandidate[] {
  const seen = new Set<string>();
  const deduped: MarketMemoryCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.symbol}|${candidate.signalTimestamp}|${candidate.setupType ?? ""}|${candidate.marketRegime ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function signatureRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function outcomePoints(value: unknown): MarketMemoryOutcomePoint[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return Object.entries(record)
    .map(([horizon, raw]) => {
      const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      return {
        horizon,
        returnPct: finiteDbNumber(payload.return_pct ?? payload.returnPct ?? raw),
      };
    })
    .filter((point) => point.horizon.trim().length > 0);
}

function timestampText(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return null;
  return text;
}

function finiteDbNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function buildMarketMemoryForSignal(row: RankingRow, generatedAt: string): Promise<MarketMemorySummary> {
  const candidates = await getMarketMemoryCandidates(row).catch((): MarketMemoryCandidate[] => []);
  return buildMarketMemorySummary(row, candidates, { generatedAt });
}

function memoryCacheKey(row: RankingRow): string {
  return [
    row.symbol.trim().toUpperCase(),
    textOrNull(row.setup_type) ?? "",
    textOrNull(row.sector) ?? "",
    textOrNull(row.market_regime) ?? "",
    scoreBucket(row.final_score) ?? "",
    textOrNull(row.final_decision ?? row.action) ?? "",
    textOrNull(row.last_updated_utc ?? row.last_updated) ?? "",
  ].join("|");
}

function pruneSignalMemoryCache(now: number): void {
  for (const [key, entry] of signalMemoryCache) {
    if (entry.expiresAt <= now) signalMemoryCache.delete(key);
  }
  while (signalMemoryCache.size > MARKET_MEMORY_SIGNAL_CACHE_LIMIT) {
    const oldest = signalMemoryCache.keys().next().value;
    if (!oldest) break;
    signalMemoryCache.delete(oldest);
  }
}

function firstNumeric(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteDbNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pressureBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 75) return "high_pressure";
  if (value >= 50) return "elevated_pressure";
  if (value >= 25) return "moderate_pressure";
  return "low_pressure";
}

function liquidityBucket(value: number | null): string | null {
  if (value === null) return null;
  if (value >= 1_000_000_000) return "deep_liquidity";
  if (value >= 100_000_000) return "good_liquidity";
  return pressureBucket(value);
}

function drawdownBucket(value: number | null): string | null {
  if (value === null) return null;
  const magnitude = Math.abs(value);
  if (magnitude >= 0.2 || magnitude >= 20) return "deep_drawdown";
  if (magnitude >= 0.1 || magnitude >= 10) return "moderate_drawdown";
  if (magnitude > 0) return "shallow_drawdown";
  return null;
}
