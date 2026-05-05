import { freshnessFromTimestamp, type DataFreshness } from "@/lib/data-health";
import type { PerformanceData, RankingRow } from "@/lib/types";
import { finiteNumber, firstNumber, formatMoney } from "@/lib/ui/formatters";
import { buildEdgeLookup, computeConviction, selectBestTradeNow } from "./conviction";

export type OpportunityViewModel = {
  symbol: string;
  company_name: string | null;
  assetType: string | null;
  sector: string | null;
  price: number | null;
  final_score: number | null;
  final_decision: string | null;
  decision_reason: string | null;
  entryStatus: string | null;
  entryZoneLabel: string | null;
  recommendationQuality: string | null;
  recommendationQualityLabel: string | null;
  suggested_entry: number | null;
  stop_loss: number | null;
  target: number | null;
  conviction: number;
  confidenceLabel: "High" | "Medium" | "Weak" | "Avoid";
  dataFreshness: DataFreshness;
  raw: RankingRow;
};

export type OpportunitiesPageModel = {
  best: OpportunityViewModel | null;
  rows: OpportunityViewModel[];
};

export function buildOpportunitiesPageModel(rows: RankingRow[], performance: PerformanceData | null): OpportunitiesPageModel {
  const edges = buildEdgeLookup(rows, performance);
  const viewModels = rows.map((row) => toOpportunityViewModel(row, edges[row.symbol.toUpperCase()]));
  const bestRaw = selectBestTradeNow(rows, edges);
  return {
    best: bestRaw ? toOpportunityViewModel(bestRaw.row, edges[bestRaw.row.symbol.toUpperCase()]) : null,
    rows: viewModels,
  };
}

function toOpportunityViewModel(row: RankingRow, edge?: Parameters<typeof computeConviction>[1]): OpportunityViewModel {
  const conviction = computeConviction(row, edge);
  return {
    symbol: stringOrNull(row.symbol)?.toUpperCase() ?? "N/A",
    company_name: stringOrNull(row.company_name),
    assetType: stringOrNull(row.asset_type),
    sector: stringOrNull(row.sector),
    price: numberOrNull(row.price),
    final_score: numberOrNull(row.final_score),
    final_decision: stringOrNull(row.final_decision ?? row.action),
    decision_reason: stringOrNull(row.decision_reason ?? row.quality_reason ?? row.selection_reason),
    entryStatus: stringOrNull(row.entry_status),
    entryZoneLabel: entryZoneLabel(row),
    recommendationQuality: stringOrNull(row.recommendation_quality),
    recommendationQualityLabel: friendlyLabel(row.recommendation_quality),
    suggested_entry: firstNumberOrNull(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price),
    stop_loss: firstNumberOrNull(row.stop_loss ?? row.invalidation_level),
    target: firstNumberOrNull(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price),
    conviction: conviction.score,
    confidenceLabel: conviction.label,
    dataFreshness: freshnessFromTimestamp(stringOrNull(row.last_updated ?? row.last_updated_utc)),
    raw: row,
  };
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (["$undefined", "undefined", "nan", "none", "null", "n/a", "-"].includes(normalized)) return null;
  return text;
}

function numberOrNull(value: unknown): number | null {
  const text = stringOrNull(value);
  if (text === null) return null;
  const parsed = finiteNumber(text);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function firstNumberOrNull(value: unknown): number | null {
  const text = stringOrNull(value);
  if (text === null) return null;
  const parsed = firstNumber(text);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function entryZoneLabel(row: RankingRow): string | null {
  const correction = rangeLabel(row.correction_zone_low, row.correction_zone_high);
  if (correction) return correction;
  const buyZone = rangeLabel(row.buy_zone_low, row.buy_zone_high);
  if (buyZone) return buyZone;
  const entryZone = rangeLabel(row.entry_zone_low, row.entry_zone_high);
  if (entryZone) return entryZone;
  const rawZone = stringOrNull(row.buy_zone ?? row.entry_zone);
  if (rawZone) return rawZone;
  const entry = firstNumberOrNull(row.suggested_entry ?? row.price);
  return entry === null ? null : formatMoney(entry);
}

function rangeLabel(lowValue: unknown, highValue: unknown): string | null {
  const low = numberOrNull(lowValue);
  const high = numberOrNull(highValue);
  if (low === null && high === null) return null;
  if (low !== null && high !== null) return `${formatMoney(Math.min(low, high))}-${formatMoney(Math.max(low, high))}`;
  return formatMoney(low ?? high);
}

function friendlyLabel(value: unknown): string | null {
  const text = stringOrNull(value);
  if (!text) return null;
  return text
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
