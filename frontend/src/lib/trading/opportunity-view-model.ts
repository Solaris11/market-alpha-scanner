import type { PerformanceData, RankingRow } from "@/lib/types";
import { finiteNumber, firstNumber } from "@/lib/ui/formatters";
import { buildEdgeLookup, computeConviction, selectBestTradeNow } from "./conviction";

export type OpportunityViewModel = {
  symbol: string;
  company_name: string | null;
  sector: string | null;
  price: number | null;
  final_score: number | null;
  final_decision: string | null;
  decision_reason: string | null;
  suggested_entry: number | null;
  stop_loss: number | null;
  target: number | null;
  conviction: number;
  confidenceLabel: "High" | "Medium" | "Weak" | "Avoid";
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
    sector: stringOrNull(row.sector),
    price: numberOrNull(row.price),
    final_score: numberOrNull(row.final_score),
    final_decision: stringOrNull(row.final_decision ?? row.action),
    decision_reason: stringOrNull(row.decision_reason ?? row.quality_reason ?? row.selection_reason),
    suggested_entry: firstNumberOrNull(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price),
    stop_loss: firstNumberOrNull(row.stop_loss ?? row.invalidation_level),
    target: firstNumberOrNull(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price),
    conviction: conviction.score,
    confidenceLabel: conviction.label,
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
