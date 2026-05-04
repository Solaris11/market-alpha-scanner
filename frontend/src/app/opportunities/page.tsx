import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { OpportunitiesWorkspace } from "@/components/opportunities/OpportunitiesWorkspace";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    return (
      <TerminalShell>
        <PublicSignalPreviewList accessState={premiumAccessState(entitlement)} authenticated={entitlement.authenticated} refreshOnPremium summary={publicPreview.summary} title="Research Preview" />
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
