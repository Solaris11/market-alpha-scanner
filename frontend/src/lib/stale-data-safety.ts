import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { DataFreshness } from "@/lib/data-health";
import type { RankingRow, SymbolDetail } from "@/lib/types";

export const DEFAULT_MAX_SCAN_AGE_MINUTES = 240;
export const STALE_DATA_ACTION_REASON = "Data is stale. Refresh scan before acting.";
const SAFE_DATA_ACTION_REASON = "Data freshness is within safe limits.";

export type ScanSafetyState = {
  active: boolean;
  ageMinutes: number | null;
  humanAge: string;
  lastUpdated: string | null;
  maxAgeMinutes: number;
  reason: string;
  status: DataFreshness["status"];
};

export function buildScanSafetyState(freshness: DataFreshness, maxAgeMinutes = DEFAULT_MAX_SCAN_AGE_MINUTES): ScanSafetyState {
  const safeMaxAge = normalizeMaxAgeMinutes(maxAgeMinutes);
  const unavailable = freshness.status === "missing" || freshness.status === "schema_mismatch";
  const tooOld = freshness.ageMinutes !== null && freshness.ageMinutes > safeMaxAge;
  const unknownAge = freshness.ageMinutes === null && freshness.status !== "fresh" && freshness.status !== "slightly_stale";

  const active = unavailable || tooOld || unknownAge;

  return {
    active,
    ageMinutes: freshness.ageMinutes,
    humanAge: freshness.humanAge,
    lastUpdated: freshness.lastUpdated,
    maxAgeMinutes: safeMaxAge,
    reason: active ? STALE_DATA_ACTION_REASON : SAFE_DATA_ACTION_REASON,
    status: freshness.status,
  };
}

export function applyStaleDataSafetyToRows<T extends RankingRow>(rows: T[], safety: ScanSafetyState): T[] {
  return safety.active ? rows.map((row) => applyStaleDataSafetyToRow(row, safety)) : rows;
}

export function applyStaleDataSafetyToRow<T extends RankingRow>(row: T, safety: ScanSafetyState): T {
  if (!safety.active) return row;
  return {
    ...row,
    action: "WAIT",
    decision_reason: safety.reason,
    entry_status: "REFRESH_REQUIRED",
    final_decision: "WATCH",
    quality_reason: safety.reason,
    rating: "WATCH",
    recommendation_quality: "STALE_DATA",
    stale_data_safety_active: true,
    stale_data_safety_reason: safety.reason,
  } as T;
}

export function applyStaleDataSafetyToSymbolDetail(detail: SymbolDetail, safety: ScanSafetyState): SymbolDetail {
  if (!safety.active || !detail.row) return detail;
  return {
    ...detail,
    row: applyStaleDataSafetyToRow(detail.row, safety),
  };
}

export function applyStaleDataSafetyToMarketRegime(regime: MarketRegime, safety: ScanSafetyState): MarketRegime {
  if (!safety.active) return regime;
  return {
    ...regime,
    aggressiveEntriesAllowed: false,
    breadth: "STALE DATA",
    confidence: 0,
    leadership: "REFRESH REQUIRED",
  };
}

export function rowHasStaleDataSafety(row: RankingRow): boolean {
  return row.stale_data_safety_active === true;
}

function normalizeMaxAgeMinutes(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MAX_SCAN_AGE_MINUTES;
}
