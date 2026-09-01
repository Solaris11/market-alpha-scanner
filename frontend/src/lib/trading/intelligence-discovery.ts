import type { OpportunityViewModel } from "./opportunity-view-model";
import { formatHydrationSafeInteger } from "@/lib/ui/hydration-safe-formatters";
import type { DiscoverySavedScan, DiscoverySavedScanDensity } from "@/lib/discovery-saved-scans";

export type DiscoveryTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type DiscoveryTimeframe = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export type DiscoveryQuickFilterKey =
  | "all"
  | "best_setups"
  | "breakout_candidates"
  | "crash_risk"
  | "money_flow"
  | "top_gainers_1d"
  | "top_gainers_1w"
  | "top_gainers_1m"
  | "top_gainers_3m"
  | "top_gainers_6m"
  | "top_gainers_1y"
  | "top_gainers_5y"
  | "top_losers_1d"
  | "top_losers_1w"
  | "top_losers_1m"
  | "weakest"
  | "volatility_expansion"
  | "momentum_deterioration"
  | "risk_escalation"
  | "improving_conviction"
  | "replay_supported"
  | "macro_supported"
  | "high_confidence"
  | "fresh_setups"
  | "watchlist";

export type DiscoverySortKey =
  | "attention"
  | "breakout"
  | "crash"
  | "performance"
  | "money_flow"
  | "risk"
  | "confidence"
  | "macro"
  | "replay"
  | "freshness"
  | "weakness"
  | "symbol";

export type DiscoverySymbol = {
  alertState: string;
  assetType: string | null;
  companyName: string | null;
  confidence: number | null;
  conviction: number;
  decision: string;
  evidence: number | null;
  evidenceLabel: string;
  fragility: number;
  freshness: number | null;
  freshnessLabel: string;
  href: string;
  macro: number | null;
  marketCap: number | null;
  performance: Record<DiscoveryTimeframe, number | null>;
  price: number | null;
  reason: string;
  replay: number | null;
  risk: number | null;
  sector: string | null;
  setupType: string;
  shockRisk: number | null;
  symbol: string;
  trend: number | null;
  volatility: number | null;
  volume: number | null;
  watchlisted: boolean;
};

export type DiscoveryCluster = {
  averageScore: number | null;
  count: number;
  detail: string;
  key: string;
  label: string;
  symbols: string[];
  tone: DiscoveryTone;
  values: number[];
};

export type DiscoveryQuickFilter = {
  count: number;
  key: DiscoveryQuickFilterKey;
  label: string;
  summary: string;
  tone: DiscoveryTone;
};

export type DiscoveryStory = {
  detail: string;
  key: string;
  metric: string;
  symbols: string[];
  title: string;
  tone: DiscoveryTone;
};

export type DiscoveryComparePreset = {
  key: string;
  label: string;
  symbols: string[];
  summary: string;
  tone: DiscoveryTone;
};

export type DiscoveryScannerPreset = {
  assetType?: string;
  count: number;
  density?: DiscoverySavedScanDensity;
  evidence?: DiscoveryEvidenceFilter;
  filter: DiscoveryQuickFilterKey;
  id?: string;
  key: string;
  label: string;
  lastUsedAt?: string | null;
  marketCap?: DiscoveryMarketCapFilter;
  query?: string;
  riskBand?: DiscoveryRiskBandFilter;
  sector?: string;
  serverSaved: boolean;
  shortcut: string;
  sort: DiscoverySortKey;
  source?: "default" | "user";
  summary: string;
  timeframe: DiscoveryTimeframe;
  tone: DiscoveryTone;
  useCount?: number;
  userSaved?: boolean;
  watchlistOnly?: boolean;
};

export type DiscoveryOrbitNode = {
  detail: string;
  key: string;
  label: string;
  metric: string;
  score: number | null;
  tone: DiscoveryTone;
};

export type IntelligenceDiscoverySystem = {
  comparePresets: DiscoveryComparePreset[];
  dataTimestamp: string | null;
  discoveryScore: number;
  generatedAt: string;
  headline: string;
  limited: boolean;
  macroClusters: DiscoveryCluster[];
  momentumClusters: DiscoveryCluster[];
  orbitNodes: DiscoveryOrbitNode[];
  quickFilters: DiscoveryQuickFilter[];
  riskClusters: DiscoveryCluster[];
  scannerPresets: DiscoveryScannerPreset[];
  sectorHeatmap: DiscoveryCluster[];
  stories: DiscoveryStory[];
  summary: string;
  symbols: DiscoverySymbol[];
  universeCount: number;
  watchlistCount: number;
};

export type DiscoveryMarketCapFilter = "ALL" | "MEGA" | "LARGE" | "MID" | "SMALL" | "UNKNOWN";
export type DiscoveryRiskBandFilter = "ALL" | "LOW" | "ELEVATED" | "HIGH";
export type DiscoveryEvidenceFilter = "ALL" | "STRONG" | "DEVELOPING" | "LIMITED";

export type DiscoveryFilterState = {
  assetType?: string;
  evidence?: DiscoveryEvidenceFilter;
  filter: DiscoveryQuickFilterKey;
  marketCap?: DiscoveryMarketCapFilter;
  query: string;
  riskBand?: DiscoveryRiskBandFilter;
  sector: string;
  sort: DiscoverySortKey;
  timeframe: DiscoveryTimeframe;
  watchlistOnly?: boolean;
};

export type BuildIntelligenceDiscoveryInput = {
  generatedAt?: string;
  rows: OpportunityViewModel[];
  savedScans?: DiscoverySavedScan[];
  watchlistSymbols?: string[];
};

const TIMEFRAMES: DiscoveryTimeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];
const DEFAULT_INITIAL_DISCOVERY_SYMBOL_LIMIT = 160;
const LARGE_UNIVERSE_PROOF_SYMBOL_COUNT = 520;
const LARGE_UNIVERSE_PROOF_WATCHLIST_COUNT = 500;
const LARGE_UNIVERSE_PROOF_REAL_SYMBOLS = [
  "AMD",
  "NVDA",
  "AAPL",
  "MSFT",
  "TSLA",
  "META",
  "GOOGL",
  "AMZN",
  "AVGO",
  "SMCI",
  "PLTR",
  "COIN",
  "MSTR",
  "XOM",
  "JPM",
  "LLY",
  "UNH",
  "BA",
  "SHOP",
  "SNOW",
] as const;

export function buildLimitedIntelligenceDiscoverySystem(message = "Discovery is limited until premium scanner data is available."): IntelligenceDiscoverySystem {
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

export function buildIntelligenceDiscoverySystem(input: BuildIntelligenceDiscoveryInput): IntelligenceDiscoverySystem {
  const watchlist = new Set((input.watchlistSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const symbols = input.rows.map((row) => toDiscoverySymbol(row, watchlist));
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const universeCount = symbols.length;

  if (!symbols.length) {
    return buildLimitedIntelligenceDiscoverySystem("Scanner universe is empty. Waiting for a validated scan before discovery activates.");
  }

  const sectorHeatmap = buildSectorHeatmap(symbols);
  const momentumClusters = buildMomentumClusters(symbols);
  const riskClusters = buildRiskClusters(symbols);
  const macroClusters = buildMacroClusters(symbols);
  const quickFilters = buildQuickFilters(symbols);
  const scannerPresets = buildScannerPresets(symbols, input.savedScans ?? []);
  const stories = buildDiscoveryStories(symbols);
  const comparePresets = buildComparePresets(symbols);
  const discoveryScore = roundedAverage([
    average(symbols.map((symbol) => symbol.confidence)),
    average(symbols.map((symbol) => symbol.freshness)),
    average(symbols.map((symbol) => symbol.macro)),
    100 - average(symbols.map((symbol) => symbol.risk)),
  ], 50);
  const topStory = stories[0];
  const headline = topStory ? topStory.title : "Market discovery is active";
  const dataTimestamp = latestTimestamp(input.rows.map((row) => textValue(row.raw.last_updated_utc ?? row.raw.last_updated ?? row.dataFreshness.lastUpdated)));

  return {
    comparePresets,
    dataTimestamp,
    discoveryScore,
    generatedAt,
    headline,
    limited: false,
    macroClusters,
    momentumClusters,
    orbitNodes: buildOrbitNodes({ macroClusters, momentumClusters, riskClusters, sectorHeatmap, stories, symbols }),
    quickFilters,
    riskClusters,
    scannerPresets,
    sectorHeatmap,
    stories,
    summary: `Discovery is scanning ${formatHydrationSafeInteger(universeCount)} validated symbols across sectors, performance, risk, replay, macro, freshness, and watchlist context.`,
    symbols,
    universeCount,
    watchlistCount: symbols.filter((symbol) => symbol.watchlisted).length,
  };
}

export function buildLargeUniverseDiscoveryProofSystem(input: { generatedAt?: string; savedScans?: DiscoverySavedScan[]; symbolCount?: number; watchlistCount?: number } = {}): IntelligenceDiscoverySystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const symbolCount = Math.max(500, Math.min(760, Math.trunc(input.symbolCount ?? LARGE_UNIVERSE_PROOF_SYMBOL_COUNT)));
  const watchlistCount = Math.max(0, Math.min(symbolCount, Math.trunc(input.watchlistCount ?? LARGE_UNIVERSE_PROOF_WATCHLIST_COUNT)));
  const symbols = buildLargeUniverseProofSymbols({ symbolCount, watchlistCount });
  const sectorHeatmap = buildSectorHeatmap(symbols);
  const momentumClusters = buildMomentumClusters(symbols);
  const riskClusters = buildRiskClusters(symbols);
  const macroClusters = buildMacroClusters(symbols);
  const quickFilters = buildQuickFilters(symbols);
  const scannerPresets = buildScannerPresets(symbols, input.savedScans ?? []);
  const stories = [
    {
      detail: "This is an isolated, authenticated, test-only large-universe scanner proof. Rows beyond real production symbols are non-trading proof rows used only to validate virtualization, browser timing, memory, and workflow behavior.",
      key: "large-universe-proof-boundary",
      metric: `${formatHydrationSafeInteger(symbolCount)} test-only rows`,
      symbols: symbols.slice(0, 6).map((symbol) => symbol.symbol),
      title: "Large-universe proof mode is isolated from user-facing scanner data",
      tone: "amber" as const,
    },
    ...buildDiscoveryStories(symbols).slice(0, 5),
  ];
  const comparePresets = buildComparePresets(symbols);
  const discoveryScore = roundedAverage([
    average(symbols.map((symbol) => symbol.confidence)),
    average(symbols.map((symbol) => symbol.freshness)),
    average(symbols.map((symbol) => symbol.macro)),
    100 - average(symbols.map((symbol) => symbol.risk)),
  ], 50);

  return {
    comparePresets,
    dataTimestamp: generatedAt,
    discoveryScore,
    generatedAt,
    headline: "TEST-ONLY large-universe scanner proof mode. Non-trading rows validate browser virtualization and workflow latency only.",
    limited: false,
    macroClusters,
    momentumClusters,
    orbitNodes: buildOrbitNodes({ macroClusters, momentumClusters, riskClusters, sectorHeatmap, stories, symbols }),
    quickFilters,
    riskClusters,
    scannerPresets,
    sectorHeatmap,
    stories,
    summary: `Test-only proof mode exposes ${formatHydrationSafeInteger(symbolCount)} isolated scanner rows with ${formatHydrationSafeInteger(watchlistCount)} proof watchlist rows. These rows are not recommendations, not live market signals, and not presented to normal production users.`,
    symbols,
    universeCount: symbolCount,
    watchlistCount,
  };
}

export function compactIntelligenceDiscoverySystem(system: IntelligenceDiscoverySystem, symbolLimit = DEFAULT_INITIAL_DISCOVERY_SYMBOL_LIMIT): IntelligenceDiscoverySystem {
  if (system.limited || system.symbols.length <= symbolLimit) return system;
  const requestedLimit = Number.isFinite(symbolLimit)
    ? Math.trunc(symbolLimit)
    : DEFAULT_INITIAL_DISCOVERY_SYMBOL_LIMIT;
  const boundedLimit = Math.max(1, Math.min(system.symbols.length, requestedLimit));
  return {
    ...system,
    symbols: system.symbols.slice(0, boundedLimit),
    summary: `Initial discovery packet loaded ${formatHydrationSafeInteger(boundedLimit)} of ${formatHydrationSafeInteger(system.universeCount)} validated symbols. Full-universe rows hydrate progressively when the workspace is open.`,
  };
}

export function filterDiscoverySymbols(symbols: DiscoverySymbol[], state: DiscoveryFilterState): DiscoverySymbol[] {
  const query = state.query.trim().toLowerCase();
  const marketCap = state.marketCap ?? "ALL";
  const riskBand = state.riskBand ?? "ALL";
  const evidence = state.evidence ?? "ALL";
  const assetType = state.assetType ?? "ALL";
  // An explicit ticker or company-name search is a direct request for one row.
  // It is exempt from the active quick/advanced filters and is surfaced first,
  // so typing a symbol never hides the symbol the user asked for.
  const directMatch = query ? resolveDiscoverySymbolMatch(symbols, state.query) : null;
  const filtered: DiscoverySymbol[] = [];

  for (const symbol of symbols) {
    if (directMatch && symbol.symbol === directMatch.symbol) continue;
    if (state.sector !== "ALL" && clean(symbol.sector) !== state.sector) continue;
    if (assetType !== "ALL" && clean(symbol.assetType, "Unknown") !== assetType) continue;
    if (state.watchlistOnly && !symbol.watchlisted) continue;
    if (!matchesMarketCapFilter(symbol, marketCap)) continue;
    if (!matchesRiskBandFilter(symbol, riskBand)) continue;
    if (!matchesEvidenceFilter(symbol, evidence)) continue;
    if (query && !matchesDiscoveryQuery(symbol, query)) continue;
    if (!matchesDiscoveryQuickFilter(symbol, state.filter)) continue;
    filtered.push(symbol);
  }

  const ranked = rankDiscoverySymbols(filtered, state.sort, state.timeframe);
  return directMatch ? [directMatch, ...ranked] : ranked;
}

const DISCOVERY_QUOTE_SUFFIXES = ["-USD", "-USDT", "-USDC"] as const;
const MIN_COMPANY_PREFIX_LENGTH = 3;

/**
 * Resolves a raw discovery search string to a validated row in the current
 * scanner packet. Handles exact tickers, `.`/`-` share-class aliases, bare
 * crypto bases (`BTC` -> `BTC-USD`), and company names (`Nvidia` -> `NVDA`).
 * Returns null when the packet holds no row for the query.
 */
export function resolveDiscoverySymbolMatch(symbols: DiscoverySymbol[], query: string): DiscoverySymbol | null {
  const token = query.trim().toUpperCase().replace(/\s+/g, " ");
  if (!token) return null;

  const bySymbol = new Map<string, DiscoverySymbol>();
  for (const symbol of symbols) bySymbol.set(symbol.symbol.toUpperCase(), symbol);

  const exact = bySymbol.get(token);
  if (exact) return exact;

  const aliased = token.includes(".")
    ? bySymbol.get(token.replace(/\./g, "-"))
    : token.includes("-")
      ? bySymbol.get(token.replace(/-/g, "."))
      : undefined;
  if (aliased) return aliased;

  if (!token.includes("-") && !token.includes(".")) {
    for (const suffix of DISCOVERY_QUOTE_SUFFIXES) {
      const quoted = bySymbol.get(`${token}${suffix}`);
      if (quoted) return quoted;
    }
  }

  const lowered = token.toLowerCase();
  let prefixMatch: DiscoverySymbol | null = null;
  for (const symbol of symbols) {
    const name = symbol.companyName?.trim().toLowerCase();
    if (!name) continue;
    if (name === lowered) return symbol;
    if (!prefixMatch && lowered.length >= MIN_COMPANY_PREFIX_LENGTH && name.startsWith(lowered)) prefixMatch = symbol;
  }
  return prefixMatch;
}

export function symbolCandidateFromDiscoveryQuery(query: string, symbols?: DiscoverySymbol[]): string | null {
  if (symbols && symbols.length) {
    const resolved = resolveDiscoverySymbolMatch(symbols, query);
    if (resolved) return resolved.symbol;
  }
  const candidate = query.trim().toUpperCase();
  if (!candidate || candidate.length > 12) return null;
  if (!/^[A-Z][A-Z0-9.-]*$/.test(candidate)) return null;
  return candidate;
}

function matchesDiscoveryQuery(symbol: DiscoverySymbol, query: string): boolean {
  if (symbol.symbol.toLowerCase().includes(query)) return true;
  if (symbol.companyName && symbol.companyName.toLowerCase().includes(query)) return true;
  if (symbol.sector && symbol.sector.toLowerCase().includes(query)) return true;
  if (symbol.assetType && symbol.assetType.toLowerCase().includes(query)) return true;
  if (symbol.setupType.toLowerCase().includes(query)) return true;
  if (symbol.decision.toLowerCase().includes(query)) return true;
  return symbol.reason.toLowerCase().includes(query);
}

export function rankDiscoverySymbols(symbols: DiscoverySymbol[], sort: DiscoverySortKey, timeframe: DiscoveryTimeframe): DiscoverySymbol[] {
  const ranked = symbols.map((symbol, index) => {
    const fallback = fallbackRankValue(symbol, timeframe);
    return {
      fallback,
      index,
      primary: primaryRankValue(symbol, sort, timeframe),
      symbol,
      ticker: symbol.symbol,
    };
  });

  ranked.sort((left, right) => {
    if (sort === "symbol") return left.ticker.localeCompare(right.ticker);
    const multiplier = sort === "weakness" ? 1 : -1;
    const primary = nullSafeRank(left.primary, right.primary, sort === "weakness") * multiplier;
    if (primary !== 0) return primary;
    const fallback = (right.fallback - left.fallback);
    if (fallback !== 0) return fallback;
    return left.ticker.localeCompare(right.ticker) || left.index - right.index;
  });

  return ranked.map((item) => item.symbol);
}

export function matchesDiscoveryQuickFilter(symbol: DiscoverySymbol, filter: DiscoveryQuickFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "best_setups") return bestSetupScore(symbol) >= 58;
  if (filter === "breakout_candidates") return breakoutScore(symbol) >= 58;
  if (filter === "crash_risk") return crashRiskScore(symbol) >= 65;
  if (filter === "money_flow") return moneyFlowScore(symbol) >= 58;
  if (filter === "top_gainers_1d") return (symbol.performance["1D"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_1w") return (symbol.performance["1W"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_1m") return (symbol.performance["1M"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_3m") return (symbol.performance["3M"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_6m") return (symbol.performance["6M"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_1y") return (symbol.performance["1Y"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_5y") return (symbol.performance["5Y"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_losers_1d") return (symbol.performance["1D"] ?? Number.POSITIVE_INFINITY) < 0;
  if (filter === "top_losers_1w") return (symbol.performance["1W"] ?? Number.POSITIVE_INFINITY) < 0;
  if (filter === "top_losers_1m") return (symbol.performance["1M"] ?? Number.POSITIVE_INFINITY) < 0;
  if (filter === "weakest") return firstPerformance(symbol) !== null && (firstPerformance(symbol) ?? 0) < 0;
  if (filter === "volatility_expansion") return (symbol.volatility ?? 0) >= 65 || (symbol.shockRisk ?? 0) >= 65;
  if (filter === "momentum_deterioration") return (symbol.trend ?? 100) <= 42 || (symbol.performance["1D"] ?? 0) < -2 || (symbol.performance["1W"] ?? 0) < -4;
  if (filter === "risk_escalation") return (symbol.risk ?? 0) >= 65 || symbol.fragility >= 70;
  if (filter === "improving_conviction") return symbol.conviction >= 65 && (symbol.performance["1D"] ?? 0) >= 0;
  if (filter === "replay_supported") return (symbol.replay ?? 0) >= 60;
  if (filter === "macro_supported") return (symbol.macro ?? 0) >= 60;
  if (filter === "high_confidence") return (symbol.confidence ?? symbol.conviction) >= 70;
  if (filter === "fresh_setups") return (symbol.freshness ?? 0) >= 70;
  return symbol.watchlisted;
}

function primaryRankValue(symbol: DiscoverySymbol, sort: DiscoverySortKey, timeframe: DiscoveryTimeframe): number | null {
  if (sort === "performance" || sort === "weakness") return symbol.performance[timeframe];
  if (sort === "breakout") return breakoutScore(symbol);
  if (sort === "crash") return crashRiskScore(symbol);
  if (sort === "money_flow") return moneyFlowScore(symbol);
  if (sort === "risk") return symbol.risk;
  if (sort === "confidence") return symbol.confidence ?? symbol.conviction;
  if (sort === "macro") return symbol.macro;
  if (sort === "replay") return symbol.replay;
  if (sort === "freshness") return symbol.freshness;
  if (sort === "symbol") return null;
  return attentionScore(symbol);
}

function fallbackRankValue(symbol: DiscoverySymbol, timeframe: DiscoveryTimeframe): number {
  return attentionScore(symbol)
    + (symbol.confidence ?? symbol.conviction) * 0.08
    + (symbol.replay ?? 0) * 0.04
    + normalizeSigned(symbol.performance[timeframe]) * 0.04
    - (symbol.risk ?? 0) * 0.02;
}

function nullSafeRank(left: number | null, right: number | null, ascending: boolean): number {
  const leftValue = left ?? (ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  const rightValue = right ?? (ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  return leftValue - rightValue;
}

function toDiscoverySymbol(row: OpportunityViewModel, watchlist: Set<string>): DiscoverySymbol {
  const symbol = row.symbol.toUpperCase();
  const raw = row.raw;
  const performance = performanceMap(raw);
  const risk = average([row.fragility, row.eventRisk, numeric(raw.risk_pressure_score), numeric(raw.macro_pressure_score), numeric(raw.volatility_pressure)]);
  const confidence = firstNumeric(raw.confidence_score, raw.score_reliability, raw.confidence_reliability, row.conviction);
  const macro = firstNumeric(raw.macro_alignment_score, raw.macro_score, raw.risk_on_score, raw.exchange_health_score, row.macroAdjustment === null ? null : 50 + row.macroAdjustment * 10);
  const replay = firstNumeric(row.shockPattern?.currentSimilarityScore, raw.replay_similarity_score, raw.market_memory_similarity, raw.regime_similarity_score, raw.event_similarity_score, raw.analog_similarity_score, raw.historical_similarity_score);
  const evidence = firstNumeric(raw.evidence_quality_score, raw.score_reliability, raw.confidence_reliability, raw.forward_return_coverage, raw.outcome_coverage, row.evidence?.score);
  const trend = firstNumeric(raw.trend_quality_score, raw.trend_score, raw.technical_score, raw.momentum_score, raw.final_score);
  const volatility = firstNumeric(raw.volatility_pressure, raw.annualized_volatility, raw.volatility, raw.volatility_pct, row.shockPattern?.twoSidedVolatilityScore);
  const shockRisk = firstNumeric(row.shockPattern?.downsideRiskScore, raw.event_shock_pressure_score, raw.verified_event_pressure_score, raw.shock_risk_score);

  return {
    alertState: clean(raw.alert_state ?? raw.alert_status, "Not configured"),
    assetType: nullableText(row.assetType),
    companyName: nullableText(row.company_name),
    confidence: clampNullable(confidence),
    conviction: clamp(row.conviction),
    decision: clean(row.final_decision ?? raw.action ?? raw.rating, "Watch"),
    evidence: clampNullable(evidence),
    evidenceLabel: clean(row.evidence?.label ?? raw.evidence_maturity, "Evidence limited"),
    fragility: clamp(row.fragility),
    freshness: clampNullable(freshnessScore(row)),
    freshnessLabel: row.dataFreshness.humanAge || row.decayLabel || "Latest available",
    href: `/symbol/${encodeURIComponent(symbol)}`,
    macro: clampNullable(macro),
    marketCap: firstNumeric(raw.market_cap, raw.marketCap),
    performance,
    price: row.price,
    reason: clean(row.decision_reason || row.raw.selection_reason || row.raw.quality_reason, "Scanner context is available, but detailed reasoning is limited."),
    replay: clampNullable(replay),
    risk: clampNullable(risk),
    sector: nullableText(row.sector),
    setupType: clean(raw.setup_type ?? row.entryStatus, "Setup limited"),
    shockRisk: clampNullable(shockRisk),
    symbol,
    trend: clampNullable(trend),
    volatility: clampNullable(volatility),
    volume: firstNumeric(raw.volume, raw.avg_volume, raw.average_volume),
    watchlisted: watchlist.has(symbol),
  };
}

function buildLargeUniverseProofSymbols(input: { symbolCount: number; watchlistCount: number }): DiscoverySymbol[] {
  const sectors = ["Technology", "Semiconductors", "Financials", "Energy", "Healthcare", "Industrials", "Consumer Cyclical", "Crypto"] as const;
  const setups = ["Test-only momentum", "Test-only mean reversion", "Test-only risk compression", "Test-only macro divergence", "Test-only replay analog", "Test-only catalyst"] as const;
  return Array.from({ length: input.symbolCount }, (_, index): DiscoverySymbol => {
    const realSymbol = LARGE_UNIVERSE_PROOF_REAL_SYMBOLS[index];
    const symbol = realSymbol ?? `TVP${String(index + 1).padStart(4, "0")}`;
    const sector = sectors[index % sectors.length] ?? "Technology";
    const setupType = setups[index % setups.length] ?? "Test-only scanner proof";
    const confidence = 42 + ((index * 17) % 57);
    const risk = 28 + ((index * 19) % 69);
    const macro = 36 + ((index * 23) % 61);
    const replay = 31 + ((index * 29) % 66);
    const freshness = 45 + ((index * 31) % 54);
    const watchlisted = index < input.watchlistCount;
    return {
      alertState: "test-only",
      assetType: index % 13 === 0 ? "Crypto" : "Equity",
      companyName: `${symbol} TEST-ONLY large-universe scanner proof row`,
      confidence,
      conviction: confidence,
      decision: "Test-only proof row",
      evidence: 40 + ((index * 7) % 60),
      evidenceLabel: "Test-only evidence",
      fragility: 20 + ((index * 11) % 75),
      freshness,
      freshnessLabel: "Test-only proof freshness",
      href: realSymbol ? `/symbol/${symbol}` : "/discover?proof=large-universe",
      macro,
      marketCap: 800_000_000 + index * 9_750_000_000,
      performance: buildProofPerformance(index),
      price: realSymbol ? 12 + index * 1.37 : null,
      reason: `TEST-ONLY non-trading scanner proof row for ${sector}. Used only to validate 500+ browser rows, virtualization, latency, memory, and workflow behavior; no market signal or recommendation is inferred.`,
      replay,
      risk,
      sector,
      setupType,
      shockRisk: 25 + ((index * 5) % 70),
      symbol,
      trend: 30 + ((index * 37) % 68),
      volatility: 20 + ((index * 41) % 76),
      volume: 1_000_000 + index * 173_000,
      watchlisted,
    };
  });
}

function buildProofPerformance(index: number): Record<DiscoveryTimeframe, number | null> {
  return {
    "1D": proofSigned(index, 3, 2.4),
    "1W": proofSigned(index, 5, 5.8),
    "1M": proofSigned(index, 7, 14.2),
    "3M": proofSigned(index, 11, 26.5),
    "6M": proofSigned(index, 13, 41.5),
    "1Y": proofSigned(index, 17, 72.5),
    "5Y": proofSigned(index, 19, 180),
  };
}

function proofSigned(index: number, multiplier: number, range: number): number {
  return Math.round(((((index * multiplier) % 200) / 100) * range - range) * 100) / 100;
}

function buildSectorHeatmap(symbols: DiscoverySymbol[]): DiscoveryCluster[] {
  const groups = groupBy(symbols, (symbol) => clean(symbol.sector, "Unclassified"));
  return Object.entries(groups)
    .map(([sector, items]) => {
      const score = average(items.map(attentionScore));
      return {
        averageScore: rounded(score),
        count: items.length,
        detail: `${sector} contains ${items.length} visible symbols. Average attention is ${Math.round(score)}/100 with average risk ${Math.round(average(items.map((item) => item.risk)))}/100.`,
        key: sector,
        label: sector,
        symbols: topSymbols(items, "attention", "1M", 5).map((item) => item.symbol),
        tone: toneForScore(score),
        values: items.slice(0, 12).map(attentionScore),
      };
    })
    .sort((left, right) => right.count - left.count || (right.averageScore ?? 0) - (left.averageScore ?? 0))
    .slice(0, 16);
}

function buildMomentumClusters(symbols: DiscoverySymbol[]): DiscoveryCluster[] {
  return TIMEFRAMES.map((timeframe) => {
    const ranked = rankDiscoverySymbols(symbols.filter((symbol) => symbol.performance[timeframe] !== null), "performance", timeframe).slice(0, 8);
    return {
      averageScore: rounded(average(ranked.map((symbol) => symbol.performance[timeframe]))),
      count: ranked.length,
      detail: ranked.length ? `${timeframe} leaders: ${ranked.map((symbol) => symbol.symbol).slice(0, 4).join(", ")}.` : `${timeframe} performance data is limited.`,
      key: `momentum-${timeframe}`,
      label: `Strongest ${timeframe}`,
      symbols: ranked.map((symbol) => symbol.symbol),
      tone: timeframe === "1D" || timeframe === "1W" ? "cyan" : "emerald",
      values: ranked.map((symbol) => normalizeSigned(symbol.performance[timeframe])),
    };
  });
}

function buildRiskClusters(symbols: DiscoverySymbol[]): DiscoveryCluster[] {
  const definitions: Array<{ key: string; label: string; predicate: (symbol: DiscoverySymbol) => boolean; tone: DiscoveryTone }> = [
    { key: "risk-escalation", label: "Risk escalation", predicate: (symbol) => (symbol.risk ?? 0) >= 65 || symbol.fragility >= 70, tone: "rose" },
    { key: "shock-risk", label: "Shock / event risk", predicate: (symbol) => (symbol.shockRisk ?? 0) >= 60, tone: "rose" },
    { key: "volatility", label: "Volatility expansion", predicate: (symbol) => (symbol.volatility ?? 0) >= 65, tone: "amber" },
    { key: "deterioration", label: "Momentum deterioration", predicate: (symbol) => matchesDiscoveryQuickFilter(symbol, "momentum_deterioration"), tone: "violet" },
  ];
  return definitions.map((definition) => {
    const items = symbols.filter(definition.predicate);
    return {
      averageScore: rounded(average(items.map((symbol) => symbol.risk))),
      count: items.length,
      detail: items.length ? `${items.length} symbols match ${definition.label.toLowerCase()}: ${items.slice(0, 5).map((symbol) => symbol.symbol).join(", ")}.` : `No validated ${definition.label.toLowerCase()} cluster is active.`,
      key: definition.key,
      label: definition.label,
      symbols: topSymbols(items, "risk", "1D", 6).map((symbol) => symbol.symbol),
      tone: definition.tone,
      values: items.slice(0, 12).map((symbol) => symbol.risk ?? symbol.fragility),
    };
  });
}

function buildMacroClusters(symbols: DiscoverySymbol[]): DiscoveryCluster[] {
  const supported = symbols.filter((symbol) => (symbol.macro ?? 0) >= 60);
  const conflicted = symbols.filter((symbol) => (symbol.macro ?? 100) <= 42 && (symbol.confidence ?? 0) >= 55);
  const replaySupported = symbols.filter((symbol) => (symbol.replay ?? 0) >= 60);
  return [
    clusterFromSymbols("macro-supported", "Macro-supported setups", supported, "emerald", "Macro alignment is constructive for these names."),
    clusterFromSymbols("macro-conflicts", "Macro conflicts", conflicted, "amber", "Setup quality exists, but macro support is limited or deteriorating."),
    clusterFromSymbols("replay-supported", "Replay-supported setups", replaySupported, "violet", "Replay or historical similarity evidence is visible."),
  ];
}

function buildQuickFilters(symbols: DiscoverySymbol[]): DiscoveryQuickFilter[] {
  const definitions: Array<{ key: DiscoveryQuickFilterKey; label: string; summary: string; tone: DiscoveryTone }> = [
    { key: "all", label: "Full universe", summary: "Search every validated scanner row.", tone: "cyan" },
    { key: "best_setups", label: "Best setups", summary: "Highest blend of quality, evidence, and controlled risk.", tone: "emerald" },
    { key: "breakout_candidates", label: "Breakout candidates", summary: "Expansion pressure with setup and replay context.", tone: "violet" },
    { key: "crash_risk", label: "Crash-risk candidates", summary: "Downside, fragility, volatility, or shock pressure.", tone: "rose" },
    { key: "money_flow", label: "Money-flow leaders", summary: "Sector support, performance, macro, and volume context.", tone: "cyan" },
    { key: "top_gainers_1d", label: "Top gainers 1D", summary: "Names with positive one-day performance.", tone: "emerald" },
    { key: "top_gainers_1w", label: "Strongest 1W", summary: "Short-term performance leaders.", tone: "emerald" },
    { key: "top_gainers_1m", label: "Strongest 1M", summary: "One-month leadership.", tone: "emerald" },
    { key: "top_gainers_3m", label: "Strongest 3M", summary: "Three-month leadership.", tone: "emerald" },
    { key: "top_gainers_6m", label: "Strongest 6M", summary: "Six-month leadership.", tone: "emerald" },
    { key: "top_gainers_1y", label: "Strongest 1Y", summary: "One-year leadership.", tone: "emerald" },
    { key: "top_gainers_5y", label: "Strongest 5Y", summary: "Long-horizon performance leadership.", tone: "cyan" },
    { key: "top_losers_1d", label: "Top losers 1D", summary: "Largest one-day downside movers.", tone: "rose" },
    { key: "top_losers_1w", label: "Weakest 1W", summary: "Short-term downside pressure.", tone: "rose" },
    { key: "top_losers_1m", label: "Weakest 1M", summary: "One-month downside pressure.", tone: "rose" },
    { key: "weakest", label: "Weakest performers", summary: "Symbols with negative visible performance.", tone: "rose" },
    { key: "volatility_expansion", label: "Volatility expansion", summary: "Volatility or shock pressure is elevated.", tone: "amber" },
    { key: "momentum_deterioration", label: "Momentum deterioration", summary: "Momentum has weakened or recent returns are negative.", tone: "violet" },
    { key: "risk_escalation", label: "Risk escalation", summary: "Fragility or risk pressure is elevated.", tone: "rose" },
    { key: "improving_conviction", label: "Improving conviction", summary: "Conviction is elevated with non-negative short-term performance.", tone: "cyan" },
    { key: "replay_supported", label: "Replay-supported", summary: "Historical or replay similarity is visible.", tone: "violet" },
    { key: "macro_supported", label: "Macro-supported", summary: "Macro alignment score is supportive.", tone: "cyan" },
    { key: "high_confidence", label: "High confidence", summary: "Confidence or conviction is high.", tone: "emerald" },
    { key: "fresh_setups", label: "Fresh setups", summary: "Freshness evidence is strong.", tone: "cyan" },
    { key: "watchlist", label: "Watchlist", summary: "Saved symbols only.", tone: "amber" },
  ];

  return definitions.map((definition) => ({
    ...definition,
    count: symbols.filter((symbol) => matchesDiscoveryQuickFilter(symbol, definition.key)).length,
  }));
}

function buildScannerPresets(symbols: DiscoverySymbol[], savedScans: DiscoverySavedScan[] = []): DiscoveryScannerPreset[] {
  const definitions: Array<Omit<DiscoveryScannerPreset, "count">> = [
    {
      filter: "best_setups",
      key: "preset-best-setups",
      label: "Best setup scanner",
      serverSaved: true,
      shortcut: "1",
      sort: "confidence",
      summary: "Highest setup quality with evidence, macro, replay, and controlled risk.",
      timeframe: "1M",
      tone: "emerald",
    },
    {
      filter: "breakout_candidates",
      key: "preset-breakout",
      label: "Breakout pressure",
      serverSaved: true,
      shortcut: "2",
      sort: "breakout",
      summary: "Quiet-to-active expansion candidates with trend, volatility, replay, and macro support.",
      timeframe: "1W",
      tone: "violet",
    },
    {
      filter: "crash_risk",
      key: "preset-crash-risk",
      label: "Crash-risk scan",
      serverSaved: true,
      shortcut: "3",
      sort: "crash",
      summary: "Fragility, downside, shock, and volatility pressure before treating a symbol as opportunity.",
      timeframe: "1D",
      tone: "rose",
    },
    {
      filter: "money_flow",
      key: "preset-money-flow",
      label: "Money-flow leaders",
      serverSaved: true,
      shortcut: "4",
      sort: "money_flow",
      summary: "Fast scan for symbols where sector leadership, macro context, performance, and liquidity are aligned.",
      timeframe: "1D",
      tone: "cyan",
    },
    {
      filter: "top_gainers_1d",
      key: "preset-daily-gainers",
      label: "Top gainers",
      serverSaved: true,
      shortcut: "5",
      sort: "performance",
      summary: "Strongest daily performers from the validated scanner universe.",
      timeframe: "1D",
      tone: "emerald",
    },
    {
      filter: "top_losers_1d",
      key: "preset-daily-losers",
      label: "Top losers",
      serverSaved: true,
      shortcut: "6",
      sort: "weakness",
      summary: "Largest daily downside movers for fast risk review.",
      timeframe: "1D",
      tone: "rose",
    },
    {
      filter: "replay_supported",
      key: "preset-replay",
      label: "Replay-supported",
      serverSaved: true,
      shortcut: "7",
      sort: "replay",
      summary: "Historical similarity and replay context visible in the current packet.",
      timeframe: "1M",
      tone: "violet",
    },
    {
      filter: "macro_supported",
      key: "preset-macro",
      label: "Macro-supported",
      serverSaved: true,
      shortcut: "8",
      sort: "macro",
      summary: "Symbols with supportive macro alignment and market-context evidence.",
      timeframe: "1M",
      tone: "cyan",
    },
    {
      filter: "volatility_expansion",
      key: "preset-volatility",
      label: "Volatility expansion",
      serverSaved: true,
      shortcut: "9",
      sort: "breakout",
      summary: "Fast scan for symbols where volatility or shock pressure is expanding.",
      timeframe: "1W",
      tone: "amber",
    },
    {
      filter: "high_confidence",
      key: "preset-high-confidence",
      label: "High confidence",
      serverSaved: true,
      shortcut: "0",
      sort: "confidence",
      summary: "Highest confidence or conviction rows with visible evidence.",
      timeframe: "1M",
      tone: "emerald",
    },
  ];

  const defaultPresets = definitions.map((definition) => ({
    ...definition,
    count: symbols.filter((symbol) => matchesDiscoveryQuickFilter(symbol, definition.filter)).length,
    source: "default" as const,
  }));

  const userPresets = savedScans.map((scan) => savedScanToScannerPreset(scan, symbols));
  return [...userPresets, ...defaultPresets];
}

function savedScanToScannerPreset(scan: DiscoverySavedScan, symbols: DiscoverySymbol[]): DiscoveryScannerPreset {
  const payload = scan.payload;
  const matches = filterDiscoverySymbols(symbols, payload);
  return {
    assetType: payload.assetType,
    count: matches.length,
    density: payload.density,
    evidence: payload.evidence,
    filter: payload.filter,
    id: scan.id,
    key: `saved-${scan.id}`,
    label: scan.name,
    lastUsedAt: scan.lastUsedAt,
    marketCap: payload.marketCap,
    query: payload.query,
    riskBand: payload.riskBand,
    sector: payload.sector,
    serverSaved: true,
    shortcut: "Saved",
    sort: payload.sort,
    source: "user",
    summary: savedScanSummary(payload),
    timeframe: payload.timeframe,
    tone: payload.watchlistOnly ? "amber" : payload.filter === "crash_risk" || payload.sort === "risk" || payload.sort === "crash" ? "rose" : payload.sort === "macro" ? "cyan" : payload.sort === "replay" ? "violet" : "emerald",
    useCount: scan.useCount,
    userSaved: true,
    watchlistOnly: payload.watchlistOnly,
  };
}

function savedScanSummary(payload: DiscoverySavedScan["payload"]): string {
  const filters = [
    payload.query ? `query "${payload.query}"` : null,
    payload.watchlistOnly ? "watchlist only" : null,
    payload.sector && payload.sector !== "ALL" ? payload.sector : null,
    payload.assetType && payload.assetType !== "ALL" ? payload.assetType : null,
    payload.marketCap && payload.marketCap !== "ALL" ? `${payload.marketCap.toLowerCase()} cap` : null,
    payload.riskBand && payload.riskBand !== "ALL" ? `${payload.riskBand.toLowerCase()} risk` : null,
    payload.evidence && payload.evidence !== "ALL" ? `${payload.evidence.toLowerCase()} evidence` : null,
  ].filter((value): value is string => Boolean(value));
  const filterText = filters.length ? filters.join(", ") : "full universe";
  return `${filterText}; sorted by ${payload.sort.replace(/_/g, " ")} over ${payload.timeframe} in ${payload.density} mode.`;
}

function buildDiscoveryStories(symbols: DiscoverySymbol[]): DiscoveryStory[] {
  const oneMonthLeaders = topSymbols(symbols, "performance", "1M", 5);
  const riskNames = topSymbols(symbols.filter((symbol) => (symbol.risk ?? 0) >= 60), "risk", "1D", 5);
  const macroSupported = topSymbols(symbols.filter((symbol) => (symbol.macro ?? 0) >= 60), "macro", "1M", 5);
  const moneyFlow = topSymbols(symbols.filter((symbol) => moneyFlowScore(symbol) >= 58), "money_flow", "1D", 5);
  const replaySupported = topSymbols(symbols.filter((symbol) => (symbol.replay ?? 0) >= 60), "replay", "1M", 5);
  const watchlistRisk = topSymbols(symbols.filter((symbol) => symbol.watchlisted && ((symbol.risk ?? 0) >= 55 || symbol.fragility >= 60)), "risk", "1D", 5);

  return [
    storyFromSymbols("momentum", "Momentum leadership is visible", oneMonthLeaders, "1M", "Strongest visible one-month performers are leading discovery.", "emerald"),
    storyFromSymbols("risk", "Risk pressure is clustered", riskNames, "Risk", "Elevated risk names should be reviewed before treating discovery as opportunity.", "rose"),
    storyFromSymbols("money-flow", "Money-flow leadership is emerging", moneyFlow, "Flow", "Sector support, performance, macro alignment, and volume context are concentrating in these names.", "cyan"),
    storyFromSymbols("macro", "Macro-supported names are discoverable", macroSupported, "Macro", "Macro alignment is supporting a visible subset of the scanner universe.", "cyan"),
    storyFromSymbols("replay", "Replay-supported setups are surfacing", replaySupported, "Replay", "Historical similarity evidence is present for a subset of names.", "violet"),
    storyFromSymbols("watchlist", "Watchlist discovery is active", watchlistRisk, "Watch", "Saved symbols with rising risk or fragility are visible.", "amber"),
  ].filter((story) => story.symbols.length > 0);
}

function buildComparePresets(symbols: DiscoverySymbol[]): DiscoveryComparePreset[] {
  const sectors = buildSectorHeatmap(symbols).slice(0, 3);
  const momentum = topSymbols(symbols, "performance", "1M", 3).map((symbol) => symbol.symbol);
  const risk = topSymbols(symbols, "risk", "1D", 3).map((symbol) => symbol.symbol);
  const breakout = topSymbols(symbols, "breakout", "1W", 3).map((symbol) => symbol.symbol);
  const downside = topSymbols(symbols, "crash", "1D", 3).map((symbol) => symbol.symbol);
  const replay = topSymbols(symbols.filter((symbol) => (symbol.replay ?? 0) >= 45), "replay", "1M", 3).map((symbol) => symbol.symbol);
  const macro = topSymbols(symbols.filter((symbol) => (symbol.macro ?? 0) >= 55), "macro", "1M", 3).map((symbol) => symbol.symbol);
  const moneyFlow = topSymbols(symbols.filter((symbol) => moneyFlowScore(symbol) >= 55), "money_flow", "1D", 3).map((symbol) => symbol.symbol);
  const presets: DiscoveryComparePreset[] = [
    { key: "momentum", label: "Momentum leaders", summary: "Compare the strongest visible performers.", symbols: momentum, tone: "emerald" },
    { key: "risk", label: "Risk escalation", summary: "Compare elevated-risk candidates before deeper research.", symbols: risk, tone: "rose" },
    { key: "breakout", label: "Expansion pressure", summary: "Compare breakout pressure, volatility, replay, and macro support.", symbols: breakout, tone: "violet" },
    { key: "downside", label: "Downside pressure", summary: "Compare fragility, downside movement, and shock risk candidates.", symbols: downside, tone: "rose" },
    { key: "money-flow", label: "Money-flow leaders", summary: "Compare symbols with aligned performance, macro, and liquidity context.", symbols: moneyFlow, tone: "cyan" },
    { key: "macro", label: "Macro-supported", summary: "Compare names with visible macro support.", symbols: macro, tone: "cyan" },
    { key: "replay", label: "Replay confidence", summary: "Compare historical similarity and evidence depth.", symbols: replay, tone: "violet" },
    ...sectors.map((sector) => ({ key: `sector-${sector.key}`, label: `${sector.label} cluster`, summary: sector.detail, symbols: sector.symbols.slice(0, 3), tone: sector.tone })),
  ];
  return presets.filter((preset) => preset.symbols.length >= 2).slice(0, 8);
}

function buildOrbitNodes(input: {
  macroClusters: DiscoveryCluster[];
  momentumClusters: DiscoveryCluster[];
  riskClusters: DiscoveryCluster[];
  sectorHeatmap: DiscoveryCluster[];
  stories: DiscoveryStory[];
  symbols: DiscoverySymbol[];
}): DiscoveryOrbitNode[] {
  const watchlist = input.symbols.filter((symbol) => symbol.watchlisted);
  return [
    node("universe", "Full Universe", formatHydrationSafeInteger(input.symbols.length), average(input.symbols.map(attentionScore)), "Search every validated scanner row.", "cyan"),
    node("sectors", "Sector Map", formatHydrationSafeInteger(input.sectorHeatmap.length), average(input.sectorHeatmap.map((cluster) => cluster.averageScore)), "Sector concentration and scanner density.", "emerald"),
    node("momentum", "Momentum", String(input.momentumClusters[2]?.count ?? 0), input.momentumClusters[2]?.averageScore ?? null, "Performance leadership across selected timeframes.", "emerald"),
    node("money-flow", "Money Flow", String(input.symbols.filter((symbol) => moneyFlowScore(symbol) >= 58).length), average(input.symbols.map(moneyFlowScore)), "Sector support, performance, macro, and liquidity alignment.", "cyan"),
    node("risk", "Risk Pressure", String(input.riskClusters[0]?.count ?? 0), input.riskClusters[0]?.averageScore ?? null, "Fragility, shock, and deterioration clusters.", "rose"),
    node("macro", "Macro Alignment", String(input.macroClusters[0]?.count ?? 0), input.macroClusters[0]?.averageScore ?? null, "Market context support and conflict.", "cyan"),
    node("replay", "Replay Context", String(input.macroClusters[2]?.count ?? 0), input.macroClusters[2]?.averageScore ?? null, "Replay and historical similarity support.", "violet"),
    node("watchlist", "Watchlist", formatHydrationSafeInteger(watchlist.length), average(watchlist.map(attentionScore)), "Saved symbols connected to discovery.", "amber"),
    node("stories", "Market Stories", formatHydrationSafeInteger(input.stories.length), average(input.stories.map((story) => Number.parseFloat(story.metric) || 50)), "Narrative discovery themes currently visible.", "violet"),
  ];
}

function clusterFromSymbols(key: string, label: string, items: DiscoverySymbol[], tone: DiscoveryTone, fallbackDetail: string): DiscoveryCluster {
  return {
    averageScore: rounded(average(items.map(attentionScore))),
    count: items.length,
    detail: items.length ? `${fallbackDetail} Visible symbols: ${items.slice(0, 5).map((symbol) => symbol.symbol).join(", ")}.` : `${fallbackDetail} No validated symbols currently match.`,
    key,
    label,
    symbols: topSymbols(items, "attention", "1M", 6).map((symbol) => symbol.symbol),
    tone,
    values: items.slice(0, 12).map(attentionScore),
  };
}

function storyFromSymbols(key: string, title: string, symbols: DiscoverySymbol[], metric: string, detail: string, tone: DiscoveryTone): DiscoveryStory {
  return {
    detail,
    key,
    metric,
    symbols: symbols.map((symbol) => symbol.symbol),
    title,
    tone,
  };
}

function node(key: string, label: string, metric: string, score: number | null, detail: string, tone: DiscoveryTone): DiscoveryOrbitNode {
  return { detail, key, label, metric, score: rounded(score), tone };
}

function topSymbols(symbols: DiscoverySymbol[], sort: DiscoverySortKey, timeframe: DiscoveryTimeframe, limit: number): DiscoverySymbol[] {
  return rankDiscoverySymbols(symbols, sort, timeframe).slice(0, limit);
}

function performanceMap(row: OpportunityViewModel["raw"]): Record<DiscoveryTimeframe, number | null> {
  return {
    "1D": firstNumeric(row.return_1d, row.price_change_pct, row.change_pct_1d),
    "1W": firstNumeric(row.return_1w, row.week_return, row.change_pct_1w),
    "1M": firstNumeric(row.return_1m, row.month_return, row.change_pct_1m),
    "3M": firstNumeric(row.return_3m, row.quarter_return, row.change_pct_3m),
    "6M": firstNumeric(row.return_6m, row.change_pct_6m),
    "1Y": firstNumeric(row.return_1y, row.year_return, row.change_pct_1y),
    "5Y": firstNumeric(row.return_5y, row.change_pct_5y),
  };
}

function attentionScore(symbol: DiscoverySymbol): number {
  const constructive = average([symbol.confidence, symbol.macro, symbol.replay, symbol.evidence, symbol.freshness, symbol.conviction]);
  const risk = symbol.risk ?? symbol.fragility;
  const perf = normalizeSigned(firstPerformance(symbol));
  return clamp(constructive * 0.48 + risk * 0.22 + perf * 0.16 + (symbol.watchlisted ? 14 : 0));
}

function bestSetupScore(symbol: DiscoverySymbol): number {
  const constructive = average([symbol.confidence, symbol.conviction, symbol.macro, symbol.replay, symbol.evidence, symbol.freshness, symbol.trend]);
  const riskPenalty = average([symbol.risk, symbol.fragility, symbol.shockRisk]) * 0.18;
  return clamp(constructive - riskPenalty + normalizeSigned(symbol.performance["1M"]) * 0.08);
}

function breakoutScore(symbol: DiscoverySymbol): number {
  const setupBoost = /breakout|expansion|compression|continuation|momentum|squeeze/i.test(symbol.setupType) ? 10 : 0;
  const shortTerm = average([normalizeSigned(symbol.performance["1D"]), normalizeSigned(symbol.performance["1W"])]);
  return clamp(
    average([symbol.trend, symbol.confidence, symbol.macro, symbol.replay, symbol.evidence]) * 0.50
      + average([symbol.volatility, symbol.shockRisk]) * 0.22
      + shortTerm * 0.16
      + setupBoost,
  );
}

function moneyFlowScore(symbol: DiscoverySymbol): number {
  const performancePulse = average([
    normalizeSigned(symbol.performance["1D"]),
    normalizeSigned(symbol.performance["1W"]),
    normalizeSigned(symbol.performance["1M"]),
  ]);
  const liquidityContext = symbol.volume === null ? null : normalizeVolume(symbol.volume);
  return clamp(average([
    performancePulse,
    symbol.macro,
    symbol.trend,
    symbol.confidence ?? symbol.conviction,
    liquidityContext,
    symbol.sector ? 58 : null,
  ]));
}

function crashRiskScore(symbol: DiscoverySymbol): number {
  const downsidePressure = average([
    negativeMoveScore(symbol.performance["1D"]),
    negativeMoveScore(symbol.performance["1W"]),
    negativeMoveScore(symbol.performance["1M"]),
  ]);
  return clamp(average([
    symbol.risk,
    symbol.fragility,
    symbol.shockRisk,
    symbol.volatility,
    symbol.trend === null ? null : 100 - symbol.trend,
    downsidePressure,
  ]));
}

function matchesMarketCapFilter(symbol: DiscoverySymbol, filter: DiscoveryMarketCapFilter): boolean {
  if (filter === "ALL") return true;
  if (symbol.marketCap === null) return filter === "UNKNOWN";
  const cap = symbol.marketCap;
  if (filter === "MEGA") return cap >= 200_000_000_000;
  if (filter === "LARGE") return cap >= 10_000_000_000 && cap < 200_000_000_000;
  if (filter === "MID") return cap >= 2_000_000_000 && cap < 10_000_000_000;
  return cap < 2_000_000_000;
}

function matchesRiskBandFilter(symbol: DiscoverySymbol, filter: DiscoveryRiskBandFilter): boolean {
  if (filter === "ALL") return true;
  const risk = symbol.risk ?? symbol.fragility;
  if (filter === "LOW") return risk < 45;
  if (filter === "ELEVATED") return risk >= 45 && risk < 70;
  return risk >= 70;
}

function matchesEvidenceFilter(symbol: DiscoverySymbol, filter: DiscoveryEvidenceFilter): boolean {
  if (filter === "ALL") return true;
  const evidence = symbol.evidence ?? 0;
  if (filter === "STRONG") return evidence >= 70;
  if (filter === "DEVELOPING") return evidence >= 45 && evidence < 70;
  return evidence < 45;
}

function negativeMoveScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  if (value >= 0) return Math.max(0, 50 - value * 2);
  return clamp(50 + Math.abs(value) * 6);
}

function firstPerformance(symbol: DiscoverySymbol): number | null {
  for (const timeframe of TIMEFRAMES) {
    const value = symbol.performance[timeframe];
    if (value !== null) return value;
  }
  return null;
}

function freshnessScore(row: OpportunityViewModel): number | null {
  const status = String(row.dataFreshness.status ?? "").toLowerCase();
  if (status === "fresh") return 100;
  if (status === "slightly_stale") return 72;
  if (status.includes("stale")) return 25;
  if (row.dataFreshness.ageMinutes === null) return null;
  return clamp(100 - Math.min(95, row.dataFreshness.ageMinutes / 3));
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFor(item);
    const bucket = grouped[key] ?? [];
    bucket.push(item);
    grouped[key] = bucket;
  }
  return grouped;
}

function latestTimestamp(values: Array<string | null>): string | null {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isFinite(time) || time <= latestTime) continue;
    latestTime = time;
    latestValue = value;
  }
  return latestValue;
}

function average(values: Array<number | null | undefined>): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function roundedAverage(values: Array<number | null | undefined>, fallback: number): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return fallback;
  return Math.round(average(finite));
}

function rounded(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function firstNumeric(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = numeric(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSigned(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return clamp(50 + value * 3);
}

function normalizeVolume(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 50;
  return clamp(35 + Math.log10(value) * 8);
}

function clampNullable(value: number | null): number | null {
  return value === null ? null : clamp(value);
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function clean(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const normalized = text.toLowerCase();
  if (["undefined", "$undefined", "nan", "none", "null", "n/a"].includes(normalized)) return fallback;
  return text;
}

function nullableText(value: unknown): string | null {
  const text = clean(value, "");
  return text || null;
}

function textValue(value: unknown): string | null {
  const text = clean(value, "");
  return text || null;
}

function toneForScore(score: number): DiscoveryTone {
  if (score >= 72) return "emerald";
  if (score >= 56) return "cyan";
  if (score >= 42) return "amber";
  return "rose";
}
