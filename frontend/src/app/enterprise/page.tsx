import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { EnterpriseReadinessWorkspace } from "@/components/enterprise/EnterpriseReadinessWorkspace";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { loadEnterpriseReadiness } from "@/lib/server/enterprise";

export const dynamic = "force-dynamic";

export default async function EnterpriseReadinessPage() {
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
          description="Enterprise readiness, organization workspaces, SSO visibility, permissions, session controls, and audit trails require a premium account."
          previewItems={["Organization account model and role matrix", "SSO readiness for Google, Microsoft, OIDC, and SAML", "Team activity, audit trails, and session controls"]}
          title={entitlement.authenticated ? "Enterprise readiness is available on Premium" : "Sign in to preview enterprise readiness"}
        />
      </TerminalShell>
    );
  }

  try {
    const model = await loadEnterpriseReadiness(entitlement.user);
    return (
      <TerminalShell>
        <EnterpriseReadinessWorkspace model={model} />
      </TerminalShell>
    );
  } catch (error) {
    console.warn("[enterprise] failed to load readiness page", error instanceof Error ? error.message : error);
    return (
      <TerminalShell>
        <GlassPanel className="p-6">
          <SectionTitle eyebrow="Enterprise Readiness" title="Enterprise Layer Temporarily Unavailable" meta="no data changed" />
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            The enterprise readiness model could not load from the current environment. Organization data, SSO settings, audit trails, and session controls remain server-side features and will resume when the database is available.
          </p>
        </GlassPanel>
      </TerminalShell>
    );
  }
}
