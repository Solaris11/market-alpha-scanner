import type { DecisionMemorySummary } from "./decision-journal";
import type { IntradayRegimeDriftSystem } from "./intraday-regime-drift";
import type { MarketMemorySummary } from "./market-memory";
import type { TradeVetoOperatingSystem } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { RegimeShiftSystem } from "./regime-shift-intelligence";
import type { ScenarioIntelligenceSystem } from "./scenario-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { buildAICognitionLayer, type AICognitionLayerModel } from "./ai-cognition-layer";
import {
  buildAICopilotActionPlan,
  buildAICopilotMarketSearch,
  buildAICopilotPersonalMemory,
  buildAICopilotTraceability,
  movementSignalsForRow,
  type AICopilotAction,
  type AICopilotMarketSearch,
  type AICopilotMarketSearchResult,
  type AICopilotPersonalMemory,
  type AICopilotSignalLine,
  type AICopilotTraceItem,
} from "./ai-trading-copilot";
import { cleanText } from "@/lib/ui/formatters";
import { decisionLabel } from "@/lib/ui/labels";

export type ResearchCopilotIntent =
  | "comparison"
  | "cognition"
  | "event_synthesis"
  | "fragility"
  | "historical_analogs"
  | "market_state"
  | "natural_language_search"
  | "opportunity_fit"
  | "portfolio"
  | "ranking"
  | "replay"
  | "scenario"
  | "shock"
  | "similar_symbols"
  | "symbol_explanation"
  | "what_changed";

export type ResearchCopilotMode = "concise" | "deep_dive";

export type ResearchCopilotSymbolContext = {
  conviction: number;
  decision: string;
  eventContext: string;
  eventReasoning: string | null;
  eventSources: string[];
  evidenceLabel: string | null;
  finalScore: number | null;
  fragility: number;
  keyRisk: string;
  macroContext: string;
  memoryNarrative: string[];
  narrativeSummary: string | null;
  priceMovement: AICopilotSignalLine;
  sector: string | null;
  setupType: string | null;
  shockContext: string | null;
  symbol: string;
  technicalChange: AICopilotSignalLine;
  volumeChange: AICopilotSignalLine;
};

export type ResearchCopilotCitation = {
  detail: string;
  id: string;
  label: string;
  sourceType: "event" | "intraday" | "macro" | "market_memory" | "meta" | "portfolio" | "replay" | "scanner" | "scenario" | "user_memory" | "workflow";
  symbol?: string | null;
  url?: string | null;
};

export type ResearchCopilotContext = {
  availableSymbols: string[];
  citations: ResearchCopilotCitation[];
  cognition: Pick<AICognitionLayerModel, "confidenceDecay" | "contradictions" | "groundingPacket" | "narrativeEvolution" | "overview" | "posture" | "timeline">;
  conversation: Array<{
    content: string;
    role: "assistant" | "user";
  }>;
  conversationMemory: {
    lastUserQuestion: string | null;
    recentSymbols: string[];
    summary: string | null;
    topicTrail: string[];
  };
  eventSynthesis: {
    riskEvents: string[];
    sourceNames: string[];
    summary: string;
    supportiveEvents: string[];
  };
  followUpContext: string | null;
  generatedAt: string;
  intraday: {
    alerts: string[];
    currentMarketState: string;
    driftDirection: string;
    shockActivityScore: number;
    summary: string;
    volatilityPressure: number;
    whatChanged: string[];
  } | null;
  intent: ResearchCopilotIntent;
  marketState: {
    alerts: string[];
    breadthHealthScore: number;
    currentMarketState: string;
    driftDirection: string;
    liquidityPressure: number;
    riskAppetiteScore: number;
    summary: string;
    transitionRiskScore: number;
    volatilityPressure: number;
  };
  marketSearch: AICopilotMarketSearch;
  memory: {
    behaviorFlags: string[];
    coachingNotes: string[];
    journalCount: number;
    strengths: string[];
    weaknesses: string[];
  } | null;
  meta: {
    dangers: Array<{ risk: number; symbol: string }>;
    priorityQueue: Array<{ category: string; decision: string; opportunity: number; risk: number; symbol: string }>;
    summary: string;
  };
  mode: ResearchCopilotMode;
  opportunityActions: AICopilotAction[];
  personalMemory: AICopilotPersonalMemory;
  portfolio: {
    available: boolean;
    fragilityScore: number | null;
    hiddenCorrelationWarning: string | null;
    limitations: string[];
    openPositionCount: number;
    portfolioQualityScore: number | null;
    scenarioVulnerabilityScore: number | null;
    stressSummary: string[];
    summary: string;
    topExposures: string[];
  } | null;
  profile: {
    label: string;
    preferredRewardLevel: string;
    preferredRiskLevel: string;
    volatilityTolerance: number;
  } | null;
  question: string;
  referencedSymbols: string[];
  scenario: {
    generatedAt: string;
    limitations: string[];
    mostResilient: string[];
    mostVulnerable: string[];
    portfolioStressScore: number;
    scenarioSummaries: string[];
    terminalInsights: string[];
  } | null;
  symbols: ResearchCopilotSymbolContext[];
  traceability: AICopilotTraceItem[];
  workflow: {
    deteriorating: string[];
    improving: string[];
    whatChanged: string[];
  };
};

export type ResearchCopilotAnswer = {
  answer: string;
  citations: ResearchCopilotCitation[];
  confidenceNote: string;
  followUpQuestions: string[];
  intent: ResearchCopilotIntent;
  keyPoints: string[];
  marketSearchResults: AICopilotMarketSearchResult[];
  mode: ResearchCopilotMode;
  opportunityActions: AICopilotAction[];
  personalMemory: AICopilotPersonalMemory;
  referencedSymbols: string[];
  safetyLanguage: string;
  source: "deterministic" | "llm";
  symbolComparisons: string[];
  traceability: AICopilotTraceItem[];
  unsupportedClaimsDetected: boolean;
  whatToWatch: string[];
};

export type ResearchCopilotBuildInput = {
  conversation?: Array<{ content: unknown; role: unknown }>;
  decisionMemory?: DecisionMemorySummary | null;
  marketMemoryBySymbol?: Map<string, MarketMemorySummary>;
  metaSystem: TradeVetoOperatingSystem;
  mode?: unknown;
  personalizationProfile?: UserPersonalizationProfile | null;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  question: string;
  regimeSystem: RegimeShiftSystem;
  scenarioSystem?: ScenarioIntelligenceSystem | null;
  intradaySystem?: IntradayRegimeDriftSystem | null;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

const DEFAULT_QUESTION = "What matters most right now?";

export function normalizeResearchQuestion(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return DEFAULT_QUESTION;
  return text.slice(0, 700);
}

export function normalizeResearchCopilotMode(value: unknown): ResearchCopilotMode {
  return value === "deep_dive" ? "deep_dive" : "concise";
}

export function buildResearchCopilotContext(input: ResearchCopilotBuildInput): ResearchCopilotContext {
  const question = normalizeResearchQuestion(input.question);
  const availableSymbols = input.rows.map((row) => row.symbol.toUpperCase());
  const conversation = normalizeConversation(input.conversation);
  const directSymbols = referencedSymbolsFor(question, availableSymbols);
  const referencedSymbols = directSymbols.length ? directSymbols : referencedSymbolsFromConversation(conversation, availableSymbols);
  const intent = inferResearchIntent(question, referencedSymbols);
  const marketSearch = buildAICopilotMarketSearch({
    conversation,
    portfolioSystem: input.portfolioSystem ?? null,
    profile: input.personalizationProfile ?? null,
    question,
    referencedSymbols,
    rows: input.rows,
    watchlistSymbols: input.watchlistSymbols ?? [],
  });
  const selectedSymbols = selectedSymbolsFor({ intent, marketSearch, referencedSymbols, rows: input.rows, system: input.metaSystem });
  const memoryMap = input.marketMemoryBySymbol ?? new Map<string, MarketMemorySummary>();
  const symbolContexts = selectedSymbols.map((row) => symbolContextFor(row, memoryMap.get(row.symbol.toUpperCase()) ?? null));
  const cognition = buildAICognitionLayer({
    marketCondition: input.regimeSystem.currentMarketState,
    rows: input.rows,
    scanUpdatedAt: input.rows[0]?.dataFreshness.lastUpdated ?? null,
    workflowEvolution: input.workflowEvolution ?? null,
  });
  const portfolio = slimPortfolioContext(input.portfolioSystem ?? null);
  const scenario = slimScenarioContext(input.scenarioSystem ?? null);
  const eventSynthesis = eventSynthesisFor(symbolContexts, input.rows);
  const conversationMemory = conversationMemoryFor(conversation, question, [...availableSymbols, ...(input.watchlistSymbols ?? [])]);
  const opportunityActions = buildAICopilotActionPlan({
    marketSearch,
    portfolioSystem: input.portfolioSystem ?? null,
    watchlistSymbols: input.watchlistSymbols ?? [],
  });
  const personalMemory = buildAICopilotPersonalMemory({
    conversation,
    portfolioSystem: input.portfolioSystem ?? null,
    profile: input.personalizationProfile ?? null,
    question,
    referencedSymbols,
    rows: input.rows,
    watchlistSymbols: input.watchlistSymbols ?? [],
  });
  const traceability = buildAICopilotTraceability({
    marketSearch,
    opportunityActions,
    personalMemory,
    portfolioSystem: input.portfolioSystem ?? null,
  });
  const citations = citationsFor({
    conversationMemory,
    eventSynthesis,
    hasDecisionMemory: Boolean(input.decisionMemory),
    intradaySystem: input.intradaySystem ?? null,
    memoryMap,
    marketSearch,
    portfolio,
    regimeSystem: input.regimeSystem,
    scenario,
    symbolContexts,
    system: input.metaSystem,
    workflowEvolution: input.workflowEvolution ?? null,
    cognition,
  });

  return {
    availableSymbols,
    citations,
    cognition: {
      confidenceDecay: cognition.confidenceDecay.slice(0, 6),
      contradictions: cognition.contradictions.slice(0, 8),
      groundingPacket: cognition.groundingPacket,
      narrativeEvolution: cognition.narrativeEvolution.slice(0, 5),
      overview: cognition.overview,
      posture: cognition.posture,
      timeline: cognition.timeline.slice(0, 8),
    },
    conversation,
    conversationMemory,
    eventSynthesis,
    followUpContext: followUpContextFor(conversation, referencedSymbols),
    generatedAt: new Date().toISOString(),
    intraday: input.intradaySystem ? {
      alerts: input.intradaySystem.alerts.slice(0, 4).map((alert) => `${alert.title}: ${alert.detail}`),
      currentMarketState: input.intradaySystem.currentMarketState,
      driftDirection: input.intradaySystem.driftDirection,
      shockActivityScore: input.intradaySystem.shockActivityScore,
      summary: input.intradaySystem.terminalSummary,
      volatilityPressure: input.intradaySystem.volatilityPressure,
      whatChanged: input.intradaySystem.whatChangedIntraday.slice(0, 5),
    } : null,
    intent,
    marketState: {
      alerts: input.regimeSystem.alerts.slice(0, 4).map((alert) => `${alert.title}: ${alert.detail}`),
      breadthHealthScore: input.regimeSystem.breadthHealthScore,
      currentMarketState: input.regimeSystem.currentMarketState,
      driftDirection: input.regimeSystem.driftDirection,
      liquidityPressure: input.regimeSystem.liquidityPressure,
      riskAppetiteScore: input.regimeSystem.riskAppetiteScore,
      summary: input.regimeSystem.terminalSummary,
      transitionRiskScore: input.regimeSystem.transitionRiskScore,
      volatilityPressure: input.regimeSystem.volatilityPressure,
    },
    marketSearch,
    memory: input.decisionMemory ? {
      behaviorFlags: input.decisionMemory.behaviorFlags.slice(0, 4),
      coachingNotes: input.decisionMemory.coachingNotes.slice(0, 4),
      journalCount: input.decisionMemory.journalCount,
      strengths: input.decisionMemory.strengths.slice(0, 4),
      weaknesses: input.decisionMemory.weaknesses.slice(0, 4),
    } : null,
    meta: {
      dangers: input.metaSystem.dangerQueue.slice(0, 5).map((item) => ({ risk: item.metaRiskScore, symbol: item.symbol })),
      priorityQueue: input.metaSystem.priorityQueue.slice(0, 8).map((item) => ({
        category: item.category,
        decision: item.decision,
        opportunity: item.metaOpportunityScore,
        risk: item.metaRiskScore,
        symbol: item.symbol,
      })),
      summary: input.metaSystem.summary,
    },
    mode: normalizeResearchCopilotMode(input.mode),
    opportunityActions,
    personalMemory,
    portfolio,
    profile: input.personalizationProfile ? {
      label: input.personalizationProfile.label,
      preferredRewardLevel: input.personalizationProfile.preferredRewardLevel,
      preferredRiskLevel: input.personalizationProfile.preferredRiskLevel,
      volatilityTolerance: input.personalizationProfile.volatilityTolerance,
    } : null,
    question,
    referencedSymbols,
    scenario,
    symbols: symbolContexts,
    traceability,
    workflow: {
      deteriorating: (input.workflowEvolution?.deterioratingSetups ?? []).slice(0, 5).map((item) => `${item.symbol}: ${item.title}. ${item.detail}`),
      improving: (input.workflowEvolution?.improvingSetups ?? []).slice(0, 5).map((item) => `${item.symbol}: ${item.title}. ${item.detail}`),
      whatChanged: (input.workflowEvolution?.whatChanged ?? []).slice(0, 6).map((item) => `${item.symbol}: ${item.title}. ${item.detail}`),
    },
  };
}

export function answerResearchCopilotDeterministically(context: ResearchCopilotContext): ResearchCopilotAnswer {
  if (context.intent === "comparison" && context.symbols.length >= 2) return comparisonAnswer(context);
  if (context.intent === "symbol_explanation") return symbolExplanationAnswer(context);
  if (context.intent === "similar_symbols") return similarSymbolsAnswer(context);
  if (context.intent === "natural_language_search") return naturalLanguageSearchAnswer(context);
  if (context.intent === "cognition") return cognitionAnswer(context);
  if (context.intent === "portfolio") return portfolioAnswer(context);
  if (context.intent === "scenario") return scenarioAnswer(context);
  if (context.intent === "event_synthesis") return eventSynthesisAnswer(context);
  if (context.intent === "replay") return replayAnswer(context);
  if (context.intent === "what_changed") return whatChangedAnswer(context);
  if (context.intent === "shock") return shockAnswer(context);
  if (context.intent === "market_state") return marketStateAnswer(context);
  if (context.intent === "historical_analogs") return historicalAnswer(context);
  if (context.intent === "opportunity_fit") return profileAnswer(context);
  if (context.intent === "fragility") return fragilityAnswer(context);
  return rankingAnswer(context);
}

export function inferResearchIntent(question: string, referencedSymbols: string[]): ResearchCopilotIntent {
  const text = question.toLowerCase();
  const asksComparison = /\b(vs|versus|compare|ranked above|better than)\b/i.test(text);
  const asksFragility = /\b(fragility|break|fail|weakening|risk increasing)\b/i.test(text);
  const asksReplay = /\b(replay|before the move|what did .*know|decision replay|historical playback)\b/i.test(text);
  const asksChanged = /\b(changed|since yesterday|what changed|improving|deteriorating|fastest)\b/i.test(text);
  const asksCognition = /\b(why did .*change|why.*changed|why did .*appear|why.*appear|confidence drop|confidence fell|confidence changed|confidence weaken|risk increased|increased risk|what increased risk|contradicting|contradict|contradiction|stale|fresh|decay|requires confirmation|needs confirmation|need confirmation|what needs confirmation|is macro helping|macro helping|thinking|reasoning timeline|became cautious|became more cautious|became aggressive|became constructive)\b/i.test(text);
  const asksShock = /\b(shock|gap|large move|explosive|chase|volatility burst|upside move|downside move)\b/i.test(text);
  const asksPortfolio = /\b(portfolio|holdings|positions|exposure|concentration|correlation|diversification|my book)\b/i.test(text);
  const asksScenario = /\b(scenario|what if|stress|qqq -?3|spy risk|vix|rates surge|yields surge|oil shock|ai narrative|earnings miss)\b/i.test(text);
  const asksEvent = /\b(event|events|news|earnings|guidance|fed|cpi|nfp|inflation|jobs|oil|regulation|filing|catalyst|press release)\b/i.test(text);
  const asksMarket = /\b(market|risk-on|risk off|fragile|cautious|sparse|sector|narrative weakening|regime)\b/i.test(text);
  const asksSearch = /\b(show|find|screen|scan|list|which symbols|which stocks|opportunities|candidates)\b/i.test(text);
  const asksSimilar = /\b(similar to|look similar|symbols similar|analogs like|like [A-Z]{2,5})\b/i.test(question);
  const asksMovement = /\b(why .*moving|moving today|move today|moved today|what.*driving|why .*up|why .*down|explain .*move)\b/i.test(text);
  if (asksComparison || (referencedSymbols.length >= 2 && !asksFragility && !asksReplay && !asksChanged && !asksShock && !asksPortfolio && !asksScenario && !asksEvent && !asksMarket)) return "comparison";
  if (asksPortfolio) return "portfolio";
  if (asksScenario) return "scenario";
  if (asksSimilar) return "similar_symbols";
  if (asksMovement && referencedSymbols.length) return "symbol_explanation";
  if (asksSearch) return "natural_language_search";
  if (asksEvent) return "event_synthesis";
  if (asksReplay) return "replay";
  if (asksCognition) return "cognition";
  if (asksChanged) return "what_changed";
  if (asksShock) return "shock";
  if (asksMarket) return "market_state";
  if (/\b(historical|analog|resembles|similar|memory|burst|shock)\b/i.test(text)) return "historical_analogs";
  if (/\b(profile|for me|my style|fit|personal|risk tolerance)\b/i.test(text)) return "opportunity_fit";
  if (asksFragility) return "fragility";
  return "ranking";
}

function comparisonAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const [left, right] = context.symbols;
  const comparisons = context.symbols.slice(1).map((symbol) => compareSymbols(left, symbol));
  const winner = context.symbols
    .map((symbol) => ({ score: comparisonScore(symbol), symbol }))
    .sort((a, b) => b.score - a.score)[0]?.symbol.symbol ?? left.symbol;
  return baseAnswer(context, {
    answer: `${winner} has the stronger current packet because its score, conviction, fragility balance, and context read better on this snapshot.`,
    keyPoints: [
      `${left.symbol}: ${left.decision}; score ${scoreText(left.finalScore)}, conviction ${left.conviction}, fragility ${left.fragility}.`,
      `${right.symbol}: ${right.decision}; score ${scoreText(right.finalScore)}, conviction ${right.conviction}, fragility ${right.fragility}.`,
      context.marketState.summary,
    ],
    symbolComparisons: comparisons,
    whatToWatch: [
      "Whether the weaker symbol improves macro, event, or fragility context.",
      "Whether the stronger symbol becomes extended or chase-prone.",
      "Whether market-state alerts change the relative ranking.",
    ],
  });
}

function symbolExplanationAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const lines = context.symbols.flatMap((symbol) => [
    `${symbol.symbol}: ${symbol.priceMovement.detail}`,
    `${symbol.symbol}: ${symbol.technicalChange.detail}`,
    `${symbol.symbol}: ${symbol.volumeChange.detail}`,
    `${symbol.symbol}: event ${symbol.eventContext}; macro ${symbol.macroContext}.`,
  ]).slice(0, context.mode === "deep_dive" ? 8 : 4);
  return baseAnswer(context, {
    answer: context.symbols.length
      ? "The movement explanation is bounded to the current TradeVeto scanner packet: price movement, technical context, volume context, verified event pressure, macro state, and freshness."
      : "No matching symbol packet was available, so I cannot explain the move without fabricating market context.",
    keyPoints: lines.length ? lines : [context.marketState.summary, context.meta.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Whether price movement is confirmed by technical and volume evidence.",
      "Whether event or macro pressure is source-backed and still fresh.",
      "Whether fragility rises faster than conviction.",
    ],
  });
}

function naturalLanguageSearchAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const results = context.marketSearch.results.slice(0, context.mode === "deep_dive" ? 6 : 4);
  return baseAnswer(context, {
    answer: results.length
      ? `The strongest current matches for this natural-language screen are ${results.map((result) => result.symbol).join(", ")}. They are ranked from current TradeVeto scanner data, not generated from hidden claims.`
      : context.marketSearch.limitedReason ?? "No current scanner rows matched this natural-language screen.",
    keyPoints: results.length
      ? results.map((result) => `${result.symbol}: score ${scoreText(result.finalScore)}, conviction ${result.conviction}, fragility ${result.fragility}; ${result.matchReasons.slice(0, 2).join("; ")}.`)
      : [context.marketState.summary, context.meta.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Whether the matched rows stay fresh after the next scan.",
      "Whether momentum improves without creating late-entry fragility.",
      "Whether macro and event context support or weaken the screen.",
    ],
  });
}

function similarSymbolsAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const results = context.marketSearch.results.slice(0, context.mode === "deep_dive" ? 6 : 4);
  const base = context.marketSearch.filters.similarBaseSymbol;
  return baseAnswer(context, {
    answer: results.length
      ? `Current symbols most similar to ${base ?? "the requested base"} are ${results.map((result) => result.symbol).join(", ")} based on sector, setup, score, fragility, macro, and AI/theme overlap.`
      : context.marketSearch.limitedReason ?? "No similar-symbol packet is available for the requested base symbol.",
    keyPoints: results.length
      ? results.map((result) => `${result.symbol}: ${result.matchReasons.slice(0, 3).join("; ")}.`)
      : [context.marketState.summary, "Similarity requires a current scanner row for the base symbol."],
    symbolComparisons: results.map((result) => `${result.symbol}: score ${scoreText(result.finalScore)}, conviction ${result.conviction}, fragility ${result.fragility}, macro ${result.macroContext}.`),
    whatToWatch: [
      "Whether similarity is confirmed by actual setup quality and not only sector membership.",
      "Whether the analog has better or worse fragility than the base symbol.",
      "Whether event and macro context are comparable.",
    ],
  });
}

function whatChangedAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const intradayChanges = context.intraday?.whatChanged ?? [];
  const changes = [...intradayChanges, ...context.workflow.whatChanged, ...context.workflow.improving, ...context.workflow.deteriorating].slice(0, 6);
  return baseAnswer(context, {
    answer: changes.length
      ? "The meaningful changes are coming from setup drift, pressure changes, and attention-priority movement."
      : "Change memory is still building, so the current market state and priority queue are the best baseline.",
    keyPoints: changes.length ? changes : [context.marketState.summary, context.meta.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Symbols getting more fragile while market support weakens.",
      "Setups moving closer to trigger conditions without becoming extended.",
      "Whether market breadth improves or weakness spreads across the universe.",
    ],
  });
}

function cognitionAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const contradictionLines = context.cognition.contradictions
    .slice(0, 4)
    .map((item) => `${item.symbol}: ${item.title}. ${item.detail}`);
  const staleLines = context.cognition.confidenceDecay
    .filter((item) => item.status !== "fresh")
    .slice(0, 3)
    .map((item) => `${item.symbol}: ${item.freshnessLabel}. ${item.detail}`);
  const timelineLines = context.cognition.timeline
    .slice(0, 4)
    .map((item) => `${item.title}: ${item.detail}`);
  const points = [...contradictionLines, ...staleLines, ...timelineLines].slice(0, 6);
  return baseAnswer(context, {
    answer: `TradeVeto is not predicting the future. ${context.cognition.overview} Confidence changes when freshness, contradictions, macro support, or risk pressure changes.`,
    keyPoints: points.length ? points : context.cognition.groundingPacket,
    symbolComparisons: [],
    whatToWatch: [
      "Whether stale signals refresh with the same decision state.",
      "Whether contradictions resolve through breadth, macro, volatility, or evidence improvements.",
      "Whether the next workflow snapshot confirms the same story or invalidates it.",
    ],
  });
}

function marketStateAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  return baseAnswer(context, {
    answer: `${context.marketState.currentMarketState} is the active market state. Caution rises when breadth, volatility, liquidity, or transition risk weakens setup quality.`,
    keyPoints: [
      ...(context.intraday ? [context.intraday.summary] : []),
      context.marketState.summary,
      ...context.marketState.alerts.slice(0, 3),
      `Top attention queue: ${context.meta.priorityQueue.slice(0, 4).map((item) => `${item.symbol} ${item.opportunity}/${item.risk}`).join(", ") || "not available"}.`,
    ],
    symbolComparisons: [],
    whatToWatch: [
      "Breadth health and risk appetite scores.",
      "Volatility and liquidity pressure alerts.",
      "Sector leadership rotation and story changes.",
    ],
  });
}

function shockAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const shockLines = context.symbols.map((symbol) => {
    const shock = symbol.shockContext ?? "no validated shock packet available";
    return `${symbol.symbol}: ${shock}; fragility ${symbol.fragility}/100; key risk: ${symbol.keyRisk}.`;
  });
  return baseAnswer(context, {
    answer: "Large-move history is useful only when similar past moves, current setup quality, entry timing, and late-entry risk line up.",
    keyPoints: shockLines.length ? shockLines : ["No validated shock packet is available for this question.", context.marketState.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Whether the move is early or already extended.",
      "Whether volume and breadth confirm instead of fading.",
      "Whether pullback quality improves before late-entry risk rises.",
    ],
  });
}

function portfolioAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const portfolio = context.portfolio;
  if (!portfolio || !portfolio.available) {
    return baseAnswer(context, {
      answer: "I do not have open paper or manual portfolio exposure in this packet, so I can explain watchlist and opportunity risk but not true holdings-level exposure.",
      keyPoints: [
        context.meta.summary,
        "Portfolio analysis needs open positions or manual allocations to measure concentration, hidden correlation, and stress-test vulnerability.",
        context.scenario ? `Scenario stress baseline is ${context.scenario.portfolioStressScore}/100 across the scan universe.` : "Scenario packet is not available in this answer.",
      ],
      symbolComparisons: [],
      whatToWatch: [
        "Add paper or manual positions before relying on portfolio exposure conclusions.",
        "Use symbol-level fragility and broader market context until holdings-level weights are available.",
        "Watch sector concentration and high-fragility names if positions are added.",
      ],
    });
  }
  return baseAnswer(context, {
    answer: "Portfolio analysis combines open exposure, scanner context, fragility, concentration, correlation, and stress tests. It is exposure context, not trading advice.",
    keyPoints: [
      `${portfolio.summary} Quality ${scoreText(portfolio.portfolioQualityScore)}, fragility ${scoreText(portfolio.fragilityScore)}, scenario vulnerability ${scoreText(portfolio.scenarioVulnerabilityScore)}.`,
      ...(portfolio.topExposures.length ? [`Largest exposure buckets: ${portfolio.topExposures.join("; ")}.`] : []),
      ...(portfolio.hiddenCorrelationWarning ? [portfolio.hiddenCorrelationWarning] : []),
      ...portfolio.stressSummary.slice(0, 2),
    ],
    symbolComparisons: [],
    whatToWatch: [
      "Whether concentrated exposure sits in one sector, theme, or market factor.",
      "Whether scenario vulnerability rises faster than diversification quality.",
      "Whether hidden correlation appears across symbols that look different on the surface.",
    ],
  });
}

function scenarioAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const scenario = context.scenario;
  if (!scenario) {
    return baseAnswer(context, {
    answer: "Scenario analysis is unavailable in this packet, so I cannot stress the setup against QQQ, VIX, rates, oil, or earnings scenarios.",
      keyPoints: [context.marketState.summary, context.meta.summary],
      symbolComparisons: [],
      whatToWatch: [
        "Whether scenario packets are available for the latest scanner rows.",
        "Whether market, volatility, or event pressure changes before acting on a setup.",
        "Whether symbol fragility rises under broad risk-off stress.",
      ],
    });
  }
  return baseAnswer(context, {
    answer: "Scenario analysis stress-tests current setups against defined market shocks. It does not predict exact prices; it shows where setup quality is most vulnerable.",
    keyPoints: [
      `Scan-universe stress score is ${scenario.portfolioStressScore}/100.`,
      ...scenario.scenarioSummaries.slice(0, 3),
      ...(scenario.mostVulnerable.length ? [`Most vulnerable: ${scenario.mostVulnerable.join(", ")}.`] : []),
      ...(scenario.mostResilient.length ? [`Most resilient: ${scenario.mostResilient.join(", ")}.`] : []),
    ],
    symbolComparisons: [],
    whatToWatch: [
      "QQQ/SPY weakness if high-beta names dominate the candidate list.",
      "Volatility and liquidity pressure if chase risk is already elevated.",
      "Event-sensitive names ahead of earnings or guidance risk.",
    ],
  });
}

function eventSynthesisAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const symbolLines = context.symbols.map((symbol) => {
    const reasoning = symbol.eventReasoning ? ` ${symbol.eventReasoning}` : "";
    return `${symbol.symbol}: ${symbol.eventContext}.${reasoning}`;
  }).slice(0, 5);
  return baseAnswer(context, {
    answer: "Event synthesis uses verified event labels, source-backed context when available, and scanner risk pressure. It does not invent catalysts when no verified event packet exists.",
    keyPoints: symbolLines.length ? symbolLines : [
      context.eventSynthesis.summary,
      "No symbol-specific verified event packet is strong enough to dominate this answer.",
      context.marketState.summary,
    ],
    symbolComparisons: [],
    whatToWatch: [
      "Whether verified event pressure increases or decays.",
      "Whether earnings, guidance, macro data, or regulatory context maps directly to the symbol.",
      "Whether event pressure is confirmed by price, volume, and sector behavior.",
    ],
  });
}

function historicalAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const lines = context.symbols.flatMap((symbol) => [
    `${symbol.symbol}: ${symbol.evidenceLabel ?? "evidence strength unavailable"}.`,
    ...symbol.memoryNarrative.slice(0, 2),
  ]).slice(0, 6);
  return baseAnswer(context, {
    answer: lines.length
      ? "Historical memory is being used as context. It can show similar setups and what happened next, but it is not a prediction."
      : "No strong historical analog packet is available for the referenced symbols yet.",
    keyPoints: lines.length ? lines : ["Market Memory evidence is limited for this query.", context.marketState.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Whether comparable setup sample size improves.",
      "Whether large-move history aligns with the current market and event context.",
      "Whether historical chase behavior was favorable or fragile.",
    ],
  });
}

function profileAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const profile = context.profile;
  const top = context.meta.priorityQueue[0];
  return baseAnswer(context, {
    answer: profile
      ? `For a ${profile.label} profile, TradeVeto should emphasize ${profile.preferredRiskLevel} risk, ${profile.preferredRewardLevel} reward, and volatility tolerance ${profile.volatilityTolerance}/100. ${top ? `${top.symbol} currently leads the meta queue, but profile fit still depends on fragility and timing.` : "No priority candidate is available."}`
      : "Personalized profile context is not available yet, so the answer uses the general TradeVeto priority queue.",
    keyPoints: [
      ...(context.memory?.coachingNotes ?? []).slice(0, 3),
      ...(context.memory?.strengths ?? []).slice(0, 2),
      context.meta.summary,
    ].slice(0, 5),
    symbolComparisons: [],
    whatToWatch: [
      "Whether the candidate fits preferred risk/reward rather than only ranking high overall.",
      "Whether decision memory flags chase or patience patterns.",
      "Whether entry timing improves before risk is accepted.",
    ],
  });
}

function fragilityAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const sorted = [...context.symbols].sort((left, right) => right.fragility - left.fragility).slice(0, 4);
  const fallback = context.meta.dangers.map((item) => `${item.symbol}: meta risk ${item.risk}/100.`);
  return baseAnswer(context, {
    answer: "Fragility is increasing when volatility, liquidity pressure, crowding, weak breadth, event pressure, or deteriorating macro alignment makes a setup easier to invalidate.",
    keyPoints: sorted.length ? sorted.map((symbol) => `${symbol.symbol}: fragility ${symbol.fragility}/100, macro ${symbol.macroContext}, event ${symbol.eventContext}, key risk: ${symbol.keyRisk}.`) : fallback,
    symbolComparisons: [],
    whatToWatch: [
      "Volatility expansion and liquidity pressure.",
      "Macro alignment or exchange health deterioration.",
      "Extended entries where chase risk is rising faster than conviction.",
    ],
  });
}

function rankingAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  return baseAnswer(context, {
    answer: "TradeVeto ranks what deserves attention by combining setup quality, risk, macro pressure, shock evidence, user fit, and workflow drift.",
    keyPoints: [
      context.meta.summary,
      context.marketState.summary,
      ...context.meta.priorityQueue.slice(0, 4).map((item) => `${item.symbol}: ${item.category}, opportunity ${item.opportunity}/100, risk ${item.risk}/100, decision ${item.decision}.`),
    ],
    symbolComparisons: [],
    whatToWatch: [
      "Whether top candidates keep improving without becoming extended.",
      "Whether market-state alerts reduce decision quality.",
      "Whether user profile and decision memory support the same candidates.",
    ],
  });
}

function replayAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const memoryLines = context.symbols.flatMap((symbol) => [
    `${symbol.symbol}: ${symbol.evidenceLabel ?? "evidence label unavailable"}.`,
    ...symbol.memoryNarrative.slice(0, 2),
  ]).slice(0, 6);
  return baseAnswer(context, {
    answer: "Replay answers should separate what was visible before the move from what happened afterward.",
    keyPoints: memoryLines.length
      ? memoryLines
      : ["No saved replay packet is available for this query, so the answer uses current memory and priority context only.", context.meta.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Whether a saved snapshot exists from before the move.",
      "Whether pre-move evidence showed improving conviction or rising fragility.",
      "Whether the later outcome validates timing quality or only reflects hindsight.",
    ],
  });
}

function baseAnswer(
  context: ResearchCopilotContext,
  body: { answer: string; citations?: ResearchCopilotCitation[]; confidenceNote?: string; followUpQuestions?: string[]; keyPoints: string[]; symbolComparisons: string[]; whatToWatch: string[] },
): ResearchCopilotAnswer {
  const keyPointLimit = context.mode === "deep_dive" ? 6 : 3;
  const watchLimit = context.mode === "deep_dive" ? 5 : 3;
  return {
    answer: safeOutputText(body.answer),
    citations: (body.citations ?? context.citations).slice(0, 8),
    confidenceNote: safeOutputText(body.confidenceNote ?? confidenceNoteFor(context)),
    followUpQuestions: (body.followUpQuestions ?? followUpQuestionsFor(context)).map(safeOutputText).filter(Boolean).slice(0, 3),
    intent: context.intent,
    keyPoints: body.keyPoints.map(safeOutputText).filter(Boolean).slice(0, keyPointLimit),
    marketSearchResults: context.marketSearch.results.slice(0, 8),
    mode: context.mode,
    opportunityActions: context.opportunityActions.slice(0, 6),
    personalMemory: context.personalMemory,
    referencedSymbols: context.symbols.map((symbol) => symbol.symbol),
    safetyLanguage: "Research context only. Not financial advice. Deterministic TradeVeto scores remain the source of truth.",
    source: "deterministic",
    symbolComparisons: body.symbolComparisons.map(safeOutputText).filter(Boolean).slice(0, 4),
    traceability: context.traceability.slice(0, 10),
    unsupportedClaimsDetected: false,
    whatToWatch: body.whatToWatch.map(safeOutputText).filter(Boolean).slice(0, watchLimit),
  };
}

function symbolContextFor(row: OpportunityViewModel, memory: MarketMemorySummary | null): ResearchCopilotSymbolContext {
  const movementSignals = movementSignalsForRow(row);
  return {
    conviction: row.conviction,
    decision: decisionLabel(row.final_decision),
    eventContext: row.eventLabel,
    eventReasoning: row.narrative?.eventReasoning ?? null,
    eventSources: eventSourcesFor(row),
    evidenceLabel: memory?.evidence.label ?? null,
    finalScore: row.final_score,
    fragility: row.fragility,
    keyRisk: cleanText(row.raw.key_risk ?? row.decision_reason ?? row.fragilityLabel, "Risk context is mixed."),
    macroContext: row.macroLabel,
    memoryNarrative: memory?.narrative.slice(0, 3) ?? [],
    narrativeSummary: row.narrative?.narrativeSummary ?? null,
    priceMovement: movementSignals.priceMovement,
    sector: row.sector,
    setupType: cleanText(row.raw.setup_type, "") || null,
    shockContext: row.shockPattern ? `${row.shockPattern.opportunityState}, upside ${row.shockPattern.upsideShockScore}/100, downside ${row.shockPattern.downsideRiskScore}/100` : null,
    symbol: row.symbol,
    technicalChange: movementSignals.technicalChange,
    volumeChange: movementSignals.volumeChange,
  };
}

function slimPortfolioContext(system: PortfolioIntelligenceSystem | null): ResearchCopilotContext["portfolio"] {
  if (!system) return null;
  return {
    available: system.openPositionCount > 0,
    fragilityScore: system.openPositionCount > 0 ? system.fragilityScore : null,
    hiddenCorrelationWarning: system.hiddenCorrelationWarning,
    limitations: system.limitations.slice(0, 3),
    openPositionCount: system.openPositionCount,
    portfolioQualityScore: system.openPositionCount > 0 ? system.portfolioQualityScore : null,
    scenarioVulnerabilityScore: system.openPositionCount > 0 ? system.scenarioVulnerabilityScore : null,
    stressSummary: system.stressProofSummary.slice(0, 4),
    summary: system.summary,
    topExposures: system.exposureBuckets.slice(0, 4).map((bucket) => `${bucket.label} ${bucket.percent}% risk ${bucket.riskScore}/100`),
  };
}

function slimScenarioContext(system: ScenarioIntelligenceSystem | null): ResearchCopilotContext["scenario"] {
  if (!system) return null;
  return {
    generatedAt: system.generatedAt,
    limitations: system.limitations.slice(0, 3),
    mostResilient: system.mostResilient.slice(0, 5).map((profile) => `${profile.symbol} ${profile.averageResilienceScore}/100`),
    mostVulnerable: system.mostVulnerable.slice(0, 5).map((profile) => `${profile.symbol} ${profile.worstCaseVulnerabilityScore}/100`),
    portfolioStressScore: system.portfolioStressScore,
    scenarioSummaries: system.scenarioSummaries.slice(0, 5).map((item) => `${item.scenario.label}: ${item.summary}`),
    terminalInsights: system.terminalInsights.slice(0, 4).map((item) => `${item.title}: ${item.detail}`),
  };
}

function eventSynthesisFor(symbols: ResearchCopilotSymbolContext[], rows: OpportunityViewModel[]): ResearchCopilotContext["eventSynthesis"] {
  const selected = symbols.length ? symbols : rows.slice(0, 5).map((row) => symbolContextFor(row, null));
  const riskEvents = selected
    .filter((symbol) => /elevated|pressure|risk|earn|guidance|fed|cpi|inflation|oil|regulat/i.test(`${symbol.eventContext} ${symbol.eventReasoning ?? ""}`))
    .map((symbol) => `${symbol.symbol}: ${symbol.eventContext}`)
    .slice(0, 5);
  const supportiveEvents = selected
    .filter((symbol) => /contained|support|tailwind|improving|positive/i.test(`${symbol.eventContext} ${symbol.eventReasoning ?? ""}`))
    .map((symbol) => `${symbol.symbol}: ${symbol.eventContext}`)
    .slice(0, 5);
  const sourceNames = [...new Set(selected.flatMap((symbol) => symbol.eventSources))].slice(0, 6);
  return {
    riskEvents,
    sourceNames,
    summary: riskEvents.length
      ? `Verified event pressure is most visible in ${riskEvents.map((item) => item.split(":")[0]).join(", ")}.`
      : "No dominant verified event pressure is visible in the selected packet.",
    supportiveEvents,
  };
}

function conversationMemoryFor(
  conversation: ResearchCopilotContext["conversation"],
  question: string,
  availableSymbols: string[],
): ResearchCopilotContext["conversationMemory"] {
  const text = [...conversation.map((item) => item.content), question].join(" ");
  const recentSymbols = referencedSymbolsFor(text, uniqueSymbols(availableSymbols)).slice(0, 8);
  const topicTrail = conversation
    .filter((item) => item.role === "user")
    .slice(-4)
    .map((item) => cleanText(item.content, "").slice(0, 120))
    .filter(Boolean);
  const lastUserQuestion = [...conversation].reverse().find((item) => item.role === "user")?.content ?? null;
  return {
    lastUserQuestion,
    recentSymbols,
    summary: topicTrail.length ? `Recent thread focused on ${recentSymbols.join(", ") || "market context"} and ${topicTrail[topicTrail.length - 1]}.` : null,
    topicTrail,
  };
}

function citationsFor(input: {
  cognition: Pick<AICognitionLayerModel, "contradictions" | "overview" | "timeline">;
  conversationMemory: ResearchCopilotContext["conversationMemory"];
  eventSynthesis: ResearchCopilotContext["eventSynthesis"];
  hasDecisionMemory: boolean;
  intradaySystem: IntradayRegimeDriftSystem | null;
  memoryMap: Map<string, MarketMemorySummary>;
  marketSearch: AICopilotMarketSearch;
  portfolio: ResearchCopilotContext["portfolio"];
  regimeSystem: RegimeShiftSystem;
  scenario: ResearchCopilotContext["scenario"];
  symbolContexts: ResearchCopilotSymbolContext[];
  system: TradeVetoOperatingSystem;
  workflowEvolution: WorkflowEvolutionSummary | null;
}): ResearchCopilotCitation[] {
  const citations: ResearchCopilotCitation[] = [
    {
      detail: `${input.symbolContexts.length} selected symbol packets from latest scanner view.`,
      id: "scanner:selected-symbols",
      label: "Latest scanner packet",
      sourceType: "scanner",
    },
    {
      detail: input.system.summary,
      id: "meta:priority",
      label: "Meta priority queue",
      sourceType: "meta",
    },
    {
      detail: input.regimeSystem.terminalSummary,
      id: "macro:regime",
      label: "Macro/regime packet",
      sourceType: "macro",
    },
  ];
  if (input.intradaySystem) {
    citations.push({
      detail: input.intradaySystem.terminalSummary,
      id: "intraday:drift",
      label: "Intraday drift packet",
      sourceType: "intraday",
    });
  }
  if (input.workflowEvolution) {
    citations.push({
      detail: input.workflowEvolution.dailyBrief[0] ?? "Workflow evolution packet available.",
      id: "workflow:evolution",
      label: "Workflow evolution",
      sourceType: "workflow",
    });
  }
  citations.push({
    detail: `${input.cognition.overview} Timeline steps: ${input.cognition.timeline.length}; contradictions: ${input.cognition.contradictions.length}.`,
    id: "workflow:cognition",
    label: "AI cognition packet",
    sourceType: "workflow",
  });
  citations.push({
    detail: input.marketSearch.results.length
      ? `${input.marketSearch.results.length} natural-language market search result(s): ${input.marketSearch.results.slice(0, 5).map((item) => item.symbol).join(", ")}.`
      : input.marketSearch.limitedReason ?? "Natural-language market search returned no rows.",
    id: "scanner:natural-language-search",
    label: "Natural-language market search",
    sourceType: "scanner",
  });
  if (input.portfolio) {
    citations.push({
      detail: input.portfolio.summary,
      id: "portfolio:exposure",
      label: "Portfolio exposure packet",
      sourceType: "portfolio",
    });
  }
  for (const [symbol, memory] of input.memoryMap.entries()) {
    citations.push({
      detail: memory.evidence.explanation,
      id: `memory:${symbol}`,
      label: `${symbol} market memory`,
      sourceType: "market_memory",
      symbol,
    });
  }
  if (input.eventSynthesis.riskEvents.length || input.eventSynthesis.supportiveEvents.length) {
    citations.push({
      detail: input.eventSynthesis.summary,
      id: "event:synthesis",
      label: "Verified event context",
      sourceType: "event",
    });
  }
  if (input.scenario) {
    citations.push({
      detail: `Scenario stress ${input.scenario.portfolioStressScore}/100.`,
      id: "scenario:stress",
      label: "Scenario stress packet",
      sourceType: "scenario",
    });
  }
  if (input.hasDecisionMemory) {
    citations.push({
      detail: "Private decision memory summary was included for personalization.",
      id: "user-memory:decision",
      label: "User decision memory",
      sourceType: "user_memory",
    });
  }
  if (input.conversationMemory.summary) {
    citations.push({
      detail: input.conversationMemory.summary,
      id: "user-memory:conversation",
      label: "Conversation memory",
      sourceType: "user_memory",
    });
  }
  return citations.slice(0, 12);
}

function eventSourcesFor(row: OpportunityViewModel): string[] {
  const raw = row.raw as Record<string, unknown>;
  const values = [
    raw.verified_event_source_name,
    raw.event_source_name,
    raw.source_name,
    raw.verified_event_source,
    raw.event_sources,
  ];
  return values
    .flatMap((value) => String(value ?? "").split(/[;,|]/))
    .map((value) => cleanText(value, ""))
    .filter(Boolean)
    .slice(0, 4);
}

function selectedSymbolsFor(input: {
  intent: ResearchCopilotIntent;
  marketSearch: AICopilotMarketSearch;
  referencedSymbols: string[];
  rows: OpportunityViewModel[];
  system: TradeVetoOperatingSystem;
}): OpportunityViewModel[] {
  const bySymbol = new Map(input.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const selected = input.referencedSymbols.map((symbol) => bySymbol.get(symbol)).filter((row): row is OpportunityViewModel => Boolean(row));
  if (selected.length) return selected.slice(0, input.intent === "comparison" ? 4 : 5);
  const searched = input.marketSearch.results.map((result) => bySymbol.get(result.symbol.toUpperCase())).filter((row): row is OpportunityViewModel => Boolean(row));
  if (searched.length) return searched.slice(0, input.intent === "similar_symbols" || input.intent === "natural_language_search" ? 6 : 5);
  const priority = input.system.priorityQueue.map((item) => bySymbol.get(item.symbol)).filter((row): row is OpportunityViewModel => Boolean(row));
  if (input.intent === "fragility") return [...input.rows].sort((left, right) => right.fragility - left.fragility).slice(0, 5);
  return priority.length ? priority.slice(0, 5) : input.rows.slice(0, 5);
}

function referencedSymbolsFor(question: string, availableSymbols: string[]): string[] {
  const upper = question.toUpperCase();
  const symbols = availableSymbols.filter((symbol) => new RegExp(`(^|[^A-Z0-9.])${escapeRegExp(symbol)}([^A-Z0-9.]|$)`).test(upper));
  return uniqueSymbols(symbols).slice(0, 6);
}

function normalizeConversation(value: ResearchCopilotBuildInput["conversation"]): ResearchCopilotContext["conversation"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
      const content = cleanText(item.content, "").slice(0, 500);
      return role && content ? { content, role } : null;
    })
    .filter((item): item is ResearchCopilotContext["conversation"][number] => item !== null)
    .slice(-6);
}

function compareSymbols(left: ResearchCopilotSymbolContext, right: ResearchCopilotSymbolContext): string {
  const leftScore = comparisonScore(left);
  const rightScore = comparisonScore(right);
  const leader = leftScore >= rightScore ? left : right;
  const laggard = leftScore >= rightScore ? right : left;
  const reasons = comparisonReasons(leader, laggard);
  return `${leader.symbol} leads ${laggard.symbol} in this data packet: ${reasons.join("; ")}. Watch whether ${laggard.symbol} improves fragility or broader market context.`;
}

function comparisonScore(symbol: ResearchCopilotSymbolContext): number {
  const macroBonus = /aligned|tailwind|support/i.test(symbol.macroContext) ? 6 : /conflict|headwind/i.test(symbol.macroContext) ? -8 : 0;
  const eventPenalty = /elevated|risk/i.test(symbol.eventContext) ? -4 : 0;
  return (symbol.finalScore ?? 50) * 0.42 + symbol.conviction * 0.30 - symbol.fragility * 0.22 + macroBonus + eventPenalty;
}

function uniqueSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
}

function referencedSymbolsFromConversation(conversation: ResearchCopilotContext["conversation"], availableSymbols: string[]): string[] {
  const recentUserText = conversation
    .filter((item) => item.role === "user")
    .slice(-3)
    .map((item) => item.content)
    .join(" ");
  return referencedSymbolsFor(recentUserText, availableSymbols);
}

function followUpContextFor(conversation: ResearchCopilotContext["conversation"], referencedSymbols: string[]): string | null {
  const lastUser = [...conversation].reverse().find((item) => item.role === "user");
  if (!lastUser && !referencedSymbols.length) return null;
  const symbols = referencedSymbols.length ? ` Symbols carried forward: ${referencedSymbols.join(", ")}.` : "";
  return `${lastUser ? `Continuing from: ${lastUser.content}` : "Continuing prior symbol context."}${symbols}`;
}

function comparisonReasons(leader: ResearchCopilotSymbolContext, laggard: ResearchCopilotSymbolContext): string[] {
  const reasons: string[] = [];
  const leaderScore = leader.finalScore ?? 0;
  const laggardScore = laggard.finalScore ?? 0;
  if (leaderScore > laggardScore) reasons.push(`higher score ${scoreText(leader.finalScore)} vs ${scoreText(laggard.finalScore)}`);
  if (leader.conviction > laggard.conviction) reasons.push(`stronger conviction ${leader.conviction} vs ${laggard.conviction}`);
  if (leader.fragility < laggard.fragility) reasons.push(`lower fragility ${leader.fragility} vs ${laggard.fragility}`);
  if (/aligned|tailwind|support/i.test(leader.macroContext) && !/aligned|tailwind|support/i.test(laggard.macroContext)) reasons.push(`better market context: ${leader.macroContext}`);
  if (!reasons.length) reasons.push("the combined score, risk, and context balance is slightly stronger");
  return reasons.slice(0, 3);
}

function confidenceNoteFor(context: ResearchCopilotContext): string {
  if (!context.symbols.length) return "Confidence is limited because no symbol packet matched the question.";
  const evidence = context.symbols.map((symbol) => symbol.evidenceLabel ?? "").join(" ");
  const limitedEvidence = /\b(limited|unavailable|missing|low)\b/i.test(evidence);
  const followUp = context.followUpContext ? " Follow-up context was carried forward from the recent conversation." : "";
  const searchLimit = context.marketSearch.limitedReason ? ` ${context.marketSearch.limitedReason}` : "";
  if (limitedEvidence) return `Confidence is moderate to limited because historical evidence is still building.${followUp}`;
  return `Confidence comes from the latest scanner, market, event, workflow, market-search, and memory data.${followUp}${searchLimit}`;
}

function followUpQuestionsFor(context: ResearchCopilotContext): string[] {
  const [first, second] = context.symbols;
  if (context.intent === "comparison" && first && second) {
    return [
      `What would make ${second.symbol} overtake ${first.symbol}?`,
      `Which risk could break ${first.symbol}?`,
      `What changed most for ${first.symbol}?`,
    ];
  }
  if (context.intent === "shock" && first) {
    return [
      `Is ${first.symbol} early or extended?`,
      `What would reduce chase risk for ${first.symbol}?`,
      `Show the downside case for ${first.symbol}.`,
    ];
  }
  if (context.intent === "replay" && first) {
    return [
      `What did TradeVeto know before ${first.symbol} moved?`,
      `Was the later move chase-prone?`,
      `Which signal mattered most before the move?`,
    ];
  }
  if (context.intent === "cognition") {
    return [
      "Why did confidence drop?",
      "What increased risk?",
      "What is stale?",
      "What needs confirmation?",
    ];
  }
  if (context.intent === "symbol_explanation" && first) {
    return [
      `What changed most for ${first.symbol}?`,
      `Which risk could break ${first.symbol}?`,
      `Show symbols similar to ${first.symbol}.`,
    ];
  }
  if (context.intent === "similar_symbols" && first) {
    return [
      `Compare ${first.symbol} with the closest match.`,
      `Which similar symbol has lower fragility?`,
      "Show the strongest AI-related setups.",
    ];
  }
  if (context.intent === "natural_language_search") {
    return [
      "Show AI stocks with improving momentum.",
      "Which matched symbols have elevated risk?",
      "Which should I add to my watchlist for research?",
    ];
  }
  return [
    "What changed most since the last scan?",
    "Which setup is improving fastest?",
    "What risk should I watch next?",
  ];
}

function scoreText(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value)}`;
}

function safeOutputText(value: string): string {
  return value
    .replace(/\b(buy now|sell now|guaranteed|sure profit|can't lose|cannot lose|will definitely|must buy|must sell)\b/gi, "direct action claim removed")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
