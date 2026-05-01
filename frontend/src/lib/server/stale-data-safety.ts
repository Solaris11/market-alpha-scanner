import "server-only";

import { getScanDataHealth } from "@/lib/scanner-data";
import { buildScanSafetyState, DEFAULT_MAX_SCAN_AGE_MINUTES, type ScanSafetyState } from "@/lib/stale-data-safety";
import type { DataFreshness } from "@/lib/data-health";

export function configuredMaxScanAgeMinutes(): number {
  const parsed = Number(process.env.MARKET_ALPHA_MAX_SCAN_AGE_MINUTES ?? DEFAULT_MAX_SCAN_AGE_MINUTES);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_SCAN_AGE_MINUTES;
}

export function scanSafetyFromFreshness(freshness: DataFreshness): ScanSafetyState {
  return buildScanSafetyState(freshness, configuredMaxScanAgeMinutes());
}

export async function getCurrentScanSafety(): Promise<ScanSafetyState> {
  return scanSafetyFromFreshness(await getScanDataHealth());
}
