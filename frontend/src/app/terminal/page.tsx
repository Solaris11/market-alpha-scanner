import nextDynamic from "next/dynamic";
import { LegalAcceptanceRequiredState } from "@/components/legal/LegalAcceptanceRequiredState";
import { MarketOnboarding } from "@/components/onboarding/MarketOnboarding";
import { PublicSignalPreviewList } from "@/components/premium/PublicSignalPreview";
import { PremiumAccessCta } from "@/components/premium/PremiumAccessCta";
import { DailyActionCard } from "@/components/terminal/DailyActionCard";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getEntitlement, hasPremiumAccess, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { assertNoPremiumFields } from "@/lib/server/premium-preview";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { premiumAccessState } from "@/lib/security/premium-access-state";

// Loaded lazily so the locked preview below never carries the authenticated
// terminal's client components. See TerminalPremiumView for the measurement.
const TerminalPremiumView = nextDynamic(async () => (await import("@/components/terminal/TerminalPremiumView")).TerminalPremiumView);

export const dynamic = "force-dynamic";

export default async function TerminalPage() {
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
    const accessState = premiumAccessState(entitlement);
    const publicAction = {
      action: "WAIT" as const,
      label: "WAIT",
      reason: publicPreview.scanSafety.active ? publicPreview.scanSafety.reason : entitlement.authenticated ? "Upgrade to Premium to unlock today's trade plan." : "Sign in with Premium to unlock today's trade plan.",
      symbol: null,
      tone: "wait" as const,
    };
    assertNoPremiumFields({ publicAction, summary: publicPreview.summary });

    return (
      <TerminalShell>
        <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <DailyActionCard
              action={publicAction}
              dataStatus={publicPreview.summary.scannerStatus}
              decisionDistribution={[
                { label: "WATCH", value: 0 },
                { label: "WAIT", value: 0 },
                { label: "AVOID", value: 0 },
              ]}
              whyReasons={["Premium rows are hidden in public preview.", "Decision details unlock after entitlement checks.", "Research only. Not financial advice."]}
            />
            <PublicSignalPreviewList accessState={accessState} authenticated={entitlement.authenticated} refreshOnPremium summary={publicPreview.summary} title="Market Preview" />
          </div>
          <GlassPanel className="p-5 xl:sticky xl:top-4 xl:self-start">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Premium</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Trade plans are locked</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Account access determines whether this preview unlocks checkout or the full Premium terminal. Trade plans stay hidden until entitlement is confirmed.
            </p>
            <div className="mt-4">
              <PremiumAccessCta initialState={accessState} refreshOnPremium />
            </div>
          </GlassPanel>
        </div>
        <MarketOnboarding tradePlanHref="/opportunities" />
      </TerminalShell>
    );
  }

  return <TerminalPremiumView entitlement={entitlement} />;
}
