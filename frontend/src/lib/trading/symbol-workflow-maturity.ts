import type { CsvRow, HistorySummary, PerformanceData, RankingRow, SymbolHistoryRow } from "../types";

export type SymbolSearchSort = "history" | "relevance" | "risk" | "score" | "symbol";

export type SymbolSearchFilterState = {
  decisions: string[];
  historyOnly: boolean;
  macroRegimes: string[];
  maxRisk: number | null;
  minScore: number | null;
  sectors: string[];
  sourceTags: string[];
  setups: string[];
  sort: SymbolSearchSort;
  watchlistOnly: boolean;
};

export type SymbolSearchDocument = {
  aiRankedRelevance: number;
  companyName: string;
  decision: string;
  historyCount: number;
  macroLabel: string;
  macroRegime: string;
  rankPosition: number | null;
  recent: boolean;
  riskScore: number | null;
  scannerRanked: boolean;
  score: number | null;
  searchText: string;
  searchWords: string[];
  sector: string;
  setupType: string;
  sourceTags: string[];
  symbol: string;
  theme: string;
  watchlist: boolean;
};

export type SymbolSearchResult = {
  document: SymbolSearchDocument;
  matchReasons: string[];
  score: number;
};

export type SymbolSearchResponse = {
  filters: SymbolSearchFilterState;
  indexSize: number;
  query: string;
  results: SymbolSearchResult[];
};

export type SymbolSearchFacetSet = {
  decisions: string[];
  macroRegimes: string[];
  sectors: string[];
  sourceTags: string[];
  setups: string[];
};

export type SymbolTimelineItem = {
  detail: string;
  evidence: string;
  label: string;
  timestamp: string;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
};

export type SymbolWorkflowMaturityModel = {
  catalystTimeline: SymbolTimelineItem[];
  confidenceHistory: SymbolTimelineItem[];
  continuityActions: SymbolWorkflowAction[];
  maturityScore: number;
  riskTimeline: SymbolTimelineItem[];
  replayContinuity: SymbolTimelineItem[];
  summary: string;
  whatChanged: SymbolTimelineItem[];
};

export type SymbolWorkflowAction = {
  detail: string;
  href: string;
  label: string;
  status: "available" | "limited";
};

export type HistoryReplayCluster = {
  count: number;
  detail: string;
  label: string;
  scoreDelta: number | null;
  symbols: string[];
};

export type HistoryWorkflowMaturityModel = {
  eventChronology: SymbolTimelineItem[];
  historicalAnalogs: HistoryReplayCluster[];
  macroChronology: SymbolTimelineItem[];
  replayClusters: HistoryReplayCluster[];
  replayCompareActions: SymbolWorkflowAction[];
  score: number;
  symbolJourney: SymbolTimelineItem[];
  tradeAutopsyContinuity: SymbolWorkflowAction[];
};

export type PerformanceWorkflowMaturityModel = {
  calibration: PerformanceCalibrationBucket[];
  cockpitCards: PerformanceCockpitCard[];
  evidenceTimeline: SymbolTimelineItem[];
  falsePositiveAnalysis: PerformanceCockpitCard;
  score: number;
  watchlistPortfolioState: SymbolWorkflowAction[];
};

export type PerformanceCockpitCard = {
  detail: string;
  label: string;
  status: "available" | "limited";
  value: string;
};

export type PerformanceCalibrationBucket = {
  averageReturnPct: number | null;
  count: number;
  hitRatePct: number | null;
  label: string;
};

const DEFAULT_FILTERS: SymbolSearchFilterState = {
  decisions: [],
  historyOnly: false,
  macroRegimes: [],
  maxRisk: null,
  minScore: null,
  sectors: [],
  sourceTags: [],
  setups: [],
  sort: "relevance",
  watchlistOnly: false,
};

export function defaultSymbolSearchFilters(overrides: Partial<SymbolSearchFilterState> = {}): SymbolSearchFilterState {
  return {
    ...DEFAULT_FILTERS,
    ...overrides,
    decisions: overrides.decisions ? cleanList(overrides.decisions) : [...DEFAULT_FILTERS.decisions],
    macroRegimes: overrides.macroRegimes ? cleanList(overrides.macroRegimes) : [...DEFAULT_FILTERS.macroRegimes],
    sectors: overrides.sectors ? cleanList(overrides.sectors) : [...DEFAULT_FILTERS.sectors],
    sourceTags: overrides.sourceTags ? cleanList(overrides.sourceTags) : [...DEFAULT_FILTERS.sourceTags],
    setups: overrides.setups ? cleanList(overrides.setups) : [...DEFAULT_FILTERS.setups],
  };
}

export function buildSymbolSearchIndex(input: {
  historySymbols?: string[];
  recentSymbols?: string[];
  rows: RankingRow[];
  watchlistSymbols?: string[];
}): SymbolSearchDocument[] {
  const recent = new Set(cleanList(input.recentSymbols ?? []));
  const watchlist = new Set(cleanList(input.watchlistSymbols ?? []));
  const historyCounts = new Map<string, number>();
  for (const symbol of cleanList(input.historySymbols ?? [])) {
    historyCounts.set(symbol, (historyCounts.get(symbol) ?? 0) + 1);
  }

  const bySymbol = new Map<string, SymbolSearchDocument>();
  for (const row of input.rows) {
    const symbol = cleanSymbol(row.symbol);
    if (!symbol) continue;
    const companyName = cleanText(row.company_name);
    const sector = cleanText(row.sector, "Unclassified");
    const setupType = cleanText(row.setup_type, "Unclassified setup");
    const macroRegime = cleanText(row.market_regime ?? row.macro_context_label, "Macro limited");
    const macroLabel = cleanText(row.macro_context_summary ?? row.macro_context_label ?? row.exchange_context_label ?? row.sector_context_label, macroRegime);
    const decision = cleanText(row.final_decision ?? row.action ?? row.rating, "Research");
    const theme = cleanText(row.theme ?? row.industry ?? row.asset_type ?? row.event_context_label, sector);
    const score = finiteNumber(row.final_score_adjusted ?? row.final_score ?? row.quality_score ?? row.macro_adjusted_score);
    const riskScore = finiteNumber(row.risk_pressure_score ?? row.risk_pressure ?? row.event_risk_score ?? row.macro_pressure_score ?? row.risk_penalty);
    const rankPosition = finiteNumber(row.rank_position);
    const sourceTags = sourceTagsFor(row, historyCounts.has(symbol), watchlist.has(symbol), recent.has(symbol));
    const searchText = searchableText([symbol, companyName, sector, setupType, macroRegime, macroLabel, decision, theme, ...sourceTags]);
    const aiRankedRelevance = relevanceBaseScore({ historyCount: historyCounts.get(symbol) ?? 0, rankPosition, recent: recent.has(symbol), riskScore, score, watchlist: watchlist.has(symbol) });
    const document: SymbolSearchDocument = {
      aiRankedRelevance,
      companyName,
      decision,
      historyCount: historyCounts.get(symbol) ?? 0,
      macroLabel,
      macroRegime,
      rankPosition,
      recent: recent.has(symbol),
      riskScore,
      scannerRanked: true,
      score,
      searchText,
      searchWords: searchWordsFor(searchText),
      sector,
      setupType,
      sourceTags,
      symbol,
      theme,
      watchlist: watchlist.has(symbol),
    };
    bySymbol.set(symbol, document);
  }

  for (const [symbol, count] of historyCounts.entries()) {
    if (bySymbol.has(symbol)) continue;
    const searchText = searchableText([symbol, "history", "replay", "signal memory"]);
    bySymbol.set(symbol, {
      aiRankedRelevance: relevanceBaseScore({ historyCount: count, rankPosition: null, recent: recent.has(symbol), riskScore: null, score: null, watchlist: watchlist.has(symbol) }),
      companyName: "",
      decision: "History only",
      historyCount: count,
      macroLabel: "Macro limited",
      macroRegime: "Macro limited",
      rankPosition: null,
      recent: recent.has(symbol),
      riskScore: null,
      scannerRanked: false,
      score: null,
      searchText,
      searchWords: searchWordsFor(searchText),
      sector: "Unclassified",
      setupType: "History only",
      sourceTags: ["history", "replay"],
      symbol,
      theme: "Signal memory",
      watchlist: watchlist.has(symbol),
    });
  }

  return Array.from(bySymbol.values()).sort((left, right) => {
    const relevanceDiff = right.aiRankedRelevance - left.aiRankedRelevance;
    if (relevanceDiff !== 0) return relevanceDiff;
    return left.symbol.localeCompare(right.symbol);
  });
}

export function buildSymbolSearchFacets(index: SymbolSearchDocument[]): SymbolSearchFacetSet {
  return {
    decisions: uniqueSorted(index.map((item) => item.decision)),
    macroRegimes: uniqueSorted(index.map((item) => item.macroRegime)),
    sectors: uniqueSorted(index.map((item) => item.sector)),
    sourceTags: uniqueSorted(index.flatMap((item) => item.sourceTags)),
    setups: uniqueSorted(index.map((item) => item.setupType)),
  };
}

export function searchSymbolIndex(index: SymbolSearchDocument[], query: string, filters: Partial<SymbolSearchFilterState> = {}, limit = 12): SymbolSearchResponse {
  const normalizedFilters = defaultSymbolSearchFilters(filters);
  const queryText = cleanText(query).toUpperCase();
  const queryTokens = queryText.split(/\s+/).filter(Boolean);
  const results = index
    .filter((document) => documentPassesFilters(document, normalizedFilters))
    .map((document): SymbolSearchResult | null => {
      const match = queryScore(document, queryText, queryTokens);
      if (queryTokens.length && match.score <= 0) return null;
      const score = document.aiRankedRelevance + match.score;
      return { document, matchReasons: match.reasons, score };
    })
    .filter((result): result is SymbolSearchResult => result !== null)
    .sort((left, right) => compareSearchResults(left, right, normalizedFilters.sort))
    .slice(0, Math.max(1, limit));

  return {
    filters: normalizedFilters,
    indexSize: index.length,
    query,
    results,
  };
}

export function buildSymbolWorkflowMaturityModel(input: {
  history: Array<{ entry_status?: string | null; final_decision?: string | null; final_score?: number | null; price?: number | null; timestamp?: string | null }>;
  marketMemoryAvailable: boolean;
  row: RankingRow;
  symbol: string;
  workflowChanges?: Array<{ detail?: string; metricLabel?: string; title?: string }>;
}): SymbolWorkflowMaturityModel {
  const symbol = cleanSymbol(input.symbol || input.row.symbol);
  const ordered = input.history
    .filter((point) => cleanText(point.timestamp))
    .sort((left, right) => cleanText(left.timestamp).localeCompare(cleanText(right.timestamp)));
  const latest = ordered[ordered.length - 1];
  const first = ordered[0];
  const scoreDelta = finiteNumber(latest?.final_score) !== null && finiteNumber(first?.final_score) !== null
    ? (finiteNumber(latest?.final_score) ?? 0) - (finiteNumber(first?.final_score) ?? 0)
    : null;
  const currentRisk = finiteNumber(input.row.event_risk_score ?? input.row.macro_pressure_score ?? input.row.risk_penalty);
  const eventSummary = cleanText(input.row.event_context_summary ?? input.row.verified_event_signature ?? input.row.news_headline, "");
  const catalystTimeline = eventSummary
    ? [timelineItem("Catalyst context", eventSummary, cleanText(input.row.last_updated_utc ?? input.row.last_updated, "Current scanner packet"), "scanner event/news fields", currentRisk !== null && currentRisk >= 70 ? "rose" : "amber")]
    : [timelineItem("Catalyst context limited", "No source-linked catalyst is present in the current scanner packet.", cleanText(input.row.last_updated_utc ?? input.row.last_updated, "Current scanner packet"), "scanner event/news fields", "amber")];
  const confidenceHistory = ordered.slice(-6).map((point) => timelineItem(
    "Confidence snapshot",
    `${symbol} score ${formatScore(point.final_score)} and decision ${cleanText(point.final_decision, "research")}.`,
    cleanText(point.timestamp, "unknown"),
    "stored symbol signal history",
    toneForScore(finiteNumber(point.final_score)),
  ));
  const riskTimeline = [
    timelineItem("Current risk state", currentRisk === null ? "Risk pressure is not available in this scanner packet." : `${symbol} risk pressure is ${Math.round(currentRisk)}/100.`, cleanText(input.row.last_updated_utc ?? input.row.last_updated, "Current scanner packet"), "risk/macro/event scanner fields", currentRisk !== null && currentRisk >= 70 ? "rose" : "cyan"),
  ];
  const replayContinuity = [
    timelineItem(input.marketMemoryAvailable ? "Replay analog available" : "Replay analog limited", input.marketMemoryAvailable ? "Market memory can continue this symbol into historical analog review." : "No validated analog is available yet, so replay continuity remains limited.", "Current memory packet", "market memory evidence", input.marketMemoryAvailable ? "violet" : "amber"),
  ];
  const whatChanged = [
    timelineItem("Score evolution", scoreDelta === null ? "Score change is limited until more stored symbol history exists." : `${symbol} score changed ${formatSigned(scoreDelta)} across the selected signal history.`, latest?.timestamp ?? "Current scanner packet", "stored symbol signal history", scoreDelta === null ? "amber" : scoreDelta >= 0 ? "emerald" : "rose"),
    ...((input.workflowChanges ?? []).slice(0, 3).map((change) => timelineItem(cleanText(change.title, "Workflow change"), cleanText(change.detail, "Workflow evidence is limited."), cleanText(change.metricLabel, "Current workflow"), "workflow evolution memory", "cyan"))),
  ];
  const continuityActions: SymbolWorkflowAction[] = [
    { detail: "Open full symbol research with chart, event, macro, replay, and risk context.", href: `/symbol/${encodeURIComponent(symbol)}`, label: "Continue symbol", status: symbol ? "available" : "limited" },
    { detail: "Review saved score and decision history for this symbol.", href: `/history?symbol=${encodeURIComponent(symbol)}`, label: "Continue replay", status: ordered.length ? "available" : "limited" },
    { detail: "Open performance evidence to inspect completed signal behavior.", href: "/performance#history", label: "Continue performance analysis", status: "available" },
    { detail: "Use discovery to compare adjacent scanner, sector, macro, and risk peers.", href: `/discover?symbol=${encodeURIComponent(symbol)}`, label: "Continue compare", status: "available" },
  ];
  const maturityScore = boundedScore((ordered.length ? 25 : 0) + (input.marketMemoryAvailable ? 20 : 0) + (eventSummary ? 20 : 0) + (currentRisk !== null ? 15 : 0) + (scoreDelta !== null ? 20 : 0));

  return {
    catalystTimeline,
    confidenceHistory,
    continuityActions,
    maturityScore,
    replayContinuity,
    riskTimeline,
    summary: `${symbol} continuity is ${maturityScore >= 75 ? "strong" : maturityScore >= 45 ? "developing" : "limited"} across symbol, history, replay, macro, and performance evidence.`,
    whatChanged,
  };
}

export function buildHistoryWorkflowMaturityModel(input: {
  history: HistorySummary;
  rows: SymbolHistoryRow[];
  selectedSymbol: string;
}): HistoryWorkflowMaturityModel {
  const rows = [...input.rows].sort((left, right) => left.timestamp_utc.localeCompare(right.timestamp_utc));
  const first = rows[0];
  const latest = rows[rows.length - 1];
  const scoreDelta = finiteNumber(latest?.final_score) !== null && finiteNumber(first?.final_score) !== null
    ? (finiteNumber(latest?.final_score) ?? 0) - (finiteNumber(first?.final_score) ?? 0)
    : null;
  const replayClusters = clusterHistoryRows(rows);
  const symbolJourney = [
    timelineItem("Journey start", first ? `${cleanSymbol(first.symbol)} began this window at score ${formatScore(first.final_score)} and decision ${cleanText(first.final_decision ?? first.action, "research")}.` : "No symbol journey is available yet.", first?.timestamp_utc ?? input.history.earliest ?? "N/A", "saved scanner history", first ? "cyan" : "amber"),
    timelineItem("Latest state", latest ? `${cleanSymbol(latest.symbol)} is now score ${formatScore(latest.final_score)} with ${scoreDelta === null ? "limited" : formatSigned(scoreDelta)} score change.` : "No latest state is available yet.", latest?.timestamp_utc ?? input.history.latest ?? "N/A", "saved scanner history", latest ? toneForScore(finiteNumber(latest.final_score)) : "amber"),
  ];
  const eventChronology = eventTimelineFromRows(rows);
  const macroChronology = macroTimelineFromRows(rows);
  const historicalAnalogs = historicalAnalogClusters(rows);
  const replayCompareActions: SymbolWorkflowAction[] = [
    { detail: replayClusters.length ? `${replayClusters.length} replay cluster(s) are available for setup, decision, or macro comparison.` : "Replay comparison needs more saved observations.", href: `/history?symbol=${encodeURIComponent(cleanSymbol(input.selectedSymbol))}`, label: "Replay compare", status: replayClusters.length ? "available" : "limited" },
    { detail: historicalAnalogs.length ? `${historicalAnalogs.length} historical analog group(s) connect setup, macro, and score evolution.` : "Historical analogs need more varied saved observations.", href: "/market-memory", label: "Historical analogs", status: historicalAnalogs.length ? "available" : "limited" },
    { detail: "Continue the selected symbol in the full symbol cockpit.", href: `/symbol/${encodeURIComponent(cleanSymbol(input.selectedSymbol))}`, label: "Symbol detail", status: cleanSymbol(input.selectedSymbol) ? "available" : "limited" },
  ];
  const tradeAutopsyContinuity: SymbolWorkflowAction[] = [
    { detail: rows.length ? "History can feed paper-trading autopsy context, but does not fabricate fills or broker state." : "No history rows are available for autopsy continuity yet.", href: "/paper", label: "Trade autopsy continuity", status: rows.length ? "available" : "limited" },
    { detail: "Strategy-linked history is available only when Strategy Labs evidence exists.", href: "/strategy-labs", label: "Strategy-linked history", status: "limited" },
  ];
  const selectedSymbolRows = rows.filter((row) => cleanSymbol(row.symbol) === cleanSymbol(input.selectedSymbol)).length;
  const score = boundedScore(
    Math.min(25, rows.length * 5)
      + Math.min(18, input.history.uniqueDates.length * 4)
      + Math.min(18, replayClusters.length * 8)
      + Math.min(14, historicalAnalogs.length * 6)
      + (eventChronology.length ? 10 : 0)
      + (macroChronology.length ? 10 : 0)
      + Math.min(7, selectedSymbolRows),
  );

  return {
    eventChronology,
    historicalAnalogs,
    macroChronology,
    replayClusters,
    replayCompareActions,
    score,
    symbolJourney,
    tradeAutopsyContinuity,
  };
}

export function buildPerformanceWorkflowMaturityModel(input: {
  history: HistorySummary;
  performance: PerformanceData;
  rankingRows: RankingRow[];
}): PerformanceWorkflowMaturityModel {
  const forwardRows = input.performance.forwardReturns.rows;
  const returnValues = forwardRows.map((row) => finiteNumber(row.return_pct ?? row.forward_return)).filter((value): value is number => value !== null);
  const positive = returnValues.filter((value) => value > 0).length;
  const hitRate = returnValues.length ? positive / returnValues.length : null;
  const avgReturn = returnValues.length ? returnValues.reduce((sum, value) => sum + value, 0) / returnValues.length : null;
  const falsePositiveRows = forwardRows.filter((row) => {
    const score = finiteNumber(row.final_score ?? row.score ?? row.confidence_score);
    const ret = finiteNumber(row.return_pct ?? row.forward_return);
    return score !== null && score >= 70 && ret !== null && ret <= 0;
  });
  const calibration = calibrationBuckets(forwardRows);
  const cockpitCards: PerformanceCockpitCard[] = [
    { detail: "Completed forward-return rows with non-null outcomes.", label: "Scanner hit-rate analysis", status: hitRate === null ? "limited" : "available", value: hitRate === null ? "Limited" : `${(hitRate * 100).toFixed(1)}%` },
    { detail: "Average completed signal outcome from stored forward-return rows.", label: "Signal-quality analysis", status: avgReturn === null ? "limited" : "available", value: avgReturn === null ? "Limited" : `${(avgReturn * 100).toFixed(2)}%` },
    { detail: `${input.performance.lifecycle.rows.length.toLocaleString()} lifecycle row(s) support signal aging and replay review.`, label: "Replay success analysis", status: input.performance.lifecycle.rows.length ? "available" : "limited", value: input.performance.lifecycle.rows.length.toLocaleString() },
    { detail: `${calibration.length.toLocaleString()} score bucket(s) are available for calibration review.`, label: "Confidence calibration", status: calibration.length ? "available" : "limited", value: calibration.length.toLocaleString() },
    { detail: `${input.performance.lifecycleSummary.rows.length.toLocaleString()} strategy lifecycle summary row(s) explain how scanner/strategy behavior changed over time.`, label: "Strategy evolution", status: input.performance.lifecycleSummary.rows.length ? "available" : "limited", value: input.performance.lifecycleSummary.rows.length.toLocaleString() },
  ];
  const falsePositiveAnalysis: PerformanceCockpitCard = {
    detail: falsePositiveRows.length ? `${falsePositiveRows.length.toLocaleString()} high-score completed row(s) had non-positive forward returns.` : "No high-score false-positive rows were found in the current forward-return sample.",
    label: "False-positive analysis",
    status: forwardRows.length ? "available" : "limited",
    value: falsePositiveRows.length.toLocaleString(),
  };
  const evidenceTimeline: SymbolTimelineItem[] = [
    timelineItem("History loaded", `${input.history.count.toLocaleString()} saved scanner run(s) and ${input.history.uniqueDates.length.toLocaleString()} distinct date(s).`, input.history.latest ?? "N/A", "history summary", input.history.count ? "violet" : "amber"),
    timelineItem("Forward evidence checked", `${forwardRows.length.toLocaleString()} displayed forward-return row(s); source state ${input.performance.forwardReturns.state}.`, "Current performance packet", "performance forward returns", forwardRows.length ? "cyan" : "amber"),
    timelineItem("Model quality review", falsePositiveAnalysis.detail, "Current performance packet", "forward returns and score fields", falsePositiveRows.length ? "rose" : "emerald"),
    timelineItem("Confidence evolution", calibration.length ? `${calibration.length} calibration bucket(s) explain where confidence was aligned or miscalibrated.` : "Confidence evolution needs completed score/outcome rows.", "Current performance packet", "score buckets and completed outcomes", calibration.length ? "emerald" : "amber"),
    timelineItem("Strategy evolution", input.performance.lifecycleSummary.rows.length ? "Strategy changes are reviewable through lifecycle summary rows and Strategy Labs continuity." : "Strategy evolution is limited until lifecycle summary rows exist.", "Current performance packet", "lifecycle summary evidence", input.performance.lifecycleSummary.rows.length ? "violet" : "amber"),
  ];
  const watchlistPortfolioState: SymbolWorkflowAction[] = [
    { detail: "Watchlist-specific performance is limited unless watchlist attribution is present in stored rows.", href: "/settings", label: "Watchlist performance", status: "limited" },
    { detail: `${input.rankingRows.length.toLocaleString()} current scanner row(s) can be cross-checked against portfolio intelligence scoring.`, href: "/paper", label: "Portfolio intelligence scoring", status: input.rankingRows.length ? "available" : "limited" },
    { detail: "Strategy quality evolution is available through Strategy Labs and completed simulated evidence only.", href: "/strategy-labs", label: "Strategy-quality evolution", status: "available" },
    { detail: "Continue this performance investigation through symbol search, history replay, and scanner comparison without losing context.", href: "/performance#history", label: "Continue performance investigation", status: forwardRows.length ? "available" : "limited" },
  ];
  const score = boundedScore(
    (returnValues.length ? 25 : 0)
      + Math.min(20, calibration.length * 7)
      + (input.performance.lifecycle.rows.length ? 15 : 0)
      + (input.performance.lifecycleSummary.rows.length ? 10 : 0)
      + Math.min(15, input.history.uniqueDates.length * 2)
      + (input.history.count ? 8 : 0)
      + (input.rankingRows.length ? 7 : 0),
  );

  return {
    calibration,
    cockpitCards,
    evidenceTimeline,
    falsePositiveAnalysis,
    score,
    watchlistPortfolioState,
  };
}

function sourceTagsFor(row: RankingRow, hasHistory: boolean, watchlist: boolean, recent: boolean): string[] {
  const tags = ["scanner"];
  if (hasHistory) tags.push("history", "replay");
  if (watchlist) tags.push("watchlist");
  if (recent) tags.push("recent");
  if (cleanText(row.macro_context_label ?? row.market_regime, "")) tags.push("macro");
  if (cleanText(row.sector, "")) tags.push("sector");
  if (cleanText(row.event_context_label ?? row.verified_event_signature, "")) tags.push("event");
  return tags;
}

function relevanceBaseScore(input: { historyCount: number; rankPosition: number | null; recent: boolean; riskScore: number | null; score: number | null; watchlist: boolean }): number {
  const scorePart = input.score === null ? 0 : Math.max(0, Math.min(100, input.score));
  const rankPart = input.rankPosition === null ? 0 : Math.max(0, 80 - Math.min(80, input.rankPosition));
  const riskPart = input.riskScore === null ? 0 : Math.max(0, 20 - Math.min(20, input.riskScore / 5));
  const memoryPart = Math.min(30, input.historyCount * 4);
  return Math.round(scorePart + rankPart + riskPart + memoryPart + (input.watchlist ? 35 : 0) + (input.recent ? 25 : 0));
}

function queryScore(document: SymbolSearchDocument, query: string, tokens: string[]): { reasons: string[]; score: number } {
  if (!tokens.length) return { reasons: ["AI-ranked relevance from scanner, history, watchlist, and macro context."], score: 0 };
  let score = 0;
  const reasons: string[] = [];
  const companyAcronym = acronym(document.companyName);
  if (document.symbol === query) {
    score += 600;
    reasons.push("exact ticker match");
  } else if (document.symbol.startsWith(query)) {
    score += 420;
    reasons.push("ticker prefix match");
  } else if (companyAcronym && companyAcronym === query) {
    score += 360;
    reasons.push("company acronym match");
  } else if (fuzzyMatch(document.symbol, query)) {
    score += 260;
    reasons.push("fuzzy ticker match");
  }
  if (document.companyName && containsAll(document.companyName, tokens)) {
    score += 210;
    reasons.push("company name match");
  }
  if (containsAny(document.sector, tokens)) {
    score += 120;
    reasons.push("sector match");
  }
  if (containsAny(document.theme, tokens) || containsAny(document.setupType, tokens)) {
    score += 110;
    reasons.push("theme/setup match");
  }
  if (containsAny(`${document.macroRegime} ${document.macroLabel}`, tokens)) {
    score += 100;
    reasons.push("macro context match");
  }
  if (containsAny(document.sourceTags.join(" "), tokens)) {
    score += 90;
    reasons.push("workflow source match");
  }
  const fuzzyMetadata = fuzzyTokenMetadataScore(document.searchWords, tokens);
  if (fuzzyMetadata.score > 0) {
    score += fuzzyMetadata.score;
    reasons.push(fuzzyMetadata.reason);
  }
  if (document.watchlist && tokens.some((token) => token === "WATCHLIST" || token === "WL")) {
    score += 140;
    reasons.push("watchlist context match");
  }
  if (document.historyCount > 0 && tokens.some((token) => token === "HISTORY" || token === "REPLAY" || token === "MEMORY")) {
    score += 130;
    reasons.push("replay/history continuity match");
  }
  if (!score && containsAll(document.searchText, tokens)) {
    score += 80;
    reasons.push("fuzzy metadata match");
  }
  return { reasons, score };
}

function compareSearchResults(left: SymbolSearchResult, right: SymbolSearchResult, sort: SymbolSearchSort): number {
  if (sort === "symbol") return left.document.symbol.localeCompare(right.document.symbol);
  if (sort === "score") return (right.document.score ?? -1) - (left.document.score ?? -1) || right.score - left.score;
  if (sort === "risk") return (right.document.riskScore ?? -1) - (left.document.riskScore ?? -1) || right.score - left.score;
  if (sort === "history") return right.document.historyCount - left.document.historyCount || right.score - left.score;
  return right.score - left.score || left.document.symbol.localeCompare(right.document.symbol);
}

function documentPassesFilters(document: SymbolSearchDocument, filters: SymbolSearchFilterState): boolean {
  if (filters.historyOnly && document.historyCount <= 0) return false;
  if (filters.watchlistOnly && !document.watchlist) return false;
  if (filters.minScore !== null && (document.score === null || document.score < filters.minScore)) return false;
  if (filters.maxRisk !== null && document.riskScore !== null && document.riskScore > filters.maxRisk) return false;
  if (filters.sectors.length && !filters.sectors.includes(cleanText(document.sector).toUpperCase())) return false;
  if (filters.setups.length && !filters.setups.includes(cleanText(document.setupType).toUpperCase())) return false;
  if (filters.macroRegimes.length && !filters.macroRegimes.includes(cleanText(document.macroRegime).toUpperCase())) return false;
  if (filters.sourceTags.length) {
    const tags = new Set(document.sourceTags.map((tag) => cleanText(tag).toUpperCase()));
    if (!filters.sourceTags.some((tag) => tags.has(tag))) return false;
  }
  if (filters.decisions.length && !filters.decisions.includes(cleanText(document.decision).toUpperCase())) return false;
  return true;
}

function clusterHistoryRows(rows: SymbolHistoryRow[]): HistoryReplayCluster[] {
  const groups = new Map<string, SymbolHistoryRow[]>();
  for (const row of rows) {
    const key = `${cleanText(row.setup_type, "Unknown setup")} / ${cleanText(row.final_decision ?? row.action, "Research")}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return Array.from(groups.entries())
    .map(([label, groupRows]) => {
      const first = groupRows[0];
      const latest = groupRows[groupRows.length - 1];
      const firstScore = finiteNumber(first?.final_score);
      const latestScore = finiteNumber(latest?.final_score);
      const scoreDelta = firstScore !== null && latestScore !== null ? latestScore - firstScore : null;
      return {
        count: groupRows.length,
        detail: `${groupRows.length.toLocaleString()} saved observation(s), ${scoreDelta === null ? "limited score delta" : `${formatSigned(scoreDelta)} score delta`}.`,
        label,
        scoreDelta,
        symbols: uniqueSorted(groupRows.map((row) => cleanSymbol(row.symbol))).slice(0, 6),
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function historicalAnalogClusters(rows: SymbolHistoryRow[]): HistoryReplayCluster[] {
  const groups = new Map<string, SymbolHistoryRow[]>();
  for (const row of rows) {
    const setup = cleanText(row.setup_type, "unknown setup");
    const regime = cleanText(row.market_regime ?? row.macro_context_label, "macro limited");
    const score = finiteNumber(row.final_score);
    const scoreBand = score === null ? "score limited" : score >= 70 ? "high score" : score >= 50 ? "middle score" : "low score";
    const key = `${setup} / ${regime} / ${scoreBand}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return Array.from(groups.entries())
    .map(([label, groupRows]) => {
      const first = groupRows[0];
      const latest = groupRows[groupRows.length - 1];
      const firstScore = finiteNumber(first?.final_score);
      const latestScore = finiteNumber(latest?.final_score);
      const scoreDelta = firstScore !== null && latestScore !== null ? latestScore - firstScore : null;
      const symbols = uniqueSorted(groupRows.map((row) => cleanSymbol(row.symbol))).slice(0, 8);
      return {
        count: groupRows.length,
        detail: `${symbols.length.toLocaleString()} symbol(s) share setup, macro, and score-band context; ${scoreDelta === null ? "score delta limited" : `${formatSigned(scoreDelta)} score delta`}.`,
        label,
        scoreDelta,
        symbols,
      };
    })
    .filter((cluster) => cluster.count >= 2 || cluster.symbols.length >= 2)
    .sort((left, right) => right.count - left.count || Math.abs(right.scoreDelta ?? 0) - Math.abs(left.scoreDelta ?? 0))
    .slice(0, 6);
}

function eventTimelineFromRows(rows: SymbolHistoryRow[]): SymbolTimelineItem[] {
  return rows
    .filter((row) => cleanText(row.news_headline ?? row.event_context_summary ?? row.verified_event_signature, ""))
    .slice(-5)
    .map((row) => timelineItem("Event chronology", cleanText(row.news_headline ?? row.event_context_summary ?? row.verified_event_signature), row.timestamp_utc, "source-linked scanner event fields", finiteNumber(row.event_risk_score) !== null && (finiteNumber(row.event_risk_score) ?? 0) >= 70 ? "rose" : "amber"));
}

function macroTimelineFromRows(rows: SymbolHistoryRow[]): SymbolTimelineItem[] {
  const items: SymbolTimelineItem[] = [];
  let previous = "";
  for (const row of rows) {
    const regime = cleanText(row.market_regime ?? row.macro_context_label, "");
    if (!regime || regime === previous) continue;
    previous = regime;
    items.push(timelineItem("Macro chronology", `${cleanSymbol(row.symbol)} macro regime changed to ${regime}.`, row.timestamp_utc, "saved macro scanner fields", "cyan"));
  }
  return items.slice(-5);
}

function calibrationBuckets(rows: CsvRow[]): PerformanceCalibrationBucket[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const score = finiteNumber(row.final_score ?? row.score ?? row.confidence_score);
    const ret = finiteNumber(row.return_pct ?? row.forward_return);
    if (score === null || ret === null) continue;
    const label = score >= 70 ? "High score" : score >= 50 ? "Middle score" : "Low score";
    const values = groups.get(label) ?? [];
    values.push(ret);
    groups.set(label, values);
  }
  return Array.from(groups.entries()).map(([label, values]) => {
    const hitRate = values.length ? values.filter((value) => value > 0).length / values.length : null;
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return {
      averageReturnPct: avg === null ? null : avg * 100,
      count: values.length,
      hitRatePct: hitRate === null ? null : hitRate * 100,
      label,
    };
  });
}

function timelineItem(label: string, detail: string, timestamp: string, evidence: string, tone: SymbolTimelineItem["tone"]): SymbolTimelineItem {
  return { detail, evidence, label, timestamp, tone };
}

function toneForScore(value: number | null): SymbolTimelineItem["tone"] {
  if (value === null) return "amber";
  if (value >= 70) return "emerald";
  if (value < 40) return "rose";
  return "cyan";
}

function formatScore(value: unknown): string {
  const parsed = finiteNumber(value);
  return parsed === null ? "limited" : `${Math.round(parsed)}`;
}

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return fallback;
  return text;
}

function cleanSymbol(value: unknown): string {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function cleanList(values: string[]): string[] {
  return values.map((value) => cleanText(value).toUpperCase()).filter(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function searchableText(values: string[]): string {
  return values.map((value) => cleanText(value).toUpperCase()).filter(Boolean).join(" ");
}

function containsAny(value: string, tokens: string[]): boolean {
  const text = cleanText(value).toUpperCase();
  return tokens.some((token) => text.includes(token));
}

function containsAll(value: string, tokens: string[]): boolean {
  const text = cleanText(value).toUpperCase();
  return tokens.every((token) => text.includes(token) || fuzzyMatch(text, token));
}

function fuzzyMatch(value: string, query: string): boolean {
  const source = cleanText(value).toUpperCase();
  const target = cleanText(query).toUpperCase();
  if (!source || !target) return false;
  let index = 0;
  for (const char of source) {
    if (char === target[index]) index += 1;
    if (index === target.length) return true;
  }
  return false;
}

function fuzzyTokenMetadataScore(words: string[], tokens: string[]): { reason: string; score: number } {
  if (!tokens.length) return { reason: "fuzzy metadata match", score: 0 };
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    if (token.length < 3) continue;
    let tokenScore = 0;
    for (const word of words) {
      if (word[0] !== token[0]) continue;
      if (word === token) {
        tokenScore = Math.max(tokenScore, 80);
      } else if (word.startsWith(token) || token.startsWith(word)) {
        tokenScore = Math.max(tokenScore, 60);
      } else if (boundedEditDistance(word, token, token.length <= 5 ? 1 : 2) !== null) {
        tokenScore = Math.max(tokenScore, 46);
      }
      if (tokenScore >= 80) break;
    }
    if (tokenScore > 0) matched += 1;
    score += tokenScore;
  }
  if (!matched) return { reason: "fuzzy metadata match", score: 0 };
  return { reason: matched === tokens.length ? "fuzzy metadata match" : "partial fuzzy metadata match", score: Math.min(180, score) };
}

function boundedEditDistance(left: string, right: string, maxDistance: number): number | null {
  if (Math.abs(left.length - right.length) > maxDistance) return null;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array<number>(right.length + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    let rowMin = current[0] ?? leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (previous[rightIndex] ?? 0) + 1,
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + cost,
      );
      rowMin = Math.min(rowMin, current[rightIndex] ?? rowMin);
    }
    if (rowMin > maxDistance) return null;
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index] ?? 0;
    current = new Array<number>(right.length + 1).fill(0);
  }
  const distance = previous[right.length] ?? null;
  return distance !== null && distance <= maxDistance ? distance : null;
}

function acronym(value: string): string {
  return cleanText(value)
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 12);
}

function searchWordsFor(text: string): string[] {
  return uniqueSorted(cleanText(text).toUpperCase().split(/[^A-Z0-9]+/).filter((word) => word.length >= 2)).slice(0, 80);
}
