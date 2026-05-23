import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type VerifiedEventItem = {
  eventAgeDays: number | null;
  eventConfidence: number | null;
  eventDecay: number | null;
  eventType: string;
  publishedAt: string | null;
  reasonCodes: string[];
  scope: string;
  source: string;
  sourceConfidence: string;
  sourceUrl: string;
  sourceWeight: number | null;
  title: string;
  weight: number | null;
};

export type VerifiedEventContextSummary = {
  available: boolean;
  compactLabel: string;
  eventConfidence: number;
  eventDecay: number;
  convictionAdjustment: number;
  eventPressureScore: number;
  feedDisclosure: string;
  feedStatus: string;
  fragilityAdjustment: number;
  label: string;
  macroPressureAdjustment: number;
  recentEvents: VerifiedEventItem[];
  reasonCodes: string[];
  riskScore: number;
  shockPressureScore: number;
  sourceWeight: number;
  sourcesUsed: string[];
  summary: string;
};

export function buildVerifiedEventContext(row: RankingRow): VerifiedEventContextSummary {
  const available = booleanish(rawField(row, "event_context_available"));
  const riskScore = finiteNumber(rawField(row, "event_risk_score")) ?? 50;
  const label = textField(row, "event_context_label") ?? (available ? labelFromRisk(riskScore) : "Event Context Limited");
  const reasonCodes = reasonCodesFrom(rawField(row, "event_context_reason_codes"));
  const recentEvents = eventItems(rawField(row, "verified_event_recent_events"));
  const sourcesUsed = stringList(rawField(row, "verified_event_sources_used"));
  const summary = textField(row, "event_context_summary") ?? (available ? "Verified event context is available for this setup." : "Verified event context is not available yet.");
  return {
    available,
    compactLabel: compactEventLabel({ label, reasonCodes, riskScore }),
    eventConfidence: finiteNumber(rawField(row, "event_confidence")) ?? 0,
    eventDecay: finiteNumber(rawField(row, "event_decay")) ?? 0,
    convictionAdjustment: finiteNumber(rawField(row, "event_conviction_adjustment")) ?? 0,
    eventPressureScore: finiteNumber(rawField(row, "verified_event_pressure_score")) ?? 50,
    feedDisclosure: textField(row, "verified_event_feed_disclosure") ?? (available ? "Verified event provider status is available for this scanner packet." : "Verified event provider status is unavailable for this scanner packet."),
    feedStatus: textField(row, "verified_event_feed_status") ?? (available ? "active" : "unavailable"),
    fragilityAdjustment: finiteNumber(rawField(row, "event_fragility_adjustment")) ?? 0,
    label,
    macroPressureAdjustment: finiteNumber(rawField(row, "event_macro_pressure_adjustment")) ?? 0,
    recentEvents,
    reasonCodes,
    riskScore,
    shockPressureScore: finiteNumber(rawField(row, "event_shock_pressure_score")) ?? 50,
    sourceWeight: finiteNumber(rawField(row, "event_source_weight")) ?? 0,
    sourcesUsed,
    summary,
  };
}

export function eventTone(context: VerifiedEventContextSummary): "support" | "mixed" | "risk" | "muted" {
  if (!context.available) return "muted";
  if (context.riskScore >= 68 || context.fragilityAdjustment >= 3) return "risk";
  if (context.convictionAdjustment >= 0.75 && context.riskScore < 62) return "support";
  return "mixed";
}

export function eventReasonLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized === "EVENT_INFLATION_PRESSURE") return "inflation pressure";
  if (normalized === "EVENT_HOT_INFLATION_SURPRISE") return "hot inflation surprise";
  if (normalized === "EVENT_COOLING_INFLATION_SURPRISE") return "cooling inflation surprise";
  if (normalized === "EVENT_EMPLOYMENT_PRESSURE") return "employment pressure";
  if (normalized === "EVENT_UNEMPLOYMENT_SURPRISE") return "unemployment surprise";
  if (normalized === "EVENT_STRONG_LABOR_RATE_PRESSURE") return "strong labor/rates pressure";
  if (normalized === "EVENT_FED_RATES") return "Fed/rates context";
  if (normalized === "EVENT_HAWKISH_RATE_SURPRISE") return "hawkish rates surprise";
  if (normalized === "EVENT_DOVISH_RATE_SURPRISE") return "dovish rates surprise";
  if (normalized === "EVENT_LIQUIDITY_TIGHTENING") return "liquidity tightening";
  if (normalized === "EVENT_LIQUIDITY_SUPPORTIVE") return "liquidity supportive";
  if (normalized === "EVENT_VOLATILITY_PRESSURE") return "volatility pressure";
  if (normalized === "EVENT_RECESSION_PRESSURE") return "growth pressure";
  if (normalized === "EVENT_DEFENSIVE_ROTATION") return "defensive rotation";
  if (normalized === "EVENT_AI_SEMICONDUCTOR_THEME") return "AI/semiconductor theme";
  if (normalized === "EVENT_OIL_SUPPLY_SHOCK") return "oil supply shock";
  if (normalized === "EVENT_GOLD_SAFE_HAVEN") return "gold/safe-haven context";
  if (normalized === "EVENT_GEOPOLITICAL_ESCALATION") return "geopolitical escalation";
  if (normalized === "EVENT_FAILED_PEACE_TALKS") return "failed peace talks";
  if (normalized === "EVENT_GEOPOLITICAL_DEESCALATION") return "geopolitical de-escalation";
  if (normalized === "EVENT_EARNINGS_POSITIVE") return "positive earnings context";
  if (normalized === "EVENT_EARNINGS_POSITIVE_SURPRISE") return "positive earnings surprise";
  if (normalized === "EVENT_EARNINGS_NEGATIVE") return "negative earnings context";
  if (normalized === "EVENT_EARNINGS_NEGATIVE_SURPRISE") return "negative earnings surprise";
  if (normalized === "EVENT_EARNINGS_SENSITIVITY") return "earnings sensitivity";
  if (normalized === "EVENT_EARNINGS_CALENDAR") return "earnings calendar";
  if (normalized === "EVENT_ANALYST_ACTION") return "analyst action";
  if (normalized === "EVENT_ANALYST_POSITIVE_ACTION") return "positive analyst action";
  if (normalized === "EVENT_ANALYST_NEGATIVE_ACTION") return "negative analyst action";
  if (normalized === "EVENT_DIVIDEND_CONTEXT") return "dividend context";
  if (normalized === "EVENT_DIVIDEND_POSITIVE") return "positive dividend event";
  if (normalized === "EVENT_DIVIDEND_NEGATIVE") return "negative dividend event";
  if (normalized === "EVENT_MERGER_ACQUISITION") return "M&A catalyst";
  if (normalized === "EVENT_MNA_POSITIVE") return "positive M&A context";
  if (normalized === "EVENT_MNA_NEGATIVE") return "negative M&A context";
  if (normalized === "EVENT_INVESTMENT_CATALYST") return "investment catalyst";
  if (normalized === "EVENT_INVESTMENT_POSITIVE") return "positive investment context";
  if (normalized === "EVENT_INVESTMENT_NEGATIVE") return "negative investment context";
  if (normalized === "EVENT_PRODUCT_LAUNCH") return "product catalyst";
  if (normalized === "EVENT_PRODUCT_CATALYST_POSITIVE") return "positive product catalyst";
  if (normalized === "EVENT_PRODUCT_CATALYST_NEGATIVE") return "negative product catalyst";
  if (normalized === "EVENT_REGULATORY_RISK") return "regulatory risk";
  if (normalized === "EVENT_REGULATORY_POSITIVE") return "regulatory relief";
  if (normalized === "EVENT_CRYPTO_CONTEXT") return "crypto context";
  if (normalized === "EVENT_LLM_VERIFIED_CONTEXT") return "LLM evidence check";
  if (normalized === "VERIFIED_EVENT_SOURCE") return "verified source";
  if (normalized === "VERIFIED_EVENT_CONTEXT_AVAILABLE") return "verified event context";
  if (normalized === "EVENT_CONTEXT_SUPPORTIVE") return "event context supportive";
  if (normalized === "EVENT_FRAGILITY_PRESSURE") return "event fragility pressure";
  if (normalized === "EVENT_RISK_ELEVATED") return "event risk elevated";
  if (normalized === "EVENT_SHOCK_PRESSURE") return "shock pressure";
  if (normalized === "EVENT_SYMBOL_MATCH") return "symbol-specific event";
  if (normalized === "EVENT_SECTOR_MATCH") return "sector-mapped event";
  if (normalized === "EVENT_BROAD_MACRO") return "broad macro event";
  return humanizeLabel(normalized);
}

export function formatSignedAdjustment(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function compactEventLabel({ label, reasonCodes, riskScore }: { label: string; reasonCodes: string[]; riskScore: number }): string {
  if (reasonCodes.includes("EVENT_SHOCK_PRESSURE")) return "Volatility Shock Risk";
  if (reasonCodes.includes("EVENT_EARNINGS_SENSITIVITY") || reasonCodes.includes("EVENT_EARNINGS_NEGATIVE")) return "Earnings Fragility";
  if (reasonCodes.includes("EVENT_LIQUIDITY_TIGHTENING")) return "Liquidity Pressure";
  if (reasonCodes.includes("EVENT_VOLATILITY_PRESSURE")) return "Macro Pressure Elevated";
  if (riskScore >= 68) return "Event Risk Elevated";
  return label;
}

function eventItems(value: unknown): VerifiedEventItem[] {
  const rawItems = arrayFrom(value);
  return rawItems
    .map((item) => {
      const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
      const title = cleanText(record.title, "");
      const source = cleanText(record.source, "");
      if (!title || !source) return null;
      return {
        eventConfidence: finiteNumber(record.event_confidence ?? record.eventConfidence),
        eventAgeDays: finiteNumber(record.event_age_days ?? record.eventAgeDays),
        eventDecay: finiteNumber(record.event_decay ?? record.eventDecay),
        eventType: cleanText(record.event_type ?? record.eventType, "verified_update"),
        publishedAt: cleanText(record.published_at ?? record.publishedAt, "") || null,
        reasonCodes: reasonCodesFrom(record.reason_codes ?? record.reasonCodes),
        scope: cleanText(record.scope, "broad"),
        source,
        sourceConfidence: cleanText(record.source_confidence ?? record.sourceConfidence, "trusted"),
        sourceUrl: cleanText(record.source_url ?? record.sourceUrl, ""),
        sourceWeight: finiteNumber(record.source_weight ?? record.sourceWeight),
        title,
        weight: finiteNumber(record.weight),
      };
    })
    .filter((item): item is VerifiedEventItem => Boolean(item))
    .slice(0, 4);
}

function reasonCodesFrom(value: unknown): string[] {
  return stringList(value).map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, "")).filter(Boolean);
  const text = cleanText(value, "");
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => cleanText(item, "")).filter(Boolean);
    } catch {
      return [];
    }
  }
  return text.split(/[,|;]/).map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
}

function arrayFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const text = cleanText(value, "");
  if (!text.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function textField(row: RankingRow, key: string): string | null {
  const text = cleanText(rawField(row, key), "");
  return text || null;
}

function labelFromRisk(score: number): string {
  if (score >= 70) return "Event Risk Elevated";
  if (score >= 58) return "Macro Event Pressure";
  if (score <= 42) return "Verified Event Supportive";
  return "Event Context Mixed";
}

function booleanish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y"].includes(String(value ?? "").trim().toLowerCase());
}

function rawField(row: RankingRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}
