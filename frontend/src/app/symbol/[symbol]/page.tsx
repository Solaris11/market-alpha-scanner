import Link from "next/link";
import { SymbolTerminalWorkspace } from "@/components/terminal/SymbolTerminalWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EmptyState } from "@/components/terminal/ui/EmptyState";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { freshnessFromTimestamp } from "@/lib/data-health";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
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
    const rows = await adapter.getOverviewSignals();
    const row = rows.find((item) => item.symbol.toUpperCase() === cleaned) ?? null;
    const dataFreshness = row ? freshnessFromTimestamp(typeof row.last_updated === "string" ? row.last_updated : typeof row.last_updated_utc === "string" ? row.last_updated_utc : null) : null;

    return (
      <TerminalShell>
        <div className="mb-4">
          <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-100" href="/terminal">
            Back to terminal
          </Link>
        </div>
        {!row ? (
          <EmptyState title="Symbol not found" message={`${cleaned} is not available in the current scanner output.`} />
        ) : (
          <SymbolTerminalWorkspace
            dataFreshness={dataFreshness ?? freshnessFromTimestamp(null)}
            edgeProof={buildHistoricalEdgeProof(row, null)}
            history={[]}
            paperEvents={[]}
            paperPositions={[]}
            premiumAccess={false}
            viewerAuthenticated={entitlement.authenticated}
            priceSeries={[]}
            row={row}
            timeline={buildConvictionTimelineModel([])}
          />
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
