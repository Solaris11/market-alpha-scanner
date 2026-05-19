import type { OpportunityViewModel } from "./opportunity-view-model";

export type DiscoveryTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type DiscoveryTimeframe = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y";

export type DiscoveryQuickFilterKey =
  | "all"
  | "top_gainers_1d"
  | "top_gainers_1w"
  | "top_gainers_1m"
  | "top_gainers_3m"
  | "top_gainers_6m"
  | "top_gainers_1y"
  | "top_gainers_5y"
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
  | "performance"
  | "risk"
  | "confidence"
  | "macro"
  | "replay"
  | "freshness"
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
  sectorHeatmap: DiscoveryCluster[];
  stories: DiscoveryStory[];
  summary: string;
  symbols: DiscoverySymbol[];
  universeCount: number;
  watchlistCount: number;
};

export type DiscoveryFilterState = {
  filter: DiscoveryQuickFilterKey;
  query: string;
  sector: string;
  sort: DiscoverySortKey;
  timeframe: DiscoveryTimeframe;
};

export type BuildIntelligenceDiscoveryInput = {
  generatedAt?: string;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
};

const TIMEFRAMES: DiscoveryTimeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];

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
    sectorHeatmap,
    stories,
    summary: `Discovery is scanning ${universeCount.toLocaleString()} validated symbols across sectors, performance, risk, replay, macro, freshness, and watchlist context.`,
    symbols,
    universeCount,
    watchlistCount: symbols.filter((symbol) => symbol.watchlisted).length,
  };
}

export function filterDiscoverySymbols(symbols: DiscoverySymbol[], state: DiscoveryFilterState): DiscoverySymbol[] {
  const query = state.query.trim().toLowerCase();
  return rankDiscoverySymbols(
    symbols
      .filter((symbol) => state.sector === "ALL" || clean(symbol.sector) === state.sector)
      .filter((symbol) => {
        if (!query) return true;
        return [
          symbol.symbol,
          symbol.companyName,
          symbol.sector,
          symbol.assetType,
          symbol.setupType,
          symbol.decision,
          symbol.reason,
        ].some((value) => clean(value).toLowerCase().includes(query));
      })
      .filter((symbol) => matchesDiscoveryQuickFilter(symbol, state.filter)),
    state.sort,
    state.timeframe,
  );
}

export function rankDiscoverySymbols(symbols: DiscoverySymbol[], sort: DiscoverySortKey, timeframe: DiscoveryTimeframe): DiscoverySymbol[] {
  return [...symbols].sort((left, right) => {
    if (sort === "symbol") return left.symbol.localeCompare(right.symbol);
    if (sort === "performance") return numericDesc(left.performance[timeframe], right.performance[timeframe]) || attentionScore(right) - attentionScore(left);
    if (sort === "risk") return numericDesc(left.risk, right.risk) || numericDesc(left.shockRisk, right.shockRisk);
    if (sort === "confidence") return numericDesc(left.confidence, right.confidence) || right.conviction - left.conviction;
    if (sort === "macro") return numericDesc(left.macro, right.macro) || numericDesc(left.confidence, right.confidence);
    if (sort === "replay") return numericDesc(left.replay, right.replay) || numericDesc(left.evidence, right.evidence);
    if (sort === "freshness") return numericDesc(left.freshness, right.freshness) || numericDesc(left.confidence, right.confidence);
    return attentionScore(right) - attentionScore(left) || left.symbol.localeCompare(right.symbol);
  });
}

export function matchesDiscoveryQuickFilter(symbol: DiscoverySymbol, filter: DiscoveryQuickFilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "top_gainers_1d") return (symbol.performance["1D"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_1w") return (symbol.performance["1W"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_1m") return (symbol.performance["1M"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_3m") return (symbol.performance["3M"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_6m") return (symbol.performance["6M"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_1y") return (symbol.performance["1Y"] ?? Number.NEGATIVE_INFINITY) > 0;
  if (filter === "top_gainers_5y") return (symbol.performance["5Y"] ?? Number.NEGATIVE_INFINITY) > 0;
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
    { key: "top_gainers_1d", label: "Top gainers 1D", summary: "Names with positive one-day performance.", tone: "emerald" },
    { key: "top_gainers_1w", label: "Strongest 1W", summary: "Short-term performance leaders.", tone: "emerald" },
    { key: "top_gainers_1m", label: "Strongest 1M", summary: "One-month leadership.", tone: "emerald" },
    { key: "top_gainers_3m", label: "Strongest 3M", summary: "Three-month leadership.", tone: "emerald" },
    { key: "top_gainers_6m", label: "Strongest 6M", summary: "Six-month leadership.", tone: "emerald" },
    { key: "top_gainers_1y", label: "Strongest 1Y", summary: "One-year leadership.", tone: "emerald" },
    { key: "top_gainers_5y", label: "Strongest 5Y", summary: "Long-horizon performance leadership.", tone: "cyan" },
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

function buildDiscoveryStories(symbols: DiscoverySymbol[]): DiscoveryStory[] {
  const oneMonthLeaders = topSymbols(symbols, "performance", "1M", 5);
  const riskNames = topSymbols(symbols.filter((symbol) => (symbol.risk ?? 0) >= 60), "risk", "1D", 5);
  const macroSupported = topSymbols(symbols.filter((symbol) => (symbol.macro ?? 0) >= 60), "macro", "1M", 5);
  const replaySupported = topSymbols(symbols.filter((symbol) => (symbol.replay ?? 0) >= 60), "replay", "1M", 5);
  const watchlistRisk = topSymbols(symbols.filter((symbol) => symbol.watchlisted && ((symbol.risk ?? 0) >= 55 || symbol.fragility >= 60)), "risk", "1D", 5);

  return [
    storyFromSymbols("momentum", "Momentum leadership is visible", oneMonthLeaders, "1M", "Strongest visible one-month performers are leading discovery.", "emerald"),
    storyFromSymbols("risk", "Risk pressure is clustered", riskNames, "Risk", "Elevated risk names should be reviewed before treating discovery as opportunity.", "rose"),
    storyFromSymbols("macro", "Macro-supported names are discoverable", macroSupported, "Macro", "Macro alignment is supporting a visible subset of the scanner universe.", "cyan"),
    storyFromSymbols("replay", "Replay-supported setups are surfacing", replaySupported, "Replay", "Historical similarity evidence is present for a subset of names.", "violet"),
    storyFromSymbols("watchlist", "Watchlist discovery is active", watchlistRisk, "Watch", "Saved symbols with rising risk or fragility are visible.", "amber"),
  ].filter((story) => story.symbols.length > 0);
}

function buildComparePresets(symbols: DiscoverySymbol[]): DiscoveryComparePreset[] {
  const sectors = buildSectorHeatmap(symbols).slice(0, 3);
  const momentum = topSymbols(symbols, "performance", "1M", 3).map((symbol) => symbol.symbol);
  const risk = topSymbols(symbols, "risk", "1D", 3).map((symbol) => symbol.symbol);
  const macro = topSymbols(symbols.filter((symbol) => (symbol.macro ?? 0) >= 55), "macro", "1M", 3).map((symbol) => symbol.symbol);
  const presets: DiscoveryComparePreset[] = [
    { key: "momentum", label: "Momentum leaders", summary: "Compare the strongest visible performers.", symbols: momentum, tone: "emerald" },
    { key: "risk", label: "Risk escalation", summary: "Compare elevated-risk candidates before deeper research.", symbols: risk, tone: "rose" },
    { key: "macro", label: "Macro-supported", summary: "Compare names with visible macro support.", symbols: macro, tone: "cyan" },
    ...sectors.map((sector) => ({ key: `sector-${sector.key}`, label: `${sector.label} cluster`, summary: sector.detail, symbols: sector.symbols.slice(0, 3), tone: sector.tone })),
  ];
  return presets.filter((preset) => preset.symbols.length >= 2).slice(0, 6);
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
    node("universe", "Full Universe", input.symbols.length.toLocaleString(), average(input.symbols.map(attentionScore)), "Search every validated scanner row.", "cyan"),
    node("sectors", "Sector Map", input.sectorHeatmap.length.toLocaleString(), average(input.sectorHeatmap.map((cluster) => cluster.averageScore)), "Sector concentration and scanner density.", "emerald"),
    node("momentum", "Momentum", String(input.momentumClusters[2]?.count ?? 0), input.momentumClusters[2]?.averageScore ?? null, "Performance leadership across selected timeframes.", "emerald"),
    node("risk", "Risk Pressure", String(input.riskClusters[0]?.count ?? 0), input.riskClusters[0]?.averageScore ?? null, "Fragility, shock, and deterioration clusters.", "rose"),
    node("macro", "Macro Alignment", String(input.macroClusters[0]?.count ?? 0), input.macroClusters[0]?.averageScore ?? null, "Market context support and conflict.", "cyan"),
    node("replay", "Replay Context", String(input.macroClusters[2]?.count ?? 0), input.macroClusters[2]?.averageScore ?? null, "Replay and historical similarity support.", "violet"),
    node("watchlist", "Watchlist", watchlist.length.toLocaleString(), average(watchlist.map(attentionScore)), "Saved symbols connected to discovery.", "amber"),
    node("stories", "Market Stories", input.stories.length.toLocaleString(), average(input.stories.map((story) => Number.parseFloat(story.metric) || 50)), "Narrative discovery themes currently visible.", "violet"),
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
    grouped[key] = [...(grouped[key] ?? []), item];
  }
  return grouped;
}

function latestTimestamp(values: Array<string | null>): string | null {
  const timestamps = values
    .map((value) => {
      if (!value) return null;
      const time = Date.parse(value);
      return Number.isFinite(time) ? { time, value } : null;
    })
    .filter((value): value is { time: number; value: string } => value !== null)
    .sort((left, right) => right.time - left.time);
  return timestamps[0]?.value ?? null;
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

function numericDesc(left: number | null, right: number | null): number {
  return (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY);
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
