import "server-only";

import { getScanDataHealth } from "@/lib/scanner-data";
import { assertNoPremiumFields, type PublicMarketSummary } from "@/lib/public-signals";
import { scanSafetyFromFreshness } from "@/lib/server/stale-data-safety";
import type { ScanSafetyState } from "@/lib/stale-data-safety";

export type PublicSignalPreview = {
  scanSafety: ScanSafetyState;
  summary: PublicMarketSummary;
};

export async function getPublicMarketSummary(): Promise<PublicSignalPreview> {
  const health = await getScanDataHealth();
  const scanSafety = scanSafetyFromFreshness(health);
  const lastUpdated = health.lastUpdated ?? scanSafety.lastUpdated;
  const summary: PublicMarketSummary = {
    filesAvailable: health.files.filter((file) => file.status !== "missing" && file.status !== "schema_mismatch").length,
    lastUpdated,
    locked: true,
    message: scanSafety.active ? scanSafety.reason : "Premium unlocks live scanner intelligence.",
    premiumDataHidden: true,
    scannerStatus: scanSafety.status,
  };
  const preview = { scanSafety, summary };
  assertNoPremiumFields(preview);
  return preview;
}

export async function getPublicSymbolSignal(_symbol: string): Promise<{ scanSafety: ScanSafetyState; signal: null; summary: PublicMarketSummary }> {
  const preview = await getPublicMarketSummary();
  return { ...preview, signal: null };
}
