import { buildInstitutionalPressureSystem } from "./institutional-intelligence";
import { buildTradeVetoOperatingSystem, type MetaOpportunityPriority } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";

export type UnifiedConsoleItem = {
  actionContext: string;
  attentionPriority: MetaOpportunityPriority["attentionPriority"];
  attentionPriorityScore: number;
  category: string;
  decision: string;
  detail: string;
  href: string;
  key: string;
  metricLabel: string;
  reasonForAttention: string;
  riskLabel: string;
  symbol: string;
  urgencyLabel: string;
};

export type UnifiedConsoleMetric = {
  detail: string;
  inverse?: boolean;
  key: string;
  label: string;
  score: number;
};

export type UnifiedConsoleBriefing = {
  actionContext: string;
  label: string;
  priority: "high" | "low" | "medium";
  source: "asymmetry" | "change" | "event" | "fragility" | "macro" | "opportunity" | "shock" | "watchlist";
  symbol?: string;
};

export type UnifiedConsoleLlmPacket = {
  generatedAt: string;
  guardrail: string;
  marketState: string;
  topAttentionSymbols: string[];
  topRisks: string[];
  whatChanged: string[];
};

export type UnifiedIntelligenceConsoleModel = {
  attentionQueue: UnifiedConsoleItem[];
  bestAsymmetry: UnifiedConsoleBriefing[];
  biggestChanges: UnifiedConsoleBriefing[];
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  generatedAt: string;
  llmSummaryPacket: UnifiedConsoleLlmPacket;
  macroRegime: {
    label: string;
    summary: string;
  };
  metrics: UnifiedConsoleMetric[];
  personalizedSummary: string;
  shockConditionsAligning: UnifiedConsoleBriefing[];
  summary: string;
  topOpportunities: UnifiedConsoleItem[];
  topRisks: UnifiedConsoleItem[];
  watchlistChanges: UnifiedConsoleBriefing[];
  whatChangedSinceLastVisit: UnifiedConsoleBriefing[];
  whatMattersMost: string[];
};

export type UnifiedIntelligenceConsoleInput = {
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export function buildUnifiedIntelligenceConsole(input: UnifiedIntelligenceConsoleInput): UnifiedIntelligenceConsoleModel {
  const rows = input.rows;
  const operatingSystem = buildTradeVetoOperatingSystem({
    personalizationProfile: input.personalizationProfile ?? null,
    rows,
    workflowEvolution: input.workflowEvolution ?? null,
  });
  const institutionalSystem = buildInstitutionalPressureSystem(rows);
  const regimeSystem = buildRegimeShiftSystem({ rows, workflowEvolution: input.workflowEvolution ?? null });
  const topOpportunities = operatingSystem.priorityQueue.slice(0, 5).map(toConsoleItem);
  const topRisks = operatingSystem.dangerQueue.slice(0, 5).map(toConsoleItem);
  const attentionQueue = operatingSystem.attentionQueue.length
    ? operatingSystem.attentionQueue.slice(0, 6).map(toConsoleItem)
    : operatingSystem.priorityQueue.slice(0, 6).map(toConsoleItem);
  const shockConditionsAligning = shockBriefings(rows);
  const eventPressure = eventBriefings(rows);
  const fragilityRising = fragilityBriefings(rows, input.workflowEvolution ?? null);
  const bestAsymmetry = asymmetryBriefings(institutionalSystem.highAsymmetry);
  const whatChangedSinceLastVisit = changeBriefings(input.workflowEvolution?.whatChanged ?? [], "change");
  const watchlistChanges = changeBriefings(input.workflowEvolution?.watchlistEvolution ?? [], "watchlist");
  const biggestChanges = whatChangedSinceLastVisit.length ? whatChangedSinceLastVisit : fallbackChangeBriefings(rows);
  const topAttentionSymbols = attentionQueue.slice(0, 4).map((item) => item.symbol);

  return {
    attentionQueue,
    bestAsymmetry,
    biggestChanges,
    eventPressure,
    fragilityRising,
    generatedAt: operatingSystem.generatedAt,
    llmSummaryPacket: {
      generatedAt: operatingSystem.generatedAt,
      guardrail: "LLM may summarize this deterministic packet only; it must not invent events, prices, probabilities, or override scores.",
      marketState: operatingSystem.marketState,
      topAttentionSymbols,
      topRisks: topRisks.map((item) => `${item.symbol}: ${item.reasonForAttention}`),
      whatChanged: biggestChanges.map((item) => item.label),
    },
    macroRegime: {
      label: input.marketCondition ?? regimeSystem.currentMarketState,
      summary: regimeSystem.terminalSummary || operatingSystem.marketStateReason,
    },
    metrics: [
      metric("attention", "Attention", average(attentionQueue.map((item) => item.attentionPriorityScore), 50), "Highest-priority opportunity, risk, shock, and workflow signals."),
      metric("opportunity", "Opportunity", operatingSystem.metaOpportunityAverage, "Average meta opportunity across the visible universe."),
      metric("decision", "Decision Quality", operatingSystem.decisionQualityAverage, "Decision quality combines timing, asymmetry, macro pressure, and position quality."),
      metric("risk", "Meta Risk", operatingSystem.metaRiskAverage, "Higher values require more caution and clearer invalidation context.", true),
      metric("fragility", "Fragility", average(rows.map((row) => row.fragility), 50), "Average setup vulnerability across the scanner universe.", true),
      metric("asymmetry", "Asymmetry", institutionalSystem.averageAsymmetryScore, "Average measured upside/downside structure across institutional intelligence."),
    ],
    personalizedSummary: personalizedSummaryFor(input.personalizationProfile ?? null, topOpportunities),
    shockConditionsAligning,
    summary: operatingSystem.summary,
    topOpportunities,
    topRisks,
    watchlistChanges,
    whatChangedSinceLastVisit,
    whatMattersMost: whatMattersMostFor({
      bestAsymmetry,
      eventPressure,
      fragilityRising,
      macroSummary: regimeSystem.terminalSummary || operatingSystem.marketStateReason,
      shockConditionsAligning,
      topOpportunities,
      topRisks,
    }),
  };
}

function toConsoleItem(item: MetaOpportunityPriority): UnifiedConsoleItem {
  return {
    actionContext: item.actionContext,
    attentionPriority: item.attentionPriority,
    attentionPriorityScore: item.attentionPriorityScore,
    category: item.category,
    decision: item.decision,
    detail: item.keyReasons[0] ?? item.state,
    href: `/symbol/${item.symbol}`,
    key: `${item.symbol}:${item.category}`,
    metricLabel: `${item.metaOpportunityScore} opp / ${item.metaRiskScore} risk`,
    reasonForAttention: item.reasonForAttention,
    riskLabel: item.keyRisks[0] ?? "Risk context remains probabilistic.",
    symbol: item.symbol,
    urgencyLabel: item.urgencyLabel,
  };
}

function metric(key: string, label: string, value: number, detail: string, inverse = false): UnifiedConsoleMetric {
  return { detail, inverse, key, label, score: Math.round(clamp(value)) };
}

function whatMattersMostFor(input: {
  bestAsymmetry: UnifiedConsoleBriefing[];
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  macroSummary: string;
  shockConditionsAligning: UnifiedConsoleBriefing[];
  topOpportunities: UnifiedConsoleItem[];
  topRisks: UnifiedConsoleItem[];
}): string[] {
  const lines: string[] = [];
  if (input.topOpportunities[0]) lines.push(`${input.topOpportunities[0].symbol} leads the unified attention queue because ${input.topOpportunities[0].reasonForAttention}`);
  if (input.topRisks[0]) lines.push(`${input.topRisks[0].symbol} is the top risk item; ${input.topRisks[0].riskLabel}`);
  if (input.shockConditionsAligning[0]) lines.push(input.shockConditionsAligning[0].label);
  if (input.bestAsymmetry[0]) lines.push(input.bestAsymmetry[0].label);
  if (input.eventPressure[0]) lines.push(input.eventPressure[0].label);
  if (input.fragilityRising[0]) lines.push(input.fragilityRising[0].label);
  if (input.macroSummary) lines.push(input.macroSummary);
  return dedupe(lines).slice(0, 5);
}

function shockBriefings(rows: OpportunityViewModel[]): UnifiedConsoleBriefing[] {
  return rows
    .filter((row) => row.shockPattern !== null)
    .map((row) => {
      const shock = row.shockPattern;
      const score = Math.round(average([
        shock?.currentSimilarityScore ?? 0,
        shock?.upsideShockScore ?? 0,
        shock?.twoSidedVolatilityScore ?? 0,
      ], 0));
      return {
        actionContext: "Use shock context as speculative research only and check chase risk before escalating.",
        label: `${row.symbol} shock conditions are aligning at ${score}/100 current shock context.`,
        priority: score >= 72 ? "high" as const : score >= 58 ? "medium" as const : "low" as const,
        source: "shock" as const,
        symbol: row.symbol,
      };
    })
    .filter((item) => item.priority !== "low")
    .sort(compareBriefings)
    .slice(0, 5);
}

function eventBriefings(rows: OpportunityViewModel[]): UnifiedConsoleBriefing[] {
  return rows
    .filter((row) => row.eventRisk >= 62)
    .sort((left, right) => right.eventRisk - left.eventRisk)
    .slice(0, 5)
    .map((row) => ({
      actionContext: "Review verified event source, timestamp, and decay before relying on the narrative.",
      label: `${row.symbol} has elevated verified event pressure: ${row.eventLabel}.`,
      priority: row.eventRisk >= 75 ? "high" : "medium",
      source: "event",
      symbol: row.symbol,
    }));
}

function fragilityBriefings(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null): UnifiedConsoleBriefing[] {
  const workflowItems = changeBriefings(workflow?.deterioratingSetups ?? [], "fragility");
  const rowItems = rows
    .filter((row) => row.fragility >= 70)
    .sort((left, right) => right.fragility - left.fragility)
    .slice(0, 5)
    .map((row) => ({
      actionContext: "Treat elevated fragility as a risk-first review item; do not chase without cleaner structure.",
      label: `${row.symbol} fragility is elevated at ${row.fragility}/100.`,
      priority: row.fragility >= 80 ? "high" as const : "medium" as const,
      source: "fragility" as const,
      symbol: row.symbol,
    }));
  return dedupeBriefings([...workflowItems, ...rowItems]).slice(0, 5);
}

function asymmetryBriefings(items: Array<{ asymmetryScore: number; symbol: string }>): UnifiedConsoleBriefing[] {
  return items.slice(0, 5).map((item) => ({
    actionContext: "Validate entry quality, downside containment, and evidence maturity before treating asymmetry as useful.",
    label: `${item.symbol} leads measured asymmetry at ${item.asymmetryScore}/100.`,
    priority: item.asymmetryScore >= 72 ? "high" : "medium",
    source: "asymmetry",
    symbol: item.symbol,
  }));
}

function changeBriefings(items: WorkflowChangeItem[], source: UnifiedConsoleBriefing["source"]): UnifiedConsoleBriefing[] {
  return items.slice(0, 6).map((item) => ({
    actionContext: item.detail,
    label: `${item.symbol}: ${item.title} (${item.metricLabel}).`,
    priority: item.severity === "warning" ? "high" : item.severity === "positive" ? "medium" : "low",
    source,
    symbol: item.symbol === "WORKFLOW" ? undefined : item.symbol,
  }));
}

function fallbackChangeBriefings(rows: OpportunityViewModel[]): UnifiedConsoleBriefing[] {
  return rows
    .map((row) => ({ change: finiteNumber(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change), row }))
    .filter((item): item is { change: number; row: OpportunityViewModel } => item.change !== null)
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
    .slice(0, 5)
    .map((item) => ({
      actionContext: "Change is based on latest persisted scanner fields and should be confirmed on symbol detail.",
      label: `${item.row.symbol} ${item.change > 0 ? "improved" : "weakened"} ${Math.abs(item.change).toFixed(1)} points.`,
      priority: Math.abs(item.change) >= 6 ? "high" : "medium",
      source: "change",
      symbol: item.row.symbol,
    }));
}

function personalizedSummaryFor(profile: UserPersonalizationProfile | null, topOpportunities: UnifiedConsoleItem[]): string {
  if (!profile) return "Personalized priorities will sharpen after risk profile, watchlist, and behavior memory are available.";
  const top = topOpportunities[0];
  const fit = top ? `${top.symbol} is currently the top candidate under this unified ranking.` : "No dominant candidate is available under this profile.";
  return `${profile.label} profile active: priorities emphasize ${profile.preferredRiskLevel} risk and ${profile.preferredRewardLevel} reward. ${fit}`;
}

function compareBriefings(left: UnifiedConsoleBriefing, right: UnifiedConsoleBriefing): number {
  return priorityRank(right.priority) - priorityRank(left.priority) || cleanText(left.symbol, "").localeCompare(cleanText(right.symbol, ""));
}

function priorityRank(priority: UnifiedConsoleBriefing["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeBriefings(items: UnifiedConsoleBriefing[]): UnifiedConsoleBriefing[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}:${item.symbol ?? item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function average(values: number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
