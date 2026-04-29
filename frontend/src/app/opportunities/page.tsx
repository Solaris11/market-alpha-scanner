import { OpportunitiesWorkspace } from "@/components/opportunities/OpportunitiesWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { buildEdgeLookup } from "@/lib/trading/conviction";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const adapter = new ScannerDataAdapter();
  const [rows, regime, performance] = await Promise.all([
    adapter.getOverviewSignals(),
    adapter.getMarketRegime(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
  ]);
  const edges = buildEdgeLookup(rows, performance);

  return (
    <TerminalShell>
      <OpportunitiesWorkspace edges={edges} regime={regime} rows={rows} />
    </TerminalShell>
  );
}
