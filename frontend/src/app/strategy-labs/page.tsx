import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { StrategyLabsWorkspace } from "@/components/strategy-labs/StrategyLabsWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { buildSimulatedAiPortfolioSystem } from "@/lib/trading/simulated-ai-portfolio";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";

export const dynamic = "force-dynamic";

export default async function StrategyLabsPage() {
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
          description="Strategy Labs creates transparent simulated research portfolios with entry/exit history, benchmark context, drawdown, and risk reasoning. It is simulation only and never places real-money trades."
          previewItems={["Conservative, Balanced, and Aggressive simulated AI portfolios", "Transparent why-entered and why-exited history from completed evidence", "Portfolio curve, PnL, win rate, volatility, drawdown, and benchmark comparison"]}
          title={entitlement.authenticated ? "Strategy Labs is available on Premium" : "Sign in to preview Strategy Labs"}
        />
      </TerminalShell>
    );
  }

  const adapter = new ScannerDataAdapter();
  const [rows, performance, personalizationProfile] = await Promise.all([
    adapter.getOverviewSignals().catch(() => []),
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getPersonalizationProfileForUser(entitlement.user?.id ?? null).catch(() => null),
  ]);
  const symbols = rows.map((row) => row.symbol);
  const [shockPatterns, narratives] = await Promise.all([
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  const opportunities = buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives);
  const strategySystem = buildStrategyIntelligenceSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: opportunities.rows,
    personalizationProfile,
  });
  const simulatedPortfolioSystem = buildSimulatedAiPortfolioSystem({
    forwardRows: performance?.forwardReturns.rows ?? [],
    opportunities: opportunities.rows,
    strategySystem,
  });

  return (
    <TerminalShell>
      <StrategyLabsWorkspace system={simulatedPortfolioSystem} />
    </TerminalShell>
  );
}
