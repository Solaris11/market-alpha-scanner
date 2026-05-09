import { AdminEmpty, AdminSection } from "@/components/admin/AdminChrome";
import { ScenarioIntelligenceDashboard } from "@/components/admin/ScenarioIntelligenceDashboard";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";

export const dynamic = "force-dynamic";

export default async function AdminScenariosPage() {
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
  const system = buildScenarioIntelligenceSystem({ rows: model.rows });

  if (!model.rows.length) {
    return (
      <AdminSection title="Scenario Intelligence" subtitle="Scenario stress testing needs current scanner opportunity rows.">
        <AdminEmpty>No opportunity rows are available right now.</AdminEmpty>
      </AdminSection>
    );
  }

  return <ScenarioIntelligenceDashboard system={system} />;
}
