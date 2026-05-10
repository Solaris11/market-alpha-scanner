import { DataHealthBanner } from "@/components/data-health-indicator";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { RiskAcknowledgement } from "@/components/legal/RiskAcknowledgement";
import { FirstRunStarterCard } from "@/components/onboarding/FirstRunStarterCard";
import { getScanDataHealth } from "@/lib/scanner-data";
import Link from "next/link";
import { TerminalHeader } from "./TerminalHeader";

export async function TerminalShell({ children }: { children: React.ReactNode }) {
  const health = await getScanDataHealth().catch(() => null);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#070a12_0%,#0b1020_48%,#111827_100%)] px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 text-slate-100 sm:px-4 sm:pb-6 sm:pt-4 xl:pb-4">
      <div className="mx-auto max-w-[1780px]">
        <TerminalHeader />
        <MobileFocusStrip />
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
    <nav aria-label="Mobile focus shortcuts" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 xl:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.map((link) => (
        <Link
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-200 shadow-lg shadow-black/10 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
