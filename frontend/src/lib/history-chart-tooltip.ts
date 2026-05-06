import { actionFor, formatNumber } from "./format";
import type { SymbolHistoryRow } from "./types";
import { decisionLabel } from "./ui/labels";

export type HistoryChartField = "final_score" | "price";
export type HistoryQuickRange = "7d" | "14d" | "1m" | "6m" | "1y" | "all";

export type HistoryChartTooltipLine = {
  label: string;
  value: string;
};

export type HistoryChartPoint = {
  index: number;
  row: SymbolHistoryRow;
  time: number;
  value: number;
};

export type HistoryFilterStatus = "ok" | "invalid";

export type HistoryFilterResult = {
  activeLabel: string;
  error: string | null;
  filteredCount: number;
  fromMs: number | null;
  hasCustomRange: boolean;
  rangeStartMs: number | null;
  rows: SymbolHistoryRow[];
  status: HistoryFilterStatus;
  toMs: number | null;
  totalCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text && !["nan", "none", "null", "n/a", "-"].includes(text.toLowerCase()) ? text : "";
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatHistoryChartTimestamp(ms: number) {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return "N/A";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatHistoryChartPrice(value: unknown) {
  const numberValue = numeric(value);
  return numberValue === null ? "N/A" : `$${formatNumber(numberValue)}`;
}

export function historyChartDecision(row: SymbolHistoryRow) {
  return decisionLabel(cleanText(row.final_decision) || cleanText(actionFor(row)) || "");
}

export function historyChartTooltipLines(row: SymbolHistoryRow, field: HistoryChartField): HistoryChartTooltipLine[] {
  const lines: HistoryChartTooltipLine[] = [];
  const score = numeric(row.final_score);
  const price = numeric(row.price);
  const confidence = numeric(row.confidence_score);
  const decision = historyChartDecision(row);

  if (field === "final_score") {
    if (score !== null) lines.push({ label: "Score", value: formatNumber(score) });
    if (decision) lines.push({ label: "Decision", value: decision });
    if (confidence !== null) lines.push({ label: "Confidence", value: formatNumber(confidence, 0) });
    if (price !== null) lines.push({ label: "Price", value: formatHistoryChartPrice(price) });
    return lines;
  }

  if (price !== null) lines.push({ label: "Price", value: formatHistoryChartPrice(price) });
  if (score !== null) lines.push({ label: "Score", value: formatNumber(score) });
  if (decision) lines.push({ label: "Decision", value: decision });
  if (confidence !== null) lines.push({ label: "Confidence", value: formatNumber(confidence, 0) });
  return lines;
}

export function historyTimestampMs(row: { timestamp_utc: string }): number | null {
  const ms = Date.parse(row.timestamp_utc);
  return Number.isFinite(ms) ? ms : null;
}

export function parseHistoryDateInput(value: string, endOfDay = false): number | null {
  const text = value.trim();
  if (!text) return null;
  const localDateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/);
  if (localDateTime) {
    const [, year, month, day, hour, minute, second, millisecond] = localDateTime;
    const hasExplicitTime = hour !== undefined && minute !== undefined;
    const hasExplicitSecond = second !== undefined;
    const yearNumber = Number(year);
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    const hourNumber = hasExplicitTime ? Number(hour) : endOfDay ? 23 : 0;
    const minuteNumber = hasExplicitTime ? Number(minute) : endOfDay ? 59 : 0;
    const secondNumber = hasExplicitSecond ? Number(second) : endOfDay ? 59 : 0;
    const millisecondNumber = millisecond !== undefined ? Number(millisecond.padEnd(3, "0")) : endOfDay ? 999 : 0;
    if (!validDateParts(yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber, millisecondNumber)) return null;
    const utcMs = Date.UTC(
      yearNumber,
      monthNumber - 1,
      dayNumber,
      hourNumber,
      minuteNumber,
      secondNumber,
      millisecondNumber,
    );
    const parsed = new Date(utcMs);
    if (
      parsed.getUTCFullYear() !== yearNumber ||
      parsed.getUTCMonth() !== monthNumber - 1 ||
      parsed.getUTCDate() !== dayNumber ||
      parsed.getUTCHours() !== hourNumber ||
      parsed.getUTCMinutes() !== minuteNumber ||
      parsed.getUTCSeconds() !== secondNumber ||
      parsed.getUTCMilliseconds() !== millisecondNumber
    ) {
      return null;
    }
    return utcMs;
  }
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeHistoryObservations(rows: SymbolHistoryRow[]): SymbolHistoryRow[] {
  const ordered = rows
    .map((row, originalIndex) => ({ originalIndex, row, time: historyTimestampMs(row) }))
    .filter((item): item is { originalIndex: number; row: SymbolHistoryRow; time: number } => item.time !== null)
    .sort((left, right) => left.time - right.time || left.originalIndex - right.originalIndex);
  const byTimestamp = new Map<number, SymbolHistoryRow>();
  for (const item of ordered) {
    byTimestamp.set(item.time, item.row);
  }
  return Array.from(byTimestamp.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, row]) => row);
}

export function historyRangeStartMs(range: HistoryQuickRange, anchorMs: number): number | null {
  if (!Number.isFinite(anchorMs) || range === "all") return null;
  if (range === "7d") return anchorMs - 7 * DAY_MS;
  if (range === "14d") return anchorMs - 14 * DAY_MS;
  if (range === "1m") return anchorMs - 30 * DAY_MS;
  if (range === "6m") return anchorMs - 183 * DAY_MS;
  if (range === "1y") return anchorMs - 365 * DAY_MS;
  return null;
}

export function filterHistoryObservations(rows: SymbolHistoryRow[], range: HistoryQuickRange, customFrom = "", customTo = ""): SymbolHistoryRow[] {
  return historyFilterResult(rows, range, customFrom, customTo).rows;
}

export function historyFilterResult(rows: SymbolHistoryRow[], range: HistoryQuickRange, customFrom = "", customTo = ""): HistoryFilterResult {
  const normalized = normalizeHistoryObservations(rows);
  const hasCustomRange = Boolean(customFrom.trim() || customTo.trim());
  const fromMs = parseHistoryDateInput(customFrom);
  const toMs = parseHistoryDateInput(customTo, true);
  const invalidFrom = Boolean(customFrom.trim()) && fromMs === null;
  const invalidTo = Boolean(customTo.trim()) && toMs === null;
  const latestMs = normalized.length ? historyTimestampMs(normalized[normalized.length - 1]) : null;
  if (invalidFrom || invalidTo) {
    return {
      activeLabel: "Invalid manual UTC date filter",
      error: invalidFrom ? "Invalid From date. Use YYYY-MM-DD or YYYY-MM-DDTHH:mm in UTC." : "Invalid To date. Use YYYY-MM-DD or YYYY-MM-DDTHH:mm in UTC.",
      filteredCount: 0,
      fromMs,
      hasCustomRange,
      rangeStartMs: null,
      rows: [],
      status: "invalid",
      toMs,
      totalCount: normalized.length,
    };
  }
  if (fromMs !== null && toMs !== null && fromMs > toMs) {
    return {
      activeLabel: "Invalid manual UTC date filter",
      error: "From date is after To date. Adjust the UTC range or clear dates.",
      filteredCount: 0,
      fromMs,
      hasCustomRange,
      rangeStartMs: null,
      rows: [],
      status: "invalid",
      toMs,
      totalCount: normalized.length,
    };
  }
  const rangeStartMs = !hasCustomRange && latestMs !== null ? historyRangeStartMs(range, latestMs) : null;

  const filteredRows = normalized.filter((row) => {
    const rowMs = historyTimestampMs(row);
    if (rowMs === null) return false;
    if (hasCustomRange) {
      if (fromMs !== null && rowMs < fromMs) return false;
      if (toMs !== null && rowMs > toMs) return false;
      return true;
    }
    if (rangeStartMs !== null && rowMs < rangeStartMs) return false;
    return true;
  });

  return {
    activeLabel: historyFilterLabel(range, hasCustomRange, rangeStartMs, fromMs, toMs),
    error: null,
    filteredCount: filteredRows.length,
    fromMs,
    hasCustomRange,
    rangeStartMs,
    rows: filteredRows,
    status: "ok",
    toMs,
    totalCount: normalized.length,
  };
}

export function historyChartPoints(rows: SymbolHistoryRow[], field: HistoryChartField): HistoryChartPoint[] {
  return normalizeHistoryObservations(rows)
    .map((row) => {
      const time = historyTimestampMs(row);
      const value = numeric(row[field]);
      return time !== null && value !== null ? { row, time, value } : null;
    })
    .filter((point): point is Omit<HistoryChartPoint, "index"> => point !== null)
    .map((point, index) => ({ ...point, index }));
}

export function nearestHistoryChartPoint(points: Pick<HistoryChartPoint, "index" | "time">[], targetTime: number): number | null {
  if (!points.length || !Number.isFinite(targetTime)) return null;
  let nearestIndex = points[0].index;
  let nearestDistance = Math.abs(points[0].time - targetTime);
  for (const point of points.slice(1)) {
    const distance = Math.abs(point.time - targetTime);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = point.index;
    }
  }
  return nearestIndex;
}

function validDateParts(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    Number.isInteger(second) &&
    Number.isInteger(millisecond) &&
    year >= 1970 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    millisecond >= 0 &&
    millisecond <= 999
  );
}

function historyFilterLabel(range: HistoryQuickRange, hasCustomRange: boolean, rangeStartMs: number | null, fromMs: number | null, toMs: number | null): string {
  if (hasCustomRange) {
    const fromLabel = fromMs === null ? "earliest" : formatHistoryChartTimestamp(fromMs);
    const toLabel = toMs === null ? "latest" : formatHistoryChartTimestamp(toMs);
    return `Manual UTC range: ${fromLabel} to ${toLabel}`;
  }
  if (range === "all") return "All Time: all saved observations";
  return `${historyQuickRangeLabel(range)}: observations from ${rangeStartMs === null ? "available history" : formatHistoryChartTimestamp(rangeStartMs)} onward`;
}

function historyQuickRangeLabel(range: HistoryQuickRange): string {
  if (range === "7d") return "7D";
  if (range === "14d") return "14D";
  if (range === "1m") return "1M";
  if (range === "6m") return "6M";
  if (range === "1y") return "1Y";
  return "All Time";
}
