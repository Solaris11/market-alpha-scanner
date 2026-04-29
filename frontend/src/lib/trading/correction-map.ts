import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, formatMoney } from "@/lib/ui/formatters";

export type CorrectionConfidence = "High" | "Medium" | "Low";

export type CorrectionMap = {
  confidence: CorrectionConfidence;
  currentPrice: number | null;
  distancePct: number | null;
  isActionable: boolean;
  zoneHigh: number | null;
  zoneLow: number | null;
};

const ENTRY_LOW_KEYS = ["correction_zone_low", "entry_zone_low", "buy_zone_low"];
const ENTRY_HIGH_KEYS = ["correction_zone_high", "entry_zone_high", "buy_zone_high"];
const ENTRY_TEXT_KEYS = ["entry_zone", "buy_zone", "suggested_entry"];
const AVWAP_KEYS = ["avwap", "AVWAP", "anchored_vwap", "anchored_vwap_price"];
const SWING_LOW_KEYS = ["recent_swing_low", "swing_low", "recent_support", "support_level", "support"];
const ATR_KEYS = ["atr", "atr_value", "current_atr"];

export function buildCorrectionMap(row: RankingRow): CorrectionMap {
  const currentPrice = numberFrom(row, ["price"]);
  const isActionable = isCorrectionCandidate(row);
  const zone = correctionZone(row, currentPrice);
  const distancePct = currentPrice !== null && zone.high !== null && currentPrice > 0 ? (zone.high - currentPrice) / currentPrice : null;

  return {
    confidence: zone.confidence,
    currentPrice,
    distancePct,
    isActionable,
    zoneHigh: zone.high,
    zoneLow: zone.low,
  };
}

export function applyCorrectionMapFields(row: RankingRow): RankingRow {
  const map = buildCorrectionMap(row);
  if (!map.isActionable || map.zoneLow === null || map.zoneHigh === null) return row;

  row.correction_price = (map.zoneLow + map.zoneHigh) / 2;
  row.correction_zone_low = map.zoneLow;
  row.correction_zone_high = map.zoneHigh;
  row.correction_distance_pct = map.distancePct ?? undefined;
  row.correction_confidence = map.confidence;
  return row;
}

export function formatCorrectionZone(map: Pick<CorrectionMap, "zoneHigh" | "zoneLow">): string {
  if (map.zoneLow === null || map.zoneHigh === null) return "N/A";
  if (Math.abs(map.zoneLow - map.zoneHigh) < 0.005) return formatMoney(map.zoneLow);
  return `${formatMoney(map.zoneLow)}-${formatMoney(map.zoneHigh)}`;
}

export function correctionMidpoint(map: Pick<CorrectionMap, "zoneHigh" | "zoneLow">): number | null {
  if (map.zoneLow === null || map.zoneHigh === null) return null;
  return (map.zoneLow + map.zoneHigh) / 2;
}

function isCorrectionCandidate(row: RankingRow): boolean {
  const decision = cleanText(row.final_decision, "").toUpperCase();
  const entryStatus = cleanText(row.entry_status, "").toUpperCase();
  return decision === "WAIT_PULLBACK" || entryStatus.includes("OVEREXTENDED");
}

function correctionZone(row: RankingRow, currentPrice: number | null): { confidence: CorrectionConfidence; high: number | null; low: number | null } {
  const entryRange = rangeFrom(row, ENTRY_LOW_KEYS, ENTRY_HIGH_KEYS, ENTRY_TEXT_KEYS);
  if (entryRange.low !== null && entryRange.high !== null) {
    return { confidence: entryRange.fromText ? "Medium" : "High", high: entryRange.high, low: entryRange.low };
  }

  const avwap = numberFrom(row, AVWAP_KEYS);
  const swingLow = numberFrom(row, SWING_LOW_KEYS);
  const fallbackPrice = supportFallback(avwap, swingLow);
  if (fallbackPrice === null) return { confidence: "Low", high: null, low: null };

  const atrBuffer = atrValue(row, currentPrice) * 0.25;
  return {
    confidence: "Low",
    high: fallbackPrice + atrBuffer,
    low: Math.max(0, fallbackPrice - atrBuffer),
  };
}

function rangeFrom(row: RankingRow, lowKeys: string[], highKeys: string[], textKeys: string[]): { fromText: boolean; high: number | null; low: number | null } {
  const low = numberFrom(row, lowKeys);
  const high = numberFrom(row, highKeys);
  if (low !== null && high !== null) return { fromText: false, high: Math.max(low, high), low: Math.min(low, high) };
  if (low !== null || high !== null) {
    const value = low ?? high;
    return { fromText: false, high: value, low: value };
  }

  for (const key of textKeys) {
    const numbers = extractNumbers(row[key]);
    if (numbers.length >= 2) return { fromText: true, high: Math.max(numbers[0], numbers[1]), low: Math.min(numbers[0], numbers[1]) };
    if (numbers.length === 1) return { fromText: true, high: numbers[0], low: numbers[0] };
  }

  return { fromText: false, high: null, low: null };
}

function supportFallback(avwap: number | null, swingLow: number | null): number | null {
  if (avwap !== null && swingLow !== null) return Math.min(avwap, swingLow);
  return avwap ?? swingLow;
}

function atrValue(row: RankingRow, currentPrice: number | null): number {
  const atr = numberFrom(row, ATR_KEYS);
  if (atr !== null && atr > 0) return atr;

  const atrPct = finiteNumber(row.atr_pct);
  if (atrPct === null || atrPct <= 0 || currentPrice === null) return 0;
  return currentPrice * (atrPct > 1 ? atrPct / 100 : atrPct);
}

function numberFrom(row: RankingRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = finiteNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function extractNumbers(value: unknown): number[] {
  const text = cleanText(value, "").replace(/,/g, "");
  if (!text) return [];
  return Array.from(text.matchAll(/\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value) && value > 0);
}
