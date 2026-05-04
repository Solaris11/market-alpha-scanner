import "server-only";

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { freshnessFromTimestamp, normalizedTimestamp, unavailableFreshness } from "./data-health";
import { dbQuery } from "./server/db";
import { applyCorrectionMapFields } from "./trading/correction-map";
import type { DataFreshnessStatus } from "./data-health";
import type { QueryResultRow } from "pg";
import type { CsvFileData, CsvRow, HistorySnapshot, HistorySummary, IntradayDriftRow, PerformanceData, RankingRow, ScannerScalar, SymbolDetail, SymbolHistoryData, SymbolHistoryRow } from "./types";

const NUMERIC_FIELDS = new Set([
  "price",
  "final_score",
  "final_score_adjusted",
  "return_1d",
  "regime_adjustment",
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

type DbHistorySummaryRow = QueryResultRow & {
  id: string;
  completed_at: string | Date | null;
  created_at: string | Date;
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
  __marketAlphaJsonCache?: Map<string, FileCacheEntry<Record<string, unknown> | null>>;
};
const csvPayloadCache = cacheRoot.__marketAlphaCsvCache ?? new Map<string, FileCacheEntry<CsvPayload>>();
const jsonPayloadCache = cacheRoot.__marketAlphaJsonCache ?? new Map<string, FileCacheEntry<Record<string, unknown> | null>>();
cacheRoot.__marketAlphaCsvCache = csvPayloadCache;
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
  if (fsSync.existsSync(DEFAULT_SCANNER_OUTPUT_DIR)) return DEFAULT_SCANNER_OUTPUT_DIR;
  const localOutput = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "scanner_output");
  try {
    const stat = fsSync.lstatSync(localOutput);
    if (stat.isSymbolicLink()) {
      const target = fsSync.readlinkSync(localOutput);
      return path.isAbsolute(target) ? target : path.resolve(path.dirname(localOutput), target);
    }
  } catch {
    // Fall back to the local path when no scanner_output entry exists yet.
  }
  return localOutput;
}

async function latestDbScanRun(): Promise<LatestScanRunRow | null> {
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
}

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

async function getDbRankingRows(limit?: number): Promise<RankingRow[] | null> {
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
}

async function getDbHistoryRows(symbol?: string): Promise<SymbolHistoryRow[] | null> {
  try {
    const params = symbol ? [symbol.trim().toUpperCase()] : [];
    const result = await dbQuery<DbHistoryRow>(
      `
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
        ORDER BY sr.completed_at ASC NULLS LAST, sr.created_at ASC, ss.rank_position ASC NULLS LAST, ss.symbol ASC
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
}

function rowsToCsvFileData(rows: Record<string, unknown>[]): CsvFileData {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row).map(canonicalCsvKey))));
  return {
    rows: rows.map(normalizeCsvRow),
    state: rows.length ? "data" : "header-only",
    columns,
    lineCount: rows.length + (columns.length ? 1 : 0),
  };
}

function metricRowsToCsvFileData(rows: DbMetricRow[]): CsvFileData {
  return rowsToCsvFileData(rows.map((row) => asRecord(row.metrics)));
}

async function getDbPerformanceData(options: { forwardTailRows?: number } = {}): Promise<Pick<PerformanceData, "summary" | "forwardReturns"> | null> {
  const latestRun = await latestDbScanRun();
  if (!latestRun) return null;

  try {
    const forwardLimit = options.forwardTailRows ? Math.max(1, options.forwardTailRows) : 100000;
    const [summaryResult, forwardResult] = await Promise.all([
      dbQuery<DbMetricRow>(
        `
          SELECT metrics, created_at
          FROM performance_summary
          WHERE scan_run_id = $1
          ORDER BY created_at ASC
        `,
        [latestRun.id],
      ),
      dbQuery<DbMetricRow>(
        `
          SELECT metrics, created_at
          FROM forward_returns
          WHERE scan_run_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [latestRun.id, forwardLimit],
      ),
    ]);

    return {
      summary: metricRowsToCsvFileData(summaryResult.rows),
      forwardReturns: metricRowsToCsvFileData([...forwardResult.rows].reverse()),
    };
  } catch {
    return null;
  }
}

async function getDbSymbolSummary(symbol: string): Promise<Record<string, unknown> | null> {
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
}

function symbolSlug(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "_");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileSignature(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}

async function getFileLastUpdated(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
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

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = canonicalCsvKey(key);
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

  const text = await fs.readFile(filePath, "utf8");
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
  const handle = await fs.open(filePath, "r");
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
  const rows = await readCsv(path.join(scannerOutputDir(), ...parts));
  return rows.map(normalizeCsvRow);
}

async function readScannerCsvWithState(...parts: string[]): Promise<CsvFileData> {
  return readScannerCsvWithStateParts(parts);
}

async function readScannerCsvWithStateParts(parts: string[], options: { tailRows?: number } = {}): Promise<CsvFileData> {
  const filePath = path.join(scannerOutputDir(), ...parts);
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

  const text = await fs.readFile(filePath, "utf8");
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
    const value = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
    jsonPayloadCache.set(filePath, { ...signature, value });
    return value;
  } catch {
    jsonPayloadCache.set(filePath, { ...signature, value: null });
    return null;
  }
}

export async function getFullRanking(): Promise<RankingRow[]> {
  const dbRows = await getDbRankingRows();
  if (dbRows) return dbRows;

  const filePath = path.join(scannerOutputDir(), "full_ranking.csv");
  if (!(await fileExists(filePath))) return [];
  const [{ rows, columns }, lastUpdated] = await Promise.all([readCsvPayload(filePath), getFileLastUpdated(filePath)]);
  const missing = missingRankingColumns(columns);
  if (missing.length) {
    console.error(`[data] schema mismatch in full_ranking.csv: missing columns ${missing.join(", ")}`);
    return [];
  }
  return rows.map((row) => normalizeRankingRow(row, lastUpdated)).filter((row) => row.symbol);
}

export async function getTopCandidates(): Promise<RankingRow[]> {
  const dbRows = await getDbRankingRows(20);
  if (dbRows) return dbRows;

  const filePath = path.join(scannerOutputDir(), "top_candidates.csv");
  if (!(await fileExists(filePath))) return [];
  const [{ rows, columns }, lastUpdated] = await Promise.all([readCsvPayload(filePath), getFileLastUpdated(filePath)]);
  const missing = missingRankingColumns(columns);
  if (missing.length) {
    console.error(`[data] schema mismatch in top_candidates.csv: missing columns ${missing.join(", ")}`);
    return [];
  }
  return rows.map((row) => normalizeRankingRow(row, lastUpdated)).filter((row) => row.symbol);
}

export async function getScanDataHealth(): Promise<ScanDataHealth> {
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

  const now = Date.now();
  const files = await Promise.all(
    ["full_ranking.csv", "top_candidates.csv"].map(async (name) => {
      const filePath = path.join(scannerOutputDir(), name);
      if (!(await fileExists(filePath))) {
        const missing = unavailableFreshness("missing", `${name} is not available yet.`);
        return { ...missing, name, missingColumns: [] };
      }
      const stat = await fs.stat(filePath);
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
}

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

export async function getHistorySummary(): Promise<HistorySummary> {
  try {
    const result = await dbQuery<DbHistorySummaryRow>(
      `
        SELECT id::text, completed_at, created_at
        FROM scan_runs
        WHERE status = 'success'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
      `,
    );
    if (result.rows.length) {
      const snapshots = result.rows.map((row) => {
        const timestamp = dbTimestamp(row.completed_at) ?? dbTimestamp(row.created_at);
        return {
          name: `db_${row.id}`,
          modifiedAt: timestamp ?? new Date().toISOString(),
          timestamp,
        };
      });
      const dated = snapshots.map((snapshot) => snapshot.timestamp).filter((timestamp): timestamp is string => Boolean(timestamp));
      const uniqueDates = Array.from(new Set(dated.map((timestamp) => timestamp.slice(0, 10)))).sort();
      return {
        snapshots,
        count: snapshots.length,
        earliest: dated.length ? dated[dated.length - 1] : null,
        latest: dated.length ? dated[0] : null,
        uniqueDates,
      };
    }
  } catch {
    // Fall back to CSV artifacts during transition.
  }

  const historyDir = path.join(scannerOutputDir(), "history");
  let entries: string[] = [];

  try {
    entries = await fs.readdir(historyDir);
  } catch {
    entries = [];
  }

  const snapshots = (
    await Promise.all(
      entries
        .filter((entry) => /^scan_.*\.csv$/.test(entry))
        .map(async (name): Promise<HistorySnapshot | null> => {
          const filePath = path.join(historyDir, name);
          try {
            const stat = await fs.stat(filePath);
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
}

export async function getSymbolHistoryData(): Promise<SymbolHistoryData> {
  const dbRows = await getDbHistoryRows();
  if (dbRows) {
    return {
      symbols: Array.from(new Set(dbRows.map((row) => row.symbol))).sort(),
      rows: dbRows,
    };
  }

  const history = await getHistorySummary();
  const rows: SymbolHistoryRow[] = [];

  for (const snapshot of history.snapshots) {
    const snapshotRows = await readCsv(path.join(scannerOutputDir(), "history", snapshot.name));
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

export async function getHistorySymbolsFromSnapshots(maxSnapshots = 5): Promise<string[]> {
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
    // Fall back to CSV snapshots during transition.
  }

  const history = await getHistorySummary();
  const symbols = new Set<string>();

  for (const snapshot of history.snapshots.slice(0, Math.max(1, maxSnapshots))) {
    const snapshotRows = await readCsv(path.join(scannerOutputDir(), "history", snapshot.name));
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
  const filePath = path.join(scannerOutputDir(), "symbols", symbolSlug(cleaned), "history.csv");
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

  const history = await getHistorySummary();
  const rows: SymbolHistoryRow[] = [];

  for (const snapshot of history.snapshots) {
    const snapshotRows = await readCsv(path.join(scannerOutputDir(), "history", snapshot.name));
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
  const dbHistory = await getDbHistoryRows();
  if (dbHistory) return buildIntradaySignalDrift({ symbols: Array.from(new Set(dbHistory.map((row) => row.symbol))).sort(), rows: dbHistory });

  const history = await getHistorySummary();
  const latestSnapshot = history.snapshots[0];
  const earliestSnapshot = history.snapshots[history.snapshots.length - 1];
  if (!latestSnapshot) return [];

  const latestRows = (await readCsv(path.join(scannerOutputDir(), "history", latestSnapshot.name))).map((row) => normalizeRankingRow(row, latestSnapshot.timestamp ?? latestSnapshot.modifiedAt)).filter((row) => row.symbol);
  const earliestRows =
    earliestSnapshot && earliestSnapshot.name !== latestSnapshot.name
      ? (await readCsv(path.join(scannerOutputDir(), "history", earliestSnapshot.name))).map((row) => normalizeRankingRow(row, earliestSnapshot.timestamp ?? earliestSnapshot.modifiedAt)).filter((row) => row.symbol)
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

export async function getPerformanceData(options: { forwardTailRows?: number } = {}): Promise<PerformanceData> {
  const dbPerformance = await getDbPerformanceData(options);
  if (dbPerformance) {
    const [lifecycle, lifecycleSummary, autoCalibration] = await Promise.all([
      readScannerCsvWithState("analysis", "signal_lifecycle.csv"),
      readScannerCsvWithState("analysis", "signal_lifecycle_summary.csv"),
      readScannerCsvWithState("analysis", "auto_calibration_recommendations.csv"),
    ]);
    return { ...dbPerformance, lifecycle, lifecycleSummary, autoCalibration };
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

export async function getCalibrationInsights() {
  return readJson(path.join(scannerOutputDir(), "analysis", "calibration_insights.json"));
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
  return readJson(path.join(scannerOutputDir(), "analysis", "market_regime.json"));
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
  return readJson(path.join(scannerOutputDir(), "analysis", "market_structure.json"));
}

export async function getSymbolDetail(symbol: string): Promise<SymbolDetail> {
  const cleaned = symbol.trim().toUpperCase();
  const ranking = await getFullRanking();
  const row = ranking.find((item) => item.symbol === cleaned) ?? null;
  const dbSummary = await getDbSymbolSummary(cleaned);
  const symbolDir = path.join(scannerOutputDir(), "symbols", symbolSlug(cleaned));
  const summary = dbSummary ?? (await readJson(path.join(symbolDir, "summary.json")));
  const history = await getSymbolPriceHistory(cleaned, "all");

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

function periodCutoff(latestMs: number, period: string) {
  if (period === "all") return null;
  const days = period === "1m" ? 31 : period === "3m" ? 93 : period === "6m" ? 186 : period === "2y" ? 730 : 365;
  return latestMs - days * 24 * 60 * 60 * 1000;
}

export async function getSymbolPriceHistory(symbol: string, period = "1y"): Promise<Record<string, ScannerScalar>[]> {
  const cleaned = symbol.trim().toUpperCase();
  try {
    const result = await dbQuery<DbPriceRow>(
      `
        SELECT ts, open, high, low, close, volume
        FROM symbol_price_history
        WHERE symbol = $1
        ORDER BY ts ASC
      `,
      [cleaned],
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
      if (period === "all") return normalized;
      const latest = Math.max(...normalized.map((row) => Date.parse(String(row.date ?? row.datetime ?? ""))).filter(Number.isFinite));
      const cutoff = periodCutoff(latest, period);
      if (cutoff === null) return normalized;
      return normalized.filter((row) => {
        const time = Date.parse(String(row.date ?? row.datetime ?? ""));
        return Number.isFinite(time) && time >= cutoff;
      });
    }
  } catch {
    // Fall back to CSV artifacts during transition.
  }

  const symbolDir = path.join(scannerOutputDir(), "symbols", symbolSlug(cleaned));
  const history = await readCsv(path.join(symbolDir, "history.csv"));
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

  if (!normalized.length || period === "all") return normalized;

  const dated = normalized
    .map((row) => ({ row, time: Date.parse(String(row.date ?? row.datetime ?? "")) }))
    .filter((item) => Number.isFinite(item.time));
  if (!dated.length) return normalized;

  const latest = Math.max(...dated.map((item) => item.time));
  const cutoff = periodCutoff(latest, period);
  if (cutoff === null) return normalized;
  return dated.filter((item) => item.time >= cutoff).map((item) => item.row);
}
