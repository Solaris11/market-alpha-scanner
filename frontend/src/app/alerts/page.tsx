import { AlertsWorkspace } from "@/components/alerts/alerts-workspace";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/shell";
import { getAlertOverview } from "@/lib/alerts";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
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
          description="Saved alert rules, active matches, and notification automation are premium features. The scanner preview remains available without alerts."
          previewItems={["Watchlist and global scanner alert rules", "Active match coverage against current signals", "Notification routing for configured channels"]}
          title={entitlement.authenticated ? "Alerts are available on Premium" : "Sign in to preview alert automation"}
        />
      </TerminalShell>
    );
  }

  const overview = await getAlertOverview();

  return (
    <TerminalShell>
      <AlertsWorkspace initialOverview={overview} />
    </TerminalShell>
  );
}
