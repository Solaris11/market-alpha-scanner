import { AccountPill } from "@/components/account/AccountPill";
import { BrandMark } from "@/components/brand/BrandMark";
import { CompactLegalNotice } from "@/components/legal/CompactLegalNotice";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OnboardingHelpButton } from "@/components/onboarding/OnboardingHelpButton";
import { DesktopTerminalNav, MobileTerminalNav } from "./TerminalNav";

export function TerminalHeader() {
  return (
    <header className="sticky top-3 z-40 mb-4 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 shadow-xl shadow-black/25 backdrop-blur-2xl lg:px-5 lg:py-4">
      <div className="hidden items-center gap-4 xl:flex">
        <BrandMark />
        <DesktopTerminalNav />
        <div className="flex shrink-0 items-center gap-2">
          <CompactLegalNotice className="self-center" />
          <OnboardingHelpButton />
          <NotificationBell />
          <AccountPill compact />
        </div>
      </div>
      <MobileTerminalNav />
    </header>
  );
}
