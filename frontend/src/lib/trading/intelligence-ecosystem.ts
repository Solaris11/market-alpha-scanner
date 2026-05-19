import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type EcosystemTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type EcosystemBriefItem = {
  detail: string;
  evidenceLabel: string;
  href?: string;
  id: string;
  score: number | null;
  title: string;
  tone: EcosystemTone;
  values: number[];
};

export type EcosystemMonitor = {
  detail: string;
  id: string;
  intensity: number | null;
  sourceLabel: string;
  title: string;
  tone: EcosystemTone;
  values: number[];
};

export type CrossSymbolCognition = {
  detail: string;
  href?: string;
  id: string;
  score: number | null;
  symbols: string[];
  title: string;
  tone: EcosystemTone;
};

export type PortfolioEcosystemSignal = {
  detail: string;
  id: string;
  score: number | null;
  title: string;
  tone: EcosystemTone;
};

export type NotificationIntelligenceSignal = {
  detail: string;
  href?: string;
  id: string;
  sourceLabel: string;
  title: string;
  tone: EcosystemTone;
};

export type MarketWorldSignal = {
  detail: string;
  id: string;
  metric: string;
  title: string;
  tone: EcosystemTone;
  values: number[];
};

export type IntelligenceEcosystemSystem = {
  activeMonitors: EcosystemMonitor[];
  attentionScore: number;
  crossSymbolCognition: CrossSymbolCognition[];
  ecosystemLabel: string;
  ecosystemTone: EcosystemTone;
  feedEvolution: EcosystemBriefItem[];
  generatedAt: string;
  guardrail: string;
  headline: string;
  marketWorld: MarketWorldSignal[];
  morningBrief: EcosystemBriefItem[];
  notificationIntelligence: NotificationIntelligenceSignal[];
  portfolioAwareness: PortfolioEcosystemSignal[];
  sinceLastVisit: EcosystemBriefItem[];
  summary: string;
};

export type BuildIntelligenceEcosystemInput = {
  feedItems?: IntelligenceFeedItem[];
  generatedAt?: string | null;
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  rows: OpportunityViewModel[];
  scanUpdatedAt?: string | null;
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

type EcosystemMetrics = {
  averageConfidence: number;
  averageEvidence: number;
  averageFragility: number;
  averageMacro: number;
  averageOpportunity: number;
  averageShock: number;
  avoidCount: number;
  dangerousCount: number;
  memoryScore: number;
  opportunityCount: number;
  watchCount: number;
  watchlistHits: number;
};

export function buildIntelligenceEcosystemSystem(input: BuildIntelligenceEcosystemInput): IntelligenceEcosystemSystem {
  const rows = input.rows;
  const metrics = ecosystemMetrics(rows, input.watchlistSymbols ?? []);
  const generatedAt = input.generatedAt ?? input.scanUpdatedAt ?? new Date().toISOString();
  const state = ecosystemState(metrics, input.marketCondition ?? null, input.workflowEvolution ?? null);
  const morningBrief = buildMorningBrief({ input, metrics });
  const feedEvolution = feedEvolutionFor(input.feedItems ?? []);
  const sinceLastVisit = sinceLastVisitFor(input.workflowEvolution ?? null);
  const activeMonitors = activeMonitorsFor(input, metrics);
  const crossSymbolCognition = crossSymbolCognitionFor(input, metrics);
  const portfolioAwareness = portfolioAwarenessFor(input.portfolioSystem ?? null, input.watchlistSymbols ?? [], metrics);
  const notificationIntelligence = notificationIntelligenceFor(input.feedItems ?? []);
  const marketWorld = marketWorldFor(input, metrics);
  const attentionScore = Math.round(clamp(average([
    metrics.averageOpportunity,
    metrics.averageConfidence,
    metrics.averageEvidence,
    100 - metrics.averageFragility,
    100 - metrics.averageShock,
    metrics.averageMacro,
    metrics.watchlistHits > 0 ? 64 : null,
  ], 50)));

  return {
    activeMonitors,
    attentionScore,
    crossSymbolCognition,
    ecosystemLabel: state.label,
    ecosystemTone: state.tone,
    feedEvolution,
    generatedAt,
    guardrail:
      "This ecosystem view is built from TradeVeto scanner rows, workflow memory, feed items, watchlist context, and paper portfolio exposure where available. It is research context only, not financial advice or a recommendation.",
    headline: state.headline,
    marketWorld,
    morningBrief,
    notificationIntelligence,
    portfolioAwareness,
    sinceLastVisit,
    summary: state.summary,
  };
}

function ecosystemMetrics(rows: OpportunityViewModel[], watchlistSymbols: string[]): EcosystemMetrics {
  const watchlist = new Set(watchlistSymbols.map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const watchRows = rows.filter((row) => ["WATCH", "WAIT_PULLBACK", "ENTER"].includes(cleanText(row.final_decision, "").toUpperCase()));
  const avoidRows = rows.filter((row) => cleanText(row.final_decision, "").toUpperCase() === "AVOID");
  const dangerousRows = rows.filter((row) => row.fragility >= 70 || row.eventRisk >= 72 || shockScore(row) >= 72);
  return {
    averageConfidence: average(rows.map((row) => row.conviction), 50),
    averageEvidence: average(rows.map((row) => row.evidence?.score ?? null), 25),
    averageFragility: average(rows.map((row) => row.fragility), 50),
    averageMacro: average(rows.map((row) => macroScore(row)), 50),
    averageOpportunity: average(rows.map((row) => row.final_score ?? null), 50),
    averageShock: average(rows.map((row) => shockScore(row)), 45),
    avoidCount: avoidRows.length,
    dangerousCount: dangerousRows.length,
    memoryScore: average(rows.map((row) => memoryScore(row)), 20),
    opportunityCount: watchRows.length,
    watchCount: watchRows.filter((row) => cleanText(row.final_decision, "").toUpperCase() !== "ENTER").length,
    watchlistHits: rows.filter((row) => watchlist.has(row.symbol)).length,
  };
}

function ecosystemState(
  metrics: EcosystemMetrics,
  marketCondition: string | null,
  workflow: WorkflowEvolutionSummary | null,
): { headline: string; label: string; summary: string; tone: EcosystemTone } {
  const condition = marketCondition ? humanizeLabel(marketCondition) : "Latest scanner packet";
  const deterioration = workflow?.deterioratingSetups.length ?? 0;
  const improvement = workflow?.improvingSetups.length ?? 0;
  if (metrics.averageFragility >= 66 || metrics.averageShock >= 70 || deterioration > improvement + 1) {
    return {
      headline: "Risk is controlling the daily intelligence map",
      label: `${condition} · active caution`,
      summary: `Fragility averages ${Math.round(metrics.averageFragility)}/100, shock pressure is near ${Math.round(metrics.averageShock)}/100, and ${metrics.dangerousCount} symbols are elevated. TradeVeto is prioritizing monitoring, deterioration, and evidence freshness.`,
      tone: "rose",
    };
  }
  if (metrics.opportunityCount >= 5 && metrics.averageConfidence >= 60 && metrics.averageMacro >= 55) {
    return {
      headline: "The ecosystem is finding monitored opportunity clusters",
      label: `${condition} · selective opportunity`,
      summary: `${metrics.opportunityCount} research candidates are visible with average confidence ${Math.round(metrics.averageConfidence)}/100 and macro support ${Math.round(metrics.averageMacro)}/100. The system is ranking what deserves attention, not issuing trade instructions.`,
      tone: "emerald",
    };
  }
  if (metrics.memoryScore >= 55) {
    return {
      headline: "Market memory is becoming part of the daily story",
      label: `${condition} · historical context active`,
      summary: `Validated analog context averages ${Math.round(metrics.memoryScore)}/100. TradeVeto is comparing current market behavior with prior environments before elevating conviction.`,
      tone: "violet",
    };
  }
  return {
    headline: "TradeVeto is monitoring for the next clear shift",
    label: `${condition} · patient monitoring`,
    summary: `Opportunity, confidence, macro support, and risk pressure remain mixed. The ecosystem is watching what improves, what deteriorates, and what becomes stale.`,
    tone: "cyan",
  };
}

function buildMorningBrief({ input, metrics }: { input: BuildIntelligenceEcosystemInput; metrics: EcosystemMetrics }): EcosystemBriefItem[] {
  const topOpportunity = topRows(input.rows, (row) => (row.final_score ?? 0) + row.conviction - row.fragility * 0.25, 1)[0] ?? null;
  const topRisk = topRows(input.rows, (row) => Math.max(row.fragility, row.eventRisk, shockScore(row)), 1)[0] ?? null;
  const watchlist = new Set((input.watchlistSymbols ?? []).map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const watchlistRisk = topRows(input.rows.filter((row) => watchlist.has(row.symbol)), (row) => Math.max(row.fragility, row.eventRisk, shockScore(row)), 1)[0] ?? null;
  const firstWorkflow = firstChange(input.workflowEvolution ?? null);
  const items: EcosystemBriefItem[] = [
    {
      detail: `${metrics.opportunityCount} research candidates, ${metrics.avoidCount} avoid/risk-review rows, and ${metrics.dangerousCount} elevated-risk symbols are visible in the latest validated scanner packet.`,
      evidenceLabel: `${input.rows.length} scanner rows`,
      id: "daily-prioritization",
      score: metrics.opportunityCount ? Math.round(metrics.averageOpportunity) : null,
      title: "Daily attention map is ranked",
      tone: metrics.dangerousCount > metrics.opportunityCount ? "rose" : metrics.opportunityCount >= 5 ? "emerald" : "cyan",
      values: [metrics.averageOpportunity, metrics.averageConfidence, 100 - metrics.averageFragility, metrics.averageMacro],
    },
    {
      detail: `Market context is ${input.marketCondition ? humanizeLabel(input.marketCondition) : "limited"}. Macro support averages ${Math.round(metrics.averageMacro)}/100 across visible scanner rows.`,
      evidenceLabel: input.scanUpdatedAt ? "latest scan timestamp" : "scan timestamp limited",
      id: "macro-context",
      score: Math.round(metrics.averageMacro),
      title: "Macro context is part of the morning brief",
      tone: metrics.averageMacro >= 60 ? "emerald" : metrics.averageMacro <= 42 ? "rose" : "amber",
      values: [metrics.averageMacro, metrics.averageOpportunity, metrics.averageFragility],
    },
  ];
  if (topOpportunity) {
    items.push({
      detail: `${topOpportunity.symbol} leads the current research queue with score ${Math.round(topOpportunity.final_score ?? 0)}, confidence ${topOpportunity.conviction}/100, and ${topOpportunity.evidence?.label ?? "limited evidence"}.`,
      evidenceLabel: topOpportunity.dataFreshness.humanAge,
      href: `/symbol/${topOpportunity.symbol}`,
      id: `morning-opportunity-${topOpportunity.symbol}`,
      score: topOpportunity.final_score,
      title: `${topOpportunity.symbol} is the strongest monitored setup`,
      tone: "emerald",
      values: [topOpportunity.final_score ?? 0, topOpportunity.conviction, 100 - topOpportunity.fragility, macroScore(topOpportunity)],
    });
  }
  if (topRisk) {
    items.push({
      detail: `${topRisk.symbol} has the clearest risk pressure: fragility ${topRisk.fragility}/100, event pressure ${topRisk.eventRisk}/100, and shock pressure ${shockScore(topRisk)}/100.`,
      evidenceLabel: topRisk.dataFreshness.humanAge,
      href: `/symbol/${topRisk.symbol}`,
      id: `morning-risk-${topRisk.symbol}`,
      score: Math.max(topRisk.fragility, topRisk.eventRisk, shockScore(topRisk)),
      title: `${topRisk.symbol} is the top risk monitor`,
      tone: "rose",
      values: [topRisk.fragility, topRisk.eventRisk, shockScore(topRisk), 100 - macroScore(topRisk)],
    });
  }
  if (watchlistRisk) {
    items.push({
      detail: `${watchlistRisk.symbol} is on the tracked list and now carries elevated fragility or event pressure. Review context before treating it as improving.`,
      evidenceLabel: "watchlist-aware",
      href: `/symbol/${watchlistRisk.symbol}`,
      id: `watchlist-risk-${watchlistRisk.symbol}`,
      score: Math.max(watchlistRisk.fragility, watchlistRisk.eventRisk, shockScore(watchlistRisk)),
      title: "Tracked-symbol risk changed",
      tone: "amber",
      values: [watchlistRisk.conviction, watchlistRisk.fragility, watchlistRisk.eventRisk],
    });
  }
  if (firstWorkflow) items.push(changeToBrief(firstWorkflow, "since-last-visit-leading-change"));
  return items.slice(0, 6);
}

function activeMonitorsFor(input: BuildIntelligenceEcosystemInput, metrics: EcosystemMetrics): EcosystemMonitor[] {
  const improving = input.workflowEvolution?.improvingSetups.length ?? 0;
  const deteriorating = input.workflowEvolution?.deterioratingSetups.length ?? 0;
  const staleCount = input.rows.filter(isStale).length;
  const highShockRows = input.rows.filter((row) => shockScore(row) >= 70);
  const memoryRows = input.rows.filter((row) => memoryScore(row) >= 55);
  return [
    {
      detail: `${metrics.dangerousCount} symbols carry elevated fragility, event, or shock pressure. The system is watching whether risk broadens or narrows.`,
      id: "active-risk-monitor",
      intensity: Math.round(Math.max(metrics.averageFragility, metrics.averageShock)),
      sourceLabel: "fragility + shock",
      title: "Risk pressure monitor",
      tone: metrics.averageFragility >= 64 || metrics.averageShock >= 68 ? "rose" : "amber",
      values: [metrics.averageFragility, metrics.averageShock, metrics.dangerousCount * 10],
    },
    {
      detail: `${improving} improving setup changes and ${deteriorating} deteriorating setup changes are available from workflow memory.`,
      id: "active-evolution-monitor",
      intensity: improving + deteriorating ? Math.min(100, (improving + deteriorating) * 14) : null,
      sourceLabel: "workflow memory",
      title: "Setup evolution monitor",
      tone: deteriorating > improving ? "rose" : improving > deteriorating ? "emerald" : "cyan",
      values: [improving * 20, deteriorating * 20, metrics.averageOpportunity],
    },
    {
      detail: staleCount
        ? `${staleCount} visible setups have stale or low-freshness labels. Confidence should decay until fresh evidence arrives.`
        : "Freshness pressure is not dominating the visible scanner rows.",
      id: "freshness-monitor",
      intensity: staleCount ? Math.min(100, staleCount * 16) : 20,
      sourceLabel: "data freshness",
      title: "Freshness aging monitor",
      tone: staleCount >= 3 ? "amber" : "cyan",
      values: [Math.max(0, 100 - staleCount * 16), metrics.averageEvidence, metrics.averageConfidence],
    },
    {
      detail: highShockRows.length
        ? `${highShockRows.slice(0, 4).map((row) => row.symbol).join(", ")} show elevated shock or large-move pressure.`
        : "Shock context is limited or not elevated across the visible queue.",
      id: "shock-monitor",
      intensity: highShockRows.length ? Math.round(average(highShockRows.map(shockScore), 60)) : null,
      sourceLabel: "shock + event context",
      title: "Large-move condition monitor",
      tone: highShockRows.length ? "rose" : "violet",
      values: highShockRows.length ? highShockRows.slice(0, 6).map(shockScore) : [],
    },
    {
      detail: memoryRows.length
        ? `${memoryRows.slice(0, 4).map((row) => row.symbol).join(", ")} have enough replay or analog context to influence monitoring.`
        : "Validated memory context is still limited. Historical analog references remain conservative.",
      id: "memory-monitor",
      intensity: memoryRows.length ? Math.round(average(memoryRows.map(memoryScore), 50)) : null,
      sourceLabel: "market memory",
      title: "Memory relevance monitor",
      tone: memoryRows.length ? "violet" : "cyan",
      values: memoryRows.length ? memoryRows.slice(0, 6).map(memoryScore) : [],
    },
  ];
}

function feedEvolutionFor(items: IntelligenceFeedItem[]): EcosystemBriefItem[] {
  const selected = items
    .filter((item) => item.itemType !== "opportunity_attention_queue" || item.relatedSymbol)
    .slice(0, 6);
  if (!selected.length) {
    return [{
      detail: "The intelligence feed is still building from validated scanner, alert, and workflow changes.",
      evidenceLabel: "limited feed history",
      id: "feed-limited",
      score: null,
      title: "Feed evolution is waiting for more events",
      tone: "cyan",
      values: [],
    }];
  }
  return selected.map((item) => ({
    detail: `${item.summary} ${item.whyItMatters}`,
    evidenceLabel: `${humanizeLabel(item.category)} · ${item.evidenceLabel}`,
    href: item.actionHref,
    id: `feed-evolution-${item.sourceKey}`,
    score: severityScore(item.severity),
    title: item.title,
    tone: severityTone(item.severity),
    values: [severityScore(item.severity) ?? 0, item.notificationEligible ? 82 : 48],
  }));
}

function sinceLastVisitFor(workflow: WorkflowEvolutionSummary | null): EcosystemBriefItem[] {
  const changes = [
    ...(workflow?.whatChanged ?? []),
    ...(workflow?.watchlistEvolution ?? []),
    ...(workflow?.improvingSetups ?? []),
    ...(workflow?.deterioratingSetups ?? []),
  ];
  const deduped = dedupeChanges(changes).slice(0, 6);
  if (!deduped.length) {
    return [{
      detail: "TradeVeto is creating the baseline required for since-last-visit intelligence. Future sessions will show what improved, weakened, or became stale.",
      evidenceLabel: "baseline building",
      id: "since-last-visit-limited",
      score: null,
      title: "Workflow memory is starting",
      tone: "cyan",
      values: [],
    }];
  }
  return deduped.map((change, index) => changeToBrief(change, `since-last-visit-${index}`));
}

function crossSymbolCognitionFor(input: BuildIntelligenceEcosystemInput, metrics: EcosystemMetrics): CrossSymbolCognition[] {
  const output: CrossSymbolCognition[] = [];
  const sectorGroups = groupRows(input.rows, (row) => cleanText(row.sector, "Unknown"));
  const strongestSector = [...sectorGroups.entries()]
    .map(([sector, rows]) => ({ rows, sector, score: average(rows.map((row) => row.final_score ?? null), 50), fragility: average(rows.map((row) => row.fragility), 50) }))
    .sort((left, right) => right.rows.length - left.rows.length || right.fragility - left.fragility)[0] ?? null;
  if (strongestSector && strongestSector.rows.length >= 2) {
    output.push({
      detail: `${strongestSector.sector} has ${strongestSector.rows.length} visible symbols with average score ${Math.round(strongestSector.score)}/100 and fragility ${Math.round(strongestSector.fragility)}/100. This is cross-symbol context, not a recommendation.`,
      href: "/opportunities",
      id: `sector-cognition-${strongestSector.sector}`,
      score: Math.round(strongestSector.fragility),
      symbols: strongestSector.rows.slice(0, 5).map((row) => row.symbol),
      title: `${strongestSector.sector} cluster is influencing attention`,
      tone: strongestSector.fragility >= 65 ? "rose" : strongestSector.score >= 58 ? "emerald" : "cyan",
    });
  }

  const watchlist = new Set((input.watchlistSymbols ?? []).map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const watchedRows = input.rows.filter((row) => watchlist.has(row.symbol));
  const watchedRisk = watchedRows.filter((row) => row.fragility >= 65 || row.eventRisk >= 68);
  if (watchedRows.length) {
    output.push({
      detail: `${watchedRows.length} tracked symbols appear in the latest scanner packet. ${watchedRisk.length} have elevated fragility or event pressure.`,
      id: "watchlist-cross-symbol-cognition",
      score: watchedRisk.length ? Math.min(100, watchedRisk.length * 20 + metrics.averageFragility * 0.4) : Math.round(metrics.averageConfidence),
      symbols: watchedRows.slice(0, 6).map((row) => row.symbol),
      title: "Watchlist context is connected to scanner state",
      tone: watchedRisk.length ? "amber" : "emerald",
    });
  }

  const macroHeadwinds = input.rows.filter((row) => macroScore(row) <= 42);
  const highMomentumFragile = input.rows.filter((row) => row.conviction >= 62 && (row.fragility >= 68 || row.eventRisk >= 70));
  if (macroHeadwinds.length && highMomentumFragile.length) {
    const symbols = Array.from(new Set([...macroHeadwinds, ...highMomentumFragile].map((row) => row.symbol))).slice(0, 6);
    output.push({
      detail: `Macro alignment is weak for ${macroHeadwinds.length} rows while ${highMomentumFragile.length} higher-confidence setups also carry elevated fragility. TradeVeto is surfacing the contradiction rather than hiding it.`,
      id: "macro-fragility-contradiction",
      score: Math.round(Math.max(metrics.averageFragility, 100 - metrics.averageMacro)),
      symbols,
      title: "Macro pressure and setup fragility are overlapping",
      tone: "rose",
    });
  }

  if (!output.length) {
    output.push({
      detail: "Cross-symbol cognition needs overlapping sector, watchlist, macro, or fragility evidence. Current relationships are limited.",
      id: "cross-symbol-limited",
      score: null,
      symbols: [],
      title: "Relationship map is limited",
      tone: "cyan",
    });
  }
  return output.slice(0, 4);
}

function portfolioAwarenessFor(
  portfolio: PortfolioIntelligenceSystem | null,
  watchlistSymbols: string[],
  metrics: EcosystemMetrics,
): PortfolioEcosystemSignal[] {
  if (portfolio && portfolio.openPositionCount > 0) {
    const topBucket = portfolio.exposureBuckets[0] ?? null;
    const topCluster = portfolio.correlationClusters[0] ?? null;
    return [
      {
        detail: portfolio.summary,
        id: "portfolio-quality",
        score: portfolio.portfolioQualityScore,
        title: `${portfolio.portfolioQualityLabel} portfolio context`,
        tone: portfolio.portfolioQualityScore >= 70 ? "emerald" : portfolio.portfolioQualityScore <= 42 ? "rose" : "amber",
      },
      {
        detail: topBucket
          ? `${topBucket.label} represents ${topBucket.percent}% of open exposure with risk score ${topBucket.riskScore}/100.`
          : "Exposure buckets are limited because open position context is limited.",
        id: "portfolio-exposure",
        score: topBucket?.riskScore ?? null,
        title: "Exposure concentration is monitored",
        tone: topBucket ? exposureTone(topBucket.riskScore) : "cyan",
      },
      {
        detail: topCluster
          ? `${topCluster.reason} Symbols: ${topCluster.symbols.join(", ")}.`
          : portfolio.hiddenCorrelationWarning ?? "No dominant correlation cluster is validated yet.",
        id: "portfolio-correlation",
        score: topCluster?.score ?? portfolio.rollingCorrelationConfidenceScore,
        title: "Correlation and scenario overlap are watched",
        tone: topCluster ? portfolioTone(topCluster.tone) : "cyan",
      },
    ];
  }
  if (watchlistSymbols.length) {
    return [
      {
        detail: `${watchlistSymbols.slice(0, 6).join(", ")} are tracked, but no open paper portfolio exposure is available in this view. Portfolio intelligence is using watchlist context only.`,
        id: "watchlist-portfolio-limited",
        score: Math.round(metrics.watchlistHits ? 58 : 36),
        title: "Portfolio awareness is watchlist-first",
        tone: metrics.watchlistHits ? "cyan" : "amber",
      },
      {
        detail: "Add or maintain paper positions to unlock exposure, concentration, scenario, and correlation context. No broker data is collected here.",
        id: "portfolio-data-boundary",
        score: null,
        title: "Open exposure data is limited",
        tone: "violet",
      },
    ];
  }
  return [{
    detail: "No watchlist or paper portfolio context is available. Ecosystem intelligence can still rank market-wide scanner changes, but personal exposure context is limited.",
    id: "portfolio-unavailable",
    score: null,
    title: "Portfolio awareness is unavailable",
    tone: "cyan",
  }];
}

function notificationIntelligenceFor(items: IntelligenceFeedItem[]): NotificationIntelligenceSignal[] {
  const selected = items
    .filter((item) => item.notificationEligible)
    .slice(0, 5);
  if (!selected.length) {
    return [{
      detail: "No high-signal notification candidate is eligible right now. TradeVeto suppresses low-value updates instead of creating noise.",
      id: "notification-quiet",
      sourceLabel: "suppressed noise",
      title: "Notification layer is quiet",
      tone: "cyan",
    }];
  }
  return selected.map((item) => ({
    detail: `${item.summary} Monitor next: ${item.monitorNext}`,
    href: item.actionHref,
    id: `notification-intelligence-${item.sourceKey}`,
    sourceLabel: `${humanizeLabel(item.category)} · ${item.evidenceLabel}`,
    title: item.title,
    tone: severityTone(item.severity),
  }));
}

function marketWorldFor(input: BuildIntelligenceEcosystemInput, metrics: EcosystemMetrics): MarketWorldSignal[] {
  const sectors = [...groupRows(input.rows, (row) => cleanText(row.sector, "Unknown")).entries()]
    .map(([sector, rows]) => ({
      fragility: average(rows.map((row) => row.fragility), 50),
      macro: average(rows.map((row) => macroScore(row)), 50),
      score: average(rows.map((row) => row.final_score ?? null), 50),
      sector,
      symbols: rows.map((row) => row.symbol),
    }))
    .sort((left, right) => right.score - left.score || right.symbols.length - left.symbols.length);
  const leader = sectors[0] ?? null;
  const pressure = [...sectors].sort((left, right) => right.fragility - left.fragility)[0] ?? null;
  return [
    {
      detail: leader
        ? `${leader.sector} is the current leadership reference with ${leader.symbols.length} visible symbols and average score ${Math.round(leader.score)}/100.`
        : "Sector leadership is unavailable because scanner rows are limited.",
      id: "world-sector-leadership",
      metric: leader ? `${Math.round(leader.score)}/100` : "Limited",
      title: "Sector leadership rotation",
      tone: leader && leader.score >= 60 ? "emerald" : "cyan",
      values: sectors.slice(0, 6).map((sector) => sector.score),
    },
    {
      detail: pressure
        ? `${pressure.sector} has the highest average fragility in the visible scanner universe at ${Math.round(pressure.fragility)}/100.`
        : "Fragility concentration is unavailable.",
      id: "world-fragility-concentration",
      metric: pressure ? `${Math.round(pressure.fragility)}/100` : "Limited",
      title: "Fragility concentration",
      tone: pressure && pressure.fragility >= 65 ? "rose" : "amber",
      values: sectors.slice(0, 6).map((sector) => sector.fragility),
    },
    {
      detail: `Market state is ${input.marketCondition ? humanizeLabel(input.marketCondition) : "limited"} with average macro alignment ${Math.round(metrics.averageMacro)}/100.`,
      id: "world-macro-transition",
      metric: `${Math.round(metrics.averageMacro)}/100`,
      title: "Macro transition model",
      tone: metrics.averageMacro >= 60 ? "emerald" : metrics.averageMacro <= 42 ? "rose" : "amber",
      values: [metrics.averageMacro, metrics.averageOpportunity, 100 - metrics.averageFragility],
    },
    {
      detail: metrics.memoryScore >= 45
        ? `Memory and replay context average ${Math.round(metrics.memoryScore)}/100 across visible setups.`
        : "Replay and analog context are not yet strong enough to dominate the world model.",
      id: "world-memory-drift",
      metric: `${Math.round(metrics.memoryScore)}/100`,
      title: "Memory and analog drift",
      tone: metrics.memoryScore >= 55 ? "violet" : "cyan",
      values: [metrics.memoryScore, metrics.averageEvidence, metrics.averageConfidence],
    },
  ];
}

function changeToBrief(change: WorkflowChangeItem, id: string): EcosystemBriefItem {
  return {
    detail: change.detail,
    evidenceLabel: change.metricLabel,
    href: change.symbol === "WORKFLOW" ? undefined : `/symbol/${change.symbol}`,
    id,
    score: scoreFromMetricLabel(change.metricLabel),
    title: `${change.symbol}: ${change.title}`,
    tone: change.severity === "positive" ? "emerald" : change.severity === "warning" ? "amber" : "cyan",
    values: [scoreFromMetricLabel(change.metricLabel) ?? 50, change.severity === "warning" ? 70 : change.severity === "positive" ? 78 : 50],
  };
}

function firstChange(workflow: WorkflowEvolutionSummary | null): WorkflowChangeItem | null {
  return workflow?.whatChanged[0] ?? workflow?.watchlistEvolution[0] ?? workflow?.deterioratingSetups[0] ?? workflow?.improvingSetups[0] ?? null;
}

function dedupeChanges(changes: WorkflowChangeItem[]): WorkflowChangeItem[] {
  const seen = new Set<string>();
  const output: WorkflowChangeItem[] = [];
  for (const change of changes) {
    const key = `${change.changeType}:${change.symbol}:${change.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(change);
  }
  return output;
}

function topRows(rows: OpportunityViewModel[], scoreFn: (row: OpportunityViewModel) => number, limit: number): OpportunityViewModel[] {
  return [...rows].sort((left, right) => scoreFn(right) - scoreFn(left) || left.symbol.localeCompare(right.symbol)).slice(0, limit);
}

function groupRows(rows: OpportunityViewModel[], keyFn: (row: OpportunityViewModel) => string): Map<string, OpportunityViewModel[]> {
  const groups = new Map<string, OpportunityViewModel[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return groups;
}

function macroScore(row: OpportunityViewModel): number {
  const adjustment = finiteNumber(row.macroAdjustment);
  if (adjustment !== null) return clamp(50 + adjustment);
  const label = row.macroLabel.toLowerCase();
  if (label.includes("support") || label.includes("positive") || label.includes("tailwind")) return 68;
  if (label.includes("weak") || label.includes("negative") || label.includes("headwind")) return 34;
  return 50;
}

function memoryScore(row: OpportunityViewModel): number {
  return clamp(
    Math.max(
      finiteNumber(row.shockPattern?.opportunityScore) ?? 0,
      finiteNumber(row.shockPattern?.asymmetryScore) ?? 0,
      finiteNumber(row.raw.large_move_history_score) ?? 0,
      finiteNumber(row.raw.replay_similarity_score) ?? 0,
      finiteNumber(row.raw.market_memory_score) ?? 0,
    ),
  );
}

function shockScore(row: OpportunityViewModel): number {
  return clamp(
    Math.max(
      finiteNumber(row.shockPattern?.downsideRiskScore) ?? 0,
      finiteNumber(row.shockPattern?.twoSidedVolatilityScore) ?? 0,
      finiteNumber(row.raw.event_shock_pressure_score) ?? 0,
      finiteNumber(row.raw.shock_score) ?? 0,
      row.eventRisk,
    ),
  );
}

function isStale(row: OpportunityViewModel): boolean {
  return /stale|limited|old|aging/i.test(`${row.decayLabel} ${row.dataFreshness.label} ${row.dataFreshness.humanAge}`);
}

function severityScore(severity: string): number | null {
  if (severity === "critical") return 92;
  if (severity === "high") return 84;
  if (severity === "warning") return 72;
  if (severity === "positive") return 76;
  if (severity === "medium") return 60;
  if (severity === "info") return 48;
  return null;
}

function severityTone(severity: string): EcosystemTone {
  if (severity === "critical" || severity === "high") return "rose";
  if (severity === "warning" || severity === "medium") return "amber";
  if (severity === "positive") return "emerald";
  return "cyan";
}

function exposureTone(scoreValue: number): EcosystemTone {
  if (scoreValue >= 70) return "rose";
  if (scoreValue >= 52) return "amber";
  return "emerald";
}

function portfolioTone(tone: PortfolioIntelligenceSystem["correlationClusters"][number]["tone"]): EcosystemTone {
  if (tone === "risk") return "rose";
  if (tone === "warn") return "amber";
  if (tone === "good") return "emerald";
  return "cyan";
}

function scoreFromMetricLabel(label: string): number | null {
  const match = label.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.round(clamp(Math.abs(parsed) * 10)) : null;
}

function cleanSymbol(symbol: string): string | null {
  const text = symbol.trim().toUpperCase();
  return /^[A-Z0-9.-]{1,12}$/.test(text) ? text : null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const numericValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numericValues.length) return fallback;
  return numericValues.reduce((total, value) => total + value, 0) / numericValues.length;
}
