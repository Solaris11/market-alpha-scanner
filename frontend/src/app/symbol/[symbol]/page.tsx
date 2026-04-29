import Link from "next/link";
import { SymbolTerminalWorkspace } from "@/components/terminal/SymbolTerminalWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { EmptyState } from "@/components/terminal/ui/EmptyState";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPaperData } from "@/lib/paper-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function SymbolDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const adapter = new ScannerDataAdapter();
  const [detail, history, paper] = await Promise.all([
    adapter.getSymbolDetail(symbol),
    adapter.getSignalHistory(symbol),
    getPaperData().catch(() => ({ positions: [], events: [] })),
  ]);
  const row = detail.row;

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
          history={history}
          paperEvents={paper.events ?? []}
          paperPositions={paper.positions ?? []}
          priceSeries={detail.history}
          row={row}
        />
      )}
    </TerminalShell>
  );
}
