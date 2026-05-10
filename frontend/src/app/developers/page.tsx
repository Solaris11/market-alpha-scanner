import { DeveloperPlatformWorkspace } from "@/components/developers/DeveloperPlatformWorkspace";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { PremiumLockedState } from "@/components/premium/PremiumLockedState";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";
import { developerPlatformCatalog, listDeveloperApiKeys, listDeveloperApiUsageSummary, listDeveloperWebhookDeliveries, listDeveloperWebhookEndpoints } from "@/lib/server/developer-platform";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
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
          description="Developer APIs, webhook alerts, opportunity feeds, macro feeds, shock feeds, replay APIs, and portfolio scenario APIs are premium integration features."
          previewItems={["Scoped API keys and authenticated SDK-style requests", "Signed webhook endpoints for external workflows", "Opportunity, macro, shock, replay, and portfolio/scenario feeds"]}
          title={entitlement.authenticated ? "Developer platform is available on Premium" : "Sign in to preview developer APIs"}
        />
      </TerminalShell>
    );
  }

  try {
    const [apiKeys, webhooks, deliveries, usage] = await Promise.all([
      listDeveloperApiKeys(entitlement.user.id),
      listDeveloperWebhookEndpoints(entitlement.user.id),
      listDeveloperWebhookDeliveries(entitlement.user.id),
      listDeveloperApiUsageSummary(entitlement.user.id),
    ]);
    return (
      <TerminalShell>
        <DeveloperPlatformWorkspace apiKeys={apiKeys} catalog={developerPlatformCatalog()} deliveries={deliveries} usage={usage} webhooks={webhooks} />
      </TerminalShell>
    );
  } catch (error) {
    console.warn("[developers] failed to load developer platform", error instanceof Error ? error.message : error);
    return (
      <TerminalShell>
        <GlassPanel className="p-6">
          <SectionTitle eyebrow="Developer Platform" title="Integration Console Temporarily Unavailable" meta="no data changed" />
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            API keys, webhook endpoints, and delivery records could not load from the current environment. The developer platform will resume when the database is available.
          </p>
        </GlassPanel>
      </TerminalShell>
    );
  }
}
