import Link from "next/link";
import { SymbolTerminalWorkspace } from "@/components/terminal/SymbolTerminalWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EmptyState } from "@/components/terminal/ui/EmptyState";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { freshnessFromTimestamp } from "@/lib/data-health";
import { getPaperData } from "@/lib/paper-data";
import { getPerformanceData } from "@/lib/scanner-data";
import { buildConvictionTimelineModel } from "@/lib/trading/conviction-timeline-model";
import { buildHistoricalEdgeProof } from "@/lib/trading/edge-proof";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function SymbolDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const adapter = new ScannerDataAdapter();
  const [detail, history, paper, performance] = await Promise.all([
    adapter.getSymbolDetail(symbol),
    adapter.getSignalHistory(symbol),
    getPaperData().catch(() => ({ positions: [], events: [] })),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
  ]);
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
          priceSeries={detail.history}
          row={row}
          timeline={timeline}
        />
      )}
    </TerminalShell>
  );
}
