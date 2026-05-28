import type { MarketCommandModel, MarketNewsItem } from "./market-research";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UnifiedConsoleRankedSymbol, UnifiedIntelligenceConsoleModel } from "./unified-intelligence-console";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber, formatMoney } from "@/lib/ui/formatters";

export type DailyCommandTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type DailyCommandRankedItem = {
  actionContext: string;
  companyName: string | null;
  convictionLabel: string;
  dailyMoveLabel: string;
  decision: string;
  detail: string;
  entryContext: string;
  evidenceLabel: string;
  href: string;
  invalidationContext: string;
  macroLabel: string;
  priceLabel: string;
  rank: number;
  replayLabel: string;
  riskRewardContext: string;
  score: number;
  scoreLabel: string;
  sector: string | null;
  setupContext: string;
  symbol: string;
  tone: DailyCommandTone;
  weeklyMoveLabel: string;
  whyItRanks: string;
};

export type DailyMoneyFlowSector = {
  averageReturn1d: number | null;
  averageReturn1w: number | null;
  count: number;
  direction: "leadership" | "mixed" | "pressure";
  leaders: string[];
  opportunityAverage: number | null;
  riskAverage: number | null;
  score: number;
  sector: string;
  tone: DailyCommandTone;
};

export type DailyMoneyFlowTheme = {
  detail: string;
  label: string;
  tone: DailyCommandTone;
  valueLabel: string;
};

export type DailyMarketChange = {
  detail: string;
  label: string;
  metricLabel: string;
  symbol?: string;
  tone: DailyCommandTone;
};

export type DailyDevelopmentCategory =
  | "All"
  | "Analyst"
  | "Crypto"
  | "Dividend"
  | "Earnings"
  | "Energy"
  | "Geopolitical"
  | "High Impact"
  | "Macro"
  | "My Watchlist"
  | "Rates";

export type DailyMarketDevelopment = {
  affectedSectors: string[];
  affectedSymbols: string[];
  bearishImplication: string;
  bullishImplication: string;
  category: Exclude<DailyDevelopmentCategory, "All" | "High Impact" | "My Watchlist">;
  confidenceLabel: string;
  eventTrackingLabel: string;
  freshnessLabel: string;
  freshnessSlaLabel: string;
  headline: string;
  historicalAnalogLabel: string;
  id: string;
  impact: "mixed" | "negative" | "positive" | "unknown";
  latencyLabel: string;
  marketMovingLabel: string;
  original: MarketNewsItem;
  priorityScore: number;
  providerAttribution: string;
  providerState: DailyProviderOperationalState;
  providerStateLabel: string;
  relatedMacroContext: string;
  relatedReplayContext: string;
  macroImpactLabel: string;
  replayLinkageLabel: string;
  researchTypeLabel: string;
  sectorImpactLabel: string;
  source: string;
  sourceCompletenessLabel: string;
  sourceQualityLabel: string;
  strategyLinkageLabel: string;
  sourceUrl: string;
  symbolRelevanceLabel: string;
  timestamp: string;
  timelineBucket: string;
  tone: DailyCommandTone;
  uncertaintyLabel: string;
  urgency: "high" | "low" | "medium";
  watchlistImpact: boolean;
  watchlistImpactReason: string;
  watchlistRelevanceLabel: string;
  whyItMatters: string;
};

export type DailyEventCalendarItem = {
  category: "analyst" | "dividend" | "earnings" | "event" | "geopolitical" | "macro" | "rates";
  date: string;
  detail: string;
  label: string;
  symbol: string;
  tone: DailyCommandTone;
};

export type DailyMacroEventStory = {
  affectedSectors: string[];
  affectedSymbols: string[];
  detail: string;
  drivers: string[];
  id: string;
  label: string;
  tone: DailyCommandTone;
  urgency: DailyMarketDevelopment["urgency"];
};

export type DailySectorNewsCluster = {
  affectedSymbols: string[];
  categories: string[];
  highImpactCount: number;
  itemCount: number;
  latestHeadline: string;
  latestSource: string;
  sector: string;
  tone: DailyCommandTone;
  watchlistImpactCount: number;
};

export type DailySourceTrustField = "affectedSymbols" | "freshness" | "provider" | "providerState" | "sourceUrl" | "timestamp" | "uncertainty" | "watchlistImpact";

export type DailySourceTrustSummary = {
  completeCardCount: number;
  completenessPct: number;
  contextCompleteCardCount: number;
  contextCompletenessPct: number;
  disclosure: string;
  displayedCardCount: number;
  incompleteCardCount: number;
  missingFieldCounts: Record<DailySourceTrustField, number>;
  requiredFields: DailySourceTrustField[];
  status: "fail" | "not-applicable" | "pass";
  targetCompletenessPct: number;
};

export type DailyNewsEcosystemSummary = {
  affectedSectors: string[];
  affectedSymbols: string[];
  analystCount: number;
  calendarCount: number;
  completenessScore: number;
  coverageGaps: string[];
  dividendCount: number;
  earningsCount: number;
  eventTrackingCount: number;
  geopoliticalCount: number;
  highImpactCount: number;
  macroCount: number;
  providerCoverage: string;
  ratesInflationCount: number;
  sectorNewsCount: number;
  sourceCount: number;
  sourceNames: string[];
  sourceTrust: DailySourceTrustSummary;
  symbolNewsCount: number;
  topNarrative: string;
  total: number;
  watchlistImpactCount: number;
};

export type DailyInformationProviderCoverage = {
  category: "company" | "market" | "official";
  itemCount: number;
  latestTimestamp: string | null;
  qualityLabel: string;
  source: string;
  tone: DailyCommandTone;
};

export type DailyProviderCoverageDomain =
  | "analyst-actions"
  | "company-events"
  | "crypto-events"
  | "dividends"
  | "earnings"
  | "economic-calendar"
  | "geopolitical-events"
  | "inflation"
  | "macro"
  | "rates"
  | "sector-events";

export type DailyProviderOperationalState = "active" | "calendar-only" | "delayed" | "limited" | "outage" | "partial-outage" | "stale";
export type DailyProviderFreshnessSlaStatus = "breached" | "not-measured" | "within-sla";

export type DailyProviderStrategyAudit = {
  coverage: "active" | "calendar-only" | "limited";
  disclosure: string;
  domain: DailyProviderCoverageDomain;
  freshness: string;
  freshnessMinutes: number | null;
  freshnessSlaDisclosure: string;
  freshnessSlaMinutes: number | null;
  freshnessSlaStatus: DailyProviderFreshnessSlaStatus;
  itemCount: number;
  latency: string;
  latestTimestamp: string | null;
  limitations: string[];
  operationalState: DailyProviderOperationalState;
  provider: string;
  sourceTransparency: string;
  tone: DailyCommandTone;
};

type ProviderOperationalSignal = {
  domainText: string;
  message: string;
  provider: string;
  status: "fallback" | "outage" | "stale";
  symbol: string;
};

export const SOURCE_TRUST_TARGET_PCT = 99;

const SOURCE_TRUST_REQUIRED_FIELDS: DailySourceTrustField[] = ["sourceUrl", "provider", "timestamp", "freshness", "providerState", "uncertainty"];
const SOURCE_TRUST_CONTEXT_FIELDS: DailySourceTrustField[] = ["affectedSymbols", "watchlistImpact"];
const SOURCE_TRUST_ALL_FIELDS: DailySourceTrustField[] = [...SOURCE_TRUST_REQUIRED_FIELDS, ...SOURCE_TRUST_CONTEXT_FIELDS];

export type DailyInformationEvolutionPoint = {
  categories: string[];
  date: string;
  highImpactCount: number;
  itemCount: number;
  latestHeadline: string;
  sources: string[];
  tone: DailyCommandTone;
  watchlistImpactCount: number;
};

export type DailyCrossAssetEventRelationship = {
  affectedSectors: string[];
  affectedSymbols: string[];
  category: DailyMarketDevelopment["category"];
  headline: string;
  id: string;
  linkedMarketProxies: string[];
  narrative: string;
  relationshipType: string;
  source: string;
  tone: DailyCommandTone;
  urgency: DailyMarketDevelopment["urgency"];
};

export type DailyMacroEventTimelineItem = {
  affectedSectors: string[];
  affectedSymbols: string[];
  category: DailyMarketDevelopment["category"] | DailyEventCalendarItem["category"];
  date: string;
  detail: string;
  id: string;
  relationshipType: string;
  source: string;
  sourceUrl: string | null;
  tone: DailyCommandTone;
};

export type DailyEventDomainTimelineItem = {
  affectedSymbols: string[];
  category: DailyMarketDevelopment["category"] | DailyEventCalendarItem["category"];
  date: string;
  detail: string;
  freshnessLabel: string;
  id: string;
  providerState: DailyProviderOperationalState;
  source: string;
  sourceUrl: string | null;
  tone: DailyCommandTone;
  watchlistImpact: boolean;
};

export type DailyEventDomainTimeline = {
  activeSourceCount: number;
  calendarCount: number;
  domain: DailyProviderCoverageDomain;
  itemCount: number;
  items: DailyEventDomainTimelineItem[];
  label: string;
  providerStateSummary: string;
  tone: DailyCommandTone;
};

export type DailyCompanyEventTimeline = {
  nextEvent: DailyEventCalendarItem | null;
  sourceCount: number;
  symbol: string;
  timeline: Array<{
    category: string;
    detail: string;
    source: string;
    timestamp: string;
    tone: DailyCommandTone;
  }>;
  tone: DailyCommandTone;
};

export type DailyMarketCommandModel = {
  bestSetups: DailyCommandRankedItem[];
  breakoutCandidates: DailyCommandRankedItem[];
  calendar: DailyEventCalendarItem[];
  companyTimelines: DailyCompanyEventTimeline[];
  crashRisk: DailyCommandRankedItem[];
  crossAssetRelationships: DailyCrossAssetEventRelationship[];
  developments: DailyMarketDevelopment[];
  eventDomainTimelines: DailyEventDomainTimeline[];
  generatedAt: string | null;
  hero: {
    attentionScore: number | null;
    dominantOpportunity: string;
    dominantRisk: string;
    marketState: string;
    moneyFlow: string;
    narrative: string;
  };
  macroEventTimeline: DailyMacroEventTimelineItem[];
  macroStorylines: DailyMacroEventStory[];
  moneyFlow: {
    breadthLabel: string;
    sectors: DailyMoneyFlowSector[];
    themes: DailyMoneyFlowTheme[];
  };
  newsEcosystem: DailyNewsEcosystemSummary;
  newsEmptyState: {
    integrationNeeded: string;
    message: string;
  };
  newsEvolution: DailyInformationEvolutionPoint[];
  providerCoverage: DailyInformationProviderCoverage[];
  providerCoverageMatrix: DailyProviderStrategyAudit[];
  providerStrategyAudit: DailyProviderStrategyAudit[];
  sectorNews: DailySectorNewsCluster[];
  watchlistSymbols: string[];
  whatChangedToday: DailyMarketChange[];
};

export function buildDailyMarketCommandModel(input: {
  marketCommand: MarketCommandModel;
  marketCondition?: string | null;
  rankedZones: UnifiedIntelligenceConsoleModel["rankedZones"];
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  now?: Date;
}): DailyMarketCommandModel {
  const rowBySymbol = new Map(input.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const bestSetups = mapRankedItems(input.rankedZones["best-setups"].topSymbols.slice(0, 5), rowBySymbol);
  const breakoutCandidates = mapRankedItems(dedupeRankedSymbols([
    ...input.rankedZones["shock-watch"].topSymbols,
    ...input.rankedZones["volatility-pressure"].topSymbols,
    ...input.rankedZones["replay-context"].topSymbols,
  ]).slice(0, 5), rowBySymbol);
  const crashRisk = mapRankedItems(dedupeRankedSymbols([
    ...input.rankedZones.dangerous.topSymbols,
    ...input.rankedZones["risk-review"].topSymbols,
    ...input.rankedZones["macro-pressure"].topSymbols,
  ]).slice(0, 5), rowBySymbol);
  const moneyFlow = buildMoneyFlow(input.rows);
  const developments = buildDevelopments({
    marketNews: input.marketCommand.macroNews,
    now: input.now ?? new Date(),
    topDangerSymbols: crashRisk.map((item) => item.symbol),
    topOpportunitySymbols: bestSetups.map((item) => item.symbol),
    watchlistSymbols: input.watchlistSymbols ?? [],
  });
  const whatChangedToday = buildWhatChangedToday(input);
  const calendar = buildEventCalendar(input.rows, input.now ?? new Date());
  const newsEcosystem = buildNewsEcosystem(developments, calendar);
  const macroStorylines = buildMacroStorylines(developments, moneyFlow, calendar);
  const macroEventTimeline = buildMacroEventTimeline(developments, calendar);
  const eventDomainTimelines = buildEventDomainTimelines(developments, calendar);
  const sectorNews = buildSectorNewsClusters(developments);
  const providerCoverage = buildProviderCoverage(developments);
  const providerCoverageMatrix = buildProviderStrategyAudit(developments, calendar, input.rows, input.now ?? new Date());
  const newsEvolution = buildInformationEvolution(developments);
  const crossAssetRelationships = buildCrossAssetRelationships(developments, input.marketCommand.barItems.map((item) => item.symbol));
  const companyTimelines = buildCompanyTimelines(developments, calendar);
  const attentionScore = averageNumber([
    bestSetups[0]?.score ?? null,
    breakoutCandidates[0]?.score ?? null,
    crashRisk[0]?.score ?? null,
    input.marketCommand.pressureSummary.pressureScore,
  ]);
  const dominantOpportunity = bestSetups[0]
    ? `${bestSetups[0].symbol} leads setup quality at ${bestSetups[0].score}/100.`
    : "No validated top setup is available in the current scanner packet.";
  const dominantRisk = crashRisk[0]
    ? `${crashRisk[0].symbol} leads downside/risk pressure at ${crashRisk[0].score}/100.`
    : "No validated crash-risk ranking is available in the current scanner packet.";
  const topFlow = moneyFlow.sectors[0];
  const moneyFlowLabel = topFlow
    ? `${topFlow.sector} shows the strongest current flow context.`
    : "Sector money-flow evidence is limited in this snapshot.";

  return {
    bestSetups,
    breakoutCandidates,
    calendar,
    companyTimelines,
    crashRisk,
    crossAssetRelationships,
    developments,
    eventDomainTimelines,
    generatedAt: input.marketCommand.generatedAt,
    hero: {
      attentionScore,
      dominantOpportunity,
      dominantRisk,
      marketState: input.marketCondition ?? "Market state limited",
      moneyFlow: moneyFlowLabel,
      narrative: narrativeFor({
        best: bestSetups[0] ?? null,
        breakout: breakoutCandidates[0] ?? null,
        change: whatChangedToday[0] ?? null,
        risk: crashRisk[0] ?? null,
      }),
    },
    macroEventTimeline,
    macroStorylines,
    moneyFlow,
    newsEcosystem,
    newsEmptyState: {
      integrationNeeded: "Required integration: verified headline, source, source URL, timestamp, affected ticker/sector, and impact fields from a configured market-news provider.",
      message: "News source not configured yet",
    },
    newsEvolution,
    providerCoverage,
    providerCoverageMatrix,
    providerStrategyAudit: providerCoverageMatrix,
    sectorNews,
    watchlistSymbols: (input.watchlistSymbols ?? []).map((symbol) => symbol.toUpperCase()),
    whatChangedToday,
  };
}

function mapRankedItems(items: UnifiedConsoleRankedSymbol[], rowBySymbol: Map<string, OpportunityViewModel>): DailyCommandRankedItem[] {
  return items.map((item) => {
    const row = rowBySymbol.get(item.symbol.toUpperCase()) ?? null;
    return {
      actionContext: item.actionContext,
      companyName: item.companyName,
      convictionLabel: row ? `${row.conviction}/100 · ${row.confidenceLabel}` : "Conviction limited",
      dailyMoveLabel: movementLabel(row?.raw.return_1d ?? row?.raw.price_change_pct),
      decision: item.decision,
      detail: item.detail,
      entryContext: item.entryContext ?? row?.entryZoneLabel ?? "Entry context limited",
      evidenceLabel: row?.evidence?.label ?? cleanText(row?.raw.evidence_maturity, "Evidence limited"),
      href: item.href,
      invalidationContext: invalidationContext(row, item),
      macroLabel: row?.macroLabel ?? "Macro context limited",
      priceLabel: item.priceLabel,
      rank: item.rank,
      replayLabel: replayLabel(row),
      riskRewardContext: item.riskRewardContext ?? "Risk/reward context limited",
      score: item.score,
      scoreLabel: item.scoreLabel,
      sector: item.sector,
      setupContext: item.setupContext,
      symbol: item.symbol,
      tone: item.tone,
      weeklyMoveLabel: movementLabel(row?.raw.return_1w),
      whyItRanks: item.reason,
    };
  });
}

function buildMoneyFlow(rows: OpportunityViewModel[]): DailyMarketCommandModel["moneyFlow"] {
  const bySector = new Map<string, OpportunityViewModel[]>();
  for (const row of rows) {
    const sector = cleanText(row.sector, "Unclassified");
    const current = bySector.get(sector) ?? [];
    current.push(row);
    bySector.set(sector, current);
  }
  const sectors = Array.from(bySector.entries())
    .map(([sector, sectorRows]) => sectorFlow(sector, sectorRows))
    .sort((left, right) => right.score - left.score || right.count - left.count)
    .slice(0, 8);
  const positiveRows = rows.filter((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct) !== null && (normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0) > 0).length;
  const measuredRows = rows.filter((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct) !== null).length;
  const breadthRatio = measuredRows ? Math.round((positiveRows / measuredRows) * 100) : null;
  const strongest = sectors.find((sector) => sector.direction === "leadership") ?? sectors[0];
  const weakest = [...sectors].sort((left, right) => (right.riskAverage ?? 0) - (left.riskAverage ?? 0))[0];
  const aiRows = rows.filter(isAiOrSemiRow);
  const energyRows = rows.filter((row) => /energy|oil|gas/i.test(`${row.sector ?? ""} ${row.raw.industry ?? ""} ${row.symbol}`));
  const themes: DailyMoneyFlowTheme[] = [
    strongest ? {
      detail: `${strongest.leaders.slice(0, 4).join(", ")} are the highest-scored names inside the strongest sector cluster.`,
      label: `Leadership: ${strongest.sector}`,
      tone: strongest.tone,
      valueLabel: scoreLabel(strongest.score),
    } : null,
    weakest ? {
      detail: `${weakest.sector} carries the highest risk/pressure blend among measured sectors.`,
      label: `Pressure: ${weakest.sector}`,
      tone: weakest.riskAverage !== null && weakest.riskAverage >= 65 ? "rose" : "amber",
      valueLabel: weakest.riskAverage === null ? "Limited" : scoreLabel(weakest.riskAverage),
    } : null,
    breadthRatio !== null ? {
      detail: `${positiveRows} of ${measuredRows} symbols with validated daily movement are positive in the latest packet.`,
      label: breadthRatio >= 58 ? "Breadth improving" : breadthRatio <= 42 ? "Breadth weakening" : "Breadth mixed",
      tone: breadthRatio >= 58 ? "emerald" : breadthRatio <= 42 ? "rose" : "amber",
      valueLabel: `${breadthRatio}%`,
    } : null,
    aiRows.length ? themeForCluster("AI / semis", aiRows) : null,
    energyRows.length ? themeForCluster("Energy / oil", energyRows) : null,
  ].filter((item): item is DailyMoneyFlowTheme => item !== null);

  return {
    breadthLabel: breadthRatio === null ? "Breadth unavailable" : `${breadthRatio}% positive daily breadth across measured symbols`,
    sectors,
    themes,
  };
}

function sectorFlow(sector: string, rows: OpportunityViewModel[]): DailyMoneyFlowSector {
  const averageReturn1d = averageNumber(rows.map((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct)));
  const averageReturn1w = averageNumber(rows.map((row) => normalizedPercent(row.raw.return_1w)));
  const opportunityAverage = averageNumber(rows.map((row) => row.final_score ?? row.conviction));
  const riskAverage = averageNumber(rows.map((row) => averageNumber([row.fragility, row.eventRisk, finiteNumber(row.raw.volatility_pressure)])));
  const score = Math.round(clamp((opportunityAverage ?? 45) * 0.48 + positiveMoveScore(averageReturn1d) * 0.26 + (riskAverage === null ? 45 : 100 - riskAverage) * 0.16 + Math.min(100, rows.length * 12) * 0.10));
  const direction = averageReturn1d !== null && averageReturn1d <= -0.3
    ? "pressure"
    : opportunityAverage !== null && opportunityAverage >= 58
      ? "leadership"
      : "mixed";
  return {
    averageReturn1d,
    averageReturn1w,
    count: rows.length,
    direction,
    leaders: rows
      .slice()
      .sort((left, right) => (right.final_score ?? right.conviction) - (left.final_score ?? left.conviction))
      .slice(0, 5)
      .map((row) => row.symbol),
    opportunityAverage,
    riskAverage,
    score,
    sector,
    tone: direction === "leadership" ? "emerald" : direction === "pressure" ? "rose" : "amber",
  };
}

function buildDevelopments(input: {
  marketNews: MarketNewsItem[];
  now: Date;
  topDangerSymbols: string[];
  topOpportunitySymbols: string[];
  watchlistSymbols: string[];
}): DailyMarketDevelopment[] {
  const watchlist = new Set(input.watchlistSymbols.map((symbol) => symbol.toUpperCase()));
  const topSymbols = new Set([...input.topDangerSymbols, ...input.topOpportunitySymbols].map((symbol) => symbol.toUpperCase()));
  const developments = input.marketNews
    .map((item) => {
      const affectedSymbols = item.relatedAssets.map((symbol) => symbol.toUpperCase());
      const watchlistImpact = affectedSymbols.some((symbol) => watchlist.has(symbol));
      const topPriorityImpact = affectedSymbols.some((symbol) => topSymbols.has(symbol));
      const category = newsCategory(item);
      const providerDomain = providerDomainForDevelopment(category);
      const urgency: DailyMarketDevelopment["urgency"] = item.relevance >= 75 || topPriorityImpact ? "high" : item.relevance >= 55 || watchlistImpact ? "medium" : "low";
      const priorityScore = developmentPriorityScore({
        affectedSymbols,
        relevance: item.relevance,
        topDangerSymbols: input.topDangerSymbols,
        topOpportunitySymbols: input.topOpportunitySymbols,
        urgency,
        watchlist,
      });
      const providerState = providerStateForDevelopment(item.publishedAt, input.now, providerDomain);
      return {
        affectedSectors: item.affectedSectors,
        affectedSymbols,
        bearishImplication: item.bearishImplication,
        bullishImplication: item.bullishImplication,
        category,
        confidenceLabel: eventConfidenceLabel(item, providerState),
        eventTrackingLabel: item.eventTrackingLabel,
        freshnessLabel: freshnessLabel(item.publishedAt, input.now),
        freshnessSlaLabel: freshnessSlaLabelForDevelopment(category, item.publishedAt, input.now),
        headline: item.title,
        historicalAnalogLabel: historicalAnalogLabel(item),
        id: item.id,
        impact: impactForDirection(item.direction),
        latencyLabel: providerLatencyLabel(item),
        marketMovingLabel: item.marketMovingLabel,
        original: item,
        priorityScore,
        providerAttribution: providerAttribution(item),
        providerState,
        providerStateLabel: providerStateLabel(providerState),
        relatedMacroContext: item.relatedMacroContext,
        relatedReplayContext: item.relatedReplayContext,
        macroImpactLabel: macroImpactLabel(item),
        replayLinkageLabel: replayLinkageLabel(item),
        researchTypeLabel: researchTypeLabel(item),
        sectorImpactLabel: sectorImpactLabel(item.affectedSectors),
        source: item.source,
        sourceCompletenessLabel: sourceCompletenessLabel(providerState, item),
        sourceQualityLabel: sourceQualityLabel(item),
        strategyLinkageLabel: strategyLinkageLabel({
          affectedSectors: item.affectedSectors,
          affectedSymbols,
          scope: item.scope,
        }),
        sourceUrl: item.sourceUrl,
        symbolRelevanceLabel: symbolRelevanceLabel(affectedSymbols),
        timestamp: item.publishedAt,
        timelineBucket: timelineBucketForDevelopment(category),
        tone: toneForDevelopment(item, watchlistImpact, urgency),
        uncertaintyLabel: uncertaintyLabel(item),
        urgency,
        watchlistImpact,
        watchlistImpactReason: watchlistImpactReason({
          affectedSymbols,
          topDangerSymbols: input.topDangerSymbols,
          topOpportunitySymbols: input.topOpportunitySymbols,
          watchlist,
        }),
        watchlistRelevanceLabel: watchlistRelevanceLabel(affectedSymbols, watchlist),
        whyItMatters: item.whyItMatters,
      };
    });
  return selectProviderDiverseDevelopments(developments, 16);
}

const PROVIDER_DEVELOPMENT_DOMAIN_ORDER: DailyProviderCoverageDomain[] = [
  "macro",
  "rates",
  "inflation",
  "analyst-actions",
  "dividends",
  "geopolitical-events",
  "crypto-events",
  "earnings",
  "company-events",
  "sector-events",
];

function selectProviderDiverseDevelopments(developments: DailyMarketDevelopment[], limit: number): DailyMarketDevelopment[] {
  const sorted = developments.slice().sort(developmentSort);
  const selected: DailyMarketDevelopment[] = [];
  const selectedIds = new Set<string>();
  for (const domain of PROVIDER_DEVELOPMENT_DOMAIN_ORDER) {
    const match = sorted.find((item) => !selectedIds.has(item.id) && developmentMatchesProviderDomain(item, domain));
    if (!match) continue;
    selected.push(match);
    selectedIds.add(match.id);
    if (selected.length >= limit) return selected.sort(developmentSort);
  }
  for (const item of sorted) {
    if (selectedIds.has(item.id)) continue;
    selected.push(item);
    selectedIds.add(item.id);
    if (selected.length >= limit) break;
  }
  return selected.sort(developmentSort);
}

function developmentSort(left: DailyMarketDevelopment, right: DailyMarketDevelopment): number {
  const priority = developmentPriority(right) - developmentPriority(left);
  if (priority !== 0) return priority;
  return Date.parse(right.timestamp) - Date.parse(left.timestamp);
}

function developmentMatchesProviderDomain(item: DailyMarketDevelopment, domain: DailyProviderCoverageDomain): boolean {
  if (domain === "macro") return isMacroProviderDevelopment(item);
  if (domain === "rates") return isRatesProviderDevelopment(item);
  if (domain === "inflation") return isInflationProviderDevelopment(item);
  if (domain === "analyst-actions") return isAnalystProviderDevelopment(item);
  if (domain === "dividends") return isDividendProviderDevelopment(item);
  if (domain === "geopolitical-events") return isGeopoliticalProviderDevelopment(item);
  if (domain === "crypto-events") return isCryptoProviderDevelopment(item);
  if (domain === "earnings") return item.category === "Earnings";
  if (domain === "company-events") return item.affectedSymbols.length > 0 || item.original.scope === "symbol";
  if (domain === "sector-events") return item.affectedSectors.length > 0 || item.original.scope === "sector";
  return false;
}

function buildNewsEcosystem(developments: DailyMarketDevelopment[], calendar: DailyEventCalendarItem[]): DailyNewsEcosystemSummary {
  const sourceNames = uniqueStrings(developments.map((item) => item.source));
  const affectedSymbols = uniqueStrings(developments.flatMap((item) => item.affectedSymbols));
  const affectedSectors = uniqueStrings(developments.flatMap((item) => item.affectedSectors));
  const analystCount = developments.filter((item) => item.category === "Analyst").length;
  const calendarEarningsCount = calendar.filter((item) => item.category === "earnings").length;
  const earningsCount = developments.filter((item) => item.category === "Earnings").length + calendarEarningsCount;
  const geopoliticalCount = developments.filter((item) => item.category === "Geopolitical").length;
  const ratesInflationCount = developments.filter((item) => item.category === "Rates").length;
  const highImpactCount = developments.filter((item) => item.urgency === "high").length;
  const watchlistImpactCount = developments.filter((item) => item.watchlistImpact).length;
  const macroCount = developments.filter((item) => item.category === "Macro" || item.category === "Rates" || item.category === "Energy" || item.category === "Crypto").length;
  const dividendCount = developments.filter((item) => item.category === "Dividend").length + calendar.filter((item) => item.category === "dividend").length;
  const categoryCoverage = new Set(developments.map((item) => item.category));
  const sectorNewsCount = developments.filter((item) => item.affectedSectors.length > 0).length;
  const symbolNewsCount = developments.filter((item) => item.affectedSymbols.length > 0).length;
  const completenessScore = Math.round(clamp(
    Math.min(35, sourceNames.length * 8)
    + Math.min(25, categoryCoverage.size * 4)
    + Math.min(18, affectedSymbols.length * 2)
    + Math.min(12, affectedSectors.length * 3)
    + Math.min(10, calendar.length * 2),
  ));
  const coverageGaps = newsCoverageGaps({
    analystCount,
    calendar,
    developments,
    dividendCount,
    earningsCount,
    geopoliticalCount,
    macroCount,
    ratesInflationCount,
    sourceCount: sourceNames.length,
  });
  const top = developments[0];
  return {
    affectedSectors,
    affectedSymbols,
    analystCount,
    calendarCount: calendar.length,
    completenessScore,
    coverageGaps,
    dividendCount,
    earningsCount,
    eventTrackingCount: developments.length,
    geopoliticalCount,
    highImpactCount,
    macroCount,
    providerCoverage: sourceNames.length >= 4 ? "Broad verified coverage" : sourceNames.length >= 2 ? "Multi-source coverage" : sourceNames.length === 1 ? "Single-source coverage" : "No verified provider coverage",
    ratesInflationCount,
    sectorNewsCount,
    sourceCount: sourceNames.length,
    sourceNames,
    sourceTrust: buildSourceTrustSummary(developments),
    symbolNewsCount,
    topNarrative: top
      ? `${top.category} development from ${top.source}: ${top.whyItMatters}`
      : "No source-linked macro/news developments are available in this scanner packet.",
    total: developments.length,
    watchlistImpactCount,
  };
}

function buildSourceTrustSummary(developments: DailyMarketDevelopment[]): DailySourceTrustSummary {
  const missingFieldCounts = SOURCE_TRUST_ALL_FIELDS.reduce<Record<DailySourceTrustField, number>>((counts, field) => {
    counts[field] = 0;
    return counts;
  }, {
    affectedSymbols: 0,
    freshness: 0,
    provider: 0,
    providerState: 0,
    sourceUrl: 0,
    timestamp: 0,
    uncertainty: 0,
    watchlistImpact: 0,
  });
  if (!developments.length) {
    return {
      completeCardCount: 0,
      completenessPct: 0,
      contextCompleteCardCount: 0,
      contextCompletenessPct: 0,
      disclosure: "No source-linked event cards are displayed; provider depth is not proven for this packet.",
      displayedCardCount: 0,
      incompleteCardCount: 0,
      missingFieldCounts,
      requiredFields: SOURCE_TRUST_REQUIRED_FIELDS,
      status: "not-applicable",
      targetCompletenessPct: SOURCE_TRUST_TARGET_PCT,
    };
  }

  let completeCardCount = 0;
  let contextCompleteCardCount = 0;
  for (const item of developments) {
    const missing = missingSourceTrustFields(item, SOURCE_TRUST_REQUIRED_FIELDS);
    const contextMissing = missingSourceTrustFields(item, SOURCE_TRUST_ALL_FIELDS);
    if (!missing.length) completeCardCount += 1;
    if (!contextMissing.length) contextCompleteCardCount += 1;
    for (const field of contextMissing) {
      missingFieldCounts[field] += 1;
    }
  }
  const completenessPct = Math.round((completeCardCount / developments.length) * 100);
  const contextCompletenessPct = Math.round((contextCompleteCardCount / developments.length) * 100);
  return {
    completeCardCount,
    completenessPct,
    contextCompleteCardCount,
    contextCompletenessPct,
    disclosure: completenessPct >= SOURCE_TRUST_TARGET_PCT && contextCompletenessPct >= SOURCE_TRUST_TARGET_PCT
      ? `${completeCardCount} of ${developments.length} displayed source-linked event cards disclose provider, source URL, timestamp, freshness, provider state, uncertainty, affected symbols/sectors, and watchlist impact.`
      : `${developments.length - completeCardCount} displayed event card${developments.length - completeCardCount === 1 ? "" : "s"} miss required source/provider/timestamp/freshness/provider-state/uncertainty fields; ${developments.length - contextCompleteCardCount} miss full context fields. Target is ${SOURCE_TRUST_TARGET_PCT}%.`,
    displayedCardCount: developments.length,
    incompleteCardCount: developments.length - completeCardCount,
    missingFieldCounts,
    requiredFields: SOURCE_TRUST_REQUIRED_FIELDS,
    status: completenessPct >= SOURCE_TRUST_TARGET_PCT && contextCompletenessPct >= SOURCE_TRUST_TARGET_PCT ? "pass" : "fail",
    targetCompletenessPct: SOURCE_TRUST_TARGET_PCT,
  };
}

function missingSourceTrustFields(item: DailyMarketDevelopment, fields: DailySourceTrustField[]): DailySourceTrustField[] {
  const missing: DailySourceTrustField[] = [];
  for (const field of fields) {
    if (field === "affectedSymbols" && item.affectedSymbols.length === 0 && item.affectedSectors.length === 0) missing.push(field);
    if (field === "freshness" && (!item.freshnessLabel || /timestamp unavailable/i.test(item.freshnessLabel))) missing.push(field);
    if (field === "provider" && !item.providerAttribution.trim()) missing.push(field);
    if (field === "providerState" && (!item.providerState || !item.providerStateLabel.trim())) missing.push(field);
    if (field === "sourceUrl" && !/^https?:\/\//i.test(item.sourceUrl)) missing.push(field);
    if (field === "timestamp" && !Number.isFinite(Date.parse(item.timestamp))) missing.push(field);
    if (field === "uncertainty" && !item.uncertaintyLabel.trim()) missing.push(field);
    if (field === "watchlistImpact" && !item.watchlistImpactReason.trim()) missing.push(field);
  }
  return missing;
}

function buildMacroStorylines(developments: DailyMarketDevelopment[], moneyFlow: DailyMarketCommandModel["moneyFlow"], calendar: DailyEventCalendarItem[]): DailyMacroEventStory[] {
  const stories: DailyMacroEventStory[] = [];
  const groups: Array<{ id: string; label: string; match: (item: DailyMarketDevelopment) => boolean; tone: DailyCommandTone }> = [
    { id: "rates-inflation", label: "Rates and inflation pressure", match: (item) => item.category === "Rates", tone: "amber" },
    { id: "geopolitical-risk", label: "Geopolitical risk awareness", match: (item) => item.category === "Geopolitical", tone: "rose" },
    { id: "earnings-catalysts", label: "Earnings and company catalysts", match: (item) => item.category === "Earnings" || item.category === "Analyst" || item.category === "Dividend", tone: "violet" },
    { id: "cross-asset-macro", label: "Cross-asset macro context", match: (item) => ["Macro", "Energy", "Crypto"].includes(item.category), tone: "cyan" },
  ];
  for (const group of groups) {
    const matches = developments.filter(group.match);
    if (!matches.length) continue;
    const highest = matches[0];
    stories.push({
      affectedSectors: uniqueStrings(matches.flatMap((item) => item.affectedSectors)),
      affectedSymbols: uniqueStrings(matches.flatMap((item) => item.affectedSymbols)),
      detail: `${matches.length} source-linked ${group.label.toLowerCase()} item${matches.length === 1 ? "" : "s"} are active. ${highest?.whyItMatters ?? ""}`,
      drivers: uniqueStrings(matches.flatMap((item) => [item.sourceQualityLabel, item.marketMovingLabel, item.watchlistImpactReason])),
      id: group.id,
      label: group.label,
      tone: matches.some((item) => item.urgency === "high") ? "rose" : group.tone,
      urgency: matches.some((item) => item.urgency === "high") ? "high" : matches.some((item) => item.urgency === "medium") ? "medium" : "low",
    });
  }
  const topFlow = moneyFlow.sectors[0];
  if (topFlow) {
    stories.push({
      affectedSectors: [topFlow.sector],
      affectedSymbols: topFlow.leaders,
      detail: `${topFlow.sector} is the highest-ranked money-flow cluster with ${topFlow.leaders.slice(0, 4).join(", ") || "limited symbol detail"}.`,
      drivers: [`${topFlow.score}/100 flow score`, `${topFlow.count} measured symbols`, `1D ${topFlow.averageReturn1d === null ? "limited" : `${topFlow.averageReturn1d.toFixed(2)}%`}`],
      id: "sector-leadership",
      label: "Sector leadership and pressure",
      tone: topFlow.tone,
      urgency: topFlow.direction === "pressure" ? "medium" : "low",
    });
  }
  const calendarUrgent = calendar.filter((item) => item.category === "earnings" || item.category === "rates" || item.category === "geopolitical").slice(0, 4);
  if (calendarUrgent.length) {
    stories.push({
      affectedSectors: [],
      affectedSymbols: uniqueStrings(calendarUrgent.map((item) => item.symbol)),
      detail: `${calendarUrgent.length} validated event-calendar catalyst${calendarUrgent.length === 1 ? "" : "s"} are scheduled in the next 7 days.`,
      drivers: calendarUrgent.map((item) => `${item.symbol}: ${item.category}`),
      id: "next-seven-days",
      label: "Next 7 days event risk",
      tone: calendarUrgent.some((item) => item.tone === "rose") ? "rose" : "amber",
      urgency: "medium",
    });
  }
  return stories.slice(0, 5);
}

function buildSectorNewsClusters(developments: DailyMarketDevelopment[]): DailySectorNewsCluster[] {
  const bySector = new Map<string, DailyMarketDevelopment[]>();
  for (const item of developments) {
    const sectors = item.affectedSectors.length ? item.affectedSectors : ["Cross-market"];
    for (const sector of sectors) {
      const current = bySector.get(sector) ?? [];
      current.push(item);
      bySector.set(sector, current);
    }
  }
  return Array.from(bySector.entries())
    .map(([sector, items]) => {
      const highImpactCount = items.filter((item) => item.urgency === "high").length;
      const watchlistImpactCount = items.filter((item) => item.watchlistImpact).length;
      const latest = items.slice().sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0];
      const tone: DailyCommandTone = highImpactCount ? "rose" : watchlistImpactCount ? "cyan" : items.some((item) => item.tone === "emerald") ? "emerald" : "amber";
      return {
        affectedSymbols: uniqueStrings(items.flatMap((item) => item.affectedSymbols)),
        categories: uniqueStrings(items.map((item) => item.category)),
        highImpactCount,
        itemCount: items.length,
        latestHeadline: latest?.headline ?? "Limited headline detail",
        latestSource: latest?.source ?? "Source limited",
        sector,
        tone,
        watchlistImpactCount,
      };
    })
    .sort((left, right) => right.highImpactCount - left.highImpactCount || right.watchlistImpactCount - left.watchlistImpactCount || right.itemCount - left.itemCount)
    .slice(0, 6);
}

function buildProviderCoverage(developments: DailyMarketDevelopment[]): DailyInformationProviderCoverage[] {
  const bySource = new Map<string, DailyMarketDevelopment[]>();
  for (const item of developments) {
    const current = bySource.get(item.source) ?? [];
    current.push(item);
    bySource.set(item.source, current);
  }
  return Array.from(bySource.entries())
    .map(([source, items]) => {
      const latest = items.slice().sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0] ?? null;
      const qualityLabel = latest?.sourceQualityLabel ?? "Verified source-linked item";
      const category = providerCategory(qualityLabel, source);
      const highImpact = items.some((item) => item.urgency === "high");
      const tone: DailyCommandTone = highImpact ? "rose" : category === "official" ? "cyan" : category === "company" ? "violet" : "emerald";
      return {
        category,
        itemCount: items.length,
        latestTimestamp: latest?.timestamp ?? null,
        qualityLabel,
        source,
        tone,
      };
    })
    .sort((left, right) => providerRank(left.category) - providerRank(right.category) || right.itemCount - left.itemCount)
    .slice(0, 8);
}

function buildInformationEvolution(developments: DailyMarketDevelopment[]): DailyInformationEvolutionPoint[] {
  const byDate = new Map<string, DailyMarketDevelopment[]>();
  for (const item of developments) {
    const date = dayKey(item.timestamp);
    if (!date) continue;
    const current = byDate.get(date) ?? [];
    current.push(item);
    byDate.set(date, current);
  }
  return Array.from(byDate.entries())
    .map(([date, items]) => {
      const sorted = items.slice().sort((left, right) => developmentPriority(right) - developmentPriority(left));
      const highImpactCount = items.filter((item) => item.urgency === "high").length;
      const watchlistImpactCount = items.filter((item) => item.watchlistImpact).length;
      const tone: DailyCommandTone = highImpactCount ? "rose" : watchlistImpactCount ? "cyan" : items.some((item) => item.impact === "positive") ? "emerald" : "amber";
      return {
        categories: uniqueStrings(items.map((item) => item.category)),
        date,
        highImpactCount,
        itemCount: items.length,
        latestHeadline: sorted[0]?.headline ?? "Limited headline detail",
        sources: uniqueStrings(items.map((item) => item.source)),
        tone,
        watchlistImpactCount,
      };
    })
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 7);
}

function buildCrossAssetRelationships(developments: DailyMarketDevelopment[], marketProxySymbols: string[]): DailyCrossAssetEventRelationship[] {
  const availableProxies = new Set(marketProxySymbols.map((symbol) => symbol.toUpperCase()));
  return developments
    .map((item) => {
      const linkedMarketProxies = linkedProxiesForDevelopment(item).filter((symbol) => availableProxies.has(symbol));
      const affectedSymbols = uniqueStrings(item.affectedSymbols);
      const affectedSectors = uniqueStrings(item.affectedSectors);
      if (!linkedMarketProxies.length && affectedSymbols.length < 2 && affectedSectors.length === 0) return null;
      return {
        affectedSectors,
        affectedSymbols,
        category: item.category,
        headline: item.headline,
        id: item.id,
        linkedMarketProxies,
        narrative: relationshipNarrative(item, linkedMarketProxies),
        relationshipType: crossAssetRelationshipType(item),
        source: item.source,
        tone: item.tone,
        urgency: item.urgency,
      };
    })
    .filter((item): item is DailyCrossAssetEventRelationship => item !== null)
    .sort((left, right) => {
      const priority = urgencyRank(right.urgency) - urgencyRank(left.urgency);
      if (priority !== 0) return priority;
      return (right.linkedMarketProxies.length + right.affectedSymbols.length) - (left.linkedMarketProxies.length + left.affectedSymbols.length);
    })
    .slice(0, 6);
}

function buildMacroEventTimeline(developments: DailyMarketDevelopment[], calendar: DailyEventCalendarItem[]): DailyMacroEventTimelineItem[] {
  const developmentItems = developments
    .filter((item) => ["Crypto", "Energy", "Geopolitical", "Macro", "Rates"].includes(item.category))
    .map((item): DailyMacroEventTimelineItem => ({
      affectedSectors: item.affectedSectors,
      affectedSymbols: item.affectedSymbols,
      category: item.category,
      date: item.timestamp,
      detail: `${item.headline}. ${item.whyItMatters}`,
      id: `development:${item.id}`,
      relationshipType: crossAssetRelationshipType(item),
      source: item.providerAttribution,
      sourceUrl: item.sourceUrl,
      tone: item.tone,
    }));
  const calendarItems = calendar
    .filter((item) => item.category === "geopolitical" || item.category === "macro" || item.category === "rates")
    .map((item): DailyMacroEventTimelineItem => ({
      affectedSectors: [],
      affectedSymbols: item.symbol === "MARKET" ? [] : [item.symbol],
      category: item.category,
      date: item.date,
      detail: `${item.label}. ${item.detail}`,
      id: `calendar:${item.symbol}:${item.category}:${item.date}`,
      relationshipType: calendarRelationshipType(item),
      source: "Stored event calendar",
      sourceUrl: null,
      tone: item.tone,
    }));
  return dedupeMacroTimeline([...developmentItems, ...calendarItems])
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 10);
}

function isInflationProviderDevelopment(item: DailyMarketDevelopment): boolean {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.eventTrackingLabel} ${item.original.eventType} ${item.original.reasonCodes.join(" ")} ${item.relatedMacroContext}`.toLowerCase();
  if (hasInflationLanguage(text)) return true;
  return /\boil supply\b|\boil shock\b|\benergy supply\b|\bcommodity pressure\b|\bcommodity\b|\bcommodities\b|\bcrude\b|\bcotton\b|\bsugar\b|\bcocoa\b|\bcorn\b|\bwheat\b|event_oil_supply_shock/.test(text);
}

function isMacroProviderDevelopment(item: DailyMarketDevelopment): boolean {
  return item.category === "Macro"
    || item.category === "Rates"
    || item.category === "Energy"
    || item.category === "Geopolitical"
    || item.original.scope === "market"
    || item.original.scope === "broad";
}

function isRatesProviderDevelopment(item: DailyMarketDevelopment): boolean {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.eventTrackingLabel} ${item.original.eventType} ${item.original.reasonCodes.join(" ")} ${item.relatedMacroContext}`.toLowerCase();
  return item.category === "Rates" || /\bfed\b|\brate\b|\brates\b|\byield\b|\bbond\b|\btreasury\b|event_fed_rates|event_rate_pressure/.test(text);
}

function isAnalystProviderDevelopment(item: DailyMarketDevelopment): boolean {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.eventTrackingLabel} ${item.original.eventType} ${item.original.reasonCodes.join(" ")}`.toLowerCase();
  return item.category === "Analyst" || /\banalyst\b|\bupgrade\b|\bdowngrade\b|price target|\binitiated\b|\brating\b|event_analyst_action/.test(text);
}

function isDividendProviderDevelopment(item: DailyMarketDevelopment): boolean {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.eventTrackingLabel} ${item.original.eventType} ${item.original.reasonCodes.join(" ")}`.toLowerCase();
  return item.category === "Dividend" || /\bdividend\b|ex-dividend|\bpayout\b|event_dividend/.test(text);
}

function isGeopoliticalProviderDevelopment(item: DailyMarketDevelopment): boolean {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.eventTrackingLabel} ${item.original.eventType} ${item.original.reasonCodes.join(" ")} ${item.affectedSectors.join(" ")}`.toLowerCase();
  return item.category === "Geopolitical" || /\bwar\b|\bpeace\b|geopolitical|sanction|conflict|iran|hormuz|defense|event_geopolitical/.test(text);
}

function isCryptoProviderDevelopment(item: DailyMarketDevelopment): boolean {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.eventTrackingLabel} ${item.original.eventType} ${item.original.reasonCodes.join(" ")} ${item.source} ${item.affectedSymbols.join(" ")}`.toLowerCase();
  return item.category === "Crypto" || /\bcrypto\b|\bbtc\b|bitcoin|coinbase|coindesk|event_crypto/.test(text);
}

function buildEventDomainTimelines(developments: DailyMarketDevelopment[], calendar: DailyEventCalendarItem[]): DailyEventDomainTimeline[] {
  const domains: Array<{
    domain: DailyProviderCoverageDomain;
    label: string;
    matchCalendar: (item: DailyEventCalendarItem) => boolean;
    matchDevelopment: (item: DailyMarketDevelopment) => boolean;
  }> = [
    { domain: "inflation", label: "Inflation timeline", matchCalendar: (item) => item.category === "rates" && hasInflationLanguage(`${item.label} ${item.detail}`), matchDevelopment: isInflationProviderDevelopment },
    { domain: "rates", label: "Rates timeline", matchCalendar: (item) => item.category === "rates", matchDevelopment: isRatesProviderDevelopment },
    { domain: "analyst-actions", label: "Analyst revision timeline", matchCalendar: (item) => item.category === "analyst", matchDevelopment: isAnalystProviderDevelopment },
    { domain: "dividends", label: "Dividend timeline", matchCalendar: (item) => item.category === "dividend", matchDevelopment: isDividendProviderDevelopment },
    { domain: "earnings", label: "Earnings and guidance timeline", matchCalendar: (item) => item.category === "earnings", matchDevelopment: (item) => item.category === "Earnings" },
    { domain: "geopolitical-events", label: "Geopolitical timeline", matchCalendar: (item) => item.category === "geopolitical", matchDevelopment: isGeopoliticalProviderDevelopment },
    { domain: "crypto-events", label: "Crypto event timeline", matchCalendar: (item) => /crypto|btc|bitcoin/i.test(`${item.label} ${item.detail} ${item.symbol}`), matchDevelopment: isCryptoProviderDevelopment },
    { domain: "economic-calendar", label: "Economic calendar timeline", matchCalendar: () => true, matchDevelopment: (item) => ["Energy", "Geopolitical", "Macro", "Rates"].includes(item.category) || isMacroProviderDevelopment(item) },
    { domain: "sector-events", label: "Sector event continuity", matchCalendar: () => false, matchDevelopment: (item) => item.affectedSectors.length > 0 || item.original.scope === "sector" },
    { domain: "company-events", label: "Company event continuity", matchCalendar: (item) => ["analyst", "dividend", "earnings", "event"].includes(item.category), matchDevelopment: (item) => item.affectedSymbols.length > 0 || item.original.scope === "symbol" },
    { domain: "macro", label: "Macro event timeline", matchCalendar: (item) => item.category === "macro" || item.category === "rates" || item.category === "geopolitical", matchDevelopment: isMacroProviderDevelopment },
  ];
  return domains
    .map((domain) => {
      const developmentItems = developments.filter(domain.matchDevelopment).map((item): DailyEventDomainTimelineItem => ({
        affectedSymbols: item.affectedSymbols,
        category: item.category,
        date: item.timestamp,
        detail: `${item.headline}. ${item.whyItMatters}`,
        freshnessLabel: `${item.freshnessLabel} · ${item.freshnessSlaLabel}`,
        id: `development:${domain.domain}:${item.id}`,
        providerState: item.providerState,
        source: item.providerAttribution,
        sourceUrl: item.sourceUrl,
        tone: item.tone,
        watchlistImpact: item.watchlistImpact,
      }));
      const calendarItems = calendar.filter(domain.matchCalendar).map((item): DailyEventDomainTimelineItem => ({
        affectedSymbols: item.symbol === "MARKET" ? [] : [item.symbol],
        category: item.category,
        date: item.date,
        detail: `${item.label}. ${item.detail}`,
        freshnessLabel: "Calendar-only; source-linked freshness not measured",
        id: `calendar:${domain.domain}:${item.symbol}:${item.category}:${item.date}`,
        providerState: "calendar-only",
        source: "Stored event calendar",
        sourceUrl: null,
        tone: item.tone,
        watchlistImpact: false,
      }));
      const items = dedupeEventDomainTimeline([...developmentItems, ...calendarItems])
        .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
        .slice(0, 8);
      if (!items.length) return null;
      const activeSourceCount = developmentItems.length;
      const calendarCount = calendarItems.length;
      const providerStates = uniqueStrings(items.map((item) => item.providerState));
      const highRisk = items.some((item) => item.tone === "rose");
      return {
        activeSourceCount,
        calendarCount,
        domain: domain.domain,
        itemCount: items.length,
        items,
        label: domain.label,
        providerStateSummary: providerStates.join(", ").replace(/-/g, " "),
        tone: highRisk ? "rose" : activeSourceCount ? "emerald" : "amber",
      };
    })
    .filter((item): item is DailyEventDomainTimeline => item !== null)
    .sort((left, right) => right.activeSourceCount - left.activeSourceCount || right.itemCount - left.itemCount)
    .slice(0, domains.length);
}

function buildCompanyTimelines(developments: DailyMarketDevelopment[], calendar: DailyEventCalendarItem[]): DailyCompanyEventTimeline[] {
  const symbols = uniqueStrings([
    ...developments.flatMap((item) => item.affectedSymbols),
    ...calendar.map((item) => item.symbol),
  ]);
  return symbols
    .map((symbol) => {
      const newsItems = developments.filter((item) => item.affectedSymbols.includes(symbol));
      const calendarItems = calendar.filter((item) => item.symbol === symbol);
      const timeline = [
        ...newsItems.map((item) => ({
          category: item.category,
          detail: item.headline,
          source: item.source,
          timestamp: item.timestamp,
          tone: item.tone,
        })),
        ...calendarItems.map((item) => ({
          category: item.category,
          detail: item.label,
          source: "Stored event calendar",
          timestamp: item.date,
          tone: item.tone,
        })),
      ]
        .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
        .slice(0, 5);
      const nextEvent = calendarItems.slice().sort((left, right) => Date.parse(left.date) - Date.parse(right.date))[0] ?? null;
      const highRisk = newsItems.some((item) => item.urgency === "high" || item.tone === "rose");
      const tone: DailyCommandTone = highRisk ? "rose" : nextEvent ? "amber" : newsItems.some((item) => item.tone === "emerald") ? "emerald" : "cyan";
      return {
        nextEvent,
        sourceCount: uniqueStrings(newsItems.map((item) => item.source)).length,
        symbol,
        timeline,
        tone,
      };
    })
    .filter((item) => item.timeline.length > 0)
    .sort((left, right) => right.timeline.length - left.timeline.length || Number(Boolean(right.nextEvent)) - Number(Boolean(left.nextEvent)))
    .slice(0, 6);
}

function buildProviderStrategyAudit(developments: DailyMarketDevelopment[], calendar: DailyEventCalendarItem[], rows: OpportunityViewModel[], now: Date): DailyProviderStrategyAudit[] {
  const operationalSignals = providerOperationalSignals(rows);
  const domains: Array<{ domain: DailyProviderCoverageDomain; label: string; matchCalendar: (item: DailyEventCalendarItem) => boolean; matchDevelopment: (item: DailyMarketDevelopment) => boolean }> = [
    { domain: "macro", label: "Macro", matchCalendar: (item) => item.category === "macro", matchDevelopment: isMacroProviderDevelopment },
    { domain: "inflation", label: "Inflation", matchCalendar: (item) => item.category === "rates" && hasInflationLanguage(`${item.label} ${item.detail}`), matchDevelopment: isInflationProviderDevelopment },
    { domain: "rates", label: "Rates", matchCalendar: (item) => item.category === "rates", matchDevelopment: isRatesProviderDevelopment },
    { domain: "earnings", label: "Earnings", matchCalendar: (item) => item.category === "earnings", matchDevelopment: (item) => item.category === "Earnings" },
    { domain: "analyst-actions", label: "Analyst actions", matchCalendar: (item) => item.category === "analyst", matchDevelopment: isAnalystProviderDevelopment },
    { domain: "dividends", label: "Dividends", matchCalendar: (item) => item.category === "dividend", matchDevelopment: isDividendProviderDevelopment },
    { domain: "geopolitical-events", label: "Geopolitical events", matchCalendar: (item) => item.category === "geopolitical", matchDevelopment: isGeopoliticalProviderDevelopment },
    { domain: "economic-calendar", label: "Economic calendar", matchCalendar: () => true, matchDevelopment: (item) => ["Energy", "Geopolitical", "Macro", "Rates"].includes(item.category) },
    { domain: "company-events", label: "Company events", matchCalendar: (item) => ["analyst", "dividend", "earnings", "event"].includes(item.category), matchDevelopment: (item) => item.affectedSymbols.length > 0 || item.original.scope === "symbol" },
    { domain: "sector-events", label: "Sector events", matchCalendar: () => false, matchDevelopment: (item) => item.affectedSectors.length > 0 || item.original.scope === "sector" },
    { domain: "crypto-events", label: "Crypto events", matchCalendar: (item) => /crypto|btc|bitcoin/i.test(`${item.label} ${item.detail} ${item.symbol}`), matchDevelopment: isCryptoProviderDevelopment },
  ];
  return domains.map((domain) => {
    const matchingDevelopments = developments.filter(domain.matchDevelopment);
    const matchingCalendar = calendar.filter(domain.matchCalendar);
    const latestDevelopment = matchingDevelopments.slice().sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0] ?? null;
    const latestCalendar = matchingCalendar.slice().sort((left, right) => Date.parse(right.date) - Date.parse(left.date))[0] ?? null;
    const sourceNames = uniqueStrings(matchingDevelopments.map((item) => item.source));
    const coverage: DailyProviderStrategyAudit["coverage"] = matchingDevelopments.length ? "active" : matchingCalendar.length ? "calendar-only" : "limited";
    const outageSignals = operationalSignals.filter((signal) => domainMatchesSignal(domain.domain, domain.label, signal));
    const freshnessMinutes = latestDevelopment ? minutesSince(latestDevelopment.timestamp, now) : null;
    const freshnessSlaMinutes = providerDomainSlaMinutes(domain.domain);
    const operationalState = providerOperationalState({
      coverage,
      freshnessMinutes,
      activeWindowMinutes: providerDomainActiveWindowMinutes(domain.domain),
      hasOutageSignal: outageSignals.some((signal) => signal.status === "outage"),
      hasStaleSignal: outageSignals.some((signal) => signal.status === "stale"),
    });
    const limitations = providerAuditLimitations({
      coverage,
      domain: domain.label,
      hasCalendar: matchingCalendar.length > 0,
      hasSourceLinked: matchingDevelopments.length > 0,
      operationalState,
    });
    const provider = sourceNames.length
      ? sourceNames.join(", ")
      : outageSignals.length
        ? outageSignals[0]?.provider ?? "Provider"
        : matchingCalendar.length
          ? "Stored event calendar"
          : "Provider not configured";
    return {
      coverage,
      disclosure: providerOperationalDisclosure({
        coverage,
        domain: domain.label,
        freshnessMinutes,
        operationalState,
        outageMessage: outageSignals[0]?.message ?? null,
      }),
      domain: domain.domain,
      freshness: latestDevelopment?.freshnessLabel ?? (latestCalendar ? `Calendar date available: ${latestCalendar.date.slice(0, 10)}` : "No source-linked timestamp available"),
      freshnessMinutes,
      freshnessSlaDisclosure: providerFreshnessSlaDisclosure({
        coverage,
        domain: domain.label,
        freshnessMinutes,
        operationalState,
        slaMinutes: freshnessSlaMinutes,
      }),
      freshnessSlaMinutes,
      freshnessSlaStatus: providerFreshnessSlaStatus({
        coverage,
        freshnessMinutes,
        operationalState,
        slaMinutes: freshnessSlaMinutes,
      }),
      itemCount: matchingDevelopments.length + matchingCalendar.length,
      latency: latestDevelopment?.latencyLabel ?? (matchingCalendar.length ? "Calendar packet latency not instrumented" : "No provider latency available"),
      latestTimestamp: latestDevelopment?.timestamp ?? latestCalendar?.date ?? null,
      limitations,
      operationalState,
      provider,
      sourceTransparency: sourceNames.length
        ? `Source-linked rows: ${sourceNames.join(", ")}.`
        : outageSignals.length
          ? `Raw provider status: ${outageSignals[0]?.message ?? "unavailable"}.`
          : matchingCalendar.length
            ? "Calendar-only stored scanner/fundamental fields; no source URL is attached."
            : "No source-linked provider rows found; TradeVeto does not infer missing events.",
      tone: toneForProviderState(operationalState, matchingDevelopments.some((item) => item.urgency === "high")),
    };
  });
}

function watchlistImpactReason(input: {
  affectedSymbols: string[];
  topDangerSymbols: string[];
  topOpportunitySymbols: string[];
  watchlist: Set<string>;
}): string {
  const watchlistMatches = input.affectedSymbols.filter((symbol) => input.watchlist.has(symbol));
  if (watchlistMatches.length) return `Affects tracked symbols: ${watchlistMatches.slice(0, 6).join(", ")}.`;
  const opportunityMatches = input.affectedSymbols.filter((symbol) => input.topOpportunitySymbols.includes(symbol));
  if (opportunityMatches.length) return `Affects top opportunity candidates: ${opportunityMatches.slice(0, 6).join(", ")}.`;
  const riskMatches = input.affectedSymbols.filter((symbol) => input.topDangerSymbols.includes(symbol));
  if (riskMatches.length) return `Affects top risk-review candidates: ${riskMatches.slice(0, 6).join(", ")}.`;
  return "Market-level context; no direct watchlist match in the current packet.";
}

function providerAttribution(item: MarketNewsItem): string {
  return `${sourceQualityLabel(item)} · ${item.source}`;
}

function freshnessLabel(timestamp: string, now: Date): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "Timestamp unavailable";
  const ageMs = now.getTime() - parsed;
  if (ageMs < -60000) return "Future-dated provider timestamp";
  const minutes = Math.max(0, Math.round(ageMs / 60000));
  if (minutes < 60) return `Fresh · ${minutes}m old`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Recent · ${hours}h old`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `Aging · ${days}d old`;
  return `Stale · ${days}d old`;
}

function providerStateForDevelopment(timestamp: string, now: Date, domain: DailyProviderCoverageDomain): DailyProviderOperationalState {
  const ageMinutes = minutesSince(timestamp, now);
  if (ageMinutes === null) return "limited";
  const activeWindowMinutes = providerDomainActiveWindowMinutes(domain);
  if (ageMinutes > 72 * 60) return "stale";
  if (ageMinutes > activeWindowMinutes) return "delayed";
  return "active";
}

function providerStateLabel(state: DailyProviderOperationalState): string {
  return `Provider ${state.replace("-", " ")}`;
}

function freshnessSlaLabelForDevelopment(category: DailyMarketDevelopment["category"], timestamp: string, now: Date): string {
  const ageMinutes = minutesSince(timestamp, now);
  const domain = providerDomainForDevelopment(category);
  const slaMinutes = providerDomainSlaMinutes(domain);
  const state = providerStateForDevelopment(timestamp, now, domain);
  if (ageMinutes === null || slaMinutes === null) return "Freshness SLA not measured";
  const status = providerFreshnessSlaStatus({
    coverage: "active",
    freshnessMinutes: ageMinutes,
    operationalState: state,
    slaMinutes,
  });
  return status === "within-sla"
    ? `Freshness SLA within ${slaMinutes}m · ${ageMinutes}m old`
    : `Freshness SLA breached · ${ageMinutes}m old against ${slaMinutes}m`;
}

function sourceCompletenessLabel(state: DailyProviderOperationalState, item: MarketNewsItem): string {
  const hasRequired = Boolean(item.source && /^https?:\/\//i.test(item.sourceUrl) && Number.isFinite(Date.parse(item.publishedAt)));
  if (hasRequired && state !== "limited") return "Source complete: provider, URL, timestamp, freshness, state, uncertainty";
  return "Source completeness limited; do not treat as live intelligence";
}

function timelineBucketForDevelopment(category: DailyMarketDevelopment["category"]): string {
  return `${providerDomainForDevelopment(category).replace(/-/g, " ")} timeline`;
}

function historicalAnalogLabel(item: MarketNewsItem): string {
  if (/limited/i.test(item.relatedReplayContext)) return "Historical analog limited; replay context not proven for this event";
  return "Replay/memory analog attached from current scanner packet";
}

function providerLatencyLabel(item: MarketNewsItem): string {
  return item.publishedAt
    ? "Provider timestamp captured; ingestion latency not instrumented"
    : "Provider timestamp unavailable";
}

function minutesSince(timestamp: string, now: Date): number | null {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round((now.getTime() - parsed) / 60000));
}

function symbolRelevanceLabel(symbols: string[]): string {
  if (!symbols.length) return "No direct symbol link in current packet";
  if (symbols.length === 1) return `Direct symbol relevance: ${symbols[0]}`;
  return `Symbol relevance: ${symbols.slice(0, 5).join(", ")}${symbols.length > 5 ? " +" : ""}`;
}

function watchlistRelevanceLabel(symbols: string[], watchlist: Set<string>): string {
  const matches = symbols.filter((symbol) => watchlist.has(symbol));
  if (matches.length) return `Watchlist relevance: ${matches.slice(0, 5).join(", ")}`;
  if (symbols.length) return "No current watchlist overlap";
  return "Market-level item; no watchlist symbol link";
}

function uncertaintyLabel(item: MarketNewsItem): string {
  if (item.relevance >= 75) return "High relevance, research-only interpretation";
  if (item.relevance >= 55) return "Moderate relevance; confirm with price, macro, and replay evidence";
  return "Limited relevance; keep as contextual evidence only";
}

function eventConfidenceLabel(item: MarketNewsItem, providerState: DailyProviderOperationalState): string {
  if (providerState === "outage" || providerState === "partial-outage") return "Provider-state limited confidence; verify against live source before action.";
  if (providerState === "stale" || providerState === "delayed") return "Freshness-limited confidence; timestamp remains visible and no live label is implied.";
  if (item.relevance >= 75) return "High source-linked relevance; research-only and still uncertain.";
  if (item.relevance >= 55) return "Moderate source-linked relevance; confirm with price, macro, and replay context.";
  return "Context-only relevance; not enough evidence for a standalone decision.";
}

function macroImpactLabel(item: MarketNewsItem): string {
  const context = cleanText(item.relatedMacroContext, "");
  if (context) return context;
  if (item.scope === "market") return "Market-level event; macro impact is source-linked but not quantified.";
  if (item.affectedSectors.length) return `Sector-level macro impact candidate across ${item.affectedSectors.slice(0, 3).join(", ")}.`;
  return "Macro impact is not established beyond the source-linked event.";
}

function replayLinkageLabel(item: MarketNewsItem): string {
  const context = cleanText(item.relatedReplayContext, "");
  if (!context || /limited/i.test(context)) return "Replay linkage limited; no historical analog is inferred for this event.";
  return context;
}

function strategyLinkageLabel(input: {
  affectedSectors: string[];
  affectedSymbols: string[];
  scope: MarketNewsItem["scope"];
}): string {
  if (input.affectedSymbols.length) {
    return `Strategy review candidate for ${input.affectedSymbols.slice(0, 5).join(", ")}; TradeVeto does not change allocations automatically.`;
  }
  if (input.affectedSectors.length) {
    return `Sector strategy context for ${input.affectedSectors.slice(0, 3).join(", ")}; no position or return is inferred.`;
  }
  if (input.scope === "market") return "Market strategy context only; no symbol-specific action is inferred.";
  return "Strategy linkage limited until a source-linked symbol or sector impact exists.";
}

function providerAuditLimitations(input: {
  coverage: DailyProviderStrategyAudit["coverage"];
  domain: string;
  hasCalendar: boolean;
  hasSourceLinked: boolean;
  operationalState: DailyProviderOperationalState;
}): string[] {
  if (input.operationalState === "outage") {
    return [
      `${input.domain} provider status reports an outage or fetch failure in the current packet.`,
      "No source-linked event is fabricated while the provider is unavailable.",
    ];
  }
  if (input.operationalState === "partial-outage") {
    return [
      `${input.domain} has source-linked rows, but at least one provider status also reported a failure.`,
      "Only available source-linked rows are used; missing provider data remains disclosed.",
    ];
  }
  if (input.operationalState === "stale") {
    return [
      `${input.domain} source-linked rows are stale for intraday research.`,
      "Treat this domain as delayed until a fresher provider timestamp appears.",
    ];
  }
  if (input.operationalState === "delayed") {
    return [
      `${input.domain} source-linked rows are delayed beyond the active intraday window.`,
      "TradeVeto keeps the timestamp visible instead of implying real-time coverage.",
    ];
  }
  if (input.coverage === "active") {
    const limitations = ["Coverage depends on configured source-linked provider rows in the current scanner packet."];
    if (!input.hasCalendar) limitations.push(`${input.domain} calendar depth is limited or not configured.`);
    return limitations;
  }
  if (input.coverage === "calendar-only") {
    return [
      `${input.domain} dates exist in the stored event calendar.`,
      "Source-linked article/provider payload is not configured for this domain.",
    ];
  }
  return [
    `No verified ${input.domain.toLowerCase()} provider rows found in the current packet.`,
    "TradeVeto shows a limited-data state instead of fabricating events.",
  ];
}

function providerOperationalState(input: {
  activeWindowMinutes: number;
  coverage: DailyProviderStrategyAudit["coverage"];
  freshnessMinutes: number | null;
  hasOutageSignal: boolean;
  hasStaleSignal: boolean;
}): DailyProviderOperationalState {
  if (input.coverage === "active" && input.hasOutageSignal) return "partial-outage";
  if (input.coverage !== "active" && input.hasOutageSignal) return "outage";
  if (input.coverage !== "active" && input.hasStaleSignal) return "stale";
  if (input.coverage === "calendar-only") return "calendar-only";
  if (input.coverage !== "active") return "limited";
  if (input.freshnessMinutes !== null && input.freshnessMinutes > 72 * 60) return "stale";
  if (input.freshnessMinutes !== null && input.freshnessMinutes > input.activeWindowMinutes) return "delayed";
  return "active";
}

function providerDomainSlaMinutes(domain: DailyProviderCoverageDomain): number | null {
  if (domain === "earnings" || domain === "dividends") return 30 * 24 * 60;
  if (domain === "economic-calendar") return 24 * 60;
  if (domain === "macro" || domain === "inflation" || domain === "rates") return 24 * 60;
  if (domain === "geopolitical-events") return 72 * 60;
  if (domain === "analyst-actions") return 48 * 60;
  if (domain === "company-events" || domain === "sector-events") return 24 * 60;
  if (domain === "crypto-events") return 48 * 60;
  return null;
}

function providerDomainActiveWindowMinutes(domain: DailyProviderCoverageDomain): number {
  return providerDomainSlaMinutes(domain) ?? 24 * 60;
}

function providerFreshnessSlaStatus(input: {
  coverage: DailyProviderStrategyAudit["coverage"];
  freshnessMinutes: number | null;
  operationalState: DailyProviderOperationalState;
  slaMinutes: number | null;
}): DailyProviderFreshnessSlaStatus {
  if (input.coverage !== "active" || input.slaMinutes === null) return "not-measured";
  if (input.operationalState === "outage" || input.operationalState === "partial-outage" || input.operationalState === "stale" || input.operationalState === "delayed") return "breached";
  if (input.freshnessMinutes === null) return "breached";
  return input.freshnessMinutes <= input.slaMinutes ? "within-sla" : "breached";
}

function providerFreshnessSlaDisclosure(input: {
  coverage: DailyProviderStrategyAudit["coverage"];
  domain: string;
  freshnessMinutes: number | null;
  operationalState: DailyProviderOperationalState;
  slaMinutes: number | null;
}): string {
  const status = providerFreshnessSlaStatus(input);
  if (status === "within-sla" && input.slaMinutes !== null && input.freshnessMinutes !== null) {
    return `${input.domain} source-linked provider row is ${input.freshnessMinutes}m old against a ${input.slaMinutes}m freshness SLA.`;
  }
  if (status === "breached" && input.slaMinutes !== null) {
    const age = input.freshnessMinutes === null ? "without a measurable source timestamp" : `${input.freshnessMinutes}m old`;
    return `${input.domain} source-linked provider row is ${age}; this breaches the ${input.slaMinutes}m freshness SLA and must not be labeled live.`;
  }
  if (input.coverage === "calendar-only") return `${input.domain} is calendar-only, so real-time provider freshness SLA is not measured.`;
  if (input.operationalState === "limited") return `${input.domain} has no source-linked provider row, so freshness SLA is not measured.`;
  return `${input.domain} freshness SLA is not measured for this packet.`;
}

function providerOperationalDisclosure(input: {
  coverage: DailyProviderStrategyAudit["coverage"];
  domain: string;
  freshnessMinutes: number | null;
  operationalState: DailyProviderOperationalState;
  outageMessage: string | null;
}): string {
  if (input.operationalState === "active") return `${input.domain} has current source-linked provider rows in this scanner packet.`;
  if (input.operationalState === "partial-outage") return `${input.domain} has usable source-linked rows, but raw provider status also reports ${input.outageMessage ?? "a provider failure"}.`;
  if (input.operationalState === "outage") return `${input.domain} raw provider status reports ${input.outageMessage ?? "a provider outage"}; no missing events are inferred.`;
  if (input.operationalState === "stale") return `${input.domain} provider evidence is stale${input.freshnessMinutes === null ? "" : ` at ${Math.round(input.freshnessMinutes / 60)}h old`}.`;
  if (input.operationalState === "delayed") return `${input.domain} provider evidence is delayed${input.freshnessMinutes === null ? "" : ` at ${Math.round(input.freshnessMinutes / 60)}h old`}.`;
  if (input.operationalState === "calendar-only") return `${input.domain} has stored calendar fields but no source-linked provider payload.`;
  return `${input.domain} source-linked provider coverage is limited in the current packet.`;
}

function toneForProviderState(state: DailyProviderOperationalState, highImpact: boolean): DailyCommandTone {
  if (state === "outage" || state === "partial-outage" || state === "stale") return "rose";
  if (state === "delayed" || state === "calendar-only") return "amber";
  if (state === "active") return highImpact ? "rose" : "emerald";
  return "rose";
}

function providerOperationalSignals(rows: OpportunityViewModel[]): ProviderOperationalSignal[] {
  const signals: ProviderOperationalSignal[] = [];
  for (const row of rows) {
    const provider = cleanText(row.raw.news_source ?? row.raw.event_source ?? row.raw.data_provider ?? row.raw.data_provider_primary, "Provider");
    const symbol = row.symbol.toUpperCase();
    for (const key of ["news_provider_error", "event_provider_error", "headline_provider_error", "provider_error", "data_provider_error"]) {
      const message = cleanText(row.raw[key], "");
      if (!message) continue;
      signals.push({ domainText: key, message, provider, status: "outage", symbol });
    }
    for (const key of ["news_provider_status", "event_provider_status", "headline_provider_status", "provider_status", "verified_event_feed_status"]) {
      const statusText = cleanText(row.raw[key], "");
      if (!statusText) continue;
      if (/outage|failed|failure|unavailable|timeout|blocked/i.test(statusText)) {
        signals.push({ domainText: key, message: statusText, provider, status: "outage", symbol });
      } else if (/stale|delayed|fallback/i.test(statusText)) {
        signals.push({ domainText: key, message: statusText, provider, status: "stale", symbol });
      }
    }
    if (row.dataFreshness.status === "stale") {
      signals.push({ domainText: "scanner_data_freshness", message: row.dataFreshness.message, provider, status: "stale", symbol });
    }
    if (Boolean(row.raw.data_provider_fallback_used)) {
      signals.push({ domainText: "market_data_provider_fallback", message: "Market data provider fallback was used.", provider, status: "fallback", symbol });
    }
  }
  return signals;
}

function domainMatchesSignal(domain: DailyProviderCoverageDomain, label: string, signal: ProviderOperationalSignal): boolean {
  const text = `${domain} ${label} ${signal.domainText} ${signal.message}`.toLowerCase();
  if (/analyst/.test(text)) return domain === "analyst-actions";
  if (/dividend/.test(text)) return domain === "dividends";
  if (/earnings/.test(text)) return domain === "earnings";
  if (/geopolitical|geo|sanction|war|conflict/.test(text)) return domain === "geopolitical-events";
  if (/inflation|cpi|ppi/.test(text)) return domain === "inflation";
  if (/rate|fed|yield/.test(text)) return domain === "rates";
  if (/crypto|bitcoin|btc/.test(text)) return domain === "crypto-events";
  if (/sector/.test(text)) return domain === "sector-events";
  if (/company|event_provider|news_provider|headline_provider|verified_event_feed/.test(text)) return domain === "company-events" || domain === "macro" || domain === "economic-calendar";
  return false;
}

function developmentPriorityScore(input: {
  affectedSymbols: string[];
  relevance: number;
  topDangerSymbols: string[];
  topOpportunitySymbols: string[];
  urgency: DailyMarketDevelopment["urgency"];
  watchlist: Set<string>;
}): number {
  const watchlistMatch = input.affectedSymbols.some((symbol) => input.watchlist.has(symbol));
  const topOpportunityMatch = input.affectedSymbols.some((symbol) => input.topOpportunitySymbols.includes(symbol));
  const topDangerMatch = input.affectedSymbols.some((symbol) => input.topDangerSymbols.includes(symbol));
  const urgencyBoost = input.urgency === "high" ? 18 : input.urgency === "medium" ? 9 : 0;
  return Math.round(clamp(input.relevance + urgencyBoost + (watchlistMatch ? 16 : 0) + (topOpportunityMatch ? 8 : 0) + (topDangerMatch ? 10 : 0)));
}

function sourceQualityLabel(item: MarketNewsItem): string {
  const textValue = `${item.source} ${item.sourceUrl}`.toLowerCase();
  if (/sec\.gov|federalreserve\.gov|bls\.gov|bea\.gov|eia\.gov|treasury\.gov|stlouisfed\.org/.test(textValue)) return "Official source";
  if (/reuters|bloomberg|apnews|ap news|cnbc|coindesk|marketbeat|marketwatch|yahoo|wsj|stocktitan|nasdaq/.test(textValue)) return "Verified market source";
  if (/prnewswire|globenewswire|businesswire|investor/.test(textValue)) return "Source-linked company release";
  return "Verified source-linked item";
}

function sectorImpactLabel(sectors: string[]): string {
  if (!sectors.length) return "Cross-market impact";
  if (sectors.length === 1) return `${sectors[0]} impact`;
  return `${sectors.slice(0, 2).join(" + ")} impact`;
}

function researchTypeLabel(item: MarketNewsItem): string {
  const type = item.eventType.replace(/_/g, " ");
  if (item.scope === "symbol") return `Symbol ${type}`;
  if (item.scope === "sector") return `Sector ${type}`;
  return `Market ${type}`;
}

function newsCoverageGaps(input: {
  analystCount: number;
  calendar: DailyEventCalendarItem[];
  developments: DailyMarketDevelopment[];
  dividendCount: number;
  earningsCount: number;
  geopoliticalCount: number;
  macroCount: number;
  ratesInflationCount: number;
  sourceCount: number;
}): string[] {
  const gaps = [
    input.sourceCount === 0 ? "No verified provider feed configured" : null,
    input.macroCount === 0 && input.ratesInflationCount === 0 ? "Macro/rates feed limited" : null,
    input.geopoliticalCount === 0 ? "Geopolitical feed limited" : null,
    input.earningsCount === 0 ? "Earnings catalyst depth limited" : null,
    input.analystCount === 0 ? "Analyst action feed limited" : null,
    input.dividendCount === 0 ? "Dividend calendar limited" : null,
    input.calendar.length === 0 ? "Event calendar limited" : null,
    input.developments.every((item) => item.affectedSymbols.length === 0) ? "Symbol-level impact links limited" : null,
  ].filter((item): item is string => item !== null);
  return gaps.slice(0, 5);
}

function buildWhatChangedToday(input: {
  rankedZones: UnifiedIntelligenceConsoleModel["rankedZones"];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  marketCommand: MarketCommandModel;
}): DailyMarketChange[] {
  const workflowChanges = [
    ...(input.workflowEvolution?.whatChanged ?? []),
    ...(input.workflowEvolution?.deterioratingSetups ?? []),
    ...(input.workflowEvolution?.improvingSetups ?? []),
  ].slice(0, 5).map((item): DailyMarketChange => ({
    detail: item.detail,
    label: item.title,
    metricLabel: item.metricLabel,
    symbol: item.symbol === "WORKFLOW" ? undefined : item.symbol,
    tone: item.severity === "warning" ? "rose" : item.severity === "positive" ? "emerald" : "cyan",
  }));
  const rankedChanges = input.rankedZones["what-changed"].topSymbols.slice(0, 5).map((item): DailyMarketChange => ({
    detail: item.reason,
    label: `${item.symbol}: ${item.scoreLabel} moved`,
    metricLabel: item.metricLabel,
    symbol: item.symbol,
    tone: item.tone,
  }));
  const macroPressure = input.marketCommand.pressureSummary.pressureScore;
  const macroChange: DailyMarketChange | null = macroPressure === null ? null : {
    detail: `${input.marketCommand.pressureSummary.deteriorating} cross-asset proxies are deteriorating and ${input.marketCommand.pressureSummary.constructive} are constructive in the validated market strip.`,
    label: macroPressure >= 55 ? "Cross-asset pressure elevated" : "Cross-asset pressure contained",
    metricLabel: `${macroPressure}/100`,
    tone: macroPressure >= 55 ? "rose" : "emerald",
  };
  return dedupeChanges([macroChange, ...workflowChanges, ...rankedChanges]).slice(0, 8);
}

function buildEventCalendar(rows: OpportunityViewModel[], now: Date): DailyEventCalendarItem[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const items: DailyEventCalendarItem[] = [];
  for (const row of rows) {
    const earningsDate = dateWithinWindow(row.raw.earnings_date, start, end);
    if (earningsDate) {
      items.push({
        category: "earnings",
        date: earningsDate,
        detail: cleanText(row.raw.event_context_summary, "Stored earnings date is available; surprise/reaction history may still be limited."),
        label: `${row.symbol} earnings`,
        symbol: row.symbol,
        tone: row.eventRisk >= 65 ? "rose" : "amber",
      });
    }
    const exDividendDate = dateWithinWindow(row.raw.ex_dividend_date ?? row.raw.dividend_ex_date, start, end);
    if (exDividendDate) {
      items.push({
        category: "dividend",
        date: exDividendDate,
        detail: "Stored ex-dividend context from the latest scanner/fundamental packet.",
        label: `${row.symbol} ex-dividend`,
        symbol: row.symbol,
        tone: "cyan",
      });
    }
    const analystDate = dateWithinWindow(row.raw.analyst_action_date ?? row.raw.rating_action_date ?? row.raw.upgrade_date ?? row.raw.downgrade_date, start, end);
    if (analystDate) {
      items.push({
        category: "analyst",
        date: analystDate,
        detail: cleanText(row.raw.analyst_action_summary ?? row.raw.rating_action_summary ?? row.raw.news_headline, "Stored analyst action date is available; source-linked detail may be limited."),
        label: `${row.symbol} analyst action`,
        symbol: row.symbol,
        tone: row.raw.downgrade_date ? "rose" : "violet",
      });
    }
    const macroDate = dateWithinWindow(row.raw.macro_event_date ?? row.raw.fed_event_date ?? row.raw.cpi_date ?? row.raw.ppi_date ?? row.raw.jobs_date ?? row.raw.gdp_date ?? row.raw.event_date, start, end);
    if (macroDate) {
      const category = calendarCategoryFromText(`${row.raw.event_type ?? ""} ${row.raw.event_context_summary ?? ""} ${row.raw.news_headline ?? ""}`);
      items.push({
        category,
        date: macroDate,
        detail: cleanText(row.raw.event_context_summary ?? row.raw.macro_context_summary ?? row.raw.news_headline, "Stored market-moving event date is available; source-linked detail may be limited."),
        label: `${row.symbol} ${category} event`,
        symbol: row.symbol,
        tone: category === "geopolitical" ? "rose" : category === "rates" ? "amber" : "cyan",
      });
    }
  }
  return dedupeCalendar(items)
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date) || left.symbol.localeCompare(right.symbol))
    .slice(0, 12);
}

function narrativeFor(input: {
  best: DailyCommandRankedItem | null;
  breakout: DailyCommandRankedItem | null;
  change: DailyMarketChange | null;
  risk: DailyCommandRankedItem | null;
}): string {
  const pieces = [
    input.best ? `${input.best.symbol} leads opportunity research` : null,
    input.risk ? `${input.risk.symbol} leads risk review` : null,
    input.breakout ? `${input.breakout.symbol} has the strongest expansion context` : null,
    input.change ? `${input.change.label.toLowerCase()}` : null,
  ].filter((item): item is string => Boolean(item));
  return pieces.length ? `${pieces.join("; ")}.` : "Validated opportunity, risk, and development evidence is limited in this market packet.";
}

function invalidationContext(row: OpportunityViewModel | null, item: UnifiedConsoleRankedSymbol): string {
  if (row?.stop_loss !== null && row?.stop_loss !== undefined) return `Invalidation near ${formatMoney(row.stop_loss)}`;
  const raw = cleanText(row?.raw.stop_loss_reason ?? row?.raw.target_warning ?? row?.raw.key_risk, "");
  return raw || item.actionContext || "Invalidation context limited";
}

function replayLabel(row: OpportunityViewModel | null): string {
  if (!row) return "Replay limited";
  if (row.shockPattern) return `${row.shockPattern.currentSimilarityScore}/100 large-move replay`;
  const analog = finiteNumber(row.raw.analog_quality_score ?? row.raw.regime_similarity_score);
  if (analog !== null) return `${Math.round(analog)}/100 analog context`;
  return "Replay evidence limited";
}

function movementLabel(value: unknown): string {
  const parsed = normalizedPercent(value);
  if (parsed === null) return "Move limited";
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

function normalizedPercent(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function positiveMoveScore(value: number | null): number {
  if (value === null) return 45;
  return clamp(50 + value * 5);
}

function averageNumber(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function scoreLabel(value: number): string {
  return `${Math.round(value)}/100`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function isAiOrSemiRow(row: OpportunityViewModel): boolean {
  const text = `${row.symbol} ${row.sector ?? ""} ${row.raw.industry ?? ""} ${row.company_name ?? ""}`.toLowerCase();
  return /nvda|amd|avgo|tsm|smci|mu|amat|asml|semiconductor|chip|ai/.test(text);
}

function themeForCluster(label: string, rows: OpportunityViewModel[]): DailyMoneyFlowTheme {
  const opportunity = averageNumber(rows.map((row) => row.final_score ?? row.conviction));
  const risk = averageNumber(rows.map((row) => averageNumber([row.fragility, row.eventRisk, finiteNumber(row.raw.volatility_pressure)])));
  const return1d = averageNumber(rows.map((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct)));
  const tone: DailyCommandTone = risk !== null && risk >= 68 ? "rose" : opportunity !== null && opportunity >= 58 ? "emerald" : "amber";
  const driver = rows.slice().sort((left, right) => (right.final_score ?? right.conviction) - (left.final_score ?? left.conviction))[0];
  return {
    detail: driver ? `${driver.symbol} is the strongest measured name in this cluster. Daily movement: ${movementLabel(driver.raw.return_1d ?? driver.raw.price_change_pct)}.` : "Cluster evidence is limited.",
    label,
    tone,
    valueLabel: return1d === null ? scoreLabel(opportunity ?? risk ?? 0) : `${return1d >= 0 ? "+" : ""}${return1d.toFixed(1)}%`,
  };
}

function newsCategory(item: MarketNewsItem): DailyMarketDevelopment["category"] {
  const text = `${item.eventType} ${item.title} ${item.reasonCodes.join(" ")} ${item.relatedAssets.join(" ")}`.toLowerCase();
  if (/analyst|upgrade|downgrade|price target|initiated|rating/.test(text)) return "Analyst";
  if (/dividend|ex-dividend|payout/.test(text)) return "Dividend";
  if (/earnings|eps|revenue|guidance/.test(text)) return "Earnings";
  if (/fed|rate|bond|yield|jobs|payroll|gdp|recession/.test(text) || hasInflationLanguage(text)) return "Rates";
  if (/war|peace|geopolitical|sanction|conflict/.test(text)) return "Geopolitical";
  if (/oil|energy|crude|uso|opec/.test(text)) return "Energy";
  if (/btc|bitcoin|crypto|coin/.test(text)) return "Crypto";
  return "Macro";
}

function providerDomainForDevelopment(category: DailyMarketDevelopment["category"]): DailyProviderCoverageDomain {
  if (category === "Analyst") return "analyst-actions";
  if (category === "Crypto") return "crypto-events";
  if (category === "Dividend") return "dividends";
  if (category === "Earnings") return "earnings";
  if (category === "Geopolitical") return "geopolitical-events";
  if (category === "Rates") return "rates";
  if (category === "Energy") return "macro";
  return "macro";
}

function impactForDirection(direction: string): DailyMarketDevelopment["impact"] {
  if (direction === "positive") return "positive";
  if (direction === "negative") return "negative";
  if (direction === "neutral") return "mixed";
  return "unknown";
}

function toneForDevelopment(item: MarketNewsItem, watchlistImpact: boolean, urgency: DailyMarketDevelopment["urgency"]): DailyCommandTone {
  if (item.direction === "negative" || urgency === "high") return "rose";
  if (item.direction === "positive") return "emerald";
  if (watchlistImpact) return "cyan";
  return item.tone;
}

function developmentPriority(item: DailyMarketDevelopment): number {
  return item.priorityScore + (item.watchlistImpact ? 20 : 0) + (item.urgency === "high" ? 18 : item.urgency === "medium" ? 9 : 0);
}

function dateWithinWindow(value: unknown, start: Date, end: Date): string | null {
  const text = cleanText(value, "");
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  if (date < start || date > end) return null;
  return date.toISOString();
}

function calendarCategoryFromText(value: string): DailyEventCalendarItem["category"] {
  const text = value.toLowerCase();
  if (/analyst|upgrade|downgrade|price target|rating/.test(text)) return "analyst";
  if (/fed|rate|yield|bond|cpi|ppi|inflation|jobs|payroll|gdp/.test(text)) return "rates";
  if (/war|peace|geopolitical|sanction|conflict/.test(text)) return "geopolitical";
  if (/earnings|eps|revenue|guidance/.test(text)) return "earnings";
  return "macro";
}

function dedupeRankedSymbols(items: UnifiedConsoleRankedSymbol[]): UnifiedConsoleRankedSymbol[] {
  const seen = new Set<string>();
  const deduped: UnifiedConsoleRankedSymbol[] = [];
  for (const item of items) {
    const key = item.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...item, rank: deduped.length + 1 });
  }
  return deduped;
}

function dedupeChanges(items: Array<DailyMarketChange | null>): DailyMarketChange[] {
  const seen = new Set<string>();
  const deduped: DailyMarketChange[] = [];
  for (const item of items) {
    if (!item) continue;
    const key = `${item.symbol ?? "MARKET"}:${item.label}:${item.metricLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function dedupeCalendar(items: DailyEventCalendarItem[]): DailyEventCalendarItem[] {
  const seen = new Set<string>();
  const deduped: DailyEventCalendarItem[] = [];
  for (const item of items) {
    const key = `${item.symbol}:${item.category}:${item.date}:${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function providerCategory(qualityLabel: string, source: string): DailyInformationProviderCoverage["category"] {
  const text = `${qualityLabel} ${source}`.toLowerCase();
  if (/official|federal|bureau|sec|treasury|cftc|census|eia|fred|central bank|imf|world bank|ecb|bank of england/.test(text)) return "official";
  if (/company|release|investor|pr newswire|globenewswire|business wire|earnings/.test(text)) return "company";
  return "market";
}

function providerRank(category: DailyInformationProviderCoverage["category"]): number {
  if (category === "official") return 0;
  if (category === "market") return 1;
  return 2;
}

function dayKey(value: string): string | null {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed.toISOString();
}

function linkedProxiesForDevelopment(item: DailyMarketDevelopment): string[] {
  const text = `${item.category} ${item.headline} ${item.affectedSectors.join(" ")} ${item.affectedSymbols.join(" ")}`.toLowerCase();
  const proxies: string[] = [];
  if (/rate|yield|bond|fed|jobs|gdp|recession/.test(text) || hasInflationLanguage(text)) proxies.push("TLT", "UUP", "SPY", "QQQ");
  if (/oil|energy|crude|opec/.test(text)) proxies.push("USO", "GLD", "SPY");
  if (/crypto|btc|bitcoin|coin/.test(text)) proxies.push("BTC", "BTC-USD", "IBIT", "QQQ");
  if (/geopolitical|war|peace|sanction|conflict|defense/.test(text)) proxies.push("USO", "GLD", "UUP", "SPY");
  if (/earnings|analyst|semiconductor|technology|software|growth/.test(text)) proxies.push("QQQ", "SPY");
  if (/dollar|currency/.test(text)) proxies.push("UUP", "GLD", "TLT");
  return uniqueStrings(proxies);
}

function crossAssetRelationshipType(item: DailyMarketDevelopment): string {
  const text = `${item.category} ${item.headline} ${item.whyItMatters} ${item.affectedSectors.join(" ")} ${item.affectedSymbols.join(" ")}`.toLowerCase();
  if (/rate|yield|bond|fed|jobs|gdp|recession/.test(text) || hasInflationLanguage(text)) return "Rates/yields versus duration-sensitive growth";
  if (/oil|energy|crude|opec/.test(text)) return "Oil and energy versus inflation pressure";
  if (/crypto|btc|bitcoin|coin/.test(text)) return "Crypto beta versus risk appetite";
  if (/geopolitical|war|peace|sanction|conflict|defense/.test(text)) return "Geopolitical risk versus safety/liquidity proxies";
  if (/earnings|eps|revenue|guidance|analyst|upgrade|downgrade|rating/.test(text)) return "Company catalyst versus sector beta";
  if (/dollar|currency/.test(text)) return "Dollar strength versus commodities and global multiples";
  return "Source-linked market relationship";
}

function calendarRelationshipType(item: DailyEventCalendarItem): string {
  const text = `${item.category} ${item.label} ${item.detail}`.toLowerCase();
  if (/rate|yield|bond|fed|jobs|gdp/.test(text) || hasInflationLanguage(text)) return "Scheduled macro release versus rates/liquidity";
  if (/war|peace|geopolitical|sanction|conflict/.test(text)) return "Scheduled geopolitical event risk";
  return "Stored macro/event calendar context";
}

function relationshipNarrative(item: DailyMarketDevelopment, linkedProxies: string[]): string {
  const proxyText = linkedProxies.length ? ` Cross-asset proxies in view: ${linkedProxies.join(", ")}.` : "";
  const sectorText = item.affectedSectors.length ? ` Affected sectors: ${item.affectedSectors.slice(0, 3).join(", ")}.` : "";
  const symbolText = item.affectedSymbols.length ? ` Affected symbols: ${item.affectedSymbols.slice(0, 5).join(", ")}.` : "";
  return `${item.category} context from ${item.source} is connected to current TradeVeto risk/opportunity routing.${proxyText}${sectorText}${symbolText}`;
}

function dedupeMacroTimeline(items: DailyMacroEventTimelineItem[]): DailyMacroEventTimelineItem[] {
  const seen = new Set<string>();
  const deduped: DailyMacroEventTimelineItem[] = [];
  for (const item of items) {
    const key = `${item.category}:${item.date}:${item.detail.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function dedupeEventDomainTimeline(items: DailyEventDomainTimelineItem[]): DailyEventDomainTimelineItem[] {
  const seen = new Set<string>();
  const deduped: DailyEventDomainTimelineItem[] = [];
  for (const item of items) {
    const key = `${item.category}:${item.date}:${item.detail.slice(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function urgencyRank(value: DailyMarketDevelopment["urgency"]): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

function hasInflationLanguage(value: string): boolean {
  return /\b(?:cpi|ppi|inflation)\b|consumer price|producer price|price index/i.test(value);
}
