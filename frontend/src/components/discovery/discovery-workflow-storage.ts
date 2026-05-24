import type {
  DiscoveryEvidenceFilter,
  DiscoveryMarketCapFilter,
  DiscoveryQuickFilterKey,
  DiscoveryRiskBandFilter,
  DiscoverySortKey,
  DiscoverySymbol,
  DiscoveryTimeframe,
} from "@/lib/trading/intelligence-discovery";

export type DiscoveryResultDensity = "cards" | "dense" | "speed" | "ultra";
export type DiscoveryScannerColumnKey = "performance" | "confidence" | "risk" | "macro" | "replay" | "freshness";

export type DiscoveryWorkflowState = {
  activeSymbol: string | null;
  assetType: string;
  compareSymbols: string[];
  density: DiscoveryResultDensity;
  evidence: DiscoveryEvidenceFilter;
  filter: DiscoveryQuickFilterKey;
  marketCap: DiscoveryMarketCapFilter;
  pinnedCompareSymbols: string[];
  query: string;
  riskBand: DiscoveryRiskBandFilter;
  scannerColumnKeys: DiscoveryScannerColumnKey[];
  sector: string;
  shortlistSymbols: string[];
  sort: DiscoverySortKey;
  timeframe: DiscoveryTimeframe;
  updatedAt: string | null;
  watchlistOnly: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const DISCOVERY_WORKFLOW_STORAGE_KEY = "tradeveto.discovery.workflow.v1";
const DEFAULT_SCANNER_COLUMNS: DiscoveryScannerColumnKey[] = ["performance", "confidence", "risk", "macro", "replay", "freshness"];
const DEFAULT_WORKFLOW_STATE: DiscoveryWorkflowState = {
  activeSymbol: null,
  assetType: "ALL",
  compareSymbols: [],
  density: "speed",
  evidence: "ALL",
  filter: "all",
  marketCap: "ALL",
  pinnedCompareSymbols: [],
  query: "",
  riskBand: "ALL",
  scannerColumnKeys: DEFAULT_SCANNER_COLUMNS,
  sector: "ALL",
  shortlistSymbols: [],
  sort: "attention",
  timeframe: "1M",
  updatedAt: null,
  watchlistOnly: false,
};

const DENSITIES = new Set<DiscoveryResultDensity>(["cards", "dense", "speed", "ultra"]);
const SCANNER_COLUMNS = new Set<DiscoveryScannerColumnKey>(DEFAULT_SCANNER_COLUMNS);
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

export function sanitizeDiscoverySymbols(values: unknown, validSymbols?: Set<string>, limit = 12): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const symbol = sanitizeSymbol(value);
    if (!symbol || seen.has(symbol)) continue;
    if (validSymbols && !validSymbols.has(symbol)) continue;
    seen.add(symbol);
    result.push(symbol);
    if (result.length >= limit) break;
  }

  return result;
}

export function sanitizeDiscoveryWorkflowState(value: unknown, symbols: DiscoverySymbol[] = []): DiscoveryWorkflowState {
  if (!isRecord(value)) return DEFAULT_WORKFLOW_STATE;
  const validSymbols = symbols.length ? new Set(symbols.map((symbol) => symbol.symbol)) : undefined;
  const activeSymbol = sanitizeDiscoverySymbols([value.activeSymbol], validSymbols, 1)[0] ?? null;
  const assetType = sanitizeDimension(value.assetType);
  const density = typeof value.density === "string" && DENSITIES.has(value.density as DiscoveryResultDensity) ? value.density as DiscoveryResultDensity : DEFAULT_WORKFLOW_STATE.density;
  const evidence = typeof value.evidence === "string" && EVIDENCE_FILTERS.has(value.evidence as DiscoveryEvidenceFilter) ? value.evidence as DiscoveryEvidenceFilter : DEFAULT_WORKFLOW_STATE.evidence;
  const filter = typeof value.filter === "string" && FILTERS.has(value.filter as DiscoveryQuickFilterKey) ? value.filter as DiscoveryQuickFilterKey : DEFAULT_WORKFLOW_STATE.filter;
  const marketCap = typeof value.marketCap === "string" && MARKET_CAPS.has(value.marketCap as DiscoveryMarketCapFilter) ? value.marketCap as DiscoveryMarketCapFilter : DEFAULT_WORKFLOW_STATE.marketCap;
  const query = sanitizeQuery(value.query);
  const riskBand = typeof value.riskBand === "string" && RISK_BANDS.has(value.riskBand as DiscoveryRiskBandFilter) ? value.riskBand as DiscoveryRiskBandFilter : DEFAULT_WORKFLOW_STATE.riskBand;
  const scannerColumnKeys = sanitizeScannerColumnKeys(value.scannerColumnKeys);
  const sector = sanitizeDimension(value.sector);
  const sort = typeof value.sort === "string" && SORTS.has(value.sort as DiscoverySortKey) ? value.sort as DiscoverySortKey : DEFAULT_WORKFLOW_STATE.sort;
  const timeframe = typeof value.timeframe === "string" && TIMEFRAMES.has(value.timeframe as DiscoveryTimeframe) ? value.timeframe as DiscoveryTimeframe : DEFAULT_WORKFLOW_STATE.timeframe;
  const updatedAt = typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null;
  const watchlistOnly = typeof value.watchlistOnly === "boolean" ? value.watchlistOnly : DEFAULT_WORKFLOW_STATE.watchlistOnly;

  return {
    activeSymbol,
    assetType,
    compareSymbols: sanitizeDiscoverySymbols(value.compareSymbols, validSymbols, 8),
    density,
    evidence,
    filter,
    marketCap,
    pinnedCompareSymbols: sanitizeDiscoverySymbols(value.pinnedCompareSymbols, validSymbols, 8),
    query,
    riskBand,
    scannerColumnKeys,
    sector,
    shortlistSymbols: sanitizeDiscoverySymbols(value.shortlistSymbols, validSymbols, 20),
    sort,
    timeframe,
    updatedAt,
    watchlistOnly,
  };
}

export function loadDiscoveryWorkflowState(storage: StorageLike | null | undefined, symbols: DiscoverySymbol[] = []): DiscoveryWorkflowState {
  if (!storage) return DEFAULT_WORKFLOW_STATE;
  try {
    const raw = storage.getItem(DISCOVERY_WORKFLOW_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKFLOW_STATE;
    return sanitizeDiscoveryWorkflowState(JSON.parse(raw), symbols);
  } catch {
    return DEFAULT_WORKFLOW_STATE;
  }
}

export function saveDiscoveryWorkflowState(storage: StorageLike | null | undefined, value: DiscoveryWorkflowState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DISCOVERY_WORKFLOW_STORAGE_KEY, JSON.stringify({ ...sanitizeDiscoveryWorkflowState(value), updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

function sanitizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return symbol.length > 0 && symbol.length <= 16 ? symbol : null;
}

function sanitizeQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

function sanitizeDimension(value: unknown): string {
  if (typeof value !== "string") return "ALL";
  const cleaned = value.trim().replace(/[^\w .&/-]/g, "").slice(0, 64);
  return cleaned || "ALL";
}

function sanitizeScannerColumnKeys(value: unknown): DiscoveryScannerColumnKey[] {
  if (!Array.isArray(value)) return DEFAULT_SCANNER_COLUMNS;
  const seen = new Set<DiscoveryScannerColumnKey>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!SCANNER_COLUMNS.has(item as DiscoveryScannerColumnKey)) continue;
    seen.add(item as DiscoveryScannerColumnKey);
  }
  return seen.size ? [...seen] : DEFAULT_SCANNER_COLUMNS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
