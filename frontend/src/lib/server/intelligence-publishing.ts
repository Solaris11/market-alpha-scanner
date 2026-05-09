import "server-only";

import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import {
  buildPublishedIntelligenceIndex,
  buildPublishedMacroRegimePage,
  buildPublishedShockPage,
  buildPublishedSymbolIntelligence,
  buildWhyWaitIntelligence,
} from "@/lib/trading/intelligence-publishing";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "@/lib/trading/opportunity-view-model";

export async function getPublishedOpportunityRows(): Promise<OpportunityViewModel[]> {
  const adapter = new ScannerDataAdapter();
  const rows = await adapter.getOverviewSignals().catch(() => []);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  return buildOpportunitiesPageModel(rows, null, shockPatterns, narratives).rows;
}

export async function getPublishedIntelligenceIndex() {
  const rows = await getPublishedOpportunityRows();
  return buildPublishedIntelligenceIndex(rows);
}

export async function getPublishedSymbolPage(symbol: string) {
  const rows = await getPublishedOpportunityRows();
  return buildPublishedSymbolIntelligence(rows, symbol);
}

export async function getPublishedWhyWaitPage(symbol: string) {
  const rows = await getPublishedOpportunityRows();
  return buildWhyWaitIntelligence(rows, symbol);
}

export async function getPublishedShockOpportunitiesPage() {
  const rows = await getPublishedOpportunityRows();
  return buildPublishedShockPage(rows);
}

export async function getPublishedMacroRegimePage() {
  const rows = await getPublishedOpportunityRows();
  return buildPublishedMacroRegimePage(rows);
}
