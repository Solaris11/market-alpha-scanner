import "server-only";

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { CsvFileData, CsvRow, HistorySnapshot, HistorySummary, IntradayDriftRow, PerformanceData, RankingRow, ScannerScalar, SymbolDetail, SymbolHistoryData, SymbolHistoryRow } from "./types";

const NUMERIC_FIELDS = new Set([
  "price",
  "final_score",
  "technical_score",
  "fundamental_score",
  "macro_score",
  "news_score",
  "risk_penalty",
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
  "avg_negative_return",
  "min_return",
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

function normalizeCsvRow(raw: Record<string, unknown>): CsvRow {
  const row: CsvRow = {};
  for (const [key, value] of Object.entries(raw)) {
    row[key] = coerceValue(key, value) ?? null;
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

function normalizeRankingRow(raw: Record<string, unknown>): RankingRow {
  const row: RankingRow = { symbol: "" };

  for (const [key, value] of Object.entries(raw)) {
    row[key] = coerceValue(key, value);
  }

  row.symbol = String(row.symbol ?? raw.symbol ?? "").trim().toUpperCase();
  row.company_name = displayName(row);
  return row;
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

async function readCsv(filePath: string) {
  if (!(await fileExists(filePath))) return [];
  const text = await fs.readFile(filePath, "utf8");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];
}

async function readScannerCsv(...parts: string[]) {
  const rows = await readCsv(path.join(scannerOutputDir(), ...parts));
  return rows.map(normalizeCsvRow);
}

async function readScannerCsvWithState(...parts: string[]): Promise<CsvFileData> {
  const filePath = path.join(scannerOutputDir(), ...parts);
  if (!(await fileExists(filePath))) {
    return { rows: [], state: "missing", columns: [], lineCount: 0 };
  }

  const text = await fs.readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const columns = lines[0]?.split(",").map((column) => column.trim()) ?? [];
  if (lines.length <= 1) {
    return { rows: [], state: "header-only", columns, lineCount: lines.length };
  }

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  return {
    rows: rows.map(normalizeCsvRow),
    state: rows.length ? "data" : "header-only",
    columns,
    lineCount: lines.length,
  };
}

export async function readJson(filePath: string) {
  if (!(await fileExists(filePath))) return null;

  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getFullRanking(): Promise<RankingRow[]> {
  const rows = await readCsv(path.join(scannerOutputDir(), "full_ranking.csv"));
  return rows.map(normalizeRankingRow).filter((row) => row.symbol);
}

export async function getTopCandidates(): Promise<RankingRow[]> {
  const rows = await readCsv(path.join(scannerOutputDir(), "top_candidates.csv"));
  return rows.map(normalizeRankingRow).filter((row) => row.symbol);
}

function parseSnapshotTimestamp(name: string) {
  const match = /^scan_(\d{8})_(\d{6})\.csv$/.exec(name);
  if (!match) return null;
  const [, date, time] = match;
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
}

export async function getHistorySummary(): Promise<HistorySummary> {
  const historyDir = path.join(scannerOutputDir(), "history");
  let entries: string[] = [];

  try {
    entries = await fs.readdir(historyDir);
  } catch {
    entries = [];
  }

  const snapshots: HistorySnapshot[] = [];
  for (const name of entries.filter((entry) => /^scan_.*\.csv$/.test(entry))) {
    const filePath = path.join(historyDir, name);
    try {
      const stat = await fs.stat(filePath);
      snapshots.push({
        name,
        modifiedAt: stat.mtime.toISOString(),
        timestamp: parseSnapshotTimestamp(name),
      });
    } catch {
      // Ignore files that disappear between readdir and stat.
    }
  }

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
  const history = await getHistorySummary();
  const rows: SymbolHistoryRow[] = [];

  for (const snapshot of history.snapshots) {
    const snapshotRows = await readCsv(path.join(scannerOutputDir(), "history", snapshot.name));
    const fallbackTimestamp = snapshot.timestamp ?? snapshot.modifiedAt;

    for (const raw of snapshotRows) {
      const row = normalizeRankingRow(raw) as SymbolHistoryRow;
      if (!row.symbol) continue;
      row.timestamp_utc = String(raw.timestamp_utc ?? fallbackTimestamp);
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

export async function getPerformanceData(): Promise<PerformanceData> {
  const [summary, forwardReturns] = await Promise.all([
    readScannerCsvWithState("analysis", "performance_summary.csv"),
    readScannerCsvWithState("analysis", "forward_returns.csv"),
  ]);
  return { summary, forwardReturns };
}

export async function getSymbolDetail(symbol: string): Promise<SymbolDetail> {
  const cleaned = symbol.trim().toUpperCase();
  const ranking = await getFullRanking();
  const row = ranking.find((item) => item.symbol === cleaned) ?? null;
  const symbolDir = path.join(scannerOutputDir(), "symbols", symbolSlug(cleaned));
  const summary = await readJson(path.join(symbolDir, "summary.json"));
  const history = await getSymbolPriceHistory(cleaned, "all");

  if (row && summary) {
    row.company_name = displayName({ ...summary, ...row });
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
