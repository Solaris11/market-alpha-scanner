import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { PublicSymbolPreview } from "@/components/premium/PublicSignalPreview";
import { PublishedSymbolIntelligenceBlock } from "@/components/seo/IntelligencePublishingBlocks";
import { SymbolCommandSearch } from "@/components/symbol/SymbolCommandSearch";
import { SymbolWorkflowMaturityPanel } from "@/components/symbol/SymbolWorkflowMaturityPanels";
import { SymbolTerminalWorkspace } from "@/components/terminal/SymbolTerminalWorkspace";
import { SymbolWorkspaceTracker } from "@/components/terminal/SymbolWorkspaceTracker";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EmptyState } from "@/components/terminal/ui/EmptyState";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { freshnessFromTimestamp } from "@/lib/data-health";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getDecisionMemoryForUser } from "@/lib/server/decision-journal";
import { getPublishedSymbolPage } from "@/lib/server/intelligence-publishing";
import { getMarketMemoryForSignal } from "@/lib/server/market-memory";
import { getNarrativeForSymbol } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicSymbolSignal } from "@/lib/server/public-signal-data";
import { getShockMovePattern } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { readUserMemorySettings } from "@/lib/server/user-memory-settings";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildAdaptiveLearningSystem } from "@/lib/trading/adaptive-learning";
import { buildEdgeLookup, selectBestTradeNow } from "@/lib/trading/conviction";
import { buildConvictionTimelineModel } from "@/lib/trading/conviction-timeline-model";
import { getDailyAction } from "@/lib/trading/daily-action";
import { buildDecisionMemorySummary, buildPersonalizedDecisionCoaching } from "@/lib/trading/decision-journal";
import { buildHistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { createMacroContextResolver } from "@/lib/trading/macro-regime";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";
import { publishingJsonLdForSymbol } from "@/lib/trading/intelligence-publishing";
import { buildSymbolSearchIndex, buildSymbolWorkflowMaturityModel } from "@/lib/trading/symbol-workflow-maturity";
import { DEFAULT_USER_MEMORY_SETTINGS } from "@/lib/trading/user-memory-settings";
import type { RankingRow, ScannerScalar, SymbolDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

type FastShellCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: string;
};

type PrefetchedChartPacket = {
  candles: FastShellCandle[];
  dataSource: string;
  interpretation?: string;
  lastUpdated: string | null;
  scannerScore: number | null;
  symbol: string;
};

function cleanSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const cleaned = cleanSymbol(symbol) || "Symbol";
  return marketingMetadata(`/symbol/${cleaned}`, {
    title: `${cleaned} AI Market Intelligence — TradeVeto`,
    description: `Public TradeVeto market intelligence for ${cleaned}: macro context, fragility, shock memory, narrative reasoning, and WAIT-first research framing. Research only.`,
  });
}

export default async function SymbolDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <div className="mb-4">
          <Link className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/terminal">
            Back to terminal
          </Link>
        </div>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  const premiumAccess = hasPremiumAccess(entitlement);

  if (!premiumAccess) {
    const cleaned = cleanSymbol(symbol);
    const [{ summary, signal }, published] = await Promise.all([
      getPublicSymbolSignal(cleaned),
      getPublishedSymbolPage(cleaned).catch(() => null),
    ]);
    assertNoPremiumFields({ signal, summary });
    const accessState = premiumAccessState(entitlement);
    const jsonLd = published ? publishingJsonLdForSymbol(published) : null;

    return (
      <TerminalShell>
        {jsonLd ? <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
        <div className="mb-4">
          <Link className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/terminal">
            Back to terminal
          </Link>
        </div>
        <div className="space-y-4">
          {published ? <PublishedSymbolIntelligenceBlock compact intelligence={published} /> : null}
          <PublicSymbolPreview accessState={accessState} authenticated={entitlement.authenticated} summary={summary} />
          <PremiumLockedState
            accessState={accessState}
            authenticated={entitlement.authenticated}
            description="Premium unlocks full symbol research, risk levels, simulator context, and decision-assistant details."
            previewItems={["Full research plan", "Risk simulation", "Decision assistant"]}
            title={entitlement.authenticated ? "This research plan is available on Premium" : "Sign in to unlock this research plan"}
          />
        </div>
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const detail = await adapter.getSymbolDetail(symbol);
  const row = detail.row;
  const dataFreshness = row ? freshnessFromTimestamp(typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null) : freshnessFromTimestamp(null);

  return (
    <TerminalShell>
      <div className="mb-4">
        <Link className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/terminal">
          Back to terminal
        </Link>
      </div>
      {!row ? (
        <EmptyState title="Symbol not found" message={`${symbol.toUpperCase()} is not available in the current scanner output.`} />
      ) : (
        <>
          <SymbolWorkspaceTracker symbol={row.symbol} />
          <Suspense fallback={<SymbolInstantWorkflowShell dataFreshness={dataFreshness} priceSeries={detail.history} row={row} />}>
            <SymbolDetailWorkspaceContent
              detail={detail}
              entitlementAuthenticated={entitlement.authenticated}
              entitlementUserId={entitlement.user?.id ?? null}
              premiumAccess={premiumAccess}
              symbol={symbol}
            />
          </Suspense>
        </>
      )}
    </TerminalShell>
  );
}

async function SymbolDetailWorkspaceContent({
  detail,
  entitlementAuthenticated,
  entitlementUserId,
  premiumAccess,
  symbol,
}: {
  detail: SymbolDetail;
  entitlementAuthenticated: boolean;
  entitlementUserId: string | null;
  premiumAccess: boolean;
  symbol: string;
}) {
  const row = detail.row;
  if (!row) return null;

  const adapter = new ScannerDataAdapter();
  const [history, paper, performance, snapshot, scanSafety, shockPattern, narrative, personalizationProfile, intradayDriftRows] = await Promise.all([
    adapter.getSignalHistory(symbol),
    getPaperData().catch(() => ({ positions: [], events: [] })),
    getPerformanceData({ forwardTailRows: 1200 }).catch(() => null),
    adapter.getTerminalSnapshot(),
    getCurrentScanSafety(),
    getShockMovePattern(symbol).catch(() => null),
    getNarrativeForSymbol(symbol).catch(() => null),
    getPersonalizationProfileForUser(entitlementUserId).catch(() => null),
    getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 18, minRuns: 2 }).catch(() => []),
  ]);
  const edgeProof = row ? buildHistoricalEdgeProof(row, performance) : null;
  const symbolForwardRows = (performance?.forwardReturns.rows ?? []).filter((item) => String(item.symbol ?? "").toUpperCase() === symbol.trim().toUpperCase());
  const adaptiveLearning = buildAdaptiveLearningSystem({
    forwardRows: symbolForwardRows,
    observationCount: symbolForwardRows.length,
  });
  const timeline = buildConvictionTimelineModel(history);
  const dataFreshness = row ? freshnessFromTimestamp(typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null) : null;
  const edges = buildEdgeLookup(snapshot.signals, performance);
  const best = selectBestTradeNow(snapshot.signals, edges);
  const globalDecision = getDailyAction({
    best,
    fallbackRow: row ?? snapshot.topSignals[0] ?? snapshot.signals[0],
    marketRegime: snapshot.marketRegime,
    scanSafety,
  });
  const [marketMemory, decisionJournalContext, memorySettings] = row
    ? await Promise.all([
        getMarketMemoryForSignal(row),
        entitlementUserId ? getDecisionMemoryForUser(entitlementUserId, { symbol: row.symbol }).catch(() => null) : Promise.resolve(null),
        entitlementUserId ? readUserMemorySettings(entitlementUserId).catch(() => DEFAULT_USER_MEMORY_SETTINGS) : Promise.resolve(DEFAULT_USER_MEMORY_SETTINGS),
      ])
    : [null, null, DEFAULT_USER_MEMORY_SETTINGS];
  const macroContext = row ? createMacroContextResolver(snapshot.signals).forRow(row) : null;
  const symbolOpportunity = row
    ? buildOpportunitiesPageModel(
        snapshot.signals,
        performance,
        shockPattern ? new Map([[row.symbol.toUpperCase(), shockPattern]]) : new Map(),
        narrative ? new Map([[row.symbol.toUpperCase(), narrative]]) : new Map(),
      ).rows.find((item) => item.symbol === row.symbol.toUpperCase()) ?? null
    : null;
  const strategyIntelligence = buildStrategyIntelligenceSystem({
    forwardRows: symbolForwardRows,
    opportunities: symbolOpportunity ? [symbolOpportunity] : [],
    personalizationProfile,
  });
  const scenarioIntelligence = buildScenarioIntelligenceSystem({
    rows: symbolOpportunity ? [symbolOpportunity] : [],
  });
  const decisionJournalEntries = decisionJournalContext?.entries ?? [];
  const decisionMemory = decisionJournalContext?.memory ?? buildDecisionMemorySummary([], { symbol });
  const decisionCoaching = row
    ? memorySettings.journalCoachingEnabled
      ? buildPersonalizedDecisionCoaching({ entries: decisionJournalEntries, memory: decisionMemory, profile: personalizationProfile, row })
      : {
          coachingNotes: ["Journal coaching is paused in Account settings. Saved entries remain private and exportable."],
          fitLabel: "Memory still building" as const,
          strengthReason: "Journal coaching is paused, so this panel is not using prior entries to personalize the setup.",
          warningReason: "The scanner decision, fragility, and invalidation context remain the source of truth.",
        }
    : null;
  const workflowEvolution = row ? await getWorkflowEvolutionForUser(entitlementUserId, [row], { surface: "symbol" }).catch(() => null) : null;
  const symbolSearchDocuments = buildSymbolSearchIndex({
    historySymbols: history.map(() => cleanSymbol(symbol)).filter(Boolean),
    recentSymbols: [cleanSymbol(symbol)],
    rows: snapshot.signals,
  });
  const symbolWorkflowMaturity = row
    ? buildSymbolWorkflowMaturityModel({
        history,
        marketMemoryAvailable: marketMemory?.available ?? false,
        row,
        symbol: row.symbol,
        workflowChanges: workflowEvolution?.whatChanged,
      })
    : null;
  const prefetchedChartPackets = await buildPrefetchedChartPackets(adapter, row.symbol, snapshot.signals);
  const unavailableMarketMemory: MarketMemorySummary = {
    analogs: [],
    available: false,
    evidence: {
      explanation: "Market memory is unavailable for this symbol.",
      label: "No comparable memory yet",
      sampleSize: 0,
      tier: "unavailable",
    },
    narrative: ["Market memory is unavailable for this symbol."],
    outcome: null,
  };

  return (
    <>
      <SymbolCommandSearch documents={symbolSearchDocuments} initialQuery={row.symbol} title="Search related symbols, macro peers, and replay context" />
      {symbolWorkflowMaturity ? <SymbolWorkflowMaturityPanel model={symbolWorkflowMaturity} symbol={row.symbol} /> : null}
      <SymbolTerminalWorkspace
        dataFreshness={dataFreshness ?? freshnessFromTimestamp(null)}
        adaptiveLearning={adaptiveLearning}
        contextRows={snapshot.signals}
        decisionCoaching={decisionCoaching}
        decisionJournalEntries={decisionJournalEntries}
        decisionMemory={decisionMemory}
        workflowEvolution={workflowEvolution}
        edgeProof={edgeProof ?? buildHistoricalEdgeProof(row, null)}
        history={history}
        globalDecision={globalDecision}
        institutionalOpportunity={symbolOpportunity}
        intradayDriftRows={intradayDriftRows}
        macroContext={macroContext}
        marketMemory={marketMemory ?? unavailableMarketMemory}
        narrative={narrative}
        paperEvents={paper.events ?? []}
        paperPositions={paper.positions ?? []}
        personalizationProfile={personalizationProfile}
        premiumAccess={premiumAccess}
        prefetchedChartPackets={prefetchedChartPackets}
        viewerAuthenticated={entitlementAuthenticated}
        priceSeries={detail.history}
        row={row}
        shockPattern={shockPattern}
        scenarioIntelligence={scenarioIntelligence}
        strategyIntelligence={strategyIntelligence}
        timeline={timeline}
      />
    </>
  );
}

function SymbolInstantWorkflowShell({
  dataFreshness,
  priceSeries,
  row,
}: {
  dataFreshness: ReturnType<typeof freshnessFromTimestamp>;
  priceSeries: Record<string, ScannerScalar>[];
  row: RankingRow;
}) {
  const candles = rowsToFastShellCandles(priceSeries);
  const latest = candles[candles.length - 1]?.close ?? numericShellValue(row.price);
  const first = candles[0]?.close ?? null;
  const movePct = latest !== null && first !== null && first !== 0 ? ((latest - first) / first) * 100 : null;
  const path = fastShellPath(candles, 1040, 300);
  const decision = String(row.final_decision ?? row.action ?? "WATCH").replace(/_/g, " ");
  const score = numericShellValue(row.final_score ?? row.score ?? row.quality_score);
  return (
    <section
      className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/20"
      data-chart-fast-route-shell="true"
      data-chart-symbol={row.symbol.toUpperCase()}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Instant symbol shell</div>
          <h1 className="mt-2 font-mono text-4xl font-black tracking-tight text-slate-50 sm:text-6xl">{row.symbol.toUpperCase()}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {String(row.company_name ?? row.sector ?? "Scanner signal")} · full chart workstation, replay, performance, and provider panels hydrate after this real data shell.
          </p>
        </div>
        <div className="grid gap-2 text-right">
          <div className="font-mono text-2xl font-black text-slate-50">{latest === null ? "Limited" : shellMoney(latest)}</div>
          <div className={movePct !== null && movePct >= 0 ? "text-sm font-bold text-emerald-200" : "text-sm font-bold text-rose-200"}>
            {movePct === null ? "Move limited" : `${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%`}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          {path ? (
            <svg aria-label={`${row.symbol} instant verified chart shell`} className="h-full w-full" preserveAspectRatio="none" role="img" viewBox="0 0 1040 300">
              <path d={path.area} fill="rgba(34, 211, 238, 0.10)" />
              <path d={path.line} fill="none" stroke="rgb(103, 232, 249)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-sm text-slate-400">Verified chart history is limited for this symbol. No synthetic candles are drawn.</div>
          )}
        </div>
        <div className="grid gap-3">
          <ShellMetric label="Decision" value={decision} />
          <ShellMetric label="Score" value={score === null ? "Limited" : `${Math.round(score)}`} />
          <ShellMetric label="Freshness" value={dataFreshness.label} />
        </div>
      </div>
    </section>
  );
}

function ShellMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-bold text-slate-100">{value}</div>
    </div>
  );
}

async function buildPrefetchedChartPackets(adapter: ScannerDataAdapter, currentSymbol: string, rows: RankingRow[]): Promise<PrefetchedChartPacket[]> {
  const current = cleanSymbol(currentSymbol);
  const symbols = new Set<string>();
  for (const symbol of ["AMD", "NVDA", "QQQ", ...rows.slice(0, 8).map((row) => row.symbol)]) {
    const cleaned = cleanSymbol(symbol);
    if (cleaned && cleaned !== current) symbols.add(cleaned);
    if (symbols.size >= 4) break;
  }
  const details = await Promise.all([...symbols].map(async (symbol) => ({ detail: await adapter.getSymbolDetail(symbol).catch(() => null), symbol })));
  return details.flatMap(({ detail, symbol }) => {
    if (!detail?.row) return [];
    const candles = rowsToFastShellCandles(detail.history);
    return [{
      candles,
      dataSource: candles.length ? "scanner validated OHLC history" : "limited validated price history",
      interpretation: candles.length
        ? `${symbol} chart can switch in place from a server-prefetched authenticated packet. Use it with TradeVeto risk, replay, and regime context.`
        : `${symbol} has limited validated chart history for this in-place switch. No synthetic candles are drawn.`,
      lastUpdated: textShellValue(detail.row.last_updated ?? detail.row.last_updated_utc ?? candles[candles.length - 1]?.time ?? null),
      scannerScore: numericShellValue(detail.row.final_score ?? detail.row.score ?? detail.row.quality_score),
      symbol,
    }];
  });
}

function rowsToFastShellCandles(rows: Record<string, ScannerScalar>[]): FastShellCandle[] {
  return rows
    .map((row) => {
      const time = textShellValue(row.date ?? row.datetime ?? row.timestamp_utc ?? row.time);
      const open = numericShellValue(row.open ?? row.Open);
      const high = numericShellValue(row.high ?? row.High);
      const low = numericShellValue(row.low ?? row.Low);
      const close = numericShellValue(row.close ?? row.Close);
      if (!time || open === null || high === null || low === null || close === null) return null;
      return { close, high, low, open, time };
    })
    .filter((candle): candle is FastShellCandle => Boolean(candle));
}

function fastShellPath(candles: FastShellCandle[], width: number, height: number): { area: string; line: string } | null {
  const closes = candles.map((candle) => candle.close).filter((value) => Number.isFinite(value));
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const step = width / Math.max(1, closes.length - 1);
  const points = closes.map((close, index) => {
    const x = index * step;
    const y = height - ((close - min) / span) * (height - 28) - 14;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M ${points.join(" L ")}`;
  const lastX = (closes.length - 1) * step;
  return { area: `${line} L ${lastX.toFixed(2)},${height} L 0,${height} Z`, line };
}

function numericShellValue(value: ScannerScalar): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function textShellValue(value: ScannerScalar): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function shellMoney(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2, style: "currency" });
}
