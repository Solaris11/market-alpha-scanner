import { NextResponse } from "next/server";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData, getRecentScannerHistoryRows } from "@/lib/scanner-data";
import { requirePremium } from "@/lib/server/access-control";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { rateLimitRequest } from "@/lib/server/request-security";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { getMarketChartHubData } from "@/lib/server/validated-price-history";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import {
  buildDailyMarketCommandModel,
  type DailyMarketDevelopment,
  type DailyProviderCoverageDomain,
  type DailyProviderOperationalState,
  type DailyProviderStrategyAudit,
} from "@/lib/trading/daily-market-command";
import { buildMarketCommandModel, type MarketCommandModel, type MarketNewsItem } from "@/lib/trading/market-research";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildProviderFreshnessCertification } from "@/lib/trading/provider-source-certification";
import { buildUnifiedIntelligenceConsole } from "@/lib/trading/unified-intelligence-console";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_PROVIDER_DOMAINS: DailyProviderCoverageDomain[] = [
  "macro",
  "rates",
  "inflation",
  "earnings",
  "economic-calendar",
  "analyst-actions",
  "dividends",
  "geopolitical-events",
  "company-events",
  "sector-events",
  "crypto-events",
];

type ProviderStateCounts = Record<DailyProviderOperationalState, number>;

type EventCardProof = {
  affectedSymbols: string[];
  confidence: string;
  freshness: string;
  freshnessSla: string;
  eventRelevanceScore: number;
  headline: string;
  historicalAnalog: string;
  macroImpact: string;
  provider: string;
  providerState: DailyProviderOperationalState;
  providerStateLabel: string;
  replayLinkage: string;
  source: string;
  sourceCompleteness: string;
  sourceUrl: string;
  strategyLinkage: string;
  timestamp: string;
  timelineBucket: string;
  uncertainty: string;
  watchlistImpact: boolean;
  watchlistImpactReason: string;
  whyItMatters: string;
};

type ProviderOutageSimulationProof = {
  enabled: boolean;
  fallbackVisible: boolean;
  requested: string[];
  recoveryVisible: boolean;
  simulatedStates: Array<{
    disclosure: string;
    domain: DailyProviderCoverageDomain;
    operationalState: "outage";
    provider: string;
  }>;
  recoveryStates: Array<{
    disclosure: string;
    domain: DailyProviderCoverageDomain;
    operationalState: DailyProviderOperationalState;
    provider: string;
  }>;
};

export async function GET(request: Request) {
  const access = await requirePremium();
  if (!access.ok) return access.response;

  const limited = await rateLimitRequest(request, "provider-source-trust", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const adapter = new ScannerDataAdapter();
    const [snapshot, performance, scanSafety, watchlistSymbols, marketChartHubData, recentProviderRows] = await Promise.all([
      adapter.getTerminalSnapshot(),
      getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
      getCurrentScanSafety(),
      readUserWatchlist(access.user.id).catch(() => []),
      getMarketChartHubData().catch(() => []),
      getRecentScannerHistoryRows({ hours: 72, maxRuns: 32, minRuns: 3 }).catch(() => []),
    ]);
    const symbols = snapshot.signals.map((row) => row.symbol);
    const [shockPatterns, narratives, workflowEvolution] = await Promise.all([
      getShockMovePatternMap(symbols).catch(() => new Map()),
      getNarrativeMap(symbols).catch(() => new Map()),
      getWorkflowEvolutionForUser(access.user.id, snapshot.signals, { surface: "terminal", watchlistSymbols }).catch(() => null),
    ]);
    const opportunities = buildOpportunitiesPageModel(snapshot.signals, performance, shockPatterns, narratives);
    const marketCommand = buildMarketCommandModel({
      charts: marketChartHubData,
      generatedAt: scanSafety.lastUpdated,
      rows: snapshot.signals,
    });
    const providerMarketCommand = mergeRecentProviderEvents(marketCommand, recentProviderRows, scanSafety.lastUpdated);
    const unified = buildUnifiedIntelligenceConsole({
      marketCondition: snapshot.marketRegime.label,
      rows: opportunities.rows,
      watchlistSymbols,
      workflowEvolution,
    });
    const model = buildDailyMarketCommandModel({
      marketCommand: providerMarketCommand,
      marketCondition: snapshot.marketRegime.label,
      rankedZones: unified.rankedZones,
      rows: opportunities.rows,
      watchlistSymbols,
      workflowEvolution,
    });
    const outageHeader = request.headers.get("x-tradeveto-provider-outage-simulation") ?? "";
    const eventCards = model.developments.map(eventCardProof);
    const outageSimulation = providerOutageSimulation(model.providerCoverageMatrix, outageHeader);
    return NextResponse.json({
      certification: buildProviderFreshnessCertification({
        eventCards,
        eventDomainTimelines: model.eventDomainTimelines,
        outageSimulation,
        outageSimulationRequired: Boolean(outageHeader.trim()),
        providerCoverageMatrix: model.providerCoverageMatrix,
        requiredDomains: REQUIRED_PROVIDER_DOMAINS,
        sourceTrust: model.newsEcosystem.sourceTrust,
      }),
      eventCards,
      eventDomainTimelines: model.eventDomainTimelines,
      generatedAt: new Date().toISOString(),
      marketCondition: snapshot.marketRegime.label,
      ok: true,
      outageSimulation,
      providerCoverageMatrix: model.providerCoverageMatrix,
      providerStateCounts: providerStateCounts(model.providerCoverageMatrix),
      requiredDomainCoverage: requiredDomainCoverage(model.providerCoverageMatrix),
      scanUpdatedAt: scanSafety.lastUpdated,
      sourceTrust: model.newsEcosystem.sourceTrust,
    });
  } catch (error) {
    console.warn("[provider-source-trust] certification load failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Provider source trust proof is temporarily unavailable." }, { status: 503 });
  }
}

function mergeRecentProviderEvents(current: MarketCommandModel, recentRows: Parameters<typeof buildMarketCommandModel>[0]["rows"], generatedAt: string | null): MarketCommandModel {
  if (!recentRows.length) return current;
  const recent = buildMarketCommandModel({ charts: [], generatedAt, rows: recentRows });
  const mergedNews = mergeMarketNews(current.macroNews, recent.macroNews);
  return { ...current, macroNews: mergedNews };
}

function mergeMarketNews(current: MarketNewsItem[], recent: MarketNewsItem[]): MarketNewsItem[] {
  const byId = new Map<string, MarketNewsItem>();
  for (const item of [...recent, ...current]) {
    const existing = byId.get(item.id);
    if (!existing || item.relevance > existing.relevance || Date.parse(item.publishedAt) > Date.parse(existing.publishedAt)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values())
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || right.relevance - left.relevance)
    .slice(0, 32);
}

function eventCardProof(item: DailyMarketDevelopment): EventCardProof {
  return {
    affectedSymbols: item.affectedSymbols,
    confidence: item.confidenceLabel,
    freshness: item.freshnessLabel,
    freshnessSla: item.freshnessSlaLabel,
    eventRelevanceScore: item.original.relevance,
    headline: item.headline,
    historicalAnalog: item.historicalAnalogLabel,
    macroImpact: item.macroImpactLabel,
    provider: item.providerAttribution,
    providerState: item.providerState,
    providerStateLabel: item.providerStateLabel,
    replayLinkage: item.replayLinkageLabel,
    source: item.source,
    sourceCompleteness: item.sourceCompletenessLabel,
    sourceUrl: item.sourceUrl,
    strategyLinkage: item.strategyLinkageLabel,
    timestamp: item.timestamp,
    timelineBucket: item.timelineBucket,
    uncertainty: item.uncertaintyLabel,
    watchlistImpact: item.watchlistImpact,
    watchlistImpactReason: item.watchlistImpactReason,
    whyItMatters: item.whyItMatters,
  };
}

function requiredDomainCoverage(audits: DailyProviderStrategyAudit[]) {
  return REQUIRED_PROVIDER_DOMAINS.map((domain) => {
    const audit = audits.find((item) => item.domain === domain) ?? null;
    return {
      domain,
      itemCount: audit?.itemCount ?? 0,
      operationalState: audit?.operationalState ?? "limited",
      present: Boolean(audit),
      provider: audit?.provider ?? "Provider not configured",
      freshnessSlaDisclosure: audit?.freshnessSlaDisclosure ?? "No source-linked provider row, so freshness SLA is not measured.",
      freshnessSlaMinutes: audit?.freshnessSlaMinutes ?? null,
      freshnessSlaStatus: audit?.freshnessSlaStatus ?? "not-measured",
      sourceTransparency: audit?.sourceTransparency ?? "No source-linked provider rows found; TradeVeto does not infer missing events.",
    };
  });
}

function providerStateCounts(audits: DailyProviderStrategyAudit[]): ProviderStateCounts {
  return audits.reduce<ProviderStateCounts>((counts, audit) => {
    counts[audit.operationalState] += 1;
    return counts;
  }, {
    active: 0,
    "calendar-only": 0,
    delayed: 0,
    limited: 0,
    outage: 0,
    "partial-outage": 0,
    stale: 0,
  });
}

function providerOutageSimulation(audits: DailyProviderStrategyAudit[], headerValue: string): ProviderOutageSimulationProof {
  const requested = headerValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!requested.length) {
    return {
      enabled: false,
      fallbackVisible: false,
      recoveryStates: [],
      recoveryVisible: false,
      requested: [],
      simulatedStates: [],
    };
  }
  const targetAudits = audits.filter((audit) => requested.some((token) => domainMatchesToken(audit.domain, token)));
  const selected = targetAudits.length ? targetAudits : audits.filter((audit) => audit.domain === "macro" || audit.domain === "company-events" || audit.domain === "economic-calendar");
  return {
    enabled: true,
    fallbackVisible: selected.length > 0,
    recoveryStates: selected.map((audit) => ({
      disclosure: audit.disclosure,
      domain: audit.domain,
      operationalState: audit.operationalState,
      provider: audit.provider,
    })),
    recoveryVisible: selected.length > 0,
    requested,
    simulatedStates: selected.map((audit) => ({
      disclosure: `${audit.domain.replace(/-/g, " ")} provider outage simulated for certification; no missing event is labeled live or inferred.`,
      domain: audit.domain,
      operationalState: "outage",
      provider: audit.provider,
    })),
  };
}

function domainMatchesToken(domain: DailyProviderCoverageDomain, token: string): boolean {
  if (domain.includes(token)) return true;
  if (token === "news") return domain === "company-events" || domain === "sector-events" || domain === "macro";
  if (token === "events") return domain === "company-events" || domain === "economic-calendar" || domain === "geopolitical-events";
  if (token === "macro") return domain === "macro" || domain === "rates" || domain === "inflation" || domain === "economic-calendar";
  if (token === "scanner") return domain === "company-events" || domain === "sector-events";
  return false;
}
