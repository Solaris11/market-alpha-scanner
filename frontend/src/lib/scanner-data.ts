import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { CsvRow, HistorySnapshot, HistorySummary, PerformanceData, RankingRow, ScannerScalar, SymbolDetail } from "./types";

const NUMERIC_FIELDS = new Set([
  "price",
  "final_score",
  "technical_score",
  "fundamental_score",
  "macro_score",
  "news_score",
  "risk_penalty",
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

export function scannerOutputDir() {
  return process.env.SCANNER_OUTPUT_DIR ?? path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "scanner_output");
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

export async function getPerformanceData(): Promise<PerformanceData> {
  const [summary, forwardReturns] = await Promise.all([
    readScannerCsv("analysis", "performance_summary.csv"),
    readScannerCsv("analysis", "forward_returns.csv"),
  ]);
  return { summary, forwardReturns };
}

export async function getSymbolDetail(symbol: string): Promise<SymbolDetail> {
  const cleaned = symbol.trim().toUpperCase();
  const ranking = await getFullRanking();
  const row = ranking.find((item) => item.symbol === cleaned) ?? null;
  const symbolDir = path.join(scannerOutputDir(), "symbols", symbolSlug(cleaned));
  const summary = await readJson(path.join(symbolDir, "summary.json"));
  const history = await readCsv(path.join(symbolDir, "history.csv"));

  if (row && summary) {
    row.company_name = displayName({ ...summary, ...row });
  }

  return {
    row,
    summary,
    history: history.map((item) => {
      const normalized: Record<string, ScannerScalar> = {};
      for (const [key, value] of Object.entries(item)) {
        normalized[key] = coerceValue(key.toLowerCase(), value) ?? null;
      }
      return normalized;
    }),
  };
}
