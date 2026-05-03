import { OpportunitiesWorkspace } from "@/components/opportunities/OpportunitiesWorkspace";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const entitlement = await getEntitlement();
  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    return (
      <TerminalShell>
        <PublicSignalPreviewList summary={publicPreview.summary} title="Research Preview" />
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const [rows, regime, performance] = await Promise.all([
    adapter.getOverviewSignals(),
    adapter.getMarketRegime(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
  ]);
  const model = buildOpportunitiesPageModel(rows, performance);

  return (
    <TerminalShell>
      <OpportunitiesWorkspace best={model.best} marketCondition={regime.label} rows={model.rows} />
    </TerminalShell>
  );
}
