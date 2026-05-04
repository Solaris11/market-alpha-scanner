import { AccountPill } from "@/components/account/AccountPill";
import { BrandMark } from "@/components/brand/BrandMark";
import { CompactLegalNotice } from "@/components/legal/CompactLegalNotice";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OnboardingHelpButton } from "@/components/onboarding/OnboardingHelpButton";
import { TerminalNav } from "./TerminalNav";

export function TerminalHeader() {
  return (
    <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <BrandMark />
      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TerminalNav />
          <OnboardingHelpButton />
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <CompactLegalNotice className="self-center" />
          <NotificationBell />
          <AccountPill />
        </div>
      </div>
    </header>
  );
}
