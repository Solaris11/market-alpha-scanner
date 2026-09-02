import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "csv-parse/sync";
import { freshnessFromTimestamp, normalizedTimestamp, unavailableFreshness } from "./data-health";
import { dbQuery } from "./server/db";
import { getScannerSignalPriceHistoryPoints } from "./server/scanner-signal-price-history";
import { applyCorrectionMapFields } from "./trading/correction-map";
import type { DataFreshnessStatus } from "./data-health";
import type { QueryResultRow } from "pg";
import type { CsvFileData, CsvRow, HistorySnapshot, HistorySummary, IntradayDriftRow, PerformanceData, RankingRow, ScannerScalar, SymbolDetail, SymbolHistoryData, SymbolHistoryRow } from "./types";

const NUMERIC_FIELDS = new Set([
  "price",
  "base_score",
  "final_score",
  "final_score_adjusted",
  "macro_adjusted_score",
  "return_1d",
  "regime_adjustment",
  "macro_context_adjustment_total",
  "macro_alignment_score",
  "macro_alignment_adjustment",
  "exchange_health_score",
  "exchange_context_adjustment",
  "sector_alignment_score",
  "sector_alignment_adjustment",
  "macro_pressure_score",
  "risk_on_score",
  "volatility_pressure",
  "volatility_pressure_adjustment",
  "liquidity_pressure",
  "liquidity_pressure_adjustment",
  "macro_conflict_penalty",
  "event_conviction_adjustment",
  "event_fragility_adjustment",
  "event_macro_pressure_adjustment",
  "event_risk_score",
  "event_shock_pressure_score",
  "verified_event_pressure_score",
  "technical_score",
  "fundamental_score",
  "fundamental_quality_score",
  "quality_score",
  "macro_score",
  "news_score",
  "risk_penalty",
  "price_at_signal",
  "signal_price",
  "entry_price",
  "exit_price",
  "forward_return",
  "return_pct",
  "max_drawdown_after_signal",
  "max_gain_after_signal",
  "days_to_entry",
  "days_to_exit",
  "risk_reward",
  "risk_reward_low",
  "risk_reward_high",
  "conservative_risk_reward",
  "balanced_risk_reward_low",
  "balanced_risk_reward_high",
  "aggressive_risk_reward_low",
  "aggressive_risk_reward_high",
  "take_profit_low",
  "take_profit_high",
  "take_profit",
  "open",
  "high",
  "low",
  "close",
  "adj_close",
  "adjclose",
  "volume",
  "short_score",
  "mid_score",
  "long_score",
  "market_cap",
  "avg_dollar_volume",
  "trailing_pe",
  "forward_pe",
  "revenue_growth",
  "earnings_growth",
  "current_rsi",
  "atr_pct",
  "annualized_volatility",
  "max_drawdown",
  "forward_5d",
  "forward_10d",
  "forward_20d",
  "forward_60d",
  "count",
  "avg_return",
  "median_return",
  "hit_rate",
  "entry_reached_rate",
  "target_hit_rate",
  "stop_hit_rate",
  "expired_rate",
  "open_rate",
  "avg_max_drawdown",
  "avg_max_gain",
  "avg_return_pct",
  "avg_days_to_entry",
  "avg_days_to_exit",
  "avg_drawdown",
  "avg_gain",
  "edge_score",
  "worst_return",
  "best_return",
  "avg_negative_return",
  "min_return",
  "confidence_score",
  "entry_distance_pct",
  "correction_price",
  "correction_zone_low",
  "correction_zone_high",
  "correction_trigger_price",
  "correction_distance_pct",
  "entry_zone_low",
  "entry_zone_high",
  "buy_zone_low",
  "buy_zone_high",
  "avwap",
  "anchored_vwap",
  "anchored_vwap_price",
  "recent_swing_low",
  "swing_low",
  "recent_support",
  "support_level",
  "support",
  "recent_resistance",
  "resistance",
  "resistance_level",
  "recent_swing_high",
  "swing_high",
  "atr",
  "atr_value",
  "current_atr",
  "target_price",
]);
const REQUIRED_RANKING_COLUMNS = ["symbol", "price", "final_score", "rating", "action"];
const STRUCTURED_RANKING_FIELDS = new Set([
  "adjusted_thresholds",
  "adjusted_weights",
  "decision_reason_codes",
  "factor_scores",
  "event_context_reason_codes",
  "macro_context_reason_codes",
  "macro_proxy_coverage_missing",
  "macro_proxy_coverage_used",
  "missing_fields",
  "regime_reason_codes",
  "setup_reason_codes",
  "setup_thresholds",
  "verified_event_recent_events",
  "verified_event_sources_used",
  "vetoes",
]);

const NAME_FIELDS = [
  "company_name",
  "long_name",
  "longName",
  "short_name",
  "shortName",
  "display_name",
  "displayName",
  "security_name",
  "name",
];

const DEFAULT_SCANNER_OUTPUT_DIR = "/opt/apps/market-alpha-scanner/app/scanner_output";
const CSV_PARSE_OPTIONS = {
  relax_column_count: true,
  relax_quotes: true,
  skip_empty_lines: true,
  trim: true,
};

type CsvPayload = {
  rows: Record<string, unknown>[];
  columns: string[];
  lineCount: number;
};

type LatestScanRunRow = QueryResultRow & {
  id: string;
  completed_at: string | Date | null;
  created_at: string | Date;
  breadth: string | null;
  leadership: string | null;
  market_regime: string | null;
  metadata: unknown;
  status: string;
  symbols_scored: number | null;
};

type DbSignalRow = QueryResultRow & {
  action: string | null;
  asset_type: string | null;
  buy_zone: string | null;
  company_name: string | null;
  conservative_target: string | number | null;
  completed_at: string | Date | null;
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
  sector: string | null;
  setup_type: string | null;
  stop_loss: string | number | null;
  suggested_entry: string | number | null;
  symbol: string;
  take_profit: string | number | null;
};

type DbHistoryRow = DbSignalRow & {
  scan_run_id: string;
};

type DbPriceRow = QueryResultRow & {
  close: string | number | null;
  high: string | number | null;
  low: string | number | null;
  open: string | number | null;
  ts: string | Date;
  volume: string | number | null;
};

type DbJsonRow = QueryResultRow & {
  payload?: unknown;
  summary?: unknown;
};

type DbMetricRow = QueryResultRow & {
  created_at?: string | Date;
  metrics: unknown;
};

type DbForwardCountRow = QueryResultRow & {
  total_count: string | number | null;
};

type DbHistorySummaryRow = QueryResultRow & {
  id: string;
  completed_at: string | Date | null;
  created_at: string | Date;
};

type DbHistoryAggregateRow = QueryResultRow & {
  earliest: string | Date | null;
  latest: string | Date | null;
  total_count: string | number | null;
  unique_dates: string[] | null;
};

type DbSymbolRow = QueryResultRow & {
  symbol: string;
};

type FileCacheEntry<T> = {
  mtimeMs: number;
  size: number;
  value: T;
};

const cacheRoot = globalThis as typeof globalThis & {
  __marketAlphaCsvCache?: Map<string, FileCacheEntry<CsvPayload>>;
  __marketAlphaCsvFallbackWarnings?: Set<string>;
  __marketAlphaJsonCache?: Map<string, FileCacheEntry<Record<string, unknown> | null>>;
};
const csvPayloadCache = cacheRoot.__marketAlphaCsvCache ?? new Map<string, FileCacheEntry<CsvPayload>>();
const csvFallbackWarnings = cacheRoot.__marketAlphaCsvFallbackWarnings ?? new Set<string>();
const jsonPayloadCache = cacheRoot.__marketAlphaJsonCache ?? new Map<string, FileCacheEntry<Record<string, unknown> | null>>();
cacheRoot.__marketAlphaCsvCache = csvPayloadCache;
cacheRoot.__marketAlphaCsvFallbackWarnings = csvFallbackWarnings;
cacheRoot.__marketAlphaJsonCache = jsonPayloadCache;

export type ScanDataHealth = {
  status: DataFreshnessStatus;
  label: string;
  lastUpdated: string | null;
  ageMinutes: number | null;
  humanAge: string;
  message: string;
  files: {
    name: string;
    status: DataFreshnessStatus;
    label: string;
    lastUpdated: string | null;
    ageMinutes: number | null;
    humanAge: string;
    missingColumns: string[];
  }[];
};

export function scannerOutputDir() {
  if (process.env.SCANNER_OUTPUT_DIR) return process.env.SCANNER_OUTPUT_DIR;
  return DEFAULT_SCANNER_OUTPUT_DIR;
}

function scannerCsvFallbackEnabled(): boolean {
  const value = String(process.env.SCANNER_CSV_FALLBACK ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function allowScannerCsvFallback(reason: string): boolean {
  const enabled = scannerCsvFallbackEnabled();
  const key = `${enabled ? "enabled" : "blocked"}:${reason}`;
  if (!csvFallbackWarnings.has(key)) {
    csvFallbackWarnings.add(key);
    const state = enabled ? "using" : "blocked";
    console.warn(`[data] scanner CSV fallback ${state}: ${reason}. Set SCANNER_CSV_FALLBACK=true only for explicit rollback/debug use.`);
  }
  return enabled;
}

const latestDbScanRun = cache(async (): Promise<LatestScanRunRow | null> => {
  try {
    const result = await dbQuery<LatestScanRunRow>(
      `
        SELECT id::text, completed_at, created_at, breadth, leadership, market_regime, metadata, status, symbols_scored
        FROM scan_runs
        WHERE status = 'success'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
    );
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function dbTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : normalizedTimestamp(value);
}

function dbSignalToRankingRow(row: DbSignalRow): RankingRow {
  const completedAt = dbTimestamp(row.completed_at) ?? dbTimestamp(row.created_at);
  const raw = {
    ...asRecord(row.payload),
    action: row.action,
    asset_type: row.asset_type,
    buy_zone: row.buy_zone,
    company_name: row.company_name,
    conservative_target: row.conservative_target,
    entry_distance_pct: row.entry_distance_pct,
    entry_status: row.entry_status,
    entry_zone_high: row.entry_zone_high,
    entry_zone_low: row.entry_zone_low,
    final_decision: row.final_decision,
    final_score: row.final_score,
    final_score_adjusted: row.final_score_adjusted,
    last_updated: completedAt,
    last_updated_utc: completedAt,
    market_regime: row.market_regime,
    price: row.price,
    quality_score: row.quality_score,
    rank_position: row.rank_position,
    rating: row.rating,
    recommendation_quality: row.recommendation_quality,
    risk_reward: row.risk_reward,
    sector: row.sector,
    setup_type: row.setup_type,
    stop_loss: row.stop_loss,
    suggested_entry: row.suggested_entry,
    symbol: row.symbol,
    take_profit: row.take_profit,
  };
  return normalizeRankingRow(raw, completedAt);
}

const getDbRankingRows = cache(async (limit?: number): Promise<RankingRow[] | null> => {
  try {
    const result = await dbQuery<DbSignalRow>(
      `
        WITH latest_run AS (
          SELECT id, completed_at
          FROM scan_runs
          WHERE status = 'success'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        )
        SELECT
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
          ss.created_at,
          latest_run.completed_at
        FROM scanner_signals ss
        JOIN latest_run ON latest_run.id = ss.scan_run_id
        ORDER BY ss.rank_position ASC NULLS LAST, ss.final_score DESC NULLS LAST, ss.symbol ASC
        ${limit ? "LIMIT $1" : ""}
      `,
      limit ? [limit] : [],
    );
    return result.rows.map(dbSignalToRankingRow).filter((row) => row.symbol);
  } catch {
    return null;
  }
});

const getDbHistoryRows = cache(async (symbol?: string): Promise<SymbolHistoryRow[] | null> => {
  try {
    const params = symbol ? [symbol.trim().toUpperCase()] : [];
    const result = await dbQuery<DbHistoryRow>(
      `
        WITH bounded_history AS (
        SELECT
          ss.scan_run_id::text,
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
          ss.created_at,
          sr.completed_at
        FROM scanner_signals ss
        JOIN scan_runs sr ON sr.id = ss.scan_run_id
        WHERE sr.status = 'success'
          ${symbol ? "AND ss.symbol = $1" : ""}
        ORDER BY sr.completed_at DESC NULLS LAST, sr.created_at DESC, ss.rank_position ASC NULLS LAST, ss.symbol ASC
        ${symbol ? "LIMIT 360" : ""}
        )
        SELECT *
        FROM bounded_history
        ORDER BY completed_at ASC NULLS LAST, created_at ASC, rank_position ASC NULLS LAST, symbol ASC
      `,
      params,
    );
    return result.rows.map((row) => {
      const ranking = dbSignalToRankingRow(row) as SymbolHistoryRow;
      ranking.timestamp_utc = dbTimestamp(row.completed_at) ?? dbTimestamp(row.created_at) ?? "";
      ranking.source_file = `db:${row.scan_run_id}`;
      return ranking;
    });
  } catch {
    return null;
  }
});

function rowsToCsvFileData(rows: Record<string, unknown>[]): CsvFileData {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row).map(canonicalCsvKey))));
  return {
    rows: rows.map(normalizeCsvRow),
    state: rows.length ? "data" : "header-only",
    columns,
    lineCount: rows.length + (columns.length ? 1 : 0),
  };
}

function metricRowsToCsvFileData(rows: DbMetricRow[], totalCount?: number | null): CsvFileData {
  const data = rowsToCsvFileData(rows.map((row) => asRecord(row.metrics)));
  if (totalCount !== undefined && totalCount !== null && Number.isFinite(totalCount) && totalCount >= data.rows.length) {
    return { ...data, lineCount: Math.floor(totalCount) + (data.columns.length ? 1 : 0) };
  }
  return data;
}

function dbCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const getDbPerformanceData = cache(async (forwardTailRows?: number): Promise<Pick<PerformanceData, "summary" | "forwardReturns"> | null> => {
  try {
    const forwardLimit = forwardTailRows ? Math.max(1, forwardTailRows) : 100000;
    const [summaryResult, forwardResult, forwardCountResult] = await Promise.all([
      dbQuery<DbMetricRow>(
        `
          WITH latest_batch AS (
            SELECT scan_run_id, max(created_at) AS created_at
            FROM performance_summary
            GROUP BY scan_run_id
            ORDER BY max(created_at) DESC
            LIMIT 1
          )
          SELECT ps.metrics, ps.created_at
          FROM performance_summary ps
          JOIN latest_batch lb
            ON lb.scan_run_id = ps.scan_run_id
           AND lb.created_at = ps.created_at
          ORDER BY
            COALESCE((ps.metrics->>'rank_position')::numeric, 999999),
            ps.metrics->>'group_type',
            ps.metrics->>'group_value'
        `,
      ),
      // No `count(*) OVER ()` here, deliberately. Postgres evaluates window
      // functions before LIMIT, so putting the total on these rows forced every
      // one of the 818k matching rows through a WindowAgg -- measured on prod at
      // 3652ms with 1.3GB of temp spill, against 1154ms without it. The total is
      // still needed (it feeds lineCount, which /paper shows as completed
      // evidence samples), so it is asked for separately below.
      dbQuery<DbMetricRow>(
        `
          SELECT
            (
              jsonb_build_object(
                'scan_run_id', scan_run_id::text,
                'scanner_signal_id', scanner_signal_id::text,
                'symbol', symbol,
                'signal_date', signal_date::text,
                'horizon', horizon,
                'return_pct', return_pct,
                'forward_return', return_pct,
                'created_at', created_at::text
              ) || COALESCE(metrics::jsonb, '{}'::jsonb)
            ) AS metrics,
            created_at
          FROM forward_returns
          WHERE return_pct IS NOT NULL
          ORDER BY signal_date DESC NULLS LAST, created_at DESC, symbol ASC, horizon ASC
          LIMIT $1
        `,
        [forwardLimit],
      ),
      // Same WHERE clause as the query above, so the count describes exactly the
      // same population. Measured on prod at 115ms.
      dbQuery<DbForwardCountRow>(
        `
          SELECT count(*) AS total_count
          FROM forward_returns
          WHERE return_pct IS NOT NULL
        `,
      ).catch(() => null),
    ]);

    if (!summaryResult.rows.length && !forwardResult.rows.length) return null;
    // A failed count must not cost us the rows: lineCount then falls back to
    // what was actually fetched, exactly as it does for a CSV read.
    const totalForwardRows = dbCount(forwardCountResult?.rows[0]?.total_count);
    return {
      summary: metricRowsToCsvFileData(summaryResult.rows),
      forwardReturns: metricRowsToCsvFileData([...forwardResult.rows].reverse(), totalForwardRows),
    };
  } catch {
    return null;
  }
});

const getDbSymbolSummary = cache(async (symbol: string): Promise<Record<string, unknown> | null> => {
  const latestRun = await latestDbScanRun();
  if (!latestRun) return null;
  try {
    const result = await dbQuery<DbJsonRow>(
      `
        SELECT summary
        FROM symbol_snapshots
        WHERE scan_run_id = $1
          AND symbol = $2
        LIMIT 1
      `,
      [latestRun.id, symbol],
    );
    if (!result.rows[0]) return null;
    return asRecord(result.rows[0].summary);
  } catch {
    return null;
  }
});

function symbolSlug(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(/*turbopackIgnore: true*/ filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileSignature(filePath: string) {
  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}

async function getFileLastUpdated(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ filePath);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

function coerceValue(key: string, value: unknown): ScannerScalar {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!text || ["nan", "none", "null"].includes(text.toLowerCase())) return undefined;

  if (NUMERIC_FIELDS.has(key)) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  return text;
}

function canonicalCsvKey(key: string) {
  return key.replace(/^\uFEFF/, "").trim();
}

function rawValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== undefined) return raw[key];
  }

  const targets = new Set(keys.map((key) => canonicalCsvKey(key).toLowerCase()));
  for (const [key, value] of Object.entries(raw)) {
    if (targets.has(canonicalCsvKey(key).toLowerCase())) return value;
  }

  return undefined;
}

function normalizeCsvRow(raw: Record<string, unknown>): CsvRow {
  const row: CsvRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = canonicalCsvKey(key);
    row[normalizedKey] = coerceValue(normalizedKey, value) ?? null;
  }
  return row;
}

export function displayName(row: Record<string, unknown>) {
  const symbol = String(row.symbol ?? "").trim().toUpperCase();
  for (const field of NAME_FIELDS) {
    const value = row[field];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (!text || ["nan", "none", "n/a", "unknown"].includes(text.toLowerCase())) continue;
    if (symbol && text.toUpperCase() === symbol) continue;
    return text;
  }
  return "";
}

function normalizeRankingRow(raw: Record<string, unknown>, fallbackLastUpdated?: string | null): RankingRow {
  const row: RankingRow = { symbol: "" };
  const mutableRow = row as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = canonicalCsvKey(key);
    if (STRUCTURED_RANKING_FIELDS.has(normalizedKey) && value && typeof value === "object") {
      mutableRow[normalizedKey] = value;
      continue;
    }
    row[normalizedKey] = coerceValue(normalizedKey, value);
  }

  row.symbol = String(row.symbol ?? rawValue(raw, "symbol", "ticker", "Symbol", "Ticker") ?? "").trim().toUpperCase();
  row.company_name = displayName(row);
  const lastUpdated = rowLastUpdated(raw, fallbackLastUpdated);
  if (lastUpdated) {
    row.last_updated = lastUpdated;
    row.last_updated_utc = lastUpdated;
  }
  return applyCorrectionMapFields(row);
}

function rowLastUpdated(raw: Record<string, unknown>, fallbackLastUpdated?: string | null) {
  return normalizedTimestamp(
    rawValue(
      raw,
      "last_updated",
      "last_updated_utc",
      "updated_at",
      "updated_at_utc",
      "timestamp_utc",
      "scan_timestamp",
      "scan_completed_at",
      "completed_at",
    ),
  ) ?? fallbackLastUpdated ?? null;
}

function actionForRow(row: RankingRow) {
  const explicit = String(row.action ?? row.recommended_action ?? row.composite_action ?? row.mid_action ?? row.short_action ?? row.long_action ?? "").trim();
  if (explicit) return explicit;
  const rating = String(row.rating ?? "").toUpperCase();
  if (rating === "TOP" || rating === "ACTIONABLE") return "ACTIONABLE";
  if (rating === "WATCH") return "WATCH";
  if (rating === "PASS") return "PASS";
  return "REVIEW";
}

async function readCsvPayload(filePath: string): Promise<CsvPayload> {
  const signature = await fileSignature(filePath);
  if (!signature) return { rows: [], columns: [], lineCount: 0 };

  const cached = csvPayloadCache.get(filePath);
  if (cached && cached.mtimeMs === signature.mtimeMs && cached.size === signature.size) {
    return cached.value;
  }

  const text = await fs.readFile(/*turbopackIgnore: true*/ filePath, "utf8");
  const fileName = path.basename(filePath);
  const lineCount = text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  let columns: string[] = [];
  let mismatchCount = 0;
  try {
    const headerRows = parse(text, {
      ...CSV_PARSE_OPTIONS,
      to_line: 1,
    }) as string[][];
    columns = (headerRows[0] ?? []).map(canonicalCsvKey);
    const rows = parse(text, {
      ...CSV_PARSE_OPTIONS,
      columns: true,
      on_record(record, context) {
        const invalidFieldLength = (context as { error?: { code?: string } }).error?.code === "CSV_RECORD_INCONSISTENT_COLUMNS";
        if (invalidFieldLength) {
          mismatchCount += 1;
        }
        return record;
      },
    }) as Record<string, unknown>[];
    if (mismatchCount) {
      console.warn(`[data] CSV row length mismatch in ${fileName}: ${mismatchCount} row${mismatchCount === 1 ? "" : "s"} had extra/missing columns; continuing with relaxed parsing.`);
    }
    const value = { rows, columns, lineCount };
    csvPayloadCache.set(filePath, { ...signature, value });
    return value;
  } catch (error) {
    console.warn(`[data] failed to parse CSV ${fileName}; returning schema mismatch state.`, error);
    const value = { rows: [], columns, lineCount };
    csvPayloadCache.set(filePath, { ...signature, value });
    return value;
  }
}

async function readCsv(filePath: string) {
  return (await readCsvPayload(filePath)).rows;
}

async function readCsvColumns(filePath: string): Promise<string[]> {
  const handle = await fs.open(/*turbopackIgnore: true*/ filePath, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const firstLine = buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/, 1)[0] ?? "";
    if (!firstLine.trim()) return [];
    const headerRows = parse(firstLine, {
      ...CSV_PARSE_OPTIONS,
      to_line: 1,
    }) as string[][];
    return (headerRows[0] ?? []).map(canonicalCsvKey);
  } catch {
    return [];
  } finally {
    await handle.close();
  }
}

function missingRankingColumns(columns: string[]) {
  const available = new Set(columns);
  return REQUIRED_RANKING_COLUMNS.filter((column) => !available.has(column));
}

async function readScannerCsv(...parts: string[]) {
  const rows = await readCsv(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), ...parts));
  return rows.map(normalizeCsvRow);
}

async function readScannerCsvWithState(...parts: string[]): Promise<CsvFileData> {
  return readScannerCsvWithStateParts(parts);
}

async function readScannerCsvWithStateParts(parts: string[], options: { tailRows?: number } = {}): Promise<CsvFileData> {
  const filePath = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), ...parts);
  if (!(await fileExists(filePath))) {
    return { rows: [], state: "missing", columns: [], lineCount: 0 };
  }

  if (!options.tailRows) {
    const payload = await readCsvPayload(filePath);
    if (payload.lineCount <= 1) {
      return { rows: [], state: "header-only", columns: payload.columns, lineCount: payload.lineCount };
    }
    return {
      rows: payload.rows.map(normalizeCsvRow),
      state: payload.rows.length ? "data" : "header-only",
      columns: payload.columns,
      lineCount: payload.lineCount,
    };
  }

  const text = await fs.readFile(/*turbopackIgnore: true*/ filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines[0] ?? "";
  const columns = header ? ((parse(header, { ...CSV_PARSE_OPTIONS }) as string[][])[0] ?? []).map(canonicalCsvKey) : [];
  if (lines.length <= 1) {
    return { rows: [], state: "header-only", columns, lineCount: lines.length };
  }
  const tailText = [header, ...lines.slice(-Math.max(1, options.tailRows))].join("\n");
  let rows: Record<string, unknown>[] = [];
  let mismatchCount = 0;
  try {
    rows = parse(tailText, {
      ...CSV_PARSE_OPTIONS,
      columns: true,
      on_record(record, context) {
        const invalidFieldLength = (context as { error?: { code?: string } }).error?.code === "CSV_RECORD_INCONSISTENT_COLUMNS";
        if (invalidFieldLength) {
          mismatchCount += 1;
        }
        return record;
      },
    }) as Record<string, unknown>[];
    if (mismatchCount) {
      console.warn(`[data] CSV row length mismatch in ${path.basename(filePath)} tail read: ${mismatchCount} row${mismatchCount === 1 ? "" : "s"} had extra/missing columns; continuing with relaxed parsing.`);
    }
  } catch (error) {
    console.warn(`[data] failed to parse CSV ${path.basename(filePath)}; returning empty data state.`, error);
  }

  return {
    rows: rows.map(normalizeCsvRow),
    state: rows.length ? "data" : "header-only",
    columns,
    lineCount: lines.length,
  };
}

export async function readJson(filePath: string) {
  const signature = await fileSignature(filePath);
  if (!signature) return null;

  const cached = jsonPayloadCache.get(filePath);
  if (cached && cached.mtimeMs === signature.mtimeMs && cached.size === signature.size) {
    return cached.value;
  }

  try {
    const value = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ filePath, "utf8")) as Record<string, unknown>;
    jsonPayloadCache.set(filePath, { ...signature, value });
    return value;
  } catch {
    jsonPayloadCache.set(filePath, { ...signature, value: null });
    return null;
  }
}

export const getFullRanking = cache(async (): Promise<RankingRow[]> => {
  const dbRows = await getDbRankingRows();
  if (dbRows) return dbRows;
  if (!allowScannerCsvFallback("full ranking DB read unavailable")) return [];

  const filePath = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "full_ranking.csv");
  if (!(await fileExists(filePath))) return [];
  const [{ rows, columns }, lastUpdated] = await Promise.all([readCsvPayload(filePath), getFileLastUpdated(filePath)]);
  const missing = missingRankingColumns(columns);
  if (missing.length) {
    console.error(`[data] schema mismatch in full_ranking.csv: missing columns ${missing.join(", ")}`);
    return [];
  }
  return rows.map((row) => normalizeRankingRow(row, lastUpdated)).filter((row) => row.symbol);
});

export const getTopCandidates = cache(async (): Promise<RankingRow[]> => {
  const dbRows = await getDbRankingRows(20);
  if (dbRows) return dbRows;
  if (!allowScannerCsvFallback("top candidates DB read unavailable")) return [];

  const filePath = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "top_candidates.csv");
  if (!(await fileExists(filePath))) return [];
  const [{ rows, columns }, lastUpdated] = await Promise.all([readCsvPayload(filePath), getFileLastUpdated(filePath)]);
  const missing = missingRankingColumns(columns);
  if (missing.length) {
    console.error(`[data] schema mismatch in top_candidates.csv: missing columns ${missing.join(", ")}`);
    return [];
  }
  return rows.map((row) => normalizeRankingRow(row, lastUpdated)).filter((row) => row.symbol);
});

export const getScanDataHealth = cache(async (): Promise<ScanDataHealth> => {
  const latestRun = await latestDbScanRun();
  if (latestRun) {
    const lastUpdated = dbTimestamp(latestRun.completed_at) ?? dbTimestamp(latestRun.created_at);
    const freshness = freshnessFromTimestamp(lastUpdated, Date.now());
    return {
      ...freshness,
      files: [
        {
          ...freshness,
          name: "postgres:scan_runs",
          missingColumns: [],
        },
        {
          ...freshness,
          name: "postgres:scanner_signals",
          missingColumns: [],
        },
      ],
      lastUpdated: freshness.lastUpdated ?? lastUpdated,
    };
  }

  if (!allowScannerCsvFallback("scan data health DB read unavailable")) {
    const unavailable = unavailableFreshness("missing", "Scanner database output is not available yet.");
    return {
      ...unavailable,
      files: [
        { ...unavailable, name: "postgres:scan_runs", missingColumns: [] },
        { ...unavailable, name: "postgres:scanner_signals", missingColumns: [] },
      ],
      lastUpdated: unavailable.lastUpdated,
    };
  }

  const now = Date.now();
  const files = await Promise.all(
    ["full_ranking.csv", "top_candidates.csv"].map(async (name) => {
      const filePath = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), name);
      if (!(await fileExists(filePath))) {
        const missing = unavailableFreshness("missing", `${name} is not available yet.`);
        return { ...missing, name, missingColumns: [] };
      }
      const stat = await fs.stat(/*turbopackIgnore: true*/ filePath);
      const lastUpdated = stat.mtime.toISOString();
      const freshness = freshnessFromTimestamp(lastUpdated, now);
      const columns = await readCsvColumns(filePath);
      const missingColumns = missingRankingColumns(columns);
      if (missingColumns.length) {
        const mismatch = unavailableFreshness("schema_mismatch", `${name} is missing required columns: ${missingColumns.join(", ")}.`);
        return { ...mismatch, lastUpdated, name, ageMinutes: freshness.ageMinutes, humanAge: freshness.humanAge, missingColumns };
      }
      return { ...freshness, name, missingColumns };
    }),
  );

  const lastUpdatedValues = files.map((file) => file.lastUpdated).filter((value): value is string => Boolean(value));
  const lastUpdated = lastUpdatedValues.length ? lastUpdatedValues.sort()[0] ?? null : null;
  const limitingFile = files
    .filter((file) => file.status !== "missing" && file.status !== "schema_mismatch")
    .sort((left, right) => statusRank(right.status) - statusRank(left.status) || (right.ageMinutes ?? 0) - (left.ageMinutes ?? 0))[0];
  const baseFreshness = freshnessFromTimestamp(limitingFile?.lastUpdated ?? lastUpdated, now);
  const combined = files.some((file) => file.status === "missing")
    ? unavailableFreshness("missing", "Scanner output is not available yet.")
    : files.some((file) => file.status === "schema_mismatch")
      ? unavailableFreshness("schema_mismatch", "Scanner output is available but required columns are missing.")
      : baseFreshness;

  return { ...combined, files, lastUpdated: combined.lastUpdated ?? lastUpdated };
});

function statusRank(status: DataFreshnessStatus) {
  if (status === "stale") return 2;
  if (status === "slightly_stale") return 1;
  return 0;
}

function parseSnapshotTimestamp(name: string) {
  const match = /^scan_(\d{8})_(\d{6})\.csv$/.exec(name);
  if (!match) return null;
  const [, date, time] = match;
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
}

export const getHistorySummary = cache(async (): Promise<HistorySummary> => {
  try {
    const [aggregateResult, snapshotResult] = await Promise.all([
      dbQuery<DbHistoryAggregateRow>(
        `
          WITH successful AS (
            SELECT COALESCE(completed_at, created_at) AS scan_ts
            FROM scan_runs
            WHERE status = 'success'
          ),
          dates AS (
            SELECT DISTINCT scan_ts::date AS scan_date
            FROM successful
            WHERE scan_ts IS NOT NULL
          )
          SELECT
            count(*)::text AS total_count,
            min(scan_ts) AS earliest,
            max(scan_ts) AS latest,
            COALESCE((SELECT array_agg(scan_date::text ORDER BY scan_date ASC) FROM dates), ARRAY[]::text[]) AS unique_dates
          FROM successful
        `,
      ),
      dbQuery<DbHistorySummaryRow>(
        `
          SELECT id::text, completed_at, created_at
          FROM scan_runs
          WHERE status = 'success'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 240
        `,
      ),
    ]);
    const aggregate = aggregateResult.rows[0] ?? null;
    const totalCount = dbCount(aggregate?.total_count) ?? snapshotResult.rows.length;
    if (aggregate || snapshotResult.rows.length) {
      const snapshots = snapshotResult.rows.map((row) => {
        const timestamp = dbTimestamp(row.completed_at) ?? dbTimestamp(row.created_at);
        return {
          name: `db_${row.id}`,
          modifiedAt: timestamp ?? new Date().toISOString(),
          timestamp,
        };
      });
      return {
        snapshots,
        count: totalCount,
        earliest: dbTimestamp(aggregate?.earliest) ?? null,
        latest: dbTimestamp(aggregate?.latest) ?? null,
        uniqueDates: Array.isArray(aggregate?.unique_dates) ? aggregate.unique_dates : [],
      };
    }
  } catch {
    // CSV fallback is explicit because Postgres is the production source of truth.
  }

  if (!allowScannerCsvFallback("history summary DB read unavailable")) {
    return { snapshots: [], count: 0, earliest: null, latest: null, uniqueDates: [] };
  }

  const historyDir = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "history");
  let entries: string[] = [];

  try {
    entries = await fs.readdir(/*turbopackIgnore: true*/ historyDir);
  } catch {
    entries = [];
  }

  const snapshots = (
    await Promise.all(
      entries
        .filter((entry) => /^scan_.*\.csv$/.test(entry))
        .map(async (name): Promise<HistorySnapshot | null> => {
          const filePath = path.join(/*turbopackIgnore: true*/ historyDir, name);
          try {
            const stat = await fs.stat(/*turbopackIgnore: true*/ filePath);
            return {
              name,
              modifiedAt: stat.mtime.toISOString(),
              timestamp: parseSnapshotTimestamp(name),
            };
          } catch {
            return null;
          }
        }),
    )
  ).filter((snapshot): snapshot is HistorySnapshot => Boolean(snapshot));

  snapshots.sort((a, b) => String(b.timestamp ?? b.modifiedAt).localeCompare(String(a.timestamp ?? a.modifiedAt)));
  const dated = snapshots.map((snapshot) => snapshot.timestamp).filter((timestamp): timestamp is string => Boolean(timestamp));
  const uniqueDates = Array.from(new Set(dated.map((timestamp) => timestamp.slice(0, 10)))).sort();

  return {
    snapshots,
    count: snapshots.length,
    earliest: dated.length ? dated[dated.length - 1] : null,
    latest: dated.length ? dated[0] : null,
    uniqueDates,
  };
});

export async function getSymbolHistoryData(): Promise<SymbolHistoryData> {
  const dbRows = await getDbHistoryRows();
  if (dbRows) {
    return {
      symbols: Array.from(new Set(dbRows.map((row) => row.symbol))).sort(),
      rows: dbRows,
    };
  }
  if (!allowScannerCsvFallback("symbol history DB read unavailable")) return { symbols: [], rows: [] };

  const history = await getHistorySummary();
  const rows: SymbolHistoryRow[] = [];

  for (const snapshot of history.snapshots) {
    const snapshotRows = await readCsv(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "history", snapshot.name));
    const fallbackTimestamp = snapshot.timestamp ?? snapshot.modifiedAt;

    for (const raw of snapshotRows) {
      const row = normalizeRankingRow(raw) as SymbolHistoryRow;
      if (!row.symbol) continue;
      row.timestamp_utc = String(rawValue(raw, "timestamp_utc", "datetime", "date", "timestamp") ?? fallbackTimestamp);
      row.source_file = snapshot.name;
      rows.push(row);
    }
  }

  rows.sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)));

  return {
    symbols: Array.from(new Set(rows.map((row) => row.symbol))).sort(),
    rows,
  };
}

export async function getHistorySymbolsFromSnapshots(maxSnapshots = 20): Promise<string[]> {
  try {
    const result = await dbQuery<DbSymbolRow>(
      `
        WITH latest_runs AS (
          SELECT id
          FROM scan_runs
          WHERE status = 'success'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT $1
        )
        SELECT DISTINCT ss.symbol
        FROM scanner_signals ss
        JOIN latest_runs lr ON lr.id = ss.scan_run_id
        ORDER BY ss.symbol ASC
      `,
      [Math.max(1, maxSnapshots)],
    );
    if (result.rows.length) return result.rows.map((row) => row.symbol);
  } catch {
    // CSV fallback is explicit because Postgres is the production source of truth.
  }

  if (!allowScannerCsvFallback("history symbols DB read unavailable")) return [];

  const history = await getHistorySummary();
  const symbols = new Set<string>();

  for (const snapshot of history.snapshots.slice(0, Math.max(1, maxSnapshots))) {
    const snapshotRows = await readCsv(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "history", snapshot.name));
    for (const raw of snapshotRows) {
      const symbol = String(rawValue(raw, "symbol", "ticker", "Symbol", "Ticker") ?? "").trim().toUpperCase();
      if (symbol) symbols.add(symbol);
    }
  }

  return Array.from(symbols).sort();
}

async function getPerSymbolHistoryForSymbol(symbol: string): Promise<SymbolHistoryRow[]> {
  const cleaned = symbol.trim().toUpperCase();
  if (!cleaned) return [];
  if (!allowScannerCsvFallback(`per-symbol history DB read unavailable for ${cleaned}`)) return [];
  const filePath = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "symbols", symbolSlug(cleaned), "history.csv");
  if (!(await fileExists(filePath))) return [];

  const rows = await readCsv(filePath);
  return rows
    .map((raw) => {
      const row = normalizeRankingRow(raw) as SymbolHistoryRow;
      row.symbol = String(row.symbol || rawValue(raw, "ticker", "Symbol", "Ticker") || cleaned).trim().toUpperCase();
      row.timestamp_utc = String(rawValue(raw, "timestamp_utc", "datetime", "date", "timestamp") ?? "");
      row.source_file = `symbols/${symbolSlug(cleaned)}/history.csv`;
      return row;
    })
    .filter((row) => row.symbol === cleaned && Boolean(row.timestamp_utc))
    .sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)));
}

export async function getSymbolHistoryLookup(symbol: string): Promise<{ matchingRows: number; rows: SymbolHistoryRow[]; snapshotsScanned: number; source: "none" | "per-symbol" | "snapshots" }> {
  const cleaned = symbol.trim().toUpperCase();
  if (!cleaned) return { matchingRows: 0, rows: [], snapshotsScanned: 0, source: "none" };
  const dbRows = await getDbHistoryRows(cleaned);
  if (dbRows) {
    return {
      matchingRows: dbRows.length,
      rows: dbRows,
      snapshotsScanned: new Set(dbRows.map((row) => row.source_file)).size,
      source: dbRows.length ? "snapshots" : "none",
    };
  }

  if (!allowScannerCsvFallback(`symbol history lookup DB read unavailable for ${cleaned}`)) {
    return { matchingRows: 0, rows: [], snapshotsScanned: 0, source: "none" };
  }

  const history = await getHistorySummary();
  const rows: SymbolHistoryRow[] = [];

  for (const snapshot of history.snapshots) {
    const snapshotRows = await readCsv(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "history", snapshot.name));
    const fallbackTimestamp = snapshot.timestamp ?? snapshot.modifiedAt;

    for (const raw of snapshotRows) {
      const row = normalizeRankingRow(raw) as SymbolHistoryRow;
      if (row.symbol !== cleaned) continue;
      if (!row.symbol) continue;
      row.timestamp_utc = String(rawValue(raw, "timestamp_utc", "datetime", "date", "timestamp") ?? fallbackTimestamp);
      row.action = actionForRow(row);
      row.source_file = snapshot.name;
      rows.push(row);
    }
  }

  const snapshotRows = rows.sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)));
  if (snapshotRows.length) {
    return {
      matchingRows: snapshotRows.length,
      rows: snapshotRows,
      snapshotsScanned: history.snapshots.length,
      source: "snapshots",
    };
  }

  const perSymbolRows = await getPerSymbolHistoryForSymbol(cleaned);
  return {
    matchingRows: perSymbolRows.length,
    rows: perSymbolRows,
    snapshotsScanned: history.snapshots.length,
    source: perSymbolRows.length ? "per-symbol" : "none",
  };
}

export async function getSymbolHistoryForSymbol(symbol: string): Promise<SymbolHistoryRow[]> {
  return (await getSymbolHistoryLookup(symbol)).rows;
}

export function buildIntradaySignalDrift(history: SymbolHistoryData): IntradayDriftRow[] {
  const bySymbol = new Map<string, SymbolHistoryRow[]>();

  for (const row of history.rows) {
    const current = bySymbol.get(row.symbol) ?? [];
    current.push(row);
    bySymbol.set(row.symbol, current);
  }

  const driftRows: IntradayDriftRow[] = [];
  for (const [symbol, rows] of bySymbol) {
    rows.sort((a, b) => String(a.timestamp_utc).localeCompare(String(b.timestamp_utc)));
    const first = rows[0];
    const latest = rows[rows.length - 1];
    const firstPrice = typeof first.price === "number" ? first.price : undefined;
    const latestPrice = typeof latest.price === "number" ? latest.price : undefined;
    const firstScore = typeof first.final_score === "number" ? first.final_score : undefined;
    const latestScore = typeof latest.final_score === "number" ? latest.final_score : undefined;
    const priceChange = typeof firstPrice === "number" && typeof latestPrice === "number" ? latestPrice - firstPrice : undefined;
    const priceChangePct = typeof priceChange === "number" && typeof firstPrice === "number" && firstPrice !== 0 ? priceChange / firstPrice : undefined;
    const scoreChange = typeof firstScore === "number" && typeof latestScore === "number" ? latestScore - firstScore : undefined;

    driftRows.push({
      symbol,
      company_name: latest.company_name || first.company_name,
      first_price: firstPrice,
      latest_price: latestPrice,
      price_change: priceChange,
      price_change_pct: priceChangePct,
      first_score: firstScore,
      latest_score: latestScore,
      score_change: scoreChange,
      first_rating: first.rating,
      latest_rating: latest.rating,
      first_action: actionForRow(first),
      latest_action: actionForRow(latest),
      setup_type: latest.setup_type ?? first.setup_type,
      snapshot_count: rows.length,
    });
  }

  return driftRows.sort((a, b) => Math.abs(b.score_change ?? 0) - Math.abs(a.score_change ?? 0));
}

export async function getIntradaySignalDrift(): Promise<IntradayDriftRow[]> {
  return buildIntradaySignalDrift(await getSymbolHistoryData());
}

export async function getIntradaySignalDriftSummary(): Promise<IntradayDriftRow[]> {
  const dbHistory = await getRecentDbHistoryRows(24, 18, 2);
  if (dbHistory) return buildIntradaySignalDrift({ symbols: Array.from(new Set(dbHistory.map((row) => row.symbol))).sort(), rows: dbHistory });

  if (!allowScannerCsvFallback("intraday signal drift DB read unavailable")) return [];
  return getCsvIntradaySignalDriftSummary();
}

async function getCsvIntradaySignalDriftSummary(): Promise<IntradayDriftRow[]> {
  const history = await getHistorySummary();
  const latestSnapshot = history.snapshots[0];
  const earliestSnapshot = history.snapshots[history.snapshots.length - 1];
  if (!latestSnapshot) return [];

  const latestRows = (await readCsv(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "history", latestSnapshot.name))).map((row) => normalizeRankingRow(row, latestSnapshot.timestamp ?? latestSnapshot.modifiedAt)).filter((row) => row.symbol);
  const earliestRows =
    earliestSnapshot && earliestSnapshot.name !== latestSnapshot.name
      ? (await readCsv(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "history", earliestSnapshot.name))).map((row) => normalizeRankingRow(row, earliestSnapshot.timestamp ?? earliestSnapshot.modifiedAt)).filter((row) => row.symbol)
      : latestRows;
  const firstBySymbol = new Map(earliestRows.map((row) => [row.symbol, row]));
  const latestBySymbol = new Map(latestRows.map((row) => [row.symbol, row]));
  const symbols = Array.from(new Set([...firstBySymbol.keys(), ...latestBySymbol.keys()])).sort();

  const driftRows: IntradayDriftRow[] = [];
  for (const symbol of symbols) {
    const first = firstBySymbol.get(symbol) ?? latestBySymbol.get(symbol);
    const latest = latestBySymbol.get(symbol) ?? firstBySymbol.get(symbol);
    if (!first || !latest) continue;
    const firstPrice = typeof first.price === "number" ? first.price : undefined;
    const latestPrice = typeof latest.price === "number" ? latest.price : undefined;
    const firstScore = typeof first.final_score === "number" ? first.final_score : undefined;
    const latestScore = typeof latest.final_score === "number" ? latest.final_score : undefined;
    const priceChange = typeof firstPrice === "number" && typeof latestPrice === "number" ? latestPrice - firstPrice : undefined;
    const priceChangePct = typeof priceChange === "number" && typeof firstPrice === "number" && firstPrice !== 0 ? priceChange / firstPrice : undefined;
    const scoreChange = typeof firstScore === "number" && typeof latestScore === "number" ? latestScore - firstScore : undefined;

    driftRows.push({
      symbol,
      company_name: latest.company_name || first.company_name,
      first_price: firstPrice,
      latest_price: latestPrice,
      price_change: priceChange,
      price_change_pct: priceChangePct,
      first_score: firstScore,
      latest_score: latestScore,
      score_change: scoreChange,
      first_rating: first.rating,
      latest_rating: latest.rating,
      first_action: actionForRow(first),
      latest_action: actionForRow(latest),
      setup_type: latest.setup_type ?? first.setup_type,
      snapshot_count: earliestSnapshot && earliestSnapshot.name !== latestSnapshot.name ? 2 : 1,
    });
  }

  return driftRows.sort((a, b) => Math.abs(b.score_change ?? 0) - Math.abs(a.score_change ?? 0));
}

export async function getRecentIntradaySignalDriftSummary(options: { hours?: number; maxRuns?: number; minRuns?: number } = {}): Promise<IntradayDriftRow[]> {
  const hours = Math.max(1, Math.min(24, Math.trunc(options.hours ?? 8)));
  const maxRuns = Math.max(2, Math.min(32, Math.trunc(options.maxRuns ?? 18)));
  const minRuns = Math.max(1, Math.min(maxRuns, Math.trunc(options.minRuns ?? 2)));
  const dbHistory = await getRecentDbHistoryRows(hours, maxRuns, minRuns);
  if (dbHistory) return buildIntradaySignalDrift({ symbols: Array.from(new Set(dbHistory.map((row) => row.symbol))).sort(), rows: dbHistory });
  if (!allowScannerCsvFallback("recent intraday signal drift DB read unavailable")) return [];
  return getCsvIntradaySignalDriftSummary();
}

const getRecentDbHistoryRows = cache(async (hours: number, maxRuns: number, minRuns: number): Promise<SymbolHistoryRow[] | null> => {
  try {
    const result = await dbQuery<DbHistoryRow>(
      `
        WITH ranked_runs AS (
          SELECT
            id,
            completed_at,
            created_at,
            COALESCE(completed_at, created_at) AS scan_ts,
            row_number() OVER (ORDER BY completed_at DESC NULLS LAST, created_at DESC) AS rn
          FROM scan_runs
          WHERE status = 'success'
        ),
        bounded_runs AS (
          SELECT *
          FROM ranked_runs
          WHERE rn <= $1
            AND (
              scan_ts >= now() - ($2::int * interval '1 hour')
              OR rn <= $3
            )
          -- Redundant for correctness, load-bearing for the planner. The rn
          -- bound already caps this at $1 rows and the OR only removes more, so
          -- the LIMIT can never drop a qualifying run. Without it Postgres estimated
          -- 6048 runs instead of 18 and chose a hash join fed by a sequential
          -- scan of all 2.93M scanner_signals rows (790MB) to find 6.4k of them:
          -- 405ms. With it the planner uses idx_scanner_signals_scan_run_id and
          -- the same query runs in 7.6ms off 504 buffers.
          LIMIT $1
        )
        SELECT
          ss.scan_run_id::text,
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
          ss.created_at,
          br.completed_at
        FROM scanner_signals ss
        JOIN bounded_runs br ON br.id = ss.scan_run_id
        ORDER BY br.scan_ts ASC, ss.rank_position ASC NULLS LAST, ss.symbol ASC
      `,
      [maxRuns, hours, minRuns],
    );
    return result.rows.map((row) => {
      const ranking = dbSignalToRankingRow(row) as SymbolHistoryRow;
      ranking.timestamp_utc = dbTimestamp(row.completed_at) ?? dbTimestamp(row.created_at) ?? "";
      ranking.source_file = `db:${row.scan_run_id}`;
      return ranking;
    });
  } catch {
    return null;
  }
});

export async function getRecentScannerHistoryRows(options: { hours?: number; maxRuns?: number; minRuns?: number } = {}): Promise<SymbolHistoryRow[]> {
  const hours = Math.max(1, Math.min(168, Math.trunc(options.hours ?? 72)));
  const maxRuns = Math.max(2, Math.min(256, Math.trunc(options.maxRuns ?? 32)));
  const minRuns = Math.max(1, Math.min(maxRuns, Math.trunc(options.minRuns ?? 3)));
  const dbHistory = await getRecentDbHistoryRows(hours, maxRuns, minRuns);
  return dbHistory ?? [];
}

export async function getPerformanceData(options: { forwardTailRows?: number } = {}): Promise<PerformanceData> {
  const dbPerformance = await getDbPerformanceData(options.forwardTailRows);
  if (dbPerformance) {
    const [lifecycle, lifecycleSummary, autoCalibration] = await Promise.all([
      readScannerCsvWithState("analysis", "signal_lifecycle.csv"),
      readScannerCsvWithState("analysis", "signal_lifecycle_summary.csv"),
      readScannerCsvWithState("analysis", "auto_calibration_recommendations.csv"),
    ]);
    const lifecycleFallback = lifecycleRowsFromForwardReturns(dbPerformance.forwardReturns.rows);
    const lifecycleData = lifecycle.rows.length ? lifecycle : rowsToCsvFileData(lifecycleFallback);
    const lifecycleSummaryData = lifecycleSummary.rows.length ? lifecycleSummary : rowsToCsvFileData(lifecycleSummaryRows(lifecycleFallback));
    return { ...dbPerformance, lifecycle: lifecycleData, lifecycleSummary: lifecycleSummaryData, autoCalibration };
  }

  if (!allowScannerCsvFallback("performance summary DB read unavailable")) {
    const empty = rowsToCsvFileData([]);
    return {
      summary: empty,
      forwardReturns: rowsToCsvFileData([]),
      lifecycle: rowsToCsvFileData([]),
      lifecycleSummary: rowsToCsvFileData([]),
      autoCalibration: rowsToCsvFileData([]),
    };
  }

  const [summary, forwardReturns, lifecycle, lifecycleSummary, autoCalibration] = await Promise.all([
    readScannerCsvWithState("analysis", "performance_summary.csv"),
    readScannerCsvWithStateParts(["analysis", "forward_returns.csv"], { tailRows: options.forwardTailRows }),
    readScannerCsvWithState("analysis", "signal_lifecycle.csv"),
    readScannerCsvWithState("analysis", "signal_lifecycle_summary.csv"),
    readScannerCsvWithState("analysis", "auto_calibration_recommendations.csv"),
  ]);
  return { summary, forwardReturns, lifecycle, lifecycleSummary, autoCalibration };
}

function lifecycleRowsFromForwardReturns(rows: CsvRow[]): CsvRow[] {
  const lifecycleRows: CsvRow[] = [];
  for (const row of rows) {
    const returnPct = finiteCsvNumber(row.return_pct ?? row.forward_return);
    const symbol = cleanCsvText(row.symbol);
    const signalDate = cleanCsvText(row.signal_date ?? row.timestamp_utc ?? row.created_at ?? row.date);
    if (returnPct === null || !symbol || !signalDate) continue;
    const status = lifecycleStatusFromReturn(returnPct);
    lifecycleRows.push({
      ...row,
      action: row.action ?? row.final_decision ?? row.rating ?? "COMPLETED_EVIDENCE",
      avg_return_pct: returnPct,
      days_to_entry: finiteCsvNumber(row.days_to_entry) ?? 0,
      days_to_exit: finiteCsvNumber(row.days_to_exit) ?? horizonDays(row.horizon),
      entry_date: row.entry_date ?? signalDate,
      max_drawdown: finiteCsvNumber(row.max_drawdown ?? row.max_drawdown_after_signal),
      max_gain: finiteCsvNumber(row.max_gain ?? row.max_gain_after_signal),
      return_pct: returnPct,
      signal_date: signalDate,
      status,
      symbol,
    });
  }
  return lifecycleRows;
}

function lifecycleSummaryRows(rows: CsvRow[]): CsvRow[] {
  const groups = new Map<string, CsvRow[]>();
  for (const row of rows) {
    addLifecycleGroup(groups, "horizon", cleanCsvText(row.horizon, "unknown"), row);
    addLifecycleGroup(groups, "decision", cleanCsvText(row.final_decision ?? row.action, "unknown"), row);
    addLifecycleGroup(groups, "setup", cleanCsvText(row.setup_type, "unknown"), row);
  }

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const [groupType = "group", groupValue = "unknown"] = key.split(":", 2);
      const count = groupRows.length;
      const returns = groupRows.map((row) => finiteCsvNumber(row.return_pct)).filter((value): value is number => value !== null);
      const daysToExit = groupRows.map((row) => finiteCsvNumber(row.days_to_exit)).filter((value): value is number => value !== null);
      const statusCount = (status: string) => groupRows.filter((row) => cleanCsvText(row.status).toUpperCase() === status).length;
      return {
        avg_days_to_entry: 0,
        avg_days_to_exit: meanNumber(daysToExit),
        avg_return_pct: meanNumber(returns),
        count,
        entry_reached_rate: 1,
        expired_rate: count ? statusCount("EXPIRED") / count : 0,
        group_type: groupType,
        group_value: groupValue,
        open_rate: 0,
        stop_hit_rate: count ? statusCount("STOP_HIT") / count : 0,
        target_hit_rate: count ? statusCount("TARGET_HIT") / count : 0,
      };
    })
    .sort((left, right) => Number(right.count ?? 0) - Number(left.count ?? 0))
    .slice(0, 120);
}

function addLifecycleGroup(groups: Map<string, CsvRow[]>, type: string, value: string, row: CsvRow): void {
  const key = `${type}:${value || "unknown"}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
}

function lifecycleStatusFromReturn(returnPct: number): string {
  if (returnPct >= 0.03) return "TARGET_HIT";
  if (returnPct <= -0.03) return "STOP_HIT";
  return "EXPIRED";
}

function horizonDays(value: unknown): number | null {
  const text = cleanCsvText(value).toUpperCase();
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanCsvText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text && !["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase()) ? text : fallback;
}

function meanNumber(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function getCalibrationInsights() {
  const fileInsights = await readJson(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "analysis", "calibration_insights.json"));
  if (fileInsights) return fileInsights;

  const dbPerformance = await getDbPerformanceData(5000).catch(() => null);
  if (!dbPerformance?.summary.rows.length) return null;
  return calibrationInsightsFromSummaryRows(dbPerformance.summary.rows);
}

type CalibrationCandidate = CsvRow & {
  avg_return: number;
  count: number;
  edge_score: number;
  group_type: string;
  group_value: string;
  hit_rate: number | null;
  horizon: string;
  label: string;
  low_sample: boolean;
};

function calibrationInsightsFromSummaryRows(rows: CsvRow[]): Record<string, unknown> | null {
  const candidates: CalibrationCandidate[] = [];
  for (const row of rows) {
    const count = finiteCsvNumber(row.count);
    const avgReturn = finiteCsvNumber(row.avg_return);
    const hitRate = finiteCsvNumber(row.hit_rate);
    if (count === null || count < 3 || avgReturn === null) continue;
    const groupType = String(row.group_type ?? "").trim();
    const groupValue = String(row.group_value ?? "").trim();
    const horizon = String(row.horizon ?? "").trim();
    if (!groupType || !groupValue || !horizon) continue;
    const edgeScore = finiteCsvNumber(row.edge_score) ?? ((avgReturn * 100) + (((hitRate ?? 0.5) - 0.5) * 10));
    candidates.push({
      ...row,
      avg_return: avgReturn,
      count,
      edge_score: edgeScore,
      group_type: groupType,
      group_value: groupValue,
      hit_rate: hitRate,
      horizon,
      label: `${groupType}: ${groupValue} over ${horizon}`,
      low_sample: count < 30,
    });
  }

  if (!candidates.length) return null;

  const byStrength = [...candidates].sort((left, right) => {
    const returnDiff = right.avg_return - left.avg_return;
    if (returnDiff !== 0) return returnDiff;
    return right.count - left.count;
  });
  const byWeakness = [...candidates].sort((left, right) => {
    const returnDiff = left.avg_return - right.avg_return;
    if (returnDiff !== 0) return returnDiff;
    return right.count - left.count;
  });
  const best = byStrength[0] ?? null;
  const worst = byWeakness[0] ?? null;
  const lowSample = candidates.filter((row) => row.count < 30).slice(0, 5);

  return {
    best_group: best,
    generated_at: new Date().toISOString(),
    low_sample_warnings: lowSample.map((row) => `${row.group_type}:${row.group_value} has ${row.count} completed samples in ${row.horizon}.`),
    rating_action_note: best ? `${best.label} is the strongest completed-evidence group in the latest stored performance summary.` : "Completed evidence is still developing.",
    score_bucket_note: `${candidates.length.toLocaleString()} grouped performance rows were loaded from stored production evidence.`,
    setup_note: worst ? `${worst.label} is the weakest completed-evidence group and should stay visible as caution context.` : "No weak completed-evidence group is available yet.",
    source: "postgres:performance_summary",
    warnings: lowSample.length ? ["Some groups remain early evidence and should not be over-interpreted."] : [],
    worst_group: worst,
  };
}

function finiteCsvNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getMarketRegime() {
  const latestRun = await latestDbScanRun();
  if (latestRun) {
    const metadata = asRecord(latestRun.metadata);
    const nested = asRecord(metadata.market_regime);
    return {
      ...nested,
      regime: nested.regime ?? latestRun.market_regime,
      source: "postgres",
      updated_at: dbTimestamp(latestRun.completed_at) ?? dbTimestamp(latestRun.created_at),
    };
  }
  if (!allowScannerCsvFallback("market regime DB read unavailable")) return null;
  return readJson(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "analysis", "market_regime.json"));
}

export async function getMarketStructure() {
  const latestRun = await latestDbScanRun();
  if (latestRun) {
    const metadata = asRecord(latestRun.metadata);
    const nested = asRecord(metadata.market_structure);
    return {
      ...nested,
      breadth: nested.breadth ?? latestRun.breadth,
      leadership: nested.leadership ?? latestRun.leadership,
      source: "postgres",
      updated_at: dbTimestamp(latestRun.completed_at) ?? dbTimestamp(latestRun.created_at),
    };
  }
  if (!allowScannerCsvFallback("market structure DB read unavailable")) return null;
  return readJson(path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "analysis", "market_structure.json"));
}

type SymbolDetailCacheEntry = {
  expiresAt: number;
  hasValue: boolean;
  inflight?: Promise<SymbolDetail>;
  staleUntil: number;
  value: SymbolDetail | null;
};

const SYMBOL_DETAIL_CACHE_TTL_MS = 20 * 60_000;
const SYMBOL_DETAIL_CACHE_STALE_MS = 60 * 60_000;
const SYMBOL_DETAIL_CACHE_MAX = 240;
const symbolDetailCache = new Map<string, SymbolDetailCacheEntry>();

export async function getSymbolDetail(symbol: string, period = "all"): Promise<SymbolDetail> {
  const cleaned = cleanSymbolForDetail(symbol);
  const normalizedPeriod = normalizeSymbolPeriod(period);
  return readSymbolDetailCache(`${cleaned}|${normalizedPeriod}`, () => getSymbolDetailUncached(cleaned, normalizedPeriod));
}

async function getSymbolDetailUncached(cleaned: string, period: string): Promise<SymbolDetail> {
  const ranking = await getFullRanking();
  const row = ranking.find((item) => item.symbol === cleaned) ?? null;
  const dbSummary = await getDbSymbolSummary(cleaned);
  const symbolDir = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "symbols", symbolSlug(cleaned));
  const summary = dbSummary ?? (allowScannerCsvFallback(`symbol summary DB read unavailable for ${cleaned}`) ? await readJson(path.join(/*turbopackIgnore: true*/ symbolDir, "summary.json")) : null);
  const history = await getSymbolPriceHistory(cleaned, period);

  if (row && summary) {
    row.company_name = displayName({ ...summary, ...row });
    const summaryLastUpdated = normalizedTimestamp(rawValue(summary, "updated_at_utc", "updated_at", "last_updated"));
    if (summaryLastUpdated) {
      row.last_updated = summaryLastUpdated;
      row.last_updated_utc = summaryLastUpdated;
    }
  }

  return {
    row,
    summary,
    history,
  };
}

async function readSymbolDetailCache(key: string, loader: () => Promise<SymbolDetail>): Promise<SymbolDetail> {
  const now = Date.now();
  const current = symbolDetailCache.get(key);
  if (current?.hasValue && current.value && current.expiresAt > now) return current.value;
  if (current?.hasValue && current.value && current.staleUntil > now) {
    if (!current.inflight) {
      current.inflight = refreshSymbolDetailCache(key, loader);
    }
    return current.value;
  }
  if (current?.inflight) return current.inflight;
  const inflight = refreshSymbolDetailCache(key, loader);
  symbolDetailCache.set(key, { expiresAt: now, hasValue: current?.hasValue ?? false, inflight, staleUntil: now + SYMBOL_DETAIL_CACHE_STALE_MS, value: current?.value ?? null });
  return inflight;
}

async function refreshSymbolDetailCache(key: string, loader: () => Promise<SymbolDetail>): Promise<SymbolDetail> {
  try {
    const value = await loader();
    const now = Date.now();
    symbolDetailCache.set(key, {
      expiresAt: now + SYMBOL_DETAIL_CACHE_TTL_MS,
      hasValue: true,
      staleUntil: now + SYMBOL_DETAIL_CACHE_STALE_MS,
      value,
    });
    trimSymbolDetailCache();
    return value;
  } catch (error) {
    const current = symbolDetailCache.get(key);
    if (current?.hasValue && current.value && current.staleUntil > Date.now()) {
      current.inflight = undefined;
      return current.value;
    }
    symbolDetailCache.delete(key);
    throw error;
  }
}

function trimSymbolDetailCache(): void {
  while (symbolDetailCache.size > SYMBOL_DETAIL_CACHE_MAX) {
    const oldest = symbolDetailCache.keys().next().value;
    if (!oldest) return;
    symbolDetailCache.delete(oldest);
  }
}

function cleanSymbolForDetail(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function normalizeSymbolPeriod(period: string): string {
  const normalized = period.trim().toLowerCase();
  if (normalized === "all" || normalized === "2y" || normalized === "1y" || normalized === "6m" || normalized === "3m" || normalized === "1m") return normalized;
  return "1y";
}

function periodCutoff(latestMs: number, period: string) {
  if (period === "all") return null;
  const days = period === "1m" ? 31 : period === "3m" ? 93 : period === "6m" ? 186 : period === "2y" ? 730 : 365;
  return latestMs - days * 24 * 60 * 60 * 1000;
}

export async function getSymbolPriceHistory(symbol: string, period = "1y"): Promise<Record<string, ScannerScalar>[]> {
  return getSymbolPriceHistoryCached(symbol, period);
}

const getSymbolPriceHistoryCached = cache(async (symbol: string, period: string): Promise<Record<string, ScannerScalar>[]> => {
  const cleaned = symbol.trim().toUpperCase();
  try {
    const rowLimit = symbolPriceHistoryLimit(period);
    const result = await dbQuery<DbPriceRow>(
      rowLimit === null
        ? `
          SELECT ts, open, high, low, close, volume
          FROM symbol_price_history
          WHERE symbol = $1
          ORDER BY ts ASC
        `
        : `
          SELECT ts, open, high, low, close, volume
          FROM (
            SELECT ts, open, high, low, close, volume
            FROM symbol_price_history
            WHERE symbol = $1
            ORDER BY ts DESC
            LIMIT $2
          ) recent
          ORDER BY ts ASC
        `,
      rowLimit === null ? [cleaned] : [cleaned, rowLimit],
    );
    if (result.rows.length) {
      const normalized = result.rows.map((row) => ({
        date: dbTimestamp(row.ts),
        datetime: dbTimestamp(row.ts),
        open: coerceValue("open", row.open) ?? null,
        high: coerceValue("high", row.high) ?? null,
        low: coerceValue("low", row.low) ?? null,
        close: coerceValue("close", row.close) ?? null,
        volume: coerceValue("volume", row.volume) ?? null,
      }));
      return filterSymbolPriceRowsByPeriod(normalized, period);
    }
  } catch {
    // CSV fallback is explicit because Postgres is the production source of truth.
  }

  const scannerTrail = await getScannerSignalPriceHistoryPoints(cleaned).catch(() => []);
  if (scannerTrail.length) {
    return filterSymbolPriceRowsByPeriod(
      scannerTrail.map((point) => ({
        close: point.close,
        date: point.datetime,
        datetime: point.datetime,
        high: point.high,
        low: point.low,
        open: point.open,
        source: "scanner_signal_price_history",
        volume: point.volume,
      })),
      period,
    );
  }

  if (!allowScannerCsvFallback(`price history DB read unavailable for ${cleaned}`)) return [];

  const symbolDir = path.join(/*turbopackIgnore: true*/ scannerOutputDir(), "symbols", symbolSlug(cleaned));
  const history = await readCsv(path.join(/*turbopackIgnore: true*/ symbolDir, "history.csv"));
  const normalized = history
    .map((item) => {
      const row: Record<string, ScannerScalar> = {};
      for (const [key, value] of Object.entries(item)) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, "_");
        row[normalizedKey] = coerceValue(normalizedKey, value) ?? null;
      }
      return row;
    })
    .sort((a, b) => String(a.date ?? a.datetime ?? "").localeCompare(String(b.date ?? b.datetime ?? "")));

  return filterSymbolPriceRowsByPeriod(normalized, period);
});

function symbolPriceHistoryLimit(period: string): number | null {
  if (period === "1m") return 45;
  if (period === "3m") return 110;
  if (period === "6m") return 210;
  if (period === "1y") return 390;
  if (period === "2y") return 780;
  return null;
}

function filterSymbolPriceRowsByPeriod(rows: Record<string, ScannerScalar>[], period: string): Record<string, ScannerScalar>[] {
  if (!rows.length || period === "all") return rows;
  const dated = rows
    .map((row) => ({ row, time: Date.parse(String(row.date ?? row.datetime ?? "")) }))
    .filter((item): item is { row: Record<string, ScannerScalar>; time: number } => Number.isFinite(item.time));
  if (!dated.length) return rows;

  const latest = Math.max(...dated.map((item) => item.time));
  const cutoff = periodCutoff(latest, period);
  if (cutoff === null) return rows;
  return dated.filter((item) => item.time >= cutoff).map((item) => item.row);
}
