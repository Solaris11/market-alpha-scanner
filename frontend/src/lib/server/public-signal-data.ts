import "server-only";

import { getFullRanking, getTopCandidates } from "@/lib/scanner-data";
import { assertNoPremiumFields, toPublicSignal, type PublicSignal } from "@/lib/public-signals";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";
import type { ScanSafetyState } from "@/lib/stale-data-safety";

export type PublicSignalPreview = {
  scanSafety: ScanSafetyState;
  signals: PublicSignal[];
};

export async function getPublicTopSignals(limit = 6): Promise<PublicSignalPreview> {
  const [rawRows, scanSafety] = await Promise.all([getTopCandidates(), getCurrentScanSafety()]);
  const safeRows = applyStaleDataSafetyToRows(rawRows, scanSafety);
  const signals = safeRows.slice(0, Math.max(0, limit)).map(toPublicSignal);
  const preview = { scanSafety, signals };
  assertNoPremiumFields(preview);
  return preview;
}

export async function getPublicSymbolSignal(symbol: string): Promise<{ scanSafety: ScanSafetyState; signal: PublicSignal | null }> {
  const cleaned = symbol.trim().toUpperCase();
  const [rawRows, scanSafety] = await Promise.all([getFullRanking(), getCurrentScanSafety()]);
  const safeRows = applyStaleDataSafetyToRows(rawRows, scanSafety);
  const row = safeRows.find((item) => item.symbol.toUpperCase() === cleaned) ?? null;
  const preview = { scanSafety, signal: row ? toPublicSignal(row) : null };
  assertNoPremiumFields(preview);
  return preview;
}
