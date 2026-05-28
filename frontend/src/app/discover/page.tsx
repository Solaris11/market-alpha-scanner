import { IntelligenceDiscoveryWorkspace } from "@/components/discovery/IntelligenceDiscoveryWorkspace";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance, type Entitlement } from "@/lib/server/entitlements";
import { loadIntelligenceDiscoverySystem } from "@/lib/server/discovery-intelligence";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { premiumAccessState } from "@/lib/security/premium-access-state";
import { buildLargeUniverseDiscoveryProofSystem } from "@/lib/trading/intelligence-discovery";

export const dynamic = "force-dynamic";

type DiscoverPageProps = {
  searchParams?: Promise<{ proof?: string | string[] }>;
};

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = (await searchParams) ?? {};
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

  const proofRequested = largeUniverseProofRequested(params.proof);
  const system = proofRequested && largeUniverseProofAllowed(entitlement)
    ? buildLargeUniverseDiscoveryProofSystem()
    : await loadIntelligenceDiscoverySystem(entitlement.user?.id ?? null);

  return (
    <TerminalShell>
      <div id="search" className="scroll-mt-28">
        <IntelligenceDiscoveryWorkspace system={system} />
      </div>
    </TerminalShell>
  );
}

function largeUniverseProofRequested(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return /^(large-universe|scanner-large-universe|1|true)$/i.test(raw ?? "");
}

function largeUniverseProofAllowed(entitlement: Entitlement): boolean {
  const email = entitlement.user?.email.trim().toLowerCase() ?? "";
  return entitlement.isAdmin || email.endsWith("@tradeveto-probe.local");
}
