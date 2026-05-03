import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { scannerOutputDir } from "@/lib/scanner-data";
import { assertNoPremiumFields, type PublicMarketSummary } from "@/lib/public-signals";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import type { ScanSafetyState } from "@/lib/stale-data-safety";

export type PublicSignalPreview = {
  scanSafety: ScanSafetyState;
  summary: PublicMarketSummary;
};

export async function getPublicMarketSummary(): Promise<PublicSignalPreview> {
  const [scanSafety, files] = await Promise.all([
    getCurrentScanSafety(),
    Promise.all([fileMetadata("full_ranking.csv"), fileMetadata("top_candidates.csv")]),
  ]);
  const lastUpdated = files
    .map((file) => file.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? scanSafety.lastUpdated;
  const summary: PublicMarketSummary = {
    filesAvailable: files.filter((file) => file.available).length,
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

async function fileMetadata(name: string): Promise<{ available: boolean; lastUpdated: string | null }> {
  try {
    const stat = await fs.stat(path.join(scannerOutputDir(), name));
    return { available: stat.isFile() && stat.size > 0, lastUpdated: stat.mtime.toISOString() };
  } catch {
    return { available: false, lastUpdated: null };
  }
}
