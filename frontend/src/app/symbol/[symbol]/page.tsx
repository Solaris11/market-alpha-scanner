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
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicSymbolSignal } from "@/lib/server/public-signal-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { buildEdgeLookup, selectBestTradeNow } from "@/lib/trading/conviction";
import { buildConvictionTimelineModel } from "@/lib/trading/conviction-timeline-model";
import { getDailyAction } from "@/lib/trading/daily-action";
import { buildHistoricalEdgeProof } from "@/lib/trading/edge-proof";

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
          <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-100" href="/terminal">
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

    return (
      <TerminalShell>
        <div className="mb-4">
          <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-100" href="/terminal">
            Back to terminal
          </Link>
        </div>
        <div className="space-y-4">
          <PublicSymbolPreview summary={summary} />
          <PremiumLockedState
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
  const [detail, history, paper, performance, snapshot, scanSafety] = await Promise.all([
    adapter.getSymbolDetail(symbol),
    adapter.getSignalHistory(symbol),
    getPaperData().catch(() => ({ positions: [], events: [] })),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    adapter.getTerminalSnapshot(),
    getCurrentScanSafety(),
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

  return (
    <TerminalShell>
      <div className="mb-4">
        <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-100" href="/terminal">
          Back to terminal
        </Link>
      </div>
      {!row ? (
        <EmptyState title="Symbol not found" message={`${symbol.toUpperCase()} is not available in the current scanner output.`} />
      ) : (
        <SymbolTerminalWorkspace
          dataFreshness={dataFreshness ?? freshnessFromTimestamp(null)}
          edgeProof={edgeProof ?? buildHistoricalEdgeProof(row, null)}
          history={history}
          globalDecision={globalDecision}
          paperEvents={paper.events ?? []}
          paperPositions={paper.positions ?? []}
          premiumAccess
          viewerAuthenticated={entitlement.authenticated}
          priceSeries={detail.history}
          row={row}
          timeline={timeline}
        />
      )}
    </TerminalShell>
  );
}
