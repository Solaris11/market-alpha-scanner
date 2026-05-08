export const PRICE_HISTORY_PERIODS = ["1d", "1wk", "1mo", "6mo", "ytd", "1y", "5y", "max"] as const;

export type PriceHistoryPeriod = (typeof PRICE_HISTORY_PERIODS)[number];
export type PriceHistoryRangeRow = Record<string, unknown>;

const PRICE_HISTORY_PERIOD_SET = new Set<string>(PRICE_HISTORY_PERIODS);

export function isPriceHistoryPeriod(value: string): value is PriceHistoryPeriod {
  return PRICE_HISTORY_PERIOD_SET.has(value);
}

export function filterPriceHistoryRows(rows: PriceHistoryRangeRow[], period: PriceHistoryPeriod): PriceHistoryRangeRow[] {
  const dated = rows
    .map((row) => ({ row, time: rowTime(row) }))
    .filter((item): item is { row: PriceHistoryRangeRow; time: number } => item.time !== null)
    .sort((a, b) => a.time - b.time);

  if (!dated.length) return [];
  const cutoff = cutoffForPeriod(dated[dated.length - 1].time, period);
  if (cutoff === null) return dated.map((item) => item.row);
  return dated.filter((item) => item.time >= cutoff).map((item) => item.row);
}

export function priceHistoryBounds(rows: PriceHistoryRangeRow[]): { startDate: string | null; endDate: string | null } {
  const times = rows.map(rowTime).filter((time): time is number => time !== null).sort((a, b) => a - b);
  if (!times.length) return { startDate: null, endDate: null };
  return {
    startDate: isoDate(times[0]),
    endDate: isoDate(times[times.length - 1]),
  };
}

function rowTime(row: PriceHistoryRangeRow): number | null {
  const raw = row.date ?? row.datetime ?? row.timestamp ?? row.timestamp_utc ?? row.ts;
  const parsed = Date.parse(String(raw ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function cutoffForPeriod(latestMs: number, period: PriceHistoryPeriod): number | null {
  if (period === "max") return null;
  if (period === "ytd") {
    const latest = new Date(latestMs);
    return Date.UTC(latest.getUTCFullYear(), 0, 1);
  }

  const days =
    period === "1d" ? 1 : period === "1wk" ? 7 : period === "1mo" ? 31 : period === "6mo" ? 186 : period === "5y" ? 365 * 5 + 2 : 365;
  return latestMs - days * 24 * 60 * 60 * 1000;
}

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}
