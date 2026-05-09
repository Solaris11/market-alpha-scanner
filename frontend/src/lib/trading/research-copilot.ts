import type { DecisionMemorySummary } from "./decision-journal";
import type { IntradayRegimeDriftSystem } from "./intraday-regime-drift";
import type { MarketMemorySummary } from "./market-memory";
import type { TradeVetoOperatingSystem } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { RegimeShiftSystem } from "./regime-shift-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText } from "@/lib/ui/formatters";
import { decisionLabel } from "@/lib/ui/labels";

export type ResearchCopilotIntent =
  | "comparison"
  | "fragility"
  | "historical_analogs"
  | "market_state"
  | "opportunity_fit"
  | "ranking"
  | "what_changed";

export type ResearchCopilotSymbolContext = {
  conviction: number;
  decision: string;
  eventContext: string;
  evidenceLabel: string | null;
  finalScore: number | null;
  fragility: number;
  keyRisk: string;
  macroContext: string;
  memoryNarrative: string[];
  narrativeSummary: string | null;
  sector: string | null;
  setupType: string | null;
  shockContext: string | null;
  symbol: string;
};

export type ResearchCopilotContext = {
  availableSymbols: string[];
  conversation: Array<{
    content: string;
    role: "assistant" | "user";
  }>;
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
  profile: {
    label: string;
    preferredRewardLevel: string;
    preferredRiskLevel: string;
    volatilityTolerance: number;
  } | null;
  question: string;
  referencedSymbols: string[];
  symbols: ResearchCopilotSymbolContext[];
  workflow: {
    deteriorating: string[];
    improving: string[];
    whatChanged: string[];
  };
};

export type ResearchCopilotAnswer = {
  answer: string;
  intent: ResearchCopilotIntent;
  keyPoints: string[];
  referencedSymbols: string[];
  safetyLanguage: string;
  source: "deterministic" | "llm";
  symbolComparisons: string[];
  unsupportedClaimsDetected: boolean;
  whatToWatch: string[];
};

export type ResearchCopilotBuildInput = {
  conversation?: Array<{ content: unknown; role: unknown }>;
  decisionMemory?: DecisionMemorySummary | null;
  marketMemoryBySymbol?: Map<string, MarketMemorySummary>;
  metaSystem: TradeVetoOperatingSystem;
  personalizationProfile?: UserPersonalizationProfile | null;
  question: string;
  regimeSystem: RegimeShiftSystem;
  intradaySystem?: IntradayRegimeDriftSystem | null;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

const DEFAULT_QUESTION = "What matters most right now?";

export function normalizeResearchQuestion(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return DEFAULT_QUESTION;
  return text.slice(0, 700);
}

export function buildResearchCopilotContext(input: ResearchCopilotBuildInput): ResearchCopilotContext {
  const question = normalizeResearchQuestion(input.question);
  const availableSymbols = input.rows.map((row) => row.symbol.toUpperCase());
  const referencedSymbols = referencedSymbolsFor(question, availableSymbols);
  const intent = inferResearchIntent(question, referencedSymbols);
  const selectedSymbols = selectedSymbolsFor({ intent, referencedSymbols, rows: input.rows, system: input.metaSystem });
  const memoryMap = input.marketMemoryBySymbol ?? new Map<string, MarketMemorySummary>();

  return {
    availableSymbols,
    conversation: normalizeConversation(input.conversation),
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
    profile: input.personalizationProfile ? {
      label: input.personalizationProfile.label,
      preferredRewardLevel: input.personalizationProfile.preferredRewardLevel,
      preferredRiskLevel: input.personalizationProfile.preferredRiskLevel,
      volatilityTolerance: input.personalizationProfile.volatilityTolerance,
    } : null,
    question,
    referencedSymbols,
    symbols: selectedSymbols.map((row) => symbolContextFor(row, memoryMap.get(row.symbol.toUpperCase()) ?? null)),
    workflow: {
      deteriorating: (input.workflowEvolution?.deterioratingSetups ?? []).slice(0, 5).map((item) => `${item.symbol}: ${item.title}. ${item.detail}`),
      improving: (input.workflowEvolution?.improvingSetups ?? []).slice(0, 5).map((item) => `${item.symbol}: ${item.title}. ${item.detail}`),
      whatChanged: (input.workflowEvolution?.whatChanged ?? []).slice(0, 6).map((item) => `${item.symbol}: ${item.title}. ${item.detail}`),
    },
  };
}

export function answerResearchCopilotDeterministically(context: ResearchCopilotContext): ResearchCopilotAnswer {
  if (context.intent === "comparison" && context.symbols.length >= 2) return comparisonAnswer(context);
  if (context.intent === "what_changed") return whatChangedAnswer(context);
  if (context.intent === "market_state") return marketStateAnswer(context);
  if (context.intent === "historical_analogs") return historicalAnswer(context);
  if (context.intent === "opportunity_fit") return profileAnswer(context);
  if (context.intent === "fragility") return fragilityAnswer(context);
  return rankingAnswer(context);
}

export function inferResearchIntent(question: string, referencedSymbols: string[]): ResearchCopilotIntent {
  const text = question.toLowerCase();
  if (referencedSymbols.length >= 2 || /\b(vs|versus|compare|ranked above|better than)\b/i.test(question)) return "comparison";
  if (/\b(changed|since yesterday|what changed|improving|deteriorating|fastest)\b/i.test(question)) return "what_changed";
  if (/\b(market|risk-on|risk off|fragile|cautious|sparse|sector|narrative weakening|regime)\b/i.test(question)) return "market_state";
  if (/\b(historical|analog|resembles|similar|memory|burst|shock)\b/i.test(question)) return "historical_analogs";
  if (/\b(profile|for me|my style|fit|personal|risk tolerance)\b/i.test(question)) return "opportunity_fit";
  if (/\b(fragility|break|fail|weakening|risk increasing)\b/i.test(question)) return "fragility";
  return "ranking";
}

function comparisonAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const [left, right] = context.symbols;
  const comparisons = context.symbols.slice(1).map((symbol) => compareSymbols(left, symbol));
  const winner = context.symbols
    .map((symbol) => ({ score: comparisonScore(symbol), symbol }))
    .sort((a, b) => b.score - a.score)[0]?.symbol.symbol ?? left.symbol;
  return baseAnswer(context, {
    answer: `${winner} ranks stronger in this comparison because TradeVeto is weighting decision quality, conviction, fragility, macro context, shock evidence, and current opportunity priority together. This is a relative research ranking, not an action instruction.`,
    keyPoints: [
      `${left.symbol}: ${left.decision}, score ${scoreText(left.finalScore)}, conviction ${left.conviction}, fragility ${left.fragility}.`,
      `${right.symbol}: ${right.decision}, score ${scoreText(right.finalScore)}, conviction ${right.conviction}, fragility ${right.fragility}.`,
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

function whatChangedAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const intradayChanges = context.intraday?.whatChanged ?? [];
  const changes = [...intradayChanges, ...context.workflow.whatChanged, ...context.workflow.improving, ...context.workflow.deteriorating].slice(0, 6);
  return baseAnswer(context, {
    answer: changes.length
      ? "The main changes are coming from bounded intraday drift, workflow drift, setup quality changes, and pressure signals rather than a single isolated score."
      : "Workflow memory is still building, so the safest answer is to use the current market-state and priority queue as the baseline.",
    keyPoints: changes.length ? changes : [context.marketState.summary, context.meta.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Symbols with rising fragility and falling macro alignment.",
      "Setups moving closer to trigger conditions without becoming extended.",
      "Whether breadth improves or deterioration spreads across the universe.",
    ],
  });
}

function marketStateAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  return baseAnswer(context, {
    answer: `${context.marketState.currentMarketState} is the active market-state label. The system is cautious when transition risk, volatility pressure, liquidity pressure, or weak breadth reduces decision quality.`,
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
      "Sector leadership rotation and narrative weakening.",
    ],
  });
}

function historicalAnswer(context: ResearchCopilotContext): ResearchCopilotAnswer {
  const lines = context.symbols.flatMap((symbol) => [
    `${symbol.symbol}: ${symbol.evidenceLabel ?? "evidence maturity unavailable"}.`,
    ...symbol.memoryNarrative.slice(0, 2),
  ]).slice(0, 6);
  return baseAnswer(context, {
    answer: lines.length
      ? "Historical memory is being used as probabilistic context. It can show similar setups and outcome tendencies, but it is not a prediction."
      : "No strong historical analog packet is available for the referenced symbols yet.",
    keyPoints: lines.length ? lines : ["Market Memory evidence is limited for this query.", context.marketState.summary],
    symbolComparisons: [],
    whatToWatch: [
      "Whether comparable setup sample size improves.",
      "Whether shock memory aligns with current macro and event context.",
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
    answer: "TradeVeto is ranking what deserves attention by combining scanner quality, decision quality, macro/regime pressure, shock evidence, fragility, user context, and workflow drift.",
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

function baseAnswer(
  context: ResearchCopilotContext,
  body: { answer: string; keyPoints: string[]; symbolComparisons: string[]; whatToWatch: string[] },
): ResearchCopilotAnswer {
  return {
    answer: safeOutputText(body.answer),
    intent: context.intent,
    keyPoints: body.keyPoints.map(safeOutputText).filter(Boolean).slice(0, 6),
    referencedSymbols: context.symbols.map((symbol) => symbol.symbol),
    safetyLanguage: "Research context only. Not financial advice. Deterministic TradeVeto scores remain the source of truth.",
    source: "deterministic",
    symbolComparisons: body.symbolComparisons.map(safeOutputText).filter(Boolean).slice(0, 4),
    unsupportedClaimsDetected: false,
    whatToWatch: body.whatToWatch.map(safeOutputText).filter(Boolean).slice(0, 5),
  };
}

function symbolContextFor(row: OpportunityViewModel, memory: MarketMemorySummary | null): ResearchCopilotSymbolContext {
  return {
    conviction: row.conviction,
    decision: decisionLabel(row.final_decision),
    eventContext: row.eventLabel,
    evidenceLabel: memory?.evidence.label ?? null,
    finalScore: row.final_score,
    fragility: row.fragility,
    keyRisk: cleanText(row.raw.key_risk ?? row.decision_reason ?? row.fragilityLabel, "Risk context is mixed."),
    macroContext: row.macroLabel,
    memoryNarrative: memory?.narrative.slice(0, 3) ?? [],
    narrativeSummary: row.narrative?.narrativeSummary ?? null,
    sector: row.sector,
    setupType: cleanText(row.raw.setup_type, "") || null,
    shockContext: row.shockPattern ? `${row.shockPattern.opportunityState}, upside ${row.shockPattern.upsideShockScore}/100, downside ${row.shockPattern.downsideRiskScore}/100` : null,
    symbol: row.symbol,
  };
}

function selectedSymbolsFor(input: {
  intent: ResearchCopilotIntent;
  referencedSymbols: string[];
  rows: OpportunityViewModel[];
  system: TradeVetoOperatingSystem;
}): OpportunityViewModel[] {
  const bySymbol = new Map(input.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const selected = input.referencedSymbols.map((symbol) => bySymbol.get(symbol)).filter((row): row is OpportunityViewModel => Boolean(row));
  if (selected.length) return selected.slice(0, input.intent === "comparison" ? 4 : 5);
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
  return `${leader.symbol} is stronger than ${laggard.symbol} on this packet because its combined conviction, final score, macro context, and fragility balance is cleaner. ${left.symbol} conviction ${left.conviction}, fragility ${left.fragility}; ${right.symbol} conviction ${right.conviction}, fragility ${right.fragility}.`;
}

function comparisonScore(symbol: ResearchCopilotSymbolContext): number {
  const macroBonus = /aligned|tailwind|support/i.test(symbol.macroContext) ? 6 : /conflict|headwind/i.test(symbol.macroContext) ? -8 : 0;
  const eventPenalty = /elevated|risk/i.test(symbol.eventContext) ? -4 : 0;
  return (symbol.finalScore ?? 50) * 0.42 + symbol.conviction * 0.30 - symbol.fragility * 0.22 + macroBonus + eventPenalty;
}

function uniqueSymbols(symbols: string[]): string[] {
  return [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
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
