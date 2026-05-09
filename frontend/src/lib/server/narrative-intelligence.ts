import "server-only";

import { dbQuery } from "@/lib/server/db";
import type { NarrativeDrift, NarrativeIntelligence, NarrativeSource } from "@/lib/trading/narrative-intelligence";
import type { QueryResultRow } from "pg";

type NarrativeSnapshotRow = QueryResultRow & {
  bearish_narrative: string;
  bullish_narrative: string;
  conditional_opportunity: string;
  decision_reasoning: string;
  event_reasoning: string;
  fragility_reasoning: string;
  generated_at: string | Date;
  liquidity_narrative: string;
  macro_narrative: string;
  moderator_summary: string;
  narrative_drift: unknown;
  narrative_summary: string;
  positioning_narrative: string;
  pressure_story: string;
  risk_language: string;
  risk_narrative: string;
  sector_narrative: string;
  source: string;
  symbol: string;
  unsupported_claims_detected: boolean;
  volatility_narrative: string;
  what_could_break: string;
  what_to_watch: unknown;
  why_setup_matters: string;
};

export async function getNarrativeForSymbol(symbol: string): Promise<NarrativeIntelligence | null> {
  const map = await getNarrativeMap([symbol]);
  return map.get(symbol.trim().toUpperCase()) ?? null;
}

export async function getNarrativeMap(symbols: string[]): Promise<Map<string, NarrativeIntelligence>> {
  const cleaned = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
  if (!cleaned.length) return new Map();
  try {
    const result = await dbQuery<NarrativeSnapshotRow>(
      `
        SELECT DISTINCT ON (symbol)
          symbol,
          source,
          narrative_summary,
          bullish_narrative,
          bearish_narrative,
          moderator_summary,
          risk_narrative,
          macro_narrative,
          sector_narrative,
          liquidity_narrative,
          volatility_narrative,
          positioning_narrative,
          decision_reasoning,
          event_reasoning,
          fragility_reasoning,
          why_setup_matters,
          what_could_break,
          conditional_opportunity,
          pressure_story,
          what_to_watch,
          narrative_drift,
          risk_language,
          unsupported_claims_detected,
          generated_at
        FROM narrative_intelligence_snapshots
        WHERE symbol = ANY($1::text[])
        ORDER BY symbol, generated_at DESC
      `,
      [cleaned],
    );
    return new Map(result.rows.map(rowToNarrative).filter((item): item is NarrativeIntelligence => item !== null).map((item) => [item.symbol, item]));
  } catch (error) {
    if (error instanceof Error && /narrative_intelligence_snapshots|relation .* does not exist/i.test(error.message)) return new Map();
    throw error;
  }
}

function rowToNarrative(row: NarrativeSnapshotRow): NarrativeIntelligence | null {
  const symbol = row.symbol.trim().toUpperCase();
  if (!symbol) return null;
  return {
    bearishNarrative: row.bearish_narrative,
    bullishNarrative: row.bullish_narrative,
    conditionalOpportunity: row.conditional_opportunity,
    decisionReasoning: row.decision_reasoning,
    eventReasoning: row.event_reasoning,
    fragilityReasoning: row.fragility_reasoning,
    generatedAt: timestampText(row.generated_at),
    liquidityNarrative: row.liquidity_narrative,
    macroNarrative: row.macro_narrative,
    moderatorSummary: row.moderator_summary,
    narrativeDrift: narrativeDrift(row.narrative_drift),
    narrativeSummary: row.narrative_summary,
    positioningNarrative: row.positioning_narrative,
    pressureStory: row.pressure_story,
    riskLanguage: row.risk_language,
    riskNarrative: row.risk_narrative,
    sectorNarrative: row.sector_narrative,
    source: sourceValue(row.source),
    symbol,
    unsupportedClaimsDetected: row.unsupported_claims_detected,
    volatilityNarrative: row.volatility_narrative,
    whatCouldBreak: row.what_could_break,
    whatToWatch: stringArray(row.what_to_watch).slice(0, 5),
    whySetupMatters: row.why_setup_matters,
  };
}

function narrativeDrift(value: unknown): NarrativeDrift {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const label = String(record.label ?? "stable");
  return {
    deteriorationScore: numeric(record.deteriorationScore ?? record.deterioration_score, 50),
    label: label === "strengthening" || label === "deteriorating" || label === "transitioning" ? label : "stable",
    momentumScore: numeric(record.momentumScore ?? record.momentum_score, 50),
    transitionSignals: stringArray(record.transitionSignals ?? record.transition_signals),
  };
}

function sourceValue(value: string): NarrativeSource {
  return value === "llm" ? "llm" : "deterministic";
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function numeric(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestampText(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
