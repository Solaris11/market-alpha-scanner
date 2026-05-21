import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "@/lib/server/db";
import type { InteractivePricePoint } from "@/lib/interactive-chart-data";

type DbScannerSignalPriceRow = QueryResultRow & {
  payload: unknown;
  price: string | number | null;
  ts: string | Date;
};

export async function getScannerSignalPriceHistoryPoints(symbol: string, maxRows = 2400): Promise<InteractivePricePoint[]> {
  const cleaned = cleanSymbol(symbol);
  if (!cleaned) return [];

  const result = await dbQuery<DbScannerSignalPriceRow>(
    `
      SELECT
        COALESCE(sr.completed_at, sr.created_at) AS ts,
        ss.price,
        ss.payload
      FROM scanner_signals ss
      JOIN scan_runs sr ON sr.id = ss.scan_run_id
      WHERE sr.status = 'success'
        AND ss.symbol = $1
        AND (
          ss.price IS NOT NULL
          OR ss.payload ?| ARRAY['price', 'close', 'last_price', 'signal_price', 'price_at_signal']
        )
      ORDER BY COALESCE(sr.completed_at, sr.created_at) DESC NULLS LAST, sr.created_at DESC
      LIMIT $2
    `,
    [cleaned, Math.max(1, maxRows)],
  );

  const byTimestamp = new Map<string, InteractivePricePoint>();
  for (const row of result.rows.reverse()) {
    const point = scannerSignalPricePoint(row);
    if (!point) continue;
    byTimestamp.set(point.datetime, point);
  }

  return Array.from(byTimestamp.values()).sort((left, right) => left.datetime.localeCompare(right.datetime));
}

function scannerSignalPricePoint(row: DbScannerSignalPriceRow): InteractivePricePoint | null {
  const timestamp = row.ts instanceof Date ? row.ts.toISOString() : String(row.ts);
  const payload = recordFromUnknown(row.payload);
  const close = numericOrNull(row.price)
    ?? numericOrNull(payload.price)
    ?? numericOrNull(payload.close)
    ?? numericOrNull(payload.last_price)
    ?? numericOrNull(payload.signal_price)
    ?? numericOrNull(payload.price_at_signal);

  if (close === null || !timestamp || !Number.isFinite(Date.parse(timestamp))) return null;

  const open = numericOrNull(payload.open) ?? close;
  const high = numericOrNull(payload.high) ?? Math.max(open, close);
  const low = numericOrNull(payload.low) ?? Math.min(open, close);

  return {
    close,
    date: timestamp.slice(0, 10),
    datetime: timestamp,
    high,
    low,
    open,
    volume: numericOrNull(payload.volume),
  };
}

function cleanSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numericOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
