import { CommunityIntelligenceWorkspace } from "@/components/community/CommunityIntelligenceWorkspace";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { loadCommunityIntelligenceSystem } from "@/lib/server/community-intelligence";

export const dynamic = "force-dynamic";

export default async function CommunityIntelligencePage() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) {
    return (
      <TerminalShell>
        <LegalAcceptanceRequiredState />
      </TerminalShell>
    );
  }

  if (!hasPremiumAccess(entitlement) || !entitlement.user) {
    return (
      <TerminalShell>
        <PremiumLockedState
          authenticated={entitlement.authenticated}
          description="Community intelligence adds shared watchlists, replay studies, most-followed opportunities, anonymous trend markers, and educational theme clusters without public chat noise."
          previewItems={["Opt-in shared watchlists", "Anonymous opportunity trend markers", "Educational replay studies and theme clusters"]}
          title={entitlement.authenticated ? "Community intelligence is available on Premium" : "Sign in to preview community intelligence"}
        />
      </TerminalShell>
    );
  }

  try {
    const system = await loadCommunityIntelligenceSystem(entitlement.user.id);
    return (
      <TerminalShell>
        <CommunityIntelligenceWorkspace initialSystem={system} />
      </TerminalShell>
    );
  } catch (error) {
    console.warn("[community] failed to load", error instanceof Error ? error.message : error);
    return (
      <TerminalShell>
        <CommunityUnavailableState />
      </TerminalShell>
    );
  }
}

function CommunityUnavailableState() {
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Community Intelligence" title="Community Layer Temporarily Unavailable" meta="no data changed" />
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        Community intelligence could not load from the current environment. Shared watchlists, replay studies, and anonymous trend markers remain server-side features and will resume when the database is available.
      </p>
    </GlassPanel>
  );
}
