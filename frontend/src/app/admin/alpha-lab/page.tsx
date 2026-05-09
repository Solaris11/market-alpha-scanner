import { AlphaLabDashboard } from "@/components/admin/AlphaLabDashboard";
import { AdminEmpty, AdminSection } from "@/components/admin/AdminChrome";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";

export const dynamic = "force-dynamic";

export default async function AdminAlphaLabPage() {
  const adapter = new ScannerDataAdapter();
  const [rows, performance] = await Promise.all([
    adapter.getOverviewSignals().catch(() => []),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
  ]);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  const model = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  const system = buildStrategyIntelligenceSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: model.rows,
  });

  if (!performance && !rows.length) {
    return (
      <AdminSection title="TradeVeto Alpha Lab" subtitle="Strategy intelligence needs scanner rows or forward-return evidence.">
        <AdminEmpty>No strategy evidence is available right now.</AdminEmpty>
      </AdminSection>
    );
  }

  return <AlphaLabDashboard system={system} />;
}
