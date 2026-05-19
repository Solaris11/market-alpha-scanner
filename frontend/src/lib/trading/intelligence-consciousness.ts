import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type ConsciousnessTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type ConsciousnessStory = {
  detail: string;
  evidenceLabel: string;
  href?: string;
  id: string;
  score: number | null;
  symbol?: string;
  title: string;
  tone: ConsciousnessTone;
  values: number[];
};

export type ConsciousnessTimelineItem = {
  detail: string;
  evidenceLabel: string;
  id: string;
  symbol?: string;
  title: string;
  tone: ConsciousnessTone;
};

export type ConsciousnessMemorySignal = {
  detail: string;
  evidenceLabel: string;
  id: string;
  similarityScore: number | null;
  symbol?: string;
  title: string;
  tone: ConsciousnessTone;
};

export type ConsciousnessAdaptiveSignal = {
  detail: string;
  id: string;
  title: string;
  tone: ConsciousnessTone;
};

export type ConsciousnessCrossSystemLink = {
  from: string;
  href?: string;
  id: string;
  reason: string;
  strength: number | null;
  to: string;
  tone: ConsciousnessTone;
};

export type IntelligenceConsciousnessSystem = {
  adaptiveSignals: ConsciousnessAdaptiveSignal[];
  attentionScore: number;
  crossSystemLinks: ConsciousnessCrossSystemLink[];
  generatedAt: string;
  guardrail: string;
  headline: string;
  memorySignals: ConsciousnessMemorySignal[];
  narrativeTimeline: ConsciousnessTimelineItem[];
  predictiveAttention: ConsciousnessStory[];
  stateLabel: string;
  stateTone: ConsciousnessTone;
  stories: ConsciousnessStory[];
  summary: string;
};

export type BuildIntelligenceConsciousnessInput = {
  generatedAt?: string | null;
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  surface?: "dashboard" | "opportunities" | "symbol" | "terminal";
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export function buildIntelligenceConsciousnessSystem(input: BuildIntelligenceConsciousnessInput): IntelligenceConsciousnessSystem {
  const rows = input.rows;
  const generatedAt = input.generatedAt ?? "latest";
  const metrics = consciousnessMetrics(rows);
  const workflowStories = workflowTimeline(input.workflowEvolution);
  const memorySignals = memorySignalsFor(rows);
  const predictiveAttention = predictiveAttentionFor(rows, input.workflowEvolution);
  const adaptiveSignals = adaptiveSignalsFor(input.personalizationProfile ?? null, rows, input.workflowEvolution ?? null);
  const stories = storiesFor({ marketCondition: input.marketCondition ?? null, metrics, rows, workflowEvolution: input.workflowEvolution ?? null });
  const crossSystemLinks = crossSystemLinksFor(rows, input.workflowEvolution ?? null);
  const state = consciousnessState(metrics, input.marketCondition ?? null);
  const attentionScore = Math.round(clamp(average([
    metrics.opportunity,
    100 - metrics.fragility,
    100 - metrics.eventRisk,
    metrics.evidence,
    metrics.memory,
  ], 50)));

  return {
    adaptiveSignals,
    attentionScore,
    crossSystemLinks,
    generatedAt,
    guardrail: "This consciousness layer summarizes scored TradeVeto data, workflow memory, evidence depth, and personalization context. It does not predict outcomes or give buy/sell instructions.",
    headline: state.headline,
    memorySignals,
    narrativeTimeline: workflowStories,
    predictiveAttention,
    stateLabel: state.label,
    stateTone: state.tone,
    stories,
    summary: state.summary,
  };
}

function consciousnessMetrics(rows: OpportunityViewModel[]): {
  conviction: number;
  eventRisk: number;
  evidence: number;
  fragility: number;
  macroSupport: number;
  memory: number;
  opportunity: number;
} {
  return {
    conviction: average(rows.map((row) => row.conviction), 50),
    eventRisk: average(rows.map((row) => row.eventRisk), 45),
    evidence: average(rows.map((row) => row.evidence?.score ?? null), 25),
    fragility: average(rows.map((row) => row.fragility), 50),
    macroSupport: average(rows.map((row) => macroScore(row)), 50),
    memory: average(rows.map((row) => memoryScore(row)), 20),
    opportunity: average(rows.map((row) => row.final_score ?? null), 50),
  };
}

function consciousnessState(
  metrics: ReturnType<typeof consciousnessMetrics>,
  marketCondition: string | null,
): { headline: string; label: string; summary: string; tone: ConsciousnessTone } {
  const condition = marketCondition ? humanizeLabel(marketCondition) : "Latest scanner context";
  if (metrics.fragility >= 68 || metrics.eventRisk >= 72) {
    return {
      headline: "Risk is becoming the dominant story",
      label: `${condition} · elevated caution`,
      summary: `Fragility averages ${Math.round(metrics.fragility)}/100 while event pressure averages ${Math.round(metrics.eventRisk)}/100. TradeVeto is prioritizing risk explanation over excitement.`,
      tone: "rose",
    };
  }
  if (metrics.opportunity >= 62 && metrics.macroSupport >= 56 && metrics.fragility < 62) {
    return {
      headline: "Opportunity quality is improving with controlled pressure",
      label: `${condition} · constructive research`,
      summary: `The opportunity stack averages ${Math.round(metrics.opportunity)}/100 with macro support near ${Math.round(metrics.macroSupport)}/100. Monitor confirmation and evidence freshness before increasing trust.`,
      tone: "emerald",
    };
  }
  if (metrics.memory >= 58) {
    return {
      headline: "Memory context is becoming relevant",
      label: `${condition} · historical echo`,
      summary: `Validated analog or large-move memory averages ${Math.round(metrics.memory)}/100. The system is comparing current pressure with prior environments instead of treating this as a fresh isolated signal.`,
      tone: "violet",
    };
  }
  return {
    headline: "The system is watching for clearer confirmation",
    label: `${condition} · patient research`,
    summary: `Opportunity, evidence, macro, and risk signals are mixed. TradeVeto is keeping attention selective until stronger confirmation or deterioration appears.`,
    tone: "cyan",
  };
}

function storiesFor(input: {
  marketCondition: string | null;
  metrics: ReturnType<typeof consciousnessMetrics>;
  rows: OpportunityViewModel[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): ConsciousnessStory[] {
  const top = topOpportunity(input.rows);
  const risk = topRisk(input.rows);
  const stale = staleRows(input.rows);
  const stories: ConsciousnessStory[] = [];

  stories.push({
    detail:
      input.metrics.fragility >= 62
        ? `Average fragility is ${Math.round(input.metrics.fragility)}/100, so the system is weighting invalidation, chase risk, and shock context more heavily.`
        : `Average fragility is ${Math.round(input.metrics.fragility)}/100, so the system is not treating fragility as the dominant story yet.`,
    evidenceLabel: `${input.rows.length} scanner rows`,
    id: "market-pressure-story",
    score: Math.round(input.metrics.fragility),
    title: "Risk pressure is being continuously reweighted",
    tone: input.metrics.fragility >= 62 ? "rose" : "cyan",
    values: [input.metrics.opportunity, input.metrics.conviction, input.metrics.fragility, input.metrics.eventRisk],
  });

  if (top) {
    stories.push({
      detail: `${top.symbol} leads because score, confidence, macro context, and evidence quality combine better than the rest of the visible stack. This is research context only.`,
      evidenceLabel: top.evidence ? `${top.evidence.label} · ${top.evidence.evidenceSampleSize.toLocaleString()} samples` : "Evidence maturity limited",
      href: `/symbol/${top.symbol}`,
      id: `top-opportunity-${top.symbol}`,
      score: top.final_score,
      symbol: top.symbol,
      title: `${top.symbol} is the current attention leader`,
      tone: "emerald",
      values: [top.final_score ?? 0, top.conviction, 100 - top.fragility, macroScore(top), top.evidence?.score ?? 0],
    });
  }

  if (risk) {
    stories.push({
      detail: `${risk.symbol} carries the clearest current risk pressure: fragility ${Math.round(risk.fragility)}/100 and event pressure ${Math.round(risk.eventRisk)}/100. The system is surfacing what could break first.`,
      evidenceLabel: risk.dataFreshness.humanAge,
      href: `/symbol/${risk.symbol}`,
      id: `risk-story-${risk.symbol}`,
      score: Math.round(Math.max(risk.fragility, risk.eventRisk)),
      symbol: risk.symbol,
      title: `${risk.symbol} is the top caution reference`,
      tone: "rose",
      values: [risk.final_score ?? 0, risk.conviction, risk.fragility, risk.eventRisk],
    });
  }

  if (stale.length) {
    stories.push({
      detail: `${stale.map((row) => row.symbol).slice(0, 4).join(", ")} have stale or decaying evidence labels. Confidence should fade until fresh scanner context appears.`,
      evidenceLabel: `${stale.length} stale or decaying setups`,
      id: "freshness-decay-story",
      score: null,
      title: "Confidence is decaying where evidence is aging",
      tone: "amber",
      values: stale.slice(0, 6).map((row) => row.evidence?.score ?? 20),
    });
  }

  const firstChange = input.workflowEvolution?.whatChanged[0] ?? null;
  if (firstChange) {
    stories.push(changeToStory(firstChange));
  }

  return stories.slice(0, 6);
}

function workflowTimeline(workflow: WorkflowEvolutionSummary | null | undefined): ConsciousnessTimelineItem[] {
  const changes = [
    ...(workflow?.whatChanged ?? []),
    ...(workflow?.watchlistEvolution ?? []),
    ...(workflow?.improvingSetups ?? []),
    ...(workflow?.deterioratingSetups ?? []),
  ];
  const seen = new Set<string>();
  const output: ConsciousnessTimelineItem[] = [];
  for (const change of changes) {
    const key = `${change.changeType}:${change.symbol}:${change.metricLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      detail: change.detail,
      evidenceLabel: change.metricLabel,
      id: key,
      symbol: change.symbol === "WORKFLOW" ? undefined : change.symbol,
      title: change.title,
      tone: change.severity === "warning" ? "amber" : change.severity === "positive" ? "emerald" : "cyan",
    });
  }
  if (!output.length) {
    output.push({
      detail: "TradeVeto is creating workflow baselines. Timeline intelligence will become richer after more scan-to-scan memory exists.",
      evidenceLabel: "Limited workflow memory",
      id: "workflow-memory-building",
      title: "Narrative timeline is building",
      tone: "cyan",
    });
  }
  return output.slice(0, 7);
}

function memorySignalsFor(rows: OpportunityViewModel[]): ConsciousnessMemorySignal[] {
  return rows
    .map((row): ConsciousnessMemorySignal | null => {
      const similarity = memoryScore(row);
      const sample = row.evidence?.evidenceSampleSize ?? 0;
      const hasSignal = similarity >= 45 || sample > 0 || row.shockPattern !== null;
      if (!hasSignal) return null;
      const analogLabel = row.shockPattern
        ? `Large-move memory ${Math.round(row.shockPattern.currentSimilarityScore)}/100`
        : row.evidence
          ? `${row.evidence.label} · analog ${row.evidence.analogQualityScore}/100`
          : "Memory context limited";
      return {
        detail: similarity >= 60
          ? `${row.symbol} has enough analog, evidence, or large-move context to compare current conditions with prior environments.`
          : `${row.symbol} has early memory context, but evidence is not mature enough to treat the analog as strong.`,
        evidenceLabel: analogLabel,
        id: `memory-${row.symbol}`,
        similarityScore: Math.round(similarity),
        symbol: row.symbol,
        title: `${row.symbol} memory reference`,
        tone: similarity >= 70 ? "violet" as const : "cyan" as const,
      };
    })
    .filter((item): item is ConsciousnessMemorySignal => item !== null)
    .sort((left, right) => (right.similarityScore ?? 0) - (left.similarityScore ?? 0))
    .slice(0, 5);
}

function predictiveAttentionFor(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null | undefined): ConsciousnessStory[] {
  const output: ConsciousnessStory[] = [];
  const monitor = workflow?.triggerMonitors[0] ?? null;
  if (monitor) {
    output.push({
      detail: `${monitor.symbol} is near ${monitor.condition.toLowerCase()} (${monitor.distanceLabel}). Monitor confirmation quality and invalidation context rather than treating proximity as an action.`,
      evidenceLabel: monitor.priority,
      href: `/symbol/${monitor.symbol}`,
      id: `monitor-${monitor.symbol}`,
      score: monitor.priority === "high" ? 82 : monitor.priority === "medium" ? 64 : 45,
      symbol: monitor.symbol,
      title: `${monitor.symbol} is moving into monitor range`,
      tone: monitor.priority === "high" ? "amber" : "cyan",
      values: [45, monitor.priority === "high" ? 82 : monitor.priority === "medium" ? 64 : 45],
    });
  }

  const improving = workflow?.improvingSetups[0] ?? null;
  if (improving) output.push(changeToStory(improving));

  const supportive = rows
    .filter((row) => (row.final_score ?? 0) >= 60 && row.fragility < 62 && macroScore(row) >= 55)
    .sort((left, right) => (right.final_score ?? 0) - (left.final_score ?? 0))[0] ?? null;
  if (supportive) {
    output.push({
      detail: `${supportive.symbol} combines cleaner risk pressure with better macro alignment than most visible candidates. This belongs in research review, not execution automation.`,
      evidenceLabel: supportive.dataFreshness.humanAge,
      href: `/symbol/${supportive.symbol}`,
      id: `supportive-${supportive.symbol}`,
      score: supportive.final_score,
      symbol: supportive.symbol,
      title: `${supportive.symbol} has supportive context building`,
      tone: "emerald",
      values: [supportive.final_score ?? 0, supportive.conviction, 100 - supportive.fragility, macroScore(supportive)],
    });
  }

  if (!output.length) {
    output.push({
      detail: "No emerging setup has enough confirmed context to elevate proactively. TradeVeto is holding attention in monitor mode.",
      evidenceLabel: "Limited predictive attention",
      id: "predictive-attention-limited",
      score: null,
      title: "No proactive monitor cluster yet",
      tone: "cyan",
      values: [],
    });
  }
  return output.slice(0, 4);
}

function adaptiveSignalsFor(
  profile: UserPersonalizationProfile | null,
  rows: OpportunityViewModel[],
  workflow: WorkflowEvolutionSummary | null,
): ConsciousnessAdaptiveSignal[] {
  const output: ConsciousnessAdaptiveSignal[] = [];
  if (profile) {
    const symbols = profile.behavior.topSymbols.slice(0, 3);
    output.push({
      detail: symbols.length
        ? `Recent behavior emphasizes ${symbols.join(", ")}. TradeVeto uses this only to prioritize context visibility, not to change deterministic scanner scores.`
        : `${profile.label} mode is active. Personalization adjusts presentation priority while preserving scored evidence.`,
      id: "profile-adaptation",
      title: `${profile.label} attention profile`,
      tone: profile.source === "behavioral" || profile.source === "hybrid" ? "violet" : "cyan",
    });
    if (profile.behavior.watchlistCount > 0) {
      output.push({
        detail: `${profile.behavior.watchlistCount} tracked symbols can influence feed ranking, watchlist changes, and alert relevance explanations.`,
        id: "watchlist-adaptation",
        title: "Watchlist-aware ranking",
        tone: "emerald",
      });
    }
  }

  const watchlistChange = workflow?.watchlistEvolution[0] ?? null;
  if (watchlistChange) {
    output.push({
      detail: `${watchlistChange.symbol}: ${watchlistChange.detail}`,
      id: `watchlist-change-${watchlistChange.symbol}`,
      title: "Tracked setup changed",
      tone: watchlistChange.severity === "warning" ? "amber" : "emerald",
    });
  }

  const sectorCounts = new Map<string, number>();
  for (const row of rows) {
    const sector = cleanText(row.sector, "");
    if (!sector) continue;
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }
  const dominantSector = [...sectorCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
  if (dominantSector && dominantSector[1] >= 3) {
    output.push({
      detail: `${dominantSector[0]} appears across ${dominantSector[1]} visible rows, so sector pressure and breadth context deserve extra attention.`,
      id: `sector-${dominantSector[0]}`,
      title: "Sector concentration detected",
      tone: "amber",
    });
  }

  if (!output.length) {
    output.push({
      detail: "Personalized emphasis is limited until watchlist, revisit, or behavior memory accumulates.",
      id: "adaptive-limited",
      title: "Adaptive context is building",
      tone: "cyan",
    });
  }
  return output.slice(0, 5);
}

function crossSystemLinksFor(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null): ConsciousnessCrossSystemLink[] {
  const output: ConsciousnessCrossSystemLink[] = [];
  const risk = topRisk(rows);
  const memory = memorySignalsFor(rows)[0] ?? null;
  const opportunity = topOpportunity(rows);
  const changed = workflow?.whatChanged[0] ?? null;

  if (opportunity) {
    output.push({
      from: "Scanner",
      href: `/symbol/${opportunity.symbol}`,
      id: `scanner-chart-${opportunity.symbol}`,
      reason: `${opportunity.symbol} connects opportunity score, chart review, risk/reward, and evidence maturity.`,
      strength: opportunity.final_score,
      to: "Symbol Cockpit",
      tone: "emerald",
    });
  }
  if (risk) {
    output.push({
      from: "Risk",
      href: `/symbol/${risk.symbol}`,
      id: `risk-alert-${risk.symbol}`,
      reason: `${risk.symbol} connects fragility, event pressure, alerts, and what-to-monitor context.`,
      strength: Math.max(risk.fragility, risk.eventRisk),
      to: "Alerts",
      tone: "rose",
    });
  }
  if (memory) {
    output.push({
      from: "Memory",
      href: memory.symbol ? `/symbol/${memory.symbol}` : "/history",
      id: `memory-replay-${memory.symbol ?? "market"}`,
      reason: `${memory.title} links historical context, replay review, and current confidence quality.`,
      strength: memory.similarityScore,
      to: "Replay",
      tone: "violet",
    });
  }
  if (changed) {
    output.push({
      from: "Workflow",
      href: changed.symbol === "WORKFLOW" ? "/history" : `/symbol/${changed.symbol}`,
      id: `workflow-feed-${changed.changeType}-${changed.symbol}`,
      reason: `${changed.title} feeds the daily narrative, feed ranking, and monitor list.`,
      strength: null,
      to: "Feed",
      tone: changed.severity === "warning" ? "amber" : "cyan",
    });
  }

  return output.slice(0, 5);
}

function changeToStory(change: WorkflowChangeItem): ConsciousnessStory {
  return {
    detail: change.detail,
    evidenceLabel: change.metricLabel,
    href: change.symbol === "WORKFLOW" ? "/history" : `/symbol/${change.symbol}`,
    id: `change-story-${change.changeType}-${change.symbol}`,
    score: null,
    symbol: change.symbol === "WORKFLOW" ? undefined : change.symbol,
    title: change.title,
    tone: change.severity === "warning" ? "amber" : change.severity === "positive" ? "emerald" : "cyan",
    values: [],
  };
}

function topOpportunity(rows: OpportunityViewModel[]): OpportunityViewModel | null {
  return [...rows]
    .filter((row) => row.final_score !== null)
    .sort((left, right) => opportunityRank(right) - opportunityRank(left))[0] ?? null;
}

function topRisk(rows: OpportunityViewModel[]): OpportunityViewModel | null {
  return [...rows]
    .filter((row) => Math.max(row.fragility, row.eventRisk) >= 58)
    .sort((left, right) => Math.max(right.fragility, right.eventRisk) - Math.max(left.fragility, left.eventRisk))[0] ?? null;
}

function staleRows(rows: OpportunityViewModel[]): OpportunityViewModel[] {
  return rows
    .filter((row) => /stale|decay|aging|old/i.test(`${row.decayLabel} ${row.dataFreshness.label}`))
    .slice(0, 6);
}

function opportunityRank(row: OpportunityViewModel): number {
  return (row.final_score ?? 0) + row.conviction * 0.35 + (100 - row.fragility) * 0.24 + macroScore(row) * 0.16 + (row.evidence?.score ?? 0) * 0.12;
}

function macroScore(row: OpportunityViewModel): number {
  const explicit = finiteNumber(row.raw.macro_alignment_score ?? row.raw.macro_score ?? row.raw.risk_on_score);
  if (explicit !== null) return clamp(explicit);
  const adjustment = row.macroAdjustment ?? 0;
  return clamp(50 + adjustment * 4);
}

function memoryScore(row: OpportunityViewModel): number {
  const shock = row.shockPattern?.currentSimilarityScore ?? null;
  const evidenceAnalog = row.evidence?.analogQualityScore ?? null;
  const explicit = finiteNumber(row.raw.current_similarity_score ?? row.raw.analog_quality_score ?? row.raw.regime_similarity_score);
  return clamp(Math.max(shock ?? 0, evidenceAnalog ?? 0, explicit ?? 0));
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
