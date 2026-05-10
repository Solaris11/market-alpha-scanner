import "server-only";

import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { buildLiveIntelligenceSystem, type LiveIntelligenceSystem } from "@/lib/trading/live-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export type LiveIntelligenceLoadOptions = {
  refreshIntervalMs?: number;
  sequence?: number;
  streamMode?: "snapshot" | "sse";
};

export async function loadLiveIntelligenceSystem(options: LiveIntelligenceLoadOptions = {}): Promise<LiveIntelligenceSystem> {
  const adapter = new ScannerDataAdapter();
  const [rows, driftRows] = await Promise.all([
    adapter.getOverviewSignals().catch(() => []),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 24, minRuns: 2 }).catch(() => []),
  ]);
  const model = buildOpportunitiesPageModel(rows, null);
  return buildLiveIntelligenceSystem({
    driftRows,
    refreshIntervalMs: options.refreshIntervalMs,
    rows: model.rows,
    sequence: options.sequence,
    streamMode: options.streamMode ?? "snapshot",
  });
}
