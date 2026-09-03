import { freshnessFromTimestamp, type DataFreshness } from "@/lib/data-health";
import { CLIENT_READABLE_RAW_FIELD_SET } from "./raw-field-allowlist";
import type { PerformanceData, RankingRow } from "@/lib/types";
import { finiteNumber, firstNumber, formatMoney } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";
import { buildEdgeLookup, computeConviction, selectBestTradeNow } from "./conviction";
import { buildConvictionFragilityModel, compactStructuralLabel } from "./conviction-fragility";
import { buildEvidenceMaturityFromSignal, type EvidenceMaturityModel } from "./evidence-maturity";
import { createMacroContextResolver, macroAlignmentLabel, type MacroExchangeContext } from "./macro-regime";
import type { NarrativeIntelligence } from "./narrative-intelligence";
import type { ShockMovePattern } from "./shock-move";
import { buildVerifiedEventContext } from "./verified-event-intelligence";

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
  evidence?: EvidenceMaturityModel;
  recommendationQuality: string | null;
  recommendationQualityLabel: string | null;
  suggested_entry: number | null;
  stop_loss: number | null;
  target: number | null;
  conviction: number;
  confidenceLabel: "High" | "Medium" | "Weak" | "Avoid";
  decayLabel: string;
  dataFreshness: DataFreshness;
  fragility: number;
  fragilityLabel: string;
  eventLabel: string;
  eventRisk: number;
  macroAdjustment: number | null;
  macroLabel: string;
  narrative: NarrativeIntelligence | null;
  raw: RankingRow;
  shockPattern: ShockMovePattern | null;
  structuralLabel: string;
};

export type OpportunitiesPageModel = {
  best: OpportunityViewModel | null;
  rows: OpportunityViewModel[];
};

/**
 * Drop the shock-event preconditions before rows cross to client components.
 *
 * Each ShockMoveEvent carries a ten-field preconditions object, and a pattern
 * carries up to eighty events per symbol: 12,726 of them in the /terminal
 * flight payload, 15.2 MB of an 18.3 MB document and the largest single cause
 * of a 14s time to DOM interactive.
 *
 * Only execution-intelligence reads them, and only through entryTypeMatches.
 * Callers must therefore compute ExecutionTimingSystem on the server and pass
 * the result down; every other client consumer of shockEvents reads the array
 * length, eventDate or outcomeStatus, all of which this keeps intact.
 */
/**
 * Reduce each row's raw scanner record to the fields the browser actually reads.
 *
 * Measured on production: the raw block averages 11,618 bytes across 199 keys,
 * and 129 of those keys -- 8,747 bytes, 75% of the block -- are never read by
 * any module reachable from a client component. Across 349 rows that is 2.9 MB
 * of a 16.8 MB flight payload, and it includes alpaca_request_id,
 * provider_error, provider_latency_ms and data_provider_primary, which should
 * not reach a browser at all.
 *
 * The allowlist is derived from the import graph rather than chosen by hand,
 * and raw-field-allowlist.test.ts fails if a client-reachable read is missing
 * from it. Apply this only at a serialisation boundary, after the server-side
 * passes have read whatever they need from the full record.
 */
export function stripRawFields(rows: OpportunityViewModel[]): OpportunityViewModel[] {
  return rows.map((row) => {
    const raw = row.raw;
    if (!raw || typeof raw !== "object") return row;
    const kept: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (CLIENT_READABLE_RAW_FIELD_SET.has(key)) kept[key] = (raw as Record<string, unknown>)[key];
    }
    return { ...row, raw: kept } as OpportunityViewModel;
  });
}

/**
 * Drop the shock event history before rows are serialised to the browser.
 *
 * The array is 4.7 MB of the /terminal payload -- 28% of it -- and no client
 * component reads its contents any more: institutional-trust takes
 * shockEventCount, and the two radars take a server-computed actionability
 * card. What remains on the pattern is the scores, the counts, and latestEvent.
 *
 * latestEvent is a sibling field, not part of the array, so it survives -- but
 * its own preconditions object does not. That was 102 KB the earlier
 * precondition strip never touched, because it walked shockEvents only.
 */
export function stripShockEventsForClient(rows: OpportunityViewModel[]): OpportunityViewModel[] {
  return rows.map((row) => {
    const pattern = row.shockPattern;
    if (!pattern) return row;
    const { shockEvents: _dropped, ...rest } = pattern;
    const latestEvent = pattern.latestEvent ? (({ preconditions: _alsoDropped, ...event }) => event)(pattern.latestEvent) : pattern.latestEvent;
    return { ...row, shockPattern: { ...rest, latestEvent } };
  });
}

export function buildOpportunitiesPageModel(
  rows: RankingRow[],
  performance: PerformanceData | null,
  shockPatterns: Map<string, ShockMovePattern> = new Map(),
  narratives: Map<string, NarrativeIntelligence> = new Map(),
): OpportunitiesPageModel {
  const edges = buildEdgeLookup(rows, performance);
  const macroResolver = createMacroContextResolver(rows);
  const viewModels = rows.map((row) => toOpportunityViewModel(row, edges[row.symbol.toUpperCase()], macroResolver.forRow(row), shockPatterns.get(row.symbol.toUpperCase()) ?? null, narratives.get(row.symbol.toUpperCase()) ?? null));
  const bestRaw = selectBestTradeNow(rows, edges);
  return {
    best: bestRaw ? toOpportunityViewModel(bestRaw.row, edges[bestRaw.row.symbol.toUpperCase()], macroResolver.forRow(bestRaw.row), shockPatterns.get(bestRaw.row.symbol.toUpperCase()) ?? null, narratives.get(bestRaw.row.symbol.toUpperCase()) ?? null) : null,
    rows: viewModels,
  };
}

function toOpportunityViewModel(
  row: RankingRow,
  edge?: Parameters<typeof computeConviction>[1],
  macroContext?: MacroExchangeContext,
  shockPattern: ShockMovePattern | null = null,
  narrative: NarrativeIntelligence | null = null,
): OpportunityViewModel {
  const conviction = computeConviction(row, edge);
  const structural = buildConvictionFragilityModel(row, { macroContext });
  const eventContext = buildVerifiedEventContext(row);
  const evidence = buildEvidenceMaturityFromSignal(row, { shockPattern });
  return {
    symbol: stringOrNull(row.symbol)?.toUpperCase() ?? "N/A",
    company_name: stringOrNull(row.company_name),
    assetType: stringOrNull(row.asset_type),
    sector: stringOrNull(row.sector),
    price: numberOrNull(row.price),
    final_score: numberOrNull(row.final_score),
    final_decision: stringOrNull(row.final_decision ?? row.action),
    decision_reason: humanizeInsightText(row.decision_reason ?? row.quality_reason ?? row.selection_reason, ""),
    entryStatus: stringOrNull(row.entry_status),
    entryZoneLabel: entryZoneLabel(row),
    evidence,
    recommendationQuality: stringOrNull(row.recommendation_quality),
    recommendationQualityLabel: friendlyLabel(row.recommendation_quality),
    suggested_entry: firstNumberOrNull(row.suggested_entry ?? row.buy_zone ?? row.entry_zone ?? row.price),
    stop_loss: firstNumberOrNull(row.stop_loss ?? row.invalidation_level),
    target: firstNumberOrNull(row.conservative_target ?? row.take_profit_zone ?? row.take_profit_high ?? row.target_price),
    conviction: conviction.score,
    confidenceLabel: conviction.label,
    decayLabel: structural.decay.label,
    dataFreshness: freshnessFromTimestamp(stringOrNull(row.last_updated ?? row.last_updated_utc)),
    fragility: structural.fragility.score,
    fragilityLabel: structural.fragility.label,
    eventLabel: eventContext.compactLabel,
    eventRisk: eventContext.riskScore,
    macroAdjustment: numberOrNull(row.macro_context_adjustment_total ?? row.regime_adjustment),
    macroLabel: macroContext ? macroAlignmentLabel(macroContext) : "Macro Mixed",
    narrative,
    raw: row,
    shockPattern,
    structuralLabel: compactStructuralLabel(structural),
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
  return humanizeLabel(text);
}
