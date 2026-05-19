import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { GlobalMarketCommandCenter } from "@/components/market/GlobalMarketCommandCenter";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { InstitutionalDashboardWorkspace } from "@/components/dashboard/InstitutionalDashboardWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { InstitutionalSuperplatformPanel } from "@/components/visual/InstitutionalSuperplatformPanel";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { getMarketChartHubData } from "@/lib/server/validated-price-history";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { readUserWorkspacePreferences } from "@/lib/server/user-workspace-preferences";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import { buildInstitutionalSuperplatformSystem } from "@/lib/trading/institutional-superplatform";
import { buildMarketCommandModel } from "@/lib/trading/market-research";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";

export const dynamic = "force-dynamic";

export default async function InstitutionalDashboardPage() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement)) {
    return (
      <TerminalShell>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Institutional heatmaps, opportunity clusters, pressure maps, and executive market briefing are premium intelligence surfaces."
          previewItems={["Sector, fragility, asymmetry, macro, volatility, liquidity, and shock heatmaps", "AI momentum, defensive rotation, commodity shock, and institutional-quality clusters", "Live opportunity map with strongest, improving, fragile, and shock-oriented setups"]}
          title={entitlement.authenticated ? "Institutional dashboard is available on Premium" : "Sign in to preview institutional dashboard"}
        />
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const [rows, regime, performance, personalizationProfile, watchlistSymbols, workspacePreferences, marketChartHubData] = await Promise.all([
    adapter.getOverviewSignals(),
    adapter.getMarketRegime(),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getPersonalizationProfileForUser(entitlement.user?.id ?? null).catch(() => null),
    entitlement.user?.id ? readUserWatchlist(entitlement.user.id).catch(() => []) : Promise.resolve([]),
    entitlement.user?.id ? readUserWorkspacePreferences(entitlement.user.id).catch(() => null) : Promise.resolve(null),
    getMarketChartHubData().catch(() => []),
  ]);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  const model = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  const workflowEvolution = await getWorkflowEvolutionForUser(entitlement.user?.id ?? null, rows, { surface: "opportunities", watchlistSymbols }).catch(() => null);
  const superplatform = buildInstitutionalSuperplatformSystem({
    marketCondition: regime.label,
    personalizationProfile,
    rows: model.rows,
    watchlistSymbols,
    workflowEvolution,
    workspacePreferences,
  });
  const marketCommand = buildMarketCommandModel({
    charts: marketChartHubData,
    rows,
  });

  return (
    <TerminalShell>
      <div className="mb-5 space-y-5">
        <GlobalMarketCommandCenter compact model={marketCommand} title="Workspace Market Command" />
        <InstitutionalSuperplatformPanel compact system={superplatform} />
      </div>
      <InstitutionalDashboardWorkspace
        initialProfile={personalizationProfile ?? undefined}
        marketCondition={regime.label}
        rows={model.rows}
        workflowEvolution={workflowEvolution ?? undefined}
      />
    </TerminalShell>
  );
}
