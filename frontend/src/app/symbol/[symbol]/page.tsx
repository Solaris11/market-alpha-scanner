import Link from "next/link";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { PublicSymbolPreview } from "@/components/premium/PublicSignalPreview";
import { SymbolTerminalWorkspace } from "@/components/terminal/SymbolTerminalWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EmptyState } from "@/components/terminal/ui/EmptyState";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { freshnessFromTimestamp } from "@/lib/data-health";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicSymbolSignal } from "@/lib/server/public-signal-data";
import { buildConvictionTimelineModel } from "@/lib/trading/conviction-timeline-model";
import { buildHistoricalEdgeProof } from "@/lib/trading/edge-proof";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function SymbolDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const entitlement = await getEntitlement();
  const premiumAccess = hasPremiumAccess(entitlement);
  const adapter = new ScannerDataAdapter();

  if (!premiumAccess) {
    const cleaned = symbol.trim().toUpperCase();
    const { signal } = await getPublicSymbolSignal(cleaned);
    assertNoPremiumFields({ signal });

    return (
      <TerminalShell>
        <div className="mb-4">
          <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-100" href="/terminal">
            Back to terminal
          </Link>
        </div>
        {!signal ? (
          <EmptyState title="Symbol not found" message={`${cleaned} is not available in the current scanner output.`} />
        ) : (
          <div className="space-y-4">
            <PublicSymbolPreview signal={signal} />
            <PremiumLockedState
              authenticated={entitlement.authenticated}
              description="Premium unlocks the full symbol trade plan, risk levels, simulator, and execution controls."
              previewItems={["Full trade plan", "Risk simulation", "Decision assistant"]}
              title={entitlement.authenticated ? "This trade plan is available on Premium" : "Sign in to unlock this trade plan"}
            />
          </div>
        )}
      </TerminalShell>
    );
  }

  const [detail, history, paper, performance] = await Promise.all([adapter.getSymbolDetail(symbol), adapter.getSignalHistory(symbol), getPaperData().catch(() => ({ positions: [], events: [] })), getPerformanceData({ forwardTailRows: 5000 }).catch(() => null)]);
  const row = detail.row;
  const edgeProof = row ? buildHistoricalEdgeProof(row, performance) : null;
  const timeline = buildConvictionTimelineModel(history);
  const dataFreshness = row ? freshnessFromTimestamp(typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null) : null;

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
