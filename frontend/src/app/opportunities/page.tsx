import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { OpportunitiesWorkspace } from "@/components/opportunities/OpportunitiesWorkspace";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
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
  const [rows, regime, performance, personalizationProfile] = await Promise.all([
    adapter.getOverviewSignals(),
    adapter.getMarketRegime(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getPersonalizationProfileForUser(entitlement.user?.id ?? null).catch(() => null),
  ]);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  const model = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  const bestDetail = model.best ? await adapter.getSymbolDetail(model.best.symbol).catch(() => null) : null;

  return (
    <TerminalShell>
      <OpportunitiesWorkspace best={model.best} bestPriceSeries={bestDetail?.history ?? []} initialProfile={personalizationProfile ?? undefined} marketCondition={regime.label} rows={model.rows} />
    </TerminalShell>
  );
}
