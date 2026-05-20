import type { AnalyticsEventName } from "@/lib/analytics-policy";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";
import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { LiveIntelligenceSystem } from "./live-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";

export type LivingProofTone = "amber" | "cyan" | "emerald" | "rose" | "violet";
export type LivingProofCategory =
  | "adaptive_prioritization"
  | "confidence_evolution"
  | "cross_system_cognition"
  | "dynamic_attention"
  | "evolving_feed"
  | "memory_awareness"
  | "narrative_evolution"
  | "portfolio_warning"
  | "risk_evolution";

export type LivingProofSignal = {
  category: LivingProofCategory;
  detail: string;
  evidenceLabel: string;
  href?: string;
  id: string;
  score: number | null;
  symbols: string[];
  title: string;
  tone: LivingProofTone;
  values: number[];
};

export type LivingTelemetryContract = {
  eventName: AnalyticsEventName;
  label: string;
  purpose: string;
};

export type LivingIntelligenceProofSystem = {
  attentionShifts: LivingProofSignal[];
  generatedAt: string;
  guardrail: string;
  headline: string;
  proofScore: number;
  proofSignals: LivingProofSignal[];
  stateLabel: string;
  stateTone: LivingProofTone;
  summary: string;
  telemetryContract: LivingTelemetryContract[];
  timeline: LivingProofSignal[];
};

export type BuildLivingIntelligenceProofInput = {
  feedItems?: IntelligenceFeedItem[];
  generatedAt?: string | null;
  liveSystem?: LiveIntelligenceSystem | null;
  marketCondition?: string | null;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

const TELEMETRY_CONTRACT: LivingTelemetryContract[] = [
  { eventName: "first_useful_action", label: "First useful action", purpose: "Measures time-to-value when a user first does something meaningful." },
  { eventName: "feed_engagement", label: "Feed engagement", purpose: "Tracks opening or acting on high-signal intelligence feed items." },
  { eventName: "watchlist_usage", label: "Watchlist usage", purpose: "Tracks add/remove behavior for monitored symbols." },
  { eventName: "scanner_usage", label: "Scanner usage", purpose: "Tracks discovery opens, scanner filters, presets, lanes, and compare actions." },
  { eventName: "strategy_usage", label: "Strategy usage", purpose: "Tracks Strategy Labs opens and simulation-mode review." },
  { eventName: "replay_usage", label: "Replay usage", purpose: "Tracks replay snapshot exploration and replay-backed review." },
  { eventName: "notification_engagement", label: "Notification engagement", purpose: "Tracks notification menu, read, and feed-notification candidate engagement." },
];

export function buildLivingIntelligenceProofSystem(input: BuildLivingIntelligenceProofInput): LivingIntelligenceProofSystem {
  const generatedAt = input.generatedAt ?? input.liveSystem?.generatedAt ?? new Date().toISOString();
  const feedSignals = feedEvolutionSignals(input.feedItems ?? []);
  const confidenceSignals = confidenceEvolutionSignals(input.rows, input.workflowEvolution ?? null);
  const riskSignals = riskEvolutionSignals(input.rows, input.feedItems ?? [], input.liveSystem ?? null);
  const attentionSignals = attentionShiftSignals(input.rows, input.workflowEvolution ?? null, input.liveSystem ?? null);
  const memorySignals = memorySignalsFor(input.rows);
  const cognitionSignals = crossSystemSignals(input.rows, input.watchlistSymbols ?? []);
  const narrativeSignals = narrativeSignalsFor(input.workflowEvolution ?? null, input.feedItems ?? []);
  const portfolioSignals = portfolioWarningSignals(input.portfolioSystem ?? null, input.watchlistSymbols ?? []);
  const proofSignals = [
    ...feedSignals,
    ...confidenceSignals,
    ...riskSignals,
    ...attentionSignals,
    ...memorySignals,
    ...cognitionSignals,
    ...narrativeSignals,
    ...portfolioSignals,
  ];
  const selectedProofSignals = selectProofSignals(proofSignals, 14);
  const categories = new Set(proofSignals.filter((signal) => signal.score !== null || signal.values.length || signal.symbols.length).map((signal) => signal.category));
  const proofScore = Math.round(clamp((categories.size / 9) * 72 + Math.min(28, proofSignals.length * 2.5)));
  const state = stateFor(proofScore, proofSignals, input.marketCondition ?? null);

  return {
    attentionShifts: attentionSignals.length ? attentionSignals : limitedSignal("dynamic_attention", "Dynamic attention is waiting for stronger change evidence", "No workflow or live monitor shift is validated yet."),
    generatedAt,
    guardrail:
      "Living Intelligence Proof is derived only from scanner rows, workflow memory, live intelligence packets, feed items, watchlist context, and paper portfolio exposure. It is proof of adaptive product behavior, not a market prediction or recommendation.",
    headline: state.headline,
    proofScore,
    proofSignals: selectedProofSignals.length ? selectedProofSignals : limitedSignal("adaptive_prioritization", "Living proof is building", "TradeVeto needs scanner rows, workflow changes, or feed events before proving adaptive behavior."),
    stateLabel: state.label,
    stateTone: state.tone,
    summary: state.summary,
    telemetryContract: TELEMETRY_CONTRACT,
    timeline: [
      ...narrativeSignals,
      ...confidenceSignals,
      ...riskSignals,
      ...feedSignals,
      ...memorySignals,
    ].slice(0, 8),
  };
}

function selectProofSignals(signals: LivingProofSignal[], limit: number): LivingProofSignal[] {
  const selected: LivingProofSignal[] = [];
  const selectedIds = new Set<string>();
  const categories = new Set<LivingProofCategory>();
  for (const signal of signals) {
    if (categories.has(signal.category)) continue;
    selected.push(signal);
    selectedIds.add(signal.id);
    categories.add(signal.category);
    if (selected.length >= limit) return selected;
  }
  for (const signal of signals) {
    if (selectedIds.has(signal.id)) continue;
    selected.push(signal);
    if (selected.length >= limit) return selected;
  }
  return selected;
}

function feedEvolutionSignals(items: IntelligenceFeedItem[]): LivingProofSignal[] {
  const selected = items.slice(0, 4);
  if (!selected.length) return limitedSignal("evolving_feed", "Feed evolution is waiting for events", "No current feed items are validated. TradeVeto will not invent a feed narrative.");
  return selected.map((item) => ({
    category: "evolving_feed",
    detail: `${item.summary} ${item.whyItMatters} Monitor next: ${item.monitorNext}`,
    evidenceLabel: `${humanizeLabel(item.itemType)} · ${item.evidenceLabel}`,
    href: item.actionHref,
    id: `feed-proof-${item.sourceKey}`,
    score: severityScore(item.severity),
    symbols: item.relatedSymbol ? [item.relatedSymbol] : [],
    title: item.title,
    tone: severityTone(item.severity),
    values: [severityScore(item.severity), item.notificationEligible ? 88 : 52],
  }));
}

function confidenceEvolutionSignals(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null): LivingProofSignal[] {
  const rowsWithChange = rows
    .map((row) => ({ row, change: numeric(row.raw.confidence_change ?? row.raw.conviction_change ?? row.raw.score_change) }))
    .filter((item) => item.change !== null && Math.abs(item.change) >= 3)
    .sort((left, right) => Math.abs(right.change ?? 0) - Math.abs(left.change ?? 0));
  const workflowChange = workflow?.improvingSetups[0] ?? workflow?.deterioratingSetups[0] ?? null;
  const top = rowsWithChange[0] ?? null;
  if (top) {
    const direction = (top.change ?? 0) >= 0 ? "improved" : "weakened";
    return [{
      category: "confidence_evolution",
      detail: `${top.row.symbol} confidence ${direction} by ${Math.abs(top.change ?? 0).toFixed(1)} points while conviction is ${top.row.conviction}/100 and evidence is ${top.row.evidence?.label ?? "limited"}.`,
      evidenceLabel: "confidence/score delta",
      href: `/symbol/${top.row.symbol}`,
      id: `confidence-${top.row.symbol}`,
      score: Math.round(clamp(50 + Math.abs(top.change ?? 0) * 5)),
      symbols: [top.row.symbol],
      title: `${top.row.symbol} confidence ${direction}`,
      tone: (top.change ?? 0) >= 0 ? "emerald" : "amber",
      values: [top.row.conviction, top.row.final_score ?? 0, top.row.evidence?.score ?? 0, 50 + (top.change ?? 0) * 4],
    }];
  }
  if (workflowChange) return [changeSignal(workflowChange, "confidence_evolution")];
  const staleRows = rows.filter((row) => row.dataFreshness.status !== "fresh").slice(0, 4);
  if (staleRows.length) {
    return [{
      category: "confidence_evolution",
      detail: `${staleRows.map((row) => row.symbol).join(", ")} have aging evidence. Confidence should fade until fresher scanner context arrives.`,
      evidenceLabel: `${staleRows.length} stale rows`,
      id: "confidence-freshness-decay",
      score: null,
      symbols: staleRows.map((row) => row.symbol),
      title: "Confidence decay is visible through freshness",
      tone: "amber",
      values: staleRows.map((row) => row.evidence?.score ?? 20),
    }];
  }
  return [];
}

function riskEvolutionSignals(rows: OpportunityViewModel[], items: IntelligenceFeedItem[], liveSystem: LiveIntelligenceSystem | null): LivingProofSignal[] {
  const feedRisk = items.find((item) => ["risk_pressure_increased", "volatility_spiked", "shock_risk_detected", "contradiction_detected"].includes(item.itemType));
  if (feedRisk) {
    return [{
      category: "risk_evolution",
      detail: `${feedRisk.summary} ${feedRisk.whyItMatters}`,
      evidenceLabel: feedRisk.evidenceLabel,
      href: feedRisk.actionHref,
      id: `risk-feed-${feedRisk.sourceKey}`,
      score: severityScore(feedRisk.severity),
      symbols: feedRisk.relatedSymbol ? [feedRisk.relatedSymbol] : [],
      title: feedRisk.title,
      tone: severityTone(feedRisk.severity),
      values: [severityScore(feedRisk.severity), feedRisk.notificationEligible ? 84 : 50],
    }];
  }
  const alert = liveSystem?.alerts[0] ?? null;
  if (alert) {
    return [{
      category: "risk_evolution",
      detail: alert.detail,
      evidenceLabel: alert.reasonCodes.join(", ") || "live intelligence",
      id: `risk-live-${alert.title}`,
      score: alert.score,
      symbols: [],
      title: alert.title,
      tone: alert.severity === "critical" ? "rose" : "amber",
      values: [alert.score, liveSystem?.volatilityPressure ?? null, liveSystem?.shockEscalationScore ?? null].filter((value): value is number => value !== null && value !== undefined),
    }];
  }
  const topRisk = [...rows].sort((left, right) => riskScore(right) - riskScore(left))[0] ?? null;
  if (!topRisk) return [];
  return [{
    category: "risk_evolution",
    detail: `${topRisk.symbol} has risk pressure ${riskScore(topRisk)}/100 from fragility ${topRisk.fragility}, event risk ${topRisk.eventRisk}, and shock context ${shockScore(topRisk)}.`,
    evidenceLabel: topRisk.dataFreshness.humanAge,
    href: `/symbol/${topRisk.symbol}`,
    id: `risk-row-${topRisk.symbol}`,
    score: riskScore(topRisk),
    symbols: [topRisk.symbol],
    title: `${topRisk.symbol} is the clearest risk reference`,
    tone: riskScore(topRisk) >= 72 ? "rose" : "amber",
    values: [topRisk.fragility, topRisk.eventRisk, shockScore(topRisk)],
  }];
}

function attentionShiftSignals(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null, liveSystem: LiveIntelligenceSystem | null): LivingProofSignal[] {
  const changes = [...(workflow?.whatChanged ?? []), ...(workflow?.watchlistEvolution ?? [])].slice(0, 2);
  const fromWorkflow = changes.map((change, index) => changeSignal(change, index === 0 ? "dynamic_attention" : "adaptive_prioritization"));
  const liveUpdate = liveSystem?.dashboardUpdates[0] ?? null;
  if (liveUpdate) {
    fromWorkflow.push({
      category: "dynamic_attention",
      detail: liveUpdate.detail,
      evidenceLabel: "live dashboard update",
      id: `live-attention-${liveUpdate.label}`,
      score: liveUpdate.score,
      symbols: [],
      title: `${liveUpdate.label} is shifting attention`,
      tone: liveUpdate.severity === "warning" ? "amber" : "cyan",
      values: [liveUpdate.score, liveSystem?.opportunityDriftScore ?? null, liveSystem?.regimeShiftScore ?? null].filter((value): value is number => value !== null && value !== undefined),
    });
  }
  if (fromWorkflow.length) return fromWorkflow.slice(0, 3);
  const topOpportunity = [...rows].sort((left, right) => (right.final_score ?? 0) - (left.final_score ?? 0))[0] ?? null;
  const topRisk = [...rows].sort((left, right) => riskScore(right) - riskScore(left))[0] ?? null;
  if (!topOpportunity || !topRisk) return [];
  return [{
    category: "adaptive_prioritization",
    detail: `${topOpportunity.symbol} leads opportunity attention while ${topRisk.symbol} leads risk attention. The Terminal can show both without flattening them into one generic score.`,
    evidenceLabel: `${rows.length} scanner rows`,
    id: "attention-opportunity-risk-split",
    score: Math.round(clamp(((topOpportunity.final_score ?? 0) + riskScore(topRisk)) / 2)),
    symbols: [topOpportunity.symbol, topRisk.symbol],
    title: "Attention is split between opportunity and danger",
    tone: "violet",
    values: [topOpportunity.final_score ?? 0, riskScore(topRisk), topOpportunity.conviction, topRisk.fragility],
  }];
}

function memorySignalsFor(rows: OpportunityViewModel[]): LivingProofSignal[] {
  const memoryRows = rows
    .map((row) => ({ row, score: memoryScore(row) }))
    .filter((item) => item.score >= 45)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  if (!memoryRows.length) return limitedSignal("memory_awareness", "Memory awareness is limited", "No symbol currently has enough replay, analog, or large-move evidence to prove memory-aware behavior.");
  return memoryRows.map(({ row, score }) => ({
    category: "memory_awareness",
    detail: `${row.symbol} has memory/replay relevance ${Math.round(score)}/100. TradeVeto can connect current conditions with validated historical context when evidence exists.`,
    evidenceLabel: row.evidence ? `${row.evidence.label} · analog ${row.evidence.analogQualityScore}/100` : "large-move/replay memory",
    href: `/history?symbol=${encodeURIComponent(row.symbol)}`,
    id: `memory-proof-${row.symbol}`,
    score: Math.round(score),
    symbols: [row.symbol],
    title: `${row.symbol} has memory-aware context`,
    tone: score >= 68 ? "violet" : "cyan",
    values: [score, row.evidence?.score ?? 0, row.evidence?.analogQualityScore ?? 0],
  }));
}

function crossSystemSignals(rows: OpportunityViewModel[], watchlistSymbols: string[]): LivingProofSignal[] {
  const output: LivingProofSignal[] = [];
  const sectorGroups = groupBy(rows, (row) => cleanText(row.sector, "Unknown"));
  const pressure = [...sectorGroups.entries()]
    .map(([sector, sectorRows]) => ({ sector, rows: sectorRows, macro: average(sectorRows.map(macroScore), 50), risk: average(sectorRows.map(riskScore), 45), score: average(sectorRows.map((row) => row.final_score ?? null), 50) }))
    .sort((left, right) => right.risk - left.risk || right.rows.length - left.rows.length)[0] ?? null;
  if (pressure && pressure.rows.length >= 2) {
    output.push({
      category: "cross_system_cognition",
      detail: `${pressure.sector} has ${pressure.rows.length} visible symbols with average risk ${Math.round(pressure.risk)}/100, score ${Math.round(pressure.score)}/100, and macro support ${Math.round(pressure.macro)}/100.`,
      evidenceLabel: "sector + macro + risk",
      href: "/discover",
      id: `cross-sector-${pressure.sector}`,
      score: Math.round(pressure.risk),
      symbols: pressure.rows.slice(0, 5).map((row) => row.symbol),
      title: `${pressure.sector} is a connected pressure cluster`,
      tone: pressure.risk >= 65 ? "rose" : "cyan",
      values: [pressure.risk, pressure.score, pressure.macro],
    });
  }
  const watchlist = new Set(watchlistSymbols.map((symbol) => symbol.toUpperCase()));
  const watchedRisk = rows.filter((row) => watchlist.has(row.symbol) && riskScore(row) >= 62);
  if (watchedRisk.length) {
    output.push({
      category: "cross_system_cognition",
      detail: `${watchedRisk.map((row) => row.symbol).join(", ")} are tracked symbols with elevated risk, linking watchlist behavior to scanner risk state.`,
      evidenceLabel: "watchlist + risk",
      id: "cross-watchlist-risk",
      score: Math.round(average(watchedRisk.map(riskScore), 62)),
      symbols: watchedRisk.map((row) => row.symbol),
      title: "Watchlist context is connected to risk",
      tone: "amber",
      values: watchedRisk.map(riskScore),
    });
  }
  return output;
}

function narrativeSignalsFor(workflow: WorkflowEvolutionSummary | null, items: IntelligenceFeedItem[]): LivingProofSignal[] {
  const change = workflow?.whatChanged[0] ?? workflow?.deterioratingSetups[0] ?? workflow?.improvingSetups[0] ?? null;
  if (change) return [changeSignal(change, "narrative_evolution")];
  const item = items[0] ?? null;
  if (!item) return limitedSignal("narrative_evolution", "Narrative evolution is waiting for change history", "No current workflow or feed item exists to narrate without fabrication.");
  return [{
    category: "narrative_evolution",
    detail: `${item.summary} ${item.whyItMatters}`,
    evidenceLabel: item.evidenceLabel,
    href: item.actionHref,
    id: `narrative-${item.sourceKey}`,
    score: severityScore(item.severity),
    symbols: item.relatedSymbol ? [item.relatedSymbol] : [],
    title: item.title,
    tone: severityTone(item.severity),
    values: [severityScore(item.severity)],
  }];
}

function portfolioWarningSignals(portfolio: PortfolioIntelligenceSystem | null, watchlistSymbols: string[]): LivingProofSignal[] {
  if (portfolio && portfolio.openPositionCount > 0) {
    const bucket = portfolio.exposureBuckets[0] ?? null;
    const cluster = portfolio.correlationClusters[0] ?? null;
    return [{
      category: "portfolio_warning",
      detail: cluster
        ? `${cluster.reason} TradeVeto is connecting open exposure with correlation, macro, and risk state.`
        : bucket
          ? `${bucket.label} is ${bucket.percent}% of open exposure with risk ${bucket.riskScore}/100.`
          : portfolio.summary,
      evidenceLabel: `${portfolio.openPositionCount} open positions`,
      href: "/paper",
      id: "portfolio-proof-warning",
      score: Math.max(portfolio.concentrationScore, portfolio.fragilityScore, portfolio.scenarioVulnerabilityScore),
      symbols: cluster?.symbols ?? bucket?.symbols ?? portfolio.positionContexts.slice(0, 5).map((item) => item.symbol),
      title: "Portfolio-aware warnings are active",
      tone: portfolio.concentrationScore >= 65 || portfolio.fragilityScore >= 65 ? "rose" : "amber",
      values: [portfolio.concentrationScore, portfolio.fragilityScore, portfolio.scenarioVulnerabilityScore, portfolio.shockExposureScore],
    }];
  }
  if (watchlistSymbols.length) {
    return [{
      category: "portfolio_warning",
      detail: `${watchlistSymbols.slice(0, 6).join(", ")} are tracked, but no open paper portfolio positions are available. TradeVeto can warn at watchlist level until portfolio history exists.`,
      evidenceLabel: "watchlist-only exposure",
      href: "/paper",
      id: "portfolio-watchlist-limited",
      score: null,
      symbols: watchlistSymbols.slice(0, 6),
      title: "Portfolio warnings are watchlist-aware but exposure-limited",
      tone: "cyan",
      values: [],
    }];
  }
  return limitedSignal("portfolio_warning", "Portfolio-aware warnings are unavailable", "No watchlist or paper-position context is available yet.");
}

function changeSignal(change: WorkflowChangeItem, category: LivingProofCategory): LivingProofSignal {
  const score = scoreFromMetric(change.metricLabel);
  return {
    category,
    detail: change.detail,
    evidenceLabel: change.metricLabel,
    href: change.symbol === "WORKFLOW" ? undefined : `/symbol/${encodeURIComponent(change.symbol)}`,
    id: `${category}-${change.changeType}-${change.symbol}-${change.metricLabel}`,
    score,
    symbols: change.symbol === "WORKFLOW" ? [] : [change.symbol],
    title: `${change.symbol}: ${change.title}`,
    tone: change.severity === "warning" ? "amber" : change.severity === "positive" ? "emerald" : "cyan",
    values: [score ?? 50, change.severity === "warning" ? 72 : change.severity === "positive" ? 78 : 50],
  };
}

function limitedSignal(category: LivingProofCategory, title: string, detail: string): LivingProofSignal[] {
  return [{ category, detail, evidenceLabel: "limited evidence", id: `limited-${category}`, score: null, symbols: [], title, tone: "cyan", values: [] }];
}

function stateFor(score: number, signals: LivingProofSignal[], marketCondition: string | null): { headline: string; label: string; summary: string; tone: LivingProofTone } {
  const riskCount = signals.filter((signal) => signal.tone === "rose" || signal.category === "risk_evolution").length;
  const memoryCount = signals.filter((signal) => signal.category === "memory_awareness").length;
  const labelPrefix = marketCondition ? humanizeLabel(marketCondition) : "Latest intelligence packet";
  if (score >= 78 && riskCount >= 2) {
    return {
      headline: "TradeVeto is proving active risk-aware intelligence",
      label: `${labelPrefix} · adaptive proof active`,
      summary: `The system is showing feed evolution, risk movement, attention shifts, and cross-system context from validated data. Proof score is ${score}/100.`,
      tone: "rose",
    };
  }
  if (score >= 72) {
    return {
      headline: "TradeVeto is behaving like a living intelligence layer",
      label: `${labelPrefix} · living proof active`,
      summary: `Multiple independent systems are evolving: feed, confidence, risk, memory, and attention. Proof score is ${score}/100.`,
      tone: memoryCount ? "violet" : "emerald",
    };
  }
  return {
    headline: "Living intelligence proof is partially active",
    label: `${labelPrefix} · proof still building`,
    summary: `Some adaptive systems have evidence, but missing history or limited rows still reduce proof depth. Proof score is ${score}/100.`,
    tone: "cyan",
  };
}

function riskScore(row: OpportunityViewModel): number {
  return Math.round(clamp(Math.max(row.fragility, row.eventRisk, shockScore(row))));
}

function shockScore(row: OpportunityViewModel): number {
  return Math.round(clamp(numeric(row.raw.shock_score ?? row.raw.event_shock_pressure_score ?? row.raw.upside_shock_score ?? row.shockPattern?.opportunityScore) ?? 45));
}

function macroScore(row: OpportunityViewModel): number {
  return Math.round(clamp(numeric(row.raw.macro_alignment_score ?? row.raw.macro_score ?? row.raw.market_context_score) ?? (row.macroAdjustment === null ? 50 : 50 + row.macroAdjustment)));
}

function memoryScore(row: OpportunityViewModel): number {
  const evidence = row.evidence?.analogQualityScore ?? null;
  const replay = numeric(row.raw.replay_similarity_score ?? row.raw.market_memory_similarity_score ?? row.raw.historical_similarity_score);
  const largeMove = row.shockPattern?.currentSimilarityScore ?? numeric(row.raw.large_move_history_score);
  return Math.round(clamp(average([evidence, replay, largeMove], 0)));
}

function severityScore(severity: IntelligenceFeedItem["severity"]): number {
  if (severity === "critical") return 94;
  if (severity === "high") return 84;
  if (severity === "warning") return 72;
  if (severity === "positive") return 76;
  if (severity === "medium") return 62;
  return 48;
}

function severityTone(severity: IntelligenceFeedItem["severity"]): LivingProofTone {
  if (severity === "critical" || severity === "high" || severity === "warning") return "rose";
  if (severity === "positive") return "emerald";
  if (severity === "medium") return "amber";
  return "cyan";
}

function scoreFromMetric(label: string): number | null {
  const match = label.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  return Math.round(clamp(50 + value * 4));
}

function numeric(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null || !Number.isFinite(parsed) ? null : parsed;
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}
