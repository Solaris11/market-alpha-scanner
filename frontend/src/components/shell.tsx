import { BrandMark } from "@/components/brand/BrandMark";
import { DataHealthBanner } from "@/components/data-health-indicator";
import { CompactLegalNotice } from "@/components/legal/CompactLegalNotice";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { RiskAcknowledgement } from "@/components/legal/RiskAcknowledgement";
import { getScanDataHealth } from "@/lib/scanner-data";
import { TopNav } from "./top-nav";

export async function TerminalShell({ children }: { children: React.ReactNode }) {
  const health = await getScanDataHealth().catch(() => null);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#070a12_0%,#0b1020_48%,#111827_100%)] px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-[1720px]">
        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <BrandMark />
          <div className="flex flex-col gap-2 lg:items-end">
            <TopNav />
            <CompactLegalNotice />
          </div>
        </header>
        {health ? <DataHealthBanner freshness={health} /> : null}
        {children}
        <LegalFooter />
        <RiskAcknowledgement />
      </div>
    </main>
  );
}
