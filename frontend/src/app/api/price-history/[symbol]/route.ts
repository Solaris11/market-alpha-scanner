import { NextResponse } from "next/server";
import { filterPriceHistoryRows, isPriceHistoryPeriod, priceHistoryBounds, type PriceHistoryPeriod } from "@/lib/price-history-range";
import { requireAdmin } from "@/lib/server/access-control";
import { dbQuery } from "@/lib/server/db";
import { rateLimitRequest } from "@/lib/server/request-security";
import { getScannerSignalPriceHistoryPoints } from "@/lib/server/scanner-signal-price-history";
import type { QueryResultRow } from "pg";

type PriceHistoryPayload = {
  ok: boolean;
  symbol: string;
  period: PriceHistoryPeriod;
  requested_period?: string;
  yf_period?: string;
  yf_interval?: string;
  point_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  interval?: string;
  rows: Record<string, unknown>[];
  error?: string;
};

type DbPriceRow = QueryResultRow & {
  ts: Date | string;
  open: number | string | null;
  high: number | string | null;
  low: number | string | null;
  close: number | string | null;
  volume: number | string | null;
};

export const dynamic = "force-dynamic";

async function fetchPriceHistory(symbol: string, period: PriceHistoryPeriod): Promise<PriceHistoryPayload> {
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
    const rows = result.rows.map(dbPriceRow);
    const sourceRows = rows.length ? rows : (await getScannerSignalPriceHistoryPoints(cleaned, 2400)).map(pricePointRow);
    const filtered = filterPriceHistoryRows(sourceRows, period);
    const bounds = priceHistoryBounds(filtered);
    const dataSource = rows.length ? "symbol_price_history" : "scanner_signal_price_history";
    return {
      ok: filtered.length > 0,
      symbol: cleaned,
      period,
      requested_period: period,
      yf_period: period,
      yf_interval: dataSource,
      interval: dataSource,
      point_count: filtered.length,
      start_date: bounds.startDate,
      end_date: bounds.endDate,
      rows: filtered,
      error: filtered.length ? undefined : "No stored OHLC or scanner signal price history is available for this range.",
    };
  } catch {
    const scannerTrail = await getScannerSignalPriceHistoryPoints(cleaned, 2400).catch(() => []);
    const filtered = filterPriceHistoryRows(scannerTrail.map(pricePointRow), period);
    if (filtered.length) {
      const bounds = priceHistoryBounds(filtered);
      return {
        ok: true,
        symbol: cleaned,
        period,
        requested_period: period,
        yf_period: period,
        yf_interval: "scanner_signal_price_history",
        interval: "scanner_signal_price_history",
        point_count: filtered.length,
        start_date: bounds.startDate,
        end_date: bounds.endDate,
        rows: filtered,
      };
    }
    return {
      ok: false,
      symbol: cleaned,
      period,
      requested_period: period,
      rows: [],
      error: "Price history is unavailable.",
    };
  }
}

function dbPriceRow(row: DbPriceRow): Record<string, unknown> {
  const timestamp = row.ts instanceof Date ? row.ts.toISOString() : String(row.ts);
  return {
    date: timestamp,
    datetime: timestamp,
    open: numericOrNull(row.open),
    high: numericOrNull(row.high),
    low: numericOrNull(row.low),
    close: numericOrNull(row.close),
    volume: numericOrNull(row.volume),
  };
}

function pricePointRow(point: {
  close: number | null;
  datetime: string;
  high: number | null;
  low: number | null;
  open: number | null;
  volume: number | null;
}): Record<string, unknown> {
  return {
    close: point.close,
    date: point.datetime,
    datetime: point.datetime,
    high: point.high,
    low: point.low,
    open: point.open,
    volume: point.volume,
  };
}

function numericOrNull(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const rateLimited = await rateLimitRequest(request, "admin:price-history", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "1y").toLowerCase();
  if (!isPriceHistoryPeriod(period)) {
    return NextResponse.json({ ok: false, symbol: symbol.toUpperCase(), period, rows: [], error: `Unsupported period: ${period}` }, { status: 400 });
  }

  const payload = await fetchPriceHistory(symbol, period);
  return NextResponse.json(payload, { status: payload.ok ? 200 : 502 });
}
