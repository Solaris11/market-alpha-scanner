import { actionFor, formatNumber } from "./format";
import type { SymbolHistoryRow } from "./types";

export type HistoryChartField = "final_score" | "price";

export type HistoryChartTooltipLine = {
  label: string;
  value: string;
};

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
  return cleanText(row.final_decision) || cleanText(actionFor(row)) || "";
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
  return lines;
}
