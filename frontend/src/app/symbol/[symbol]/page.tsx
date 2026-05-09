import Link from "next/link";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { PublicSymbolPreview } from "@/components/premium/PublicSignalPreview";
import { SymbolTerminalWorkspace } from "@/components/terminal/SymbolTerminalWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EmptyState } from "@/components/terminal/ui/EmptyState";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { freshnessFromTimestamp } from "@/lib/data-health";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getDecisionMemoryForUser } from "@/lib/server/decision-journal";
import { getMarketMemoryForSignal } from "@/lib/server/market-memory";
import { getNarrativeForSymbol } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicSymbolSignal } from "@/lib/server/public-signal-data";
import { getShockMovePattern } from "@/lib/server/shock-move-patterns";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildEdgeLookup, selectBestTradeNow } from "@/lib/trading/conviction";
import { buildConvictionTimelineModel } from "@/lib/trading/conviction-timeline-model";
import { getDailyAction } from "@/lib/trading/daily-action";
import { buildDecisionMemorySummary, buildPersonalizedDecisionCoaching } from "@/lib/trading/decision-journal";
import { buildHistoricalEdgeProof } from "@/lib/trading/edge-proof";
import { createMacroContextResolver } from "@/lib/trading/macro-regime";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

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
    const cleaned = symbol.trim().toUpperCase();
    const { summary, signal } = await getPublicSymbolSignal(cleaned);
    assertNoPremiumFields({ signal, summary });
    const accessState = premiumAccessState(entitlement);

    return (
      <TerminalShell>
        <div className="mb-4">
          <Link className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/terminal">
            Back to terminal
          </Link>
        </div>
        <div className="space-y-4">
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
  const [detail, history, paper, performance, snapshot, scanSafety, shockPattern, narrative, personalizationProfile] = await Promise.all([
    adapter.getSymbolDetail(symbol),
    adapter.getSignalHistory(symbol),
    getPaperData().catch(() => ({ positions: [], events: [] })),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    adapter.getTerminalSnapshot(),
    getCurrentScanSafety(),
    getShockMovePattern(symbol).catch(() => null),
    getNarrativeForSymbol(symbol).catch(() => null),
    getPersonalizationProfileForUser(entitlement.user?.id ?? null).catch(() => null),
  ]);
  const row = detail.row;
  const edgeProof = row ? buildHistoricalEdgeProof(row, performance) : null;
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
  const [marketMemory, decisionJournalContext] = row
    ? await Promise.all([
        getMarketMemoryForSignal(row),
        entitlement.user?.id ? getDecisionMemoryForUser(entitlement.user.id, { symbol: row.symbol }).catch(() => null) : Promise.resolve(null),
      ])
    : [null, null];
  const macroContext = row ? createMacroContextResolver(snapshot.signals).forRow(row) : null;
  const decisionJournalEntries = decisionJournalContext?.entries ?? [];
  const decisionMemory = decisionJournalContext?.memory ?? buildDecisionMemorySummary([], { symbol });
  const decisionCoaching = row ? buildPersonalizedDecisionCoaching({ entries: decisionJournalEntries, memory: decisionMemory, profile: personalizationProfile, row }) : null;
  const workflowEvolution = row ? await getWorkflowEvolutionForUser(entitlement.user?.id ?? null, [row], { surface: "symbol" }).catch(() => null) : null;
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
    <TerminalShell>
      <div className="mb-4">
        <Link className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-300/40 hover:text-cyan-100" href="/terminal">
          Back to terminal
        </Link>
      </div>
      {!row ? (
        <EmptyState title="Symbol not found" message={`${symbol.toUpperCase()} is not available in the current scanner output.`} />
      ) : (
        <SymbolTerminalWorkspace
          dataFreshness={dataFreshness ?? freshnessFromTimestamp(null)}
          decisionCoaching={decisionCoaching}
          decisionJournalEntries={decisionJournalEntries}
          decisionMemory={decisionMemory}
          workflowEvolution={workflowEvolution}
          edgeProof={edgeProof ?? buildHistoricalEdgeProof(row, null)}
          history={history}
          globalDecision={globalDecision}
          macroContext={macroContext}
          marketMemory={marketMemory ?? unavailableMarketMemory}
          narrative={narrative}
          paperEvents={paper.events ?? []}
          paperPositions={paper.positions ?? []}
          personalizationProfile={personalizationProfile}
          premiumAccess
          viewerAuthenticated={entitlement.authenticated}
          priceSeries={detail.history}
          row={row}
          shockPattern={shockPattern}
          timeline={timeline}
        />
      )}
    </TerminalShell>
  );
}
