import { DataHealthBanner } from "@/components/data-health-indicator";
import { GlobalIntelligenceDiscovery } from "@/components/discovery/GlobalIntelligenceDiscovery";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { MobileModeRail } from "@/components/mobile/MobileModeRail";
import { MobileNativeGestureLayer } from "@/components/mobile/MobileNativeGestureLayer";
import { RiskAcknowledgement } from "@/components/legal/RiskAcknowledgement";
import { FirstRunStarterCard } from "@/components/onboarding/FirstRunStarterCard";
import { CinematicAtmosphere } from "@/components/visual/CinematicAtmosphere";
import { getScanDataHealth } from "@/lib/scanner-data";
import { RoutePrefetcher, RouteTransitionFeedback } from "./NavigationPerformance";
import { PersonalizedMobileQuickAccess } from "./PersonalizedMobileQuickAccess";
import { TerminalHeader } from "./TerminalHeader";
import { Suspense } from "react";

export function TerminalShell({ children, prioritizeContent = false }: { children: React.ReactNode; prioritizeContent?: boolean }) {
  return (
    <main className="app-aurora-surface tv-cinematic-shell tv-page-motion min-h-screen overflow-x-hidden px-3 pb-[calc(var(--tv-mobile-nav-clearance)+1.5rem)] pt-3 text-slate-100 sm:px-4 sm:pb-6 sm:pt-4 xl:pb-4">
      <CinematicAtmosphere />
      <div className="tv-cinematic-content mx-auto max-w-[1780px]">
        <TerminalHeader />
        {prioritizeContent ? children : null}
        <GlobalIntelligenceDiscovery />
        <MobileNativeGestureLayer />
        <RoutePrefetcher />
        <RouteTransitionFeedback />
        <PersonalizedMobileQuickAccess />
        <MobileModeRail />
        <Suspense fallback={null}>
          <TerminalHealthBanner />
        </Suspense>
        <FirstRunStarterCard />
        {prioritizeContent ? null : children}
        <LegalFooter />
        <RiskAcknowledgement />
      </div>
    </main>
  );
}

async function TerminalHealthBanner() {
  const health = await getScanDataHealth().catch(() => null);
  return health ? <DataHealthBanner freshness={health} /> : null;
}
