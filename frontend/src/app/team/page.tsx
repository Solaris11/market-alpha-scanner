import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TeamIntelligenceWorkspace } from "@/components/team/TeamIntelligenceWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { loadTeamWorkspaceSystem } from "@/lib/server/team-intelligence";

export const dynamic = "force-dynamic";

export default async function TeamIntelligencePage() {
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
          description="Team workspaces, shared watchlists, collaborative research notes, audit trails, and desk-level intelligence are premium collaboration surfaces."
          previewItems={["Shared team watchlists and workspace dashboards", "Collaborative research notes with symbol context", "Role-aware controls and reviewable audit trails"]}
          title={entitlement.authenticated ? "Team intelligence is available on Premium" : "Sign in to preview team intelligence"}
        />
      </TerminalShell>
    );
  }

  try {
    const system = await loadTeamWorkspaceSystem(entitlement.user.id);
    return (
      <TerminalShell>
        <TeamIntelligenceWorkspace initialSystem={system} />
      </TerminalShell>
    );
  } catch (error) {
    console.warn("[team] failed to load team workspace", error instanceof Error ? error.message : error);
    return (
      <TerminalShell>
        <TeamUnavailableState />
      </TerminalShell>
    );
  }
}

function TeamUnavailableState() {
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Team Intelligence" title="Workspace Temporarily Unavailable" meta="no data changed" />
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        The team intelligence workspace could not load from the current environment. Shared watchlists, research notes, and audit trails remain server-side features and will resume when the database is available.
      </p>
    </GlassPanel>
  );
}
