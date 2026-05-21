import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "@/lib/server/db";
import { getScannerSignalPriceHistoryPoints } from "@/lib/server/scanner-signal-price-history";
import type { InteractiveChartPacket, InteractivePricePoint, MarketChartHubItem } from "@/lib/interactive-chart-data";

type DbPriceRow = QueryResultRow & {
  close: number | string | null;
  high: number | string | null;
  low: number | string | null;
  open: number | string | null;
  ts: Date | string;
  volume: number | string | null;
};

export const MARKET_CHART_SYMBOLS = [
  { interpretation: "Broad U.S. equity risk appetite proxy.", label: "S&P 500", symbol: "SPY" },
  { interpretation: "Growth and Nasdaq leadership proxy.", label: "Nasdaq 100", symbol: "QQQ" },
  { interpretation: "Dow Jones industrial leadership proxy.", label: "Dow Jones", symbol: "DIA" },
  { interpretation: "Crypto risk appetite and liquidity sensitivity.", label: "Bitcoin", symbol: "BTC" },
  { interpretation: "Gold risk hedge and real-rate sensitivity proxy.", label: "Gold", symbol: "GLD" },
  { interpretation: "Oil and energy shock pressure proxy.", label: "Oil", symbol: "USO" },
  { interpretation: "Dollar strength and global liquidity pressure proxy.", label: "Dollar", symbol: "UUP" },
  { interpretation: "Long-duration bond and rate-pressure proxy.", label: "Bonds", symbol: "TLT" },
] as const;

export type MarketChartSymbol = (typeof MARKET_CHART_SYMBOLS)[number];

export async function getValidatedPriceHistory(symbol: string, maxRows = 1600): Promise<InteractiveChartPacket> {
  const cleaned = cleanSymbol(symbol);
  if (!cleaned) return emptyPacket(cleaned, "Invalid symbol.");

  try {
    const result = await dbQuery<DbPriceRow>(
      `
        SELECT ts, open, high, low, close, volume
        FROM symbol_price_history
        WHERE symbol = $1
        ORDER BY ts DESC
        LIMIT $2
      `,
      [cleaned, maxRows],
    );
    const rows = result.rows.map(dbPriceRow).reverse();
    if (!rows.length) {
      const scannerTrail = await getScannerSignalPriceHistoryPoints(cleaned, maxRows).catch(() => []);
      if (scannerTrail.length) return packetFromRows(cleaned, "scanner_signal_price_history", scannerTrail);
    }
    const first = rows[0] ?? null;
    const last = rows[rows.length - 1] ?? null;
    return {
      dataSource: "symbol_price_history",
      endDate: last?.date ?? null,
      error: rows.length ? undefined : "No stored price history is available.",
      lastUpdated: last?.datetime ?? null,
      pointCount: rows.length,
      rows,
      startDate: first?.date ?? null,
      symbol: cleaned,
    };
  } catch {
    const scannerTrail = await getScannerSignalPriceHistoryPoints(cleaned, maxRows).catch(() => []);
    if (scannerTrail.length) return packetFromRows(cleaned, "scanner_signal_price_history", scannerTrail);
    return emptyPacket(cleaned, "Price history is unavailable.");
  }
}

export async function getMarketChartHubData(): Promise<MarketChartHubItem[]> {
  const packets = await Promise.all(MARKET_CHART_SYMBOLS.map(async (item) => ({
    ...item,
    chart: await getValidatedPriceHistory(item.symbol),
  })));
  return packets;
}

function cleanSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function emptyPacket(symbol: string, error: string): InteractiveChartPacket {
  return {
    dataSource: "symbol_price_history",
    endDate: null,
    error,
    lastUpdated: null,
    pointCount: 0,
    rows: [],
    startDate: null,
    symbol,
  };
}

function packetFromRows(symbol: string, dataSource: string, rows: InteractivePricePoint[]): InteractiveChartPacket {
  const first = rows[0] ?? null;
  const last = rows[rows.length - 1] ?? null;
  return {
    dataSource,
    endDate: last?.date ?? null,
    lastUpdated: last?.datetime ?? null,
    pointCount: rows.length,
    rows,
    startDate: first?.date ?? null,
    symbol,
  };
}

function dbPriceRow(row: DbPriceRow): InteractivePricePoint {
  const timestamp = row.ts instanceof Date ? row.ts.toISOString() : String(row.ts);
  return {
    close: numericOrNull(row.close),
    date: timestamp.slice(0, 10),
    datetime: timestamp,
    high: numericOrNull(row.high),
    low: numericOrNull(row.low),
    open: numericOrNull(row.open),
    volume: numericOrNull(row.volume),
  };
}

function numericOrNull(value: number | string | null): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
