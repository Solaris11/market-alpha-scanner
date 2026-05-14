import { DataHealthBanner } from "@/components/data-health-indicator";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { RiskAcknowledgement } from "@/components/legal/RiskAcknowledgement";
import { FirstRunStarterCard } from "@/components/onboarding/FirstRunStarterCard";
import { getScanDataHealth } from "@/lib/scanner-data";
import { FastNavigationLink, RoutePrefetcher, RouteTransitionFeedback } from "./NavigationPerformance";
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
        <MobileFocusStrip />
        <PersonalizedMobileQuickAccess />
        {health ? <DataHealthBanner freshness={health} /> : null}
        <FirstRunStarterCard />
        {children}
        <LegalFooter />
        <RiskAcknowledgement />
      </div>
    </main>
  );
}

function MobileFocusStrip() {
  const links = [
    { href: "/terminal", label: "Now" },
    { href: "/opportunities", label: "Ideas" },
    { href: "/terminal#mobile-watchlist", label: "Watch" },
    { href: "/alerts", label: "Alerts" },
    { href: "/opportunities?tab=full", label: "Find" },
  ];

  return (
    <nav aria-label="Mobile focus shortcuts" className="-mx-1 mb-3 flex gap-5 overflow-x-auto border-b border-white/10 px-1 xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map((link) => (
        <FastNavigationLink
          className="inline-flex min-h-10 shrink-0 items-center border-b-2 border-transparent px-0.5 text-xs font-bold text-slate-300 transition-colors hover:border-white/25 hover:text-slate-100"
          href={link.href}
          key={link.href}
          label={link.label}
        >
          {link.label}
        </FastNavigationLink>
      ))}
    </nav>
  );
}
