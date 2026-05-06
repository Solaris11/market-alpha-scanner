import { DataHealthBanner } from "@/components/data-health-indicator";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { RiskAcknowledgement } from "@/components/legal/RiskAcknowledgement";
import { getScanDataHealth } from "@/lib/scanner-data";
import { TerminalHeader } from "./TerminalHeader";

export async function TerminalShell({ children }: { children: React.ReactNode }) {
  const health = await getScanDataHealth().catch(() => null);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#070a12_0%,#0b1020_48%,#111827_100%)] px-3 pb-24 pt-3 text-slate-100 sm:px-4 sm:pt-4 xl:pb-4">
      <div className="mx-auto max-w-[1780px]">
        <TerminalHeader />
        {health ? <DataHealthBanner freshness={health} /> : null}
        {children}
        <LegalFooter />
        <RiskAcknowledgement />
      </div>
    </main>
  );
}
