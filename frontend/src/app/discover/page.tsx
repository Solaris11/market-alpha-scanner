import { IntelligenceDiscoveryWorkspace } from "@/components/discovery/IntelligenceDiscoveryWorkspace";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { loadIntelligenceDiscoverySystem } from "@/lib/server/discovery-intelligence";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { premiumAccessState } from "@/lib/security/premium-access-state";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
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
        <PublicSignalPreviewList accessState={premiumAccessState(entitlement)} authenticated={entitlement.authenticated} refreshOnPremium summary={publicPreview.summary} title="Discovery Preview" />
      </TerminalShell>
    );
  }

  const system = await loadIntelligenceDiscoverySystem(entitlement.user?.id ?? null);

  return (
    <TerminalShell>
      <div id="search" className="scroll-mt-28">
        <IntelligenceDiscoveryWorkspace system={system} />
      </div>
    </TerminalShell>
  );
}
