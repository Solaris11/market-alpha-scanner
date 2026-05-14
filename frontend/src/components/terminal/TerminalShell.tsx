import { DataHealthBanner } from "@/components/data-health-indicator";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { MobileModeRail } from "@/components/mobile/MobileModeRail";
import { RiskAcknowledgement } from "@/components/legal/RiskAcknowledgement";
import { FirstRunStarterCard } from "@/components/onboarding/FirstRunStarterCard";
import { getScanDataHealth } from "@/lib/scanner-data";
import { RoutePrefetcher, RouteTransitionFeedback } from "./NavigationPerformance";
import { PersonalizedMobileQuickAccess } from "./PersonalizedMobileQuickAccess";
import { TerminalHeader } from "./TerminalHeader";

export async function TerminalShell({ children }: { children: React.ReactNode }) {
  const health = await getScanDataHealth().catch(() => null);

  return (
    <main className="app-aurora-surface tv-page-motion min-h-screen overflow-x-hidden px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 text-slate-100 sm:px-4 sm:pb-6 sm:pt-4 xl:pb-4">
      <div className="mx-auto max-w-[1780px]">
        <TerminalHeader />
        <RoutePrefetcher />
        <RouteTransitionFeedback />
        <PersonalizedMobileQuickAccess />
        <MobileModeRail />
        {health ? <DataHealthBanner freshness={health} /> : null}
        <FirstRunStarterCard />
        {children}
        <LegalFooter />
        <RiskAcknowledgement />
      </div>
    </main>
  );
}
