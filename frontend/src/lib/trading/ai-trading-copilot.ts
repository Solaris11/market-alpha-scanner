import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { cleanText } from "@/lib/ui/formatters";
import { decisionLabel } from "@/lib/ui/labels";

export type AICopilotSearchMode =
  | "earnings"
  | "macro"
  | "market_search"
  | "portfolio_risk"
  | "similar_symbols"
  | "symbol_explanation"
  | "watchlist";

export type AICopilotEvidenceStatus = "available" | "limited";

export type AICopilotSignalLine = {
  detail: string;
  label: string;
  status: AICopilotEvidenceStatus;
};

export type AICopilotMarketSearchResult = {
  companyName: string | null;
  conviction: number;
  decision: string;
  eventContext: string;
  finalScore: number | null;
  fragility: number;
  macroContext: string;
  matchReasons: string[];
  price: number | null;
  priceMovement: AICopilotSignalLine;
  rankScore: number;
  sector: string | null;
  symbol: string;
  technicalChange: AICopilotSignalLine;
  traceId: string;
  volumeChange: AICopilotSignalLine;
  watchlisted: boolean;
};

export type AICopilotMarketSearch = {
  filters: {
    earningsOnly: boolean;
    improvingOnly: boolean;
    macroOnly: boolean;
    riskOnly: boolean;
    sectors: string[];
    similarBaseSymbol: string | null;
    themes: string[];
    watchlistOnly: boolean;
  };
  intentHints: string[];
  limitedReason: string | null;
  mode: AICopilotSearchMode;
  query: string;
  results: AICopilotMarketSearchResult[];
};

export type AICopilotActionType =
  | "portfolio_adjustment_review"
  | "research_opportunity"
  | "risk_reduction_review"
  | "watchlist_candidate";

export type AICopilotAction = {
  boundary: string;
  confidence: number;
  detail: string;
  evidence: string[];
  href: string;
  label: string;
  symbol: string | null;
  type: AICopilotActionType;
};

export type AICopilotPersonalMemory = {
  favoriteSectors: string[];
  personalizedInterests: string[];
  previousQuestions: string[];
  riskProfileLabel: string | null;
  status: AICopilotEvidenceStatus;
  watchlistSymbols: string[];
};

export type AICopilotTraceItem = {
  detail: string;
  id: string;
  label: string;
  sourceType: "conversation" | "market_search" | "portfolio" | "profile" | "scanner" | "watchlist";
  status: AICopilotEvidenceStatus;
  symbol?: string | null;
};

export type AICopilotBuildInput = {
  conversation?: Array<{ content: string; role: "assistant" | "user" }>;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  profile?: UserPersonalizationProfile | null;
  question: string;
  referencedSymbols?: string[];
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
};

type QueryProfile = {
  earningsOnly: boolean;
  improvingOnly: boolean;
  macroOnly: boolean;
  riskOnly: boolean;
  sectors: string[];
  similarBaseSymbol: string | null;
  symbolExplanation: boolean;
  themes: string[];
  watchlistOnly: boolean;
};

const AI_SYMBOLS = new Set(["AMD", "NVDA", "AVGO", "SMCI", "ARM", "TSM", "MU", "MSFT", "GOOGL", "META", "AMZN", "SNOW", "PLTR", "DDOG", "CRWD", "ORCL"]);

const SECTOR_KEYWORDS: Array<{ aliases: string[]; label: string }> = [
  { aliases: ["semiconductor", "semiconductors", "chip", "chips", "gpu"], label: "Semiconductors" },
  { aliases: ["software", "cloud", "cybersecurity", "saas"], label: "Software" },
  { aliases: ["energy", "oil", "gas"], label: "Energy" },
  { aliases: ["crypto", "bitcoin", "btc", "ethereum"], label: "Crypto" },
  { aliases: ["financial", "bank", "banks"], label: "Financials" },
  { aliases: ["healthcare", "biotech"], label: "Healthcare" },
  { aliases: ["industrial", "industrials"], label: "Industrials" },
  { aliases: ["consumer", "retail"], label: "Consumer" },
];

export function buildAICopilotMarketSearch(input: AICopilotBuildInput): AICopilotMarketSearch {
  const query = normalizeQuery(input.question);
  const profile = profileForQuestion(query);
  const watchlist = new Set((input.watchlistSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const referenced = new Set((input.referencedSymbols ?? []).map((symbol) => symbol.toUpperCase()));
  const mode = searchModeFor(profile, referenced.size);
  const ranked = profile.similarBaseSymbol
    ? similarRowsFor(input.rows, profile.similarBaseSymbol, watchlist)
    : rankedRowsFor(input.rows, profile, watchlist, referenced);
  const results = ranked
    .slice(0, 8)
    .map(({ reasons, row, score }) => resultForRow(row, watchlist.has(row.symbol.toUpperCase()), Math.round(score), reasons));

  return {
    filters: {
      earningsOnly: profile.earningsOnly,
      improvingOnly: profile.improvingOnly,
      macroOnly: profile.macroOnly,
      riskOnly: profile.riskOnly,
      sectors: profile.sectors,
      similarBaseSymbol: profile.similarBaseSymbol,
      themes: profile.themes,
      watchlistOnly: profile.watchlistOnly,
    },
    intentHints: intentHintsFor(profile, referenced.size),
    limitedReason: results.length ? null : limitedReasonFor(profile),
    mode,
    query,
    results,
  };
}

export function buildAICopilotActionPlan(input: {
  marketSearch: AICopilotMarketSearch;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  watchlistSymbols?: string[];
}): AICopilotAction[] {
  const actions: AICopilotAction[] = [];
  const watchlist = new Set((input.watchlistSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const highConfidence = input.marketSearch.results
    .filter((result) => (result.finalScore ?? 0) >= 70 && result.conviction >= 62 && result.fragility <= 65)
    .slice(0, 3);
  for (const result of highConfidence) {
    actions.push({
      boundary: "Research-only opportunity review. This does not instruct a trade.",
      confidence: Math.min(95, Math.max(50, result.rankScore)),
      detail: `${result.symbol} is a high-ranking research candidate in this packet with ${result.decision}, conviction ${result.conviction}, and fragility ${result.fragility}.`,
      evidence: result.matchReasons.slice(0, 3),
      href: `/symbol/${result.symbol}`,
      label: `Review ${result.symbol} setup`,
      symbol: result.symbol,
      type: "research_opportunity",
    });
  }
  for (const result of highConfidence.filter((item) => !watchlist.has(item.symbol)).slice(0, 2)) {
    actions.push({
      boundary: "Watchlist suggestion only. It does not imply ownership or execution.",
      confidence: Math.min(90, Math.max(45, result.rankScore - 4)),
      detail: `${result.symbol} is not on the saved watchlist and matched the current natural-language screen.`,
      evidence: [`Search mode: ${input.marketSearch.mode}`, ...result.matchReasons.slice(0, 2)],
      href: `/symbol/${result.symbol}`,
      label: `Track ${result.symbol}`,
      symbol: result.symbol,
      type: "watchlist_candidate",
    });
  }

  const risky = input.marketSearch.results.filter((result) => result.fragility >= 68 || /risk|elevated|pressure/i.test(result.eventContext)).slice(0, 3);
  for (const result of risky) {
    actions.push({
      boundary: "Risk review only. Position changes require the user to inspect evidence.",
      confidence: Math.min(95, Math.max(50, result.fragility)),
      detail: `${result.symbol} has elevated review pressure: fragility ${result.fragility}, event context ${result.eventContext}.`,
      evidence: [result.priceMovement.detail, result.technicalChange.detail, result.volumeChange.detail].filter((item) => item.length > 0).slice(0, 3),
      href: `/symbol/${result.symbol}`,
      label: `Review ${result.symbol} risk`,
      symbol: result.symbol,
      type: "risk_reduction_review",
    });
  }

  const portfolio = input.portfolioSystem;
  if (portfolio?.openPositionCount) {
    actions.push({
      boundary: "Portfolio context is paper/research evidence, not broker execution.",
      confidence: Math.round(Math.max(portfolio.fragilityScore, portfolio.scenarioVulnerabilityScore)),
      detail: portfolio.hiddenCorrelationWarning ?? portfolio.summary,
      evidence: portfolio.exposureBuckets.slice(0, 3).map((bucket) => `${bucket.label}: ${bucket.percent}% risk ${bucket.riskScore}/100`),
      href: "/paper",
      label: "Review portfolio pressure",
      symbol: null,
      type: "portfolio_adjustment_review",
    });
  }

  return dedupeActions(actions).slice(0, 6);
}

export function buildAICopilotPersonalMemory(input: AICopilotBuildInput): AICopilotPersonalMemory {
  const watchlistSymbols = (input.watchlistSymbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean).slice(0, 12);
  const previousQuestions = (input.conversation ?? [])
    .filter((item) => item.role === "user")
    .slice(-4)
    .map((item) => cleanText(item.content, "").slice(0, 120))
    .filter(Boolean);
  const favoriteSectors = favoriteSectorsFor(input.rows, watchlistSymbols);
  const personalizedInterests = [
    ...watchlistSymbols.slice(0, 5).map((symbol) => `${symbol} watchlist`),
    ...favoriteSectors.slice(0, 3).map((sector) => `${sector} focus`),
    input.profile?.preferredRiskLevel ? `${input.profile.preferredRiskLevel} risk preference` : null,
    input.profile?.preferredRewardLevel ? `${input.profile.preferredRewardLevel} reward preference` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    favoriteSectors,
    personalizedInterests: personalizedInterests.slice(0, 10),
    previousQuestions,
    riskProfileLabel: input.profile?.label ?? null,
    status: watchlistSymbols.length || previousQuestions.length || input.profile ? "available" : "limited",
    watchlistSymbols,
  };
}

export function buildAICopilotTraceability(input: {
  marketSearch: AICopilotMarketSearch;
  opportunityActions: AICopilotAction[];
  personalMemory: AICopilotPersonalMemory;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
}): AICopilotTraceItem[] {
  const traces: AICopilotTraceItem[] = [
    {
      detail: `${input.marketSearch.results.length} result(s) came from the latest TradeVeto scanner/opportunity packet.`,
      id: "scanner:market-search",
      label: "Scanner packet",
      sourceType: "scanner",
      status: input.marketSearch.results.length ? "available" : "limited",
    },
    {
      detail: input.marketSearch.intentHints.join("; ") || "Natural-language intent used default opportunity ranking.",
      id: "market-search:intent",
      label: "Natural-language parser",
      sourceType: "market_search",
      status: "available",
    },
    {
      detail: input.personalMemory.watchlistSymbols.length
        ? `${input.personalMemory.watchlistSymbols.length} saved symbol(s) informed personalization.`
        : "No saved watchlist symbols were available for personalization.",
      id: "watchlist:memory",
      label: "Watchlist memory",
      sourceType: "watchlist",
      status: input.personalMemory.watchlistSymbols.length ? "available" : "limited",
    },
  ];
  if (input.personalMemory.status === "available") {
    traces.push({
      detail: input.personalMemory.personalizedInterests.join("; ") || "Profile context available.",
      id: "profile:personalization",
      label: "Personalization memory",
      sourceType: "profile",
      status: "available",
    });
  }
  if (input.portfolioSystem) {
    traces.push({
      detail: input.portfolioSystem.openPositionCount
        ? input.portfolioSystem.summary
        : "No open paper positions were available, so holdings analysis is limited.",
      id: "portfolio:exposure",
      label: "Portfolio packet",
      sourceType: "portfolio",
      status: input.portfolioSystem.openPositionCount ? "available" : "limited",
    });
  }
  for (const action of input.opportunityActions.slice(0, 3)) {
    traces.push({
      detail: `${action.label}: ${action.evidence.join("; ") || action.detail}`,
      id: `action:${action.type}:${action.symbol ?? "portfolio"}`.toLowerCase(),
      label: "Copilot action trace",
      sourceType: "market_search",
      status: action.evidence.length ? "available" : "limited",
      symbol: action.symbol,
    });
  }
  return traces.slice(0, 10);
}

export function movementSignalsForRow(row: OpportunityViewModel): {
  priceMovement: AICopilotSignalLine;
  technicalChange: AICopilotSignalLine;
  volumeChange: AICopilotSignalLine;
} {
  return {
    priceMovement: priceMovementFor(row),
    technicalChange: technicalChangeFor(row),
    volumeChange: volumeChangeFor(row),
  };
}

function profileForQuestion(question: string): QueryProfile {
  const lower = question.toLowerCase();
  const sectors = SECTOR_KEYWORDS.filter((item) => item.aliases.some((alias) => lower.includes(alias))).map((item) => item.label);
  const themes = [
    /\b(ai|artificial intelligence|gpu|semiconductor|chips?)\b/i.test(question) ? "AI" : null,
    /\b(crypto|bitcoin|btc|ethereum|eth)\b/i.test(question) ? "Crypto" : null,
    /\b(macro|rates|inflation|fed|cpi|jobs|oil)\b/i.test(question) ? "Macro" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    earningsOnly: /\b(earnings|eps|revenue|guidance|post-earnings|post earnings)\b/i.test(question),
    improvingOnly: /\b(improving|momentum|stronger|strengthening|breakout|uptrend|higher|ranked up|priority up)\b/i.test(question),
    macroOnly: /\b(macro|rates|inflation|fed|cpi|jobs|oil|regime)\b/i.test(question),
    riskOnly: /\b(elevated risk|risk|fragility|fragile|danger|weak|deteriorating|break|fail|reduce)\b/i.test(question),
    sectors: Array.from(new Set(sectors)),
    similarBaseSymbol: similarBaseSymbolFor(question),
    symbolExplanation: /\b(why|moving|move|moved|up today|down today|what is driving|explain)\b/i.test(question),
    themes: Array.from(new Set(themes)),
    watchlistOnly: /\b(watchlist|saved symbols|tracked symbols)\b/i.test(question),
  };
}

function searchModeFor(profile: QueryProfile, referencedSymbolCount: number): AICopilotSearchMode {
  if (profile.similarBaseSymbol) return "similar_symbols";
  if (profile.watchlistOnly) return "watchlist";
  if (profile.riskOnly && /\bholding|holdings|portfolio|positions?\b/i.test(profile.sectors.join(" "))) return "portfolio_risk";
  if (profile.earningsOnly) return "earnings";
  if (profile.macroOnly && !profile.themes.length) return "macro";
  if (profile.symbolExplanation && referencedSymbolCount > 0) return "symbol_explanation";
  return "market_search";
}

function rankedRowsFor(
  rows: OpportunityViewModel[],
  profile: QueryProfile,
  watchlist: Set<string>,
  referenced: Set<string>,
): Array<{ reasons: string[]; row: OpportunityViewModel; score: number }> {
  return rows
    .map((row) => {
      const score = marketSearchScore(row, profile, watchlist, referenced);
      return { reasons: matchReasonsFor(row, profile, watchlist, referenced), row, score };
    })
    .filter((item) => item.score > 0 || referenced.has(item.row.symbol.toUpperCase()))
    .sort((left, right) => right.score - left.score);
}

function similarRowsFor(rows: OpportunityViewModel[], baseSymbol: string, watchlist: Set<string>): Array<{ reasons: string[]; row: OpportunityViewModel; score: number }> {
  const base = rows.find((row) => row.symbol.toUpperCase() === baseSymbol.toUpperCase());
  if (!base) return [];
  return rows
    .filter((row) => row.symbol.toUpperCase() !== base.symbol.toUpperCase())
    .map((row) => {
      const reasons: string[] = [];
      let score = 20;
      if (cleanText(row.sector, "").toLowerCase() === cleanText(base.sector, "").toLowerCase() && row.sector) {
        score += 28;
        reasons.push(`same sector as ${base.symbol}: ${row.sector}`);
      }
      if (cleanText(row.assetType, "").toLowerCase() === cleanText(base.assetType, "").toLowerCase() && row.assetType) {
        score += 8;
        reasons.push(`same asset class: ${row.assetType}`);
      }
      if (cleanText(row.raw.setup_type, "").toLowerCase() === cleanText(base.raw.setup_type, "").toLowerCase() && row.raw.setup_type) {
        score += 18;
        reasons.push(`similar setup: ${cleanText(row.raw.setup_type, "")}`);
      }
      score += Math.max(0, 18 - Math.abs((row.final_score ?? 50) - (base.final_score ?? 50)) * 0.45);
      score += Math.max(0, 14 - Math.abs(row.fragility - base.fragility) * 0.25);
      if (isAiRelated(row)) {
        score += 8;
        reasons.push("AI-adjacent symbol context");
      }
      if (watchlist.has(row.symbol.toUpperCase())) {
        score += 6;
        reasons.push("already on watchlist");
      }
      if (!reasons.length) reasons.push(`closest available match to ${base.symbol} from current scanner factors`);
      return { reasons, row, score };
    })
    .filter((item) => item.score >= 35)
    .sort((left, right) => right.score - left.score);
}

function marketSearchScore(row: OpportunityViewModel, profile: QueryProfile, watchlist: Set<string>, referenced: Set<string>): number {
  const symbol = row.symbol.toUpperCase();
  let score = (row.final_score ?? 50) * 0.24 + row.conviction * 0.22 + (100 - row.fragility) * 0.12;
  if (referenced.has(symbol)) score += 60;
  if (profile.watchlistOnly && !watchlist.has(symbol)) return 0;
  if (watchlist.has(symbol)) score += 8;
  if (profile.themes.includes("AI")) score += isAiRelated(row) ? 32 : -20;
  if (profile.themes.includes("Crypto")) score += /crypto|bitcoin|btc|ethereum|eth/i.test(`${row.symbol} ${row.company_name ?? ""} ${row.sector ?? ""} ${row.assetType ?? ""}`) ? 28 : -12;
  if (profile.sectors.length) score += profile.sectors.some((sector) => sectorMatch(row, sector)) ? 24 : -10;
  if (profile.improvingOnly) score += improvementScore(row) >= 60 ? 24 : -8;
  if (profile.riskOnly) score += row.fragility >= 62 || row.eventRisk >= 58 ? 28 : -10;
  if (profile.earningsOnly) score += /earn|eps|revenue|guidance/i.test(`${row.eventLabel} ${row.narrative?.eventReasoning ?? ""} ${row.raw.verified_event_signature ?? ""}`) ? 28 : -16;
  if (profile.macroOnly) score += /macro|fed|cpi|inflation|rates|oil|regime/i.test(`${row.macroLabel} ${row.raw.macro_context_summary ?? ""} ${row.eventLabel}`) ? 14 : -4;
  return Math.max(0, score);
}

function matchReasonsFor(row: OpportunityViewModel, profile: QueryProfile, watchlist: Set<string>, referenced: Set<string>): string[] {
  const reasons: string[] = [];
  const symbol = row.symbol.toUpperCase();
  if (referenced.has(symbol)) reasons.push("explicitly referenced in the question");
  if (watchlist.has(symbol)) reasons.push("saved watchlist symbol");
  if (profile.themes.includes("AI") && isAiRelated(row)) reasons.push("AI or semiconductor-adjacent context");
  for (const sector of profile.sectors) {
    if (sectorMatch(row, sector)) reasons.push(`sector match: ${sector}`);
  }
  if (profile.improvingOnly) reasons.push(improvementReason(row));
  if (profile.riskOnly && (row.fragility >= 62 || row.eventRisk >= 58)) reasons.push(`elevated risk context: fragility ${row.fragility}, event risk ${row.eventRisk}`);
  if (profile.earningsOnly && /earn|eps|revenue|guidance/i.test(`${row.eventLabel} ${row.narrative?.eventReasoning ?? ""} ${row.raw.verified_event_signature ?? ""}`)) reasons.push("earnings or guidance event context");
  if (profile.macroOnly) reasons.push(`macro context: ${row.macroLabel}`);
  if (!reasons.length) reasons.push(`ranked by score ${row.final_score ?? "n/a"}, conviction ${row.conviction}, and fragility ${row.fragility}`);
  return reasons.slice(0, 5);
}

function resultForRow(row: OpportunityViewModel, watchlisted: boolean, rankScore: number, reasons: string[]): AICopilotMarketSearchResult {
  const signals = movementSignalsForRow(row);
  return {
    companyName: row.company_name,
    conviction: row.conviction,
    decision: decisionLabel(row.final_decision),
    eventContext: row.eventLabel,
    finalScore: row.final_score,
    fragility: row.fragility,
    macroContext: row.macroLabel,
    matchReasons: reasons,
    price: row.price,
    rankScore,
    sector: row.sector,
    symbol: row.symbol,
    traceId: `scanner:${row.symbol.toUpperCase()}:${row.dataFreshness.lastUpdated ?? "unknown"}`,
    watchlisted,
    ...signals,
  };
}

function priceMovementFor(row: OpportunityViewModel): AICopilotSignalLine {
  const oneDay = numberField(row.raw.return_1d ?? row.raw.price_change_pct ?? row.raw.return_pct);
  const fiveDay = numberField(row.raw.return_5d ?? row.raw.week_return_pct);
  if (oneDay !== null) {
    return {
      detail: `${row.symbol} has a current one-day move of ${formatPct(oneDay)} in the scanner packet${fiveDay !== null ? ` and five-day context of ${formatPct(fiveDay)}` : ""}.`,
      label: "Price movement",
      status: "available",
    };
  }
  return {
    detail: `${row.symbol} has no verified price-change field in the current scanner packet.`,
    label: "Price movement limited",
    status: "limited",
  };
}

function technicalChangeFor(row: OpportunityViewModel): AICopilotSignalLine {
  const momentum = numberField(row.raw.momentum_score ?? row.raw.technical_score ?? row.raw.quality_score);
  const scoreChange = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const setup = cleanText(row.raw.setup_type, "");
  if (momentum !== null || scoreChange !== null || setup) {
    return {
      detail: `${row.symbol} technical context: ${setup || "setup type unavailable"}${momentum !== null ? `, momentum/technical ${Math.round(momentum)}/100` : ""}${scoreChange !== null ? `, score change ${formatSigned(scoreChange)}` : ""}.`,
      label: "Technical change",
      status: "available",
    };
  }
  return {
    detail: `${row.symbol} has no verified technical-change field in the current packet.`,
    label: "Technical change limited",
    status: "limited",
  };
}

function volumeChangeFor(row: OpportunityViewModel): AICopilotSignalLine {
  const relativeVolume = numberField(row.raw.relative_volume ?? row.raw.rel_volume ?? row.raw.volume_ratio);
  const volumeScore = numberField(row.raw.volume_score ?? row.raw.unusual_volume_score ?? row.raw.volume_pressure_score);
  const volumeChange = numberField(row.raw.volume_change_pct);
  if (relativeVolume !== null || volumeScore !== null || volumeChange !== null) {
    return {
      detail: `${row.symbol} volume context:${relativeVolume !== null ? ` relative volume ${relativeVolume.toFixed(2)}x` : ""}${volumeScore !== null ? ` volume score ${Math.round(volumeScore)}/100` : ""}${volumeChange !== null ? ` volume change ${formatPct(volumeChange)}` : ""}.`,
      label: "Volume change",
      status: "available",
    };
  }
  return {
    detail: `${row.symbol} has no verified volume-change field in the current packet.`,
    label: "Volume change limited",
    status: "limited",
  };
}

function improvementScore(row: OpportunityViewModel): number {
  const momentum = numberField(row.raw.momentum_score ?? row.raw.technical_score ?? row.raw.quality_score) ?? 50;
  const scoreChange = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change) ?? 0;
  const narrativeMomentum = row.narrative?.narrativeDrift.momentumScore ?? 50;
  return Math.max(0, Math.min(100, momentum * 0.45 + narrativeMomentum * 0.35 + Math.max(0, scoreChange) * 5));
}

function improvementReason(row: OpportunityViewModel): string {
  const score = Math.round(improvementScore(row));
  return score >= 60 ? `improving momentum context ${score}/100` : `momentum context is mixed at ${score}/100`;
}

function favoriteSectorsFor(rows: OpportunityViewModel[], watchlistSymbols: string[]): string[] {
  const watchlist = new Set(watchlistSymbols.map((symbol) => symbol.toUpperCase()));
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!watchlist.has(row.symbol.toUpperCase()) || !row.sector) continue;
    counts.set(row.sector, (counts.get(row.sector) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([sector]) => sector).slice(0, 5);
}

function intentHintsFor(profile: QueryProfile, referencedSymbolCount: number): string[] {
  return [
    referencedSymbolCount ? `${referencedSymbolCount} referenced symbol(s)` : null,
    profile.similarBaseSymbol ? `similarity base ${profile.similarBaseSymbol}` : null,
    profile.themes.length ? `themes: ${profile.themes.join(", ")}` : null,
    profile.sectors.length ? `sectors: ${profile.sectors.join(", ")}` : null,
    profile.improvingOnly ? "improving momentum requested" : null,
    profile.riskOnly ? "risk/elevated fragility requested" : null,
    profile.earningsOnly ? "earnings context requested" : null,
    profile.watchlistOnly ? "watchlist-only context requested" : null,
    profile.macroOnly ? "macro context requested" : null,
  ].filter((item): item is string => Boolean(item));
}

function limitedReasonFor(profile: QueryProfile): string {
  if (profile.similarBaseSymbol) return `No current scanner row was available for ${profile.similarBaseSymbol}, so similarity cannot be computed.`;
  if (profile.watchlistOnly) return "No saved watchlist rows matched the current question.";
  if (profile.earningsOnly) return "No verified earnings or guidance event context matched the current scanner packet.";
  return "No current scanner rows matched the natural-language filters.";
}

function dedupeActions(actions: AICopilotAction[]): AICopilotAction[] {
  const seen = new Set<string>();
  const next: AICopilotAction[] = [];
  for (const action of actions) {
    const key = `${action.type}:${action.symbol ?? "portfolio"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(action);
  }
  return next;
}

function sectorMatch(row: OpportunityViewModel, sector: string): boolean {
  return cleanText(row.sector, "").toLowerCase().includes(sector.toLowerCase())
    || cleanText(row.company_name, "").toLowerCase().includes(sector.toLowerCase())
    || cleanText(row.raw.setup_type, "").toLowerCase().includes(sector.toLowerCase());
}

function isAiRelated(row: OpportunityViewModel): boolean {
  const symbol = row.symbol.toUpperCase();
  if (AI_SYMBOLS.has(symbol)) return true;
  return /\b(ai|artificial intelligence|semiconductor|chip|gpu|cloud|data center|datacenter|machine learning|automation)\b/i
    .test(`${row.company_name ?? ""} ${row.sector ?? ""} ${row.raw.setup_type ?? ""} ${row.raw.verified_event_signature ?? ""}`);
}

function similarBaseSymbolFor(question: string): string | null {
  const match = question.toUpperCase().match(/\b(?:SIMILAR TO|LIKE|RESEMBLE|RESEMBLES)\s+([A-Z][A-Z0-9.]{1,6})\b/);
  if (match?.[1]) return match[1];
  const tailMatch = question.toUpperCase().match(/\b([A-Z][A-Z0-9.]{1,6})\s+(?:SIMILAR|ANALOGS?)\b/);
  return tailMatch?.[1] ?? null;
}

function numberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPct(value: number): string {
  const normalized = Math.abs(value) > 1.5 ? value : value * 100;
  return `${formatSigned(normalized)}%`;
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 700);
}
