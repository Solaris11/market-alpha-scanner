import type {
  DiscoveryEvidenceFilter,
  DiscoveryMarketCapFilter,
  DiscoveryQuickFilterKey,
  DiscoveryRiskBandFilter,
  DiscoverySortKey,
  DiscoveryTimeframe,
} from "@/lib/trading/intelligence-discovery";

export type DiscoverySavedScanDensity = "cards" | "dense" | "speed" | "ultra";

export type DiscoverySavedScanPayload = {
  assetType: string;
  density: DiscoverySavedScanDensity;
  evidence: DiscoveryEvidenceFilter;
  filter: DiscoveryQuickFilterKey;
  marketCap: DiscoveryMarketCapFilter;
  query: string;
  riskBand: DiscoveryRiskBandFilter;
  sector: string;
  sort: DiscoverySortKey;
  timeframe: DiscoveryTimeframe;
  watchlistOnly: boolean;
};

export type DiscoverySavedScan = {
  createdAt: string | null;
  id: string;
  lastUsedAt: string | null;
  name: string;
  nameKey: string;
  payload: DiscoverySavedScanPayload;
  updatedAt: string | null;
  useCount: number;
};

const DENSITIES = new Set<DiscoverySavedScanDensity>(["cards", "dense", "speed", "ultra"]);
const FILTERS = new Set<DiscoveryQuickFilterKey>([
  "all",
  "best_setups",
  "breakout_candidates",
  "crash_risk",
  "money_flow",
  "top_gainers_1d",
  "top_gainers_1w",
  "top_gainers_1m",
  "top_gainers_3m",
  "top_gainers_6m",
  "top_gainers_1y",
  "top_gainers_5y",
  "top_losers_1d",
  "top_losers_1w",
  "top_losers_1m",
  "weakest",
  "volatility_expansion",
  "momentum_deterioration",
  "risk_escalation",
  "improving_conviction",
  "replay_supported",
  "macro_supported",
  "high_confidence",
  "fresh_setups",
  "watchlist",
]);
const SORTS = new Set<DiscoverySortKey>(["attention", "breakout", "crash", "performance", "money_flow", "risk", "confidence", "macro", "replay", "freshness", "weakness", "symbol"]);
const TIMEFRAMES = new Set<DiscoveryTimeframe>(["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"]);
const MARKET_CAPS = new Set<DiscoveryMarketCapFilter>(["ALL", "MEGA", "LARGE", "MID", "SMALL", "UNKNOWN"]);
const RISK_BANDS = new Set<DiscoveryRiskBandFilter>(["ALL", "LOW", "ELEVATED", "HIGH"]);
const EVIDENCE_FILTERS = new Set<DiscoveryEvidenceFilter>(["ALL", "STRONG", "DEVELOPING", "LIMITED"]);

export const DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD: DiscoverySavedScanPayload = {
  assetType: "ALL",
  density: "speed",
  evidence: "ALL",
  filter: "all",
  marketCap: "ALL",
  query: "",
  riskBand: "ALL",
  sector: "ALL",
  sort: "attention",
  timeframe: "1M",
  watchlistOnly: false,
};

export function sanitizeDiscoverySavedScanName(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
  return text || "Saved scan";
}

export function discoverySavedScanNameKey(value: unknown): string {
  const text = sanitizeDiscoverySavedScanName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return text || "saved_scan";
}

export function sanitizeDiscoverySavedScanPayload(value: unknown): DiscoverySavedScanPayload {
  const input = isRecord(value) ? value : {};
  return {
    assetType: sanitizeSelectText(input.assetType),
    density: stringInSet(input.density, DENSITIES, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.density),
    evidence: stringInSet(input.evidence, EVIDENCE_FILTERS, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.evidence),
    filter: stringInSet(input.filter, FILTERS, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.filter),
    marketCap: stringInSet(input.marketCap, MARKET_CAPS, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.marketCap),
    query: sanitizeQuery(input.query),
    riskBand: stringInSet(input.riskBand, RISK_BANDS, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.riskBand),
    sector: sanitizeSelectText(input.sector),
    sort: stringInSet(input.sort, SORTS, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.sort),
    timeframe: stringInSet(input.timeframe, TIMEFRAMES, DEFAULT_DISCOVERY_SAVED_SCAN_PAYLOAD.timeframe),
    watchlistOnly: input.watchlistOnly === true,
  };
}

function stringInSet<T extends string>(value: unknown, values: Set<T>, fallback: T): T {
  return typeof value === "string" && values.has(value as T) ? value as T : fallback;
}

function sanitizeQuery(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 80);
}

function sanitizeSelectText(value: unknown): string {
  const text = String(value ?? "ALL")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9&.,_ -]/g, "")
    .trim()
    .slice(0, 80);
  return text || "ALL";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
