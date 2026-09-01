import type { IntelligenceDiscoverySystem } from "./intelligence-discovery";

/**
 * Limited-state discovery packet.
 *
 * Deliberately kept in its own module: the global discovery overlay lives in
 * TerminalShell, which renders on nearly every route, and it needs only this
 * helper for its error/limited path. Importing it from `intelligence-discovery`
 * pulled that entire ~54 KB model into the shared client shell of every page.
 */
export function buildLimitedIntelligenceDiscoverySystem(
  message = "Discovery is limited until premium scanner data is available.",
): IntelligenceDiscoverySystem {
  return {
    comparePresets: [],
    dataTimestamp: null,
    discoveryScore: 0,
    generatedAt: new Date().toISOString(),
    headline: "Discovery requires validated scanner data",
    limited: true,
    macroClusters: [],
    momentumClusters: [],
    orbitNodes: [],
    quickFilters: [],
    riskClusters: [],
    scannerPresets: [],
    sectorHeatmap: [],
    stories: [{ detail: message, key: "limited", metric: "Limited", symbols: [], title: "Limited evidence", tone: "amber" }],
    summary: message,
    symbols: [],
    universeCount: 0,
    watchlistCount: 0,
  };
}
